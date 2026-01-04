# PHASE 4: Capability Batch Actions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add batch/bulk action support to the capability system, allowing users to select multiple items and execute the same action on all of them.

**Architecture:** Build on PHASE 2's single-action executor with a batch wrapper that validates capabilities for all entities, executes in parallel with progress tracking, and aggregates results. Selection state is managed via React context to coordinate between list components and a floating action bar.

**Tech Stack:** React 19, Next.js 15 Server Actions, SWR for cache invalidation, TypeScript

---

## Context

**PHASE 1-3 Complete:**

- Control Center shells render capability state (PHASE 1)
- `executeCapabilityAction` handles single-entity actions (PHASE 2)
- `useCapabilityResolution` and `revalidateCapabilityResolution` handle cache (PHASE 3)

**Existing Components:**

- `ActionButton` - Executes single action on single entity
- `QueueRenderer` + `QueueItemCard` - Renders queue items with actions
- `useCapabilityAction` - Client hook for single actions
- `DataTable` - Generic table with keyboard navigation (no selection)

**Goal:** Users can select multiple items from a queue, then execute the same action on all selected items.

---

## Task 1: Batch Action Types

**Files:**

- Create: `src/lib/capabilities/actions/batch-types.ts`
- Test: `src/lib/capabilities/actions/__tests__/batch-types.test.ts`

**Step 1: Write the failing test**

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `npm test src/lib/capabilities/actions/__tests__/batch-types.test.ts`
Expected: FAIL - Cannot find module '../batch-types'

**Step 3: Write minimal implementation**

```typescript
// src/lib/capabilities/actions/batch-types.ts
/**
 * Batch Action Types
 *
 * Types for executing capability actions on multiple entities.
 *
 * @module capabilities/actions
 * @since PHASE 4 - Capability Batch Actions
 */

import type { ActionErrorCode } from "./types"

/**
 * Input for executing a batch action.
 */
export interface BatchActionInput {
  /** Capability ID (e.g., "INV-003") */
  capabilityId: string

  /** Action ID within the capability (e.g., "fiscalize") */
  actionId: string

  /** Entity IDs to operate on */
  entityIds: string[]

  /** Entity type (e.g., "Invoice") */
  entityType: string

  /** Additional action-specific parameters */
  params?: Record<string, unknown>

  /** Continue on failure (default: true) */
  continueOnError?: boolean
}

/**
 * Result for a single entity in a batch operation.
 */
export interface BatchItemResult {
  /** Entity ID */
  entityId: string

  /** Whether this item succeeded */
  success: boolean

  /** Data returned on success */
  data?: unknown

  /** Error message on failure */
  error?: string

  /** Machine-readable error code */
  code?: ActionErrorCode
}

/**
 * Aggregate result of a batch action.
 */
export interface BatchActionResult {
  /** Total number of entities processed */
  total: number

  /** Number of successful operations */
  succeeded: number

  /** Number of failed operations */
  failed: number

  /** Individual results for each entity */
  results: BatchItemResult[]
}

/**
 * Callback for batch progress updates.
 * Called after each entity is processed.
 */
export type BatchProgressCallback = (
  completed: number,
  total: number,
  current: BatchItemResult
) => void
```

**Step 4: Run test to verify it passes**

Run: `npm test src/lib/capabilities/actions/__tests__/batch-types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/capabilities/actions/batch-types.ts src/lib/capabilities/actions/__tests__/batch-types.test.ts
git commit -m "feat(capabilities): add batch action types"
```

---

## Task 2: Batch Action Executor

**Files:**

