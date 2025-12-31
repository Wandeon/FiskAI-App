// src/lib/regulatory-truth/utils/release-hash.ts
import { createHash } from "crypto"
import type { ExtendedPrismaClient } from "@/lib/db"

export interface RuleSnapshot {
  conceptSlug: string
  appliesWhen: unknown
  value: string
  valueType: string
  effectiveFrom: string | null
  effectiveUntil: string | null
}

/**
 * Normalize date to YYYY-MM-DD format.
 * Ensures consistent date formatting across hash computation.
 */
export function normalizeDate(date: Date | string | null): string | null {
  if (!date) return null

  if (date instanceof Date) {
    return date.toISOString().split("T")[0]
  }

  // If already a string, ensure it's in YYYY-MM-DD format
  if (typeof date === "string") {
    // If it's an ISO string, extract the date part
    if (date.includes("T")) {
      return date.split("T")[0]
    }
    // Assume it's already in correct format
    return date
  }

  return null
}

/**
 * Recursively sort object keys for deterministic JSON serialization.
 * Handles nested objects and arrays.
 */
function sortKeysRecursively(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(sortKeysRecursively)
  }

  if (typeof obj === "object") {
    const sorted: Record<string, unknown> = {}
    const keys = Object.keys(obj).sort()

    for (const key of keys) {
      sorted[key] = sortKeysRecursively((obj as Record<string, unknown>)[key])
    }

    return sorted
  }

  return obj
}

/**
 * Compute deterministic hash for a set of rules.
 * CRITICAL: This must match exactly for verification.
 */
export function computeReleaseHash(rules: RuleSnapshot[]): string {
  // Sort by conceptSlug for determinism
  const sorted = [...rules].sort((a, b) => a.conceptSlug.localeCompare(b.conceptSlug))

  // Create canonical JSON (sorted keys recursively, normalized dates)
  const canonical = sorted.map((r) => ({
    conceptSlug: r.conceptSlug,
    appliesWhen: typeof r.appliesWhen === "string" ? JSON.parse(r.appliesWhen) : r.appliesWhen,
    value: r.value,
    valueType: r.valueType,
    effectiveFrom: normalizeDate(r.effectiveFrom),
    effectiveUntil: normalizeDate(r.effectiveUntil),
  }))

  // Sort all object keys recursively for deterministic serialization
  const sortedCanonical = sortKeysRecursively(canonical)

  // Stable stringify with no whitespace
  const json = JSON.stringify(sortedCanonical)

  return createHash("sha256").update(json).digest("hex")
}

/**
 * Verify a release hash matches its rules.
 */
export async function verifyReleaseHash(
  releaseId: string,
  dbClient: ExtendedPrismaClient
): Promise<{ valid: boolean; stored: string; computed: string; ruleCount: number }> {
  const release = await dbClient.ruleRelease.findUnique({
    where: { id: releaseId },
    include: {
      rules: {
        select: {
          conceptSlug: true,
          appliesWhen: true,
          value: true,
          valueType: true,
          effectiveFrom: true,
          effectiveUntil: true,
        },
      },
    },
  })

  if (!release) throw new Error(`Release not found: ${releaseId}`)

  const snapshots: RuleSnapshot[] = release.rules.map((r) => ({
    conceptSlug: r.conceptSlug,
    appliesWhen: r.appliesWhen,
    value: r.value,
    valueType: r.valueType,
    effectiveFrom: normalizeDate(r.effectiveFrom),
    effectiveUntil: normalizeDate(r.effectiveUntil),
  }))

  const computed = computeReleaseHash(snapshots)

  return {
    valid: computed === release.contentHash,
    stored: release.contentHash,
    computed,
    ruleCount: release.rules.length,
  }
}
