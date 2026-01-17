// src/lib/shared/queue-contracts/v1/payloads/scheduled.ts
/**
 * Scheduled job payload - orchestrator scheduled tasks.
 * Queue: scheduled
 * Job names: various (pipeline-run, auto-approve, arbiter-sweep, etc.)
 */
import { z } from "zod"
import { JobEnvelopeV1Schema } from "../envelope"

/**
 * Scheduled job types supported by the orchestrator.
 */
export const ScheduledJobTypeSchema = z.enum([
  "pipeline-run",
  "audit",
  "digest",
  "auto-approve",
  "arbiter-sweep",
  "release-batch",
  "regression-detection",
  "embedding-backfill",
  "revalidation",
  "selector-adaptation",
  "feedback-review-flagging",
])

export type ScheduledJobType = z.infer<typeof ScheduledJobTypeSchema>

/**
 * Scheduled job payload schema.
 */
export const ScheduledJobV1Schema = JobEnvelopeV1Schema.extend({
  /** Type of scheduled job. */
  type: ScheduledJobTypeSchema,
  /** What triggered this job (e.g., "cron", "manual", "catch-up"). */
  triggeredBy: z.string().optional(),
})

export type ScheduledJobV1 = z.infer<typeof ScheduledJobV1Schema>

/**
 * Validate scheduled job payload.
 */
export function validateScheduledJob(data: unknown): ScheduledJobV1 {
  return ScheduledJobV1Schema.parse(data)
}

/**
 * Check if data is a valid scheduled job payload.
 */
export function isScheduledJobValid(data: unknown): data is ScheduledJobV1 {
  return ScheduledJobV1Schema.safeParse(data).success
}
