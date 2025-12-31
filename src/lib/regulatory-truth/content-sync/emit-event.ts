// src/lib/regulatory-truth/content-sync/emit-event.ts
/**
 * Idempotent event emitter for content sync events.
 * Ensures that duplicate events are not created - the same regulatory change
 * always produces the same event ID, and attempting to emit it again
 * returns the existing event.
 */

import { drizzleDb } from "@/lib/db/drizzle"
import { contentSyncEvents } from "@/lib/db/schema/content-sync"
import type { ContentSyncEventType } from "@/lib/db/schema/content-sync"
import type { RiskTier } from "../schemas/common"
import { buildEventSignature, generateEventId, determineSeverity } from "./event-id"
import { MissingPointersError } from "./errors"
import type { ContentDomain, ContentSyncEventV1, ChangeType, ValueType } from "./types"

// Re-export for backwards compatibility
export { MissingPointersError } from "./errors"

// =============================================================================
// Types
// =============================================================================

/**
 * Parameters for emitting a content sync event.
 */
export interface EmitEventParams {
  /** The type of sync event */
  type: ContentSyncEventType

  /** The regulatory rule ID from RTL */
  ruleId: string

  /** The concept ID that categorizes this rule (e.g., "pdv-threshold") */
  conceptId: string

  /** Content domain for MDX organization */
  domain: ContentDomain

  /** The date from which this change is effective */
  effectiveFrom: Date

  /** What kind of regulatory change occurred */
  changeType: ChangeType

  /** The risk tier of the rule (T0-T3) */
  ruleTier: RiskTier

  /**
   * PRIMARY traceability chain - IDs of source pointers that back this change.
   * Must not be empty.
   */
  sourcePointerIds: string[]

  /** Additional evidence IDs supporting this change */
  evidenceIds?: string[]

  /** The previous value before the change, if applicable */
  previousValue?: string

  /** The new value after the change, if applicable */
  newValue?: string

  /** The type of value being changed */
  valueType?: ValueType

  /** URL to the primary authoritative source */
  primarySourceUrl?: string

  /** Confidence level from RTL (0-100 scale) */
  confidenceLevel: number
}

/**
 * Result of emitting a content sync event.
 */
export interface EmitEventResult {
  /** The deterministic event ID */
  eventId: string

  /** Whether this is a newly created event (false if duplicate) */
  isNew: boolean
}

// =============================================================================
// Event Emitter
// =============================================================================

/**
 * Emit a content sync event to the database.
 *
 * This function is idempotent - emitting the same event twice will return
 * the existing event ID with isNew: false on the second call.
 *
 * @param params - The event parameters
 * @returns The event ID and whether it was newly created
 * @throws {MissingPointersError} If sourcePointerIds is empty
 *
 * @example
 * const result = await emitContentSyncEvent({
 *   type: "RULE_RELEASED",
 *   ruleId: "rule-123",
 *   conceptId: "pdv-threshold",
 *   domain: "tax",
 *   effectiveFrom: new Date("2024-01-01"),
 *   changeType: "update",
 *   ruleTier: "T1",
 *   sourcePointerIds: ["ptr-1", "ptr-2"],
 *   newValue: "40000",
 *   confidenceLevel: 95,
 * })
 *
 * if (result.isNew) {
 *   console.log("Created new event:", result.eventId)
 * } else {
 *   console.log("Event already exists:", result.eventId)
 * }
 */
export async function emitContentSyncEvent(params: EmitEventParams): Promise<EmitEventResult> {
  // Validate sourcePointerIds is not empty
  if (!params.sourcePointerIds || params.sourcePointerIds.length === 0) {
    throw new MissingPointersError(params.ruleId)
  }

  // Format effectiveFrom as ISO date string (YYYY-MM-DD)
  const effectiveFromISO = params.effectiveFrom.toISOString().split("T")[0]

  // Build the signature for deterministic ID generation
  const signature = buildEventSignature({
    ruleId: params.ruleId,
    conceptId: params.conceptId,
    type: params.type,
    effectiveFrom: effectiveFromISO,
    sourcePointerIds: params.sourcePointerIds,
    newValue: params.newValue,
  })

  // Generate deterministic event ID
  const eventId = generateEventId(signature)

  // Determine severity from rule tier and change type
  const severity = determineSeverity(params.ruleTier, params.changeType)

  // Build the event payload
  const payload: ContentSyncEventV1 = {
    version: 1,
    id: eventId,
    timestamp: new Date().toISOString(),
    type: params.type,
    ruleId: params.ruleId,
    conceptId: params.conceptId,
    domain: params.domain,
    changeType: params.changeType,
    effectiveFrom: effectiveFromISO,
    sourcePointerIds: params.sourcePointerIds,
    confidenceLevel: params.confidenceLevel,
    severity,
    signature,
    // Optional fields
    ...(params.previousValue !== undefined && {
      previousValue: params.previousValue,
    }),
    ...(params.newValue !== undefined && { newValue: params.newValue }),
    ...(params.valueType !== undefined && { valueType: params.valueType }),
    ...(params.evidenceIds !== undefined &&
      params.evidenceIds.length > 0 && { evidenceIds: params.evidenceIds }),
    ...(params.primarySourceUrl !== undefined && {
      primarySourceUrl: params.primarySourceUrl,
    }),
  }

  // Insert into database with onConflictDoNothing for idempotency
  const result = await drizzleDb
    .insert(contentSyncEvents)
    .values({
      eventId,
      type: params.type,
      ruleId: params.ruleId,
      conceptId: params.conceptId,
      domain: params.domain,
      effectiveFrom: params.effectiveFrom,
      payload,
    })
    .onConflictDoNothing({ target: contentSyncEvents.eventId })
    .returning({ eventId: contentSyncEvents.eventId })

  // If result is empty, the event already existed (conflict occurred)
  const isNew = result.length > 0

  return { eventId, isNew }
}
