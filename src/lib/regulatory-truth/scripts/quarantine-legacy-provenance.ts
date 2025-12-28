// src/lib/regulatory-truth/scripts/quarantine-legacy-provenance.ts
// Quarantine script for legacy rules with broken or unverified provenance.
//
// Usage:
//   npx tsx src/lib/regulatory-truth/scripts/quarantine-legacy-provenance.ts [--report-only] [--downgrade]
//
// This script:
// 1. Finds SourcePointers with matchType=NOT_FOUND/PENDING_VERIFICATION or missing offsets
// 2. Finds rules linked to those pointers that are APPROVED/PUBLISHED
// 3. Reports them (--report-only: just report, no changes)
// 4. Optionally downgrades to PENDING_REVIEW (--downgrade)
//
// CRITICAL: This is how you clean historical contamination from the truth layer.
//
// FEATURES:
// - Batch transactions (25 rules per batch) - prevents timeouts and reduces lock contention
// - Idempotent - skips rules already in PENDING_REVIEW
// - Audit versioning - includes runId, scriptName, gitCommit in every audit event
// - Uses systemAction: "QUARANTINE_DOWNGRADE" (not bypassApproval)

import { db, runWithRegulatoryContext } from "@/lib/db"
import { Prisma } from "@prisma/client"
import { logAuditEvent } from "../utils/audit-log"
import { randomUUID } from "crypto"
import { execSync } from "child_process"

// =============================================================================
// CONFIGURATION
// =============================================================================

const BATCH_SIZE = 25 // Rules per transaction batch
const SCRIPT_NAME = "quarantine-legacy-provenance"
const SCRIPT_VERSION = "2.0.0" // Increment when script logic changes

// Get current git commit for audit trail
function getGitCommit(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim()
  } catch {
    return "unknown"
  }
}

// =============================================================================
// TYPES
// =============================================================================

interface QuarantineReport {
  /** Unique run ID for this execution */
  runId: string
  /** Script version */
  scriptVersion: string
  /** Git commit */
  gitCommit: string
  /** Pointers with broken/unverified provenance */
  brokenPointers: BrokenPointerInfo[]
  /** Rules affected by broken pointers */
  affectedRules: AffectedRuleInfo[]
  /** Summary counts */
  summary: {
    totalBrokenPointers: number
    pointersMissingOffsets: number
    pointersNotVerified: number
    pointersNotFound: number
    rulesApproved: number
    rulesPublished: number
    rulesSkipped: number // Already PENDING_REVIEW
    rulesDowngraded: number
    batchesProcessed: number
  }
}

interface BrokenPointerInfo {
  pointerId: string
  evidenceId: string
  matchType: string | null
  hasOffsets: boolean
  quotePreview: string
  linkedRuleIds: string[]
}

interface AffectedRuleInfo {
  ruleId: string
  conceptSlug: string
  riskTier: string
  status: string
  pointerIds: string[]
  wasDowngraded: boolean
  wasSkipped: boolean
}

// =============================================================================
// SCANNING
// =============================================================================

async function scanBrokenPointers(): Promise<BrokenPointerInfo[]> {
  // Find pointers with issues:
  // 1. matchType is NOT_FOUND, PENDING_VERIFICATION, or null
  // 2. OR startOffset/endOffset is null
  const brokenPointers = await db.sourcePointer.findMany({
    where: {
      OR: [
        { matchType: "NOT_FOUND" },
        { matchType: "PENDING_VERIFICATION" },
        { matchType: null },
        { startOffset: null },
        { endOffset: null },
      ],
    },
    include: {
      rules: {
        where: {
          status: { in: ["APPROVED", "PUBLISHED"] },
        },
        select: {
          id: true,
        },
      },
    },
  })

  return brokenPointers.map((p) => ({
    pointerId: p.id,
    evidenceId: p.evidenceId,
    matchType: p.matchType,
    hasOffsets: p.startOffset !== null && p.endOffset !== null,
    quotePreview: p.exactQuote.slice(0, 60) + (p.exactQuote.length > 60 ? "..." : ""),
    linkedRuleIds: p.rules.map((r) => r.id),
  }))
}

