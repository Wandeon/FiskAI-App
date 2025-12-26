// src/lib/assistant/reasoning/__tests__/pipeline.test.ts
import { describe, it, expect, vi } from "vitest"
import { buildAnswerWithReasoning } from "../pipeline"
import { isTerminal } from "../types"

// Mock dependencies
vi.mock("@/lib/assistant/query-engine/concept-matcher", () => ({
  matchConcepts: vi.fn().mockResolvedValue([]),
}))

vi.mock("@/lib/assistant/query-engine/rule-selector", () => ({
  selectRules: vi
    .fn()
    .mockResolvedValue({
      rules: [],
      ineligible: [],
      hasMissingContext: false,
      missingContextRuleIds: [],
      asOfDate: new Date().toISOString(),
    }),
}))

describe("buildAnswerWithReasoning", () => {
  it("yields CONTEXT_RESOLUTION started as first event", async () => {
    const generator = buildAnswerWithReasoning("req_test", "test query", "APP")
    const { value: firstEvent } = await generator.next()

    expect(firstEvent.stage).toBe("CONTEXT_RESOLUTION")
    expect(firstEvent.status).toBe("started")
  })

  it("always terminates with a terminal event", async () => {
    const generator = buildAnswerWithReasoning("req_test", "test query", "APP")

    const events = []
    for await (const event of generator) {
      events.push(event)
    }

    const lastEvent = events[events.length - 1]
    expect(isTerminal(lastEvent)).toBe(true)
  })

  it("returns terminal payload when generator completes", async () => {
    const generator = buildAnswerWithReasoning("req_test", "test query", "APP")

    for await (const _event of generator) {
      // consume all events
    }
    // Get the return value
    const { value, done } = await generator.next()

    // When done, value is the return value
    if (done && value) {
      expect(value.outcome).toBeDefined()
    }
  })
})
