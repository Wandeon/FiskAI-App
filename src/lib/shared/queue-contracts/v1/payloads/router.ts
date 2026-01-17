// src/lib/shared/queue-contracts/v1/payloads/router.ts
/**
 * Router job payload - budget-aware routing decisions.
 * Queue: router
 * Job names: route
 */
import { z } from "zod"
import { JobEnvelopeV1Schema } from "../envelope"

/**
 * Scout result schema - output from scout stage.
 * Passed to router for routing decisions.
 */
export const ScoutResultSchema = z.object({
  /** Worth-it score (0-1) for extraction. */
  worthItScore: z.number().min(0).max(1),
  /** Estimated tokens for LLM processing. */
  estimatedTokens: z.number().int().min(0),
  /** Document type classification. */
  docType: z.string(),
  /** Whether OCR is needed first. */
  needsOCR: z.boolean(),
  /** Boilerplate content ratio. */
  boilerplateRatio: z.number().min(0).max(1).optional(),
  /** Confidence in deterministic assessment. */
  determinismConfidence: z.number().min(0).max(1).optional(),
  /** Skip reason if content should be skipped. */
  skipReason: z.string().optional(),
})

export type ScoutResult = z.infer<typeof ScoutResultSchema>

/**
 * Router job payload schema.
 */
export const RouterJobV1Schema = JobEnvelopeV1Schema.extend({
  /** Evidence ID to route. */
  evidenceId: z.string().min(1),
  /** Source slug for health-aware routing. */
  sourceSlug: z.string().min(1),
  /** Scout result from content-scout stage. */
  scoutResult: ScoutResultSchema,
  /** Parent job ID for correlation (scout job that queued this). */
  parentJobId: z.string().optional(),
})

export type RouterJobV1 = z.infer<typeof RouterJobV1Schema>

/**
 * Validate router job payload.
 */
export function validateRouterJob(data: unknown): RouterJobV1 {
  return RouterJobV1Schema.parse(data)
}

/**
 * Check if data is a valid router job payload.
 */
export function isRouterJobValid(data: unknown): data is RouterJobV1 {
  return RouterJobV1Schema.safeParse(data).success
}
