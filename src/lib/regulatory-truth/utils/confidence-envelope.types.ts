// src/lib/regulatory-truth/utils/confidence-envelope.types.ts
//
// Pure types and functions for confidence envelope - no database dependencies

import { computeDerivedConfidence } from "./derived-confidence"

// =============================================================================
// TYPES & ENUMS
// =============================================================================

/**
 * Reasons that affect confidence scoring.
 * Each reason has a weight that modifies the final confidence.
 */
export enum ConfidenceReason {
  // Positive factors (boost confidence)
  HIGH_SOURCE_CONFIDENCE = "HIGH_SOURCE_CONFIDENCE", // Source pointers have high confidence
  MULTIPLE_SOURCES = "MULTIPLE_SOURCES", // Multiple independent sources agree
  AUTHORITATIVE_SOURCE = "AUTHORITATIVE_SOURCE", // From official government source
  RECENT_SOURCE = "RECENT_SOURCE", // Evidence is recent (within 1 year)

  // Negative factors (reduce confidence)
  LOW_SOURCE_CONFIDENCE = "LOW_SOURCE_CONFIDENCE", // Source pointers have low confidence
  SINGLE_SOURCE = "SINGLE_SOURCE", // Only one source (no corroboration)
  WEAK_EVIDENCE_LINK = "WEAK_EVIDENCE_LINK", // Evidence chain has weak links
  OLD_SOURCE = "OLD_SOURCE", // Evidence is old (>2 years)
  LOW_LLM_CONFIDENCE = "LOW_LLM_CONFIDENCE", // LLM expressed low confidence
  SOURCE_HEALTH_POOR = "SOURCE_HEALTH_POOR", // Source is in POOR health state
  SOURCE_HEALTH_CRITICAL = "SOURCE_HEALTH_CRITICAL", // Source is in CRITICAL health state
  CONFLICTING_SOURCES = "CONFLICTING_SOURCES", // Sources have conflicting information
}

/**
 * A single confidence reason with its contribution.
 */
export interface ConfidenceReasonEntry {
  reason: ConfidenceReason
  weight: number // -1 to 1, positive boosts confidence, negative reduces it
  detail?: string // Human-readable explanation
}

/**
 * Full confidence envelope for a rule.
 */
export interface ConfidenceEnvelope {
  confidenceScore: number // Final confidence (0-1)
  confidenceReasons: ConfidenceReasonEntry[]
  originatingCandidateFactIds: string[]
  originatingAgentRunIds: string[]
}

/**
 * Input for computing confidence envelope.
 */
