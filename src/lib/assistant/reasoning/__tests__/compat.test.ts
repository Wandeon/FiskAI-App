// src/lib/assistant/reasoning/__tests__/compat.test.ts
import { describe, it, expect, vi } from "vitest"
import { buildAnswerCompat } from "../compat"
import type { AssistantResponse } from "@/lib/assistant/types"

// Mock pipeline
vi.mock("../pipeline", () => ({
  buildAnswerWithReasoning: vi.fn().mockImplementation(async function* () {
    yield {
      v: 1,
      id: "req_test_000",
      requestId: "req_test",
      seq: 0,
      ts: new Date().toISOString(),
      stage: "CONTEXT_RESOLUTION",
      status: "complete",
    }
    yield {
      v: 1,
      id: "req_test_001",
      requestId: "req_test",
      seq: 1,
      ts: new Date().toISOString(),
      stage: "ANSWER",
      status: "complete",
      data: {
        asOfDate: "2025-12-26",
        answerHr: "Test answer",
        citations: [
          {
            id: "c1",
            title: "Test Source",
            authority: "LAW",
            quote: "Test quote",
            url: "https://example.com",
            evidenceId: "e1",
            fetchedAt: "2025-12-26T10:00:00Z",
          },
        ],
      },
    }
    return {
      outcome: "ANSWER",
      asOfDate: "2025-12-26",
      answerHr: "Test answer",
      citations: [],
    }
  }),
}))

describe("buildAnswerCompat", () => {
  it("returns AssistantResponse format", async () => {
    const result = await buildAnswerCompat("test query", "MARKETING")

    expect(result).toHaveProperty("schemaVersion")
    expect(result).toHaveProperty("requestId")
    expect(result).toHaveProperty("kind")
    expect(result).toHaveProperty("headline")
  })

  it("maps ANSWER outcome to ANSWER kind", async () => {
    const result = await buildAnswerCompat("test query", "MARKETING")

    expect(result.kind).toBe("ANSWER")
  })

  it("includes directAnswer from answerHr", async () => {
    const result = await buildAnswerCompat("test query", "MARKETING")

    expect(result.directAnswer).toBe("Test answer")
  })
})
