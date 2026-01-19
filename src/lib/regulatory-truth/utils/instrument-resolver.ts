// src/lib/regulatory-truth/utils/instrument-resolver.ts
/**
 * Instrument Resolution Utilities
 *
 * Provides idempotent resolution and creation of Instrument records.
 * Handles identity merging when the same instrument is discovered via
 * different identifiers (ELI URI vs NN canonical key).
 *
 * Key principles:
 * - canonicalId = eliUri ?? nnCanonicalKey (never changes once set)
 * - If ELI appears later for existing NN-keyed instrument, we merge
 * - All operations are idempotent
 */

import { dbReg } from "@/lib/db"
import type { InstrumentTextType, InstrumentStatus } from "@/generated/regulatory-client"

// =============================================================================
// Types
// =============================================================================

export interface ResolveInstrumentInput {
  eliUri?: string | null
  nnCanonicalKey?: string | null
  title?: string
  shortTitle?: string
  textType?: InstrumentTextType
}

export interface ResolvedInstrument {
  id: string
  canonicalId: string
  eliUri: string | null
  nnCanonicalKey: string | null
  title: string
  shortTitle: string | null
  status: InstrumentStatus
  hasBaselineText: boolean
  wasCreated: boolean // true if this call created the record
  wasMerged: boolean // true if identities were merged
}

// =============================================================================
// Main Resolution Function
// =============================================================================

/**
 * Resolve or create an Instrument record.
 *
 * This function is idempotent and handles identity merging:
 * 1. Try to find by eliUri (if provided)
 * 2. Try to find by nnCanonicalKey (if provided)
 * 3. If found by one but other identity exists:
 *    - Merge by updating the record with the new identity
 * 4. If not found: create new instrument
 *
 * @param input - At least one of eliUri or nnCanonicalKey must be provided
 * @returns The resolved instrument with metadata about the operation
 * @throws Error if neither identity is provided
 */