export interface ConfidenceEnvelopeInput {
  sourcePointers: Array<{
    id: string
    confidence: number
    evidenceId: string
  }>
  llmConfidence: number
  candidateFactIds: string[]
  agentRunIds: string[]
  sourceHealthStates?: Record<string, { health: string; stateChangedAt?: Date }>
  evidenceCreatedDates?: Record<string, Date>
  authorityLevel?: string
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Confidence thresholds for categorization
const HIGH_CONFIDENCE_THRESHOLD = 0.85
const LOW_CONFIDENCE_THRESHOLD = 0.7
const OLD_EVIDENCE_DAYS = 730 // 2 years
const RECENT_EVIDENCE_DAYS = 365 // 1 year

// =============================================================================
// PURE FUNCTIONS
// =============================================================================

/**
 * Compute the confidence envelope for a rule.
 */
export function computeConfidenceEnvelope(input: ConfidenceEnvelopeInput): ConfidenceEnvelope {
  const reasons: ConfidenceReasonEntry[] = []

  // 1. Compute base confidence using existing logic
  const baseConfidence = computeDerivedConfidence(
    input.sourcePointers.map((sp) => ({ confidence: sp.confidence })),
    input.llmConfidence
  )

  // 2. Analyze source pointer confidence
  if (input.sourcePointers.length === 0) {
    reasons.push({
      reason: ConfidenceReason.WEAK_EVIDENCE_LINK,
      weight: -0.3,
      detail: "No source pointers available",
    })
  } else {
    const avgConfidence =
      input.sourcePointers.reduce((sum, sp) => sum + sp.confidence, 0) / input.sourcePointers.length
    const minConfidence = Math.min(...input.sourcePointers.map((sp) => sp.confidence))

    if (avgConfidence >= HIGH_CONFIDENCE_THRESHOLD) {
      reasons.push({
        reason: ConfidenceReason.HIGH_SOURCE_CONFIDENCE,
        weight: 0.1,
        detail: `Average source confidence: ${(avgConfidence * 100).toFixed(1)}%`,
      })
    } else if (avgConfidence < LOW_CONFIDENCE_THRESHOLD) {
      reasons.push({
        reason: ConfidenceReason.LOW_SOURCE_CONFIDENCE,
        weight: -0.1,
        detail: `Average source confidence: ${(avgConfidence * 100).toFixed(1)}%`,
      })
    }

    if (minConfidence < 0.5) {
      reasons.push({
        reason: ConfidenceReason.WEAK_EVIDENCE_LINK,
        weight: -0.15,
        detail: `Weakest source has only ${(minConfidence * 100).toFixed(1)}% confidence`,
      })
    }
  }

  // 3. Analyze number of sources
  if (input.sourcePointers.length >= 2) {
    reasons.push({
      reason: ConfidenceReason.MULTIPLE_SOURCES,
      weight: 0.05,
      detail: `Corroborated by ${input.sourcePointers.length} sources`,
    })
  } else if (input.sourcePointers.length === 1) {
    reasons.push({
      reason: ConfidenceReason.SINGLE_SOURCE,
      weight: -0.05,
      detail: "Based on single source (no corroboration)",
    })
  }

  // 4. Analyze LLM confidence
  if (input.llmConfidence < LOW_CONFIDENCE_THRESHOLD) {
    reasons.push({
      reason: ConfidenceReason.LOW_LLM_CONFIDENCE,
      weight: -0.1,
      detail: `LLM confidence: ${(input.llmConfidence * 100).toFixed(1)}%`,
    })
  }

  // 5. Analyze authority level
  if (input.authorityLevel === "LAW") {
    reasons.push({
      reason: ConfidenceReason.AUTHORITATIVE_SOURCE,
      weight: 0.05,
      detail: "Derived from official law",
    })
  }

  // 6. Analyze source health states
  if (input.sourceHealthStates) {
    for (const [sourceSlug, state] of Object.entries(input.sourceHealthStates)) {
      if (state.health === "CRITICAL") {
        reasons.push({
          reason: ConfidenceReason.SOURCE_HEALTH_CRITICAL,
          weight: -0.2,
          detail: `Source ${sourceSlug} is in CRITICAL health`,
        })
      } else if (state.health === "POOR") {
        reasons.push({
          reason: ConfidenceReason.SOURCE_HEALTH_POOR,
          weight: -0.1,
          detail: `Source ${sourceSlug} is in POOR health`,
        })
      }
    }
  }

  // 7. Analyze evidence age
  if (input.evidenceCreatedDates) {
    const now = Date.now()
    let hasOld = false
    let hasRecent = false

    for (const createdDate of Object.values(input.evidenceCreatedDates)) {
      const ageDays = (now - createdDate.getTime()) / (1000 * 60 * 60 * 24)
      if (ageDays > OLD_EVIDENCE_DAYS) {
        hasOld = true
      }
      if (ageDays < RECENT_EVIDENCE_DAYS) {
        hasRecent = true
      }
    }

    if (hasOld && !hasRecent) {
      reasons.push({
        reason: ConfidenceReason.OLD_SOURCE,
        weight: -0.05,
        detail: "Evidence is older than 2 years with no recent updates",
      })
    }

    if (hasRecent) {
      reasons.push({
        reason: ConfidenceReason.RECENT_SOURCE,
        weight: 0.02,
        detail: "Evidence includes recent sources (within 1 year)",
      })
    }
  }

  return {
    confidenceScore: baseConfidence,
    confidenceReasons: reasons,
    originatingCandidateFactIds: input.candidateFactIds,
    originatingAgentRunIds: input.agentRunIds,
  }
}

/**
 * Summarize confidence reasons for human display.
 */
export function summarizeConfidenceReasons(reasons: ConfidenceReasonEntry[]): string {
  const positives = reasons.filter((r) => r.weight > 0)
  const negatives = reasons.filter((r) => r.weight < 0)

  const parts: string[] = []

  if (positives.length > 0) {
    parts.push(`Strengths: ${positives.map((r) => r.detail || r.reason).join(", ")}`)
  }

  if (negatives.length > 0) {
    parts.push(`Concerns: ${negatives.map((r) => r.detail || r.reason).join(", ")}`)
  }

  return parts.join(" | ") || "No significant factors identified"
}

/**
 * Check if confidence reasons indicate the rule needs review.
 */
export function hasSignificantConcerns(reasons: ConfidenceReasonEntry[]): boolean {
  const negativeWeight = reasons.filter((r) => r.weight < 0).reduce((sum, r) => sum + r.weight, 0)
  return negativeWeight < -0.15
}
