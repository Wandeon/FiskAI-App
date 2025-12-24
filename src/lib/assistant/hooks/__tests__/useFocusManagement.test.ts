// src/lib/assistant/hooks/__tests__/useFocusManagement.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useFocusManagement } from "../useFocusManagement"

describe("useFocusManagement", () => {
  let headlineRef: { current: HTMLHeadingElement | null }
  let inputRef: { current: HTMLTextAreaElement | null }

  beforeEach(() => {
    // Create mock DOM elements
    const headline = document.createElement("h2")
    headline.tabIndex = -1
    document.body.appendChild(headline)

    const input = document.createElement("textarea")
    document.body.appendChild(input)

    headlineRef = { current: headline }
    inputRef = { current: input }
  })

  it("focuses headline when status changes to COMPLETE", async () => {
    const focusSpy = vi.spyOn(headlineRef.current!, "focus")

    const { rerender } = renderHook(
      ({ status }) => useFocusManagement({ status, headlineRef, inputRef }),
      { initialProps: { status: "LOADING" as const } }
    )

    act(() => {
      rerender({ status: "COMPLETE" as const })
    })

    // Wait for requestAnimationFrame
    await new Promise((resolve) => requestAnimationFrame(resolve))

    expect(focusSpy).toHaveBeenCalled()
  })

  it("focuses input when status changes to IDLE from COMPLETE", () => {
    const focusSpy = vi.spyOn(inputRef.current!, "focus")

    const { rerender } = renderHook(
      ({ status }) => useFocusManagement({ status, headlineRef, inputRef }),
      { initialProps: { status: "COMPLETE" as const } }
    )

    rerender({ status: "IDLE" as const })

    expect(focusSpy).toHaveBeenCalled()
  })

  it("does not move focus during STREAMING", () => {
    const headlineFocusSpy = vi.spyOn(headlineRef.current!, "focus")
    const inputFocusSpy = vi.spyOn(inputRef.current!, "focus")

    const { rerender } = renderHook(
      ({ status }) => useFocusManagement({ status, headlineRef, inputRef }),
      { initialProps: { status: "LOADING" as const } }
    )

    rerender({ status: "STREAMING" as const })

    expect(headlineFocusSpy).not.toHaveBeenCalled()
    expect(inputFocusSpy).not.toHaveBeenCalled()
  })

  it("focuses headline on ERROR state", async () => {
    const focusSpy = vi.spyOn(headlineRef.current!, "focus")

    const { rerender } = renderHook(
      ({ status }) => useFocusManagement({ status, headlineRef, inputRef }),
      { initialProps: { status: "LOADING" as const } }
    )

    act(() => {
      rerender({ status: "ERROR" as const })
    })

    // Wait for requestAnimationFrame
    await new Promise((resolve) => requestAnimationFrame(resolve))

    expect(focusSpy).toHaveBeenCalled()
  })

  it("returns focusHeadline and focusInput functions", () => {
    const { result } = renderHook(() =>
      useFocusManagement({ status: "IDLE", headlineRef, inputRef })
    )

    expect(typeof result.current.focusHeadline).toBe("function")
    expect(typeof result.current.focusInput).toBe("function")
  })
})
