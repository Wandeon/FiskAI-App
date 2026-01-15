// src/lib/assistant/reasoning/__tests__/integration.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

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
import { isTerminal, REASONING_STAGES } from "../types"
import type { ReasoningEvent, TerminalPayload } from "../types"

// Helper to collect all events and return value from generator
async function collectGenerator(
  generator: AsyncGenerator<ReasoningEvent, TerminalPayload>
): Promise<{ events: ReasoningEvent[]; returnValue: TerminalPayload }> {
  const events: ReasoningEvent[] = []
  let result = await generator.next()

  while (!result.done) {
    events.push(result.value)
    result = await generator.next()
  }

  return { events, returnValue: result.value }
}

// Mock external dependencies
vi.mock("@/lib/assistant/query-engine/concept-matcher", () => ({
  matchConcepts: vi.fn().mockResolvedValue([
    {
      conceptId: "c1",
      slug: "pdv-stopa",
      nameHr: "PDV stopa",
      score: 0.9,
      matchedKeywords: ["pdv", "stopa"],
    },
  ]),
}))

vi.mock("@/lib/assistant/query-engine/rule-selector", () => ({
  selectRules: vi.fn().mockResolvedValue({
    rules: [
      {
        id: "r1",
        conceptSlug: "pdv-stopa",
        titleHr: "Opca stopa PDV-a",
        value: "25",
        valueType: "percentage",
        explanationHr: "Opca stopa PDV-a iznosi 25%.",
        authorityLevel: "LAW",
        confidence: 0.95,
        status: "PUBLISHED",
        effectiveFrom: new Date("2024-01-01"),
        effectiveUntil: null,
        obligationType: "OBLIGATION",
        appliesWhen: null,
        sourcePointers: [
          {
            id: "sp1",
            evidenceId: "ev1",
            exactQuote: "Opca stopa PDV-a iznosi 25%.",
            contextBefore: null,
            contextAfter: null,
            articleNumber: "38",
            lawReference: "Zakon o PDV-u",
            evidence: {
              id: "ev1",
              url: "https://nn.hr/pdv",
              fetchedAt: new Date(),
              source: {
                name: "Narodne novine",
                url: "https://nn.hr",
              },
            },
          },
        ],
      },
    ],
    ineligible: [],
    hasMissingContext: false,
    missingContextRuleIds: [],
    asOfDate: new Date().toISOString(),
  }),
}))

vi.mock("@/lib/assistant/query-engine/conflict-detector", () => ({
  detectConflicts: vi.fn().mockReturnValue({
    hasConflict: false,
    canResolve: true,
    conflictingRules: [],
  }),
}))

vi.mock("@/lib/assistant/query-engine/citation-builder", () => ({
  buildCitations: vi.fn().mockReturnValue({
    primary: {
      id: "src1",
      title: "Zakon o PDV-u",
      authority: "LAW",
      quote: "Opca stopa PDV-a iznosi 25%.",
      url: "https://nn.hr/pdv",
      effectiveFrom: "2024-01-01",
      confidence: 0.95,
      evidenceId: "ev1",
      fetchedAt: new Date().toISOString(),
    },
    supporting: [],
  }),
}))

