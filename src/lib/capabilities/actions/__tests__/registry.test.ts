/**
 * Action Handler Registry Tests
 *
 * Tests for the action handler registry that stores and retrieves
 * action handlers by capability and action ID.
 *
 * @module capabilities/actions
 * @since PHASE 2 - Capability-Driven Actions
 */

import { describe, it, expect, beforeEach } from "vitest"
import type { ActionRegistryEntry, ActionHandler } from "../types"
import { registerActionHandler, getActionHandler, getAllHandlers, clearRegistry } from "../registry"

// Helper to create mock handlers
function createMockHandler(): ActionHandler {
  return async () => ({ success: true })
}

// Helper to create registry entries
function createEntry(
  capabilityId: string,
  actionId: string,
  permission: string = "test:permission"
): ActionRegistryEntry {
  return {
    capabilityId,
    actionId,
    handler: createMockHandler(),
    permission,
  }
}

describe("Action Handler Registry", () => {
  // Clear registry before each test to ensure isolation
  beforeEach(() => {
    clearRegistry()
  })

  describe("registerActionHandler", () => {
    it("should register a handler entry", () => {
      const entry = createEntry("INV-001", "create", "invoices:write")

      registerActionHandler(entry)

      const retrieved = getActionHandler("INV-001", "create")
      expect(retrieved).toBeDefined()
      expect(retrieved?.capabilityId).toBe("INV-001")
      expect(retrieved?.actionId).toBe("create")
      expect(retrieved?.permission).toBe("invoices:write")
    })

    it("should overwrite existing handler with same key", () => {
      const entry1 = createEntry("INV-001", "create", "permission-1")
      const entry2 = createEntry("INV-001", "create", "permission-2")

      registerActionHandler(entry1)
      registerActionHandler(entry2)

      const retrieved = getActionHandler("INV-001", "create")
      expect(retrieved?.permission).toBe("permission-2")
    })

    it("should register multiple handlers for same capability", () => {
      const createEntry1 = createEntry("INV-001", "create", "invoices:write")
      const updateEntry = createEntry("INV-001", "update", "invoices:write")
      const deleteEntry = createEntry("INV-001", "delete", "invoices:delete")

      registerActionHandler(createEntry1)
      registerActionHandler(updateEntry)
      registerActionHandler(deleteEntry)

      expect(getActionHandler("INV-001", "create")).toBeDefined()
      expect(getActionHandler("INV-001", "update")).toBeDefined()
      expect(getActionHandler("INV-001", "delete")).toBeDefined()
    })

    it("should register handlers for different capabilities", () => {
      const invEntry = createEntry("INV-001", "create", "invoices:write")
      const expEntry = createEntry("EXP-001", "create", "expenses:write")

      registerActionHandler(invEntry)
      registerActionHandler(expEntry)

      expect(getActionHandler("INV-001", "create")).toBeDefined()
      expect(getActionHandler("EXP-001", "create")).toBeDefined()
    })
  })

  describe("getActionHandler", () => {
    it("should return undefined for unregistered handler", () => {
      const result = getActionHandler("UNKNOWN-001", "action")

      expect(result).toBeUndefined()
    })

    it("should return the correct handler by capabilityId and actionId", () => {
      const entry = createEntry("INV-003", "fiscalize", "invoices:fiscalize")
      registerActionHandler(entry)

      const retrieved = getActionHandler("INV-003", "fiscalize")

      expect(retrieved).toBeDefined()
      expect(retrieved?.capabilityId).toBe("INV-003")
      expect(retrieved?.actionId).toBe("fiscalize")
      expect(retrieved?.permission).toBe("invoices:fiscalize")
    })

    it("should not return handler for wrong actionId", () => {
      const entry = createEntry("INV-001", "create", "invoices:write")
      registerActionHandler(entry)

      const result = getActionHandler("INV-001", "delete")

      expect(result).toBeUndefined()
    })

    it("should not return handler for wrong capabilityId", () => {
      const entry = createEntry("INV-001", "create", "invoices:write")
      registerActionHandler(entry)

      const result = getActionHandler("EXP-001", "create")

      expect(result).toBeUndefined()
    })

    it("should use key format capabilityId:actionId", () => {
      // This test verifies the internal key format by checking
      // that similar but different IDs don't collide
      const entry1 = createEntry("INV-001", "create", "permission-1")
      const entry2 = createEntry("INV", "001:create", "permission-2")

      registerActionHandler(entry1)
      registerActionHandler(entry2)

      // These should be different entries
      const retrieved1 = getActionHandler("INV-001", "create")
      const retrieved2 = getActionHandler("INV", "001:create")

      expect(retrieved1?.permission).toBe("permission-1")
      expect(retrieved2?.permission).toBe("permission-2")
    })
  })

  describe("getAllHandlers", () => {
    it("should return empty array when no handlers registered", () => {
      const handlers = getAllHandlers()

      expect(handlers).toEqual([])
    })

    it("should return all registered handlers", () => {
      const entry1 = createEntry("INV-001", "create", "invoices:write")
      const entry2 = createEntry("INV-002", "update", "invoices:write")
      const entry3 = createEntry("EXP-001", "create", "expenses:write")

      registerActionHandler(entry1)
      registerActionHandler(entry2)
      registerActionHandler(entry3)

      const handlers = getAllHandlers()

      expect(handlers).toHaveLength(3)
      expect(handlers.map((h) => h.capabilityId)).toContain("INV-001")
      expect(handlers.map((h) => h.capabilityId)).toContain("INV-002")
      expect(handlers.map((h) => h.capabilityId)).toContain("EXP-001")
    })

    it("should return a new array (not the internal storage)", () => {
      const entry = createEntry("INV-001", "create", "invoices:write")
      registerActionHandler(entry)

      const handlers1 = getAllHandlers()
      const handlers2 = getAllHandlers()

      expect(handlers1).not.toBe(handlers2)
      expect(handlers1).toEqual(handlers2)
    })
  })

  describe("clearRegistry", () => {
    it("should remove all registered handlers", () => {
      registerActionHandler(createEntry("INV-001", "create"))
      registerActionHandler(createEntry("INV-002", "update"))
      registerActionHandler(createEntry("EXP-001", "create"))

      expect(getAllHandlers()).toHaveLength(3)

      clearRegistry()

      expect(getAllHandlers()).toHaveLength(0)
    })

    it("should allow re-registration after clearing", () => {
      const entry = createEntry("INV-001", "create", "invoices:write")
      registerActionHandler(entry)
      clearRegistry()

      registerActionHandler(entry)

      const retrieved = getActionHandler("INV-001", "create")
      expect(retrieved).toBeDefined()
      expect(retrieved?.permission).toBe("invoices:write")
    })
  })

  describe("handler execution", () => {
    it("should store callable handlers", async () => {
      const handler: ActionHandler<{ result: string }> = async (context, params) => ({
        success: true,
        data: { result: `Processed ${params?.id}` },
      })

      const entry: ActionRegistryEntry = {
        capabilityId: "INV-001",
        actionId: "process",
        handler,
        permission: "invoices:process",
      }

      registerActionHandler(entry)

      const retrieved = getActionHandler("INV-001", "process")
      expect(retrieved).toBeDefined()

      const result = await retrieved!.handler(
        { userId: "user-1", companyId: "company-1", permissions: [] },
        { id: "test-123" }
      )

      expect(result.success).toBe(true)
      expect((result.data as { result: string }).result).toBe("Processed test-123")
    })
  })
})
