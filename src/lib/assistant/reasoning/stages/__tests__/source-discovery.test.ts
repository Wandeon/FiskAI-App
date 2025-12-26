// src/lib/assistant/reasoning/stages/__tests__/source-discovery.test.ts
import { describe, it, expect, vi } from "vitest"
import { sourceDiscoveryStage } from "../source-discovery"
import { createEventFactory } from "../../event-factory"
import type { SourcesPayload, ReasoningEvent } from "../../types"

// Mock concept matcher
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

describe("sourceDiscoveryStage", () => {
  it("yields started event", async () => {
    const factory = createEventFactory("req_test")
    const generator = sourceDiscoveryStage(factory, ["pdv", "stopa"])

    const { value: startedEvent } = (await generator.next()) as {
      value: ReasoningEvent
      done: boolean
    }

    expect(startedEvent.stage).toBe("SOURCES")
    expect(startedEvent.status).toBe("started")
    expect(startedEvent.message).toBe("Searching authoritative sources...")
  })

  it("yields progress events for each source found", async () => {
    const factory = createEventFactory("req_test")
    const generator = sourceDiscoveryStage(factory, ["pdv", "stopa"])

    await generator.next() // started

    const { value: progressEvent } = (await generator.next()) as {
      value: ReasoningEvent
      done: boolean
    }
    expect(progressEvent.stage).toBe("SOURCES")
    expect(progressEvent.status).toBe("progress")
    expect(progressEvent.message).toContain("Found:")
  })

  it("yields complete event with sources summary", async () => {
    const factory = createEventFactory("req_test")
    const generator = sourceDiscoveryStage(factory, ["pdv", "stopa"])

    const events: ReasoningEvent[] = []
    for await (const event of generator) {
      events.push(event)
    }

    const completeEvent = events.find((e) => e.status === "complete")
    expect(completeEvent).toBeDefined()
    expect(completeEvent.data).toBeDefined()

    const data = completeEvent.data as SourcesPayload
    expect(data.sources).toBeDefined()
    expect(Array.isArray(data.sources)).toBe(true)
  })
})
