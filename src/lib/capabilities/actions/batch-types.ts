/**
 * Batch Action Types
 *
 * Types for executing capability actions on multiple entities.
 *
 * @module capabilities/actions
 * @since PHASE 4 - Capability Batch Actions
 */

import type { ActionErrorCode } from "./types"

/**
 * Input for executing a batch action.
 */
export interface BatchActionInput {
  /** Capability ID (e.g., "INV-003") */
  capabilityId: string

  /** Action ID within the capability (e.g., "fiscalize") */
  actionId: string

  /** Entity IDs to operate on */
  entityIds: string[]

  /** Entity type (e.g., "Invoice") */
  entityType: string

  /** Additional action-specific parameters */
  params?: Record<string, unknown>

  /** Continue on failure (default: true) */
  continueOnError?: boolean
}

/**
 * Result for a single entity in a batch operation.
 */
export interface BatchItemResult {
  /** Entity ID */
  entityId: string

  /** Whether this item succeeded */
  success: boolean

  /** Data returned on success */
  data?: unknown

  /** Error message on failure */
  error?: string

  /** Machine-readable error code */
  code?: ActionErrorCode
}

/**
 * Aggregate result of a batch action.
 */
export interface BatchActionResult {
  /** Total number of entities processed */
  total: number

  /** Number of successful operations */
  succeeded: number

  /** Number of failed operations */
  failed: number

  /** Individual results for each entity */
  results: BatchItemResult[]
}

/**
 * Callback for batch progress updates.
 * Called after each entity is processed.
 */
export type BatchProgressCallback = (
  completed: number,
  total: number,
  current: BatchItemResult
) => void
