# PHASE 2: Capability-Driven Actions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire ActionButton components to execute server actions based on capability resolution, with proper loading states and error handling.

**Architecture:** Create an Action Handler Registry that maps capability action IDs to existing server actions. The ActionButton component calls a central executor that validates capability state before executing. Actions return standardized results that update UI optimistically.

**Tech Stack:** Next.js 15 Server Actions, React useTransition, Zod validation

---

## Overview

PHASE 1 built the UI projection layer - Control Centers that render capability-driven queues with ActionButton components. The buttons currently do nothing when clicked. PHASE 2 wires them to actual server actions.

**Key Components:**
1. `ActionHandlerRegistry` - Maps `{capabilityId, actionId}` → server action function
2. `executeCapabilityAction` - Server action that validates capability state and dispatches to handler
3. `useCapabilityAction` - Client hook with loading/error/success states
4. Enhanced `ActionButton` - Uses the hook for execution

---

## Task 1: Action Handler Types

**Files:**
- Create: `src/lib/capabilities/actions/types.ts`
- Test: `src/lib/capabilities/actions/__tests__/types.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/capabilities/actions/__tests__/types.test.ts
import { describe, it, expect } from "vitest"
import type { ActionHandler, ActionResult, ActionContext } from "../types"

describe("ActionHandler types", () => {
  it("should define ActionResult structure", () => {
    const successResult: ActionResult = {
      success: true,
      data: { id: "123" },
    }
    expect(successResult.success).toBe(true)

    const errorResult: ActionResult = {
      success: false,
      error: "Something went wrong",
      code: "VALIDATION_ERROR",
    }
    expect(errorResult.success).toBe(false)
    expect(errorResult.error).toBeDefined()
  })

  it("should define ActionContext structure", () => {
    const context: ActionContext = {
      userId: "user-123",
      companyId: "company-456",
      entityId: "entity-789",
      entityType: "EInvoice",
      permissions: ["invoice:create", "invoice:read"],
    }
    expect(context.userId).toBeDefined()
    expect(context.companyId).toBeDefined()
  })

  it("should type ActionHandler correctly", () => {
    const handler: ActionHandler = async (context, params) => {
      return { success: true, data: { id: params?.id } }
    }
    expect(typeof handler).toBe("function")
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/capabilities/actions/__tests__/types.test.ts`
Expected: FAIL with "Cannot find module '../types'"

**Step 3: Write minimal implementation**

```typescript
// src/lib/capabilities/actions/types.ts
/**
 * Capability Action Types
 *
 * Types for executing capability-driven actions.
 *
 * @module capabilities/actions
 * @since PHASE 2 - Capability-Driven Actions
 */

/**
 * Result of executing a capability action.
 */
export interface ActionResult<T = unknown> {
  /** Whether the action succeeded */
  success: boolean
  /** Result data on success */
  data?: T
  /** Error message on failure */
  error?: string
  /** Machine-readable error code */
  code?: ActionErrorCode
  /** Additional error details */
  details?: Record<string, unknown>
}

/**
 * Error codes for action failures.
 */
export type ActionErrorCode =
  | "UNAUTHORIZED"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CAPABILITY_BLOCKED"
  | "PERIOD_LOCKED"
  | "ENTITY_IMMUTABLE"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"

/**
 * Context passed to action handlers.
 */
export interface ActionContext {
  /** Current user ID */
  userId: string
  /** Current company ID */
  companyId: string
  /** Entity ID (if operating on existing entity) */
  entityId?: string
  /** Entity type */
  entityType?: string
  /** User's permissions */
  permissions: string[]
}

/**
 * Parameters for action execution.
 */
export interface ActionParams {
  /** Entity ID */
  id?: string
  /** Additional action-specific params */
  [key: string]: unknown
}

/**
 * Action handler function signature.
 */
export type ActionHandler<T = unknown> = (
  context: ActionContext,
  params?: ActionParams
) => Promise<ActionResult<T>>

/**
 * Registry entry for an action handler.
 */
export interface ActionRegistryEntry {
  /** Capability ID (e.g., "INV-001") */
  capabilityId: string
  /** Action ID (e.g., "create") */
  actionId: string
  /** Handler function */
  handler: ActionHandler
  /** Required permission (validated before execution) */
  permission: string
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/capabilities/actions/__tests__/types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/capabilities/actions/types.ts src/lib/capabilities/actions/__tests__/types.test.ts
git commit -m "feat(capabilities): add action handler types"
```

---

## Task 2: Action Handler Registry

