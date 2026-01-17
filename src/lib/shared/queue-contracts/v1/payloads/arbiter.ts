// src/lib/shared/queue-contracts/v1/payloads/arbiter.ts
/**
 * Arbiter job payload - conflict resolution between rules.
 * Queue: arbiter
 * Job names: arbiter
 */
import { z } from "zod"
import { JobEnvelopeV1Schema } from "../envelope"

/**
 * Arbiter job payload schema.
 */
export const ArbiterJobV1Schema = JobEnvelopeV1Schema.extend({
  /** Conflict ID to resolve. */
  conflictId: z.string().min(1),
  /** Parent job ID for correlation (apply job that detected conflict). */
  parentJobId: z.string().optional(),
})

export type ArbiterJobV1 = z.infer<typeof ArbiterJobV1Schema>

/**
 * Validate arbiter job payload.
 */
export function validateArbiterJob(data: unknown): ArbiterJobV1 {
  return ArbiterJobV1Schema.parse(data)
}

/**
 * Check if data is a valid arbiter job payload.
 */
export function isArbiterJobValid(data: unknown): data is ArbiterJobV1 {
  return ArbiterJobV1Schema.safeParse(data).success
}
