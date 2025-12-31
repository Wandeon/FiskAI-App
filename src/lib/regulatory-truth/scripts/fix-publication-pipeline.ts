#!/usr/bin/env tsx
// src/lib/regulatory-truth/scripts/fix-publication-pipeline.ts
// Fix the RTL publication pipeline bottleneck (Issue #162)
//
// Root cause: 509 rules stuck in DRAFT, never progressed through reviewer
// Solution: Batch process DRAFT → APPROVED → PUBLISHED

import { cliDb as db } from "../cli-db"
import { closeCliDb } from "../cli-db"
import { runReviewer } from "../agents/reviewer"
import { autoApproveEligibleRules } from "../agents/reviewer"
import { runReleaser } from "../agents/releaser"

interface PipelineStats {
  draftProcessed: number
  autoApproved: number
  readyForRelease: number
  released: number
  errors: string[]
}

async function fixPublicationPipeline(dryRun = false): Promise<PipelineStats> {
  const stats: PipelineStats = {
    draftProcessed: 0,
    autoApproved: 0,
    readyForRelease: 0,
    released: 0,
    errors: [],
  }

  console.log("=".repeat(72))
  console.log("RTL Publication Pipeline Fix - Issue #162")
  console.log("=".repeat(72))
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`)
  console.log("")

  // Step 1: Get current state
  console.log("Step 1: Analyzing current state...")
  console.log("-".repeat(72))

  const statusCounts = await db.regulatoryRule.groupBy({
    by: ["status"],
    _count: true,
  })

  console.log("Current status distribution:")
  for (const { status, _count } of statusCounts) {
    console.log(`  ${status}: ${_count}`)
  }

  const draftCount = statusCounts.find((s) => s.status === "DRAFT")?._count || 0
  const pendingReviewCount = statusCounts.find((s) => s.status === "PENDING_REVIEW")?._count || 0
  const approvedCount = statusCounts.find((s) => s.status === "APPROVED")?._count || 0

  console.log("")
  console.log("Pipeline bottlenecks identified:")
  console.log(`  ${draftCount} rules in DRAFT (need reviewer)`)
  console.log(`  ${pendingReviewCount} rules in PENDING_REVIEW (waiting for approval)`)
  console.log(`  ${approvedCount} rules in APPROVED (ready for release)`)
  console.log("")

  if (dryRun) {
    console.log("DRY RUN - Would process:")
    console.log(`  1. Review ${draftCount} DRAFT rules with confidence >= 0.90`)
    console.log(`  2. Auto-approve eligible PENDING_REVIEW rules (24h grace period)`)
    console.log(`  3. Release all APPROVED rules`)
    console.log("")
    return stats
  }

  // Step 2: Process DRAFT rules through reviewer (T2/T3 only, high confidence)
  // We'll do T2/T3 first as they can auto-approve, T0/T1 require human review
  console.log("Step 2: Processing DRAFT rules (T2/T3, confidence >= 0.95)...")
  console.log("-".repeat(72))

  const draftRules = await db.regulatoryRule.findMany({
    where: {
      status: "DRAFT",
      confidence: { gte: 0.95 },
      riskTier: { in: ["T2", "T3"] },
    },
    select: {
      id: true,
      conceptSlug: true,
      riskTier: true,
      confidence: true,
    },
    orderBy: [{ confidence: "desc" }],
    take: 200, // Process in batches to avoid timeouts
  })

  console.log(`Found ${draftRules.length} high-confidence T2/T3 DRAFT rules`)

  for (const rule of draftRules) {
    try {
      console.log(
        `  [${stats.draftProcessed + 1}/${draftRules.length}] ${rule.conceptSlug} (${rule.riskTier}, ${rule.confidence})`
      )

      const result = await runReviewer(rule.id)

      if (result.success) {
        stats.draftProcessed++
      } else {
        stats.errors.push(`Review failed for ${rule.id}: ${result.error}`)
      }
    } catch (error) {
      stats.errors.push(
        `Error reviewing ${rule.id}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  console.log(`✓ Processed ${stats.draftProcessed} DRAFT rules`)
  console.log("")

  // Step 3: Auto-approve eligible PENDING_REVIEW rules
  console.log("Step 3: Auto-approving eligible PENDING_REVIEW rules...")
  console.log("-".repeat(72))

  try {
    const autoApproveResult = await autoApproveEligibleRules()
    stats.autoApproved = autoApproveResult.approved

    console.log(`✓ Auto-approved ${stats.autoApproved} rules`)
    console.log(`  Skipped: ${autoApproveResult.skipped} (T0/T1 or low confidence)`)

    if (autoApproveResult.errors.length > 0) {
      stats.errors.push(...autoApproveResult.errors)
    }
  } catch (error) {
    stats.errors.push(
      `Auto-approval failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  console.log("")

  // Step 4: Check how many APPROVED rules are ready for release
  console.log("Step 4: Checking APPROVED rules ready for release...")
  console.log("-".repeat(72))

  const approvedRules = await db.regulatoryRule.findMany({
    where: {
      status: "APPROVED",
    },
    select: {
      id: true,
      conceptSlug: true,
      riskTier: true,
      confidence: true,
    },
    orderBy: [{ riskTier: "asc" }, { confidence: "desc" }],
  })

  stats.readyForRelease = approvedRules.length
  console.log(`Found ${stats.readyForRelease} APPROVED rules ready for release`)

  if (approvedRules.length === 0) {
    console.log("No rules to release.")
    console.log("")
    return stats
  }

  // Group by risk tier for release versioning
  const byTier = approvedRules.reduce(
    (acc, rule) => {
      acc[rule.riskTier] = (acc[rule.riskTier] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  console.log("Distribution by risk tier:")
  for (const [tier, count] of Object.entries(byTier)) {
    console.log(`  ${tier}: ${count}`)
  }
  console.log("")

  // Step 5: Release all APPROVED rules
  console.log("Step 5: Releasing APPROVED rules...")
  console.log("-".repeat(72))

  try {
    const ruleIds = approvedRules.map((r) => r.id)
    const releaseResult = await runReleaser(ruleIds)

    if (releaseResult.success) {
      stats.released = releaseResult.publishedRuleIds.length
      console.log(`✓ Published ${stats.released} rules`)
      console.log(`  Release ID: ${releaseResult.releaseId}`)
      console.log(`  Version: ${releaseResult.output?.release?.version}`)
    } else {
      stats.errors.push(`Release failed: ${releaseResult.error}`)
      console.error(`✗ Release failed: ${releaseResult.error}`)
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    stats.errors.push(`Release error: ${errorMsg}`)
    console.error(`✗ Release error: ${errorMsg}`)
  }

  console.log("")

  return stats
}

async function main() {
  const args = process.argv.slice(2)

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
RTL Publication Pipeline Fix (Issue #162)
==========================================

This script fixes the bottleneck where only 12 of 615 rules are published.

Root Cause:
  509 rules stuck in DRAFT - never progressed through reviewer
  28 rules in PENDING_REVIEW - waiting for auto-approval
  1 rule in APPROVED - ready for release

Solution:
  1. Run reviewer on high-confidence DRAFT rules (T2/T3, confidence >= 0.95)
  2. Auto-approve eligible PENDING_REVIEW rules (24h grace period)
  3. Release all APPROVED rules in a new version

Usage: npx tsx src/lib/regulatory-truth/scripts/fix-publication-pipeline.ts [options]

Options:
  --dry-run   Show what would be done without making changes
  --help, -h  Show this help

Examples:
  # Preview what would happen
  npx tsx src/lib/regulatory-truth/scripts/fix-publication-pipeline.ts --dry-run

  # Execute the fix
  npx tsx src/lib/regulatory-truth/scripts/fix-publication-pipeline.ts

Note: This script processes rules in batches to avoid timeouts.
For very large datasets, you may need to run it multiple times.
`)
    await closeCliDb()
    process.exit(0)
  }

  const dryRun = args.includes("--dry-run")

  const stats = await fixPublicationPipeline(dryRun)

  console.log("=".repeat(72))
  console.log("Pipeline Fix Complete")
  console.log("=".repeat(72))
  console.log(`DRAFT processed: ${stats.draftProcessed}`)
  console.log(`Auto-approved: ${stats.autoApproved}`)
  console.log(`Ready for release: ${stats.readyForRelease}`)
  console.log(`Released: ${stats.released}`)
  console.log(`Errors: ${stats.errors.length}`)
  console.log("")

  if (stats.errors.length > 0) {
    console.log("Errors:")
    for (const error of stats.errors.slice(0, 10)) {
      console.log(`  - ${error}`)
    }
    if (stats.errors.length > 10) {
      console.log(`  ... and ${stats.errors.length - 10} more`)
    }
    console.log("")
  }

  // Verify final state
  const finalCounts = await db.regulatoryRule.groupBy({
    by: ["status"],
    _count: true,
  })

  console.log("Final status distribution:")
  for (const { status, _count } of finalCounts) {
    console.log(`  ${status}: ${_count}`)
  }
  console.log("")

  const publishedCount = finalCounts.find((s) => s.status === "PUBLISHED")?._count || 0
  const totalCount = finalCounts.reduce((sum, s) => sum + s._count, 0)

  console.log(
    `Publication rate: ${publishedCount}/${totalCount} (${((publishedCount / totalCount) * 100).toFixed(1)}%)`
  )
  console.log("")

  await closeCliDb()

  if (stats.errors.length > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error("Pipeline fix failed:", err)
  closeCliDb().finally(() => process.exit(1))
})
