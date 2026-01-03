#!/usr/bin/env tsx
// src/lib/regulatory-truth/scripts/drain-pipeline.ts
// Drains all pending work through the full pipeline

import { db, dbReg } from "@/lib/db"
import { fetchDiscoveredItems } from "../agents/sentinel"
import { runExtractorBatch } from "../agents/extractor"
import { runComposerBatch } from "../agents/composer"
import { autoApproveEligibleRules } from "../agents/reviewer"
import { runArbiterBatch } from "../agents/arbiter"
import { runReleaser } from "../agents/releaser"

interface DrainResult {
  phase: string
  success: boolean
  metrics: Record<string, number>
  duration: number
}

async function drainPhase(
  name: string,
  fn: () => Promise<Record<string, number>>
): Promise<DrainResult> {
  const start = Date.now()
  console.log(`\n=== DRAINING: ${name} ===`)

  try {
    const metrics = await fn()
    const duration = Date.now() - start
    console.log(`[${name}] Complete in ${duration}ms:`, metrics)
    return { phase: name, success: true, metrics, duration }
  } catch (error) {
    const duration = Date.now() - start
    console.error(`[${name}] FAILED:`, error)
    return { phase: name, success: false, metrics: {}, duration }
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function drainPipeline(options?: {
  maxFetchBatches?: number
  maxExtractorBatches?: number
  batchDelay?: number
}): Promise<DrainResult[]> {
  const maxFetchBatches = options?.maxFetchBatches ?? 10
  const maxExtractorBatches = options?.maxExtractorBatches ?? 5
  const batchDelay = options?.batchDelay ?? 2000

  const results: DrainResult[] = []

  console.log("\n" + "=".repeat(72))
  console.log("           PIPELINE DRAIN - PROCESSING ALL PENDING WORK")
  console.log("=".repeat(72))

  // Get initial counts
  const initialCounts = {
    pending: await db.discoveredItem.count({ where: { status: "PENDING" } }),
    fetched: await db.discoveredItem.count({ where: { status: "FETCHED" } }),
    evidence: await dbReg.evidence.count(),
    pointers: await db.sourcePointer.count(),
    rules: await db.regulatoryRule.count(),
    pendingReview: await db.regulatoryRule.count({ where: { status: "PENDING_REVIEW" } }),
    approved: await db.regulatoryRule.count({ where: { status: "APPROVED" } }),
    published: await db.regulatoryRule.count({ where: { status: "PUBLISHED" } }),
    conflicts: await db.regulatoryConflict.count({ where: { status: "OPEN" } }),
  }

  console.log("\nInitial state:", initialCounts)

  // Phase 1: Fetch all PENDING items (in batches)
  let totalFetched = 0
  for (let batch = 0; batch < maxFetchBatches; batch++) {
    const pendingCount = await db.discoveredItem.count({
      where: { status: "PENDING", retryCount: { lt: 3 } },
    })
    if (pendingCount === 0) break

    const result = await drainPhase(`fetch-batch-${batch + 1}`, async () => {
      const r = await fetchDiscoveredItems(50)
      totalFetched += r.fetched
      return { fetched: r.fetched, failed: r.failed, remaining: pendingCount - r.fetched }
    })
    results.push(result)

    if (result.metrics.fetched === 0) break
    await sleep(batchDelay)
  }

  // Phase 2: Extract from all unprocessed evidence (in batches)
  let totalExtracted = 0
  for (let batch = 0; batch < maxExtractorBatches; batch++) {
    // Count evidence not referenced by any source pointer
    const processedEvidenceIds = await db.sourcePointer.findMany({
      select: { evidenceId: true },
      distinct: ["evidenceId"],
    })
    const processedIds = processedEvidenceIds.map((p) => p.evidenceId)
    const unprocessedCount = await dbReg.evidence.count({
      where: {
        id: { notIn: processedIds.length > 0 ? processedIds : ["__none__"] },
      },
    })
    if (unprocessedCount === 0) break

    const result = await drainPhase(`extract-batch-${batch + 1}`, async () => {
      const r = await runExtractorBatch(10)
      totalExtracted += r.processed
      return { processed: r.processed, failed: r.failed, pointers: r.sourcePointerIds.length }
    })
    results.push(result)

    if (result.metrics.processed === 0) break
    await sleep(batchDelay)
  }

  // Phase 3: Compose rules from unlinked pointers
  results.push(
    await drainPhase("composer", async () => {
      const r = await runComposerBatch()
      return { success: r.success, failed: r.failed, totalRules: r.totalRules }
    })
  )

  // Phase 4: Auto-approve eligible T2/T3 rules
  // First, reduce grace period for initial drain
  const originalGrace = process.env.AUTO_APPROVE_GRACE_HOURS
  process.env.AUTO_APPROVE_GRACE_HOURS = "0" // No grace period for drain

  results.push(
    await drainPhase("auto-approve", async () => {
      const r = await autoApproveEligibleRules()
      return { approved: r.approved, skipped: r.skipped, errors: r.errors.length }
    })
  )

  // Restore original grace period
  if (originalGrace) {
    process.env.AUTO_APPROVE_GRACE_HOURS = originalGrace
  } else {
    delete process.env.AUTO_APPROVE_GRACE_HOURS
  }

  // Phase 5: Resolve conflicts
  results.push(
    await drainPhase("arbiter", async () => {
      const r = await runArbiterBatch(20)
      return {
        processed: r.processed,
        resolved: r.resolved,
        escalated: r.escalated,
        failed: r.failed,
      }
    })
  )

  // Phase 6: Release approved rules
  results.push(
    await drainPhase("releaser", async () => {
      const approvedRules = await db.regulatoryRule.findMany({
        where: { status: "APPROVED", releases: { none: {} } },
        select: { id: true },
      })

      if (approvedRules.length === 0) {
        return { released: 0, ruleCount: 0 }
      }

      const r = await runReleaser(approvedRules.map((rule) => rule.id))
      return { released: r.success ? 1 : 0, ruleCount: r.publishedRuleIds.length }
    })
  )

  // Get final counts
  const finalCounts = {
    pending: await db.discoveredItem.count({ where: { status: "PENDING" } }),
    fetched: await db.discoveredItem.count({ where: { status: "FETCHED" } }),
    evidence: await dbReg.evidence.count(),
    pointers: await db.sourcePointer.count(),
    rules: await db.regulatoryRule.count(),
    pendingReview: await db.regulatoryRule.count({ where: { status: "PENDING_REVIEW" } }),
    approved: await db.regulatoryRule.count({ where: { status: "APPROVED" } }),
    published: await db.regulatoryRule.count({ where: { status: "PUBLISHED" } }),
    conflicts: await db.regulatoryConflict.count({ where: { status: "OPEN" } }),
  }

  console.log("\n" + "=".repeat(72))
  console.log("                      DRAIN COMPLETE")
  console.log("=".repeat(72))
  console.log("\nFinal state:", finalCounts)
  console.log("\nDelta:")
  console.log(`  - Fetched: ${totalFetched} items`)
  console.log(`  - Extracted: ${totalExtracted} evidence records`)
  console.log(`  - New pointers: ${finalCounts.pointers - initialCounts.pointers}`)
  console.log(
    `  - Rules pending → approved: ${initialCounts.pendingReview - finalCounts.pendingReview}`
  )
  console.log(`  - New published: ${finalCounts.published - initialCounts.published}`)

  return results
}

// CLI entry point
async function main() {
  const args = process.argv.slice(2)
  const help = args.includes("--help") || args.includes("-h")

  if (help) {
    console.log(`
Pipeline Drain Script
=====================

Drains all pending work through the full regulatory pipeline.

Usage: npx tsx src/lib/regulatory-truth/scripts/drain-pipeline.ts [options]

Options:
  --fetch-batches N    Max fetch batches (default: 10)
  --extract-batches N  Max extractor batches (default: 5)
  --delay N            Delay between batches in ms (default: 2000)
  --help, -h           Show this help
`)
    process.exit(0)
  }

  const fetchBatches = parseInt(args.find((_, i, a) => a[i - 1] === "--fetch-batches") || "10")
  const extractBatches = parseInt(args.find((_, i, a) => a[i - 1] === "--extract-batches") || "5")
  const delay = parseInt(args.find((_, i, a) => a[i - 1] === "--delay") || "2000")

  await drainPipeline({
    maxFetchBatches: fetchBatches,
    maxExtractorBatches: extractBatches,
    batchDelay: delay,
  })

  process.exit(0)
}

main().catch((err) => {
  console.error("Drain failed:", err)
  process.exit(1)
})
