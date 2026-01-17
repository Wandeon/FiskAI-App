// src/lib/shared/queue-contracts/v1/payloads/scout.ts
/**
 * Scout job payload - pre-LLM quality assessment.
 * Queue: scout
 * Job names: scout
 */
import { z } from "zod"
import { JobEnvelopeV1Schema } from "../envelope"

/**
 * Scout job payload schema.
 */
export const ScoutJobV1Schema = JobEnvelopeV1Schema.extend({
  /** Evidence ID to assess. */
  evidenceId: z.string().min(1),
  /** Parent job ID for correlation (sentinel job that queued this). */
  parentJobId: z.string().optional(),
})

export type ScoutJobV1 = z.infer<typeof ScoutJobV1Schema>

/**
 * Validate scout job payload.
 */
export function validateScoutJob(data: unknown): ScoutJobV1 {
  return ScoutJobV1Schema.parse(data)
}

/**
 * Check if data is a valid scout job payload.
 */
export function isScoutJobValid(data: unknown): data is ScoutJobV1 {
  return ScoutJobV1Schema.safeParse(data).success
}
