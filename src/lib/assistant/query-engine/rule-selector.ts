// src/lib/assistant/query-engine/rule-selector.ts
import { prisma } from "@/lib/prisma"
import {
  checkRuleEligibility,
  buildEvaluationContext,
  type EvaluationContext,
  type EligibilityResult,
} from "./rule-eligibility"
import type { ObligationType } from "../types"
import { calculateEvidenceQuality } from "./evidence-quality"

const AUTHORITY_RANK: Record<string, number> = {
  LAW: 1,
  REGULATION: 2,
  GUIDANCE: 3,
  PRACTICE: 4,
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
    evidence: {
      id: string
      url: string
      fetchedAt: Date | null
      source: {
        name: string
        url: string
      }
    }
  }[]
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

  // Fetch all PUBLISHED rules for these concepts
  // Note: We fetch all and filter in-memory to properly handle appliesWhen
  // and to track ineligible rules for debugging
  const allRules = await prisma.regulatoryRule.findMany({
    where: {
      conceptSlug: { in: conceptSlugs },
      status: "PUBLISHED",
    },
    include: {
      sourcePointers: {
        include: {
          evidence: {
            include: {
              source: true,
            },
          },
        },
      },
    },
    orderBy: [{ authorityLevel: "asc" }, { confidence: "desc" }, { effectiveFrom: "desc" }],
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
      eligibleRules.push(rule as RuleCandidate)
    } else {
      ineligible.push({
        ruleId: rule.id,
        conceptSlug: rule.conceptSlug,
        reason: result.reason,
      })

      if (result.reason === "MISSING_CONTEXT") {
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
    const evidenceQualityA = calculateEvidenceQuality(a as RuleCandidate).overall
    const evidenceQualityB = calculateEvidenceQuality(b as RuleCandidate).overall

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
