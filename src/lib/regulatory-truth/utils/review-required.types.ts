// src/lib/regulatory-truth/utils/review-required.types.ts
//
// Pure types and helper functions for review-required logic - no database dependencies

// =============================================================================
// TYPES & ENUMS
// =============================================================================

/**
 * Reasons why a rule requires human review.
 */
export enum ReviewRequiredReason {
  // Confidence-related
  LOW_CONFIDENCE = "LOW_CONFIDENCE", // Overall confidence below threshold
  WEAK_EVIDENCE = "WEAK_EVIDENCE", // Evidence chain has weak links
  SINGLE_SOURCE = "SINGLE_SOURCE", // Only one source, needs corroboration check

  // Source health-related
  SOURCE_POOR_HEALTH = "SOURCE_POOR_HEALTH", // Source is in POOR health
  SOURCE_CRITICAL_HEALTH = "SOURCE_CRITICAL_HEALTH", // Source is in CRITICAL health

  // Conflict-related
  CONTRADICTS_EXISTING = "CONTRADICTS_EXISTING", // Rule contradicts an existing published rule
  CONFLICTING_SOURCES = "CONFLICTING_SOURCES", // Sources provide conflicting information

  // Risk tier-related
  HIGH_RISK_TIER = "HIGH_RISK_TIER", // T0 or T1 rules always need review
}

/**
 * A single review-required reason with detail.
 */
export interface ReviewRequiredReasonEntry {
  reason: ReviewRequiredReason
  detail: string
}

/**
 * Result of review-required check.
 */
export interface ReviewRequiredResult {
  reviewRequired: boolean
  reasons: ReviewRequiredReasonEntry[]
}

/**
 * Input for checking if review is required.
 */
export interface ReviewRequiredInput {
  confidenceScore: number
  confidenceReasons: Array<{ reason: string; weight: number }>
  riskTier: string // T0, T1, T2, T3
  conceptSlug: string
  value: string
  sourceHealthStates: Array<{ sourceSlug: string; health: string }>
}

// =============================================================================
// PURE HELPER FUNCTIONS
// =============================================================================

/**
 * Summarize review reasons for human display.
 */
export function summarizeReviewReasons(reasons: ReviewRequiredReasonEntry[]): string {
  if (reasons.length === 0) return "No review required"

  const critical = reasons.filter(
    (r) =>
      r.reason === ReviewRequiredReason.SOURCE_CRITICAL_HEALTH ||
      r.reason === ReviewRequiredReason.CONTRADICTS_EXISTING
  )

  const normal = reasons.filter(
    (r) =>
      r.reason !== ReviewRequiredReason.SOURCE_CRITICAL_HEALTH &&
      r.reason !== ReviewRequiredReason.CONTRADICTS_EXISTING
  )

  const parts: string[] = []

  if (critical.length > 0) {
    parts.push(`CRITICAL: ${critical.map((r) => r.detail).join("; ")}`)
  }

  if (normal.length > 0) {
    parts.push(`Review needed: ${normal.map((r) => r.detail).join("; ")}`)
  }

  return parts.join(" | ")
}
