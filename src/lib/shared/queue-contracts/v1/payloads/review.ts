// src/lib/shared/queue-contracts/v1/payloads/review.ts
/**
 * Review job payload - automated quality checks on composed rules.
 * Queue: review
 * Job names: review
 */
import { z } from "zod"
import { JobEnvelopeV1Schema } from "../envelope"

/**
 * Review job payload schema.
 */
export const ReviewJobV1Schema = JobEnvelopeV1Schema.extend({
  /** Rule ID to review. */
  ruleId: z.string().min(1),
  /** Parent job ID for correlation (apply job that queued this). */
  parentJobId: z.string().optional(),
})

export type ReviewJobV1 = z.infer<typeof ReviewJobV1Schema>

/**
 * Validate review job payload.
 */
export function validateReviewJob(data: unknown): ReviewJobV1 {
  return ReviewJobV1Schema.parse(data)
}

/**
 * Check if data is a valid review job payload.
 */
export function isReviewJobValid(data: unknown): data is ReviewJobV1 {
  return ReviewJobV1Schema.safeParse(data).success
}
