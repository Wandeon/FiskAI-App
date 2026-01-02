/**
 * Action Handler Types Tests
 *
 * These tests verify that the type definitions compile correctly
 * and enforce the expected structure.
 *
 * @module capabilities/actions
 * @since PHASE 2 - Capability-Driven Actions
 */

import { describe, it, expect } from "vitest"
import type {
  ActionResult,
  ActionErrorCode,
  ActionContext,
  ActionParams,
  ActionHandler,
  ActionRegistryEntry,
} from "../types"

describe("ActionResult", () => {
  it("should allow success result with data", () => {
    const result: ActionResult<{ id: string }> = {
      success: true,
      data: { id: "test-123" },
    }

    expect(result.success).toBe(true)
    expect(result.data?.id).toBe("test-123")
  })

  it("should allow error result with code and message", () => {
    const result: ActionResult = {
      success: false,
      error: "Something went wrong",
      code: "INTERNAL_ERROR",
    }

    expect(result.success).toBe(false)
    expect(result.error).toBe("Something went wrong")
    expect(result.code).toBe("INTERNAL_ERROR")
  })

  it("should allow result with details", () => {
    const result: ActionResult = {
      success: false,
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: { field: "amount", reason: "must be positive" },
    }

    expect(result.details?.field).toBe("amount")
  })
})

describe("ActionErrorCode", () => {
  it("should include all expected error codes", () => {
    const codes: ActionErrorCode[] = [
      "UNAUTHORIZED",
      "VALIDATION_ERROR",
      "NOT_FOUND",
      "CAPABILITY_BLOCKED",
      "PERIOD_LOCKED",
      "ENTITY_IMMUTABLE",
      "RATE_LIMITED",
      "INTERNAL_ERROR",
    ]

    expect(codes).toHaveLength(8)
    codes.forEach((code) => {
      expect(typeof code).toBe("string")
    })
  })
})

describe("ActionContext", () => {
  it("should require userId, companyId, and permissions", () => {
    const context: ActionContext = {
      userId: "user-123",
      companyId: "company-456",
      permissions: ["invoices:read", "invoices:write"],
    }

    expect(context.userId).toBe("user-123")
    expect(context.companyId).toBe("company-456")
    expect(context.permissions).toHaveLength(2)
  })

  it("should allow optional entityId and entityType", () => {
    const context: ActionContext = {
      userId: "user-123",
      companyId: "company-456",
      entityId: "invoice-789",
      entityType: "Invoice",
      permissions: ["invoices:write"],
    }

    expect(context.entityId).toBe("invoice-789")
    expect(context.entityType).toBe("Invoice")
  })
})

describe("ActionParams", () => {
  it("should allow optional id parameter", () => {
    const params: ActionParams = {
      id: "item-123",
    }

    expect(params.id).toBe("item-123")
  })

  it("should allow additional properties", () => {
    const params: ActionParams = {
      id: "item-123",
      amount: 1000,
      description: "Test item",
      nested: { key: "value" },
    }

    expect(params.id).toBe("item-123")
    expect(params.amount).toBe(1000)
    expect(params.description).toBe("Test item")
  })

  it("should allow empty params", () => {
    const params: ActionParams = {}

    expect(params.id).toBeUndefined()
  })
})

describe("ActionHandler", () => {
  it("should be a function that returns Promise<ActionResult>", async () => {
    const handler: ActionHandler<{ created: boolean }> = async (context) => {
      return {
        success: true,
        data: { created: true },
      }
    }

    const context: ActionContext = {
      userId: "user-1",
      companyId: "company-1",
      permissions: [],
    }

    const result = await handler(context)
    expect(result.success).toBe(true)
    expect(result.data?.created).toBe(true)
  })

  it("should accept optional params", async () => {
    const handler: ActionHandler<string> = async (context, params) => {
      return {
        success: true,
        data: params?.id ?? "default",
      }
    }

    const context: ActionContext = {
      userId: "user-1",
      companyId: "company-1",
      permissions: [],
    }

    const result = await handler(context, { id: "custom-id" })
    expect(result.data).toBe("custom-id")
  })
})

describe("ActionRegistryEntry", () => {
  it("should contain capabilityId, actionId, handler, and permission", async () => {
    const mockHandler: ActionHandler = async () => ({ success: true })

    const entry: ActionRegistryEntry = {
      capabilityId: "INV-001",
      actionId: "create",
      handler: mockHandler,
      permission: "invoices:write",
    }

    expect(entry.capabilityId).toBe("INV-001")
    expect(entry.actionId).toBe("create")
    expect(entry.permission).toBe("invoices:write")
    expect(typeof entry.handler).toBe("function")

    // Verify handler is callable
    const result = await entry.handler({ userId: "u", companyId: "c", permissions: [] }, {})
    expect(result.success).toBe(true)
  })
})
