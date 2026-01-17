// src/lib/shared/queue-contracts/v1/payloads/extract.ts
/**
 * Extract job payload - LLM-based fact extraction.
 * Queue: extract
 * Job names: extract
 */
import { z } from "zod"
import { JobEnvelopeV1Schema } from "../envelope"

/**
 * LLM provider for extraction.
 */
export const LLMProviderSchema = z.enum(["LOCAL_OLLAMA", "CLOUD_OLLAMA"])
export type LLMProvider = z.infer<typeof LLMProviderSchema>

/**
 * Extract job payload schema.
 */
export const ExtractJobV1Schema = JobEnvelopeV1Schema.extend({
  /** Evidence ID to extract from. */
  evidenceId: z.string().min(1),
  /** Parent job ID for correlation (router/OCR job that queued this). */
  parentJobId: z.string().optional(),
  /** LLM provider to use (set by router based on budget/quality). */
  llmProvider: LLMProviderSchema.optional(),
})

export type ExtractJobV1 = z.infer<typeof ExtractJobV1Schema>

/**
 * Validate extract job payload.
 */
export function validateExtractJob(data: unknown): ExtractJobV1 {
  return ExtractJobV1Schema.parse(data)
}

/**
 * Check if data is a valid extract job payload.
 */
export function isExtractJobValid(data: unknown): data is ExtractJobV1 {
  return ExtractJobV1Schema.safeParse(data).success
}