**Files:**
- Create: `src/lib/capabilities/actions/registry.ts`
- Test: `src/lib/capabilities/actions/__tests__/registry.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/capabilities/actions/__tests__/registry.test.ts
import { describe, it, expect, vi } from "vitest"
import { registerActionHandler, getActionHandler, getAllHandlers } from "../registry"
import type { ActionHandler } from "../types"

describe("Action Registry", () => {
  it("should register and retrieve action handlers", () => {
    const mockHandler: ActionHandler = vi.fn().mockResolvedValue({ success: true })

    registerActionHandler({
      capabilityId: "TEST-001",
      actionId: "execute",
      handler: mockHandler,
      permission: "test:execute",
    })

    const retrieved = getActionHandler("TEST-001", "execute")
    expect(retrieved).toBeDefined()
    expect(retrieved?.handler).toBe(mockHandler)
    expect(retrieved?.permission).toBe("test:execute")
  })

  it("should return undefined for unregistered handlers", () => {
    const handler = getActionHandler("UNKNOWN", "action")
    expect(handler).toBeUndefined()
  })

  it("should list all registered handlers", () => {
    const handlers = getAllHandlers()
    expect(Array.isArray(handlers)).toBe(true)
  })

  it("should generate correct registry key", () => {
    const mockHandler: ActionHandler = vi.fn().mockResolvedValue({ success: true })

    registerActionHandler({
      capabilityId: "CAP-001",
      actionId: "do_thing",
      handler: mockHandler,
      permission: "thing:do",
    })

    // Key should be "CAP-001:do_thing"
    const retrieved = getActionHandler("CAP-001", "do_thing")
    expect(retrieved).toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/capabilities/actions/__tests__/registry.test.ts`
Expected: FAIL with "Cannot find module '../registry'"

**Step 3: Write minimal implementation**

```typescript
// src/lib/capabilities/actions/registry.ts
/**
 * Action Handler Registry
 *
 * Central registry mapping capability actions to handler functions.
 * Actions are registered at module load time.
 *
 * @module capabilities/actions
 * @since PHASE 2 - Capability-Driven Actions
 */

import type { ActionRegistryEntry, ActionHandler } from "./types"

/** Registry storage: key is "capabilityId:actionId" */
const registry = new Map<string, ActionRegistryEntry>()

/**
 * Generate registry key from capability and action IDs.
 */
function makeKey(capabilityId: string, actionId: string): string {
  return `${capabilityId}:${actionId}`
}

/**
 * Register an action handler.
 */
export function registerActionHandler(entry: ActionRegistryEntry): void {
  const key = makeKey(entry.capabilityId, entry.actionId)
  registry.set(key, entry)
}

/**
 * Get an action handler by capability and action ID.
 */
export function getActionHandler(
  capabilityId: string,
  actionId: string
): ActionRegistryEntry | undefined {
  const key = makeKey(capabilityId, actionId)
  return registry.get(key)
}

/**
 * Get all registered handlers.
 */
export function getAllHandlers(): ActionRegistryEntry[] {
  return Array.from(registry.values())
}

/**
 * Clear registry (for testing).
 */
export function clearRegistry(): void {
  registry.clear()
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/capabilities/actions/__tests__/registry.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/capabilities/actions/registry.ts src/lib/capabilities/actions/__tests__/registry.test.ts
git commit -m "feat(capabilities): add action handler registry"
```

---

## Task 3: Invoice Action Handlers

**Files:**
- Create: `src/lib/capabilities/actions/handlers/invoice.ts`
- Test: `src/lib/capabilities/actions/handlers/__tests__/invoice.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/capabilities/actions/handlers/__tests__/invoice.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { getActionHandler, clearRegistry } from "../../registry"

// Mock the existing invoice actions
vi.mock("@/app/actions/invoice", () => ({
  createCreditNote: vi.fn().mockResolvedValue({ success: true, data: { id: "cn-123" } }),
  sendInvoiceEmail: vi.fn().mockResolvedValue({ success: true }),
  sendEInvoice: vi.fn().mockResolvedValue({ success: "sent" }),
}))

vi.mock("@/app/actions/fiscalize", () => ({
  fiscalizeInvoice: vi.fn().mockResolvedValue({ success: true, jir: "JIR123" }),
}))

describe("Invoice Action Handlers", () => {
  beforeEach(() => {
    clearRegistry()
    // Re-import to register handlers
    vi.resetModules()
  })

  it("should register INV-003:fiscalize handler", async () => {
    await import("../invoice")
    const entry = getActionHandler("INV-003", "fiscalize")
    expect(entry).toBeDefined()
    expect(entry?.permission).toBe("invoice:fiscalize")
  })

  it("should register INV-002:send_email handler", async () => {
    await import("../invoice")
    const entry = getActionHandler("INV-002", "send_email")
    expect(entry).toBeDefined()
    expect(entry?.permission).toBe("invoice:update")
  })

  it("should register INV-002:send_einvoice handler", async () => {
    await import("../invoice")
    const entry = getActionHandler("INV-002", "send_einvoice")
    expect(entry).toBeDefined()
    expect(entry?.permission).toBe("invoice:update")
  })

  it("should register INV-004:create_credit_note handler", async () => {
    await import("../invoice")
    const entry = getActionHandler("INV-004", "create_credit_note")
    expect(entry).toBeDefined()
    expect(entry?.permission).toBe("invoice:create")
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/capabilities/actions/handlers/__tests__/invoice.test.ts`
Expected: FAIL with "Cannot find module '../invoice'"

