// src/lib/regulatory-truth/utils/release-hash.ts
import { createHash } from "crypto"

export interface RuleSnapshot {
  conceptSlug: string
  appliesWhen: unknown
  value: string
  valueType: string
  effectiveFrom: string | null
  effectiveUntil: string | null
}

/**
 * Compute deterministic hash for a set of rules.
 * CRITICAL: This must match exactly for verification.
 */
export function computeReleaseHash(rules: RuleSnapshot[]): string {
  // Sort by conceptSlug for determinism
  const sorted = [...rules].sort((a, b) => a.conceptSlug.localeCompare(b.conceptSlug))

  // Create canonical JSON (sorted keys, no whitespace variance)
  const canonical = sorted.map((r) => ({
    conceptSlug: r.conceptSlug,
    appliesWhen: typeof r.appliesWhen === "string" ? JSON.parse(r.appliesWhen) : r.appliesWhen,
    value: r.value,
    valueType: r.valueType,
    effectiveFrom: r.effectiveFrom,
    effectiveUntil: r.effectiveUntil,
  }))

  // Stable stringify with sorted keys
  const json = JSON.stringify(canonical, Object.keys(canonical[0] || {}).sort())

  return createHash("sha256").update(json).digest("hex")
}

/**
 * Verify a release hash matches its rules.
 */
export async function verifyReleaseHash(
  releaseId: string,
  db: any
): Promise<{ valid: boolean; stored: string; computed: string; ruleCount: number }> {
  const release = await db.ruleRelease.findUnique({
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

  const snapshots: RuleSnapshot[] = release.rules.map((r: any) => ({
    conceptSlug: r.conceptSlug,
    appliesWhen: r.appliesWhen,
    value: r.value,
    valueType: r.valueType,
    effectiveFrom: r.effectiveFrom?.toISOString?.()?.split("T")[0] || r.effectiveFrom || null,
    effectiveUntil: r.effectiveUntil?.toISOString?.()?.split("T")[0] || r.effectiveUntil || null,
  }))

  const computed = computeReleaseHash(snapshots)

  return {
    valid: computed === release.contentHash,
    stored: release.contentHash,
    computed,
    ruleCount: release.rules.length,
  }
}
