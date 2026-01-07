// src/lib/assistant/query-engine/rule-selector.ts
// PHASE-C CUTOVER: Now reads exclusively from RuleFact (regulatory schema)
// RegulatoryRule fallback has been removed.

import { dbReg } from "@/lib/db/regulatory"
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

// Type for groundingQuotes JSON structure
interface GroundingQuote {
  text: string
  evidenceId: string
  contextBefore?: string | null
  contextAfter?: string | null
  sourcePointerId?: string
  articleNumber?: string | null
  lawReference?: string | null
}

// Type for legalReference JSON structure
interface LegalReference {
  raw?: string
  note?: string
  articleNumber?: string
  lawName?: string
}

// Type for conditions JSON structure
interface ConditionsJson {
  always?: boolean
  expression?: string
  [key: string]: unknown
}

/**
 * Map RuleFact objectType to ObligationType
 */
function mapObjectTypeToObligation(objectType: string): ObligationType {
  switch (objectType) {
    case "POREZNA_STOPA":
    case "POSTOTAK":
      return "OBLIGATION"
    case "ROK":
    case "OBVEZA":
      return "OBLIGATION"
    case "PRAG_PRIHODA":
    case "OSNOVICA":
    case "IZNOS":
      return "CONDITIONAL"
    default:
      return "INFORMATIONAL"
  }
}

/**
 * Map RuleFact valueType enum to lowercase string for answer formatting
 */
function mapValueType(valueType: string): string {
  const mapping: Record<string, string> = {
    PERCENTAGE: "percentage",
    CURRENCY_EUR: "currency_eur",
    CURRENCY_HRK: "currency_hrk",
    DEADLINE_DAY: "deadline_day",
    DEADLINE_DESCRIPTION: "deadline_description",
    BOOLEAN: "boolean",
    COUNT: "count",
  }
  return mapping[valueType] || valueType.toLowerCase()
}

/**
 * Extract appliesWhen string from conditions JSON
 */
function extractAppliesWhen(conditions: unknown): string | null {
  if (!conditions || typeof conditions !== "object") return null
  const cond = conditions as ConditionsJson
  if (cond.always === true) return null
  if (cond.expression) return cond.expression
  // Return JSON string for complex conditions
  return JSON.stringify(conditions)
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
 * PHASE-C: Now reads exclusively from RuleFact (no RegulatoryRule fallback)
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

  // Query RuleFact directly (PHASE-C: No more RegulatoryRule fallback)
  const allRuleFactsRaw = await dbReg.ruleFact.findMany({
    where: {
      conceptSlug: { in: conceptSlugs },
      status: "PUBLISHED",
    },
    orderBy: [{ authority: "asc" }, { confidence: "desc" }, { effectiveFrom: "desc" }],
  })

  // Collect all evidence IDs from groundingQuotes
  const allEvidenceIds = new Set<string>()
  for (const rf of allRuleFactsRaw) {
    const quotes = rf.groundingQuotes as GroundingQuote[] | null
    if (Array.isArray(quotes)) {
      for (const q of quotes) {
        if (q.evidenceId) {
          allEvidenceIds.add(q.evidenceId)
        }
      }
    }
  }

  // Fetch evidence with source from regulatory schema
  const evidenceRecords = await dbReg.evidence.findMany({
    where: { id: { in: Array.from(allEvidenceIds) } },
    include: { source: true },
  })
  type EvidenceWithSource = (typeof evidenceRecords)[number]
  const evidenceMap = new Map<string, EvidenceWithSource>(evidenceRecords.map((e) => [e.id, e]))

  // Transform RuleFacts to RuleCandidates
  const allRules: RuleCandidate[] = allRuleFactsRaw.map((rf) => {
    const quotes = (rf.groundingQuotes as GroundingQuote[] | null) || []
    const legalRef = rf.legalReference as LegalReference | null

    // Build sourcePointers from groundingQuotes
    const sourcePointers = quotes.map((q, idx) => {
      const evidence = evidenceMap.get(q.evidenceId)
      return {
        id: q.sourcePointerId || `${rf.id}-quote-${idx}`,
        evidenceId: q.evidenceId,
        exactQuote: q.text,
        contextBefore: q.contextBefore || null,
        contextAfter: q.contextAfter || null,
        articleNumber: q.articleNumber || legalRef?.articleNumber || null,
        lawReference: q.lawReference || legalRef?.raw || null,
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
      id: rf.id,
      conceptSlug: rf.conceptSlug,
      titleHr: rf.objectDescription || rf.conceptSlug,
      authorityLevel: rf.authority,
      status: rf.status,
      effectiveFrom: rf.effectiveFrom,
      effectiveUntil: rf.effectiveUntil,
      confidence: rf.confidence,
      value: rf.value,
      valueType: mapValueType(rf.valueType),
      obligationType: mapObjectTypeToObligation(rf.objectType),
      explanationHr: rf.subjectDescription || null,
      appliesWhen: extractAppliesWhen(rf.conditions),
      sourcePointers,
      // Additional fields for compatibility
      authority: rf.authority,
      bodyHr: rf.subjectDescription,
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
