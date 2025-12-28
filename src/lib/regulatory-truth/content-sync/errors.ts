// src/lib/regulatory-truth/content-sync/errors.ts
/**
 * Custom error classes for the RTL -> Content sync pipeline.
 *
 * Errors are classified as either PERMANENT (dead letter immediately)
 * or TRANSIENT (retry with exponential backoff).
 */

import type { DeadLetterReason } from "@/lib/db/schema/content-sync"

// =============================================================================
// Base Error Class
// =============================================================================

/**
 * Base abstract class for all content sync errors.
 * Subclasses must specify their error kind and optionally a dead letter reason.
 */
export abstract class ContentSyncError extends Error {
  /**
   * Whether this error is permanent (dead letter) or transient (retry).
   */
  abstract readonly kind: "PERMANENT" | "TRANSIENT"

  /**
   * For PERMANENT errors, the reason to record in the dead letter queue.
   */
  abstract readonly deadLetterReason?: DeadLetterReason

  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

// =============================================================================
// PERMANENT Errors (dead letter immediately)
// =============================================================================

/**
 * Thrown when a conceptId is not found in the concept registry.
 * This is a permanent error because the registry must be updated before retry.
 */
export class UnmappedConceptError extends ContentSyncError {
  readonly kind = "PERMANENT" as const
  readonly deadLetterReason = "UNMAPPED_CONCEPT" as const

  constructor(public readonly conceptId: string) {
    super(`Concept not found in registry: ${conceptId}`)
  }
}

/**
 * Thrown when the event payload fails validation.
 * This is a permanent error because the event data is fundamentally invalid.
 */
export class InvalidPayloadError extends ContentSyncError {
  readonly kind = "PERMANENT" as const
  readonly deadLetterReason = "INVALID_PAYLOAD" as const

  constructor(
    public readonly reason: string,
    public readonly payload?: unknown
  ) {
    super(`Invalid event payload: ${reason}`)
  }
}

/**
 * Thrown when an event is emitted without any source pointer IDs.
 * Every content sync event must be traceable to source evidence.
 * This is a permanent error because the event lacks required traceability.
 */
export class MissingPointersError extends ContentSyncError {
  readonly kind = "PERMANENT" as const
  readonly deadLetterReason = "MISSING_POINTERS" as const

  constructor(public readonly ruleId: string) {
    super(`Event has no sourcePointerIds for rule: ${ruleId}`)
  }
}

/**
 * Thrown when the target MDX content file does not exist.
 * This is a permanent error because the file must be created or
 * the concept mapping must be corrected.
 */
export class ContentNotFoundError extends ContentSyncError {
  readonly kind = "PERMANENT" as const
  readonly deadLetterReason = "CONTENT_NOT_FOUND" as const

  constructor(
    public readonly contentPath: string,
    public readonly conceptId: string
  ) {
    super(`Content file not found: ${contentPath} for concept: ${conceptId}`)
  }
}

/**
 * Thrown when gray-matter fails to parse the MDX frontmatter.
 * This is a permanent error because the file content is malformed.
 */
export class FrontmatterParseError extends ContentSyncError {
  readonly kind = "PERMANENT" as const
  readonly deadLetterReason = "FRONTMATTER_PARSE_ERROR" as const

  constructor(
    public readonly contentPath: string,
    public readonly parseError: string
  ) {
    super(`Failed to parse frontmatter in ${contentPath}: ${parseError}`)
  }
}

/**
 * Thrown when an eventId already exists in the changelog.
 * This is a permanent error because the event was already processed.
 */
export class PatchConflictError extends ContentSyncError {
  readonly kind = "PERMANENT" as const
  readonly deadLetterReason = "PATCH_CONFLICT" as const

  constructor(
    public readonly eventId: string,
    public readonly contentPath: string
  ) {
    super(`Event ${eventId} already exists in changelog for ${contentPath}`)
  }
}

// =============================================================================
// TRANSIENT Errors (retry with exponential backoff)
// =============================================================================

/**
 * Thrown when git operations fail (commit, push, etc).
 * This is a transient error because it may succeed on retry.
 */
export class RepoWriteFailedError extends ContentSyncError {
  readonly kind = "TRANSIENT" as const
  readonly deadLetterReason = undefined

  constructor(
    public readonly operation: string,
    public readonly cause?: Error
  ) {
    super(`Git operation failed: ${operation}${cause ? ` - ${cause.message}` : ""}`)
  }
}

/**
 * Thrown when database write operations fail.
 * This is a transient error because it may succeed on retry.
 */
export class DbWriteFailedError extends ContentSyncError {
  readonly kind = "TRANSIENT" as const
  readonly deadLetterReason = undefined

  constructor(
    public readonly operation: string,
    public readonly cause?: Error
  ) {
    super(`Database write failed: ${operation}${cause ? ` - ${cause.message}` : ""}`)
  }
}

// =============================================================================
// Error Classification
// =============================================================================

/**
 * Result of classifying an error for queue processing.
 */
export interface ClassifiedError {
  kind: "PERMANENT" | "TRANSIENT"
  deadLetterReason?: DeadLetterReason
  message: string
}

/**
 * Classify an error for queue processing.
 *
 * If the error is a ContentSyncError, returns its kind and deadLetterReason.
 * Unknown errors are treated as TRANSIENT (will be retried).
 *
 * @param err - The error to classify
 * @returns Classification result with kind, deadLetterReason, and message
 *
 * @example
 * try {
 *   await processEvent(event)
 * } catch (err) {
 *   const classified = classifyError(err)
 *   if (classified.kind === "PERMANENT") {
 *     await deadLetter(event, classified.deadLetterReason!)
 *   } else {
 *     await retryLater(event)
 *   }
 * }
 */
export function classifyError(err: unknown): ClassifiedError {
  // ContentSyncError subclasses have explicit classification
  if (err instanceof ContentSyncError) {
    return {
      kind: err.kind,
      deadLetterReason: err.deadLetterReason,
      message: err.message,
    }
  }

  // Standard Error objects
  if (err instanceof Error) {
    return {
      kind: "TRANSIENT",
      deadLetterReason: undefined,
      message: err.message,
    }
  }

  // Unknown error types (strings, objects, etc)
  const message =
    typeof err === "string"
      ? err
      : typeof err === "object" && err !== null
        ? JSON.stringify(err)
        : String(err)

  return {
    kind: "TRANSIENT",
    deadLetterReason: undefined,
    message,
  }
}
