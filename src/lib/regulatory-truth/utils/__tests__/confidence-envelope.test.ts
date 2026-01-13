// src/lib/regulatory-truth/utils/__tests__/confidence-envelope.test.ts
//
// Unit tests for confidence envelope computation

import { describe, it, expect } from "vitest"
import {
  computeConfidenceEnvelope,
  ConfidenceReason,
  summarizeConfidenceReasons,
  hasSignificantConcerns,
  type ConfidenceEnvelopeInput,
} from "../confidence-envelope.types"

describe("computeConfidenceEnvelope", () => {
  const baseInput: ConfidenceEnvelopeInput = {
    sourcePointers: [
      { id: "sp1", confidence: 0.9, evidenceId: "e1" },
      { id: "sp2", confidence: 0.85, evidenceId: "e2" },
    ],
    llmConfidence: 0.88,
    candidateFactIds: ["cf1", "cf2"],
    agentRunIds: ["ar1"],
  }

  it("should compute confidence envelope with multiple high-confidence sources", () => {
    const result = computeConfidenceEnvelope(baseInput)

    expect(result.confidenceScore).toBeGreaterThan(0.8)
    expect(result.originatingCandidateFactIds).toEqual(["cf1", "cf2"])
    expect(result.originatingAgentRunIds).toEqual(["ar1"])
    expect(result.confidenceReasons.length).toBeGreaterThan(0)
  })

  it("should add HIGH_SOURCE_CONFIDENCE reason for high confidence pointers", () => {
    const input: ConfidenceEnvelopeInput = {
      ...baseInput,
      sourcePointers: [
        { id: "sp1", confidence: 0.95, evidenceId: "e1" },
        { id: "sp2", confidence: 0.92, evidenceId: "e2" },
      ],
    }

    const result = computeConfidenceEnvelope(input)
    const hasHighConfidence = result.confidenceReasons.some(
      (r) => r.reason === ConfidenceReason.HIGH_SOURCE_CONFIDENCE
    )
    expect(hasHighConfidence).toBe(true)
  })

  it("should add LOW_SOURCE_CONFIDENCE reason for low confidence pointers", () => {
    const input: ConfidenceEnvelopeInput = {
      ...baseInput,
      sourcePointers: [
        { id: "sp1", confidence: 0.6, evidenceId: "e1" },
        { id: "sp2", confidence: 0.55, evidenceId: "e2" },
      ],
      llmConfidence: 0.7,
    }

    const result = computeConfidenceEnvelope(input)
    const hasLowConfidence = result.confidenceReasons.some(
      (r) => r.reason === ConfidenceReason.LOW_SOURCE_CONFIDENCE
    )
    expect(hasLowConfidence).toBe(true)
  })

  it("should add MULTIPLE_SOURCES reason when corroborated", () => {
    const result = computeConfidenceEnvelope(baseInput)
    const hasMultipleSources = result.confidenceReasons.some(
      (r) => r.reason === ConfidenceReason.MULTIPLE_SOURCES
    )
    expect(hasMultipleSources).toBe(true)
  })

  it("should add SINGLE_SOURCE reason when only one pointer", () => {
    const input: ConfidenceEnvelopeInput = {
      ...baseInput,
      sourcePointers: [{ id: "sp1", confidence: 0.9, evidenceId: "e1" }],
    }

    const result = computeConfidenceEnvelope(input)
    const hasSingleSource = result.confidenceReasons.some(
      (r) => r.reason === ConfidenceReason.SINGLE_SOURCE
    )
    expect(hasSingleSource).toBe(true)
  })

  it("should add WEAK_EVIDENCE_LINK for very low confidence pointer", () => {
    const input: ConfidenceEnvelopeInput = {
      ...baseInput,
      sourcePointers: [
        { id: "sp1", confidence: 0.9, evidenceId: "e1" },
        { id: "sp2", confidence: 0.4, evidenceId: "e2" },
      ],
    }

    const result = computeConfidenceEnvelope(input)
    const hasWeakEvidence = result.confidenceReasons.some(
      (r) => r.reason === ConfidenceReason.WEAK_EVIDENCE_LINK
    )
    expect(hasWeakEvidence).toBe(true)
  })

  it("should add LOW_LLM_CONFIDENCE for low LLM confidence", () => {
    const input: ConfidenceEnvelopeInput = {
      ...baseInput,
      llmConfidence: 0.6,
    }

    const result = computeConfidenceEnvelope(input)
    const hasLowLlm = result.confidenceReasons.some(
      (r) => r.reason === ConfidenceReason.LOW_LLM_CONFIDENCE
    )
    expect(hasLowLlm).toBe(true)
  })

  it("should add SOURCE_HEALTH_POOR for poor health sources", () => {
    const input: ConfidenceEnvelopeInput = {
      ...baseInput,
      sourceHealthStates: {
        "narodne-novine": { health: "POOR" },
      },
    }

    const result = computeConfidenceEnvelope(input)
    const hasPoorHealth = result.confidenceReasons.some(
      (r) => r.reason === ConfidenceReason.SOURCE_HEALTH_POOR
    )
    expect(hasPoorHealth).toBe(true)
  })

  it("should add SOURCE_HEALTH_CRITICAL for critical health sources", () => {
    const input: ConfidenceEnvelopeInput = {
      ...baseInput,
      sourceHealthStates: {
        "narodne-novine": { health: "CRITICAL" },
      },
    }

    const result = computeConfidenceEnvelope(input)
    const hasCriticalHealth = result.confidenceReasons.some(
      (r) => r.reason === ConfidenceReason.SOURCE_HEALTH_CRITICAL
    )
    expect(hasCriticalHealth).toBe(true)
  })

  it("should add AUTHORITATIVE_SOURCE for LAW authority level", () => {
    const input: ConfidenceEnvelopeInput = {
      ...baseInput,
      authorityLevel: "LAW",
    }

    const result = computeConfidenceEnvelope(input)
    const hasAuthoritative = result.confidenceReasons.some(
      (r) => r.reason === ConfidenceReason.AUTHORITATIVE_SOURCE
    )
    expect(hasAuthoritative).toBe(true)
  })

  it("should return zero confidence for no source pointers", () => {
    const input: ConfidenceEnvelopeInput = {
      ...baseInput,
      sourcePointers: [],
    }

    const result = computeConfidenceEnvelope(input)
    expect(result.confidenceScore).toBe(0)
    expect(
      result.confidenceReasons.some((r) => r.reason === ConfidenceReason.WEAK_EVIDENCE_LINK)
    ).toBe(true)
  })

  it("should add OLD_SOURCE for old evidence", () => {
    const twoYearsAgo = new Date()
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 3)

    const input: ConfidenceEnvelopeInput = {
      ...baseInput,
      evidenceCreatedDates: {
        e1: twoYearsAgo,
        e2: twoYearsAgo,
      },
    }

    const result = computeConfidenceEnvelope(input)
    const hasOldSource = result.confidenceReasons.some(
      (r) => r.reason === ConfidenceReason.OLD_SOURCE
    )
    expect(hasOldSource).toBe(true)
  })

  it("should add RECENT_SOURCE for recent evidence", () => {
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const input: ConfidenceEnvelopeInput = {
      ...baseInput,
      evidenceCreatedDates: {
        e1: sixMonthsAgo,
        e2: sixMonthsAgo,
      },
    }

    const result = computeConfidenceEnvelope(input)
    const hasRecentSource = result.confidenceReasons.some(
      (r) => r.reason === ConfidenceReason.RECENT_SOURCE
    )
    expect(hasRecentSource).toBe(true)
  })
})

