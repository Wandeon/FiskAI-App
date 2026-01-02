// src/lib/assistant/hooks/__tests__/useReducedMotion.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any -- Test file uses partial mocks */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { useReducedMotion } from "../useReducedMotion"

describe("useReducedMotion", () => {
  let matchMediaMock: any

  beforeEach(() => {
    matchMediaMock = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    window.matchMedia = matchMediaMock
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns false when prefers-reduced-motion is not set", () => {
    const { result } = renderHook(() => useReducedMotion())

    expect(result.current).toBe(false)
  })

  it("returns true when prefers-reduced-motion: reduce is set", () => {
    matchMediaMock.mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))

    const { result } = renderHook(() => useReducedMotion())

    expect(result.current).toBe(true)
  })

  it("adds event listener for media query changes", () => {
    const addEventListenerMock = vi.fn()
    matchMediaMock.mockImplementation(() => ({
      matches: false,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: addEventListenerMock,
      removeEventListener: vi.fn(),
    }))

    renderHook(() => useReducedMotion())

    expect(addEventListenerMock).toHaveBeenCalledWith("change", expect.any(Function))
  })

  it("removes event listener on unmount", () => {
    const removeEventListenerMock = vi.fn()
    matchMediaMock.mockImplementation(() => ({
      matches: false,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: vi.fn(),
      removeEventListener: removeEventListenerMock,
    }))

    const { unmount } = renderHook(() => useReducedMotion())

    unmount()

    expect(removeEventListenerMock).toHaveBeenCalled()
  })
})