- Create: `src/lib/capabilities/actions/batch-executor.ts`
- Modify: `src/lib/capabilities/actions/executor.ts:20-21` (import handlers export)
- Test: `src/lib/capabilities/actions/__tests__/batch-executor.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/capabilities/actions/__tests__/batch-executor.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock auth and db
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

// Import after mocks
import { executeBatchAction } from "../batch-executor"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

describe("executeBatchAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns unauthorized when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const result = await executeBatchAction({
      capabilityId: "INV-003",
      actionId: "fiscalize",
      entityIds: ["inv-1"],
      entityType: "Invoice",
    })

    expect(result.total).toBe(0)
    expect(result.failed).toBe(1)
    expect(result.results[0].code).toBe("UNAUTHORIZED")
  })

  it("returns empty result for empty entityIds", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } })

    const result = await executeBatchAction({
      capabilityId: "INV-003",
      actionId: "fiscalize",
      entityIds: [],
      entityType: "Invoice",
    })

    expect(result.total).toBe(0)
    expect(result.succeeded).toBe(0)
    expect(result.failed).toBe(0)
    expect(result.results).toEqual([])
  })

  it("processes multiple entities and aggregates results", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } })
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "user-1",
      systemRole: "USER",
      companies: [{ companyId: "comp-1", role: "ADMIN" }],
    })

    const result = await executeBatchAction({
      capabilityId: "INV-003",
      actionId: "fiscalize",
      entityIds: ["inv-1", "inv-2"],
      entityType: "Invoice",
    })

    expect(result.total).toBe(2)
    expect(result.succeeded + result.failed).toBe(2)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test src/lib/capabilities/actions/__tests__/batch-executor.test.ts`
Expected: FAIL - Cannot find module '../batch-executor'

**Step 3: Write minimal implementation**

````typescript
// src/lib/capabilities/actions/batch-executor.ts
"use server"

/**
 * Batch Action Executor
 *
 * Server action that executes the same capability action on multiple entities.
 * Validates capabilities for each entity, executes in sequence, and aggregates results.
 *
 * @module capabilities/actions
 * @since PHASE 4 - Capability Batch Actions
 */

import { auth } from "@/lib/auth"
import { executeCapabilityAction } from "./executor"
import type { BatchActionInput, BatchActionResult, BatchItemResult } from "./batch-types"

/**
 * Execute a capability action on multiple entities.
 *
 * @param input - Batch action input
 * @returns Aggregated result with individual outcomes
 *
 * @example
 * ```typescript
 * const result = await executeBatchAction({
 *   capabilityId: "INV-003",
 *   actionId: "fiscalize",
 *   entityIds: ["inv-1", "inv-2", "inv-3"],
 *   entityType: "Invoice",
 * })
 *
 * console.log(`${result.succeeded}/${result.total} succeeded`)
 * ```
 */
export async function executeBatchAction(input: BatchActionInput): Promise<BatchActionResult> {
  const { capabilityId, actionId, entityIds, entityType, params, continueOnError = true } = input

  // Quick session check before processing
  const session = await auth()
  if (!session?.user?.id) {
    return {
      total: 0,
      succeeded: 0,
      failed: 1,
      results: [
        {
          entityId: "",
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        },
      ],
    }
  }

  // Empty input = empty result
  if (entityIds.length === 0) {
    return {
      total: 0,
      succeeded: 0,
      failed: 0,
      results: [],
    }
  }

  const results: BatchItemResult[] = []
  let succeeded = 0
  let failed = 0

  // Process entities sequentially to avoid rate limiting and maintain order
  for (const entityId of entityIds) {
    const result = await executeCapabilityAction({
      capabilityId,
      actionId,
      entityId,
      entityType,
      params,
    })

    const itemResult: BatchItemResult = {
      entityId,
      success: result.success,
      data: result.data,
      error: result.error,
      code: result.code,
    }

    results.push(itemResult)

    if (result.success) {
      succeeded++
    } else {
      failed++
      if (!continueOnError) {
        break
      }
    }
  }

  return {
    total: results.length,
    succeeded,
    failed,
    results,
  }
}
````

**Step 4: Run test to verify it passes**

Run: `npm test src/lib/capabilities/actions/__tests__/batch-executor.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/capabilities/actions/batch-executor.ts src/lib/capabilities/actions/__tests__/batch-executor.test.ts
git commit -m "feat(capabilities): add batch action executor"
```

---

## Task 3: useBatchAction Hook

**Files:**

- Create: `src/lib/capabilities/actions/useBatchAction.ts`
- Test: `src/lib/capabilities/actions/__tests__/useBatchAction.test.tsx`

**Step 1: Write the failing test**

