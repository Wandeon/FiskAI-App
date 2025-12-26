// src/lib/assistant/reasoning/__tests__/event-factory.test.ts
import { describe, it, expect, beforeEach } from "vitest"
import { createEventFactory, type EventFactory } from "../event-factory"
import { SCHEMA_VERSION } from "../types"

describe("EventFactory", () => {
  let factory: EventFactory

  beforeEach(() => {
    factory = createEventFactory("req_test123")
  })

  describe("createEventFactory", () => {
    it("creates factory with correct requestId", () => {
      const event = factory.emit({
        stage: "SOURCES",
        status: "started",
        message: "Searching...",
      })

      expect(event.requestId).toBe("req_test123")
    })
  })

  describe("emit", () => {
    it("generates monotonic sequence numbers", () => {
      const event1 = factory.emit({ stage: "SOURCES", status: "started" })
      const event2 = factory.emit({ stage: "SOURCES", status: "progress" })
      const event3 = factory.emit({ stage: "SOURCES", status: "complete" })

      expect(event1.seq).toBe(0)
      expect(event2.seq).toBe(1)
      expect(event3.seq).toBe(2)
    })

    it("generates unique event IDs with padded sequence", () => {
      const event = factory.emit({ stage: "SOURCES", status: "started" })

      expect(event.id).toBe("req_test123_000")
    })

    it("includes schema version", () => {
      const event = factory.emit({ stage: "SOURCES", status: "started" })

      expect(event.v).toBe(SCHEMA_VERSION)
    })

    it("includes ISO timestamp", () => {
      const event = factory.emit({ stage: "SOURCES", status: "started" })

      expect(event.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    it("includes optional message", () => {
      const event = factory.emit({
        stage: "SOURCES",
        status: "started",
        message: "Searching authoritative sources...",
      })

      expect(event.message).toBe("Searching authoritative sources...")
    })

    it("includes optional data payload", () => {
      const data = { summary: "Found 3 sources", sources: [] }
      const event = factory.emit({
        stage: "SOURCES",
        status: "complete",
        data,
      })

      expect(event.data).toEqual(data)
    })
  })

  describe("getSequence", () => {
    it("returns current sequence number", () => {
      expect(factory.getSequence()).toBe(0)

      factory.emit({ stage: "SOURCES", status: "started" })
      expect(factory.getSequence()).toBe(1)
    })
  })

  describe("getRequestId", () => {
    it("returns the requestId passed to factory", () => {
      expect(factory.getRequestId()).toBe("req_test123")
    })
  })
})
