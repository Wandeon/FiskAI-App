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
