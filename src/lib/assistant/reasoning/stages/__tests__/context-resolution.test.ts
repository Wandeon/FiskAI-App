// src/lib/assistant/reasoning/stages/__tests__/context-resolution.test.ts
import { describe, it, expect } from "vitest"
import { contextResolutionStage, type ContextResolution } from "../context-resolution"
import { createEventFactory } from "../../event-factory"
import type { ContextResolutionPayload, ReasoningEvent } from "../../types"

describe("contextResolutionStage", () => {
  it("yields started event first", async () => {
    const factory = createEventFactory("req_test")
    const generator = contextResolutionStage(factory, "Koji je prag za PDV?")

    const { value: startedEvent } = (await generator.next()) as {
      value: ReasoningEvent
      done: boolean
    }

    expect(startedEvent.stage).toBe("CONTEXT_RESOLUTION")
    expect(startedEvent.status).toBe("started")
    expect(startedEvent.message).toBe("Analysing question...")
  })

  it("yields complete event with resolution data", async () => {
    const factory = createEventFactory("req_test")
    const generator = contextResolutionStage(factory, "Koji je prag za PDV?")

    await generator.next() // started
    const { value: completeEvent } = (await generator.next()) as {
      value: ReasoningEvent
      done: boolean
    }

    expect(completeEvent.stage).toBe("CONTEXT_RESOLUTION")
    expect(completeEvent.status).toBe("complete")
    expect(completeEvent.data).toBeDefined()

    const data = completeEvent.data as ContextResolutionPayload
    expect(data.jurisdiction).toBe("HR")
    expect(data.domain).toBe("TAX")
    expect(data.confidence).toBeGreaterThan(0)
    expect(data.userContextSnapshot).toBeDefined()
  })

  it("returns resolution for downstream stages", async () => {
    const factory = createEventFactory("req_test")
    const generator = contextResolutionStage(factory, "Koji je prag za PDV?")

    await generator.next() // started
    await generator.next() // complete
    const { value: resolution, done } = (await generator.next()) as {
      value: ContextResolution
      done: boolean
    }

    expect(done).toBe(true)
    expect(resolution).toBeDefined()
    expect(resolution.jurisdiction).toBe("HR")
  })

  it("sets requiresClarification when confidence < 0.9", async () => {
    const factory = createEventFactory("req_test")
    // Vague query should have lower confidence
    const generator = contextResolutionStage(factory, "porez")

    await generator.next() // started
    const { value: completeEvent } = (await generator.next()) as {
      value: ReasoningEvent
      done: boolean
    }
    const data = completeEvent.data as ContextResolutionPayload

    // Vague queries should flag for clarification
    if (data.confidence < 0.9) {
      expect(data.requiresClarification).toBe(true)
    }
  })
})
