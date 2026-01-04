# PHASE 3: Capability State Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automatically refresh capability states after action execution, ensuring UI reflects the latest capability resolution.

**Architecture:** Enhance the existing SWR-based capability hook to support mutation/revalidation. When actions complete, trigger capability revalidation so UI updates automatically.

**Tech Stack:** SWR (already in use), Server Actions, React hooks

---

## Overview

PHASE 2 built action execution. After an action runs (e.g., fiscalize invoice), the capability state changes (invoice becomes immutable, INV-003 capability blocked). Currently the UI doesn't reflect this until a full page refresh.

PHASE 3 adds automatic refresh:

1. Enhance `useCapabilities` hook with SWR mutation
2. Add revalidation trigger to action executor
3. Control Centers auto-update after actions complete

---

## Task 1: Enhance useCapabilities Hook with Mutation

**Files:**

- Modify: `src/hooks/use-capabilities.ts`
- Test: `src/hooks/__tests__/use-capabilities.test.ts`

**Step 1: Read current implementation**

```bash
cat src/hooks/use-capabilities.ts
```

**Step 2: Write the failing test**

```typescript
// src/hooks/__tests__/use-capabilities.test.ts
import { describe, it, expect, vi } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useCapabilities } from "../use-capabilities"
import { SWRConfig } from "swr"
import { PropsWithChildren } from "react"

// Mock fetch
global.fetch = vi.fn()

const wrapper = ({ children }: PropsWithChildren) => (
  <SWRConfig value={{ provider: () => new Map() }}>
    {children}
  </SWRConfig>
)

describe("useCapabilities", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return revalidate function", () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ capabilities: [] }),
    } as Response)

    const { result } = renderHook(
      () => useCapabilities({ capabilityIds: ["INV-003"] }),
      { wrapper }
    )

    expect(typeof result.current.revalidate).toBe("function")
  })

  it("should refetch capabilities when revalidate is called", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ capabilities: [{ capability: "INV-003", state: "READY" }] }),
    } as Response)

    const { result } = renderHook(
      () => useCapabilities({ capabilityIds: ["INV-003"] }),
      { wrapper }
    )

    await waitFor(() => {
      expect(result.current.capabilities).toBeDefined()
    })

    // Reset mock to track revalidation
    vi.mocked(fetch).mockClear()
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ capabilities: [{ capability: "INV-003", state: "BLOCKED" }] }),
    } as Response)

    await act(async () => {
      await result.current.revalidate()
    })

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("should expose mutate for optimistic updates", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ capabilities: [] }),
    } as Response)

    const { result } = renderHook(
      () => useCapabilities({ capabilityIds: ["INV-003"] }),
      { wrapper }
    )

    expect(typeof result.current.mutate).toBe("function")
  })
})
```

**Step 3: Run test to verify it fails**

Run: `npm test -- src/hooks/__tests__/use-capabilities.test.ts`
Expected: FAIL - revalidate function doesn't exist

**Step 4: Write minimal implementation**