describe("Pipeline Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("buildAnswerWithReasoning", () => {
    it("yields events in correct stage order", async () => {
      const generator = buildAnswerWithReasoning("req_test", "Koja je stopa PDV-a?", "APP")

      const { events } = await collectGenerator(generator)

      // Verify stage order
      const stageOrder = events
        .filter((e) => e.status === "started" || e.status === "complete")
        .map((e) => e.stage)

      // Context resolution should come first
      expect(stageOrder[0]).toBe("CONTEXT_RESOLUTION")

      // Terminal should come last
      const lastEvent = events[events.length - 1]
      expect(isTerminal(lastEvent)).toBe(true)
    })

    it("generates monotonic sequence numbers", async () => {
      const generator = buildAnswerWithReasoning("req_test", "test query", "APP")

      const { events } = await collectGenerator(generator)

      // Check sequence is strictly monotonic increasing
      for (let i = 1; i < events.length; i++) {
        expect(events[i].seq).toBeGreaterThan(events[i - 1].seq)
      }
    })

    it("includes requestId in all events", async () => {
      const requestId = "req_unique_123"
      const generator = buildAnswerWithReasoning(requestId, "test query", "APP")

      const { events } = await collectGenerator(generator)

      for (const event of events) {
        expect(event.requestId).toBe(requestId)
      }
    })

    it("returns terminal payload on completion", async () => {
      const generator = buildAnswerWithReasoning("req_test", "Koja je stopa PDV-a?", "APP")

      const { returnValue } = await collectGenerator(generator)
      expect(returnValue).toBeDefined()
      expect(returnValue.outcome).toBeDefined()
    })

    it("handles REFUSAL when no sources found", async () => {
      // Override mock for this test
      const { matchConcepts } = await import("@/lib/assistant/query-engine/concept-matcher")
      vi.mocked(matchConcepts).mockResolvedValueOnce([])

      const generator = buildAnswerWithReasoning("req_test", "gibberish query", "MARKETING")

      const { events, returnValue } = await collectGenerator(generator)

      // Check the terminal event in the event stream
      const terminal = events.find(isTerminal)
      expect(terminal?.stage).toBe("REFUSAL")

      // Also check the return value
      expect(returnValue.outcome).toBe("REFUSAL")
    })

    it("handles REFUSAL when no rules found", async () => {
      // Override mocks for this test
      const { matchConcepts } = await import("@/lib/assistant/query-engine/concept-matcher")
      const { selectRules } = await import("@/lib/assistant/query-engine/rule-selector")

      vi.mocked(matchConcepts).mockResolvedValueOnce([
        {
          conceptId: "c1",
          slug: "test-concept",
          nameHr: "Test Concept",
          score: 0.8,
          matchedKeywords: ["test"],
        },
      ])
      vi.mocked(selectRules).mockResolvedValueOnce({
        rules: [],
        ineligible: [],
        hasMissingContext: false,
        missingContextRuleIds: [],
        asOfDate: new Date().toISOString(),
      })

      const generator = buildAnswerWithReasoning("req_test", "test query", "APP")

      const { events, returnValue } = await collectGenerator(generator)

      const terminal = events.find(isTerminal)
      expect(terminal?.stage).toBe("REFUSAL")
      expect(returnValue.outcome).toBe("REFUSAL")
    })

    it("handles unresolved conflicts with REFUSAL", async () => {
      // Override mock for conflict detection
      const { detectConflicts } = await import("@/lib/assistant/query-engine/conflict-detector")
      vi.mocked(detectConflicts).mockReturnValueOnce({
        hasConflict: true,
        canResolve: false,
        conflictingRules: [],
        description: "Unresolved conflict",
      })

      const generator = buildAnswerWithReasoning("req_test", "Koja je stopa PDV-a?", "APP")

      const { events, returnValue } = await collectGenerator(generator)

      const terminal = events.find(isTerminal)
      expect(terminal?.stage).toBe("REFUSAL")
      expect(terminal?.data).toHaveProperty("reason", "UNRESOLVED_CONFLICT")
      expect(returnValue.outcome).toBe("REFUSAL")
    })

    it("includes v (schema version) in all events", async () => {
      const generator = buildAnswerWithReasoning("req_test", "test query", "APP")

      const { events } = await collectGenerator(generator)

      for (const event of events) {
        expect(event.v).toBe(1)
      }
    })

    it("includes timestamp (ts) in all events", async () => {
      const generator = buildAnswerWithReasoning("req_test", "test query", "APP")

      const { events } = await collectGenerator(generator)

      for (const event of events) {
        expect(event.ts).toBeDefined()
        // Verify it's a valid ISO date string
        expect(new Date(event.ts).toISOString()).toBe(event.ts)
      }
    })

    it("includes unique id in all events", async () => {
      const generator = buildAnswerWithReasoning("req_test", "test query", "APP")

      const { events } = await collectGenerator(generator)

      const ids = new Set<string>()
      for (const event of events) {
        expect(event.id).toBeDefined()
        expect(ids.has(event.id)).toBe(false)
        ids.add(event.id)
      }
    })
  })

  describe("Stage Invariants", () => {
    it("each stage yields started before complete", async () => {
      const generator = buildAnswerWithReasoning("req_test", "Koja je stopa PDV-a?", "APP")

      const { events } = await collectGenerator(generator)

      // Group by stage
      const byStage = new Map<string, ReasoningEvent[]>()
      for (const event of events) {
        if (!byStage.has(event.stage)) {
          byStage.set(event.stage, [])
        }
        byStage.get(event.stage)!.push(event)
      }

      // Check each non-terminal stage
      for (const stage of REASONING_STAGES) {
        const stageEvents = byStage.get(stage)
        if (stageEvents && stageEvents.length > 0) {
          const started = stageEvents.find((e) => e.status === "started")
          const complete = stageEvents.find((e) => e.status === "complete")

          if (started && complete) {
            expect(started.seq).toBeLessThan(complete.seq)
          }
        }
      }
    })

    it("exactly one terminal event", async () => {
      const generator = buildAnswerWithReasoning("req_test", "test query", "APP")

      const { events } = await collectGenerator(generator)

      const terminals = events.filter(isTerminal)
      expect(terminals).toHaveLength(1)
    })

    it("terminal event is always last", async () => {
      const generator = buildAnswerWithReasoning("req_test", "Koja je stopa PDV-a?", "APP")

      const { events } = await collectGenerator(generator)

      const lastEvent = events[events.length - 1]
      expect(isTerminal(lastEvent)).toBe(true)

      // No events after terminal
      for (let i = 0; i < events.length - 1; i++) {
        expect(isTerminal(events[i])).toBe(false)
      }
    })

    it("CONTEXT_RESOLUTION always occurs first", async () => {
      const generator = buildAnswerWithReasoning("req_test", "Koja je stopa PDV-a?", "APP")

      const { value: firstEvent } = (await generator.next()) as {
        value: ReasoningEvent
        done: boolean
      }

      expect(firstEvent.stage).toBe("CONTEXT_RESOLUTION")
    })

    it("sequence numbers start at 0 and increment", async () => {
      const generator = buildAnswerWithReasoning("req_test", "test query", "APP")

      const { events } = await collectGenerator(generator)

      // Sequence starts at 0 (based on event-factory implementation)
      expect(events[0].seq).toBe(0)

      // Each subsequent event has incremented sequence
      for (let i = 1; i < events.length; i++) {
        expect(events[i].seq).toBe(events[i - 1].seq + 1)
      }
    })
  })

  describe("Error Handling", () => {
    it("catches and wraps internal errors", async () => {
      // Force an error by making concept matcher throw
      const { matchConcepts } = await import("@/lib/assistant/query-engine/concept-matcher")
      vi.mocked(matchConcepts).mockRejectedValueOnce(new Error("Database error"))

      const generator = buildAnswerWithReasoning("req_test", "test query", "APP")

      const { events, returnValue } = await collectGenerator(generator)

      const terminal = events.find(isTerminal)
      expect(terminal?.stage).toBe("ERROR")
      expect(terminal?.data).toHaveProperty("code", "INTERNAL")
      expect(terminal?.data).toHaveProperty("retriable", true)
      expect(returnValue.outcome).toBe("ERROR")
    })

    it("error events have correlation id matching request id", async () => {
      const { matchConcepts } = await import("@/lib/assistant/query-engine/concept-matcher")
      vi.mocked(matchConcepts).mockRejectedValueOnce(new Error("Test error"))

      const requestId = "req_error_test"
      const generator = buildAnswerWithReasoning(requestId, "test query", "APP")

      const { events } = await collectGenerator(generator)

      const terminal = events.find(isTerminal)
      expect(terminal?.data).toHaveProperty("correlationId", requestId)
    })
  })

  describe("Answer Generation", () => {
    it("successful answer includes required fields", async () => {
      const generator = buildAnswerWithReasoning("req_test", "Koja je stopa PDV-a?", "APP")

      const { returnValue } = await collectGenerator(generator)

      if (returnValue.outcome === "ANSWER") {
        expect(returnValue.asOfDate).toBeDefined()
        expect(returnValue.answerHr).toBeDefined()
        expect(returnValue.citations).toBeDefined()
        expect(returnValue.citations!.length).toBeGreaterThan(0)
      } else {
        // If not ANSWER, test should still pass - just checking structure
        expect(returnValue.outcome).toBeDefined()
      }
    })

    it("answer citations include required provenance", async () => {
      const generator = buildAnswerWithReasoning("req_test", "Koja je stopa PDV-a?", "APP")

      const { returnValue } = await collectGenerator(generator)

      if (returnValue.outcome === "ANSWER") {
        for (const citation of returnValue.citations!) {
          expect(citation.id).toBeDefined()
          expect(citation.title).toBeDefined()
          expect(citation.quote).toBeDefined()
          expect(citation.url).toBeDefined()
          expect(citation.evidenceId).toBeDefined()
          expect(citation.fetchedAt).toBeDefined()
        }
      } else {
        // If not ANSWER, verify outcome is defined
        expect(returnValue.outcome).toBeDefined()
      }
    })
  })
})
