// src/lib/shared/queue-contracts/v1/envelope.ts
/**
 * Base envelope fields required for all queue job payloads.
 *
 * These fields ensure:
 * - Version tracking for rollout safety
 * - Run correlation for debugging
 * - Producer identification for drift detection
 * - Optional distributed tracing
 */
import { z } from "zod"

/**
 * Base envelope schema for all queue payloads.
 * Every job must include these fields.
 */
export const JobEnvelopeV1Schema = z.object({
  /** Payload version (integer). Producers publish latest; consumers accept N and N-1. */
  version: z.number().int().min(1),
  /** Pipeline run identifier for correlation across stages. */
  runId: z.string().min(1),
  /** ISO 8601 timestamp when the job was created. */
  createdAt: z.string().datetime(),
  /** Producer service/worker identifier (e.g., "sentinel", "extractor", "api"). */
  producer: z.string().min(1),
  /** Optional distributed tracing ID (OpenTelemetry, etc.). */
  traceId: z.string().optional(),
})

export type JobEnvelopeV1 = z.infer<typeof JobEnvelopeV1Schema>

/**
 * Current version for all v1 payloads.
 * Increment when making breaking changes.
 */
export const CURRENT_VERSION = 1

/**
 * Create envelope fields with current timestamp.
 * Used by producers when creating new jobs.
 */
export function createEnvelope(runId: string, producer: string, traceId?: string): JobEnvelopeV1 {
  return {
    version: CURRENT_VERSION,
    runId,
    createdAt: new Date().toISOString(),
    producer,
    ...(traceId && { traceId }),
  }
}

/**
 * Validate that a payload has valid envelope fields.
 * Returns the validated envelope or throws on invalid.
 */
export function validateEnvelope(data: unknown): JobEnvelopeV1 {
  return JobEnvelopeV1Schema.parse(data)
}

/**
 * Check if envelope version is acceptable (N or N-1).
 * Used by consumers during rollouts.
 */
export function isVersionAcceptable(
  version: number,
  currentVersion: number = CURRENT_VERSION
): boolean {
  return version === currentVersion || version === currentVersion - 1
}