describe("summarizeConfidenceReasons", () => {
  it("should summarize positive and negative reasons", () => {
    const reasons = [
      { reason: ConfidenceReason.HIGH_SOURCE_CONFIDENCE, weight: 0.1, detail: "High confidence" },
      { reason: ConfidenceReason.LOW_LLM_CONFIDENCE, weight: -0.1, detail: "Low LLM" },
    ]

    const summary = summarizeConfidenceReasons(reasons)

    expect(summary).toContain("Strengths:")
    expect(summary).toContain("High confidence")
    expect(summary).toContain("Concerns:")
    expect(summary).toContain("Low LLM")
  })

  it("should return default message for no reasons", () => {
    const summary = summarizeConfidenceReasons([])
    expect(summary).toBe("No significant factors identified")
  })

  it("should handle only positive reasons", () => {
    const reasons = [
      { reason: ConfidenceReason.HIGH_SOURCE_CONFIDENCE, weight: 0.1, detail: "High confidence" },
    ]

    const summary = summarizeConfidenceReasons(reasons)
    expect(summary).toContain("Strengths:")
    expect(summary).not.toContain("Concerns:")
  })

  it("should handle only negative reasons", () => {
    const reasons = [
      { reason: ConfidenceReason.LOW_LLM_CONFIDENCE, weight: -0.1, detail: "Low LLM" },
    ]

    const summary = summarizeConfidenceReasons(reasons)
    expect(summary).toContain("Concerns:")
    expect(summary).not.toContain("Strengths:")
  })
})

describe("hasSignificantConcerns", () => {
  it("should return true for significant negative weight", () => {
    const reasons = [
      { reason: ConfidenceReason.LOW_SOURCE_CONFIDENCE, weight: -0.1, detail: "Low" },
      { reason: ConfidenceReason.WEAK_EVIDENCE_LINK, weight: -0.15, detail: "Weak" },
    ]

    expect(hasSignificantConcerns(reasons)).toBe(true)
  })

  it("should return false for minor negative weight", () => {
    const reasons = [{ reason: ConfidenceReason.SINGLE_SOURCE, weight: -0.05, detail: "Single" }]

    expect(hasSignificantConcerns(reasons)).toBe(false)
  })

  it("should return false for no negative reasons", () => {
    const reasons = [
      { reason: ConfidenceReason.HIGH_SOURCE_CONFIDENCE, weight: 0.1, detail: "High" },
    ]

    expect(hasSignificantConcerns(reasons)).toBe(false)
  })

  it("should return false for empty reasons", () => {
    expect(hasSignificantConcerns([])).toBe(false)
  })
})
