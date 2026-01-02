/**
 * Action Executor Tests
 *
 * Tests for the executeCapabilityAction server action that validates
 * capability state before dispatching to handlers.
 *
 * @module capabilities/actions
 * @since PHASE 2 - Capability-Driven Actions
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import type { CapabilityResponse, CapabilityState, CapabilityBlocker } from "../../types"
import type { ActionContext, ActionResult } from "../types"

// Mock dependencies before importing executor
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock("../registry", () => ({
  getActionHandler: vi.fn(),
}))

vi.mock("../../server", () => ({
  resolveCapabilityForUser: vi.fn(),
}))

// Mock the handlers import (side effect registration)
vi.mock("../handlers/invoice", () => ({}))

// Import mocked functions
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getActionHandler } from "../registry"
import { resolveCapabilityForUser } from "../../server"

// Cast mocks for type safety
const mockAuth = auth as ReturnType<typeof vi.fn>
const mockGetActionHandler = getActionHandler as ReturnType<typeof vi.fn>
const mockResolveCapabilityForUser = resolveCapabilityForUser as ReturnType<typeof vi.fn>
const mockUserFindUnique = db.user.findUnique as ReturnType<typeof vi.fn>

// Import executor after mocks are set up
import { executeCapabilityAction, type ExecuteActionInput } from "../executor"

// Helper to create mock session
function createMockSession(userId = "user-123") {
  return {
    user: { id: userId, email: "test@example.com" },
    expires: new Date(Date.now() + 86400000).toISOString(),
  }
}

// Helper to create mock user with company
function createMockUser(userId = "user-123", companyId = "company-456") {
  return {
    id: userId,
    systemRole: "USER",
    companies: [
      {
        companyId,
        role: "OWNER",
      },
    ],
  }
}

// Helper to create mock capability response
function createCapabilityResponse(
  capabilityId: string,
  state: CapabilityState,
  options: {
    blockers?: CapabilityBlocker[]
    actions?: Array<{ id: string; label: string; enabled: boolean; disabledReason?: string }>
  } = {}
): CapabilityResponse {
  return {
    capability: capabilityId,
    state,
    inputs: [],
    blockers: options.blockers || [],
    actions: options.actions || [{ id: "fiscalize", label: "Fiscalize", enabled: true }],
    resolvedAt: new Date().toISOString(),
  }
}

// Helper to create mock handler entry
function createMockHandlerEntry(
  capabilityId: string,
  actionId: string,
  handler: (context: ActionContext, params?: Record<string, unknown>) => Promise<ActionResult>
) {
  return {
    capabilityId,
    actionId,
    handler,
    permission: "test:permission",
  }
}

describe("executeCapabilityAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("authentication", () => {
    it("should return UNAUTHORIZED when no session", async () => {
      mockAuth.mockResolvedValue(null)

      const input: ExecuteActionInput = {
        capabilityId: "INV-003",
        actionId: "fiscalize",
        entityId: "invoice-123",
      }

      const result = await executeCapabilityAction(input)

      expect(result.success).toBe(false)
      expect(result.code).toBe("UNAUTHORIZED")
      expect(result.error).toBe("Authentication required")
    })

    it("should return UNAUTHORIZED when session has no user", async () => {
      mockAuth.mockResolvedValue({ expires: new Date().toISOString() })

      const input: ExecuteActionInput = {
        capabilityId: "INV-003",
        actionId: "fiscalize",
        entityId: "invoice-123",
      }

      const result = await executeCapabilityAction(input)

      expect(result.success).toBe(false)
      expect(result.code).toBe("UNAUTHORIZED")
      expect(result.error).toBe("Authentication required")
    })

    it("should return UNAUTHORIZED when session user has no id", async () => {
      mockAuth.mockResolvedValue({ user: { email: "test@example.com" } })

      const input: ExecuteActionInput = {
        capabilityId: "INV-003",
        actionId: "fiscalize",
        entityId: "invoice-123",
      }

      const result = await executeCapabilityAction(input)

      expect(result.success).toBe(false)
      expect(result.code).toBe("UNAUTHORIZED")
      expect(result.error).toBe("Authentication required")
    })
  })

  describe("handler lookup", () => {
    it("should return NOT_FOUND when handler is not registered", async () => {
      mockAuth.mockResolvedValue(createMockSession())
      mockGetActionHandler.mockReturnValue(undefined)

      const input: ExecuteActionInput = {
        capabilityId: "UNKNOWN-001",
        actionId: "action",
      }

      const result = await executeCapabilityAction(input)

      expect(result.success).toBe(false)
      expect(result.code).toBe("NOT_FOUND")
      expect(result.error).toBe("Action handler not found: UNKNOWN-001:action")
    })
  })

  describe("user context", () => {
    it("should return UNAUTHORIZED when user has no company", async () => {
      mockAuth.mockResolvedValue(createMockSession())
      mockGetActionHandler.mockReturnValue(
        createMockHandlerEntry("INV-003", "fiscalize", async () => ({ success: true }))
      )
      mockUserFindUnique.mockResolvedValue({
        id: "user-123",
        systemRole: "USER",
        companies: [],
      })

      const input: ExecuteActionInput = {
        capabilityId: "INV-003",
        actionId: "fiscalize",
        entityId: "invoice-123",
      }

      const result = await executeCapabilityAction(input)

      expect(result.success).toBe(false)
      expect(result.code).toBe("UNAUTHORIZED")
      expect(result.error).toBe("No company context available")
    })

    it("should return UNAUTHORIZED when user not found in database", async () => {
      mockAuth.mockResolvedValue(createMockSession())
      mockGetActionHandler.mockReturnValue(
        createMockHandlerEntry("INV-003", "fiscalize", async () => ({ success: true }))
      )
      mockUserFindUnique.mockResolvedValue(null)

      const input: ExecuteActionInput = {
        capabilityId: "INV-003",
        actionId: "fiscalize",
        entityId: "invoice-123",
      }

      const result = await executeCapabilityAction(input)

      expect(result.success).toBe(false)
      expect(result.code).toBe("UNAUTHORIZED")
      expect(result.error).toBe("No company context available")
    })
  })

  describe("capability resolution", () => {
    it("should return CAPABILITY_BLOCKED when capability is BLOCKED", async () => {
      mockAuth.mockResolvedValue(createMockSession())
      mockGetActionHandler.mockReturnValue(
        createMockHandlerEntry("INV-003", "fiscalize", async () => ({ success: true }))
      )
      mockUserFindUnique.mockResolvedValue(createMockUser())
      mockResolveCapabilityForUser.mockResolvedValue(
        createCapabilityResponse("INV-003", "BLOCKED", {
          blockers: [
            {
              type: "PERIOD_LOCKED",
              message: "Accounting period is locked",
              resolution: "Contact administrator to unlock the period",
            },
          ],
        })
      )

      const input: ExecuteActionInput = {
        capabilityId: "INV-003",
        actionId: "fiscalize",
        entityId: "invoice-123",
      }

      const result = await executeCapabilityAction(input)

      expect(result.success).toBe(false)
      expect(result.code).toBe("CAPABILITY_BLOCKED")
      expect(result.error).toBe("Accounting period is locked")
      expect(result.details).toEqual({
        blockerType: "PERIOD_LOCKED",
        resolution: "Contact administrator to unlock the period",
      })
    })

    it("should return UNAUTHORIZED when capability is UNAUTHORIZED", async () => {
      mockAuth.mockResolvedValue(createMockSession())
      mockGetActionHandler.mockReturnValue(
        createMockHandlerEntry("INV-003", "fiscalize", async () => ({ success: true }))
      )
      mockUserFindUnique.mockResolvedValue(createMockUser())
      mockResolveCapabilityForUser.mockResolvedValue(
        createCapabilityResponse("INV-003", "UNAUTHORIZED")
      )

      const input: ExecuteActionInput = {
        capabilityId: "INV-003",
        actionId: "fiscalize",
        entityId: "invoice-123",
      }

      const result = await executeCapabilityAction(input)

      expect(result.success).toBe(false)
      expect(result.code).toBe("UNAUTHORIZED")
      expect(result.error).toBe("Not authorized to perform this action")
    })

    it("should return VALIDATION_ERROR when capability has MISSING_INPUTS", async () => {
      mockAuth.mockResolvedValue(createMockSession())
      mockGetActionHandler.mockReturnValue(
        createMockHandlerEntry("INV-003", "fiscalize", async () => ({ success: true }))
      )
      mockUserFindUnique.mockResolvedValue(createMockUser())
      mockResolveCapabilityForUser.mockResolvedValue(
        createCapabilityResponse("INV-003", "MISSING_INPUTS")
      )

      const input: ExecuteActionInput = {
        capabilityId: "INV-003",
        actionId: "fiscalize",
        entityId: "invoice-123",
      }

      const result = await executeCapabilityAction(input)

      expect(result.success).toBe(false)
      expect(result.code).toBe("VALIDATION_ERROR")
      expect(result.error).toBe("Required inputs are missing")
    })

    it("should return CAPABILITY_BLOCKED when action is not enabled", async () => {
      mockAuth.mockResolvedValue(createMockSession())
      mockGetActionHandler.mockReturnValue(
        createMockHandlerEntry("INV-003", "fiscalize", async () => ({ success: true }))
      )
      mockUserFindUnique.mockResolvedValue(createMockUser())
      mockResolveCapabilityForUser.mockResolvedValue(
        createCapabilityResponse("INV-003", "READY", {
          actions: [
            {
              id: "fiscalize",
              label: "Fiscalize",
              enabled: false,
              disabledReason: "Invoice is already fiscalized",
            },
          ],
        })
      )

      const input: ExecuteActionInput = {
        capabilityId: "INV-003",
        actionId: "fiscalize",
        entityId: "invoice-123",
      }

      const result = await executeCapabilityAction(input)

      expect(result.success).toBe(false)
      expect(result.code).toBe("CAPABILITY_BLOCKED")
      expect(result.error).toBe("Invoice is already fiscalized")
    })

    it("should return CAPABILITY_BLOCKED with generic message when action disabled without reason", async () => {
      mockAuth.mockResolvedValue(createMockSession())
      mockGetActionHandler.mockReturnValue(
        createMockHandlerEntry("INV-003", "fiscalize", async () => ({ success: true }))
      )
      mockUserFindUnique.mockResolvedValue(createMockUser())
      mockResolveCapabilityForUser.mockResolvedValue(
        createCapabilityResponse("INV-003", "READY", {
          actions: [{ id: "fiscalize", label: "Fiscalize", enabled: false }],
        })
      )

      const input: ExecuteActionInput = {
        capabilityId: "INV-003",
        actionId: "fiscalize",
        entityId: "invoice-123",
      }

      const result = await executeCapabilityAction(input)

      expect(result.success).toBe(false)
      expect(result.code).toBe("CAPABILITY_BLOCKED")
      expect(result.error).toBe("Action is not available")
    })

    it("should return CAPABILITY_BLOCKED when action is not in capability actions list", async () => {
      mockAuth.mockResolvedValue(createMockSession())
      mockGetActionHandler.mockReturnValue(
        createMockHandlerEntry("INV-003", "fiscalize", async () => ({ success: true }))
      )
      mockUserFindUnique.mockResolvedValue(createMockUser())
      mockResolveCapabilityForUser.mockResolvedValue(
        createCapabilityResponse("INV-003", "READY", {
          actions: [{ id: "other_action", label: "Other", enabled: true }],
        })
      )

      const input: ExecuteActionInput = {
        capabilityId: "INV-003",
        actionId: "fiscalize",
        entityId: "invoice-123",
      }

      const result = await executeCapabilityAction(input)

      expect(result.success).toBe(false)
      expect(result.code).toBe("CAPABILITY_BLOCKED")
      expect(result.error).toBe("Action is not available")
    })
  })

  describe("handler execution", () => {
    it("should execute handler and return success result", async () => {
      const mockHandler = vi.fn().mockResolvedValue({
        success: true,
        data: { jir: "jir-123", zki: "zki-456" },
      })

      mockAuth.mockResolvedValue(createMockSession())
      mockGetActionHandler.mockReturnValue(
        createMockHandlerEntry("INV-003", "fiscalize", mockHandler)
      )
      mockUserFindUnique.mockResolvedValue(createMockUser())
      mockResolveCapabilityForUser.mockResolvedValue(
        createCapabilityResponse("INV-003", "READY", {
          actions: [{ id: "fiscalize", label: "Fiscalize", enabled: true }],
        })
      )

      const input: ExecuteActionInput = {
        capabilityId: "INV-003",
        actionId: "fiscalize",
        entityId: "invoice-123",
        params: { extra: "data" },
      }

      const result = await executeCapabilityAction(input)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ jir: "jir-123", zki: "zki-456" })
      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-123",
          companyId: "company-456",
          entityId: "invoice-123",
          entityType: undefined,
          permissions: expect.any(Array),
        }),
        { id: "invoice-123", extra: "data" }
      )
    })

    it("should pass entityType to handler context", async () => {
      const mockHandler = vi.fn().mockResolvedValue({ success: true })

      mockAuth.mockResolvedValue(createMockSession())
      mockGetActionHandler.mockReturnValue(
        createMockHandlerEntry("INV-003", "fiscalize", mockHandler)
      )
      mockUserFindUnique.mockResolvedValue(createMockUser())
      mockResolveCapabilityForUser.mockResolvedValue(
        createCapabilityResponse("INV-003", "READY", {
          actions: [{ id: "fiscalize", label: "Fiscalize", enabled: true }],
        })
      )

      const input: ExecuteActionInput = {
        capabilityId: "INV-003",
        actionId: "fiscalize",
        entityId: "invoice-123",
        entityType: "Invoice",
      }

      await executeCapabilityAction(input)

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "Invoice",
        }),
        expect.anything()
      )
    })

    it("should return handler error result on failure", async () => {
      const mockHandler = vi.fn().mockResolvedValue({
        success: false,
        error: "Fiscal service unavailable",
        code: "INTERNAL_ERROR",
      })

      mockAuth.mockResolvedValue(createMockSession())
      mockGetActionHandler.mockReturnValue(
        createMockHandlerEntry("INV-003", "fiscalize", mockHandler)
      )
      mockUserFindUnique.mockResolvedValue(createMockUser())
      mockResolveCapabilityForUser.mockResolvedValue(
        createCapabilityResponse("INV-003", "READY", {
          actions: [{ id: "fiscalize", label: "Fiscalize", enabled: true }],
        })
      )

      const input: ExecuteActionInput = {
        capabilityId: "INV-003",
        actionId: "fiscalize",
        entityId: "invoice-123",
      }

      const result = await executeCapabilityAction(input)

      expect(result.success).toBe(false)
      expect(result.error).toBe("Fiscal service unavailable")
      expect(result.code).toBe("INTERNAL_ERROR")
    })

    it("should catch and wrap handler exceptions", async () => {
      const mockHandler = vi.fn().mockRejectedValue(new Error("Unexpected error"))

      mockAuth.mockResolvedValue(createMockSession())
      mockGetActionHandler.mockReturnValue(
        createMockHandlerEntry("INV-003", "fiscalize", mockHandler)
      )
      mockUserFindUnique.mockResolvedValue(createMockUser())
      mockResolveCapabilityForUser.mockResolvedValue(
        createCapabilityResponse("INV-003", "READY", {
          actions: [{ id: "fiscalize", label: "Fiscalize", enabled: true }],
        })
      )

      const input: ExecuteActionInput = {
        capabilityId: "INV-003",
        actionId: "fiscalize",
        entityId: "invoice-123",
      }

      const result = await executeCapabilityAction(input)

      expect(result.success).toBe(false)
      expect(result.code).toBe("INTERNAL_ERROR")
      expect(result.error).toBe("Unexpected error")
    })

    it("should use generic message for non-Error exceptions", async () => {
      const mockHandler = vi.fn().mockRejectedValue("string error")

      mockAuth.mockResolvedValue(createMockSession())
      mockGetActionHandler.mockReturnValue(
        createMockHandlerEntry("INV-003", "fiscalize", mockHandler)
      )
      mockUserFindUnique.mockResolvedValue(createMockUser())
      mockResolveCapabilityForUser.mockResolvedValue(
        createCapabilityResponse("INV-003", "READY", {
          actions: [{ id: "fiscalize", label: "Fiscalize", enabled: true }],
        })
      )

      const input: ExecuteActionInput = {
        capabilityId: "INV-003",
        actionId: "fiscalize",
        entityId: "invoice-123",
      }

      const result = await executeCapabilityAction(input)

      expect(result.success).toBe(false)
      expect(result.code).toBe("INTERNAL_ERROR")
      expect(result.error).toBe("An unexpected error occurred")
    })
  })

  describe("capability context passing", () => {
    it("should pass entityId and entityType to resolveCapabilityForUser", async () => {
      mockAuth.mockResolvedValue(createMockSession())
      mockGetActionHandler.mockReturnValue(
        createMockHandlerEntry("INV-003", "fiscalize", async () => ({ success: true }))
      )
      mockUserFindUnique.mockResolvedValue(createMockUser())
      mockResolveCapabilityForUser.mockResolvedValue(
        createCapabilityResponse("INV-003", "READY", {
          actions: [{ id: "fiscalize", label: "Fiscalize", enabled: true }],
        })
      )

      const input: ExecuteActionInput = {
        capabilityId: "INV-003",
        actionId: "fiscalize",
        entityId: "invoice-123",
        entityType: "Invoice",
      }

      await executeCapabilityAction(input)

      expect(mockResolveCapabilityForUser).toHaveBeenCalledWith("INV-003", {
        entityId: "invoice-123",
        entityType: "Invoice",
      })
    })

    it("should handle missing entityId and entityType", async () => {
      mockAuth.mockResolvedValue(createMockSession())
      mockGetActionHandler.mockReturnValue(
        createMockHandlerEntry("INV-001", "create", async () => ({
          success: true,
          data: { id: "new-123" },
        }))
      )
      mockUserFindUnique.mockResolvedValue(createMockUser())
      mockResolveCapabilityForUser.mockResolvedValue(
        createCapabilityResponse("INV-001", "READY", {
          actions: [{ id: "create", label: "Create", enabled: true }],
        })
      )

      const input: ExecuteActionInput = {
        capabilityId: "INV-001",
        actionId: "create",
        params: { buyerName: "Test Buyer" },
      }

      await executeCapabilityAction(input)

      expect(mockResolveCapabilityForUser).toHaveBeenCalledWith("INV-001", {
        entityId: undefined,
        entityType: undefined,
      })
    })
  })

  describe("permissions building", () => {
    it("should build permissions for OWNER role", async () => {
      const mockHandler = vi.fn().mockResolvedValue({ success: true })

      mockAuth.mockResolvedValue(createMockSession())
      mockGetActionHandler.mockReturnValue(
        createMockHandlerEntry("INV-003", "fiscalize", mockHandler)
      )
      mockUserFindUnique.mockResolvedValue({
        id: "user-123",
        systemRole: "USER",
        companies: [{ companyId: "company-456", role: "OWNER" }],
      })
      mockResolveCapabilityForUser.mockResolvedValue(
        createCapabilityResponse("INV-003", "READY", {
          actions: [{ id: "fiscalize", label: "Fiscalize", enabled: true }],
        })
      )

      await executeCapabilityAction({
        capabilityId: "INV-003",
        actionId: "fiscalize",
        entityId: "invoice-123",
      })

      const contextArg = mockHandler.mock.calls[0][0]
      expect(contextArg.permissions).toContain("invoicing:write")
      expect(contextArg.permissions).toContain("fiscalization:write")
      expect(contextArg.permissions).toContain("admin:periods")
    })

    it("should build permissions for VIEWER role", async () => {
      const mockHandler = vi.fn().mockResolvedValue({ success: true })

      mockAuth.mockResolvedValue(createMockSession())
      mockGetActionHandler.mockReturnValue(
        createMockHandlerEntry("INV-003", "fiscalize", mockHandler)
      )
      mockUserFindUnique.mockResolvedValue({
        id: "user-123",
        systemRole: "USER",
        companies: [{ companyId: "company-456", role: "VIEWER" }],
      })
      mockResolveCapabilityForUser.mockResolvedValue(
        createCapabilityResponse("INV-003", "READY", {
          actions: [{ id: "fiscalize", label: "Fiscalize", enabled: true }],
        })
      )

      await executeCapabilityAction({
        capabilityId: "INV-003",
        actionId: "fiscalize",
        entityId: "invoice-123",
      })

      const contextArg = mockHandler.mock.calls[0][0]
      expect(contextArg.permissions).toContain("invoicing:read")
      expect(contextArg.permissions).not.toContain("invoicing:write")
      expect(contextArg.permissions).not.toContain("fiscalization:write")
    })

    it("should add admin permissions for ADMIN system role", async () => {
      const mockHandler = vi.fn().mockResolvedValue({ success: true })

      mockAuth.mockResolvedValue(createMockSession())
      mockGetActionHandler.mockReturnValue(
        createMockHandlerEntry("INV-003", "fiscalize", mockHandler)
      )
      mockUserFindUnique.mockResolvedValue({
        id: "user-123",
        systemRole: "ADMIN",
        companies: [{ companyId: "company-456", role: "VIEWER" }],
      })
      mockResolveCapabilityForUser.mockResolvedValue(
        createCapabilityResponse("INV-003", "READY", {
          actions: [{ id: "fiscalize", label: "Fiscalize", enabled: true }],
        })
      )

      await executeCapabilityAction({
        capabilityId: "INV-003",
        actionId: "fiscalize",
        entityId: "invoice-123",
      })

      const contextArg = mockHandler.mock.calls[0][0]
      expect(contextArg.permissions).toContain("admin:system")
    })
  })
})
