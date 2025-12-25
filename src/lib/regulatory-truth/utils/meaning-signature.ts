// src/lib/regulatory-truth/utils/meaning-signature.ts
// Computes a stable hash for rule meaning to enforce uniqueness

import { createHash } from "crypto"

/**
 * Compute the meaning signature for a regulatory rule.
 * This hash uniquely identifies the "meaning" of a rule based on:
 * - conceptSlug (canonical concept identifier)
 * - value (the regulatory value)
 * - valueType (how to interpret the value)
 * - effectiveFrom (when the rule starts)
 * - effectiveUntil (when the rule ends, if any)
 *
 * Used to enforce uniqueness: only one "active truth" (APPROVED/PUBLISHED)
 * can exist per meaning signature.
 */
export function computeMeaningSignature(params: {
  conceptSlug: string
  value: string
  valueType: string
  effectiveFrom: Date
  effectiveUntil?: Date | null
}): string {
  const { conceptSlug, value, valueType, effectiveFrom, effectiveUntil } = params

  // Build a stable string representation
  // Using pipe delimiter and ISO date format for consistency
  const input = [
    conceptSlug,
    value,
    valueType,
    effectiveFrom.toISOString(),
    effectiveUntil?.toISOString() ?? "",
  ].join("|")

  // Use MD5 for speed (this is for uniqueness, not security)
  // Matches the Postgres MD5 function used in backfill
  return createHash("md5").update(input).digest("hex")
}
