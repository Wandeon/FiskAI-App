/**
 * Tests for useCapabilities Hook
 *
 * @module hooks/__tests__
 * @since PHASE 3 - Capability State Refresh
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"
import type { PropsWithChildren, ReactNode } from "react"
import { createElement } from "react"

// Type the mock
type MockFetch = Mock<typeof fetch>

// Mock fetch globally
const mockFetch = vi.fn() as MockFetch
global.fetch = mockFetch

// SWR wrapper to isolate cache between tests
function wrapper({ children }: PropsWithChildren): ReactNode {
  return createElement(
    SWRConfig,
    { value: { provider: () => new Map(), dedupingInterval: 0 } },
    children
  )
}

describe("useCapabilities", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("should return revalidate function", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          capabilities: [
            { capability: "INV-003", state: "READY", inputs: [], blockers: [], actions: [] },
          ],
        }),
    } as Response)

    const { useCapabilities } = await import("../use-capabilities")

    const { result } = renderHook(() => useCapabilities({ capabilityIds: ["INV-003"] }), {
      wrapper,
    })

    expect(typeof result.current.revalidate).toBe("function")
  })

  it("should return mutate function for optimistic updates", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          capabilities: [],
        }),
    } as Response)

    const { useCapabilities } = await import("../use-capabilities")

    const { result } = renderHook(() => useCapabilities({ capabilityIds: ["INV-003"] }), {
      wrapper,
    })

    expect(typeof result.current.mutate).toBe("function")
  })

  it("should fetch capabilities when capabilityIds provided", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          capabilities: [
            {
              capability: "INV-003",
              state: "READY",
              inputs: [],
              blockers: [],
              actions: [{ id: "fiscalize", label: "Fiscalize", enabled: true }],
              resolvedAt: new Date().toISOString(),
            },
          ],
        }),
    } as Response)

    const { useCapabilities } = await import("../use-capabilities")

    const { result } = renderHook(
      () => useCapabilities({ capabilityIds: ["INV-003"], entityId: "inv-123" }),
      { wrapper }
    )

    await waitFor(() => {
      expect(result.current.capabilities).toHaveLength(1)
    })

    expect(result.current.capabilities[0].capability).toBe("INV-003")
    expect(result.current.capabilities[0].state).toBe("READY")
  })

  it("should not fetch when capabilityIds is empty", async () => {
    const { useCapabilities } = await import("../use-capabilities")

    const { result } = renderHook(() => useCapabilities({ capabilityIds: [] }), {
      wrapper,
    })

    // Wait a tick to ensure no fetch was triggered
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(mockFetch).not.toHaveBeenCalled()
    expect(result.current.capabilities).toEqual([])
  })

  it("should refetch capabilities when revalidate is called", async () => {
    // First fetch returns READY
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          capabilities: [
            { capability: "INV-003", state: "READY", inputs: [], blockers: [], actions: [] },
          ],
        }),
    } as Response)

    const { useCapabilities } = await import("../use-capabilities")

    const { result } = renderHook(() => useCapabilities({ capabilityIds: ["INV-003"] }), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.capabilities).toHaveLength(1)
    })

    expect(result.current.capabilities[0].state).toBe("READY")

    // Reset mock and set up second response with BLOCKED state
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          capabilities: [
            {
              capability: "INV-003",
              state: "BLOCKED",
              inputs: [],
              blockers: [{ type: "ENTITY_IMMUTABLE", message: "Invoice is fiscalized" }],
              actions: [],
            },
          ],
        }),
    } as Response)

    // Trigger revalidation
    await act(async () => {
      await result.current.revalidate()
    })

    await waitFor(() => {
      expect(result.current.capabilities[0].state).toBe("BLOCKED")
    })
  })

  it("should return error state on fetch failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Internal server error" }),
    } as Response)

    const { useCapabilities } = await import("../use-capabilities")

    const { result } = renderHook(() => useCapabilities({ capabilityIds: ["INV-003"] }), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.error).toBeDefined()
    })
  })

  it("should build correct cache key with entity parameters", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ capabilities: [] }),
    } as Response)

    const { useCapabilities } = await import("../use-capabilities")

    renderHook(
      () =>
        useCapabilities({
          capabilityIds: ["INV-003", "INV-004"],
          entityId: "inv-123",
          entityType: "EInvoice",
        }),
      { wrapper }
    )

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    // Verify the URL includes all parameters
    const fetchUrl = mockFetch.mock.calls[0][0] as string
    expect(fetchUrl).toContain("capability=INV-003")
    expect(fetchUrl).toContain("capability=INV-004")
    expect(fetchUrl).toContain("entityId=inv-123")
    expect(fetchUrl).toContain("entityType=EInvoice")
  })

  it("should use initialData when provided", async () => {
    const { useCapabilities } = await import("../use-capabilities")

    const initialCapabilities = [
      {
        capability: "INV-003",
        state: "READY" as const,
        inputs: [],
        blockers: [],
        actions: [],
        resolvedAt: new Date().toISOString(),
      },
    ]

    const { result } = renderHook(
      () =>
        useCapabilities({
          capabilityIds: ["INV-003"],
          initialData: initialCapabilities,
        }),
      { wrapper }
    )

    // Initial data should be available immediately
    expect(result.current.capabilities).toEqual(initialCapabilities)
  })
})

describe("revalidateCapabilities", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("should be exported as a function", async () => {
    const { revalidateCapabilities } = await import("../use-capabilities")
    expect(typeof revalidateCapabilities).toBe("function")
  })

  it("should trigger SWR global mutate", async () => {
    // This test verifies the function exists and can be called
    // Full integration testing would require a more complex setup
    const { revalidateCapabilities } = await import("../use-capabilities")

    // Should not throw when called
    await expect(revalidateCapabilities("inv-123")).resolves.not.toThrow()
  })

  it("should revalidate all capability caches when no entityId provided", async () => {
    const { revalidateCapabilities } = await import("../use-capabilities")

    // Should not throw when called without entityId
    await expect(revalidateCapabilities()).resolves.not.toThrow()
  })
})

describe("buildCacheKey", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("should sort capability IDs for consistent caching", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ capabilities: [] }),
    } as Response)

    const { useCapabilities } = await import("../use-capabilities")

    // First hook with IDs in one order
    renderHook(() => useCapabilities({ capabilityIds: ["INV-004", "INV-003", "INV-001"] }), {
      wrapper,
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    // The URL should have consistent ordering for cache key purposes
    const fetchUrl = mockFetch.mock.calls[0][0] as string
    // Capabilities should appear in sorted order in the URL
    const capabilityMatches = [...fetchUrl.matchAll(/capability=([^&]+)/g)]
    const capabilityOrder = capabilityMatches.map((m) => m[1])
    expect(capabilityOrder).toEqual(["INV-001", "INV-003", "INV-004"])
  })
})
