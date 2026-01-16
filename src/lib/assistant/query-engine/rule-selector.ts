// src/lib/assistant/query-engine/rule-selector.ts
// PHASE-D COMPLETION: Now reads exclusively from RegulatoryRule (public schema)
// RuleFact is deprecated - retained only for regression testing.

import { db, dbReg } from "@/lib/db"
import { checkRuleEligibility, buildEvaluationContext } from "./rule-eligibility"
import type { ObligationType } from "../types"
import { calculateEvidenceQuality } from "./evidence-quality"

const AUTHORITY_RANK: Record<string, number> = {
  LAW: 1,
  REGULATION: 2,
  GUIDANCE: 3,
  PRACTICE: 4,
  PROCEDURE: 4, // Same rank as PRACTICE
}

export interface RuleCandidate {
  id: string
  conceptSlug: string
  titleHr: string
  authorityLevel: string
  status: string
  effectiveFrom: Date
  effectiveUntil: Date | null
  confidence: number
  value: string
  valueType: string
  obligationType: ObligationType
  explanationHr: string | null
  appliesWhen: string | null
  /** Risk tier for disclaimer selection (T0, T1, T2, T3) */
  riskTier?: string
  sourcePointers: {
    id: string
    evidenceId: string
    exactQuote: string
    contextBefore: string | null
    contextAfter: string | null
    articleNumber: string | null
    lawReference: string | null
    evidence?: {
      id: string
      url: string
      fetchedAt: Date | null
      source?: {
        name: string
        url: string
      }
    }
  }[]
  /** Rule authority level alias for answer synthesizer and reasoning pipeline */
  authority?: string
  /** Croatian body text for answer synthesis */
  bodyHr?: string
  /** Primary evidence reference for reasoning pipeline */
  evidence?: {
    id: string
    url: string
    sourceType?: string
    fetchedAt?: Date | null
  }
  /** Primary evidence ID for reasoning pipeline */
  evidenceId?: string
}

export interface RuleSelectionContext {
  asOfDate?: Date
  companyData?: {
    legalForm?: string
    vatStatus?: string
    activityNkd?: string
    county?: string
    revenueYtd?: number
  }
  transactionData?: {
    kind?: string
    paymentMethod?: string
    amount?: number
    b2b?: boolean
  }
}

export interface RuleSelectionResult {
  rules: RuleCandidate[]
  ineligible: {
    ruleId: string
    conceptSlug: string
    reason: "EXPIRED" | "FUTURE" | "CONDITION_FALSE" | "MISSING_CONTEXT"
  }[]
  hasMissingContext: boolean
  missingContextRuleIds: string[]
  asOfDate: string
}

/**
 * Select eligible rules for the given concept slugs.
 *
 * HARD GATE: Rules are excluded if:
 * 1. effectiveFrom > asOfDate (FUTURE)
 * 2. effectiveUntil < asOfDate (EXPIRED)
 * 3. appliesWhen evaluates to FALSE (CONDITION_FALSE)
 * 4. appliesWhen requires context we don't have (MISSING_CONTEXT)
 *
 * PHASE-D: Now reads exclusively from RegulatoryRule (public schema)
 */
