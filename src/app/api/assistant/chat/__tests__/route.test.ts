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

describe("POST /api/assistant/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 400 for missing query", async () => {
    const request = createRequest({ surface: "MARKETING" })
    const response = await POST(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe("Query is required")
  })

  it("returns 400 for invalid surface", async () => {
    const request = createRequest({ query: "test", surface: "INVALID" })
    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it("calls buildAnswer with correct parameters", async () => {
    vi.mocked(answerBuilder.buildAnswer).mockResolvedValue({
      schemaVersion: "1.0.0",
      requestId: "req_1",
      traceId: "trace_1",
      kind: "ANSWER",
      topic: "REGULATORY",
      surface: "MARKETING",
      createdAt: new Date().toISOString(),
      headline: "Test",
      directAnswer: "Test answer",
    } as any)

    const request = createRequest({ query: "test query", surface: "MARKETING" })
    await POST(request)

    expect(answerBuilder.buildAnswer).toHaveBeenCalledWith("test query", "MARKETING", undefined)
  })

  it("returns valid AssistantResponse", async () => {
    const mockResponse = {
      schemaVersion: "1.0.0",
      requestId: "req_1",
      traceId: "trace_1",
      kind: "ANSWER",
      topic: "REGULATORY",
      surface: "MARKETING",
      createdAt: new Date().toISOString(),
      headline: "Test Headline",
      directAnswer: "Test answer",
    }

    vi.mocked(answerBuilder.buildAnswer).mockResolvedValue(mockResponse as any)

    const request = createRequest({ query: "test", surface: "MARKETING" })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.kind).toBe("ANSWER")
    expect(data.headline).toBe("Test Headline")
  })

  it("returns 500 on internal error", async () => {
    vi.mocked(answerBuilder.buildAnswer).mockRejectedValue(new Error("DB error"))

    const request = createRequest({ query: "test", surface: "MARKETING" })
    const response = await POST(request)

    expect(response.status).toBe(500)
  })
})
