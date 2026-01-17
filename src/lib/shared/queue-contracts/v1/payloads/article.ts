// src/lib/shared/queue-contracts/v1/payloads/article.ts
/**
 * Article job payload - article generation from regulatory rules.
 * Queue: article
 * Job names: article.generate, article.process
 */
import { z } from "zod"
import { JobEnvelopeV1Schema } from "../envelope"

/**
 * Article types supported by the article agent.
 */
export const ArticleTypeSchema = z.enum([
  "NEWS",
  "GUIDE",
  "HOWTO",
  "COMPARISON",
  "ANALYSIS",
  "UPDATE",
])

export type ArticleType = z.infer<typeof ArticleTypeSchema>

/**
 * Article action types.
 */
export const ArticleActionSchema = z.enum(["generate", "process"])
export type ArticleAction = z.infer<typeof ArticleActionSchema>

/**
 * Article job metadata.
 */
export const ArticleMetadataSchema = z.object({
  /** What triggered this article generation. */
  triggeredBy: z.string().optional(),
  /** Related news item ID. */
  newsItemId: z.string().optional(),
  /** Related regulatory rule ID. */
  ruleId: z.string().optional(),
})

export type ArticleMetadata = z.infer<typeof ArticleMetadataSchema>

/**
 * Article job payload schema.
 */
export const ArticleJobV1Schema = JobEnvelopeV1Schema.extend({
  /** Type of article job operation. */
  action: ArticleActionSchema,
  /** For 'process' action: existing job ID. */
  jobId: z.string().optional(),
  /** For 'generate' action: article type. */
  type: ArticleTypeSchema.optional(),
  /** For 'generate' action: source URLs. */
  sourceUrls: z.array(z.string().url()).optional(),
  /** For 'generate' action: article topic. */
  topic: z.string().optional(),
  /** For 'generate' action: max iterations. */
  maxIterations: z.number().int().positive().optional(),
  /** Optional metadata for tracing. */
  metadata: ArticleMetadataSchema.optional(),
})

export type ArticleJobV1 = z.infer<typeof ArticleJobV1Schema>

/**
 * Validate article job payload.
 */
export function validateArticleJob(data: unknown): ArticleJobV1 {
  return ArticleJobV1Schema.parse(data)
}

/**
 * Check if data is a valid article job payload.
 */
export function isArticleJobValid(data: unknown): data is ArticleJobV1 {
  return ArticleJobV1Schema.safeParse(data).success
}