**Step 3: Write minimal implementation**

```typescript
// src/lib/capabilities/actions/handlers/invoice.ts
/**
 * Invoice Action Handlers
 *
 * Registers handlers for invoice-related capability actions.
 * Wraps existing server actions with capability context.
 *
 * @module capabilities/actions/handlers
 * @since PHASE 2 - Capability-Driven Actions
 */

import { registerActionHandler } from "../registry"
import type { ActionContext, ActionParams, ActionResult } from "../types"

// Import existing server actions
import { createCreditNote, sendInvoiceEmail, sendEInvoice } from "@/app/actions/invoice"
import { fiscalizeInvoice } from "@/app/actions/fiscalize"

/**
 * INV-002: Send Invoice via Email
 */
registerActionHandler({
  capabilityId: "INV-002",
  actionId: "send_email",
  permission: "invoice:update",
  handler: async (
    _context: ActionContext,
    params?: ActionParams
  ): Promise<ActionResult> => {
    if (!params?.id) {
      return { success: false, error: "Invoice ID required", code: "VALIDATION_ERROR" }
    }
    const result = await sendInvoiceEmail(params.id)
    if ("success" in result && result.success) {
      return { success: true }
    }
    return { success: false, error: result.error || "Failed to send email" }
  },
})

/**
 * INV-002: Send as E-Invoice
 */
registerActionHandler({
  capabilityId: "INV-002",
  actionId: "send_einvoice",
  permission: "invoice:update",
  handler: async (
    _context: ActionContext,
    params?: ActionParams
  ): Promise<ActionResult> => {
    if (!params?.id) {
      return { success: false, error: "Invoice ID required", code: "VALIDATION_ERROR" }
    }
    const result = await sendEInvoice(params.id)
    if ("success" in result) {
      return { success: true, data: result }
    }
    return { success: false, error: result.error || "Failed to send e-invoice" }
  },
})

/**
 * INV-003: Fiscalize Invoice
 */
registerActionHandler({
  capabilityId: "INV-003",
  actionId: "fiscalize",
  permission: "invoice:fiscalize",
  handler: async (
    _context: ActionContext,
    params?: ActionParams
  ): Promise<ActionResult<{ jir: string; zki: string }>> => {
    if (!params?.id) {
      return { success: false, error: "Invoice ID required", code: "VALIDATION_ERROR" }
    }
    const result = await fiscalizeInvoice(params.id)
    if (result.success) {
      return { success: true, data: { jir: result.jir!, zki: result.zki! } }
    }
    return { success: false, error: result.error || "Fiscalization failed" }
  },
})

/**
 * INV-004: Create Credit Note
 */
registerActionHandler({
  capabilityId: "INV-004",
  actionId: "create_credit_note",
  permission: "invoice:create",
  handler: async (
    _context: ActionContext,
    params?: ActionParams
  ): Promise<ActionResult<{ id: string }>> => {
    if (!params?.id) {
      return { success: false, error: "Original invoice ID required", code: "VALIDATION_ERROR" }
    }
    const reason = typeof params.reason === "string" ? params.reason : undefined
    const result = await createCreditNote(params.id, reason)
    if (result.success && result.data) {
      return { success: true, data: { id: result.data.id } }
    }
    return { success: false, error: result.error || "Failed to create credit note" }
  },
})
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/capabilities/actions/handlers/__tests__/invoice.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/capabilities/actions/handlers/invoice.ts src/lib/capabilities/actions/handlers/__tests__/invoice.test.ts
git commit -m "feat(capabilities): add invoice action handlers"
```

---

## Task 4: Action Executor Server Action