```tsx
// src/lib/capabilities/actions/__tests__/useBatchAction.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"

// Mock the batch executor
vi.mock("../batch-executor", () => ({
  executeBatchAction: vi.fn(),
}))

// Mock capability resolution
vi.mock("@/hooks/use-capability-resolution", () => ({
  revalidateCapabilityResolution: vi.fn().mockResolvedValue(undefined),
}))

import { useBatchAction } from "../useBatchAction"
import { executeBatchAction } from "../batch-executor"

describe("useBatchAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns initial state with execute function", () => {
    const { result } = renderHook(() =>
      useBatchAction({
        capabilityId: "INV-003",
        actionId: "fiscalize",
        entityType: "Invoice",
      })
    )

    expect(result.current.isLoading).toBe(false)
    expect(result.current.progress).toBeNull()
    expect(result.current.result).toBeNull()
    expect(typeof result.current.execute).toBe("function")
  })

  it("executes batch action and updates state", async () => {
    vi.mocked(executeBatchAction).mockResolvedValue({
      total: 2,
      succeeded: 2,
      failed: 0,
      results: [
        { entityId: "inv-1", success: true },
        { entityId: "inv-2", success: true },
      ],
    })

    const onComplete = vi.fn()
    const { result } = renderHook(() =>
      useBatchAction({
        capabilityId: "INV-003",
        actionId: "fiscalize",
        entityType: "Invoice",
        onComplete,
      })
    )

    await act(async () => {
      await result.current.execute(["inv-1", "inv-2"])
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.result?.succeeded).toBe(2)
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ succeeded: 2 }))
  })

  it("resets state correctly", async () => {
    vi.mocked(executeBatchAction).mockResolvedValue({
      total: 1,
      succeeded: 1,
      failed: 0,
      results: [{ entityId: "inv-1", success: true }],
    })

    const { result } = renderHook(() =>
      useBatchAction({
        capabilityId: "INV-003",
        actionId: "fiscalize",
        entityType: "Invoice",
      })
    )

    await act(async () => {
      await result.current.execute(["inv-1"])
    })

    expect(result.current.result).not.toBeNull()

    act(() => {
      result.current.reset()
    })

    expect(result.current.result).toBeNull()
    expect(result.current.progress).toBeNull()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test src/lib/capabilities/actions/__tests__/useBatchAction.test.tsx`
Expected: FAIL - Cannot find module '../useBatchAction'

**Step 3: Write minimal implementation**

````typescript
// src/lib/capabilities/actions/useBatchAction.ts
"use client"

/**
 * useBatchAction Hook
 *
 * Client-side React hook for executing batch capability actions with
 * loading states, progress tracking, and callbacks.
 *
 * @module capabilities/actions
 * @since PHASE 4 - Capability Batch Actions
 */

import { useState, useCallback } from "react"
import { executeBatchAction } from "./batch-executor"
import { revalidateCapabilityResolution } from "@/hooks/use-capability-resolution"
import type { BatchActionResult } from "./batch-types"

/**
 * Progress state for batch operations.
 */
export interface BatchProgress {
  /** Number of entities completed */
  completed: number
  /** Total number of entities */
  total: number
  /** Percentage complete (0-100) */
  percent: number
}

/**
 * Options for the useBatchAction hook.
 */
export interface UseBatchActionOptions {
  /** Capability ID (e.g., "INV-003") */
  capabilityId: string

  /** Action ID within the capability (e.g., "fiscalize") */
  actionId: string

  /** Entity type (e.g., "Invoice") */
  entityType: string

  /** Additional action-specific parameters */
  params?: Record<string, unknown>

  /** Continue on failure (default: true) */
  continueOnError?: boolean

  /** Callback invoked when batch completes */
  onComplete?: (result: BatchActionResult) => void

  /** Callback invoked on partial progress */
  onProgress?: (progress: BatchProgress) => void
}

/**
 * Return type for the useBatchAction hook.
 */
export interface UseBatchActionReturn {
  /** Execute the batch action on given entity IDs */
  execute: (entityIds: string[]) => Promise<BatchActionResult>

  /** Whether the batch is currently executing */
  isLoading: boolean

  /** Current progress (null if not executing) */
  progress: BatchProgress | null

  /** Result of the last batch execution (null if not executed) */
  result: BatchActionResult | null

  /** Reset state to initial */
  reset: () => void
}

/**
 * React hook for executing batch capability actions.
 *
 * @param options - Hook configuration options
 * @returns Hook state and methods
 *
 * @example
 * ```tsx
 * function BulkFiscalizeButton({ selectedIds }: { selectedIds: string[] }) {
 *   const { execute, isLoading, progress, result } = useBatchAction({
 *     capabilityId: "INV-003",
 *     actionId: "fiscalize",
 *     entityType: "Invoice",
 *     onComplete: (result) => {
 *       toast.success(`${result.succeeded}/${result.total} fiscalized`)
 *     },
 *   })
 *
 *   return (
 *     <Button onClick={() => execute(selectedIds)} disabled={isLoading}>
 *       {isLoading ? `${progress?.percent}%` : `Fiscalize ${selectedIds.length}`}
 *     </Button>
 *   )
 * }
 * ```
 */
