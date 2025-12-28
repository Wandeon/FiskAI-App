// src/lib/db/schema/content-sync.ts
import {
  pgTable,
  pgEnum,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core"

// ============================================================================
// Enums
// ============================================================================

export const contentSyncEventTypeEnum = pgEnum("content_sync_event_type", [
  "RULE_RELEASED",
  "RULE_SUPERSEDED",
  "RULE_EFFECTIVE",
  "SOURCE_CHANGED",
  "POINTERS_CHANGED",
  "CONFIDENCE_DROPPED",
])

export const contentSyncStatusEnum = pgEnum("content_sync_status", [
  "PENDING",
  "ENQUEUED",
  "PROCESSING",
  "DONE",
  "FAILED",
  "DEAD_LETTERED",
  "SKIPPED",
])

export const deadLetterReasonEnum = pgEnum("dead_letter_reason", [
  "UNMAPPED_CONCEPT",
  "INVALID_PAYLOAD",
  "MISSING_POINTERS",
  "CONTENT_NOT_FOUND",
  "FRONTMATTER_PARSE_ERROR",
  "PATCH_CONFLICT",
  "REPO_WRITE_FAILED",
  "DB_WRITE_FAILED",
  "UNKNOWN",
])

// ============================================================================
// Table
// ============================================================================

export const contentSyncEvents = pgTable(
  "content_sync_events",
  {
    // Primary key - deterministic sha256 hash for idempotency
    eventId: text("event_id").primaryKey(),

    // Version for optimistic locking
    version: integer("version").default(1).notNull(),

    // Event type and status
    type: contentSyncEventTypeEnum("type").notNull(),
    status: contentSyncStatusEnum("status").default("PENDING").notNull(),

    // Core identifiers
    ruleId: text("rule_id").notNull(),
    conceptId: text("concept_id").notNull(),
    domain: text("domain").notNull(),

    // Temporal
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),

    // Processing state
    attempts: integer("attempts").default(0).notNull(),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    processedAt: timestamp("processed_at", { withTimezone: true }),

    // Dead letter handling
    deadLetterReason: deadLetterReasonEnum("dead_letter_reason"),
    deadLetterNote: text("dead_letter_note"),

    // Error tracking
    lastError: text("last_error"),
    lastErrorAt: timestamp("last_error_at", { withTimezone: true }),

    // Event payload (rule snapshot, pointers, etc.)
    payload: jsonb("payload").notNull(),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // For queue processing - find pending events ordered by creation
    index("idx_content_sync_events_status_created").on(table.status, table.createdAt),
    // For looking up events by concept
    index("idx_content_sync_events_concept_id").on(table.conceptId),
    // For looking up events by rule
    index("idx_content_sync_events_rule_id").on(table.ruleId),
  ]
)

// ============================================================================
// Type Exports
// ============================================================================

export type ContentSyncEvent = typeof contentSyncEvents.$inferSelect
export type NewContentSyncEvent = typeof contentSyncEvents.$inferInsert

// Enum value types for use in application code
export type ContentSyncEventType = (typeof contentSyncEventTypeEnum.enumValues)[number]
export type ContentSyncStatus = (typeof contentSyncStatusEnum.enumValues)[number]
export type DeadLetterReason = (typeof deadLetterReasonEnum.enumValues)[number]