**Files:**
- Create: `src/lib/capabilities/actions/executor.ts`
- Test: `src/lib/capabilities/actions/__tests__/executor.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/capabilities/actions/__tests__/executor.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { executeCapabilityAction } from "../executor"
import { registerActionHandler, clearRegistry } from "../registry"

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "user-123" },
  }),
}))

// Mock db
vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: "user-123",
        companies: [{ companyId: "company-456", role: "OWNER" }],
      }),
    },
  },
}))

// Mock capability resolver
vi.mock("@/lib/capabilities/server", () => ({
  resolveCapabilityForUser: vi.fn().mockResolvedValue({
    capability: "TEST-001",
    state: "READY",
    blockers: [],
    actions: [{ id: "execute", label: "Execute", enabled: true }],
  }),
}))

describe("executeCapabilityAction", () => {
  beforeEach(() => {
    clearRegistry()
  })

  it("should execute registered action when capability is READY", async () => {
    const mockHandler = vi.fn().mockResolvedValue({ success: true, data: { id: "123" } })

    registerActionHandler({
      capabilityId: "TEST-001",
      actionId: "execute",
      handler: mockHandler,
      permission: "test:execute",
    })

    const result = await executeCapabilityAction({
      capabilityId: "TEST-001",
      actionId: "execute",
      entityId: "entity-789",
      entityType: "TestEntity",
    })

    expect(result.success).toBe(true)
    expect(mockHandler).toHaveBeenCalled()
  })

  it("should reject unregistered actions", async () => {
    const result = await executeCapabilityAction({
      capabilityId: "UNKNOWN",
      actionId: "unknown",
    })

    expect(result.success).toBe(false)
    expect(result.code).toBe("NOT_FOUND")
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/capabilities/actions/__tests__/executor.test.ts`
Expected: FAIL with "Cannot find module '../executor'"

**Step 3: Write minimal implementation**

```typescript
// src/lib/capabilities/actions/executor.ts
/**
 * Capability Action Executor
 *
 * Server action that validates capability state and executes the
 * appropriate handler. This is the main entry point for UI-triggered actions.
 *
 * @module capabilities/actions
 * @since PHASE 2 - Capability-Driven Actions
 */

"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getActionHandler } from "./registry"
import { resolveCapabilityForUser } from "../server"
import type { ActionResult, ActionContext } from "./types"

// Import handlers to register them
import "./handlers/invoice"

export interface ExecuteActionInput {
  /** Capability ID (e.g., "INV-003") */
  capabilityId: string
  /** Action ID (e.g., "fiscalize") */
  actionId: string
  /** Entity ID (for entity-specific actions) */
  entityId?: string
  /** Entity type */
  entityType?: string
  /** Additional action parameters */
  params?: Record<string, unknown>
}

/**
 * Execute a capability-driven action.
 *
 * 1. Validates user session
 * 2. Resolves capability to verify action is allowed
 * 3. Executes the registered handler
 */
export async function executeCapabilityAction(
  input: ExecuteActionInput
): Promise<ActionResult> {
  const { capabilityId, actionId, entityId, entityType, params } = input

  // 1. Get session
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated", code: "UNAUTHORIZED" }
  }

  // 2. Get action handler
  const entry = getActionHandler(capabilityId, actionId)
  if (!entry) {
    return {
      success: false,
      error: `Unknown action: ${capabilityId}:${actionId}`,
      code: "NOT_FOUND",
    }
  }

  // 3. Get user context
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      companies: {
        select: { companyId: true, role: true },
        take: 1, // Use active company
      },
    },
  })

  if (!user || !user.companies[0]) {
    return { success: false, error: "No company context", code: "UNAUTHORIZED" }
  }

  const companyId = user.companies[0].companyId

  // 4. Resolve capability to verify action is allowed
  const resolution = await resolveCapabilityForUser([capabilityId], {
    entityId,
    entityType,
  })

  const capability = resolution[0]

  if (!capability) {
    return { success: false, error: "Capability resolution failed", code: "INTERNAL_ERROR" }
  }

  if (capability.state === "BLOCKED") {
    const blockerMessage = capability.blockers[0]?.message || "Action is blocked"
    return {
      success: false,
      error: blockerMessage,
      code: "CAPABILITY_BLOCKED",
      details: { blockers: capability.blockers },
    }
  }

  if (capability.state === "UNAUTHORIZED") {
    return { success: false, error: "Not authorized for this action", code: "UNAUTHORIZED" }
  }

  if (capability.state === "MISSING_INPUTS") {
    return {
      success: false,
      error: "Missing required inputs",
      code: "VALIDATION_ERROR",
      details: { inputs: capability.inputs },
    }
  }

  // 5. Verify action is enabled
  const action = capability.actions.find((a) => a.id === actionId)
  if (!action?.enabled) {
    return {
      success: false,
      error: action?.disabledReason || "Action is disabled",
      code: "CAPABILITY_BLOCKED",
    }
  }

  // 6. Build context and execute
  const context: ActionContext = {
    userId: session.user.id,
    companyId,
    entityId,
    entityType,
    permissions: [], // TODO: Load from user permissions
  }

  try {
    return await entry.handler(context, { id: entityId, ...params })
  } catch (error) {
    console.error(`Action ${capabilityId}:${actionId} failed:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Action execution failed",
      code: "INTERNAL_ERROR",
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/capabilities/actions/__tests__/executor.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/capabilities/actions/executor.ts src/lib/capabilities/actions/__tests__/executor.test.ts
git commit -m "feat(capabilities): add action executor server action"
```

---

## Task 5: useCapabilityAction Client Hook

**Files:**
- Create: `src/lib/capabilities/actions/useCapabilityAction.ts`
- Test: `src/lib/capabilities/actions/__tests__/useCapabilityAction.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/lib/capabilities/actions/__tests__/useCapabilityAction.test.tsx
import { describe, it, expect, vi } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useCapabilityAction } from "../useCapabilityAction"

