#!/usr/bin/env tsx
// src/lib/regulatory-truth/scripts/batch-review-drafts.ts
// Batch process DRAFT rules through the reviewer pipeline
//
// This script addresses issue #162: 509 rules stuck in DRAFT status
// The bottleneck is that rules need to pass through the reviewer agent
// to progress from DRAFT → APPROVED/PENDING_REVIEW/REJECTED

import { RiskTier } from "@prisma/client"
import { cliDb as db } from "../cli-db"
import { closeCliDb } from "../cli-db"
import { runReviewer } from "../agents/reviewer"
import { publishRules } from "../services/rule-status-service"
import { runReleaser } from "../agents/releaser"

interface BatchReviewOptions {
  minConfidence?: number
  maxRules?: number
  dryRun?: boolean
  autoPublish?: boolean
  riskTiers?: string[]
}

async function batchReviewDrafts(options: BatchReviewOptions = {}) {
  const {
    minConfidence = 0.9,
    maxRules = 100,
    dryRun = false,
    autoPublish = false,
    riskTiers = ["T0", "T1", "T2", "T3"],
  } = options

  console.log("=".repeat(72))
  console.log("Batch Review DRAFT Rules")
  console.log("=".repeat(72))
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`)
  console.log(`Min confidence: ${minConfidence}`)
  console.log(`Max rules to process: ${maxRules}`)
  console.log(`Risk tiers: ${riskTiers.join(", ")}`)
  console.log(`Auto-publish: ${autoPublish}`)
  console.log("")

  // Find DRAFT rules with high confidence
  const draftRules = await db.regulatoryRule.findMany({
    where: {
      status: "DRAFT",
      confidence: { gte: minConfidence },
      riskTier: { in: riskTiers as RiskTier[] },
    },
    include: {
      sourcePointers: {
        include: {
          evidence: true,
        },
      },
    },
    orderBy: [
      { riskTier: "asc" }, // T0 first (most critical)
      { confidence: "desc" }, // High confidence first
    ],
    take: maxRules,
  })

  if (draftRules.length === 0) {
    console.log("No DRAFT rules found matching criteria.")
    return {
      processed: 0,
      approved: 0,
      pendingReview: 0,
      rejected: 0,
      errors: 0,
    }
  }

  console.log(`Found ${draftRules.length} DRAFT rules to review\n`)

  // Group by risk tier for reporting
  const byTier = draftRules.reduce(
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

  if (dryRun) {
    console.log("DRY RUN - No changes will be made")
    return {
      processed: 0,
      approved: 0,
      pendingReview: 0,
      rejected: 0,
      errors: 0,
    }
  }

  // Process each rule through the reviewer
  const stats = {
    processed: 0,
    approved: 0,
    pendingReview: 0,
    rejected: 0,
    errors: 0,
  }

  const approvedRuleIds: string[] = []

  console.log("Processing rules through reviewer...\n")

  for (const rule of draftRules) {
    try {
      console.log(
        `[${stats.processed + 1}/${draftRules.length}] Reviewing ${rule.conceptSlug} (${rule.riskTier}, confidence: ${rule.confidence})`
      )

      const result = await runReviewer(rule.id)

      if (!result.success) {
        console.error(`  ✗ Review failed: ${result.error}`)
        stats.errors++
        continue
      }

      // Check the new status after review
      const updatedRule = await db.regulatoryRule.findUnique({
        where: { id: rule.id },
        select: { status: true },
      })

      if (!updatedRule) {
        console.error(`  ✗ Rule not found after review`)
        stats.errors++
        continue
      }

      const newStatus = updatedRule.status

      // Track statistics
      switch (newStatus) {
        case "APPROVED":
          stats.approved++
          approvedRuleIds.push(rule.id)
          console.log(`  ✓ APPROVED`)
          break
        case "PENDING_REVIEW":
          stats.pendingReview++
          console.log(`  ⏳ PENDING_REVIEW (requires human review)`)
          break
        case "REJECTED":
          stats.rejected++
          console.log(`  ✗ REJECTED`)
          break
        default:
          console.log(`  ⚠ Unexpected status: ${newStatus}`)
      }

      stats.processed++
    } catch (error) {
      console.error(`  ✗ Error: ${error instanceof Error ? error.message : String(error)}`)
      stats.errors++
    }
  }

  console.log("\n" + "=".repeat(72))
  console.log("Review Complete")
  console.log("=".repeat(72))
  console.log(`Processed: ${stats.processed}/${draftRules.length}`)
  console.log(`Approved: ${stats.approved}`)
  console.log(`Pending Review: ${stats.pendingReview}`)
  console.log(`Rejected: ${stats.rejected}`)
  console.log(`Errors: ${stats.errors}`)
  console.log("")

  // Auto-publish if requested and we have approved rules
  if (autoPublish && approvedRuleIds.length > 0) {
    console.log("=".repeat(72))
    console.log(`Publishing ${approvedRuleIds.length} approved rules...`)
    console.log("=".repeat(72))

    try {
      const releaseResult = await runReleaser(approvedRuleIds)

      if (releaseResult.success) {
        console.log(`✓ Published ${releaseResult.publishedRuleIds.length} rules`)
        console.log(`  Release ID: ${releaseResult.releaseId}`)
        console.log(`  Version: ${releaseResult.output?.release?.version}`)
      } else {
        console.error(`✗ Publication failed: ${releaseResult.error}`)
      }
    } catch (error) {
      console.error(
        `✗ Publication error: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  } else if (approvedRuleIds.length > 0 && !autoPublish) {
    console.log("To publish these approved rules, run:")
    console.log(
      `  npx tsx src/lib/regulatory-truth/scripts/run-releaser.ts --ids "${approvedRuleIds.join(",")}"`
    )
  }

  return stats
}