async function findAffectedRules(brokenPointers: BrokenPointerInfo[]): Promise<AffectedRuleInfo[]> {
  // Collect all affected rule IDs
  const affectedRuleIds = new Set<string>()
  for (const pointer of brokenPointers) {
    for (const ruleId of pointer.linkedRuleIds) {
      affectedRuleIds.add(ruleId)
    }
  }

  if (affectedRuleIds.size === 0) {
    return []
  }

  const rules = await db.regulatoryRule.findMany({
    where: {
      id: { in: Array.from(affectedRuleIds) },
      // Include APPROVED, PUBLISHED for downgrade
      // PENDING_REVIEW will be marked as skipped
      status: { in: ["APPROVED", "PUBLISHED", "PENDING_REVIEW"] },
    },
    include: {
      sourcePointers: {
        select: { id: true },
      },
    },
  })

  return rules.map((r) => ({
    ruleId: r.id,
    conceptSlug: r.conceptSlug,
    riskTier: r.riskTier,
    status: r.status,
    pointerIds: r.sourcePointers.map((p) => p.id),
    wasDowngraded: false,
    wasSkipped: r.status === "PENDING_REVIEW", // Already in target state
  }))
}

// =============================================================================
// DOWNGRADE LOGIC
// =============================================================================

interface DowngradeResult {
  downgradedCount: number
  skippedCount: number
  batchesProcessed: number
  errors: string[]
}

/**
 * Downgrade rules to PENDING_REVIEW in batches.
 *
 * FEATURES:
 * - Batch transactions (prevents timeouts)
 * - Idempotent (skips already PENDING_REVIEW)
 * - Audit versioning (runId, scriptName, gitCommit)
 * - Uses systemAction: "QUARANTINE_DOWNGRADE"
 */
async function downgradeRules(
  rules: AffectedRuleInfo[],
  runId: string,
  gitCommit: string
): Promise<DowngradeResult> {
  const result: DowngradeResult = {
    downgradedCount: 0,
    skippedCount: 0,
    batchesProcessed: 0,
    errors: [],
  }

  // Filter to only rules that need downgrading
  const rulesToDowngrade = rules.filter((r) => r.status === "APPROVED" || r.status === "PUBLISHED")

  // Count already skipped
  result.skippedCount = rules.filter((r) => r.wasSkipped).length

  if (rulesToDowngrade.length === 0) {
    console.log(
      `[quarantine] No rules need downgrading (${result.skippedCount} already PENDING_REVIEW)`
    )
    return result
  }

  // Process in batches
  for (let i = 0; i < rulesToDowngrade.length; i += BATCH_SIZE) {
    const batch = rulesToDowngrade.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(rulesToDowngrade.length / BATCH_SIZE)

    console.log(`[quarantine] Processing batch ${batchNum}/${totalBatches} (${batch.length} rules)`)

    try {
      // Use regulatory context with systemAction for proper transition
      await runWithRegulatoryContext(
        {
          source: SCRIPT_NAME,
          systemAction: "QUARANTINE_DOWNGRADE",
        },
        async () => {
          await db.$transaction(
            async (tx) => {
              for (const rule of batch) {
                // Double-check current status (idempotency)
                const current = await tx.regulatoryRule.findUnique({
                  where: { id: rule.ruleId },
                  select: { status: true },
                })

                if (!current) {
                  result.errors.push(`Rule ${rule.ruleId} not found`)
                  continue
                }

                if (current.status === "PENDING_REVIEW") {
                  // Already in target state - skip
                  rule.wasSkipped = true
                  result.skippedCount++
                  continue
                }

                if (current.status !== "APPROVED" && current.status !== "PUBLISHED") {
                  // Unexpected status - skip
                  result.errors.push(`Rule ${rule.ruleId} in unexpected status ${current.status}`)
                  continue
                }

                // Perform downgrade
                await tx.regulatoryRule.update({
                  where: { id: rule.ruleId },
                  data: { status: "PENDING_REVIEW" },
                })

                // Log audit event with full versioning
                await logAuditEvent({
                  action: "RULE_STATUS_CHANGED",
                  entityType: "RULE",
                  entityId: rule.ruleId,
                  metadata: {
                    previousStatus: rule.status,
                    newStatus: "PENDING_REVIEW",
                    source: SCRIPT_NAME,
                    reason: "Legacy provenance quarantine - broken/unverified pointers",
                    isQuarantine: true,
                    // Audit versioning
                    runId,
                    scriptName: SCRIPT_NAME,
                    scriptVersion: SCRIPT_VERSION,
                    gitCommit,
                  },
                })

                rule.wasDowngraded = true
                result.downgradedCount++
              }
            },
            {
              timeout: 30000,
              isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            }
          )
        }
      )

      result.batchesProcessed++
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      result.errors.push(`Batch ${batchNum} failed: ${errorMsg}`)
      console.error(`[quarantine] Batch ${batchNum} failed:`, error)
      // Continue with next batch - partial success is better than total failure
    }
  }

  return result
}

