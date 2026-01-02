// src/lib/assistant/hooks/__tests__/useRovingTabindex.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any -- Test file uses partial mocks */
import { describe, it, expect } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useRovingTabindex } from "../useRovingTabindex"

describe("useRovingTabindex", () => {
  it("initializes with first item active", () => {
    const { result } = renderHook(() => useRovingTabindex({ itemCount: 5 }))

    expect(result.current.activeIndex).toBe(0)
  })

  it("moves to next item on ArrowRight", () => {
    const { result } = renderHook(() => useRovingTabindex({ itemCount: 5 }))

    act(() => {
      result.current.handleKeyDown({ key: "ArrowRight", preventDefault: () => {} } as any)
    })

    expect(result.current.activeIndex).toBe(1)
  })

  it("moves to previous item on ArrowLeft", () => {
    const { result } = renderHook(() => useRovingTabindex({ itemCount: 5, initialIndex: 2 }))

    act(() => {
      result.current.handleKeyDown({ key: "ArrowLeft", preventDefault: () => {} } as any)
    })

    expect(result.current.activeIndex).toBe(1)
  })

  it("wraps around at the end", () => {
    const { result } = renderHook(() => useRovingTabindex({ itemCount: 3, initialIndex: 2 }))

    act(() => {
      result.current.handleKeyDown({ key: "ArrowRight", preventDefault: () => {} } as any)
    })

    expect(result.current.activeIndex).toBe(0)
  })

  it("wraps around at the beginning", () => {
    const { result } = renderHook(() => useRovingTabindex({ itemCount: 3, initialIndex: 0 }))

    act(() => {
      result.current.handleKeyDown({ key: "ArrowLeft", preventDefault: () => {} } as any)
    })

    expect(result.current.activeIndex).toBe(2)
  })

  it("moves to first item on Home", () => {
    const { result } = renderHook(() => useRovingTabindex({ itemCount: 5, initialIndex: 3 }))

    act(() => {
      result.current.handleKeyDown({ key: "Home", preventDefault: () => {} } as any)
    })

    expect(result.current.activeIndex).toBe(0)
  })

  it("moves to last item on End", () => {
    const { result } = renderHook(() => useRovingTabindex({ itemCount: 5, initialIndex: 1 }))

    act(() => {
      result.current.handleKeyDown({ key: "End", preventDefault: () => {} } as any)
    })

    expect(result.current.activeIndex).toBe(4)
  })

  it("provides setActiveIndex function", () => {
    const { result } = renderHook(() => useRovingTabindex({ itemCount: 5 }))

    act(() => {
      result.current.setActiveIndex(3)
    })

    expect(result.current.activeIndex).toBe(3)
  })

  it("returns getTabIndex that returns 0 for active, -1 for others", () => {
    const { result } = renderHook(() => useRovingTabindex({ itemCount: 3, initialIndex: 1 }))

    expect(result.current.getTabIndex(0)).toBe(-1)
    expect(result.current.getTabIndex(1)).toBe(0)
    expect(result.current.getTabIndex(2)).toBe(-1)
  })
})
