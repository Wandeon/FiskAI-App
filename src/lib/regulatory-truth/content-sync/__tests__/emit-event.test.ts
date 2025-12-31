// src/lib/regulatory-truth/content-sync/__tests__/emit-event.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { emitContentSyncEvent, MissingPointersError, type EmitEventParams } from "../emit-event"
import { generateEventId, buildEventSignature } from "../event-id"
import type { ContentSyncEventV1 } from "../types"

// Mock the drizzle database
vi.mock("@/lib/db/drizzle", () => {
  const mockInsert = vi.fn()
  const mockValues = vi.fn()
  const mockOnConflictDoNothing = vi.fn()
  const mockReturning = vi.fn()

  // Chain mock functions
  mockInsert.mockReturnValue({ values: mockValues })
  mockValues.mockReturnValue({ onConflictDoNothing: mockOnConflictDoNothing })
  mockOnConflictDoNothing.mockReturnValue({ returning: mockReturning })
  mockReturning.mockResolvedValue([{ eventId: "test-event-id" }])

  return {
    drizzleDb: {
      insert: mockInsert,
    },
    // Export the mocks for test access
    __mocks: {
      mockInsert,
      mockValues,
      mockOnConflictDoNothing,
      mockReturning,
    },
  }
})

// Mock the schema
vi.mock("@/lib/db/schema/content-sync", () => ({
  contentSyncEvents: {
    eventId: Symbol("eventId"),
  },
}))

// Access mocks for assertions
const getMocks = async () => {
  const drizzleModule = await import("@/lib/db/drizzle")
  return (drizzleModule as unknown as { __mocks: unknown }).__mocks
}