export function useBatchAction(options: UseBatchActionOptions): UseBatchActionReturn {
  const { capabilityId, actionId, entityType, params, continueOnError, onComplete, onProgress } =
    options

  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState<BatchProgress | null>(null)
  const [result, setResult] = useState<BatchActionResult | null>(null)

  const execute = useCallback(
    async (entityIds: string[]): Promise<BatchActionResult> => {
      setIsLoading(true)
      setProgress({ completed: 0, total: entityIds.length, percent: 0 })
      setResult(null)

      try {
        const batchResult = await executeBatchAction({
          capabilityId,
          actionId,
          entityIds,
          entityType,
          params,
          continueOnError,
        })

        // Update final progress
        const finalProgress = {
          completed: batchResult.total,
          total: batchResult.total,
          percent: 100,
        }
        setProgress(finalProgress)
        onProgress?.(finalProgress)

        // Trigger revalidation for all affected entities (best-effort)
        try {
          await Promise.all(entityIds.map((id) => revalidateCapabilityResolution(id)))
        } catch {
          console.warn("Failed to revalidate some capabilities after batch action")
        }

        setResult(batchResult)
        onComplete?.(batchResult)
        setIsLoading(false)

        return batchResult
      } catch (error) {
        const errorResult: BatchActionResult = {
          total: entityIds.length,
          succeeded: 0,
          failed: entityIds.length,
          results: entityIds.map((entityId) => ({
            entityId,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            code: "INTERNAL_ERROR" as const,
          })),
        }

        setResult(errorResult)
        onComplete?.(errorResult)
        setIsLoading(false)

        return errorResult
      }
    },
    [capabilityId, actionId, entityType, params, continueOnError, onComplete, onProgress]
  )

  const reset = useCallback(() => {
    setProgress(null)
    setResult(null)
  }, [])

  return {
    execute,
    isLoading,
    progress,
    result,
    reset,
  }
}
````

**Step 4: Run test to verify it passes**

Run: `npm test src/lib/capabilities/actions/__tests__/useBatchAction.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/capabilities/actions/useBatchAction.ts src/lib/capabilities/actions/__tests__/useBatchAction.test.tsx
git commit -m "feat(capabilities): add useBatchAction hook"
```

---

## Task 4: Selection Context

**Files:**

- Create: `src/components/capability/selection-context.tsx`
- Test: `src/components/capability/__tests__/selection-context.test.tsx`

**Step 1: Write the failing test**

```tsx
// src/components/capability/__tests__/selection-context.test.tsx
import { describe, it, expect, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import React from "react"
import { SelectionProvider, useSelection } from "../selection-context"

describe("SelectionContext", () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <SelectionProvider>{children}</SelectionProvider>
  )

  it("starts with empty selection", () => {
    const { result } = renderHook(() => useSelection(), { wrapper })
    expect(result.current.selectedIds).toEqual([])
    expect(result.current.isSelected("any")).toBe(false)
  })

  it("toggles selection", () => {
    const { result } = renderHook(() => useSelection(), { wrapper })

    act(() => {
      result.current.toggle("item-1")
    })
    expect(result.current.isSelected("item-1")).toBe(true)

    act(() => {
      result.current.toggle("item-1")
    })
    expect(result.current.isSelected("item-1")).toBe(false)
  })

  it("selects and deselects all", () => {
    const { result } = renderHook(() => useSelection(), { wrapper })

    act(() => {
      result.current.selectAll(["a", "b", "c"])
    })
    expect(result.current.selectedIds).toEqual(["a", "b", "c"])

    act(() => {
      result.current.deselectAll()
    })
    expect(result.current.selectedIds).toEqual([])
  })

  it("tracks selection count and hasSelection", () => {
    const { result } = renderHook(() => useSelection(), { wrapper })

    expect(result.current.hasSelection).toBe(false)
    expect(result.current.count).toBe(0)

    act(() => {
      result.current.toggle("item-1")
      result.current.toggle("item-2")
    })

    expect(result.current.hasSelection).toBe(true)
    expect(result.current.count).toBe(2)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test src/components/capability/__tests__/selection-context.test.tsx`
