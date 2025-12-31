// src/lib/regulatory-truth/content-sync/event-id.ts
/**
 * Deterministic event ID generation for content sync events.
 * Uses sha256 hashing to ensure idempotency - the same regulatory change
 * always produces the same event ID regardless of when or how many times
 * it's processed.
 */

import { createHash } from "crypto"
import type { ContentSyncEventSignature, EventSeverity } from "./types"
import type { RiskTier } from "../schemas/common"
import type { ChangeType } from "./types"

// =============================================================================
// Hash Functions
// =============================================================================

/**
 * Generates a sha256 hash of the input string.
 * Returns the hash as a lowercase hexadecimal string.
 */
function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex")
}

/**
 * Hash source pointer IDs in a deterministic, order-independent manner.
 * Sorts the IDs alphabetically before joining and hashing.
 *
 * @param ids - Array of source pointer IDs
 * @returns sha256 hash of the sorted, comma-joined IDs
 *
 * @example
 * hashSourcePointerIds(["ptr-3", "ptr-1", "ptr-2"])
 * // Same result as:
 * hashSourcePointerIds(["ptr-1", "ptr-2", "ptr-3"])
 */
export function hashSourcePointerIds(ids: string[]): string {
  // Sort to ensure order-independence
  const sorted = [...ids].sort()
  // Join with comma and hash
  return sha256(sorted.join(","))
}

// =============================================================================
// Event ID Generation
// =============================================================================

/**
 * Generate a deterministic event ID from an event signature.
 * The ID is a sha256 hash of the canonical JSON representation of the signature.
 *
 * Canonical JSON means:
 * - Keys are sorted alphabetically
 * - No whitespace
 * - Undefined values are omitted
 *
 * @param signature - The event signature containing identifying fields
 * @returns sha256 hash as a lowercase hexadecimal string
 *
 * @example
 * const signature: ContentSyncEventSignature = {
 *   ruleId: "rule-123",
 *   conceptId: "pdv-threshold",
 *   type: "RULE_RELEASED",
 *   effectiveFrom: "2024-01-01",
 *   sourcePointerIdsHash: "abc123..."
 * }
 * const id = generateEventId(signature) // "d4e5f6..."
 */
export function generateEventId(signature: ContentSyncEventSignature): string {
  // Create a canonical representation with sorted keys
  // Only include defined values
  const canonical: Record<string, string> = {
    conceptId: signature.conceptId,
    effectiveFrom: signature.effectiveFrom,
    ruleId: signature.ruleId,
    sourcePointerIdsHash: signature.sourcePointerIdsHash,
    type: signature.type,
  }

  // Add optional newValue if present
  if (signature.newValue !== undefined) {
    canonical.newValue = signature.newValue
  }

  // Sort keys and create JSON string
  const sortedKeys = Object.keys(canonical).sort()
  const orderedObj: Record<string, string> = {}
  for (const key of sortedKeys) {
    orderedObj[key] = canonical[key]
  }

  const json = JSON.stringify(orderedObj)
  return sha256(json)
}

// =============================================================================
// Severity Determination
// =============================================================================

/**
 * Determine the severity of a content sync event based on rule tier and change type.
 *
 * Severity rules:
 * - repeal (any tier) -> breaking: Content removal requires immediate attention
 * - T0 (any change type except repeal) -> breaking: Critical regulatory changes
 * - T1 -> major: Important changes requiring prompt attention
 * - T2 -> minor: Routine changes
 * - T3 -> info: Low-impact informational changes
 *
 * @param ruleTier - The risk tier of the rule (T0-T3)
 * @param changeType - The type of change (create, update, repeal)
 * @returns The severity level
 *
 * @example
 * determineSeverity("T0", "update") // "breaking"
 * determineSeverity("T1", "create") // "major"
 * determineSeverity("T2", "update") // "minor"
 * determineSeverity("T3", "update") // "info"
 * determineSeverity("T3", "repeal") // "breaking"
 */
export function determineSeverity(ruleTier: RiskTier, changeType: ChangeType): EventSeverity {
  // Repeals are always breaking - content removal is critical
  if (changeType === "repeal") {
    return "breaking"
  }

  // Map tier to severity
  switch (ruleTier) {
    case "T0":
      return "breaking"
    case "T1":
      return "major"
    case "T2":
      return "minor"
    case "T3":
      return "info"
    default:
      // Exhaustive check - should never reach here
      const _exhaustive: never = ruleTier
      return "info"
  }
}

// =============================================================================
// Signature Builder Helper
// =============================================================================

/**
 * Build a ContentSyncEventSignature from component parts.
 * Utility function to ensure consistent signature creation.
 *
 * @param params - The signature parameters
 * @returns A complete ContentSyncEventSignature
 */
export function buildEventSignature(params: {
  ruleId: string
  conceptId: string
  type: ContentSyncEventSignature["type"]
  effectiveFrom: string
  sourcePointerIds: string[]
  newValue?: string
}): ContentSyncEventSignature {
  return {
    ruleId: params.ruleId,
    conceptId: params.conceptId,
    type: params.type,
    effectiveFrom: params.effectiveFrom,
    newValue: params.newValue,
    sourcePointerIdsHash: hashSourcePointerIds(params.sourcePointerIds),
  }
}
