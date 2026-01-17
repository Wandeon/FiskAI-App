// src/lib/shared/queue-contracts/v1/payloads/release.ts
/**
 * Release job payload - publishes approved rules to production.
 * Queue: release
 * Job names: release, release-single
 */
import { z } from "zod"
import { JobEnvelopeV1Schema } from "../envelope"

/**
 * Release job payload schema.
 */
export const ReleaseJobV1Schema = JobEnvelopeV1Schema.extend({
  /** Rule IDs to release/publish. */
  ruleIds: z.array(z.string().min(1)).min(1),
  /** Parent job ID for correlation (reviewer job that approved the rule). */
  parentJobId: z.string().optional(),
})

export type ReleaseJobV1 = z.infer<typeof ReleaseJobV1Schema>

/**
 * Validate release job payload.
 */
export function validateReleaseJob(data: unknown): ReleaseJobV1 {
  return ReleaseJobV1Schema.parse(data)
}

/**
 * Check if data is a valid release job payload.
 */
export function isReleaseJobValid(data: unknown): data is ReleaseJobV1 {
  return ReleaseJobV1Schema.safeParse(data).success
}