Expected: FAIL - Cannot find module '../selection-context'

**Step 3: Write minimal implementation**

```tsx
// src/components/capability/selection-context.tsx
"use client"

/**
 * Selection Context
 *
 * React context for managing multi-select state across queue components.
 * Enables batch operations by tracking which items are selected.
 *
 * @module components/capability
 * @since PHASE 4 - Capability Batch Actions
 */

import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react"

/**
 * Selection context state and actions.
 */
interface SelectionContextValue {
  /** Array of selected entity IDs */
  selectedIds: string[]

  /** Check if an ID is selected */
  isSelected: (id: string) => boolean

  /** Toggle selection for an ID */
  toggle: (id: string) => void

  /** Select a specific ID (idempotent) */
  select: (id: string) => void

  /** Deselect a specific ID (idempotent) */
  deselect: (id: string) => void

  /** Select multiple IDs (replaces current selection) */
  selectAll: (ids: string[]) => void

  /** Clear all selections */
  deselectAll: () => void

  /** Whether any items are selected */
  hasSelection: boolean

  /** Number of selected items */
  count: number
}

const SelectionContext = createContext<SelectionContextValue | null>(null)

/**
 * Provider component for selection state.
 */
export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const isSelected = useCallback((id: string) => selectedIds.includes(id), [selectedIds])

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }, [])

  const select = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }, [])

  const deselect = useCallback((id: string) => {
    setSelectedIds((prev) => prev.filter((i) => i !== id))
  }, [])

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(ids)
  }, [])

  const deselectAll = useCallback(() => {
    setSelectedIds([])
  }, [])

  const value = useMemo(
    (): SelectionContextValue => ({
      selectedIds,
      isSelected,
      toggle,
      select,
      deselect,
      selectAll,
      deselectAll,
      hasSelection: selectedIds.length > 0,
      count: selectedIds.length,
    }),
    [selectedIds, isSelected, toggle, select, deselect, selectAll, deselectAll]
  )

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>
}

/**
 * Hook to access selection state.
 * Must be used within a SelectionProvider.
 */
export function useSelection(): SelectionContextValue {
  const context = useContext(SelectionContext)
  if (!context) {
    throw new Error("useSelection must be used within a SelectionProvider")
  }
  return context
}

/**
 * Optional hook that returns null if outside provider.
 * Useful for components that may or may not be in selection mode.
 */
export function useSelectionOptional(): SelectionContextValue | null {
  return useContext(SelectionContext)
}
```

**Step 4: Run test to verify it passes**

Run: `npm test src/components/capability/__tests__/selection-context.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/capability/selection-context.tsx src/components/capability/__tests__/selection-context.test.tsx
git commit -m "feat(capabilities): add selection context for batch operations"
```

---

## Task 5: BatchActionBar Component

**Files:**

- Create: `src/components/capability/BatchActionBar.tsx`
- Test: `src/components/capability/__tests__/BatchActionBar.test.tsx`

**Step 1: Write the failing test**

```tsx
// src/components/capability/__tests__/BatchActionBar.test.tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import React from "react"
import { BatchActionBar } from "../BatchActionBar"
import { SelectionProvider } from "../selection-context"

// Mock useBatchAction
vi.mock("@/lib/capabilities/actions/useBatchAction", () => ({
  useBatchAction: () => ({
    execute: vi.fn().mockResolvedValue({ total: 2, succeeded: 2, failed: 0, results: [] }),
    isLoading: false,
    progress: null,
    result: null,
    reset: vi.fn(),
  }),
}))

describe("BatchActionBar", () => {
  const actions = [
    { id: "fiscalize", label: "Fiscalize", capabilityId: "INV-003" },
    { id: "send", label: "Send", capabilityId: "INV-004" },
  ]

  it("renders nothing when no selection", () => {
    const { container } = render(
      <SelectionProvider>
        <BatchActionBar entityType="Invoice" actions={actions} />
      </SelectionProvider>
    )
    expect(container.querySelector('[data-testid="batch-action-bar"]')).toBeNull()
  })

  it("renders with selection count", () => {
    const TestComponent = () => {
      const [selected, setSelected] = React.useState<string[]>(["inv-1", "inv-2"])
      return (
        <SelectionProvider>
          <BatchActionBar
            entityType="Invoice"
            actions={actions}
            selectedIds={selected}
            onClear={() => setSelected([])}
          />
        </SelectionProvider>
      )
    }

    render(<TestComponent />)
    expect(screen.getByText(/2 selected/i)).toBeInTheDocument()
  })

  it("renders action buttons", () => {
    render(
      <SelectionProvider>
        <BatchActionBar
          entityType="Invoice"
          actions={actions}
          selectedIds={["inv-1"]}
          onClear={() => {}}
        />
      </SelectionProvider>
    )

    expect(screen.getByText("Fiscalize")).toBeInTheDocument()
    expect(screen.getByText("Send")).toBeInTheDocument()
  })

  it("has clear button", () => {
    const onClear = vi.fn()
    render(
      <SelectionProvider>
        <BatchActionBar
          entityType="Invoice"
          actions={actions}
          selectedIds={["inv-1"]}
          onClear={onClear}
        />
      </SelectionProvider>
    )

    fireEvent.click(screen.getByLabelText(/clear selection/i))
    expect(onClear).toHaveBeenCalled()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test src/components/capability/__tests__/BatchActionBar.test.tsx`
