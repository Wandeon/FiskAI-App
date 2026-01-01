import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "../route"
import { NextRequest } from "next/server"
import * as answerBuilder from "@/lib/assistant/query-engine/answer-builder"

vi.mock("@/lib/assistant/query-engine/answer-builder")

function createRequest(body: object): NextRequest {
  return new NextRequest("http://localhost:3000/api/assistant/chat", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

// Valid response with all required citation fields
const validRegulatoryAnswer = {
  schemaVersion: "1.0.0",
  requestId: "req_1",
  traceId: "trace_1",
  kind: "ANSWER",
  topic: "REGULATORY",
  surface: "MARKETING",
  createdAt: new Date().toISOString(),
  headline: "PDV stopa",
  directAnswer: "Opća stopa PDV-a iznosi 25%.",
  citations: {
    primary: {
      id: "src_1",
      title: "Zakon o PDV-u",
      authority: "LAW",
      url: "https://nn.hr/123",
      quote: "Članak 38. stopa PDV-a iznosi 25%.",
      effectiveFrom: "2024-01-01",
      confidence: 0.98,
      evidenceId: "ev_123",
      fetchedAt: "2024-01-15T10:00:00Z",
    },
    supporting: [],
  },
}

describe("POST /api/assistant/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 400 for missing query", async () => {
    const request = createRequest({ surface: "MARKETING" })
    const response = await POST(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe("Validation failed")
    expect(data.details).toBeDefined()
  })

  it("returns 400 for invalid surface", async () => {
    const request = createRequest({ query: "test", surface: "INVALID" })
    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it("calls buildAnswer with correct parameters", async () => {
    vi.mocked(answerBuilder.buildAnswer).mockResolvedValue(validRegulatoryAnswer as any)

    const request = createRequest({ query: "test query", surface: "MARKETING" })
    await POST(request)

    expect(answerBuilder.buildAnswer).toHaveBeenCalledWith("test query", "MARKETING", undefined)
  })

  it("returns valid AssistantResponse with citations", async () => {
    vi.mocked(answerBuilder.buildAnswer).mockResolvedValue(validRegulatoryAnswer as any)

    const request = createRequest({ query: "test", surface: "MARKETING" })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.kind).toBe("ANSWER")
    expect(data.headline).toBe("PDV stopa")
    expect(data.citations.primary.quote).toBe("Članak 38. stopa PDV-a iznosi 25%.")
  })

  describe("FAIL-CLOSED behavior", () => {
    it("returns REFUSAL (not 500) when validation fails", async () => {
      // Response missing citations - should fail validation
      const invalidResponse = {
        schemaVersion: "1.0.0",
        requestId: "req_1",
        traceId: "trace_1",
        kind: "ANSWER",
        topic: "REGULATORY",
        surface: "MARKETING",
        createdAt: new Date().toISOString(),
        headline: "Test",
        directAnswer: "Test answer",
        // Missing citations - validation will fail
      }

      vi.mocked(answerBuilder.buildAnswer).mockResolvedValue(invalidResponse as any)

      const request = createRequest({ query: "test", surface: "MARKETING" })
      const response = await POST(request)
      const data = await response.json()

      // Should return 200 with REFUSAL, not 500 error
      expect(response.status).toBe(200)
      expect(data.kind).toBe("REFUSAL")
      expect(data.refusalReason).toBe("NO_CITABLE_RULES")
    })

    it("returns REFUSAL (not 500) on internal error", async () => {
      vi.mocked(answerBuilder.buildAnswer).mockRejectedValue(new Error("DB error"))

      const request = createRequest({ query: "test", surface: "MARKETING" })
      const response = await POST(request)
      const data = await response.json()

      // Should return 200 with REFUSAL, not 500 error
      expect(response.status).toBe(200)
      expect(data.kind).toBe("REFUSAL")
      expect(data.refusalReason).toBe("NO_CITABLE_RULES")
    })

    it("returns REFUSAL when citations lack required fields", async () => {
      // Response with incomplete citations
      const incompleteResponse = {
        ...validRegulatoryAnswer,
        citations: {
          primary: {
            id: "src_1",
            title: "Law",
            authority: "LAW",
            url: "https://nn.hr/123",
            // Missing: quote, evidenceId, fetchedAt
            effectiveFrom: "2024-01-01",
            confidence: 0.98,
          },
          supporting: [],
        },
      }

      vi.mocked(answerBuilder.buildAnswer).mockResolvedValue(incompleteResponse as any)

      const request = createRequest({ query: "test", surface: "MARKETING" })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.kind).toBe("REFUSAL")
      expect(data.refusalReason).toBe("NO_CITABLE_RULES")
    })
  })
})
