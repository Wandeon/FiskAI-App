// src/lib/regulatory-truth/content-sync/types.ts
/**
 * Type definitions for the RTL -> Content sync pipeline.
 * These types define the structure of events that flow from the Regulatory Truth Layer
 * to the content management system for guide updates.
 */

import type { ContentSyncEventType } from "@/lib/db/schema/content-sync"

// =============================================================================
// Content Domain
// =============================================================================

/**
 * Content domains for categorizing regulatory changes.
 * Maps from RTL's granular domains to broader content categories.
 */
export type ContentDomain = "tax" | "business" | "compliance" | "fiscal"

/**
 * Maps RTL domain identifiers to content domains.
 * RTL uses Croatian regulatory-specific domains (pausalni, pdv, etc.)
 * Content sync uses broader English categories for MDX organization.
 */
export function mapRtlDomainToContentDomain(rtlDomain: string): ContentDomain {
  const mapping: Record<string, ContentDomain> = {
    // Tax-related domains
    pausalni: "tax",
    pdv: "tax",
    porez_dohodak: "tax",
    doprinosi: "tax",

    // Fiscal domains (payment/transaction related)
    fiskalizacija: "fiscal",

    // Compliance domains (deadlines, forms)
    rokovi: "compliance",
    obrasci: "compliance",

    // Business domains (registration, structure)
    obrt: "business",
    doo: "business",
    jdoo: "business",
  }

  return mapping[rtlDomain] ?? "compliance"
}

// =============================================================================
// Event Signature
// =============================================================================

/**
 * Signature fields used to generate deterministic event IDs.
 * The event ID is a sha256 hash of the canonical JSON representation of this signature.
 * This ensures idempotency - the same regulatory change always produces the same event ID.
 */
export interface ContentSyncEventSignature {
  /** The regulatory rule ID from RTL */
  ruleId: string

  /** The concept ID that categorizes this rule (e.g., "pdv-threshold") */
  conceptId: string

  /** The type of sync event */
  type: ContentSyncEventType

  /** The date from which this change is effective (ISO date YYYY-MM-DD) */
  effectiveFrom: string

  /** The new value after the change, if applicable */
  newValue?: string

  /** sha256 hash of sorted sourcePointerIds - ensures same sources produce same ID */
  sourcePointerIdsHash: string
}

// =============================================================================
// Event Payload V1
// =============================================================================

/**
 * Change type indicating what kind of regulatory change occurred.
 */
export type ChangeType = "create" | "update" | "repeal"

/**
 * Value types for regulatory data.
 */
export type ValueType = "currency" | "percentage" | "date" | "threshold" | "text"

/**
 * Severity levels for content sync events.
 * Used to prioritize processing and determine notification urgency.
 */
export type EventSeverity = "breaking" | "major" | "minor" | "info"

/**
 * Complete event payload stored in content_sync_events.payload JSONB column.
 * Version 1 of the payload schema - future versions may add fields.
 */
export interface ContentSyncEventV1 {
  /** Schema version for forward compatibility */
  version: 1

  /** Deterministic event ID (sha256 of signature) */
  id: string

  /** ISO timestamp when the event was created */
  timestamp: string

  /** The type of sync event from the enum */
  type: ContentSyncEventType

  /** The regulatory rule ID from RTL */
  ruleId: string

  /** The concept ID that categorizes this rule */
  conceptId: string

  /** Content domain for MDX organization */
  domain: ContentDomain

  /** What kind of regulatory change occurred */
  changeType: ChangeType

  /** ISO date (YYYY-MM-DD) from which this change is effective */
  effectiveFrom: string

  /** The previous value before the change, if applicable */
  previousValue?: string

  /** The new value after the change, if applicable */
  newValue?: string

  /** The type of value being changed */
  valueType?: ValueType

  /**
   * PRIMARY traceability chain - IDs of source pointers that back this change.
   * These link to Evidence records in the RTL for audit purposes.
   */
  sourcePointerIds: string[]

  /** Additional evidence IDs supporting this change */
  evidenceIds?: string[]

  /** URL to the primary authoritative source */
  primarySourceUrl?: string

  /** Confidence level from RTL (0-100 scale) */
  confidenceLevel: number

  /** Severity determines processing priority and notification urgency */
  severity: EventSeverity

  /** The signature used to generate the event ID */
  signature: ContentSyncEventSignature
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if a payload is a valid ContentSyncEventV1.
 */
export function isContentSyncEventV1(payload: unknown): payload is ContentSyncEventV1 {
  if (typeof payload !== "object" || payload === null) {
    return false
  }

  const p = payload as Record<string, unknown>

  return (
    p.version === 1 &&
    typeof p.id === "string" &&
    typeof p.timestamp === "string" &&
    typeof p.type === "string" &&
    typeof p.ruleId === "string" &&
    typeof p.conceptId === "string" &&
    typeof p.domain === "string" &&
    typeof p.changeType === "string" &&
    typeof p.effectiveFrom === "string" &&
    Array.isArray(p.sourcePointerIds) &&
    typeof p.confidenceLevel === "number" &&
    typeof p.severity === "string" &&
    typeof p.signature === "object"
  )
}