Expected: FAIL - Cannot find module '../BatchActionBar'

**Step 3: Write minimal implementation**

```tsx
// src/components/capability/BatchActionBar.tsx
"use client"

/**
 * Batch Action Bar
 *
 * Floating action bar that appears when items are selected.
 * Displays selection count and available batch actions.
 *
 * @module components/capability
 * @since PHASE 4 - Capability Batch Actions
 */

import { Button } from "@/components/ui/button"
import { X, Loader2, CheckCircle, XCircle } from "lucide-react"
import { useBatchAction } from "@/lib/capabilities/actions/useBatchAction"
import { toast } from "@/lib/toast"
import type { BatchActionResult } from "@/lib/capabilities/actions/batch-types"

/**
 * Action definition for batch operations.
 */
export interface BatchActionDefinition {
  /** Action ID */
  id: string
  /** Display label */
  label: string
  /** Capability ID */
  capabilityId: string
  /** Additional params */
  params?: Record<string, unknown>
}

interface Props {
  /** Entity type for the batch */
  entityType: string
  /** Available batch actions */
  actions: BatchActionDefinition[]
  /** Currently selected entity IDs (controlled) */
  selectedIds?: string[]
  /** Clear selection callback */
  onClear?: () => void
  /** Callback after any action completes */
  onActionComplete?: (result: BatchActionResult) => void
}

export function BatchActionBar({
  entityType,
  actions,
  selectedIds = [],
  onClear,
  onActionComplete,
}: Props) {
  // Don't render if nothing selected
  if (selectedIds.length === 0) {
    return null
  }

  return (
    <div
      data-testid="batch-action-bar"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-background border rounded-lg shadow-lg px-4 py-2"
    >
      <span className="text-sm font-medium">{selectedIds.length} selected</span>

      <div className="h-4 w-px bg-border" />

      <div className="flex gap-2">
        {actions.map((action) => (
          <BatchActionButton
            key={action.id}
            action={action}
            entityType={entityType}
            selectedIds={selectedIds}
            onComplete={(result) => {
              if (result.succeeded > 0) {
                toast.success(
                  "Batch Complete",
                  `${result.succeeded}/${result.total} ${action.label.toLowerCase()}d`
                )
              }
              if (result.failed > 0) {
                toast.error("Some Failed", `${result.failed}/${result.total} failed`)
              }
              onActionComplete?.(result)
            }}
          />
        ))}
      </div>

      <div className="h-4 w-px bg-border" />

      <Button
        variant="ghost"
        size="icon"
        onClick={onClear}
        aria-label="Clear selection"
        className="h-8 w-8"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}

/**
 * Individual batch action button with loading state.
 */
function BatchActionButton({
  action,
  entityType,
  selectedIds,
  onComplete,
}: {
  action: BatchActionDefinition
  entityType: string
  selectedIds: string[]
  onComplete: (result: BatchActionResult) => void
}) {
  const { execute, isLoading, progress } = useBatchAction({
    capabilityId: action.capabilityId,
    actionId: action.id,
    entityType,
    params: action.params,
    onComplete,
  })

  const handleClick = () => {
    void execute(selectedIds)
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={isLoading}>
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
          {progress ? `${progress.percent}%` : "..."}
        </>
      ) : (
        action.label
      )}
    </Button>
  )
}
```

**Step 4: Run test to verify it passes**

