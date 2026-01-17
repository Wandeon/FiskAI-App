// src/lib/shared/queue-contracts/v1/payloads/compose.ts
/**
 * Compose job payload - aggregates facts into regulatory rules.
 * Queue: compose
 * Job names: compose
 */
import { z } from "zod"
import { JobEnvelopeV1Schema } from "../envelope"

/**
 * Compose job payload schema.
 */
export const ComposeJobV1Schema = JobEnvelopeV1Schema.extend({
  /** CandidateFact IDs to compose into a rule. */
  candidateFactIds: z.array(z.string().min(1)).min(1),
  /** Domain for the composed rule (e.g., "tax", "vat", "pausalni"). */
  domain: z.string().min(1),
  /** Parent job ID for correlation (extractor job that queued this). */
  parentJobId: z.string().optional(),
  /** Legacy field for backward compatibility during migration. */
  pointerIds: z.array(z.string()).optional(),
})

export type ComposeJobV1 = z.infer<typeof ComposeJobV1Schema>

/**
 * Validate compose job payload.
 */
export function validateComposeJob(data: unknown): ComposeJobV1 {
  return ComposeJobV1Schema.parse(data)
}

/**
 * Check if data is a valid compose job payload.
 */
export function isComposeJobValid(data: unknown): data is ComposeJobV1 {
  return ComposeJobV1Schema.safeParse(data).success
}
