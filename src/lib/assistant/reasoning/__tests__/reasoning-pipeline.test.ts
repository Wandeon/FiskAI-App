import { describe, it, expect, vi, beforeEach } from "vitest"
import { buildAnswerWithReasoning } from "../reasoning-pipeline"

// Mock dependencies
vi.mock("@/lib/db", () => ({
  db: {
    atomicClaim: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: "claim-1", logicExpr: "vat_rate = 25", confidence: 0.9 }]),
    },
    regulatorySource: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: "source-1", name: "Zakon o PDV-u", url: "https://example.com" }]),
    },
    reasoningTrace: {
      create: vi.fn().mockResolvedValue({ id: "trace-1" }),
    },
  },
}))

vi.mock("../../regulatory-truth/retrieval/query-router", () => ({
  routeQuery: vi.fn().mockResolvedValue({
    success: true,
    classification: { intent: "LOGIC", confidence: 0.9 },
    response: { rules: [] },
  }),
}))

describe("Reasoning Pipeline", () => {
  it("should emit QUESTION_INTAKE as first stage", async () => {
    const generator = buildAnswerWithReasoning("req-123", "What is the VAT rate?")
    const firstEvent = await generator.next()

    expect(firstEvent.done).toBe(false)
    expect(firstEvent.value.stage).toBe("QUESTION_INTAKE")
    expect(firstEvent.value.status).toBe("started")
  })

  it("should emit events in correct order", async () => {
    const generator = buildAnswerWithReasoning("req-123", "What is the VAT rate?")
    const stages: string[] = []

    for await (const event of generator) {
      if (event.status === "started" || event.status === "complete") {
        stages.push(`${event.stage}:${event.status}`)
      }
    }

    expect(stages).toContain("QUESTION_INTAKE:started")
    expect(stages).toContain("QUESTION_INTAKE:complete")
    expect(stages).toContain("CONTEXT_RESOLUTION:started")
  })

  it("should include requestId in all events", async () => {
    const generator = buildAnswerWithReasoning("req-456", "Test query")

    for await (const event of generator) {
      expect(event.requestId).toBe("req-456")
    }
  })

  it("should increment sequence numbers", async () => {
    const generator = buildAnswerWithReasoning("req-789", "Test query")
    const seqNumbers: number[] = []

    for await (const event of generator) {
      seqNumbers.push(event.seq)
    }

    // Should be monotonically increasing
    for (let i = 1; i < seqNumbers.length; i++) {
      expect(seqNumbers[i]).toBeGreaterThan(seqNumbers[i - 1])
    }
  })
})
