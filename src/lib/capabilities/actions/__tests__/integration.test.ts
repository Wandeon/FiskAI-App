/**
 * Capability Actions Integration Tests
 *
 * Integration tests that verify the action system works as a cohesive unit:
 * - Handler registration via imports
 * - Registry lookups for registered handlers
 * - Executor validation flow with mocked dependencies
 *
 * @module capabilities/actions
 * @since PHASE 2 - Capability-Driven Actions
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import type { CapabilityResponse, CapabilityState, CapabilityBlocker } from "../../types"
import type { ActionContext, ActionResult, ActionRegistryEntry } from "../types"

// Mock dependencies before importing the modules
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

vi.mock("../../server", () => ({
  resolveCapabilityForUser: vi.fn(),
}))

// Mock the invoice server actions that handlers use
vi.mock("@/app/actions/invoice", () => ({
  sendInvoiceEmail: vi.fn(),
  sendEInvoice: vi.fn(),
  createCreditNote: vi.fn(),
  issueInvoice: vi.fn(),
  markInvoiceAsPaid: vi.fn(),
}))

// Mock expense server actions
vi.mock("@/app/actions/expense", () => ({
  markExpenseAsPaid: vi.fn(),
}))

// Mock banking server actions
vi.mock("@/app/actions/banking", () => ({
  matchTransaction: vi.fn(),
  ignoreTransaction: vi.fn(),
}))

vi.mock("@/app/actions/fiscalize", () => ({
  fiscalizeInvoice: vi.fn(),
}))

// Import the modules after mocks are set up
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { resolveCapabilityForUser } from "../../server"
import { sendInvoiceEmail, sendEInvoice, createCreditNote } from "@/app/actions/invoice"
import { fiscalizeInvoice } from "@/app/actions/fiscalize"
import { registerActionHandler, getActionHandler, getAllHandlers, clearRegistry } from "../registry"
import { executeCapabilityAction } from "../executor"

// Cast mocks for type safety
const mockAuth = auth as ReturnType<typeof vi.fn>
const mockResolveCapabilityForUser = resolveCapabilityForUser as ReturnType<typeof vi.fn>
const mockUserFindUnique = db.user.findUnique as ReturnType<typeof vi.fn>
const mockSendInvoiceEmail = sendInvoiceEmail as ReturnType<typeof vi.fn>
const mockSendEInvoice = sendEInvoice as ReturnType<typeof vi.fn>
const mockCreateCreditNote = createCreditNote as ReturnType<typeof vi.fn>
const mockFiscalizeInvoice = fiscalizeInvoice as ReturnType<typeof vi.fn>

// Helper to create mock session
function createMockSession(userId = "user-123") {
  return {
    user: { id: userId, email: "test@example.com" },
    expires: new Date(Date.now() + 86400000).toISOString(),
  }
}

// Helper to create mock user with company
function createMockUser(userId = "user-123", companyId = "company-456", role = "OWNER") {
  return {
    id: userId,
    systemRole: "USER",
    companies: [
      {
        companyId,
        role,
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
    actions: options.actions || [],
    resolvedAt: new Date().toISOString(),
  }
}

// Helper to create mock handler
function createMockHandler(
  result: ActionResult = { success: true }
): (context: ActionContext, params?: Record<string, unknown>) => Promise<ActionResult> {
  return vi.fn().mockResolvedValue(result)
}

// Helper to create a test handler entry
function createTestHandlerEntry(
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

describe("Capability Actions Integration", () => {
  describe("Invoice Handler Registration", () => {
    // Note: Handlers are registered when the module is imported
    // The executor.ts imports ./handlers/invoice which triggers registration
    // Since we import executeCapabilityAction, handlers are already registered

    it("should have all handlers registered after module import", () => {
      const handlers = getAllHandlers()
      const handlerKeys = handlers.map((h) => `${h.capabilityId}:${h.actionId}`)

      // Invoice handlers
      expect(handlerKeys).toContain("INV-002:send_email")
      expect(handlerKeys).toContain("INV-002:send_einvoice")
      expect(handlerKeys).toContain("INV-003:fiscalize")
      expect(handlerKeys).toContain("INV-004:issue")
      expect(handlerKeys).toContain("INV-004:create_credit_note")
      expect(handlerKeys).toContain("INV-008:mark_paid")
      // Expense handlers
      expect(handlerKeys).toContain("EXP-004:mark_paid")
      // Bank handlers
      expect(handlerKeys).toContain("BNK-005:manual_match")
      expect(handlerKeys).toContain("BNK-007:ignore")
    })

    it("should register all action handlers", () => {
      const handlers = getAllHandlers()
      // 6 invoice + 1 expense + 2 bank = 9 handlers
      expect(handlers.length).toBe(9)
    })

    it("should set correct permissions for each handler", () => {
      const sendEmailHandler = getActionHandler("INV-002", "send_email")
      const sendEInvoiceHandler = getActionHandler("INV-002", "send_einvoice")
      const fiscalizeHandler = getActionHandler("INV-003", "fiscalize")
      const creditNoteHandler = getActionHandler("INV-004", "create_credit_note")

      expect(sendEmailHandler?.permission).toBe("invoice:update")
      expect(sendEInvoiceHandler?.permission).toBe("invoice:update")
      expect(fiscalizeHandler?.permission).toBe("invoice:fiscalize")
      expect(creditNoteHandler?.permission).toBe("invoice:create")
    })
  })

  describe("Registry Retrieval", () => {
    it("should return handler for valid capability and action", () => {
      const handler = getActionHandler("INV-003", "fiscalize")

      expect(handler).toBeDefined()
      expect(handler?.capabilityId).toBe("INV-003")
      expect(handler?.actionId).toBe("fiscalize")
    })

    it("should return undefined for invalid capability ID", () => {
      const handler = getActionHandler("INVALID-001", "fiscalize")

      expect(handler).toBeUndefined()
    })

    it("should return undefined for invalid action ID", () => {
      const handler = getActionHandler("INV-003", "invalid_action")

      expect(handler).toBeUndefined()
    })

    it("should return undefined for non-existent capability-action combination", () => {
      // INV-003 has fiscalize but not send_email
      const handler = getActionHandler("INV-003", "send_email")

      expect(handler).toBeUndefined()
    })

    it("should return all handlers via getAllHandlers", () => {
      const handlers = getAllHandlers()

      expect(Array.isArray(handlers)).toBe(true)
      expect(handlers.length).toBeGreaterThan(0)

      // Verify each handler has required properties
      handlers.forEach((handler) => {
        expect(handler).toHaveProperty("capabilityId")
        expect(handler).toHaveProperty("actionId")
        expect(handler).toHaveProperty("handler")
        expect(handler).toHaveProperty("permission")
        expect(typeof handler.handler).toBe("function")
      })
    })
  })

  describe("Executor Session Validation", () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it("should return UNAUTHORIZED when session is missing", async () => {
      mockAuth.mockResolvedValue(null)

      const result = await executeCapabilityAction({
        capabilityId: "INV-003",
        actionId: "fiscalize",
        entityId: "invoice-123",
      })

      expect(result.success).toBe(false)
      expect(result.code).toBe("UNAUTHORIZED")
      expect(result.error).toBe("Authentication required")
    })

    it("should return UNAUTHORIZED when session has no user ID", async () => {
      mockAuth.mockResolvedValue({
        user: { email: "test@example.com" },
        expires: new Date().toISOString(),
      })

      const result = await executeCapabilityAction({
        capabilityId: "INV-003",
        actionId: "fiscalize",
        entityId: "invoice-123",
      })

      expect(result.success).toBe(false)
      expect(result.code).toBe("UNAUTHORIZED")
    })

    it("should return UNAUTHORIZED when user has no company", async () => {
      mockAuth.mockResolvedValue(createMockSession())
      mockUserFindUnique.mockResolvedValue({
        id: "user-123",
        systemRole: "USER",
        companies: [],
      })

      const result = await executeCapabilityAction({
        capabilityId: "INV-003",
        actionId: "fiscalize",
        entityId: "invoice-123",
      })

      expect(result.success).toBe(false)
      expect(result.code).toBe("UNAUTHORIZED")
      expect(result.error).toBe("No company context available")
    })
  })

  describe("Executor Handler Lookup", () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it("should return NOT_FOUND for unknown capability/action", async () => {
      mockAuth.mockResolvedValue(createMockSession())

      const result = await executeCapabilityAction({
        capabilityId: "UNKNOWN-999",
        actionId: "unknown_action",
      })

      expect(result.success).toBe(false)
      expect(result.code).toBe("NOT_FOUND")
      expect(result.error).toContain("Action handler not found")
      expect(result.error).toContain("UNKNOWN-999:unknown_action")
    })

    it("should return NOT_FOUND for valid capability but invalid action", async () => {
      mockAuth.mockResolvedValue(createMockSession())

      const result = await executeCapabilityAction({
        capabilityId: "INV-003",
        actionId: "nonexistent_action",
      })

      expect(result.success).toBe(false)
      expect(result.code).toBe("NOT_FOUND")
    })
  })

  describe("Executor Capability State Validation", () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it("should validate capability state before execution - BLOCKED", async () => {
      mockAuth.mockResolvedValue(createMockSession())
      mockUserFindUnique.mockResolvedValue(createMockUser())
      mockResolveCapabilityForUser.mockResolvedValue(
        createCapabilityResponse("INV-003", "BLOCKED", {
          blockers: [
            {
              type: "PERIOD_LOCKED",
              message: "Period is locked for modifications",
              resolution: "Contact admin",
            },
          ],
        })
      )

      const result = await executeCapabilityAction({
        capabilityId: "INV-003",
        actionId: "fiscalize",
        entityId: "invoice-123",
      })

      expect(result.success).toBe(false)
      expect(result.code).toBe("CAPABILITY_BLOCKED")
      expect(result.error).toBe("Period is locked for modifications")
      expect(result.details).toEqual({
        blockerType: "PERIOD_LOCKED",
        resolution: "Contact admin",
      })
    })

    it("should validate capability state before execution - UNAUTHORIZED", async () => {
      mockAuth.mockResolvedValue(createMockSession())
      mockUserFindUnique.mockResolvedValue(createMockUser())
      mockResolveCapabilityForUser.mockResolvedValue(
        createCapabilityResponse("INV-003", "UNAUTHORIZED")
      )

      const result = await executeCapabilityAction({
        capabilityId: "INV-003",
        actionId: "fiscalize",
        entityId: "invoice-123",
      })

      expect(result.success).toBe(false)
      expect(result.code).toBe("UNAUTHORIZED")
      expect(result.error).toBe("Not authorized to perform this action")
    })

    it("should validate capability state before execution - MISSING_INPUTS", async () => {
      mockAuth.mockResolvedValue(createMockSession())
      mockUserFindUnique.mockResolvedValue(createMockUser())
      mockResolveCapabilityForUser.mockResolvedValue(
        createCapabilityResponse("INV-003", "MISSING_INPUTS")
      )

      const result = await executeCapabilityAction({
        capabilityId: "INV-003",
        actionId: "fiscalize",
        entityId: "invoice-123",
      })

      expect(result.success).toBe(false)
      expect(result.code).toBe("VALIDATION_ERROR")
      expect(result.error).toBe("Required inputs are missing")
    })

    it("should validate action is enabled before execution", async () => {
      mockAuth.mockResolvedValue(createMockSession())
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

      const result = await executeCapabilityAction({
        capabilityId: "INV-003",
        actionId: "fiscalize",
        entityId: "invoice-123",
      })

      expect(result.success).toBe(false)
      expect(result.code).toBe("CAPABILITY_BLOCKED")
      expect(result.error).toBe("Invoice is already fiscalized")
    })

    it("should block execution when action not in actions list", async () => {
      mockAuth.mockResolvedValue(createMockSession())
      mockUserFindUnique.mockResolvedValue(createMockUser())
      mockResolveCapabilityForUser.mockResolvedValue(
        createCapabilityResponse("INV-003", "READY", {
          actions: [
            {
              id: "other_action",
              label: "Other",
              enabled: true,
            },
          ],
        })
      )

      const result = await executeCapabilityAction({
        capabilityId: "INV-003",
        actionId: "fiscalize",
        entityId: "invoice-123",
      })

      expect(result.success).toBe(false)
      expect(result.code).toBe("CAPABILITY_BLOCKED")
      expect(result.error).toBe("Action is not available")
    })
  })

  describe("Handler Execution Integration", () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it("should execute fiscalize handler and return JIR/ZKI", async () => {
      const fiscalizeHandler = getActionHandler("INV-003", "fiscalize")
      expect(fiscalizeHandler).toBeDefined()

      mockFiscalizeInvoice.mockResolvedValue({
        success: true,
        jir: "test-jir-12345",
        zki: "test-zki-67890",
      })

      const result = await fiscalizeHandler!.handler(
        {
          userId: "user-123",
          companyId: "company-456",
          permissions: ["invoice:fiscalize"],
        },
        { id: "invoice-123" }
      )

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        jir: "test-jir-12345",
        zki: "test-zki-67890",
      })
      expect(mockFiscalizeInvoice).toHaveBeenCalledWith("invoice-123")
    })

    it("should execute send_email handler successfully", async () => {
      const sendEmailHandler = getActionHandler("INV-002", "send_email")
      expect(sendEmailHandler).toBeDefined()

      mockSendInvoiceEmail.mockResolvedValue({
        success: "Email sent successfully",
      })

      const result = await sendEmailHandler!.handler(
        {
          userId: "user-123",
          companyId: "company-456",
          permissions: ["invoice:update"],
        },
        { id: "invoice-123" }
      )

      expect(result.success).toBe(true)
      expect(mockSendInvoiceEmail).toHaveBeenCalledWith("invoice-123")
    })

    it("should execute send_einvoice handler successfully", async () => {
      const sendEInvoiceHandler = getActionHandler("INV-002", "send_einvoice")
      expect(sendEInvoiceHandler).toBeDefined()

      mockSendEInvoice.mockResolvedValue({
        success: "E-invoice sent successfully",
      })

      const result = await sendEInvoiceHandler!.handler(
        {
          userId: "user-123",
          companyId: "company-456",
          permissions: ["invoice:update"],
        },
        { id: "invoice-123" }
      )

      expect(result.success).toBe(true)
      expect(mockSendEInvoice).toHaveBeenCalledWith("invoice-123")
    })

    it("should execute create_credit_note handler successfully", async () => {
      const creditNoteHandler = getActionHandler("INV-004", "create_credit_note")
      expect(creditNoteHandler).toBeDefined()

      mockCreateCreditNote.mockResolvedValue({
        success: true,
        data: { id: "credit-note-789" },
      })

      const result = await creditNoteHandler!.handler(
        {
          userId: "user-123",
          companyId: "company-456",
          permissions: ["invoice:create"],
        },
        { id: "invoice-123", reason: "Customer refund" }
      )

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ id: "credit-note-789" })
      expect(mockCreateCreditNote).toHaveBeenCalledWith("invoice-123", "Customer refund")
    })

    it("should return VALIDATION_ERROR when invoice ID is missing", async () => {
      const fiscalizeHandler = getActionHandler("INV-003", "fiscalize")
      expect(fiscalizeHandler).toBeDefined()

      const result = await fiscalizeHandler!.handler(
        {
          userId: "user-123",
          companyId: "company-456",
          permissions: ["invoice:fiscalize"],
        },
        {} // No id provided
      )

      expect(result.success).toBe(false)
      expect(result.code).toBe("VALIDATION_ERROR")
      expect(result.error).toBe("Invoice ID required")
    })

    it("should handle fiscalize handler failure", async () => {
      const fiscalizeHandler = getActionHandler("INV-003", "fiscalize")
      expect(fiscalizeHandler).toBeDefined()

      mockFiscalizeInvoice.mockResolvedValue({
        success: false,
        error: "Fiscal service unavailable",
      })

      const result = await fiscalizeHandler!.handler(
        {
          userId: "user-123",
          companyId: "company-456",
          permissions: ["invoice:fiscalize"],
        },
        { id: "invoice-123" }
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe("Fiscal service unavailable")
    })

    it("should handle send_email handler failure", async () => {
      const sendEmailHandler = getActionHandler("INV-002", "send_email")
      expect(sendEmailHandler).toBeDefined()

      mockSendInvoiceEmail.mockResolvedValue({
        error: "SMTP connection failed",
      })

      const result = await sendEmailHandler!.handler(
        {
          userId: "user-123",
          companyId: "company-456",
          permissions: ["invoice:update"],
        },
        { id: "invoice-123" }
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe("SMTP connection failed")
    })
  })

  describe("Registry Management", () => {
    // Store handlers to restore after tests that modify registry
    let savedHandlers: ActionRegistryEntry[] = []

    beforeEach(() => {
      // Save current handlers before each test
      savedHandlers = getAllHandlers()
    })

    afterEach(() => {
      // Restore handlers after each test
      clearRegistry()
      savedHandlers.forEach((entry) => registerActionHandler(entry))
    })

    it("should clear and restore handlers correctly", () => {
      // Get current handlers count
      const originalCount = getAllHandlers().length
      expect(originalCount).toBe(9) // 6 invoice + 1 expense + 2 bank = 9 handlers

      // Clear registry
      clearRegistry()
      expect(getAllHandlers().length).toBe(0)

      // Register a test handler
      const testEntry = createTestHandlerEntry("TEST-001", "test_action")
      registerActionHandler(testEntry)
      expect(getAllHandlers().length).toBe(1)

      // Clear again
      clearRegistry()
      expect(getAllHandlers().length).toBe(0)
    })

    it("should overwrite existing handler with same key", () => {
      const entry1: ActionRegistryEntry = {
        capabilityId: "TEST-OVERWRITE",
        actionId: "action",
        handler: createMockHandler({ success: true, data: { version: 1 } }),
        permission: "test:v1",
      }

      const entry2: ActionRegistryEntry = {
        capabilityId: "TEST-OVERWRITE",
        actionId: "action",
        handler: createMockHandler({ success: true, data: { version: 2 } }),
        permission: "test:v2",
      }

      registerActionHandler(entry1)
      expect(getActionHandler("TEST-OVERWRITE", "action")?.permission).toBe("test:v1")

      registerActionHandler(entry2)
      expect(getActionHandler("TEST-OVERWRITE", "action")?.permission).toBe("test:v2")
    })
  })

  describe("Full Execution Flow", () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it("should execute full flow: auth -> lookup -> capability check -> handler", async () => {
      // Set up all mocks for successful execution
      mockAuth.mockResolvedValue(createMockSession("user-full-flow"))
      mockUserFindUnique.mockResolvedValue(createMockUser("user-full-flow", "company-full-flow"))
      mockResolveCapabilityForUser.mockResolvedValue(
        createCapabilityResponse("INV-003", "READY", {
          actions: [{ id: "fiscalize", label: "Fiscalize", enabled: true }],
        })
      )
      mockFiscalizeInvoice.mockResolvedValue({
        success: true,
        jir: "full-flow-jir",
        zki: "full-flow-zki",
      })

      const result = await executeCapabilityAction({
        capabilityId: "INV-003",
        actionId: "fiscalize",
        entityId: "invoice-full-flow",
      })

      // Verify auth was called
      expect(mockAuth).toHaveBeenCalled()

      // Verify user lookup was called
      expect(mockUserFindUnique).toHaveBeenCalled()

      // Verify capability resolution was called with correct params
      expect(mockResolveCapabilityForUser).toHaveBeenCalledWith("INV-003", {
        entityId: "invoice-full-flow",
        entityType: undefined,
      })

      // Verify handler was called
      expect(mockFiscalizeInvoice).toHaveBeenCalledWith("invoice-full-flow")

      // Verify result
      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        jir: "full-flow-jir",
        zki: "full-flow-zki",
      })
    })

    it("should short-circuit on auth failure without calling subsequent steps", async () => {
      mockAuth.mockResolvedValue(null)

      await executeCapabilityAction({
        capabilityId: "INV-003",
        actionId: "fiscalize",
        entityId: "invoice-123",
      })

      // Auth was called
      expect(mockAuth).toHaveBeenCalled()

      // But these should NOT be called
      expect(mockUserFindUnique).not.toHaveBeenCalled()
      expect(mockResolveCapabilityForUser).not.toHaveBeenCalled()
      expect(mockFiscalizeInvoice).not.toHaveBeenCalled()
    })

    it("should short-circuit on capability blocked without calling handler", async () => {
      mockAuth.mockResolvedValue(createMockSession())
      mockUserFindUnique.mockResolvedValue(createMockUser())
      mockResolveCapabilityForUser.mockResolvedValue(
        createCapabilityResponse("INV-003", "BLOCKED", {
          blockers: [{ type: "PERIOD_LOCKED", message: "Locked", resolution: "Unlock" }],
        })
      )

      await executeCapabilityAction({
        capabilityId: "INV-003",
        actionId: "fiscalize",
        entityId: "invoice-123",
      })

      // Auth and user lookup were called
      expect(mockAuth).toHaveBeenCalled()
      expect(mockUserFindUnique).toHaveBeenCalled()
      expect(mockResolveCapabilityForUser).toHaveBeenCalled()

      // But handler should NOT be called
      expect(mockFiscalizeInvoice).not.toHaveBeenCalled()
    })
  })
})