describe("emit-event", () => {
  const baseParams: EmitEventParams = {
    type: "RULE_RELEASED",
    ruleId: "rule-123",
    conceptId: "pdv-threshold",
    domain: "tax",
    effectiveFrom: new Date("2024-01-01"),
    changeType: "update",
    ruleTier: "T1",
    sourcePointerIds: ["ptr-1", "ptr-2"],
    confidenceLevel: 95,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("MissingPointersError", () => {
    it("creates error with correct message", () => {
      const error = new MissingPointersError("rule-xyz")

      expect(error.name).toBe("MissingPointersError")
      expect(error.message).toBe("Event has no sourcePointerIds for rule: rule-xyz")
      expect(error.ruleId).toBe("rule-xyz")
    })

    it("is instanceof Error", () => {
      const error = new MissingPointersError("rule-xyz")
      expect(error instanceof Error).toBe(true)
    })
  })

  describe("emitContentSyncEvent", () => {
    it("throws MissingPointersError when sourcePointerIds is empty", async () => {
      const paramsWithEmptyPointers = {
        ...baseParams,
        sourcePointerIds: [],
      }

      await expect(emitContentSyncEvent(paramsWithEmptyPointers)).rejects.toThrow(
        MissingPointersError
      )

      await expect(emitContentSyncEvent(paramsWithEmptyPointers)).rejects.toThrow(
        "Event has no sourcePointerIds for rule: rule-123"
      )
    })

    it("throws MissingPointersError when sourcePointerIds is undefined", async () => {
      const paramsWithUndefinedPointers = {
        ...baseParams,
        sourcePointerIds: undefined as unknown as string[],
      }

      await expect(emitContentSyncEvent(paramsWithUndefinedPointers)).rejects.toThrow(
        MissingPointersError
      )
    })

    it("creates event with correct fields", async () => {
      const mocks = await getMocks()

      const result = await emitContentSyncEvent(baseParams)

      // Verify the insert was called
      expect(mocks.mockInsert).toHaveBeenCalled()

      // Verify values were passed correctly
      expect(mocks.mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "RULE_RELEASED",
          ruleId: "rule-123",
          conceptId: "pdv-threshold",
          domain: "tax",
          effectiveFrom: baseParams.effectiveFrom,
          payload: expect.objectContaining({
            version: 1,
            type: "RULE_RELEASED",
            ruleId: "rule-123",
            conceptId: "pdv-threshold",
            domain: "tax",
            changeType: "update",
            effectiveFrom: "2024-01-01",
            sourcePointerIds: ["ptr-1", "ptr-2"],
            confidenceLevel: 95,
            severity: "major", // T1 with non-repeal -> major
          }),
        })
      )

      // Verify result
      expect(result.eventId).toBeDefined()
      expect(result.isNew).toBe(true)
    })

    it("generates deterministic event ID from signature", async () => {
      const mocks = await getMocks()

      await emitContentSyncEvent(baseParams)

      // Get the eventId that was passed to the insert
      const insertCall = mocks.mockValues.mock.calls[0][0]
      const eventId = insertCall.eventId

      // Manually compute what the eventId should be
      const signature = buildEventSignature({
        ruleId: baseParams.ruleId,
        conceptId: baseParams.conceptId,
        type: baseParams.type,
        effectiveFrom: "2024-01-01",
        sourcePointerIds: baseParams.sourcePointerIds,
        newValue: undefined,
      })
      const expectedEventId = generateEventId(signature)

      expect(eventId).toBe(expectedEventId)
    })

    it("is idempotent - duplicate returns existing ID with isNew: false", async () => {
      const mocks = await getMocks()

      // First call - new event
      mocks.mockReturning.mockResolvedValueOnce([{ eventId: "existing-event-id" }])
      const result1 = await emitContentSyncEvent(baseParams)
      expect(result1.isNew).toBe(true)

      // Second call - conflict (empty array returned)
      mocks.mockReturning.mockResolvedValueOnce([])
      const result2 = await emitContentSyncEvent(baseParams)
      expect(result2.isNew).toBe(false)

      // Both should return the same event ID (deterministic)
      expect(result1.eventId).toBe(result2.eventId)
    })

    it("includes optional fields when provided", async () => {
      const mocks = await getMocks()

      const paramsWithOptionalFields: EmitEventParams = {
        ...baseParams,
        previousValue: "35000",
        newValue: "40000",
        valueType: "currency",
        evidenceIds: ["ev-1", "ev-2"],
        primarySourceUrl: "https://narodne-novine.nn.hr/clanci/sluzbeni/123",
      }

      await emitContentSyncEvent(paramsWithOptionalFields)

      expect(mocks.mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            previousValue: "35000",
            newValue: "40000",
            valueType: "currency",
            evidenceIds: ["ev-1", "ev-2"],
            primarySourceUrl: "https://narodne-novine.nn.hr/clanci/sluzbeni/123",
          }),
        })
      )
    })

    it("determines correct severity for each tier", async () => {
      const mocks = await getMocks()

      // T0 -> breaking
      await emitContentSyncEvent({ ...baseParams, ruleTier: "T0" })
      let payload = mocks.mockValues.mock.calls[0][0].payload as ContentSyncEventV1
      expect(payload.severity).toBe("breaking")

      vi.clearAllMocks()

      // T1 -> major
      await emitContentSyncEvent({ ...baseParams, ruleTier: "T1" })
      payload = mocks.mockValues.mock.calls[0][0].payload as ContentSyncEventV1
      expect(payload.severity).toBe("major")

      vi.clearAllMocks()

      // T2 -> minor
      await emitContentSyncEvent({ ...baseParams, ruleTier: "T2" })
      payload = mocks.mockValues.mock.calls[0][0].payload as ContentSyncEventV1
      expect(payload.severity).toBe("minor")

      vi.clearAllMocks()

      // T3 -> info
      await emitContentSyncEvent({ ...baseParams, ruleTier: "T3" })
      payload = mocks.mockValues.mock.calls[0][0].payload as ContentSyncEventV1
      expect(payload.severity).toBe("info")
    })

    it("always uses breaking severity for repeal changes", async () => {
      const mocks = await getMocks()

      // Even T3 repeal should be breaking
      await emitContentSyncEvent({
        ...baseParams,
        ruleTier: "T3",
        changeType: "repeal",
      })

      const payload = mocks.mockValues.mock.calls[0][0].payload as ContentSyncEventV1
      expect(payload.severity).toBe("breaking")
    })

    it("formats effectiveFrom as ISO date string", async () => {
      const mocks = await getMocks()

      const date = new Date("2025-06-15T10:30:00Z")
      await emitContentSyncEvent({
        ...baseParams,
        effectiveFrom: date,
      })

      const payload = mocks.mockValues.mock.calls[0][0].payload as ContentSyncEventV1
      expect(payload.effectiveFrom).toBe("2025-06-15")
    })

    it("calls onConflictDoNothing on eventId column", async () => {
      const mocks = await getMocks()
      const { contentSyncEvents } = await import("@/lib/db/schema/content-sync")

      await emitContentSyncEvent(baseParams)

      expect(mocks.mockOnConflictDoNothing).toHaveBeenCalledWith({
        target: contentSyncEvents.eventId,
      })
    })

    it("includes signature in payload", async () => {
      const mocks = await getMocks()

      await emitContentSyncEvent(baseParams)

      const payload = mocks.mockValues.mock.calls[0][0].payload as ContentSyncEventV1
      expect(payload.signature).toBeDefined()
      expect(payload.signature.ruleId).toBe(baseParams.ruleId)
      expect(payload.signature.conceptId).toBe(baseParams.conceptId)
      expect(payload.signature.type).toBe(baseParams.type)
      expect(payload.signature.effectiveFrom).toBe("2024-01-01")
      expect(payload.signature.sourcePointerIdsHash).toBeDefined()
    })

    it("excludes optional fields when undefined", async () => {
      const mocks = await getMocks()

      // Only required fields
      await emitContentSyncEvent(baseParams)

      const payload = mocks.mockValues.mock.calls[0][0].payload as ContentSyncEventV1
      expect(payload.previousValue).toBeUndefined()
      expect(payload.newValue).toBeUndefined()
      expect(payload.valueType).toBeUndefined()
      expect(payload.evidenceIds).toBeUndefined()
      expect(payload.primarySourceUrl).toBeUndefined()
    })

    it("excludes evidenceIds when array is empty", async () => {
      const mocks = await getMocks()

      await emitContentSyncEvent({
        ...baseParams,
        evidenceIds: [],
      })

      const payload = mocks.mockValues.mock.calls[0][0].payload as ContentSyncEventV1
      expect(payload.evidenceIds).toBeUndefined()
    })
  })
})