export async function selectRules(
  conceptSlugs: string[],
  selectionContext?: RuleSelectionContext
): Promise<RuleSelectionResult> {
  if (conceptSlugs.length === 0) {
    return {
      rules: [],
      ineligible: [],
      hasMissingContext: false,
      missingContextRuleIds: [],
      asOfDate: new Date().toISOString(),
    }
  }

  const asOfDate = selectionContext?.asOfDate ?? new Date()

  // Build evaluation context for appliesWhen
  const evalContext = buildEvaluationContext({
    asOfDate,
    companyData: selectionContext?.companyData,
    transactionData: selectionContext?.transactionData,
  })

  // Query RegulatoryRule directly (PHASE-D: Single source of truth)
  const allRulesRaw = await db.regulatoryRule.findMany({
    where: {
      conceptSlug: { in: conceptSlugs },
      status: "PUBLISHED",
    },
    include: {
      sourcePointers: true,
    },
    orderBy: [{ authorityLevel: "asc" }, { confidence: "desc" }, { effectiveFrom: "desc" }],
  })

  // Collect all evidence IDs from sourcePointers
  const allEvidenceIds = new Set<string>()
  for (const rule of allRulesRaw) {
    for (const sp of rule.sourcePointers) {
      if (sp.evidenceId) {
        allEvidenceIds.add(sp.evidenceId)
      }
    }
  }

  // Fetch evidence with source from regulatory schema (cross-schema soft ref)
  const evidenceRecords = await dbReg.evidence.findMany({
    where: { id: { in: Array.from(allEvidenceIds) } },
    include: { source: true },
  })
  type EvidenceWithSource = (typeof evidenceRecords)[number]
  const evidenceMap = new Map<string, EvidenceWithSource>(evidenceRecords.map((e) => [e.id, e]))

  // Transform RegulatoryRules to RuleCandidates
  const allRules: RuleCandidate[] = allRulesRaw.map((rule) => {
    // Map sourcePointers to the expected format
    const sourcePointers = rule.sourcePointers.map((sp) => {
      const evidence = evidenceMap.get(sp.evidenceId)
      return {
        id: sp.id,
        evidenceId: sp.evidenceId,
        exactQuote: sp.exactQuote,
        contextBefore: sp.contextBefore,
        contextAfter: sp.contextAfter,
        articleNumber: sp.articleNumber,
        lawReference: sp.lawReference,
        evidence: evidence
          ? {
              id: evidence.id,
              url: evidence.url,
              fetchedAt: evidence.fetchedAt,
              source: evidence.source
                ? {
                    name: evidence.source.name,
                    url: evidence.source.url,
                  }
                : undefined,
            }
          : undefined,
      }
    })

    // Get primary evidence for reasoning pipeline
    const primaryEvidence = sourcePointers[0]?.evidence

    return {
      id: rule.id,
      conceptSlug: rule.conceptSlug,
      titleHr: rule.titleHr,
      authorityLevel: rule.authorityLevel,
      status: rule.status,
      effectiveFrom: rule.effectiveFrom,
      effectiveUntil: rule.effectiveUntil,
      confidence: rule.confidence,
      value: rule.value,
      valueType: rule.valueType.toLowerCase(),
      obligationType: rule.obligationType as ObligationType,
      explanationHr: rule.explanationHr ?? null,
      appliesWhen: rule.appliesWhen,
      riskTier: rule.riskTier ?? undefined,
      sourcePointers,
      // Additional fields for compatibility
      authority: rule.authorityLevel,
      bodyHr: rule.explanationHr ?? undefined,
      evidence: primaryEvidence,
      evidenceId: sourcePointers[0]?.evidenceId,
    }
  })

  const eligibleRules: RuleCandidate[] = []
  const ineligible: RuleSelectionResult["ineligible"] = []
  const missingContextRuleIds: string[] = []

  // Apply eligibility gate to each rule
  for (const rule of allRules) {
    const result = checkRuleEligibility(
      {
        id: rule.id,
        effectiveFrom: rule.effectiveFrom,
        effectiveUntil: rule.effectiveUntil,
        appliesWhen: rule.appliesWhen,
      },
      evalContext
    )

    if (result.eligible) {
      eligibleRules.push(rule)
    } else {
      // TypeScript knows result.reason exists when eligible is false
      const reason = result.reason
      ineligible.push({
        ruleId: rule.id,
        conceptSlug: rule.conceptSlug,
        reason,
      })

      if (reason === "MISSING_CONTEXT") {
        missingContextRuleIds.push(rule.id)
      }
    }
  }

  // Re-sort by authority rank, then by evidence quality (combined with rule confidence)
  eligibleRules.sort((a, b) => {
    const rankA = AUTHORITY_RANK[a.authorityLevel] ?? 99
    const rankB = AUTHORITY_RANK[b.authorityLevel] ?? 99

    // Primary sort: authority level (LAW > REGULATION > GUIDANCE > PRACTICE)
    if (rankA !== rankB) return rankA - rankB

    // Secondary sort: evidence quality combined with rule confidence
    // Calculate evidence quality scores for both rules
    const evidenceQualityA = calculateEvidenceQuality(a).overall
    const evidenceQualityB = calculateEvidenceQuality(b).overall

    // Combine rule confidence (30%) with evidence quality (70%)
    const combinedScoreA = a.confidence * 0.3 + evidenceQualityA * 0.7
    const combinedScoreB = b.confidence * 0.3 + evidenceQualityB * 0.7

    return combinedScoreB - combinedScoreA
  })

  return {
    rules: eligibleRules,
    ineligible,
    hasMissingContext: missingContextRuleIds.length > 0,
    missingContextRuleIds,
    asOfDate: asOfDate.toISOString(),
  }
}

/**
 * Legacy function signature for backward compatibility.
 * Uses current date and no context filtering.
 */
export async function selectRulesSimple(conceptSlugs: string[]): Promise<RuleCandidate[]> {
  const result = await selectRules(conceptSlugs)
  return result.rules
}
