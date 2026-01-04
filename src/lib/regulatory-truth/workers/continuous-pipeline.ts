// src/lib/regulatory-truth/workers/continuous-pipeline.ts
// Continuous 24/7 pipeline processing with self-healing

import { db, dbReg } from "@/lib/db"
import { fetchDiscoveredItems } from "../agents/sentinel"
import { runExtractorBatch } from "../agents/extractor"
import { runComposerBatch } from "../agents/composer"
import { autoApproveEligibleRules } from "../agents/reviewer"
import { runArbiterBatch } from "../agents/arbiter"
import { runReleaser } from "../agents/releaser"
import { runDataRepair } from "../e2e/data-repair"

interface PipelineStats {
  cycleCount: number
  lastCycleAt: Date | null
  fetched: number
  extracted: number
  composed: number
  approved: number
  released: number
  errors: number
}

const stats: PipelineStats = {
  cycleCount: 0,
  lastCycleAt: null,
  fetched: 0,
  extracted: 0,
  composed: 0,
  approved: 0,
  released: 0,
  errors: 0,
}

const CYCLE_DELAY_MS = parseInt(process.env.PIPELINE_CYCLE_DELAY_MS || "60000") // 60s between cycles
const PHASE_DELAY_MS = parseInt(process.env.PIPELINE_PHASE_DELAY_MS || "5000") // 5s between phases

let isRunning = false
let shouldStop = false

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runPipelineCycle(): Promise<void> {
  const cycleStart = Date.now()
  stats.cycleCount++
  stats.lastCycleAt = new Date()

  console.log(`\n[pipeline] === CYCLE ${stats.cycleCount} ===`)

  try {
    // Check queue depths
    const pending = await db.discoveredItem.count({
      where: { status: "PENDING", retryCount: { lt: 3 } },
    })
    // Count evidence without source pointers (soft reference pattern)
    const evidenceIdsWithPointers = await db.sourcePointer.findMany({
      select: { evidenceId: true },
      distinct: ["evidenceId"],
    })
    const processedIds = evidenceIdsWithPointers.map((p) => p.evidenceId)
    const unextracted = await dbReg.evidence.count({
      where: { id: { notIn: processedIds.length > 0 ? processedIds : ["__none__"] } },
    })
    const unlinkedPointers = await db.sourcePointer.count({ where: { rules: { none: {} } } })
    const pendingReview = await db.regulatoryRule.count({ where: { status: "PENDING_REVIEW" } })
    const approved = await db.regulatoryRule.count({
      where: { status: "APPROVED", releases: { none: {} } },
    })
    const openConflicts = await db.regulatoryConflict.count({ where: { status: "OPEN" } })

    console.log(
      `[pipeline] Queue depths: pending=${pending}, unextracted=${unextracted}, unlinked=${unlinkedPointers}, review=${pendingReview}, approved=${approved}, conflicts=${openConflicts}`
    )

    // Fetch phase (if items pending)
    if (pending > 0) {
      const result = await fetchDiscoveredItems(20)
      stats.fetched += result.fetched
      console.log(`[pipeline] Fetch: ${result.fetched} fetched, ${result.failed} failed`)
      await sleep(PHASE_DELAY_MS)
    }

    // Extract phase (if evidence needs processing)
    if (unextracted > 0) {
      const result = await runExtractorBatch(5)
      stats.extracted += result.processed
      console.log(`[pipeline] Extract: ${result.processed} processed, ${result.failed} failed`)
      await sleep(PHASE_DELAY_MS)
    }

    // Compose phase (if pointers need linking)
    if (unlinkedPointers > 0) {
      const result = await runComposerBatch()
      stats.composed += result.success
      console.log(`[pipeline] Compose: ${result.success} success, ${result.failed} failed`)
      await sleep(PHASE_DELAY_MS)
    }

    // Auto-approve phase (if rules pending review)
    if (pendingReview > 0) {
      const result = await autoApproveEligibleRules()
      stats.approved += result.approved
      console.log(`[pipeline] Approve: ${result.approved} approved, ${result.skipped} skipped`)
      await sleep(PHASE_DELAY_MS)
    }

    // Arbiter phase (if conflicts open)
    if (openConflicts > 0) {
      const result = await runArbiterBatch(5)
      console.log(
        `[pipeline] Arbiter: ${result.processed} processed, ${result.resolved} resolved, ${result.escalated} escalated`
      )
      await sleep(PHASE_DELAY_MS)
    }

    // Releaser phase (if rules approved)
    if (approved > 0) {
      const approvedRules = await db.regulatoryRule.findMany({
        where: { status: "APPROVED", releases: { none: {} } },
        select: { id: true },
        take: 20,
      })

      if (approvedRules.length > 0) {
        const result = await runReleaser(approvedRules.map((r) => r.id))
        if (result.success) {
          stats.released += result.publishedRuleIds.length
          console.log(`[pipeline] Release: ${result.publishedRuleIds.length} rules published`)
        }
      }
    }

    // Self-healing: repair hashes every 10 cycles
    if (stats.cycleCount % 10 === 0) {
      console.log(`[pipeline] Running self-healing data repair...`)
      const repairResult = await runDataRepair()
      if (repairResult.evidenceFixed > 0 || repairResult.releasesFixed > 0) {
        console.log(
          `[pipeline] Repaired ${repairResult.evidenceFixed} evidence, ${repairResult.releasesFixed} releases`
        )
      }
    }

    const cycleDuration = Date.now() - cycleStart
    console.log(`[pipeline] Cycle ${stats.cycleCount} complete in ${cycleDuration}ms`)
  } catch (error) {
    stats.errors++
    console.error(`[pipeline] Cycle ${stats.cycleCount} error:`, error)
  }
}

export async function startContinuousPipeline(): Promise<void> {
  if (isRunning) {
    console.log("[pipeline] Already running")
    return
  }

  isRunning = true
  shouldStop = false

  console.log("[pipeline] Starting continuous pipeline processing")
  console.log(`[pipeline] Cycle delay: ${CYCLE_DELAY_MS}ms, Phase delay: ${PHASE_DELAY_MS}ms`)

  while (!shouldStop) {
    await runPipelineCycle()
    await sleep(CYCLE_DELAY_MS)
  }

  isRunning = false
  console.log("[pipeline] Stopped")
}

export function stopContinuousPipeline(): void {
  console.log("[pipeline] Stopping...")
  shouldStop = true
}

export function getPipelineStats(): PipelineStats {
  return { ...stats }
}

// Health check endpoint for monitoring
export function getHealthStatus(): {
  healthy: boolean
  running: boolean
  stats: PipelineStats
  uptime: number | null
} {
  const uptime = stats.lastCycleAt ? Date.now() - stats.lastCycleAt.getTime() : null
  const healthy = isRunning && uptime !== null && uptime < CYCLE_DELAY_MS * 3 // Unhealthy if no cycle in 3x expected time

  return {
    healthy,
    running: isRunning,
    stats: { ...stats },
    uptime,
  }
}

// CLI entry point
if (require.main === module) {
  console.log("[pipeline] Starting as CLI...")

  process.on("SIGINT", () => {
    console.log("\n[pipeline] Received SIGINT, stopping gracefully...")
    stopContinuousPipeline()
  })

  process.on("SIGTERM", () => {
    console.log("\n[pipeline] Received SIGTERM, stopping gracefully...")
    stopContinuousPipeline()
  })

  startContinuousPipeline().catch((err) => {
    console.error("[pipeline] Fatal error:", err)
    process.exit(1)
  })
}