```typescript
// src/hooks/use-capabilities.ts
/**
 * Capabilities Hook
 *
 * Fetches and caches capability resolutions with SWR.
 * Supports revalidation for auto-refresh after actions.
 *
 * @module hooks
 * @since Control Center Shells
 * @updated PHASE 3 - Capability State Refresh
 */

"use client"

import useSWR, { mutate as globalMutate } from "swr"
import type { CapabilityResponse } from "@/lib/capabilities/types"

interface UseCapabilitiesOptions {
  /** Capability IDs to resolve */
  capabilityIds: string[]
  /** Entity ID for entity-specific resolution */
  entityId?: string
  /** Entity type */
  entityType?: string
  /** Initial data for SSR hydration */
  initialData?: CapabilityResponse[]
  /** Refresh interval in ms (0 = disabled) */
  refreshInterval?: number
}

interface UseCapabilitiesReturn {
  /** Resolved capabilities */
  capabilities: CapabilityResponse[]
  /** Loading state */
  isLoading: boolean
  /** Error state */
  error: Error | undefined
  /** Trigger revalidation */
  revalidate: () => Promise<void>
  /** Mutate cache (for optimistic updates) */
  mutate: (data?: CapabilityResponse[] | Promise<CapabilityResponse[]>) => Promise<void>
}

/**
 * Build cache key for capability resolution.
 */
function buildCacheKey(opts: UseCapabilitiesOptions): string {
  const parts = ["capabilities", ...opts.capabilityIds.sort()]
  if (opts.entityId) parts.push(opts.entityId)
  if (opts.entityType) parts.push(opts.entityType)
  return parts.join(":")
}

/**
 * Fetch capabilities from API.
 */
async function fetchCapabilities(opts: UseCapabilitiesOptions): Promise<CapabilityResponse[]> {
  const params = new URLSearchParams()
  opts.capabilityIds.forEach((id) => params.append("capability", id))
  if (opts.entityId) params.set("entityId", opts.entityId)
  if (opts.entityType) params.set("entityType", opts.entityType)

  const response = await fetch(`/api/capabilities?${params.toString()}`)
  if (!response.ok) {
    throw new Error("Failed to fetch capabilities")
  }
  const data = await response.json()
  return data.capabilities ?? []
}

/**
 * Hook for fetching capability resolutions with caching.
 *
 * @example
 * const { capabilities, revalidate, isLoading } = useCapabilities({
 *   capabilityIds: ["INV-003", "INV-004"],
 *   entityId: invoice.id,
 *   entityType: "EInvoice",
 * })
 *
 * // After action completes:
 * onSuccess: () => revalidate()
 */
export function useCapabilities(options: UseCapabilitiesOptions): UseCapabilitiesReturn {
  const cacheKey = buildCacheKey(options)

  const { data, error, isLoading, mutate } = useSWR<CapabilityResponse[]>(
    options.capabilityIds.length > 0 ? cacheKey : null,
    () => fetchCapabilities(options),
    {
      fallbackData: options.initialData,
      refreshInterval: options.refreshInterval,
      revalidateOnFocus: false,
      dedupingInterval: 2000, // Prevent duplicate requests within 2s
    }
  )

  const revalidate = async () => {
    await mutate()
  }

  const mutateFn = async (newData?: CapabilityResponse[] | Promise<CapabilityResponse[]>) => {
    await mutate(newData)
  }

  return {
    capabilities: data ?? [],
    isLoading,
    error,
    revalidate,
    mutate: mutateFn,
  }
}

/**
 * Revalidate all capability caches matching a pattern.
 * Call this after an action to refresh all Control Centers.
 */
export async function revalidateCapabilities(entityId?: string): Promise<void> {
  // Revalidate all keys starting with "capabilities:"
  await globalMutate(
    (key) =>
      typeof key === "string" &&
      key.startsWith("capabilities:") &&
      (entityId ? key.includes(entityId) : true),
    undefined,
    { revalidate: true }
  )
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- src/hooks/__tests__/use-capabilities.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/hooks/use-capabilities.ts src/hooks/__tests__/use-capabilities.test.ts
git commit -m "feat(capabilities): enhance useCapabilities with revalidation support"
```

---

## Task 2: Integrate Revalidation in useCapabilityAction

**Files:**

- Modify: `src/lib/capabilities/actions/useCapabilityAction.ts`
- Modify: `src/lib/capabilities/actions/__tests__/useCapabilityAction.test.tsx`

**Step 1: Update the hook to trigger revalidation on success**

```typescript
// Add to useCapabilityAction.ts

import { revalidateCapabilities } from "@/hooks/use-capabilities"

// In the success handler, add revalidation:
if (result.success) {
  setData(result.data ?? null)

  // Revalidate capabilities for this entity
  await revalidateCapabilities(entityId)

  onSuccess?.(result)
}
```

**Step 2: Write test for revalidation trigger**

Add to existing test file:

```typescript
it("should trigger capability revalidation on success", async () => {
  const mockRevalidate = vi.fn()
  vi.mock("@/hooks/use-capabilities", () => ({
    revalidateCapabilities: mockRevalidate,
  }))

  const { result } = renderHook(() =>
    useCapabilityAction({
      capabilityId: "INV-003",
      actionId: "fiscalize",
      entityId: "inv-123",
    })
  )

  await act(async () => {
    await result.current.execute()
  })

  expect(mockRevalidate).toHaveBeenCalledWith("inv-123")
})
```

**Step 3: Commit**

```bash
git add src/lib/capabilities/actions/useCapabilityAction.ts src/lib/capabilities/actions/__tests__/useCapabilityAction.test.tsx
git commit -m "feat(capabilities): trigger capability revalidation after action success"
```

---

## Task 3: Add Revalidation to QueueRenderer

