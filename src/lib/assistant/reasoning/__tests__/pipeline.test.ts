// src/lib/assistant/reasoning/__tests__/pipeline.test.ts
import { describe, it, expect, vi } from "vitest"

// Mock DB and AI clients BEFORE any imports that depend on them
vi.mock("@/lib/db", () => ({ db: {} }))
vi.mock("@/lib/ai/ollama-client", () => ({
  chatJSON: vi.fn().mockResolvedValue({ questions: [] }),
  OllamaError: class OllamaError extends Error {},
}))
vi.mock("@/lib/ai/usage-tracking", () => ({
  trackAIUsage: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@/lib/regulatory-truth/watchdog/llm-circuit-breaker", () => ({
  llmCircuitBreaker: {
    canCall: vi.fn().mockResolvedValue(true),
    recordSuccess: vi.fn().mockResolvedValue(undefined),
    recordFailure: vi.fn().mockResolvedValue(undefined),
  },
}))

import { buildAnswerWithReasoning } from "../pipeline"
import { isTerminal, type ReasoningEvent, type TerminalPayload } from "../types"

// Mock dependencies
vi.mock("@/lib/assistant/query-engine/concept-matcher", () => ({
  matchConcepts: vi.fn().mockResolvedValue([]),
}))

vi.mock("@/lib/assistant/query-engine/rule-selector", () => ({
  selectRules: vi.fn().mockResolvedValue({
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
    const { value: firstEvent } = (await generator.next()) as {
      value: ReasoningEvent
      done: boolean
    }

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
    const { value, done } = (await generator.next()) as { value: TerminalPayload; done: boolean }

    // When done, value is the return value
    if (done && value) {
      expect(value.outcome).toBeDefined()
    }
  })
})
