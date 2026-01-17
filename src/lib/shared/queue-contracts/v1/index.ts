// src/lib/shared/queue-contracts/v1/index.ts
/**
 * V1 Queue Contracts
 *
 * Versioned payload types for all RTL queues.
 * This package is shared between the app and workers repos
 * to prevent queue payload drift.
 *
 * Versioning rules:
 * - Every job payload includes `version` (integer) and `createdAt` (ISO string)
 * - Producers publish only the latest version
 * - Consumers must accept version N and N-1 during rollouts
 */

// Envelope (base fields for all payloads)
export {
  JobEnvelopeV1Schema,
  type JobEnvelopeV1,
  CURRENT_VERSION,
  createEnvelope,
  validateEnvelope,
  isVersionAcceptable,
} from "./envelope"

// All payload schemas and types
export * from "./payloads"

/**
 * Queue name constants for type-safe queue references.
 */
export const QUEUE_NAMES = {
  SENTINEL: "sentinel",
  SCOUT: "scout",
  ROUTER: "router",
  OCR: "ocr",
  EXTRACT: "extract",
  COMPOSE: "compose",
  APPLY: "apply",
  REVIEW: "review",
  ARBITER: "arbiter",
  RELEASE: "release",
  SCHEDULED: "scheduled",
  ARTICLE: "article",
  BACKUP: "backup",
  SYSTEM_STATUS: "system-status",
  DEADLETTER: "deadletter",
} as const

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES]