// Mock the executor
vi.mock("../executor", () => ({
  executeCapabilityAction: vi.fn().mockResolvedValue({ success: true, data: { id: "123" } }),
}))

describe("useCapabilityAction", () => {
  it("should return initial state", () => {
    const { result } = renderHook(() =>
      useCapabilityAction({
        capabilityId: "INV-003",
        actionId: "fiscalize",
      })
    )

    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.data).toBeNull()
  })

  it("should have execute function", () => {
    const { result } = renderHook(() =>
      useCapabilityAction({
        capabilityId: "INV-003",
        actionId: "fiscalize",
      })
    )

    expect(typeof result.current.execute).toBe("function")
  })

  it("should set loading state during execution", async () => {
    const { result } = renderHook(() =>
      useCapabilityAction({
        capabilityId: "INV-003",
        actionId: "fiscalize",
      })
    )

    act(() => {
      result.current.execute({ id: "invoice-123" })
    })

    // Should be loading immediately after execute
    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/capabilities/actions/__tests__/useCapabilityAction.test.tsx`
Expected: FAIL with "Cannot find module '../useCapabilityAction'"

**Step 3: Write minimal implementation**

```typescript
// src/lib/capabilities/actions/useCapabilityAction.ts
/**
 * useCapabilityAction Hook
 *
 * Client-side hook for executing capability actions with loading states.
 *
 * @module capabilities/actions
 * @since PHASE 2 - Capability-Driven Actions
 */

"use client"

import { useState, useCallback, useTransition } from "react"
import { executeCapabilityAction, type ExecuteActionInput } from "./executor"
import type { ActionResult } from "./types"

export interface UseCapabilityActionOptions {
  /** Capability ID */
  capabilityId: string
  /** Action ID */
  actionId: string
  /** Entity ID (optional, can be provided at execute time) */
  entityId?: string
  /** Entity type (optional) */
  entityType?: string
  /** Callback on success */
  onSuccess?: (result: ActionResult) => void
  /** Callback on error */
  onError?: (error: string) => void
}

export interface UseCapabilityActionReturn<T = unknown> {
  /** Execute the action */
  execute: (params?: Record<string, unknown>) => Promise<ActionResult<T>>
  /** Whether action is in progress */
  isLoading: boolean
  /** Error message if failed */
  error: string | null
  /** Result data if succeeded */
  data: T | null
  /** Reset state */
  reset: () => void
}

/**
 * Hook for executing capability actions.
 *
 * @example
 * const { execute, isLoading, error } = useCapabilityAction({
 *   capabilityId: "INV-003",
 *   actionId: "fiscalize",
 *   onSuccess: () => toast.success("Invoice fiscalized!"),
 * })
 *
 * // In button onClick:
 * execute({ id: invoiceId })
 */
export function useCapabilityAction<T = unknown>(
  options: UseCapabilityActionOptions
): UseCapabilityActionReturn<T> {
  const { capabilityId, actionId, entityId, entityType, onSuccess, onError } = options

  const [isPending, startTransition] = useTransition()
  const [isExecuting, setIsExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<T | null>(null)

  const execute = useCallback(
    async (params?: Record<string, unknown>): Promise<ActionResult<T>> => {
      setIsExecuting(true)
      setError(null)

      const input: ExecuteActionInput = {
        capabilityId,
        actionId,
        entityId: (params?.id as string) || entityId,
        entityType,
        params,
      }

      try {
        const result = (await executeCapabilityAction(input)) as ActionResult<T>

        if (result.success) {
          setData(result.data ?? null)
          onSuccess?.(result)
        } else {
          setError(result.error || "Action failed")
          onError?.(result.error || "Action failed")
        }

        return result
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unexpected error"
        setError(errorMessage)
        onError?.(errorMessage)
        return { success: false, error: errorMessage, code: "INTERNAL_ERROR" }
      } finally {
        setIsExecuting(false)
      }
    },
    [capabilityId, actionId, entityId, entityType, onSuccess, onError]
  )

  const reset = useCallback(() => {
    setError(null)
    setData(null)
  }, [])

  return {
    execute,
    isLoading: isPending || isExecuting,
    error,
    data,
    reset,
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/capabilities/actions/__tests__/useCapabilityAction.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/capabilities/actions/useCapabilityAction.ts src/lib/capabilities/actions/__tests__/useCapabilityAction.test.tsx
git commit -m "feat(capabilities): add useCapabilityAction hook"
```

---

## Task 6: Enhanced ActionButton Component

**Files:**
- Modify: `src/components/capability/ActionButton.tsx`
- Test: `src/components/capability/__tests__/ActionButton.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/components/capability/__tests__/ActionButton.test.tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { ActionButton } from "../ActionButton"
import type { CapabilityAction } from "../types"

// Mock the hook
vi.mock("@/lib/capabilities/actions/useCapabilityAction", () => ({
  useCapabilityAction: vi.fn().mockReturnValue({
    execute: vi.fn().mockResolvedValue({ success: true }),
    isLoading: false,
    error: null,
  }),
}))

describe("ActionButton", () => {
  const baseAction: CapabilityAction = {
    id: "fiscalize",
    label: "Fiscalize",
    enabled: true,
    primary: true,
  }

  it("should render action label", () => {
    render(
      <ActionButton action={baseAction} capabilityId="INV-003" entityId="inv-123" />
    )
    expect(screen.getByText("Fiscalize")).toBeInTheDocument()
  })

  it("should be disabled when action is disabled", () => {
    const disabledAction = { ...baseAction, enabled: false }
    render(
      <ActionButton action={disabledAction} capabilityId="INV-003" entityId="inv-123" />
    )
    expect(screen.getByRole("button")).toBeDisabled()
  })

  it("should call execute on click when enabled", async () => {
    const mockExecute = vi.fn().mockResolvedValue({ success: true })
    vi.mocked(await import("@/lib/capabilities/actions/useCapabilityAction")).useCapabilityAction.mockReturnValue({
      execute: mockExecute,
      isLoading: false,
      error: null,
      data: null,
      reset: vi.fn(),
    })

    render(
      <ActionButton action={baseAction} capabilityId="INV-003" entityId="inv-123" />
    )

    fireEvent.click(screen.getByRole("button"))
    expect(mockExecute).toHaveBeenCalledWith({ id: "inv-123" })
  })

  it("should show loading state", () => {
    vi.mocked(require("@/lib/capabilities/actions/useCapabilityAction").useCapabilityAction).mockReturnValue({
      execute: vi.fn(),
      isLoading: true,
      error: null,
      data: null,
      reset: vi.fn(),
    })

    render(
      <ActionButton action={baseAction} capabilityId="INV-003" entityId="inv-123" />
    )

    // Button should show loading indicator or be disabled
    expect(screen.getByRole("button")).toBeDisabled()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/capability/__tests__/ActionButton.test.tsx`
Expected: FAIL (current ActionButton doesn't use the hook or accept entityId)

**Step 3: Write minimal implementation**

```typescript
// src/components/capability/ActionButton.tsx
/**
 * Action Button
 *
 * Renders an action button that executes capability-driven actions.
 * Uses useCapabilityAction hook for execution with loading/error states.
 *
 * @module components/capability
 * @since Control Center Shells
 * @updated PHASE 2 - Capability-Driven Actions
 */

"use client"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Loader2 } from "lucide-react"
import { useCapabilityAction } from "@/lib/capabilities/actions/useCapabilityAction"
import type { CapabilityAction } from "./types"
import { useToast } from "@/components/ui/use-toast"

export interface ActionButtonProps {
  /** The action to render */
  action: CapabilityAction
  /** Capability ID for action execution */
  capabilityId: string
  /** Entity ID to operate on */
  entityId?: string
  /** Entity type */
  entityType?: string
  /** Show diagnostics overlay */
  showDiagnostics?: boolean
  /** Additional action parameters */
  params?: Record<string, unknown>
  /** Callback after successful execution */
  onSuccess?: () => void
  /** Callback after failed execution */
  onError?: (error: string) => void
}

export function ActionButton({
  action,
  capabilityId,
  entityId,
  entityType,
  showDiagnostics = false,
  params,
  onSuccess,
  onError,
}: ActionButtonProps) {
  const { toast } = useToast()

  const { execute, isLoading, error } = useCapabilityAction({
    capabilityId,
    actionId: action.id,
    entityId,
    entityType,
    onSuccess: () => {
      toast({
        title: "Success",
        description: `${action.label} completed successfully`,
      })
      onSuccess?.()
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err,
        variant: "destructive",
      })
      onError?.(err)
    },
  })

  const handleClick = async () => {
    if (action.enabled && !isLoading) {
      await execute({ id: entityId, ...params })
    }
  }

  const isDisabled = !action.enabled || isLoading

  const button = (
    <Button
      variant={action.primary ? "default" : "outline"}
      disabled={isDisabled}
      onClick={handleClick}
      className="relative"
    >
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {action.label}
      {showDiagnostics && (
        <span className="absolute -top-2 -right-2 text-[10px] font-mono bg-muted px-1 rounded">
          {capabilityId}:{action.id}
        </span>
      )}
    </Button>
  )

  // Show tooltip for disabled reason or error
  const tooltipMessage = error || (!action.enabled && action.disabledReason)

  if (tooltipMessage) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p className={error ? "text-destructive" : ""}>{tooltipMessage}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return button
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/capability/__tests__/ActionButton.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/capability/ActionButton.tsx src/components/capability/__tests__/ActionButton.test.tsx
git commit -m "feat(capabilities): enhance ActionButton with action execution"
```

---

## Task 7: Update QueueItem to Pass Entity Context

**Files:**
- Modify: `src/components/capability/QueueItem.tsx`

**Step 1: Read current implementation**

Review current QueueItem.tsx to understand how ActionButton is used.

**Step 2: Write the update**

```typescript
// src/components/capability/QueueItem.tsx
/**
 * Queue Item
 *
 * Renders a single item in a queue with its capability state.
 * Now passes entity context to ActionButton for execution.
 *
 * @module components/capability
 * @since Control Center Shells
 * @updated PHASE 2 - Capability-Driven Actions
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CapabilityStateIndicator } from "./CapabilityStateIndicator"
import { BlockerDisplay } from "./BlockerDisplay"
import { ActionButton } from "./ActionButton"
import type { QueueItem as QueueItemType } from "./types"

interface Props {
  item: QueueItemType
  showDiagnostics?: boolean
  /** Callback when any action completes successfully */
  onActionComplete?: () => void
}

export function QueueItemCard({ item, showDiagnostics = false, onActionComplete }: Props) {
  // Find the primary capability (first READY, or first in list)
  const primaryCapability =
    item.capabilities.find((c) => c.state === "READY") || item.capabilities[0]

  return (
    <Card className="relative">
      {showDiagnostics && (
        <div className="absolute top-2 right-2 text-[10px] font-mono bg-muted px-2 py-1 rounded">
          {item.type}:{item.id.slice(0, 8)}
        </div>
      )}
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{item.title}</CardTitle>
          {primaryCapability && <CapabilityStateIndicator state={primaryCapability.state} />}
        </div>
        <p className="text-sm text-muted-foreground">
          Status: {item.status} | {new Date(item.timestamp).toLocaleDateString()}
        </p>
      </CardHeader>
      <CardContent>
        {/* Show blockers if any capability is blocked */}
        {item.capabilities.some((c) => c.state === "BLOCKED") && (
          <div className="mb-4">
            <BlockerDisplay
              blockers={item.capabilities.flatMap((c) => c.blockers)}
              showResolution
            />
          </div>
        )}

        {/* Show available actions with entity context */}
        <div className="flex flex-wrap gap-2">
          {item.capabilities.map((cap) =>
            cap.actions
              .filter((a) => cap.state === "READY" || !a.enabled)
              .map((action) => (
                <ActionButton
                  key={`${cap.capability}-${action.id}`}
                  action={action}
                  capabilityId={cap.capability}
                  entityId={item.id}
                  entityType={item.type}
                  showDiagnostics={showDiagnostics}
                  onSuccess={onActionComplete}
                />
              ))
          )}
        </div>

        {/* Diagnostics panel */}
        {showDiagnostics && (
          <details className="mt-4 text-xs">
            <summary className="cursor-pointer font-mono text-muted-foreground">
              Capability Diagnostics
            </summary>
            <pre className="mt-2 p-2 bg-muted rounded overflow-auto max-h-48">
              {JSON.stringify(item.capabilities, null, 2)}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  )
}
```

**Step 3: Commit**

```bash
git add src/components/capability/QueueItem.tsx
git commit -m "feat(capabilities): pass entity context to ActionButton in QueueItem"
```

---

## Task 8: Barrel Export for Actions Module

**Files:**
- Create: `src/lib/capabilities/actions/index.ts`
- Modify: `src/lib/capabilities/index.ts`

**Step 1: Create actions barrel export**

```typescript
// src/lib/capabilities/actions/index.ts
/**
 * Capability Actions Module
 *
 * Exports for executing capability-driven actions.
 *
 * @module capabilities/actions
 * @since PHASE 2 - Capability-Driven Actions
 */

export * from "./types"
export * from "./registry"
export { executeCapabilityAction, type ExecuteActionInput } from "./executor"
export { useCapabilityAction, type UseCapabilityActionOptions } from "./useCapabilityAction"

// Import handlers to ensure registration
import "./handlers/invoice"
```

**Step 2: Update main capabilities barrel**

```typescript
// Add to src/lib/capabilities/index.ts
export * from "./actions"
```

**Step 3: Commit**

```bash
git add src/lib/capabilities/actions/index.ts src/lib/capabilities/index.ts
git commit -m "feat(capabilities): add barrel exports for actions module"
```

---

## Task 9: Integration Tests

**Files:**
- Create: `src/lib/capabilities/actions/__tests__/integration.test.ts`

**Step 1: Write integration test**

```typescript
// src/lib/capabilities/actions/__tests__/integration.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { getActionHandler, clearRegistry } from "../registry"

// Re-import to register all handlers
vi.resetModules()

describe("Action Handlers Integration", () => {
  beforeEach(async () => {
    clearRegistry()
    // Import handlers to register
    await import("../handlers/invoice")
  })

  it("should have all INV-002 handlers registered", () => {
    expect(getActionHandler("INV-002", "send_email")).toBeDefined()
    expect(getActionHandler("INV-002", "send_einvoice")).toBeDefined()
  })

  it("should have INV-003 fiscalize handler", () => {
    expect(getActionHandler("INV-003", "fiscalize")).toBeDefined()
  })

  it("should have INV-004 credit note handler", () => {
    expect(getActionHandler("INV-004", "create_credit_note")).toBeDefined()
  })

  it("should have correct permissions for each handler", () => {
    const fiscalize = getActionHandler("INV-003", "fiscalize")
    expect(fiscalize?.permission).toBe("invoice:fiscalize")

    const sendEmail = getActionHandler("INV-002", "send_email")
    expect(sendEmail?.permission).toBe("invoice:update")

    const creditNote = getActionHandler("INV-004", "create_credit_note")
    expect(creditNote?.permission).toBe("invoice:create")
  })
})
```

**Step 2: Run tests**

Run: `npm test -- src/lib/capabilities/actions/__tests__/integration.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/capabilities/actions/__tests__/integration.test.ts
git commit -m "test(capabilities): add integration tests for action handlers"
```

---

## Task 10: Final Verification

**Step 1: Run all tests**

```bash
npm test
```

Expected: All tests pass

**Step 2: TypeScript check**

```bash
npm run type-check
```

Expected: No type errors

**Step 3: Lint check**

```bash
npm run lint
```

Expected: No lint errors

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: PHASE 2 - Capability-Driven Actions complete

- Action Handler Registry for mapping capability actions to server actions
- executeCapabilityAction server action with capability validation
- useCapabilityAction hook with loading/error states
- Enhanced ActionButton with integrated execution
- Invoice action handlers (fiscalize, send_email, send_einvoice, credit_note)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary

**Files Created:**
- `src/lib/capabilities/actions/types.ts` - Action types
- `src/lib/capabilities/actions/registry.ts` - Handler registry
- `src/lib/capabilities/actions/handlers/invoice.ts` - Invoice handlers
- `src/lib/capabilities/actions/executor.ts` - Server action executor
- `src/lib/capabilities/actions/useCapabilityAction.ts` - Client hook
- `src/lib/capabilities/actions/index.ts` - Barrel exports

**Files Modified:**
- `src/components/capability/ActionButton.tsx` - Enhanced with execution
- `src/components/capability/QueueItem.tsx` - Pass entity context
- `src/lib/capabilities/index.ts` - Export actions module

**Architecture:**
```
ActionButton (click)
    ↓
useCapabilityAction (hook)
    ↓
executeCapabilityAction (server action)
    ↓
1. Validate session
2. Resolve capability → verify READY state
3. Get handler from registry
4. Execute handler
    ↓
ActionResult → UI update
```

**Next Phase (PHASE 3):** Real-time capability state updates via server-sent events or React Query.
