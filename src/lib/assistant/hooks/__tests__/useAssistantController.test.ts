/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useAssistantController } from "../useAssistantController"

describe("useAssistantController", () => {
  it("initializes with IDLE status", () => {
    const { result } = renderHook(() => useAssistantController({ surface: "MARKETING" }))

    expect(result.current.state.status).toBe("IDLE")
    expect(result.current.state.activeQuery).toBeNull()
    expect(result.current.state.activeAnswer).toBeNull()
    expect(result.current.state.history).toEqual([])
    expect(result.current.state.error).toBeNull()
    expect(result.current.state.retryCount).toBe(0)
  })

  it("provides surface from props", () => {
    const { result } = renderHook(() => useAssistantController({ surface: "APP" }))
    expect(result.current.surface).toBe("APP")
  })

  describe("submit action", () => {
    it("transitions to LOADING and sets query", async () => {
      const { result } = renderHook(() => useAssistantController({ surface: "MARKETING" }))

      await act(async () => {
        result.current.submit("What is VAT rate?")
      })

      expect(result.current.state.status).toBe("LOADING")
      expect(result.current.state.activeQuery).toBe("What is VAT rate?")
      expect(result.current.state.activeRequestId).toBeTruthy()
    })

    it("cancels previous request when submitting during LOADING", async () => {
      const { result } = renderHook(() => useAssistantController({ surface: "MARKETING" }))

      await act(async () => {
        result.current.submit("First query")
      })

      const firstRequestId = result.current.state.activeRequestId

      await act(async () => {
        result.current.submit("Second query")
      })

      expect(result.current.state.activeRequestId).not.toBe(firstRequestId)
      expect(result.current.state.activeQuery).toBe("Second query")
    })
  })

  describe("streaming updates", () => {
    it("transitions to STREAMING on first data", () => {
      const { result } = renderHook(() => useAssistantController({ surface: "MARKETING" }))

      act(() => {
        result.current.dispatch({ type: "SUBMIT", query: "test", requestId: "req_1" })
      })

      act(() => {
        result.current.dispatch({ type: "STREAM_START" })
      })

      expect(result.current.state.status).toBe("STREAMING")
    })

    it("updates stream progress as fields arrive", () => {
      const { result } = renderHook(() => useAssistantController({ surface: "MARKETING" }))

      act(() => {
        result.current.dispatch({ type: "SUBMIT", query: "test", requestId: "req_1" })
        result.current.dispatch({ type: "STREAM_START" })
        result.current.dispatch({
          type: "STREAM_UPDATE",
          data: { headline: "VAT rate is 25%" },
        })
      })

      expect(result.current.state.streamProgress.headline).toBe(true)
      expect(result.current.state.activeAnswer?.headline).toBe("VAT rate is 25%")
    })
  })
})
