// src/lib/capabilities/actions/__tests__/batch-types.test.ts
import { describe, it, expect } from "vitest"
import type {
  BatchActionInput,
  BatchActionResult,
  BatchItemResult,
  BatchProgressCallback,
} from "../batch-types"

describe("Batch Action Types", () => {
  it("BatchActionInput has required fields", () => {
    const input: BatchActionInput = {
      capabilityId: "INV-003",
      actionId: "fiscalize",
      entityIds: ["inv-1", "inv-2", "inv-3"],
      entityType: "Invoice",
    }
    expect(input.capabilityId).toBe("INV-003")
    expect(input.entityIds.length).toBe(3)
  })

  it("BatchItemResult tracks individual outcomes", () => {
    const success: BatchItemResult = {
      entityId: "inv-1",
      success: true,
      data: { fiscalNumber: "12345" },
    }
    const failure: BatchItemResult = {
      entityId: "inv-2",
      success: false,
      error: "Entity not found",
      code: "NOT_FOUND",
    }
    expect(success.success).toBe(true)
    expect(failure.success).toBe(false)
    expect(failure.code).toBe("NOT_FOUND")
  })

  it("BatchActionResult aggregates outcomes", () => {
    const result: BatchActionResult = {
      total: 3,
      succeeded: 2,
      failed: 1,
      results: [
        { entityId: "inv-1", success: true },
        { entityId: "inv-2", success: true },
        { entityId: "inv-3", success: false, error: "Blocked", code: "CAPABILITY_BLOCKED" },
      ],
    }
    expect(result.succeeded + result.failed).toBe(result.total)
  })

  it("BatchProgressCallback receives progress updates", () => {
    const callback: BatchProgressCallback = (completed, total, current) => {
      expect(completed).toBeLessThanOrEqual(total)
      expect(current.entityId).toBeDefined()
    }
    callback(1, 3, { entityId: "inv-1", success: true })
  })
})
