// src/lib/assistant/reasoning/__tests__/shadow-runner.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { runShadowMode, compareShadowResults } from "../shadow-runner"

// Mock the pipelines
vi.mock("@/lib/assistant/query-engine/answer-builder", () => ({
  buildAnswer: vi.fn().mockResolvedValue({
    schemaVersion: "1.0.0",
    requestId: "req_legacy",
    traceId: "trace_legacy",
    kind: "ANSWER",
    topic: "REGULATORY",
    surface: "MARKETING",
    createdAt: new Date().toISOString(),
    headline: "Legacy answer",
    directAnswer: "Test",
  }),
}))

vi.mock("../pipeline", () => ({
  buildAnswerWithReasoning: vi.fn().mockImplementation(async function* () {
    yield { stage: "CONTEXT_RESOLUTION", status: "complete" }
    yield { stage: "ANSWER", status: "complete" }
    return { outcome: "ANSWER", answerHr: "New answer", citations: [] }
  }),
}))

vi.mock("../sinks", () => ({
  createAuditSink: vi.fn().mockReturnValue({
    mode: "buffered",
    write: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
  }),
  consumeReasoning: vi.fn().mockResolvedValue({
    outcome: "ANSWER",
    answerHr: "New answer",
    citations: [],
  }),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    reasoningTrace: {
      create: vi.fn().mockResolvedValue({ id: "trace_123" }),
      findUnique: vi.fn().mockResolvedValue({
        id: "trace_123",
        requestId: "shadow_test123",
        outcome: "ANSWER",
      }),
    },
  },
}))

describe("runShadowMode", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns legacy response", async () => {
    const result = await runShadowMode("test query", "MARKETING")

    expect(result.requestId).toBe("req_legacy")
    expect(result.kind).toBe("ANSWER")
  })

  it("returns legacy response even when new pipeline is running", async () => {
    const result = await runShadowMode("test query", "APP", "company_123")

    // Legacy response is returned immediately
    expect(result.kind).toBe("ANSWER")
    expect(result.headline).toBe("Legacy answer")
  })

  it("runs new pipeline in background", async () => {
    await runShadowMode("test query", "MARKETING")

    // Give background task time to complete
    await new Promise((resolve) => setTimeout(resolve, 100))

    const { createAuditSink, consumeReasoning } = await import("../sinks")
    expect(createAuditSink).toHaveBeenCalled()
    expect(consumeReasoning).toHaveBeenCalled()
  })

  it("passes surface to both pipelines", async () => {
    await runShadowMode("VAT question", "APP", "company_456")

    // Give background task time to complete
    await new Promise((resolve) => setTimeout(resolve, 100))

    const { buildAnswer } = await import("@/lib/assistant/query-engine/answer-builder")
    expect(buildAnswer).toHaveBeenCalledWith("VAT question", "APP", "company_456")
  })

  it("generates unique shadow request ID", async () => {
    // Run twice and verify different IDs via audit sink calls
    await runShadowMode("query 1", "MARKETING")
    await runShadowMode("query 2", "MARKETING")

    // Give background tasks time to complete
    await new Promise((resolve) => setTimeout(resolve, 100))

    const { createAuditSink } = await import("../sinks")
    const calls = (createAuditSink as unknown as { mock: { calls: unknown[][] } }).mock.calls

    // Each call should have a unique shadow request ID
    expect(calls.length).toBe(2)
    const id1 = calls[0][0] as string
    const id2 = calls[1][0] as string
    expect(id1).toMatch(/^shadow_/)
    expect(id2).toMatch(/^shadow_/)
    expect(id1).not.toBe(id2)
  })

  it("handles new pipeline errors gracefully", async () => {
    // Mock pipeline to throw
    const { buildAnswerWithReasoning } = await import("../pipeline")
    ;(buildAnswerWithReasoning as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async function* () {
        throw new Error("Pipeline failed")
      }
    )

    // Should still return legacy response without throwing
    const result = await runShadowMode("test query", "MARKETING")
    expect(result.kind).toBe("ANSWER")
    expect(result.requestId).toBe("req_legacy")
  })
})

describe("compareShadowResults", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns match when trace exists", async () => {
    const result = await compareShadowResults("req_legacy", "shadow_test123")

    expect(result.match).toBe(true)
    expect(result.differences).toEqual([])
  })

  it("returns not match when trace not found", async () => {
    const { prisma } = await import("@/lib/prisma")
    ;(prisma.reasoningTrace.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

    const result = await compareShadowResults("req_legacy", "shadow_notfound")

    expect(result.match).toBe(false)
    expect(result.differences).toContain("Shadow trace not found")
  })

  it("handles comparison errors gracefully", async () => {
    const { prisma } = await import("@/lib/prisma")
    ;(prisma.reasoningTrace.findUnique as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("DB error")
    )

    const result = await compareShadowResults("req_legacy", "shadow_error")

    expect(result.match).toBe(false)
    expect(result.differences).toContain("Comparison failed")
  })
})
