// src/lib/assistant/reasoning/client/__tests__/useReasoningStream.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useReasoningStream } from "../useReasoningStream"

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe("useReasoningStream", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("starts in idle state", () => {
    const { result } = renderHook(() => useReasoningStream({ surface: "APP" }))

    expect(result.current.streamState).toBe("idle")
    expect(result.current.events).toHaveLength(0)
    expect(result.current.requestId).toBeNull()
  })

  it("transitions to connecting on submit", async () => {
    mockFetch.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    )

    const { result } = renderHook(() => useReasoningStream({ surface: "APP" }))

    act(() => {
      result.current.actions.submit("test query")
    })

    expect(result.current.streamState).toBe("connecting")
  })

  it("resets state on reset action", async () => {
    const { result } = renderHook(() => useReasoningStream({ surface: "APP" }))

    // Simulate some state
    act(() => {
      result.current.actions.submit("test query")
    })

    act(() => {
      result.current.actions.reset()
    })

    expect(result.current.streamState).toBe("idle")
    expect(result.current.events).toHaveLength(0)
  })

  it("provides selectors", () => {
    const { result } = renderHook(() => useReasoningStream({ surface: "APP" }))

    expect(result.current.selectors).toBeDefined()
    expect(result.current.selectors.byStage).toBeDefined()
    expect(result.current.selectors.latestByStage).toBeDefined()
  })
})
