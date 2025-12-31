// src/lib/assistant/reasoning/sinks/__tests__/consumer.test.ts
import { describe, it, expect, vi } from "vitest"
import { consumeReasoning } from "../consumer"
import type { ReasoningSink } from "../types"
import type { ReasoningEvent, TerminalPayload } from "../../types"
import { REASONING_EVENT_VERSION } from "../../types"

describe("consumeReasoning", () => {
  it("writes all events to all sinks", async () => {
    const events: ReasoningEvent[] = [
      {
        v: REASONING_EVENT_VERSION,
        id: "req_test_000",
        requestId: "req_test",
        seq: 0,
        ts: new Date().toISOString(),
        stage: "SOURCES",
        status: "started",
      },
      {
        v: REASONING_EVENT_VERSION,
        id: "req_test_001",
        requestId: "req_test",
        seq: 1,
        ts: new Date().toISOString(),
        stage: "ANSWER",
        status: "complete",
      },
    ]

    async function* mockGenerator(): AsyncGenerator<ReasoningEvent, TerminalPayload> {
      for (const event of events) {
        yield event
      }
      return {
        outcome: "ANSWER",
        asOfDate: "2025-12-26",
        answerHr: "Test",
        citations: [],
      } as TerminalPayload
    }

    const mockSink: ReasoningSink = {
      mode: "nonBlocking",
      write: vi.fn(),
      flush: vi.fn().mockResolvedValue(undefined),
    }

    const result = await consumeReasoning(mockGenerator(), [mockSink])

    expect(mockSink.write).toHaveBeenCalledTimes(2)
    expect(mockSink.flush).toHaveBeenCalledTimes(1)
    expect(result.outcome).toBe("ANSWER")
  })

  it("awaits critical sinks for critical events", async () => {
    const events: ReasoningEvent[] = [
      {
        v: REASONING_EVENT_VERSION,
        id: "req_test_000",
        requestId: "req_test",
        seq: 0,
        ts: new Date().toISOString(),
        stage: "ERROR",
        status: "complete",
        severity: "critical",
      },
    ]

    async function* mockGenerator(): AsyncGenerator<ReasoningEvent, TerminalPayload> {
      for (const event of events) {
        yield event
      }
      return {
        outcome: "ERROR",
        code: "INTERNAL",
        message: "Test",
        correlationId: "req_test",
        retriable: true,
      } as unknown as TerminalPayload
    }

    const writePromise = new Promise<void>((resolve) => setTimeout(resolve, 10))
    const criticalSink: ReasoningSink = {
      mode: "criticalAwait",
      write: vi.fn().mockReturnValue(writePromise),
      flush: vi.fn().mockResolvedValue(undefined),
    }

    await consumeReasoning(mockGenerator(), [criticalSink])

    expect(criticalSink.write).toHaveBeenCalled()
  })
})
