"use client"

/**
 * useCapabilityAction Hook
 *
 * Client-side React hook for executing capability actions with
 * loading states, error handling, and callbacks.
 *
 * @module capabilities/actions
 * @since PHASE 2 - Capability-Driven Actions
 */

import { useState, useCallback } from "react"
import { executeCapabilityAction } from "./executor"
import type { ActionResult } from "./types"

/**
 * Options for the useCapabilityAction hook.
 */
export interface UseCapabilityActionOptions {
  /** Capability ID (e.g., "INV-003") */
  capabilityId: string

  /** Action ID within the capability (e.g., "fiscalize") */
  actionId: string

  /** Entity ID if operating on an existing entity */
  entityId?: string

  /** Entity type (e.g., "Invoice") */
  entityType?: string

  /** Callback invoked on successful execution */
  onSuccess?: (result: ActionResult) => void

  /** Callback invoked on failed execution */
  onError?: (error: string) => void
}

/**
 * Return type for the useCapabilityAction hook.
 *
 * @template T - Type of the data returned on success
 */
export interface UseCapabilityActionReturn<T = unknown> {
  /**
   * Execute the action with optional parameters.
   *
   * @param params - Optional action-specific parameters
   * @returns Promise resolving to the action result
   */
  execute: (params?: Record<string, unknown>) => Promise<ActionResult<T>>

  /** Whether the action is currently executing */
  isLoading: boolean

  /** Error message if the last execution failed */
  error: string | null

  /** Result data if the last execution succeeded */
  data: T | null

  /** Reset error and data state */
  reset: () => void
}

/**
 * React hook for executing capability actions with state management.
 *
 * Provides loading states, error handling, and success/error callbacks
 * for executing capability-driven actions.
 *
 * @template T - Type of the data returned on success
 * @param options - Hook configuration options
 * @returns Hook state and methods
 *
 * @example
 * ```tsx
 * function FiscalizeButton({ invoiceId }: { invoiceId: string }) {
 *   const { execute, isLoading, error, data } = useCapabilityAction({
 *     capabilityId: "INV-003",
 *     actionId: "fiscalize",
 *     entityId: invoiceId,
 *     onSuccess: (result) => {
 *       toast.success("Invoice fiscalized!")
 *     },
 *     onError: (error) => {
 *       toast.error(error)
 *     },
 *   })
 *
 *   return (
 *     <Button onClick={() => execute()} disabled={isLoading}>
 *       {isLoading ? "Fiscalizing..." : "Fiscalize"}
 *     </Button>
 *   )
 * }
 * ```
 */
export function useCapabilityAction<T = unknown>(
  options: UseCapabilityActionOptions
): UseCapabilityActionReturn<T> {
  const { capabilityId, actionId, entityId, entityType, onSuccess, onError } = options

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<T | null>(null)

  const execute = useCallback(
    async (params?: Record<string, unknown>): Promise<ActionResult<T>> => {
      setIsLoading(true)

      try {
        const result = await executeCapabilityAction({
          capabilityId,
          actionId,
          entityId,
          entityType,
          params,
        })

        if (result.success) {
          setData((result.data as T) ?? null)
          setError(null)
          onSuccess?.(result)
        } else {
          setData(null)
          setError(result.error ?? "Unknown error")
          onError?.(result.error ?? "Unknown error")
        }

        setIsLoading(false)
        return result as ActionResult<T>
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred"

        setData(null)
        setError(errorMessage)
        setIsLoading(false)
        onError?.(errorMessage)

        return {
          success: false,
          error: errorMessage,
          code: "INTERNAL_ERROR",
        }
      }
    },
    [capabilityId, actionId, entityId, entityType, onSuccess, onError]
  )

  const reset = useCallback(() => {
    setError(null)
    setData(null)
  }, [])

  return {
    execute,
    isLoading,
    error,
    data,
    reset,
  }
}
