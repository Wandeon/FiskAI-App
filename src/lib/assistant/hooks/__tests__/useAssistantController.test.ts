/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useAssistantController } from "../useAssistantController"
import { SCHEMA_VERSION, type AssistantResponse } from "../../types"

const mockResponse: AssistantResponse = {
  schemaVersion: SCHEMA_VERSION,
  requestId: "req_1",
  traceId: "trace_1",
  kind: "ANSWER",
  topic: "REGULATORY",
  surface: "MARKETING",
  createdAt: new Date().toISOString(),
  headline: "VAT rate is 25%",
  directAnswer: "Standard VAT rate in Croatia is 25%.",
}

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

  describe("complete action", () => {
    it("transitions to COMPLETE and adds to history", () => {
      const { result } = renderHook(() => useAssistantController({ surface: "MARKETING" }))

      act(() => {
        result.current.dispatch({ type: "SUBMIT", query: "What is VAT?", requestId: "req_1" })
        result.current.dispatch({ type: "COMPLETE", response: mockResponse })
      })

      expect(result.current.state.status).toBe("COMPLETE")
      expect(result.current.state.activeAnswer).toEqual(mockResponse)
      expect(result.current.state.history).toHaveLength(1)
      expect(result.current.state.history[0].query).toBe("What is VAT?")
    })
  })

  describe("error action", () => {
    it("transitions to ERROR and stores error", () => {
      const { result } = renderHook(() => useAssistantController({ surface: "MARKETING" }))

      act(() => {
        result.current.dispatch({ type: "SUBMIT", query: "test", requestId: "req_1" })
        result.current.dispatch({
          type: "ERROR",
          error: { type: "NETWORK_FAILURE", message: "Connection failed" },
        })
      })

      expect(result.current.state.status).toBe("ERROR")
      expect(result.current.state.error?.type).toBe("NETWORK_FAILURE")
    })
  })

  describe("history restore", () => {
    it("restores previous answer from history", () => {
      const { result } = renderHook(() => useAssistantController({ surface: "MARKETING" }))

      // Complete first query
      act(() => {
        result.current.dispatch({ type: "SUBMIT", query: "First query", requestId: "req_1" })
        result.current.dispatch({ type: "COMPLETE", response: mockResponse })
      })

      // Complete second query
      const secondResponse = { ...mockResponse, headline: "Second answer" }
      act(() => {
        result.current.dispatch({ type: "SUBMIT", query: "Second query", requestId: "req_2" })
        result.current.dispatch({ type: "COMPLETE", response: secondResponse })
      })

      // Restore first
      act(() => {
        result.current.dispatch({ type: "RESTORE_HISTORY", index: 0 })
      })

      expect(result.current.state.activeAnswer?.headline).toBe("VAT rate is 25%")
      expect(result.current.state.activeQuery).toBe("First query")
    })
  })
})
