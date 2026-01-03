/**
 * useBatchAction Hook Tests
 *
 * Tests for the client-side hook that executes batch capability actions
 * with loading states, progress tracking, and callbacks.
 *
 * @module capabilities/actions
 * @since PHASE 4 - Capability Batch Actions
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"

// Mock the batch executor
vi.mock("../batch-executor", () => ({
  executeBatchAction: vi.fn(),
}))

// Mock capability resolution
vi.mock("@/hooks/use-capability-resolution", () => ({
  revalidateCapabilityResolution: vi.fn().mockResolvedValue(undefined),
}))

import { useBatchAction } from "../useBatchAction"
import { executeBatchAction } from "../batch-executor"
import { revalidateCapabilityResolution } from "@/hooks/use-capability-resolution"

// Cast mocks for type safety
const mockExecuteBatchAction = executeBatchAction as ReturnType<typeof vi.fn>
const mockRevalidateCapabilities = revalidateCapabilityResolution as ReturnType<typeof vi.fn>

describe("useBatchAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("initial state", () => {
    it("returns initial state with execute function", () => {
      const { result } = renderHook(() =>
        useBatchAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
          entityType: "Invoice",
        })
      )

      expect(result.current.isLoading).toBe(false)
      expect(result.current.progress).toBeNull()
      expect(result.current.result).toBeNull()
      expect(typeof result.current.execute).toBe("function")
    })

    it("should provide a reset function", () => {
      const { result } = renderHook(() =>
        useBatchAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
          entityType: "Invoice",
        })
      )

      expect(typeof result.current.reset).toBe("function")
    })
  })

  describe("execute", () => {
    it("executes batch action and updates state", async () => {
      mockExecuteBatchAction.mockResolvedValue({
        total: 2,
        succeeded: 2,
        failed: 0,
        results: [
          { entityId: "inv-1", success: true },
          { entityId: "inv-2", success: true },
        ],
      })

      const onComplete = vi.fn()
      const { result } = renderHook(() =>
        useBatchAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
          entityType: "Invoice",
          onComplete,
        })
      )

      await act(async () => {
        await result.current.execute(["inv-1", "inv-2"])
      })

      expect(result.current.isLoading).toBe(false)
      expect(result.current.result?.succeeded).toBe(2)
      expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ succeeded: 2 }))
    })

    it("should set isLoading to true during execution", async () => {
      let resolvePromise: (value: unknown) => void
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      mockExecuteBatchAction.mockReturnValue(pendingPromise)

      const { result } = renderHook(() =>
        useBatchAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
          entityType: "Invoice",
        })
      )

      act(() => {
        result.current.execute(["inv-1"])
      })

      expect(result.current.isLoading).toBe(true)

      // Clean up by resolving
      await act(async () => {
        resolvePromise!({
          total: 1,
          succeeded: 1,
          failed: 0,
          results: [{ entityId: "inv-1", success: true }],
        })
      })
    })

    it("should set isLoading to false after successful execution", async () => {
      mockExecuteBatchAction.mockResolvedValue({
        total: 1,
        succeeded: 1,
        failed: 0,
        results: [{ entityId: "inv-1", success: true }],
      })

      const { result } = renderHook(() =>
        useBatchAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
          entityType: "Invoice",
        })
      )

      await act(async () => {
        await result.current.execute(["inv-1"])
      })

      expect(result.current.isLoading).toBe(false)
    })

    it("should pass correct parameters to executeBatchAction", async () => {
      mockExecuteBatchAction.mockResolvedValue({
        total: 2,
        succeeded: 2,
        failed: 0,
        results: [
          { entityId: "inv-1", success: true },
          { entityId: "inv-2", success: true },
        ],
      })

      const { result } = renderHook(() =>
        useBatchAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
          entityType: "Invoice",
          params: { extra: "data" },
          continueOnError: false,
        })
      )

      await act(async () => {
        await result.current.execute(["inv-1", "inv-2"])
      })

      expect(mockExecuteBatchAction).toHaveBeenCalledWith({
        capabilityId: "INV-003",
        actionId: "fiscalize",
        entityIds: ["inv-1", "inv-2"],
        entityType: "Invoice",
        params: { extra: "data" },
        continueOnError: false,
      })
    })

    it("should return the BatchActionResult from execute", async () => {
      const expectedResult = {
        total: 2,
        succeeded: 2,
        failed: 0,
        results: [
          { entityId: "inv-1", success: true },
          { entityId: "inv-2", success: true },
        ],
      }
      mockExecuteBatchAction.mockResolvedValue(expectedResult)

      const { result } = renderHook(() =>
        useBatchAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
          entityType: "Invoice",
        })
      )

      let returnedResult: unknown
      await act(async () => {
        returnedResult = await result.current.execute(["inv-1", "inv-2"])
      })

      expect(returnedResult).toEqual(expectedResult)
    })

    it("should handle partial failures", async () => {
      mockExecuteBatchAction.mockResolvedValue({
        total: 3,
        succeeded: 2,
        failed: 1,
        results: [
          { entityId: "inv-1", success: true },
          { entityId: "inv-2", success: false, error: "Already fiscalized" },
          { entityId: "inv-3", success: true },
        ],
      })

      const { result } = renderHook(() =>
        useBatchAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
          entityType: "Invoice",
        })
      )

      await act(async () => {
        await result.current.execute(["inv-1", "inv-2", "inv-3"])
      })

      expect(result.current.result?.succeeded).toBe(2)
      expect(result.current.result?.failed).toBe(1)
      expect(result.current.result?.results[1].error).toBe("Already fiscalized")
    })

    it("should handle complete batch failure with exception", async () => {
      mockExecuteBatchAction.mockRejectedValue(new Error("Server error"))

      const { result } = renderHook(() =>
        useBatchAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
          entityType: "Invoice",
        })
      )

      await act(async () => {
        await result.current.execute(["inv-1", "inv-2"])
      })

      expect(result.current.isLoading).toBe(false)
      expect(result.current.result?.succeeded).toBe(0)
      expect(result.current.result?.failed).toBe(2)
      expect(result.current.result?.results[0].error).toBe("Server error")
    })
  })

  describe("progress tracking", () => {
    it("should initialize progress when execution starts", async () => {
      let resolvePromise: (value: unknown) => void
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      mockExecuteBatchAction.mockReturnValue(pendingPromise)

      const { result } = renderHook(() =>
        useBatchAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
          entityType: "Invoice",
        })
      )

      act(() => {
        result.current.execute(["inv-1", "inv-2", "inv-3"])
      })

      expect(result.current.progress).toEqual({
        completed: 0,
        total: 3,
        percent: 0,
      })

      // Clean up by resolving
      await act(async () => {
        resolvePromise!({
          total: 3,
          succeeded: 3,
          failed: 0,
          results: [
            { entityId: "inv-1", success: true },
            { entityId: "inv-2", success: true },
            { entityId: "inv-3", success: true },
          ],
        })
      })
    })

    it("should update progress to 100% on completion", async () => {
      mockExecuteBatchAction.mockResolvedValue({
        total: 2,
        succeeded: 2,
        failed: 0,
        results: [
          { entityId: "inv-1", success: true },
          { entityId: "inv-2", success: true },
        ],
      })

      const { result } = renderHook(() =>
        useBatchAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
          entityType: "Invoice",
        })
      )

      await act(async () => {
        await result.current.execute(["inv-1", "inv-2"])
      })

      expect(result.current.progress).toEqual({
        completed: 2,
        total: 2,
        percent: 100,
      })
    })

    it("should call onProgress callback", async () => {
      mockExecuteBatchAction.mockResolvedValue({
        total: 2,
        succeeded: 2,
        failed: 0,
        results: [
          { entityId: "inv-1", success: true },
          { entityId: "inv-2", success: true },
        ],
      })

      const onProgress = vi.fn()
      const { result } = renderHook(() =>
        useBatchAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
          entityType: "Invoice",
          onProgress,
        })
      )

      await act(async () => {
        await result.current.execute(["inv-1", "inv-2"])
      })

      expect(onProgress).toHaveBeenCalledWith({
        completed: 2,
        total: 2,
        percent: 100,
      })
    })
  })

  describe("reset", () => {
    it("resets state correctly", async () => {
      mockExecuteBatchAction.mockResolvedValue({
        total: 1,
        succeeded: 1,
        failed: 0,
        results: [{ entityId: "inv-1", success: true }],
      })

      const { result } = renderHook(() =>
        useBatchAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
          entityType: "Invoice",
        })
      )

      await act(async () => {
        await result.current.execute(["inv-1"])
      })

      expect(result.current.result).not.toBeNull()

      act(() => {
        result.current.reset()
      })

      expect(result.current.result).toBeNull()
      expect(result.current.progress).toBeNull()
    })

    it("should not affect isLoading on reset", async () => {
      mockExecuteBatchAction.mockResolvedValue({
        total: 1,
        succeeded: 1,
        failed: 0,
        results: [{ entityId: "inv-1", success: true }],
      })

      const { result } = renderHook(() =>
        useBatchAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
          entityType: "Invoice",
        })
      )

      await act(async () => {
        await result.current.execute(["inv-1"])
      })

      expect(result.current.isLoading).toBe(false)

      act(() => {
        result.current.reset()
      })

      expect(result.current.isLoading).toBe(false)
    })
  })

  describe("capability revalidation", () => {
    it("should trigger revalidateCapabilityResolution for all entities on success", async () => {
      mockExecuteBatchAction.mockResolvedValue({
        total: 2,
        succeeded: 2,
        failed: 0,
        results: [
          { entityId: "inv-1", success: true },
          { entityId: "inv-2", success: true },
        ],
      })

      const { result } = renderHook(() =>
        useBatchAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
          entityType: "Invoice",
        })
      )

      await act(async () => {
        await result.current.execute(["inv-1", "inv-2"])
      })

      expect(mockRevalidateCapabilities).toHaveBeenCalledWith("inv-1")
      expect(mockRevalidateCapabilities).toHaveBeenCalledWith("inv-2")
    })

    it("should still complete successfully if revalidation fails", async () => {
      mockRevalidateCapabilities.mockRejectedValue(new Error("SWR error"))
      mockExecuteBatchAction.mockResolvedValue({
        total: 1,
        succeeded: 1,
        failed: 0,
        results: [{ entityId: "inv-1", success: true }],
      })

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

      const { result } = renderHook(() =>
        useBatchAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
          entityType: "Invoice",
        })
      )

      await act(async () => {
        await result.current.execute(["inv-1"])
      })

      expect(result.current.result?.succeeded).toBe(1)
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe("callbacks", () => {
    it("should call onComplete with result on success", async () => {
      const expectedResult = {
        total: 2,
        succeeded: 2,
        failed: 0,
        results: [
          { entityId: "inv-1", success: true },
          { entityId: "inv-2", success: true },
        ],
      }
      mockExecuteBatchAction.mockResolvedValue(expectedResult)

      const onComplete = vi.fn()
      const { result } = renderHook(() =>
        useBatchAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
          entityType: "Invoice",
          onComplete,
        })
      )

      await act(async () => {
        await result.current.execute(["inv-1", "inv-2"])
      })

      expect(onComplete).toHaveBeenCalledWith(expectedResult)
    })

    it("should call onComplete even on partial failure", async () => {
      const partialResult = {
        total: 2,
        succeeded: 1,
        failed: 1,
        results: [
          { entityId: "inv-1", success: true },
          { entityId: "inv-2", success: false, error: "Failed" },
        ],
      }
      mockExecuteBatchAction.mockResolvedValue(partialResult)

      const onComplete = vi.fn()
      const { result } = renderHook(() =>
        useBatchAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
          entityType: "Invoice",
          onComplete,
        })
      )

      await act(async () => {
        await result.current.execute(["inv-1", "inv-2"])
      })

      expect(onComplete).toHaveBeenCalledWith(partialResult)
    })

    it("should call onComplete on exception with error result", async () => {
      mockExecuteBatchAction.mockRejectedValue(new Error("Server error"))

      const onComplete = vi.fn()
      const { result } = renderHook(() =>
        useBatchAction({
          capabilityId: "INV-003",
          actionId: "fiscalize",
          entityType: "Invoice",
          onComplete,
        })
      )

      await act(async () => {
        await result.current.execute(["inv-1", "inv-2"])
      })

      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          total: 2,
          succeeded: 0,
          failed: 2,
        })
      )
    })
  })
})