Run: `npm test src/components/capability/__tests__/BatchActionBar.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/capability/BatchActionBar.tsx src/components/capability/__tests__/BatchActionBar.test.tsx
git commit -m "feat(capabilities): add BatchActionBar component"
```

---

## Task 6: SelectableQueueItem Component

**Files:**

- Create: `src/components/capability/SelectableQueueItem.tsx`
- Test: `src/components/capability/__tests__/SelectableQueueItem.test.tsx`

**Step 1: Write the failing test**

```tsx
// src/components/capability/__tests__/SelectableQueueItem.test.tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import React from "react"
import { SelectableQueueItem } from "../SelectableQueueItem"
import { SelectionProvider } from "../selection-context"
import type { QueueItem } from "../types"

describe("SelectableQueueItem", () => {
  const mockItem: QueueItem = {
    id: "inv-123",
    type: "Invoice",
    title: "Invoice #001",
    status: "DRAFT",
    timestamp: "2026-01-01T00:00:00Z",
    capabilities: [
      {
        capability: "INV-003",
        state: "READY",
        inputs: [],
        blockers: [],
        actions: [{ id: "fiscalize", label: "Fiscalize", enabled: true }],
        resolvedAt: "2026-01-01T00:00:00Z",
      },
    ],
  }

  it("renders checkbox for selection", () => {
    render(
      <SelectionProvider>
        <SelectableQueueItem item={mockItem} selectable />
      </SelectionProvider>
    )

    expect(screen.getByRole("checkbox")).toBeInTheDocument()
  })

  it("does not render checkbox when selectable is false", () => {
    render(
      <SelectionProvider>
        <SelectableQueueItem item={mockItem} selectable={false} />
      </SelectionProvider>
    )

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
  })

  it("toggles selection on checkbox click", () => {
    const onSelectionChange = vi.fn()
    render(
      <SelectionProvider>
        <SelectableQueueItem item={mockItem} selectable onSelectionChange={onSelectionChange} />
      </SelectionProvider>
    )

    const checkbox = screen.getByRole("checkbox")
    fireEvent.click(checkbox)
    expect(onSelectionChange).toHaveBeenCalledWith("inv-123", true)
  })

  it("shows selected state", () => {
    render(
      <SelectionProvider>
        <SelectableQueueItem item={mockItem} selectable isSelected />
      </SelectionProvider>
    )

    expect(screen.getByRole("checkbox")).toBeChecked()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test src/components/capability/__tests__/SelectableQueueItem.test.tsx`
Expected: FAIL - Cannot find module '../SelectableQueueItem'

**Step 3: Write minimal implementation**

