// src/lib/assistant/reasoning/client/__tests__/selectors.test.ts
import { describe, it, expect } from "vitest"
import { createSelectors, getTerminalFromEvents } from "../selectors"
import type { ReasoningEvent } from "../../types"
import { SCHEMA_VERSION } from "../../types"

const createEvent = (stage: string, status: string, seq: number): ReasoningEvent => ({
  v: SCHEMA_VERSION,
  id: `req_test_${String(seq).padStart(3, "0")}`,
  requestId: "req_test",
  seq,
  ts: new Date().toISOString(),
  stage: stage as ReasoningEvent["stage"],
  status: status as ReasoningEvent["status"],
})

describe("createSelectors", () => {
  it("groups events by stage", () => {
    const events: ReasoningEvent[] = [
      createEvent("SOURCES", "started", 0),
      createEvent("SOURCES", "progress", 1),
      createEvent("SOURCES", "complete", 2),
      createEvent("RETRIEVAL", "started", 3),
    ]

    const selectors = createSelectors(events)

    expect(selectors.byStage.SOURCES).toHaveLength(3)
    expect(selectors.byStage.RETRIEVAL).toHaveLength(1)
  })

  it("returns latest event per stage", () => {
    const events: ReasoningEvent[] = [
      createEvent("SOURCES", "started", 0),
      createEvent("SOURCES", "progress", 1),
      createEvent("SOURCES", "complete", 2),
    ]

    const selectors = createSelectors(events)

    expect(selectors.latestByStage.SOURCES?.status).toBe("complete")
    expect(selectors.latestByStage.SOURCES?.seq).toBe(2)
  })

  it("identifies terminal event", () => {
    const events: ReasoningEvent[] = [
      createEvent("SOURCES", "complete", 0),
      createEvent("ANSWER", "complete", 1),
    ]

    const selectors = createSelectors(events)

    expect(selectors.terminal).toBeDefined()
    expect(selectors.terminal?.stage).toBe("ANSWER")
    expect(selectors.terminalOutcome).toBe("ANSWER")
  })

  it("returns undefined terminal when no terminal event", () => {
    const events: ReasoningEvent[] = [
      createEvent("SOURCES", "started", 0),
      createEvent("SOURCES", "progress", 1),
    ]

    const selectors = createSelectors(events)

    expect(selectors.terminal).toBeUndefined()
    expect(selectors.terminalOutcome).toBeUndefined()
  })
})

describe("getTerminalFromEvents", () => {
  it("finds ANSWER terminal", () => {
    const events: ReasoningEvent[] = [
      createEvent("SOURCES", "complete", 0),
      createEvent("ANSWER", "complete", 1),
    ]

    const terminal = getTerminalFromEvents(events)
    expect(terminal?.stage).toBe("ANSWER")
  })

  it("finds REFUSAL terminal", () => {
    const events: ReasoningEvent[] = [
      createEvent("SOURCES", "complete", 0),
      createEvent("REFUSAL", "complete", 1),
    ]

    const terminal = getTerminalFromEvents(events)
    expect(terminal?.stage).toBe("REFUSAL")
  })

  it("returns undefined when no terminal", () => {
    const events: ReasoningEvent[] = [createEvent("SOURCES", "started", 0)]

    const terminal = getTerminalFromEvents(events)
    expect(terminal).toBeUndefined()
  })
})
