// src/app/api/assistant/chat/reasoning/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "../route"
import { NextRequest } from "next/server"

// Mock the pipeline
vi.mock("@/lib/assistant/reasoning/pipeline", () => ({
  buildAnswerWithReasoning: vi.fn().mockImplementation(async function* () {
    yield {
      v: 1,
      id: "req_test_000",
      requestId: "req_test",
      seq: 0,
      ts: new Date().toISOString(),
      stage: "CONTEXT_RESOLUTION",
      status: "started",
      message: "Analysing question...",
    }
    yield {
      v: 1,
      id: "req_test_001",
      requestId: "req_test",
      seq: 1,
      ts: new Date().toISOString(),
      stage: "REFUSAL",
      status: "complete",
      data: {
        reason: "NO_CITABLE_RULES",
        message: "No sources found",
      },
    }
    return { outcome: "REFUSAL", reason: "NO_CITABLE_RULES", message: "No sources found" }
  }),
}))

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    reasoningTrace: {
      create: vi.fn().mockResolvedValue({ id: "trace_123" }),
    },
  },
}))

describe("POST /api/assistant/chat/reasoning", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 400 for missing query", async () => {
    const request = new NextRequest("http://localhost/api/assistant/chat/reasoning", {
      method: "POST",
      body: JSON.stringify({ surface: "APP" }),
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe("Validation failed")
    expect(body.details).toBeDefined()
  })

  it("returns 400 for invalid surface", async () => {
    const request = new NextRequest("http://localhost/api/assistant/chat/reasoning", {
      method: "POST",
      body: JSON.stringify({ query: "test", surface: "INVALID" }),
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it("returns SSE stream for valid request", async () => {
    const request = new NextRequest("http://localhost/api/assistant/chat/reasoning", {
      method: "POST",
      body: JSON.stringify({ query: "test query", surface: "APP" }),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("text/event-stream")
    expect(response.headers.get("Cache-Control")).toContain("no-cache")
  })

  it("includes X-Request-Id header", async () => {
    const request = new NextRequest("http://localhost/api/assistant/chat/reasoning", {
      method: "POST",
      body: JSON.stringify({ query: "test query", surface: "APP" }),
    })

    const response = await POST(request)

    expect(response.headers.get("X-Request-Id")).toMatch(/^req_/)
  })
})