```tsx
// src/components/capability/SelectableQueueItem.tsx
"use client"

/**
 * Selectable Queue Item
 *
 * Enhanced QueueItemCard with checkbox for batch selection.
 * Works with SelectionContext for coordinated multi-select.
 *
 * @module components/capability
 * @since PHASE 4 - Capability Batch Actions
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { CapabilityStateIndicator } from "./CapabilityStateIndicator"
import { BlockerDisplay } from "./BlockerDisplay"
import { ActionButton } from "./ActionButton"
import { cn } from "@/lib/utils"
import type { QueueItem } from "./types"

interface Props {
  /** Queue item data */
  item: QueueItem
  /** Whether selection is enabled */
  selectable?: boolean
  /** Controlled selected state */
  isSelected?: boolean
  /** Callback when selection changes */
  onSelectionChange?: (id: string, selected: boolean) => void
  /** Show diagnostics */
  showDiagnostics?: boolean
  /** Callback when any action completes */
  onActionComplete?: () => void
}

export function SelectableQueueItem({
  item,
  selectable = false,
  isSelected = false,
  onSelectionChange,
  showDiagnostics = false,
  onActionComplete,
}: Props) {
  const primaryCapability =
    item.capabilities.find((c) => c.state === "READY") || item.capabilities[0]

  const handleCheckboxChange = (checked: boolean) => {
    onSelectionChange?.(item.id, checked)
  }

  return (
    <Card
      className={cn(
        "relative transition-colors",
        selectable && "cursor-pointer",
        isSelected && "ring-2 ring-primary bg-primary/5"
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          {selectable && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={handleCheckboxChange}
              aria-label={`Select ${item.title}`}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <div className="flex-1 flex items-center justify-between">
            <CardTitle className="text-base">{item.title}</CardTitle>
            {primaryCapability && <CapabilityStateIndicator state={primaryCapability.state} />}
          </div>
        </div>
        <p className="text-sm text-muted-foreground ml-7">
          Status: {item.status} | {new Date(item.timestamp).toLocaleDateString()}
        </p>
      </CardHeader>
      <CardContent className="ml-7">
        {/* Show blockers if any capability is blocked */}
        {item.capabilities.some((c) => c.state === "BLOCKED") && (
          <div className="mb-4">
            <BlockerDisplay
              blockers={item.capabilities.flatMap((c) => c.blockers)}
              showResolution
            />
          </div>
        )}

        {/* Show available actions (only when not in selection mode) */}
        {!selectable && (
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
        )}

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

**Step 4: Run test to verify it passes**

Run: `npm test src/components/capability/__tests__/SelectableQueueItem.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/capability/SelectableQueueItem.tsx src/components/capability/__tests__/SelectableQueueItem.test.tsx
git commit -m "feat(capabilities): add SelectableQueueItem component"
```

---

## Task 7: Update Barrel Exports

**Files:**

- Modify: `src/lib/capabilities/actions/index.ts` - Add batch exports
- Modify: `src/components/capability/index.ts` - Add selection exports

**Step 1: Update actions barrel**

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

// Types
export type {
  ActionResult,
  ActionErrorCode,
  ActionContext,
  ActionParams,
  ActionHandler,
  ActionRegistryEntry,
} from "./types"

// Batch types (PHASE 4)
export type {
  BatchActionInput,
  BatchItemResult,
  BatchActionResult,
  BatchProgressCallback,
} from "./batch-types"

// Registry
export { registerActionHandler, getActionHandler } from "./registry"

// Executor
export { executeCapabilityAction } from "./executor"
export type { ExecuteActionInput } from "./executor"

// Batch Executor (PHASE 4)
export { executeBatchAction } from "./batch-executor"

// Client hooks
export { useCapabilityAction } from "./useCapabilityAction"
export type { UseCapabilityActionOptions, UseCapabilityActionReturn } from "./useCapabilityAction"

// Batch hook (PHASE 4)
export { useBatchAction } from "./useBatchAction"
export type { UseBatchActionOptions, UseBatchActionReturn, BatchProgress } from "./useBatchAction"
```

**Step 2: Update component barrel**

```typescript
// src/components/capability/index.ts
/**
 * Capability UI Components
 *
 * Components for rendering capability-driven UI.
 *
 * @module components/capability
 * @since Control Center Shells
 */

// Core components
export { ControlCenterShell } from "./ControlCenterShell"
export { CapabilityStateIndicator } from "./CapabilityStateIndicator"
export { BlockerDisplay } from "./BlockerDisplay"
export { ActionButton } from "./ActionButton"
export { DiagnosticsToggle } from "./DiagnosticsToggle"
export { QueueRenderer } from "./QueueRenderer"
export { QueueItemCard } from "./QueueItem"

// Batch operation components (PHASE 4)
export { SelectableQueueItem } from "./SelectableQueueItem"
export { BatchActionBar } from "./BatchActionBar"
export type { BatchActionDefinition } from "./BatchActionBar"

// Selection context (PHASE 4)
export { SelectionProvider, useSelection, useSelectionOptional } from "./selection-context"

// Types
export type {
  CapabilityState,
  CapabilityResponse,
  CapabilityBlocker,
  CapabilityAction,
  CapabilityStateProps,
  BlockerDisplayProps,
  ActionButtonProps,
  QueueItem,
  QueueDefinition,
} from "./types"
```

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS (no type errors)

**Step 4: Commit**

```bash
git add src/lib/capabilities/actions/index.ts src/components/capability/index.ts
git commit -m "feat(capabilities): export batch action types and components"
```

---

## Task 8: Final Verification

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 2: Run linter**

Run: `npm run lint`
Expected: No errors

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit any fixes**

If fixes needed, commit them.

---

## Summary

PHASE 4 adds batch operation support:

1. **Batch Types** - `BatchActionInput`, `BatchActionResult`, `BatchItemResult`
2. **Batch Executor** - `executeBatchAction` server action
3. **useBatchAction** - Client hook with progress tracking
4. **SelectionContext** - React context for multi-select coordination
5. **BatchActionBar** - Floating bar with batch action buttons
6. **SelectableQueueItem** - Queue item with checkbox
