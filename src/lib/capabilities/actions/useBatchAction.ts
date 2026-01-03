"use client"

/**
 * useBatchAction Hook
 *
 * Client-side React hook for executing batch capability actions with
 * loading states, progress tracking, and callbacks.
 *
 * @module capabilities/actions
 * @since PHASE 4 - Capability Batch Actions
 */

import { useState, useCallback } from "react"
import { executeBatchAction } from "./batch-executor"
import { revalidateCapabilityResolution } from "@/hooks/use-capability-resolution"
import type { BatchActionResult } from "./batch-types"

/**
 * Progress state for batch operations.
 */
export interface BatchProgress {
  /** Number of entities completed */
  completed: number
  /** Total number of entities */
  total: number
  /** Percentage complete (0-100) */
  percent: number
}

/**
 * Options for the useBatchAction hook.
 */
export interface UseBatchActionOptions {
  /** Capability ID (e.g., "INV-003") */
  capabilityId: string

  /** Action ID within the capability (e.g., "fiscalize") */
  actionId: string

  /** Entity type (e.g., "Invoice") */
  entityType: string

  /** Additional action-specific parameters */
  params?: Record<string, unknown>

  /** Continue on failure (default: true) */
  continueOnError?: boolean

  /** Callback invoked when batch completes */
  onComplete?: (result: BatchActionResult) => void

  /** Callback invoked on partial progress */
  onProgress?: (progress: BatchProgress) => void
}

/**
 * Return type for the useBatchAction hook.
 */
export interface UseBatchActionReturn {
  /** Execute the batch action on given entity IDs */
  execute: (entityIds: string[]) => Promise<BatchActionResult>

  /** Whether the batch is currently executing */
  isLoading: boolean

  /** Current progress (null if not executing) */
  progress: BatchProgress | null

  /** Result of the last batch execution (null if not executed) */
  result: BatchActionResult | null

  /** Reset state to initial */
  reset: () => void
}

/**
 * React hook for executing batch capability actions.
 *
 * @param options - Hook configuration options
 * @returns Hook state and methods
 *
 * @example
 * ```tsx
 * function BulkFiscalizeButton({ selectedIds }: { selectedIds: string[] }) {
 *   const { execute, isLoading, progress, result } = useBatchAction({
 *     capabilityId: "INV-003",
 *     actionId: "fiscalize",
 *     entityType: "Invoice",
 *     onComplete: (result) => {
 *       toast.success(`${result.succeeded}/${result.total} fiscalized`)
 *     },
 *   })
 *
 *   return (
 *     <Button onClick={() => execute(selectedIds)} disabled={isLoading}>
 *       {isLoading ? `${progress?.percent}%` : `Fiscalize ${selectedIds.length}`}
 *     </Button>
 *   )
 * }
 * ```
 */
export function useBatchAction(options: UseBatchActionOptions): UseBatchActionReturn {
  const { capabilityId, actionId, entityType, params, continueOnError, onComplete, onProgress } =
    options

  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState<BatchProgress | null>(null)
  const [result, setResult] = useState<BatchActionResult | null>(null)

  const execute = useCallback(
    async (entityIds: string[]): Promise<BatchActionResult> => {
      setIsLoading(true)
      setProgress({ completed: 0, total: entityIds.length, percent: 0 })
      setResult(null)

      try {
        const batchResult = await executeBatchAction({
          capabilityId,
          actionId,
          entityIds,
          entityType,
          params,
          continueOnError,
        })

        // Update final progress
        const finalProgress = {
          completed: batchResult.total,
          total: batchResult.total,
          percent: 100,
        }
        setProgress(finalProgress)
        onProgress?.(finalProgress)

        // Trigger revalidation for all affected entities (best-effort)
        try {
          await Promise.all(entityIds.map((id) => revalidateCapabilityResolution(id)))
        } catch {
          console.warn("Failed to revalidate some capabilities after batch action")
        }

        setResult(batchResult)
        onComplete?.(batchResult)
        setIsLoading(false)

        return batchResult
      } catch (error) {
        const errorResult: BatchActionResult = {
          total: entityIds.length,
          succeeded: 0,
          failed: entityIds.length,
          results: entityIds.map((entityId) => ({
            entityId,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            code: "INTERNAL_ERROR" as const,
          })),
        }

        setResult(errorResult)
        onComplete?.(errorResult)
        setIsLoading(false)

        return errorResult
      }
    },
    [capabilityId, actionId, entityType, params, continueOnError, onComplete, onProgress]
  )

  const reset = useCallback(() => {
    setProgress(null)
    setResult(null)
  }, [])

  return {
    execute,
    isLoading,
    progress,
    result,
    reset,
  }
}