async function main() {
  const args = process.argv.slice(2)

  // Parse arguments
  const help = args.includes("--help") || args.includes("-h")
  const dryRun = args.includes("--dry-run")
  const autoPublish = args.includes("--publish")
  const minConfidenceArg = args.find((_, i, a) => a[i - 1] === "--min-confidence")
  const maxRulesArg = args.find((_, i, a) => a[i - 1] === "--max-rules")
  const tiersArg = args.find((_, i, a) => a[i - 1] === "--tiers")

  if (help) {
    console.log(`
Batch Review DRAFT Rules
=========================

Process DRAFT rules through the reviewer agent to unblock the RTL pipeline.

This script addresses issue #162 where 509 rules are stuck in DRAFT status.
The reviewer agent moves rules from DRAFT to:
  - APPROVED (if confidence >= 0.95 for T2/T3)
  - PENDING_REVIEW (if confidence < 0.95 or risk tier is T0/T1)
  - REJECTED (if validation fails)

Usage: npx tsx src/lib/regulatory-truth/scripts/batch-review-drafts.ts [options]

Options:
  --min-confidence FLOAT  Minimum confidence threshold (default: 0.90)
  --max-rules INT         Maximum rules to process (default: 100)
  --tiers "T0,T1,T2,T3"   Comma-separated risk tiers to process (default: all)
  --dry-run               Show what would be done without making changes
  --publish               Automatically publish approved rules
  --help, -h              Show this help

Examples:
  # Preview what would be processed
  npx tsx src/lib/regulatory-truth/scripts/batch-review-drafts.ts --dry-run

  # Process first 50 high-confidence T2/T3 rules
  npx tsx src/lib/regulatory-truth/scripts/batch-review-drafts.ts --tiers "T2,T3" --max-rules 50

  # Process and auto-publish all high-confidence rules
  npx tsx src/lib/regulatory-truth/scripts/batch-review-drafts.ts --publish

  # Process only T0/T1 rules (will go to PENDING_REVIEW for human approval)
  npx tsx src/lib/regulatory-truth/scripts/batch-review-drafts.ts --tiers "T0,T1"
`)
    await closeCliDb()
    process.exit(0)
  }

  const minConfidence = minConfidenceArg ? parseFloat(minConfidenceArg) : 0.9
  const maxRules = maxRulesArg ? parseInt(maxRulesArg, 10) : 100
  const riskTiers = tiersArg ? tiersArg.split(",").map((t) => t.trim()) : ["T0", "T1", "T2", "T3"]

  const stats = await batchReviewDrafts({
    minConfidence,
    maxRules,
    dryRun,
    autoPublish,
    riskTiers,
  })

  await closeCliDb()

  // Exit with error if we had errors
  if (stats.errors > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error("Batch review failed:", err)
  closeCliDb().finally(() => process.exit(1))
})
