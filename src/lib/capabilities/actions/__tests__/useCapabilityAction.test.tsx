/**
 * useCapabilityAction Hook Tests
 *
 * Tests for the client-side hook that executes capability actions
 * with loading states and error handling.
 *
 * @module capabilities/actions
 * @since PHASE 2 - Capability-Driven Actions
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import type { ActionResult } from "../types"

// Mock the executor module
vi.mock("../executor", () => ({
  executeCapabilityAction: vi.fn(),
}))

// Import the mocked function
import { executeCapabilityAction } from "../executor"

// Cast mock for type safety
const mockExecuteCapabilityAction = executeCapabilityAction as ReturnType<typeof vi.fn>

// Import hook after mocks are set up
import { useCapabilityAction } from "../useCapabilityAction"

describe("useCapabilityAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("initial state", () => {
    it("should start with isLoading false", () => {
      const { result } = renderHook(() =>
        useCapabilityAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
        })
      )

      expect(result.current.isLoading).toBe(false)
    })

    it("should start with error null", () => {
      const { result } = renderHook(() =>
        useCapabilityAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
        })
      )

      expect(result.current.error).toBeNull()
    })

    it("should start with data null", () => {
      const { result } = renderHook(() =>
        useCapabilityAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
        })
      )

      expect(result.current.data).toBeNull()
    })

    it("should provide an execute function", () => {
      const { result } = renderHook(() =>
        useCapabilityAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
        })
      )

      expect(typeof result.current.execute).toBe("function")
    })

    it("should provide a reset function", () => {
      const { result } = renderHook(() =>
        useCapabilityAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
        })
      )

      expect(typeof result.current.reset).toBe("function")
    })
  })

  describe("execute", () => {
    it("should set isLoading to true during execution", async () => {
      let resolvePromise: (value: ActionResult) => void
      const pendingPromise = new Promise<ActionResult>((resolve) => {
        resolvePromise = resolve
      })
      mockExecuteCapabilityAction.mockReturnValue(pendingPromise)

      const { result } = renderHook(() =>
        useCapabilityAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
        })
      )

      act(() => {
        result.current.execute()
      })

      expect(result.current.isLoading).toBe(true)

      // Clean up by resolving
      await act(async () => {
        resolvePromise!({ success: true })
      })
    })

    it("should set isLoading to false after successful execution", async () => {
      mockExecuteCapabilityAction.mockResolvedValue({
        success: true,
        data: { jir: "jir-123" },
      })

      const { result } = renderHook(() =>
        useCapabilityAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
        })
      )

      await act(async () => {
        await result.current.execute()
      })

      expect(result.current.isLoading).toBe(false)
    })

    it("should set isLoading to false after failed execution", async () => {
      mockExecuteCapabilityAction.mockResolvedValue({
        success: false,
        error: "Action failed",
        code: "INTERNAL_ERROR",
      })

      const { result } = renderHook(() =>
        useCapabilityAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
        })
      )

      await act(async () => {
        await result.current.execute()
      })

      expect(result.current.isLoading).toBe(false)
    })

    it("should set data on successful execution", async () => {
      const expectedData = { jir: "jir-123", zki: "zki-456" }
      mockExecuteCapabilityAction.mockResolvedValue({
        success: true,
        data: expectedData,
      })

      const { result } = renderHook(() =>
        useCapabilityAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
        })
      )

      await act(async () => {
        await result.current.execute()
      })

      expect(result.current.data).toEqual(expectedData)
    })

    it("should clear error on successful execution", async () => {
      // First, set an error
      mockExecuteCapabilityAction.mockResolvedValueOnce({
        success: false,
        error: "First error",
      })

      const { result } = renderHook(() =>
        useCapabilityAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
        })
      )

      await act(async () => {
        await result.current.execute()
      })

      expect(result.current.error).toBe("First error")

      // Now succeed
      mockExecuteCapabilityAction.mockResolvedValueOnce({
        success: true,
        data: { jir: "jir-123" },
      })

      await act(async () => {
        await result.current.execute()
      })

      expect(result.current.error).toBeNull()
    })

    it("should set error on failed execution", async () => {
      mockExecuteCapabilityAction.mockResolvedValue({
        success: false,
        error: "Capability blocked",
        code: "CAPABILITY_BLOCKED",
      })

      const { result } = renderHook(() =>
        useCapabilityAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
        })
      )

      await act(async () => {
        await result.current.execute()
      })

      expect(result.current.error).toBe("Capability blocked")
    })

    it("should clear data on failed execution", async () => {
      // First, succeed
      mockExecuteCapabilityAction.mockResolvedValueOnce({
        success: true,
        data: { jir: "jir-123" },
      })

      const { result } = renderHook(() =>
        useCapabilityAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
        })
      )

      await act(async () => {
        await result.current.execute()
      })

      expect(result.current.data).toEqual({ jir: "jir-123" })

      // Now fail
      mockExecuteCapabilityAction.mockResolvedValueOnce({
        success: false,
        error: "Second call failed",
      })

      await act(async () => {
        await result.current.execute()
      })

      expect(result.current.data).toBeNull()
    })

    it("should pass capabilityId and actionId to executor", async () => {
      mockExecuteCapabilityAction.mockResolvedValue({ success: true })

      const { result } = renderHook(() =>
        useCapabilityAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
        })
      )

      await act(async () => {
        await result.current.execute()
      })

      expect(mockExecuteCapabilityAction).toHaveBeenCalledWith(
        expect.objectContaining({
          capabilityId: "INV-003",
          actionId: "fiscalize",
        })
      )
    })

    it("should pass entityId and entityType to executor", async () => {
      mockExecuteCapabilityAction.mockResolvedValue({ success: true })

      const { result } = renderHook(() =>
        useCapabilityAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
          entityId: "invoice-123",
          entityType: "Invoice",
        })
      )

      await act(async () => {
        await result.current.execute()
      })

      expect(mockExecuteCapabilityAction).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: "invoice-123",
          entityType: "Invoice",
        })
      )
    })

    it("should pass params to executor", async () => {
      mockExecuteCapabilityAction.mockResolvedValue({ success: true })

      const { result } = renderHook(() =>
        useCapabilityAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
        })
      )

      await act(async () => {
        await result.current.execute({ extra: "data", count: 42 })
      })

      expect(mockExecuteCapabilityAction).toHaveBeenCalledWith(
        expect.objectContaining({
          params: { extra: "data", count: 42 },
        })
      )
    })

    it("should return the ActionResult from execute", async () => {
      const expectedResult: ActionResult = {
        success: true,
        data: { jir: "jir-123" },
      }
      mockExecuteCapabilityAction.mockResolvedValue(expectedResult)

      const { result } = renderHook(() =>
        useCapabilityAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
        })
      )

      let returnedResult: ActionResult | undefined
      await act(async () => {
        returnedResult = await result.current.execute()
      })

      expect(returnedResult).toEqual(expectedResult)
    })

    it("should handle exceptions from executor", async () => {
      mockExecuteCapabilityAction.mockRejectedValue(new Error("Network error"))

      const { result } = renderHook(() =>
        useCapabilityAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
        })
      )

      await act(async () => {
        await result.current.execute()
      })

      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe("Network error")
      expect(result.current.data).toBeNull()
    })

    it("should handle non-Error exceptions from executor", async () => {
      mockExecuteCapabilityAction.mockRejectedValue("string error")

      const { result } = renderHook(() =>
        useCapabilityAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
        })
      )

      await act(async () => {
        await result.current.execute()
      })

      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe("An unexpected error occurred")
      expect(result.current.data).toBeNull()
    })
  })

  describe("callbacks", () => {
    it("should call onSuccess callback on successful execution", async () => {
      const onSuccess = vi.fn()
      const expectedResult: ActionResult = {
        success: true,
        data: { jir: "jir-123" },
      }
      mockExecuteCapabilityAction.mockResolvedValue(expectedResult)

      const { result } = renderHook(() =>
        useCapabilityAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
          onSuccess,
        })
      )

      await act(async () => {
        await result.current.execute()
      })

      expect(onSuccess).toHaveBeenCalledWith(expectedResult)
    })

    it("should not call onSuccess callback on failed execution", async () => {
      const onSuccess = vi.fn()
      mockExecuteCapabilityAction.mockResolvedValue({
        success: false,
        error: "Action failed",
      })

      const { result } = renderHook(() =>
        useCapabilityAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
          onSuccess,
        })
      )

      await act(async () => {
        await result.current.execute()
      })

      expect(onSuccess).not.toHaveBeenCalled()
    })

    it("should call onError callback on failed execution", async () => {
      const onError = vi.fn()
      mockExecuteCapabilityAction.mockResolvedValue({
        success: false,
        error: "Capability blocked",
      })

      const { result } = renderHook(() =>
        useCapabilityAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
          onError,
        })
      )

      await act(async () => {
        await result.current.execute()
      })

      expect(onError).toHaveBeenCalledWith("Capability blocked")
    })

    it("should not call onError callback on successful execution", async () => {
      const onError = vi.fn()
      mockExecuteCapabilityAction.mockResolvedValue({
        success: true,
        data: { jir: "jir-123" },
      })

      const { result } = renderHook(() =>
        useCapabilityAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
          onError,
        })
      )

      await act(async () => {
        await result.current.execute()
      })

      expect(onError).not.toHaveBeenCalled()
    })

    it("should call onError callback on exception", async () => {
      const onError = vi.fn()
      mockExecuteCapabilityAction.mockRejectedValue(new Error("Network error"))

      const { result } = renderHook(() =>
        useCapabilityAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
          onError,
        })
      )

      await act(async () => {
        await result.current.execute()
      })

      expect(onError).toHaveBeenCalledWith("Network error")
    })
  })

  describe("reset", () => {
    it("should clear error on reset", async () => {
      mockExecuteCapabilityAction.mockResolvedValue({
        success: false,
        error: "Action failed",
      })

      const { result } = renderHook(() =>
        useCapabilityAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
        })
      )

      await act(async () => {
        await result.current.execute()
      })

      expect(result.current.error).toBe("Action failed")

      act(() => {
        result.current.reset()
      })

      expect(result.current.error).toBeNull()
    })

    it("should clear data on reset", async () => {
      mockExecuteCapabilityAction.mockResolvedValue({
        success: true,
        data: { jir: "jir-123" },
      })

      const { result } = renderHook(() =>
        useCapabilityAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
        })
      )

      await act(async () => {
        await result.current.execute()
      })

      expect(result.current.data).toEqual({ jir: "jir-123" })

      act(() => {
        result.current.reset()
      })

      expect(result.current.data).toBeNull()
    })

    it("should not affect isLoading on reset", async () => {
      mockExecuteCapabilityAction.mockResolvedValue({ success: true })

      const { result } = renderHook(() =>
        useCapabilityAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
        })
      )

      // isLoading should be false initially
      expect(result.current.isLoading).toBe(false)

      act(() => {
        result.current.reset()
      })

      // isLoading should still be false after reset
      expect(result.current.isLoading).toBe(false)
    })
  })

  describe("typed data", () => {
    interface FiscalizeResult {
      jir: string
      zki: string
    }

    it("should support generic type for data", async () => {
      const expectedData: FiscalizeResult = { jir: "jir-123", zki: "zki-456" }
      mockExecuteCapabilityAction.mockResolvedValue({
        success: true,
        data: expectedData,
      })

      const { result } = renderHook(() =>
        useCapabilityAction<FiscalizeResult>({
          capabilityId: "INV-003",
          actionId: "fiscalize",
        })
      )

      await act(async () => {
        await result.current.execute()
      })

      // TypeScript should allow accessing typed properties
      expect(result.current.data?.jir).toBe("jir-123")
      expect(result.current.data?.zki).toBe("zki-456")
    })
  })
})
