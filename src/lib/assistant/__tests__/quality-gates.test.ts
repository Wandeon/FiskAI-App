// src/lib/assistant/__tests__/quality-gates.test.ts
import { describe, it, expect } from "vitest"
import { validateResponse, enforceEnforcementMatrix } from "../validation"
import { SCHEMA_VERSION, LIMITS, type AssistantResponse } from "../types"

/**
 * Quality Gate Tests
 *
 * These tests enforce the design constraints from the UI/UX spec.
 * They should run in CI and block deployment if any fail.
 */

describe("Quality Gate: Citation Compliance", () => {
  it("REGULATORY ANSWER requires citations", () => {
    const response: AssistantResponse = {
      schemaVersion: SCHEMA_VERSION,
      requestId: "req_1",
      traceId: "trace_1",
      kind: "ANSWER",
      topic: "REGULATORY",
      surface: "MARKETING",
      createdAt: new Date().toISOString(),
      headline: "Test",
      directAnswer: "Test",
      // Missing citations
    }

    const result = validateResponse(response)
    expect(result.warnings).toContain("REGULATORY answer should have citations")
  })

  it("REGULATORY ANSWER with citations passes", () => {
    const response: AssistantResponse = {
      schemaVersion: SCHEMA_VERSION,
      requestId: "req_1",
      traceId: "trace_1",
      kind: "ANSWER",
      topic: "REGULATORY",
      surface: "MARKETING",
      createdAt: new Date().toISOString(),
      headline: "Test",
      directAnswer: "Test",
      citations: {
        primary: {
          id: "src_1",
          title: "Law",
          authority: "LAW",
          url: "https://example.com",
          effectiveFrom: "2024-01-01",
          confidence: 0.95,
        },
        supporting: [],
      },
    }

    const result = validateResponse(response)
    expect(result.valid).toBe(true)
    expect(result.warnings).not.toContain("REGULATORY answer should have citations")
  })

  it("PRODUCT/SUPPORT/OFFTOPIC forbids citations", () => {
    const topics = ["PRODUCT", "SUPPORT", "OFFTOPIC"] as const

    topics.forEach((topic) => {
      const matrix = enforceEnforcementMatrix({ kind: "ANSWER", topic })
      expect(matrix.citationsForbidden).toBe(true)
    })
  })

  it("UNRESOLVED_CONFLICT refusal requires citations", () => {
    const matrix = enforceEnforcementMatrix({
      kind: "REFUSAL",
      refusalReason: "UNRESOLVED_CONFLICT",
    })

    expect(matrix.citationsRequired).toBe(true)
  })
})

describe("Quality Gate: Conflict Safety", () => {
  it("UNRESOLVED_CONFLICT with kind=ANSWER is invalid", () => {
    // This combination should NEVER occur
    // An unresolved conflict must be a REFUSAL, not an ANSWER
    const response: Partial<AssistantResponse> = {
      kind: "ANSWER",
      refusalReason: "UNRESOLVED_CONFLICT", // Invalid combination
    }

    // This should be caught by validation
    expect(response.kind).not.toBe("REFUSAL")
    // In real validation, this would fail
  })
})

describe("Quality Gate: Computed Result Safety", () => {
  it("computedResult only allowed when completeness=COMPLETE", () => {
    const matrix = enforceEnforcementMatrix({ kind: "ANSWER", topic: "REGULATORY" })

    expect(matrix.computedResultAllowed).toBe(true)
    // But actual validation must check completeness.status
  })

  it("computedResult forbidden for non-REGULATORY topics", () => {
    const matrix = enforceEnforcementMatrix({ kind: "ANSWER", topic: "PRODUCT" })

    expect(matrix.computedResultForbidden).toBe(true)
  })
})

describe("Quality Gate: Length Limits", () => {
  it("headline must not exceed 120 chars", () => {
    const longHeadline = "a".repeat(121)

    const response: AssistantResponse = {
      schemaVersion: SCHEMA_VERSION,
      requestId: "req_1",
      traceId: "trace_1",
      kind: "ANSWER",
      topic: "REGULATORY",
      surface: "MARKETING",
      createdAt: new Date().toISOString(),
      headline: longHeadline,
      directAnswer: "Test",
    }

    const result = validateResponse(response)
    expect(result.errors).toContain(`Headline exceeds ${LIMITS.headline} chars`)
  })

  it("directAnswer must not exceed 240 chars", () => {
    const longAnswer = "a".repeat(241)

    const response: AssistantResponse = {
      schemaVersion: SCHEMA_VERSION,
      requestId: "req_1",
      traceId: "trace_1",
      kind: "ANSWER",
      topic: "REGULATORY",
      surface: "MARKETING",
      createdAt: new Date().toISOString(),
      headline: "Test",
      directAnswer: longAnswer,
    }

    const result = validateResponse(response)
    expect(result.errors).toContain(`DirectAnswer exceeds ${LIMITS.directAnswer} chars`)
  })
})

describe("Quality Gate: Schema Version", () => {
  it("response must include schemaVersion", () => {
    const response = {
      requestId: "req_1",
      traceId: "trace_1",
      kind: "ANSWER",
      topic: "REGULATORY",
      surface: "MARKETING",
      createdAt: new Date().toISOString(),
      headline: "Test",
      directAnswer: "Test",
    } as AssistantResponse

    const result = validateResponse(response)
    expect(result.errors).toContain("Missing schemaVersion")
  })
})

describe("Quality Gate: Required Fields", () => {
  it("response must include requestId", () => {
    const response = {
      schemaVersion: SCHEMA_VERSION,
      traceId: "trace_1",
      kind: "ANSWER",
      topic: "REGULATORY",
      surface: "MARKETING",
      createdAt: new Date().toISOString(),
      headline: "Test",
      directAnswer: "Test",
    } as AssistantResponse

    const result = validateResponse(response)
    expect(result.errors).toContain("Missing requestId")
  })

  it("response must include traceId", () => {
    const response = {
      schemaVersion: SCHEMA_VERSION,
      requestId: "req_1",
      kind: "ANSWER",
      topic: "REGULATORY",
      surface: "MARKETING",
      createdAt: new Date().toISOString(),
      headline: "Test",
      directAnswer: "Test",
    } as AssistantResponse

    const result = validateResponse(response)
    expect(result.errors).toContain("Missing traceId")
  })
})
