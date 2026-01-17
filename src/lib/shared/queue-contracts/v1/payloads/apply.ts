// src/lib/shared/queue-contracts/v1/payloads/apply.ts
/**
 * Apply job payload - persists composer proposals to the database.
 * Queue: apply
 * Job names: apply
 *
 * PHASE-D: Separates "proposal generation" (compose) from "truth persistence" (apply).
 */
import { z } from "zod"
import { JobEnvelopeV1Schema } from "../envelope"

/**
 * Composer output schema - LLM-generated rule proposal.
 */
export const ComposerOutputSchema = z.object({
  /** Concept slug for the rule. */
  conceptSlug: z.string().optional(),
  /** Rule title. */
  title: z.string().optional(),
  /** Rule description. */
  description: z.string().optional(),
  /** Human-readable explanation. */
  humanReadable: z.string().optional(),
  /** Value type (rate, amount, threshold, etc.). */
  valueType: z.string().optional(),
  /** Extracted value. */
  value: z.union([z.string(), z.number()]).optional(),
  /** Display value for UI. */
  displayValue: z.string().optional(),
  /** Effective date (ISO). */
  effectiveFrom: z.string().optional(),
  /** Expiry date (ISO). */
  effectiveUntil: z.string().optional(),
  /** Confidence score (0-1). */
  confidence: z.number().min(0).max(1).optional(),
  /** Domain classification. */
  domain: z.string().optional(),
  /** Additional metadata. */
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type ComposerOutput = z.infer<typeof ComposerOutputSchema>

/**
 * Composer proposal schema - returned by generateComposerProposal().
 */
export const ComposerProposalV1Schema = z.object({
  /** Whether proposal generation succeeded. */
  success: z.boolean(),
  /** LLM output (rule proposal). */
  output: ComposerOutputSchema.nullable(),
  /** AgentRun ID for tracking. */
  agentRunId: z.string().nullable(),
  /** CandidateFact IDs used in this proposal. */
  candidateFactIds: z.array(z.string()),
  /** Error message if generation failed. */
  error: z.string().nullable(),
})

export type ComposerProposalV1 = z.infer<typeof ComposerProposalV1Schema>

/**
 * Apply job payload schema.
 */
export const ApplyJobV1Schema = JobEnvelopeV1Schema.extend({
  /** Composer proposal to persist. */
  proposal: ComposerProposalV1Schema,
  /** Domain for the rule. */
  domain: z.string().min(1),
  /** Parent job ID for correlation (compose job that queued this). */
  parentJobId: z.string().optional(),
})

export type ApplyJobV1 = z.infer<typeof ApplyJobV1Schema>

/**
 * Validate apply job payload.
 */
export function validateApplyJob(data: unknown): ApplyJobV1 {
  return ApplyJobV1Schema.parse(data)
}

/**
 * Check if data is a valid apply job payload.
 */
export function isApplyJobValid(data: unknown): data is ApplyJobV1 {
  return ApplyJobV1Schema.safeParse(data).success
}
