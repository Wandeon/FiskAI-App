// src/lib/regulatory-truth/utils/review-required.ts
//
// Mission #3: Human Review Readiness
//
// Determines when a rule requires human review before publication.
// Sets REVIEW_REQUIRED flag when:
// - Confidence < threshold (default 0.85)
// - Source health is POOR or CRITICAL
// - Rule contradicts existing rule

import { db } from "@/lib/db"
import { ConfidenceReason } from "./confidence-envelope.types"
import type { ConfidenceReasonEntry } from "./confidence-envelope.types"

// Re-export pure types and helper functions
export {
  ReviewRequiredReason,
  type ReviewRequiredReasonEntry,
  type ReviewRequiredResult,
  type ReviewRequiredInput,
  summarizeReviewReasons,
} from "./review-required.types"

import {
  ReviewRequiredReason,
  type ReviewRequiredReasonEntry,
  type ReviewRequiredResult,
} from "./review-required.types"

// Extended input type that uses the full ConfidenceReasonEntry
interface ReviewRequiredInputInternal {
  confidenceScore: number
  confidenceReasons: ConfidenceReasonEntry[]
  riskTier: string
  conceptSlug: string
  value: string
  sourceHealthStates: Array<{ sourceSlug: string; health: string }>
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Default confidence threshold for requiring review
const DEFAULT_CONFIDENCE_THRESHOLD = parseFloat(
  process.env.RTL_REVIEW_CONFIDENCE_THRESHOLD || "0.85"
)

// Risk tiers that always require review
const ALWAYS_REVIEW_TIERS = ["T0", "T1"]

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

/**
 * Check if a rule requires human review.
 *
 * Returns true with reasons when:
 * 1. Confidence < threshold (default 0.85)
 * 2. Any source is in POOR or CRITICAL health
 * 3. Rule contradicts existing published rule
 * 4. Risk tier is T0 or T1
 */
export async function checkReviewRequired(
  input: ReviewRequiredInputInternal
): Promise<ReviewRequiredResult> {
  const reasons: ReviewRequiredReasonEntry[] = []

  // 1. Check confidence threshold
  if (input.confidenceScore < DEFAULT_CONFIDENCE_THRESHOLD) {
    reasons.push({
      reason: ReviewRequiredReason.LOW_CONFIDENCE,
      detail: `Confidence ${(input.confidenceScore * 100).toFixed(1)}% is below threshold ${(DEFAULT_CONFIDENCE_THRESHOLD * 100).toFixed(0)}%`,
    })
  }

  // 2. Check for weak evidence in confidence reasons
  const hasWeakEvidence = input.confidenceReasons.some(
    (r) =>
      r.reason === ConfidenceReason.WEAK_EVIDENCE_LINK ||
      r.reason === ConfidenceReason.LOW_SOURCE_CONFIDENCE
  )
  if (hasWeakEvidence) {
    reasons.push({
      reason: ReviewRequiredReason.WEAK_EVIDENCE,
      detail: "Evidence chain has weak links or low confidence sources",
    })
  }

  // 3. Check for single source
  const isSingleSource = input.confidenceReasons.some(
    (r) => r.reason === ConfidenceReason.SINGLE_SOURCE
  )
  if (isSingleSource) {
    reasons.push({
      reason: ReviewRequiredReason.SINGLE_SOURCE,
      detail: "Rule based on single source - needs corroboration verification",
    })
  }

  // 4. Check source health states
  for (const state of input.sourceHealthStates) {
    if (state.health === "CRITICAL") {
      reasons.push({
        reason: ReviewRequiredReason.SOURCE_CRITICAL_HEALTH,
        detail: `Source ${state.sourceSlug} is in CRITICAL health`,
      })
    } else if (state.health === "POOR") {
      reasons.push({
        reason: ReviewRequiredReason.SOURCE_POOR_HEALTH,
        detail: `Source ${state.sourceSlug} is in POOR health`,
      })
    }
  }

  // 5. Check for conflicting sources
  const hasConflicts = input.confidenceReasons.some(
    (r) => r.reason === ConfidenceReason.CONFLICTING_SOURCES
  )
  if (hasConflicts) {
    reasons.push({
      reason: ReviewRequiredReason.CONFLICTING_SOURCES,
      detail: "Sources provide conflicting information",
    })
  }

  // 6. Check for contradiction with existing rules
  const existingConflict = await checkContradictsExisting(input.conceptSlug, input.value)
  if (existingConflict) {
    reasons.push({
      reason: ReviewRequiredReason.CONTRADICTS_EXISTING,
      detail: existingConflict.detail,
    })
  }

  // 7. Check risk tier
  if (ALWAYS_REVIEW_TIERS.includes(input.riskTier)) {
    reasons.push({
      reason: ReviewRequiredReason.HIGH_RISK_TIER,
      detail: `${input.riskTier} rules always require human review`,
    })
  }

  return {
    reviewRequired: reasons.length > 0,
    reasons,
  }
}

/**
 * Check if a rule contradicts an existing published rule.
 */
async function checkContradictsExisting(
  conceptSlug: string,
  value: string
): Promise<{ detail: string } | null> {
  // Find existing published rules with same concept
  const existingRules = await db.regulatoryRule.findMany({
    where: {
      conceptSlug,
      status: "PUBLISHED",
    },
    select: {
      id: true,
      value: true,
      effectiveFrom: true,
      effectiveUntil: true,
    },
    take: 5,
  })

  for (const existing of existingRules) {
    // If values differ and the existing rule is still effective, flag as contradiction
    if (existing.value !== value) {
      const now = new Date()
      const isEffective =
        existing.effectiveFrom <= now && (!existing.effectiveUntil || existing.effectiveUntil > now)

      if (isEffective) {
        return {
          detail: `Contradicts existing rule ${existing.id} (value: ${existing.value} vs proposed: ${value})`,
        }
      }
    }
  }

  return null
}

/**
 * Update a rule with review-required flag and reasons.
 */
export async function setReviewRequired(
  ruleId: string,
  result: ReviewRequiredResult
): Promise<void> {
  await db.regulatoryRule.update({
    where: { id: ruleId },
    data: {
      reviewRequired: result.reviewRequired,
      reviewRequiredReasons: result.reasons,
    },
  })

  if (result.reviewRequired) {
    console.log(
      `[review-required] Rule ${ruleId} flagged for review: ${result.reasons.map((r) => r.reason).join(", ")}`
    )
  }
}

/**
 * Get rules that require review.
 */
export async function getRulesRequiringReview(options?: { limit?: number; conceptSlug?: string }) {
  return db.regulatoryRule.findMany({
    where: {
      reviewRequired: true,
      status: { in: ["DRAFT", "PENDING_REVIEW"] },
      ...(options?.conceptSlug && { conceptSlug: options.conceptSlug }),
    },
    orderBy: [{ riskTier: "asc" }, { createdAt: "asc" }],
    take: options?.limit ?? 100,
    select: {
      id: true,
      conceptSlug: true,
      titleHr: true,
      riskTier: true,
      derivedConfidence: true,
      reviewRequired: true,
      reviewRequiredReasons: true,
      createdAt: true,
    },
  })
}

// Note: summarizeReviewReasons is re-exported from review-required.types.ts
