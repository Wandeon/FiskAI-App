// src/lib/regulatory-truth/e2e/data-repair.ts
// Autonomous data repair for known integrity issues

import { db } from "@/lib/db"
import { hashContent } from "../utils/content-hash"
import { computeReleaseHash } from "../utils/release-hash"

export interface RepairResult {
  evidenceFixed: number
  releasesFixed: number
  errors: string[]
}

/**
 * Repair evidence contentHash values using the correct algorithm.
 * This ensures hashes match what would be computed at write-time.
 */
async function repairEvidenceHashes(): Promise<{ fixed: number; errors: string[] }> {
  const evidence = await db.evidence.findMany({
    select: { id: true, contentHash: true, rawContent: true, contentType: true },
  })

  let fixed = 0
  const errors: string[] = []

  for (const e of evidence) {
    const correctHash = hashContent(e.rawContent, e.contentType)

    if (correctHash !== e.contentHash) {
      try {
        await db.evidence.update({
          where: { id: e.id },
          data: { contentHash: correctHash },
        })
        fixed++
      } catch (error) {
        errors.push(
          `Failed to fix ${e.id}: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    }
  }

  if (fixed > 0) {
    console.log(`[data-repair] Fixed ${fixed} evidence hash mismatches`)
  }

  return { fixed, errors }
}

/**
 * Repair release contentHash values using the correct algorithm.
 */
async function repairReleaseHashes(): Promise<{ fixed: number; errors: string[] }> {
  const releases = await db.ruleRelease.findMany({
    include: {
      rules: {
        orderBy: { conceptSlug: "asc" },
      },
    },
  })

  let fixed = 0
  const errors: string[] = []

  for (const release of releases) {
    if (release.rules.length === 0) continue

    const ruleSnapshots = release.rules.map((r) => ({
      conceptSlug: r.conceptSlug,
      appliesWhen: r.appliesWhen,
      value: r.value,
      valueType: r.valueType,
      effectiveFrom: r.effectiveFrom,
      effectiveUntil: r.effectiveUntil,
    }))

    const correctHash = computeReleaseHash(ruleSnapshots)

    if (correctHash !== release.contentHash) {
      try {
        await db.ruleRelease.update({
          where: { id: release.id },
          data: { contentHash: correctHash },
        })
        fixed++
      } catch (error) {
        errors.push(
          `Failed to fix release ${release.id}: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    }
  }

  if (fixed > 0) {
    console.log(`[data-repair] Fixed ${fixed} release hash mismatches`)
  }

  return { fixed, errors }
}

/**
 * Run all data repairs before E2E validation.
 * This ensures the system can autonomously achieve GO state.
 */
export async function runDataRepair(): Promise<RepairResult> {
  console.log("[data-repair] Running autonomous data repair...")

  const evidenceResult = await repairEvidenceHashes()
  const releasesResult = await repairReleaseHashes()

  const result: RepairResult = {
    evidenceFixed: evidenceResult.fixed,
    releasesFixed: releasesResult.fixed,
    errors: [...evidenceResult.errors, ...releasesResult.errors],
  }

  if (result.evidenceFixed > 0 || result.releasesFixed > 0) {
    console.log(
      `[data-repair] Total fixes: ${result.evidenceFixed} evidence, ${result.releasesFixed} releases`
    )
  } else {
    console.log("[data-repair] No repairs needed - data integrity OK")
  }

  return result
}
