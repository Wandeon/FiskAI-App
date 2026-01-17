// src/lib/shared/queue-contracts/v1/payloads/deadletter.ts
/**
 * Dead letter queue job payload - permanently failed jobs.
 * Queue: deadletter
 * Job names: dlq
 */
import { z } from "zod"
import { JobEnvelopeV1Schema } from "../envelope"

/**
 * Error categories for DLQ classification.
 */
export const ErrorCategorySchema = z.enum([
  "TRANSIENT", // Network, timeout, rate limit - may be retryable
  "AUTH", // Authentication/authorization errors
  "QUOTA", // API quota/budget exceeded
  "VALIDATION", // Invalid input data
  "PROCESSING", // Processing logic errors
  "EXTERNAL", // External service errors
  "UNKNOWN", // Unclassified errors
])

export type ErrorCategory = z.infer<typeof ErrorCategorySchema>

/**
 * Dead letter job payload schema.
 */
export const DeadLetterJobV1Schema = JobEnvelopeV1Schema.extend({
  /** Original queue name where the job failed. */
  originalQueue: z.string().min(1),
  /** Original job ID (BullMQ job ID). */
  originalJobId: z.string().optional(),
  /** Original job name. */
  originalJobName: z.string().min(1),
  /** Original job data (preserved for debugging/replay). */
  originalJobData: z.unknown(),
  /** Error message from the failure. */
  error: z.string().min(1),
  /** Stack trace if available. */
  stackTrace: z.string().optional(),
  /** Number of attempts made before moving to DLQ. */
  attemptsMade: z.number().int().min(0),
  /** When the job failed (ISO). */
  failedAt: z.string().datetime(),
  /** When the job first failed (for repeated failures). */
  firstFailedAt: z.string().datetime().optional(),
  /** Error category for auto-healing classification. */
  errorCategory: ErrorCategorySchema.optional(),
  /** Idempotency key for deduplication (jobId + payloadHash). */
  idempotencyKey: z.string().optional(),
  /** Whether this error is eligible for auto-retry. */
  isRetryable: z.boolean().optional(),
})

export type DeadLetterJobV1 = z.infer<typeof DeadLetterJobV1Schema>

/**
 * Validate dead letter job payload.
 */
export function validateDeadLetterJob(data: unknown): DeadLetterJobV1 {
  return DeadLetterJobV1Schema.parse(data)
}

/**
 * Check if data is a valid dead letter job payload.
 */
export function isDeadLetterJobValid(data: unknown): data is DeadLetterJobV1 {
  return DeadLetterJobV1Schema.safeParse(data).success
}
