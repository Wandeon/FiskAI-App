// src/lib/shared/queue-contracts/v1/payloads/sentinel.ts
/**
 * Sentinel job payload - discovery and initial routing.
 * Queue: sentinel
 * Job names: sentinel-*, sentinel-critical, sentinel-high, sentinel-normal, sentinel-low
 */
import { z } from "zod"
import { JobEnvelopeV1Schema } from "../envelope"

/**
 * Discovery priority levels.
 * Maps to DiscoveryPriority enum from Prisma.
 */
export const DiscoveryPrioritySchema = z.enum(["CRITICAL", "HIGH", "NORMAL", "LOW"])
export type DiscoveryPriority = z.infer<typeof DiscoveryPrioritySchema>

/**
 * Sentinel job payload schema.
 */
export const SentinelJobV1Schema = JobEnvelopeV1Schema.extend({
  /** Optional source ID to restrict discovery to a single source. */
  sourceId: z.string().optional(),
  /** Discovery priority level. Defaults to CRITICAL if not specified. */
  priority: DiscoveryPrioritySchema.optional(),
})

export type SentinelJobV1 = z.infer<typeof SentinelJobV1Schema>

/**
 * Validate sentinel job payload.
 */
export function validateSentinelJob(data: unknown): SentinelJobV1 {
  return SentinelJobV1Schema.parse(data)
}

/**
 * Check if data is a valid sentinel job payload.
 */
export function isSentinelJobValid(data: unknown): data is SentinelJobV1 {
  return SentinelJobV1Schema.safeParse(data).success
}
