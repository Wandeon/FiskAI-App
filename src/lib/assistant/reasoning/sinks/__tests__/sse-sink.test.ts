// src/lib/assistant/reasoning/sinks/__tests__/sse-sink.test.ts
import { describe, it, expect, vi } from "vitest"
import { createSSESink } from "../sse-sink"
import type { ReasoningEvent } from "../../types"
import { SCHEMA_VERSION } from "../../types"

describe("SSESink", () => {
  it("has nonBlocking mode", () => {
    const mockController = {
      enqueue: vi.fn(),
      close: vi.fn(),
    }
    const sink = createSSESink(mockController as unknown as ReadableStreamDefaultController)

    expect(sink.mode).toBe("nonBlocking")
  })

  it("formats events as SSE with event type", () => {
    const mockController = {
      enqueue: vi.fn(),
      close: vi.fn(),
    }
    const sink = createSSESink(mockController as unknown as ReadableStreamDefaultController)

    const event: ReasoningEvent = {
      v: SCHEMA_VERSION,
      id: "req_test_001",
      requestId: "req_test",
      seq: 1,
      ts: "2025-12-26T10:00:00Z",
      stage: "SOURCES",
      status: "started",
      message: "Searching...",
    }

    sink.write(event)

    expect(mockController.enqueue).toHaveBeenCalled()
    const encoded = mockController.enqueue.mock.calls[0][0]
    const text = new TextDecoder().decode(encoded)

    expect(text).toContain("event: reasoning")
    expect(text).toContain("id: req_test_001")
    expect(text).toContain("data: ")
    expect(text).toContain('"stage":"SOURCES"')
  })

  it("uses terminal event type for terminal stages", () => {
    const mockController = {
      enqueue: vi.fn(),
      close: vi.fn(),
    }
    const sink = createSSESink(mockController as unknown as ReadableStreamDefaultController)

    const event: ReasoningEvent = {
      v: SCHEMA_VERSION,
      id: "req_test_final",
      requestId: "req_test",
      seq: 10,
      ts: "2025-12-26T10:00:00Z",
      stage: "ANSWER",
      status: "complete",
    }

    sink.write(event)

    const encoded = mockController.enqueue.mock.calls[0][0]
    const text = new TextDecoder().decode(encoded)

    expect(text).toContain("event: terminal")
  })
})
