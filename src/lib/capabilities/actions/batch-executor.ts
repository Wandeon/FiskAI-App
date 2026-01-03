"use server"

/**
 * Batch Action Executor
 *
 * Server action that executes the same capability action on multiple entities.
 * Validates capabilities for each entity, executes in sequence, and aggregates results.
 *
 * @module capabilities/actions
 * @since PHASE 4 - Capability Batch Actions
 */

import { auth } from "@/lib/auth"
import { executeCapabilityAction } from "./executor"
import type { BatchActionInput, BatchActionResult, BatchItemResult } from "./batch-types"

/**
 * Execute a capability action on multiple entities.
 *
 * @param input - Batch action input
 * @returns Aggregated result with individual outcomes
 *
 * @example
 * ```typescript
 * const result = await executeBatchAction({
 *   capabilityId: "INV-003",
 *   actionId: "fiscalize",
 *   entityIds: ["inv-1", "inv-2", "inv-3"],
 *   entityType: "Invoice",
 * })
 *
 * console.log(`${result.succeeded}/${result.total} succeeded`)
 * ```
 */
export async function executeBatchAction(input: BatchActionInput): Promise<BatchActionResult> {
  const { capabilityId, actionId, entityIds, entityType, params, continueOnError = true } = input

  // Quick session check before processing
  const session = await auth()
  if (!session?.user?.id) {
    return {
      total: 0,
      succeeded: 0,
      failed: 1,
      results: [
        {
          entityId: "",
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        },
      ],
    }
  }

  // Empty input = empty result
  if (entityIds.length === 0) {
    return {
      total: 0,
      succeeded: 0,
      failed: 0,
      results: [],
    }
  }

  const results: BatchItemResult[] = []
  let succeeded = 0
  let failed = 0

  // Process entities sequentially to avoid rate limiting and maintain order
  for (const entityId of entityIds) {
    const result = await executeCapabilityAction({
      capabilityId,
      actionId,
      entityId,
      entityType,
      params,
    })

    const itemResult: BatchItemResult = {
      entityId,
      success: result.success,
      data: result.data,
      error: result.error,
      code: result.code,
    }

    results.push(itemResult)

    if (result.success) {
      succeeded++
    } else {
      failed++
      if (!continueOnError) {
        break
      }
    }
  }

  return {
    total: results.length,
    succeeded,
    failed,
    results,
  }
}