// =============================================================================
// REPORTING
// =============================================================================

function printReport(report: QuarantineReport): void {
  console.log("\n" + "=".repeat(80))
  console.log("LEGACY PROVENANCE QUARANTINE REPORT")
  console.log("=".repeat(80))

  console.log("\n## Run Info")
  console.log(`  Run ID:        ${report.runId}`)
  console.log(`  Script:        ${SCRIPT_NAME}@${report.scriptVersion}`)
  console.log(`  Git Commit:    ${report.gitCommit}`)

  console.log("\n## Summary")
  console.log(`  Total broken pointers: ${report.summary.totalBrokenPointers}`)
  console.log(`    - Missing offsets:   ${report.summary.pointersMissingOffsets}`)
  console.log(`    - Unverified/NotFound: ${report.summary.pointersNotVerified}`)
  console.log(`  Rules APPROVED:        ${report.summary.rulesApproved}`)
  console.log(`  Rules PUBLISHED:       ${report.summary.rulesPublished}`)
  console.log(`  Rules skipped:         ${report.summary.rulesSkipped} (already PENDING_REVIEW)`)
  console.log(`  Rules downgraded:      ${report.summary.rulesDowngraded}`)
  console.log(`  Batches processed:     ${report.summary.batchesProcessed}`)

  if (report.affectedRules.length > 0) {
    console.log("\n## Affected Rules (APPROVED/PUBLISHED with broken provenance)")
    console.log("-".repeat(80))

    for (const rule of report.affectedRules) {
      let statusDisplay: string
      if (rule.wasDowngraded) {
        statusDisplay = `${rule.status} → PENDING_REVIEW`
      } else if (rule.wasSkipped) {
        statusDisplay = `${rule.status} (skipped)`
      } else {
        statusDisplay = rule.status
      }

      console.log(`  ${rule.ruleId}`)
      console.log(`    Concept:    ${rule.conceptSlug}`)
      console.log(`    Risk Tier:  ${rule.riskTier}`)
      console.log(`    Status:     ${statusDisplay}`)
      console.log(`    Pointers:   ${rule.pointerIds.length} (broken provenance)`)
    }
  }

  if (report.brokenPointers.length > 0 && report.brokenPointers.length <= 20) {
    console.log("\n## Broken Pointers (first 20)")
    console.log("-".repeat(80))

    for (const pointer of report.brokenPointers.slice(0, 20)) {
      console.log(`  ${pointer.pointerId}`)
      console.log(`    matchType:  ${pointer.matchType || "null"}`)
      console.log(`    hasOffsets: ${pointer.hasOffsets}`)
      console.log(`    quote:      "${pointer.quotePreview}"`)
      console.log(`    rules:      ${pointer.linkedRuleIds.length}`)
    }

    if (report.brokenPointers.length > 20) {
      console.log(`  ... and ${report.brokenPointers.length - 20} more`)
    }
  }

  console.log("\n" + "=".repeat(80))
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const reportOnly = args.includes("--report-only")
  const shouldDowngrade = args.includes("--downgrade")

  if (!reportOnly && !shouldDowngrade) {
    console.log("Usage: npx tsx quarantine-legacy-provenance.ts [--report-only] [--downgrade]")
    console.log("  --report-only  Just report, no changes")
    console.log("  --downgrade    Downgrade affected rules to PENDING_REVIEW")
    process.exit(1)
  }

  // Generate run metadata
  const runId = randomUUID()
  const gitCommit = getGitCommit()

  console.log(
    `[quarantine] Starting${reportOnly ? " (REPORT ONLY)" : shouldDowngrade ? " (WILL DOWNGRADE)" : ""}...`
  )
  console.log(`[quarantine] Run ID: ${runId}`)
  console.log(`[quarantine] Script: ${SCRIPT_NAME}@${SCRIPT_VERSION}`)
  console.log(`[quarantine] Git: ${gitCommit}`)

  // Scan for broken pointers
  const brokenPointers = await scanBrokenPointers()
  console.log(`[quarantine] Found ${brokenPointers.length} broken pointers`)

  // Find affected rules
  const affectedRules = await findAffectedRules(brokenPointers)
  console.log(`[quarantine] Found ${affectedRules.length} affected rules`)

  // Build initial summary
  const summary = {
    totalBrokenPointers: brokenPointers.length,
    pointersMissingOffsets: brokenPointers.filter((p) => !p.hasOffsets).length,
    pointersNotVerified: brokenPointers.filter(
      (p) =>
        p.matchType === "NOT_FOUND" ||
        p.matchType === "PENDING_VERIFICATION" ||
        p.matchType === null
    ).length,
    pointersNotFound: brokenPointers.filter((p) => p.matchType === "NOT_FOUND").length,
    rulesApproved: affectedRules.filter((r) => r.status === "APPROVED").length,
    rulesPublished: affectedRules.filter((r) => r.status === "PUBLISHED").length,
    rulesSkipped: affectedRules.filter((r) => r.wasSkipped).length,
    rulesDowngraded: 0,
    batchesProcessed: 0,
  }

  // Downgrade if requested
  if (shouldDowngrade && affectedRules.length > 0) {
    console.log(`[quarantine] Downgrading rules to PENDING_REVIEW...`)
    const downgradeResult = await downgradeRules(affectedRules, runId, gitCommit)
    summary.rulesDowngraded = downgradeResult.downgradedCount
    summary.rulesSkipped = downgradeResult.skippedCount
    summary.batchesProcessed = downgradeResult.batchesProcessed
    console.log(
      `[quarantine] Downgraded ${downgradeResult.downgradedCount}, ` +
        `skipped ${downgradeResult.skippedCount}, ` +
        `${downgradeResult.errors.length} errors`
    )

    if (downgradeResult.errors.length > 0) {
      console.log("\n[quarantine] Errors:")
      for (const error of downgradeResult.errors) {
        console.log(`  - ${error}`)
      }
    }
  }

  // Print report
  const report: QuarantineReport = {
    runId,
    scriptVersion: SCRIPT_VERSION,
    gitCommit,
    brokenPointers,
    affectedRules,
    summary,
  }

  printReport(report)

  // Exit with error if there are affected published rules that weren't downgraded
  const remainingPublished = affectedRules.filter(
    (r) => r.status === "PUBLISHED" && !r.wasDowngraded && !r.wasSkipped
  ).length

  if (remainingPublished > 0 && !shouldDowngrade) {
    console.log("\n⚠️  WARNING: There are PUBLISHED rules with broken provenance!")
    console.log("   Run with --downgrade to quarantine them.")
    process.exit(1)
  }

  process.exit(0)
}

main().catch((error) => {
  console.error("[quarantine] Fatal error:", error)
  process.exit(1)
})

export { scanBrokenPointers, findAffectedRules, downgradeRules, type QuarantineReport }