export async function resolveOrCreateInstrument(
  input: ResolveInstrumentInput
): Promise<ResolvedInstrument> {
  const { eliUri, nnCanonicalKey, title, shortTitle, textType } = input

  // Validate: at least one identity required
  if (!eliUri && !nnCanonicalKey) {
    throw new Error("resolveOrCreateInstrument: at least one of eliUri or nnCanonicalKey required")
  }

  // Normalize inputs
  const normalizedEli = eliUri?.trim() || null
  const normalizedNnKey = nnCanonicalKey?.trim() || null
  const normalizedTitle = title?.trim() || "Unknown Instrument"

  // Step 1: Try to find existing instrument by ELI
  let existingByEli = null
  if (normalizedEli) {
    existingByEli = await dbReg.instrument.findUnique({
      where: { eliUri: normalizedEli },
    })
  }

  // Step 2: Try to find existing instrument by NN key
  let existingByNnKey = null
  if (normalizedNnKey) {
    existingByNnKey = await dbReg.instrument.findUnique({
      where: { nnCanonicalKey: normalizedNnKey },
    })
  }

  // Step 3: Handle the four cases
  if (existingByEli && existingByNnKey) {
    // Case A: Found by both identities
    if (existingByEli.id === existingByNnKey.id) {
      // Same record - just return it
      return {
        id: existingByEli.id,
        canonicalId: existingByEli.canonicalId,
        eliUri: existingByEli.eliUri,
        nnCanonicalKey: existingByEli.nnCanonicalKey,
        title: existingByEli.title,
        shortTitle: existingByEli.shortTitle,
        status: existingByEli.status,
        hasBaselineText: existingByEli.hasBaselineText,
        wasCreated: false,
        wasMerged: false,
      }
    } else {
      // Different records with conflicting identities - this is a data integrity issue
      // Log and return the one found by ELI (preferred identity)
      console.error(
        `[instrument-resolver] CONFLICT: ELI ${normalizedEli} points to ${existingByEli.id}, ` +
          `but NN key ${normalizedNnKey} points to ${existingByNnKey.id}. Using ELI record.`
      )
      return {
        id: existingByEli.id,
        canonicalId: existingByEli.canonicalId,
        eliUri: existingByEli.eliUri,
        nnCanonicalKey: existingByEli.nnCanonicalKey,
        title: existingByEli.title,
        shortTitle: existingByEli.shortTitle,
        status: existingByEli.status,
        hasBaselineText: existingByEli.hasBaselineText,
        wasCreated: false,
        wasMerged: false,
      }
    }
  }

  if (existingByEli) {
    // Case B: Found by ELI, check if we need to add NN key
    if (normalizedNnKey && !existingByEli.nnCanonicalKey) {
      // Merge: add NN key to existing ELI record
      const updated = await dbReg.instrument.update({
        where: { id: existingByEli.id },
        data: { nnCanonicalKey: normalizedNnKey },
      })
      return {
        id: updated.id,
        canonicalId: updated.canonicalId,
        eliUri: updated.eliUri,
        nnCanonicalKey: updated.nnCanonicalKey,
        title: updated.title,
        shortTitle: updated.shortTitle,
        status: updated.status,
        hasBaselineText: updated.hasBaselineText,
        wasCreated: false,
        wasMerged: true,
      }
    }
    // No merge needed
    return {
      id: existingByEli.id,
      canonicalId: existingByEli.canonicalId,
      eliUri: existingByEli.eliUri,
      nnCanonicalKey: existingByEli.nnCanonicalKey,
      title: existingByEli.title,
      shortTitle: existingByEli.shortTitle,
      status: existingByEli.status,
      hasBaselineText: existingByEli.hasBaselineText,
      wasCreated: false,
      wasMerged: false,
    }
  }

  if (existingByNnKey) {
    // Case C: Found by NN key, check if we need to add ELI
    if (normalizedEli && !existingByNnKey.eliUri) {
      // Merge: add ELI to existing NN key record
      // Also update canonicalId to prefer ELI
      const updated = await dbReg.instrument.update({
        where: { id: existingByNnKey.id },
        data: {
          eliUri: normalizedEli,
          canonicalId: normalizedEli, // Upgrade canonicalId to ELI
        },
      })
      return {
        id: updated.id,
        canonicalId: updated.canonicalId,
        eliUri: updated.eliUri,
        nnCanonicalKey: updated.nnCanonicalKey,
        title: updated.title,
        shortTitle: updated.shortTitle,
        status: updated.status,
        hasBaselineText: updated.hasBaselineText,
        wasCreated: false,
        wasMerged: true,
      }
    }
    // No merge needed
    return {
      id: existingByNnKey.id,
      canonicalId: existingByNnKey.canonicalId,
      eliUri: existingByNnKey.eliUri,
      nnCanonicalKey: existingByNnKey.nnCanonicalKey,
      title: existingByNnKey.title,
      shortTitle: existingByNnKey.shortTitle,
      status: existingByNnKey.status,
      hasBaselineText: existingByNnKey.hasBaselineText,
      wasCreated: false,
      wasMerged: false,
    }
  }

  // Case D: Not found by either - create new
  const canonicalId = normalizedEli || normalizedNnKey!
  const status: InstrumentStatus =
    textType === "CONSOLIDATED" ? "CONSOLIDATED_AVAILABLE" : "DELTA_ONLY"

  const created = await dbReg.instrument.create({
    data: {
      canonicalId,
      eliUri: normalizedEli,
      nnCanonicalKey: normalizedNnKey,
      title: normalizedTitle,
      shortTitle: shortTitle?.trim() || null,
      status,
      coverageStartType: textType || "UNKNOWN",
    },
  })

  return {
    id: created.id,
    canonicalId: created.canonicalId,
    eliUri: created.eliUri,
    nnCanonicalKey: created.nnCanonicalKey,
    title: created.title,
    shortTitle: created.shortTitle,
    status: created.status,
    hasBaselineText: created.hasBaselineText,
    wasCreated: true,
    wasMerged: false,
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate NN canonical key from year/issue/item.
 */
export function generateNNCanonicalKey(year: number, issue: number, item: number): string {
  return `nn:${year}:${issue}:${item}`
}

/**
 * Parse NN canonical key into components.
 */
export function parseNNCanonicalKey(
  key: string
): { year: number; issue: number; item: number } | null {
  const match = key.match(/^nn:(\d+):(\d+):(\d+)$/)
  if (!match) return null
  return {
    year: parseInt(match[1], 10),
    issue: parseInt(match[2], 10),
    item: parseInt(match[3], 10),
  }
}

/**
 * Check if an instrument can produce consolidated text.
 */
export function canConsolidate(status: InstrumentStatus): boolean {
  return status === "BASELINED" || status === "CONSOLIDATED_AVAILABLE"
}
