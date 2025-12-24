import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useCTADismissal } from "../useCTADismissal"

describe("useCTADismissal", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns isDismissed=false initially", () => {
    const { result } = renderHook(() => useCTADismissal({ surface: "MARKETING" }))

    expect(result.current.isDismissed).toBe(false)
  })

  it("sets isDismissed=true after dismiss()", () => {
    const { result } = renderHook(() => useCTADismissal({ surface: "MARKETING" }))

    act(() => {
      result.current.dismiss()
    })

    expect(result.current.isDismissed).toBe(true)
  })

  it("persists dismissal to localStorage for MARKETING surface", () => {
    const { result } = renderHook(() => useCTADismissal({ surface: "MARKETING" }))

    act(() => {
      result.current.dismiss()
    })

    const stored = localStorage.getItem("assistant_cta_dismissed_marketing")
    expect(stored).toBeTruthy()

    const parsed = JSON.parse(stored!)
    expect(parsed.expiry).toBeDefined()
  })

  it("respects 7-day cooldown for MARKETING surface", () => {
    const now = Date.now()
    vi.setSystemTime(now)

    const { result, rerender } = renderHook(() => useCTADismissal({ surface: "MARKETING" }))

    act(() => {
      result.current.dismiss()
    })

    expect(result.current.isDismissed).toBe(true)

    // Advance 6 days - should still be dismissed
    vi.setSystemTime(now + 6 * 24 * 60 * 60 * 1000)
    rerender()
    expect(result.current.isDismissed).toBe(true)

    // Advance past 7 days - should no longer be dismissed
    vi.setSystemTime(now + 8 * 24 * 60 * 60 * 1000)
    rerender()
    expect(result.current.isDismissed).toBe(false)
  })

  it("tracks queriesAtDismissal", () => {
    const { result } = renderHook(() => useCTADismissal({ surface: "MARKETING" }))

    act(() => {
      result.current.dismiss(5)
    })

    const stored = JSON.parse(localStorage.getItem("assistant_cta_dismissed_marketing")!)
    expect(stored.queriesAtDismissal).toBe(5)
  })

  it("resets dismissal after 2 more successful queries post-cooldown", () => {
    const { result } = renderHook(() => useCTADismissal({ surface: "MARKETING" }))

    act(() => {
      result.current.dismiss(3)
    })

    // Record 2 more successful queries
    act(() => {
      result.current.recordSuccessfulQuery()
      result.current.recordSuccessfulQuery()
    })

    // After 2 more queries, can show CTA again (after cooldown expires)
    expect(result.current.queriesSinceDismissal).toBe(2)
  })
})
