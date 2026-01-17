// src/lib/shared/queue-contracts/index.ts
/**
 * RTL Queue Contracts
 *
 * Versioned payload types for all RTL queues.
 * This package is shared between the app and workers repos
 * to prevent queue payload drift.
 *
 * ## Usage
 *
 * ```typescript
 * import {
 *   SentinelJobV1Schema,
 *   type SentinelJobV1,
 *   createEnvelope,
 *   validateSentinelJob,
 *   QUEUE_NAMES,
 * } from "@/lib/shared/queue-contracts"
 *
 * // Create a job with envelope
 * const job: SentinelJobV1 = {
 *   ...createEnvelope(runId, "sentinel"),
 *   priority: "HIGH",
 * }
 *
 * // Validate incoming job data
 * const validated = validateSentinelJob(rawJobData)
 * ```
 *
 * ## Versioning Rules
 *
 * 1. Every job payload includes `version` (integer) and `createdAt` (ISO string)
 * 2. Producers publish only the latest version
 * 3. Consumers must accept version N and N-1 during rollouts
 * 4. Breaking changes require:
 *    - New version number
 *    - Optional translation shim (v1 -> v2) kept for at least 1 release cycle
 * 5. If payload shape is incompatible/hazardous, use a new queue name
 *
 * ## Adding a New Payload
 *
 * 1. Create payload schema in `v1/payloads/yourqueue.ts`
 * 2. Extend `JobEnvelopeV1Schema` with queue-specific fields
 * 3. Export from `v1/payloads/index.ts`
 * 4. Add queue name to `QUEUE_NAMES` in `v1/index.ts`
 */

// Re-export everything from v1 (current version)
export * from "./v1"

// Default export for convenience
export { CURRENT_VERSION as VERSION } from "./v1/envelope"