**Files:**

- Modify: `src/components/capability/QueueRenderer.tsx`

**Step 1: Read current implementation**

Review how QueueRenderer fetches and displays capabilities.

**Step 2: Integrate useCapabilities hook**

If not already using the hook, integrate it so the queue auto-refreshes when capabilities are revalidated.

```typescript
// src/components/capability/QueueRenderer.tsx
import { useCapabilities } from "@/hooks/use-capabilities"

// In component:
const capabilityIds = items.flatMap((item) => item.capabilities.map((c) => c.capability))
const uniqueCapabilityIds = [...new Set(capabilityIds)]

const { capabilities: freshCapabilities, revalidate } = useCapabilities({
  capabilityIds: uniqueCapabilityIds,
  refreshInterval: 0, // Manual refresh only
})

// Merge fresh capabilities with items
// ...
```

**Step 3: Commit**

```bash
git add src/components/capability/QueueRenderer.tsx
git commit -m "feat(capabilities): integrate useCapabilities in QueueRenderer for auto-refresh"
```

---

## Task 4: Add Loading States During Revalidation

**Files:**

- Modify: `src/components/capability/QueueItem.tsx`

**Step 1: Show subtle loading indicator when revalidating**

Add a loading overlay or badge when the capability is being refreshed.

```typescript
interface Props {
  item: QueueItemType
  showDiagnostics?: boolean
  onActionComplete?: () => void
  isRevalidating?: boolean // New prop
}

// In render:
{isRevalidating && (
  <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
    <Loader2 className="h-4 w-4 animate-spin" />
  </div>
)}
```

**Step 2: Commit**

```bash
git add src/components/capability/QueueItem.tsx
git commit -m "feat(capabilities): add revalidation loading state to QueueItem"
```

---

## Task 5: Export revalidateCapabilities Utility

**Files:**

- Modify: `src/lib/capabilities/index.ts`
- Modify: `src/hooks/index.ts` (if exists)

**Step 1: Add export**

```typescript
// src/lib/capabilities/index.ts
export { revalidateCapabilities } from "@/hooks/use-capabilities"
```

**Step 2: Commit**

```bash
git add src/lib/capabilities/index.ts
git commit -m "feat(capabilities): export revalidateCapabilities utility"
```

---

## Task 6: Integration Test for Full Refresh Flow

**Files:**

- Create: `src/lib/capabilities/__tests__/refresh-flow.test.ts`

**Step 1: Write integration test**

```typescript
import { describe, it, expect, vi } from "vitest"

describe("Capability Refresh Flow", () => {
  it("should revalidate capabilities after action execution", async () => {
    // Mock SWR mutate
    const mockMutate = vi.fn()
    vi.mock("swr", () => ({
      default: vi.fn().mockReturnValue({
        data: [],
        error: undefined,
        isLoading: false,
        mutate: mockMutate,
      }),
      mutate: mockMutate,
    }))

    // Execute action
    // Verify mutate was called with correct pattern
  })
})
```

**Step 2: Commit**

```bash
git add src/lib/capabilities/__tests__/refresh-flow.test.ts
git commit -m "test(capabilities): add integration test for refresh flow"
```

---

## Task 7: Final Verification

**Step 1: Run all tests**

```bash
npm test
```

**Step 2: TypeScript check**

```bash
npm run type-check
```

**Step 3: Lint check**

```bash
npm run lint && npm run format
```

**Step 4: Commit if needed**

```bash
git add -A
git commit -m "chore: PHASE 3 cleanup and formatting"
```

---

## Summary

**Files Modified:**

- `src/hooks/use-capabilities.ts` - Add revalidation support
- `src/lib/capabilities/actions/useCapabilityAction.ts` - Trigger revalidation on success
- `src/components/capability/QueueRenderer.tsx` - Integrate useCapabilities
- `src/components/capability/QueueItem.tsx` - Loading states
- `src/lib/capabilities/index.ts` - Exports

**Architecture:**

```
ActionButton (click)
    ↓
useCapabilityAction (hook)
    ↓
executeCapabilityAction (server action)
    ↓
Action completes → success
    ↓
revalidateCapabilities(entityId)
    ↓
SWR mutate() triggers
    ↓
useCapabilities re-fetches
    ↓
QueueRenderer updates UI
```

**Next Phase (PHASE 4):** Batch operations and bulk action handling.
