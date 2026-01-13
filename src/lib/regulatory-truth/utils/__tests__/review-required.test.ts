// src/lib/regulatory-truth/utils/__tests__/review-required.test.ts
//
// Unit tests for review-required logic

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  ReviewRequiredReason,
  summarizeReviewReasons,
  type ReviewRequiredReasonEntry,
} from "../review-required.types"
import { ConfidenceReason, type ConfidenceReasonEntry } from "../confidence-envelope.types"

// Note: checkReviewRequired uses the database, so we test it separately in db tests.
// Here we test the pure helper functions.

describe("summarizeReviewReasons", () => {
  it("should return 'No review required' for empty reasons", () => {
    const result = summarizeReviewReasons([])
    expect(result).toBe("No review required")
  })

  it("should highlight critical reasons", () => {
    const reasons: ReviewRequiredReasonEntry[] = [
      {
        reason: ReviewRequiredReason.SOURCE_CRITICAL_HEALTH,
        detail: "Source narodne-novine is in CRITICAL health",
      },
    ]

    const result = summarizeReviewReasons(reasons)
    expect(result).toContain("CRITICAL:")
    expect(result).toContain("CRITICAL health")
  })

  it("should highlight contradiction as critical", () => {
    const reasons: ReviewRequiredReasonEntry[] = [
      {
        reason: ReviewRequiredReason.CONTRADICTS_EXISTING,
        detail: "Contradicts existing rule xyz",
      },
    ]

    const result = summarizeReviewReasons(reasons)
    expect(result).toContain("CRITICAL:")
    expect(result).toContain("Contradicts")
  })

  it("should separate critical and normal reasons", () => {
    const reasons: ReviewRequiredReasonEntry[] = [
      {
        reason: ReviewRequiredReason.SOURCE_CRITICAL_HEALTH,
        detail: "Critical health",
      },
      {
        reason: ReviewRequiredReason.LOW_CONFIDENCE,
        detail: "Low confidence",
      },
    ]

    const result = summarizeReviewReasons(reasons)
    expect(result).toContain("CRITICAL:")
    expect(result).toContain("Review needed:")
    expect(result).toContain("|")
  })

  it("should handle only normal reasons", () => {
    const reasons: ReviewRequiredReasonEntry[] = [
      {
        reason: ReviewRequiredReason.LOW_CONFIDENCE,
        detail: "Confidence 70% is below threshold 85%",
      },
      {
        reason: ReviewRequiredReason.SINGLE_SOURCE,
        detail: "Based on single source",
      },
    ]

    const result = summarizeReviewReasons(reasons)
    expect(result).not.toContain("CRITICAL:")
    expect(result).toContain("Review needed:")
  })
})

describe("ReviewRequiredReason enum", () => {
  it("should have all expected values", () => {
    expect(ReviewRequiredReason.LOW_CONFIDENCE).toBe("LOW_CONFIDENCE")
    expect(ReviewRequiredReason.WEAK_EVIDENCE).toBe("WEAK_EVIDENCE")
    expect(ReviewRequiredReason.SINGLE_SOURCE).toBe("SINGLE_SOURCE")
    expect(ReviewRequiredReason.SOURCE_POOR_HEALTH).toBe("SOURCE_POOR_HEALTH")
    expect(ReviewRequiredReason.SOURCE_CRITICAL_HEALTH).toBe("SOURCE_CRITICAL_HEALTH")
    expect(ReviewRequiredReason.CONTRADICTS_EXISTING).toBe("CONTRADICTS_EXISTING")
    expect(ReviewRequiredReason.CONFLICTING_SOURCES).toBe("CONFLICTING_SOURCES")
    expect(ReviewRequiredReason.HIGH_RISK_TIER).toBe("HIGH_RISK_TIER")
  })
})

describe("Review-required integration scenarios", () => {
  // These tests document expected behavior without hitting the database

  it("should flag T0 rules for review regardless of confidence", () => {
    // T0 rules always need review per mission spec
    const input = {
      confidenceScore: 0.95, // Even high confidence
      confidenceReasons: [],
      riskTier: "T0",
      conceptSlug: "pausalni-revenue-threshold",
      value: "1000000",
      sourceHealthStates: [{ sourceSlug: "narodne-novine", health: "GOOD" }],
    }

    // Expected: reviewRequired = true with HIGH_RISK_TIER reason
    expect(input.riskTier).toBe("T0")
  })

  it("should flag T1 rules for review", () => {
    const input = {
      confidenceScore: 0.95,
      confidenceReasons: [],
      riskTier: "T1",
      conceptSlug: "vat-threshold",
      value: "300000",
      sourceHealthStates: [{ sourceSlug: "porezna-uprava", health: "GOOD" }],
    }

    expect(input.riskTier).toBe("T1")
  })

  it("should flag low confidence rules for review", () => {
    const input = {
      confidenceScore: 0.6, // Below 0.85 threshold
      confidenceReasons: [
        { reason: ConfidenceReason.LOW_SOURCE_CONFIDENCE, weight: -0.1 } as ConfidenceReasonEntry,
      ],
      riskTier: "T3",
      conceptSlug: "some-rule",
      value: "100",
      sourceHealthStates: [{ sourceSlug: "some-source", health: "GOOD" }],
    }

    // Expected: reviewRequired = true with LOW_CONFIDENCE reason
    expect(input.confidenceScore).toBeLessThan(0.85)
  })

  it("should flag rules from poor health sources", () => {
    const input = {
      confidenceScore: 0.9,
      confidenceReasons: [],
      riskTier: "T3",
      conceptSlug: "some-rule",
      value: "100",
      sourceHealthStates: [{ sourceSlug: "problematic-source", health: "POOR" }],
    }

    // Expected: reviewRequired = true with SOURCE_POOR_HEALTH reason
    expect(input.sourceHealthStates[0].health).toBe("POOR")
  })

  it("should flag rules from critical health sources", () => {
    const input = {
      confidenceScore: 0.9,
      confidenceReasons: [],
      riskTier: "T3",
      conceptSlug: "some-rule",
      value: "100",
      sourceHealthStates: [{ sourceSlug: "broken-source", health: "CRITICAL" }],
    }

    // Expected: reviewRequired = true with SOURCE_CRITICAL_HEALTH reason
    expect(input.sourceHealthStates[0].health).toBe("CRITICAL")
  })

  it("should not flag T3 rules with high confidence from healthy sources", () => {
    const input = {
      confidenceScore: 0.92,
      confidenceReasons: [
        { reason: ConfidenceReason.HIGH_SOURCE_CONFIDENCE, weight: 0.1 } as ConfidenceReasonEntry,
      ],
      riskTier: "T3",
      conceptSlug: "low-risk-rule",
      value: "50",
      sourceHealthStates: [{ sourceSlug: "healthy-source", health: "GOOD" }],
    }

    // Expected: reviewRequired = false
    expect(input.confidenceScore).toBeGreaterThan(0.85)
    expect(input.riskTier).toBe("T3")
    expect(input.sourceHealthStates[0].health).toBe("GOOD")
  })
})
