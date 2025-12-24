import { describe, it, expect } from "vitest"
import { validateResponse, truncateField, enforceEnforcementMatrix } from "../validation"
import { SCHEMA_VERSION, LIMITS, type AssistantResponse } from "../types"

describe("validateResponse", () => {
  const validResponseWithCitations: AssistantResponse = {
    schemaVersion: SCHEMA_VERSION,
    requestId: "req_1",
    traceId: "trace_1",
    kind: "ANSWER",
    topic: "REGULATORY",
    surface: "MARKETING",
    createdAt: new Date().toISOString(),
    headline: "Test headline",
    directAnswer: "Test answer",
    citations: {
      primary: {
        id: "src_1",
        title: "Test Law",
        authority: "LAW",
        url: "https://example.com/law",
        quote: "Test quote from the law.",
        effectiveFrom: "2024-01-01",
        confidence: 0.95,
        evidenceId: "ev_123",
        fetchedAt: "2024-01-01T00:00:00Z",
      },
      supporting: [],
    },
  }

  const responseWithoutCitations: AssistantResponse = {
    schemaVersion: SCHEMA_VERSION,
    requestId: "req_1",
    traceId: "trace_1",
    kind: "ANSWER",
    topic: "REGULATORY",
    surface: "MARKETING",
    createdAt: new Date().toISOString(),
    headline: "Test headline",
    directAnswer: "Test answer",
  }

  it("passes for valid response with complete citations", () => {
    const result = validateResponse(validResponseWithCitations)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it("FAILS when REGULATORY answer lacks citations (fail-closed)", () => {
    const result = validateResponse(responseWithoutCitations)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain("REGULATORY ANSWER requires citations (fail-closed)")
  })
})

describe("truncateField", () => {
  it("truncates long strings with ellipsis", () => {
    const long = "a".repeat(150)
    const result = truncateField(long, LIMITS.headline)
    expect(result.length).toBe(120)
    expect(result.endsWith("...")).toBe(true)
  })

  it("does not truncate short strings", () => {
    const short = "Hello"
    const result = truncateField(short, LIMITS.headline)
    expect(result).toBe("Hello")
  })
})

describe("enforceEnforcementMatrix", () => {
  it("requires citations for REGULATORY ANSWER", () => {
    const response: Partial<AssistantResponse> = {
      kind: "ANSWER",
      topic: "REGULATORY",
    }
    const result = enforceEnforcementMatrix(response)
    expect(result.citationsRequired).toBe(true)
    expect(result.computedResultAllowed).toBe(true)
  })

  it("forbids citations for OUT_OF_SCOPE refusal", () => {
    const response: Partial<AssistantResponse> = {
      kind: "REFUSAL",
      refusalReason: "OUT_OF_SCOPE",
    }
    const result = enforceEnforcementMatrix(response)
    expect(result.citationsRequired).toBe(false)
    expect(result.citationsForbidden).toBe(true)
  })
})
