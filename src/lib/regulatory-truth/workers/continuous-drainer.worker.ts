// src/lib/regulatory-truth/workers/continuous-drainer.worker.ts
// Layer B: Continuous 24/7 queue draining - processes backlog until saturation

import {
  extractQueue,
  composeQueue,
  reviewQueue,
  arbiterQueue,
  releaseQueue,
  ocrQueue,
} from "./queues"
import { db } from "@/lib/db"
import { Prisma } from "@prisma/client"
import { fetchDiscoveredItems } from "../agents/sentinel"
import { closeRedis, updateDrainerHeartbeat, updateStageHeartbeat } from "./redis"
import { logWorkerStartup } from "./startup-log"
import { createCircuitBreaker } from "./circuit-breaker"

logWorkerStartup("continuous-drainer")

interface DrainerState {
  isRunning: boolean
  lastActivity: Date
  stats: {
    itemsFetched: number
    ocrJobsQueued: number
    extractJobsQueued: number
    composeJobsQueued: number
    reviewJobsQueued: number
    arbiterJobsQueued: number
    releaseJobsQueued: number
    cycleCount: number
  }
}

const state: DrainerState = {
  isRunning: false,
  lastActivity: new Date(),
  stats: {
    itemsFetched: 0,
    ocrJobsQueued: 0,
    extractJobsQueued: 0,
    composeJobsQueued: 0,
    reviewJobsQueued: 0,
    arbiterJobsQueued: 0,
    releaseJobsQueued: 0,
    cycleCount: 0,
  },
}

// ============================================================================
// PER-STAGE TRACKING (Issue #807 fix: individual stage stall detection)
// ============================================================================

interface StageMetrics {
  itemsProcessed: number
  totalDurationMs: number
  lastError?: string
}

const stageMetrics: Record<string, StageMetrics> = {
  "pending-items": { itemsProcessed: 0, totalDurationMs: 0 },
  "pending-ocr": { itemsProcessed: 0, totalDurationMs: 0 },
  "fetched-evidence": { itemsProcessed: 0, totalDurationMs: 0 },
  "source-pointers": { itemsProcessed: 0, totalDurationMs: 0 },
  "draft-rules": { itemsProcessed: 0, totalDurationMs: 0 },
  conflicts: { itemsProcessed: 0, totalDurationMs: 0 },
  "approved-rules": { itemsProcessed: 0, totalDurationMs: 0 },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DrainerFunction = (fn: () => Promise<number>) => Promise<number>

const stageCircuitBreakers = {
  "pending-items": createCircuitBreaker<number>(
    (async (fn: () => Promise<number>) => fn()) as any,
    {
      timeout: 300000,
      name: "drainer-pending-items",
      errorThresholdPercentage: 30,
    }
  ),
  "pending-ocr": createCircuitBreaker<number>((async (fn: () => Promise<number>) => fn()) as any, {
    timeout: 300000,
    name: "drainer-pending-ocr",
    errorThresholdPercentage: 30,
  }),
  "fetched-evidence": createCircuitBreaker<number>(
    (async (fn: () => Promise<number>) => fn()) as any,
    {
      timeout: 300000,
      name: "drainer-fetched-evidence",
      errorThresholdPercentage: 30,
    }
  ),
  "source-pointers": createCircuitBreaker<number>(
    (async (fn: () => Promise<number>) => fn()) as any,
    {
      timeout: 300000,
      name: "drainer-source-pointers",
      errorThresholdPercentage: 30,
    }
  ),
  "draft-rules": createCircuitBreaker<number>((async (fn: () => Promise<number>) => fn()) as any, {
    timeout: 300000,
    name: "drainer-draft-rules",
    errorThresholdPercentage: 30,
  }),
  conflicts: createCircuitBreaker<number>((async (fn: () => Promise<number>) => fn()) as any, {
    timeout: 300000,
    name: "drainer-conflicts",
    errorThresholdPercentage: 30,
  }),
  "approved-rules": createCircuitBreaker<number>(
    (async (fn: () => Promise<number>) => fn()) as any,
    {
      timeout: 300000,
      name: "drainer-approved-rules",
      errorThresholdPercentage: 30,
    }
  ),
}

async function executeStage(
  stageName: string,
  stageFunction: () => Promise<number>
): Promise<number> {
  const startTime = Date.now()
  let itemsProcessed = 0

  try {
    const breaker = stageCircuitBreakers[stageName as keyof typeof stageCircuitBreakers]
    itemsProcessed = (await breaker.fire(stageFunction)) as number
    const duration = Date.now() - startTime
    stageMetrics[stageName].itemsProcessed += itemsProcessed
    stageMetrics[stageName].totalDurationMs += duration
    delete stageMetrics[stageName].lastError
    const avgDuration =
      stageMetrics[stageName].itemsProcessed > 0
        ? stageMetrics[stageName].totalDurationMs / stageMetrics[stageName].itemsProcessed
        : 0
    await updateStageHeartbeat({
      stage: stageName,
      lastActivity: new Date().toISOString(),
      itemsProcessed: stageMetrics[stageName].itemsProcessed,
      avgDurationMs: Math.round(avgDuration),
    }).catch((err) => {
      console.error(
        `[drainer] Failed to update stage heartbeat for ${stageName}:`,
        err instanceof Error ? err.message : err
      )
    })
    return itemsProcessed
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    stageMetrics[stageName].lastError = error.message
    await updateStageHeartbeat({
      stage: stageName,
      lastActivity: new Date().toISOString(),
      itemsProcessed: stageMetrics[stageName].itemsProcessed,
      avgDurationMs: 0,
      lastError: error.message,
    }).catch((updateErr) => {
      console.error(
        `[drainer] Failed to update stage heartbeat for ${stageName}:`,
        updateErr instanceof Error ? updateErr.message : updateErr
      )
    })
    throw error
  }
}

// Backoff configuration
const BACKOFF = {
  minDelay: 1000, // 1 second when work exists
  maxDelay: 60000, // 60 seconds when idle
  multiplier: 2,
  currentDelay: 1000,
}

function resetBackoff(): void {
  BACKOFF.currentDelay = BACKOFF.minDelay
}

function increaseBackoff(): void {
  BACKOFF.currentDelay = Math.min(BACKOFF.currentDelay * BACKOFF.multiplier, BACKOFF.maxDelay)
}

/**
 * Check for PENDING discovered items and fetch them
 */
async function drainPendingItems(): Promise<number> {
  const pendingCount = await db.discoveredItem.count({
    where: { status: "PENDING", retryCount: { lt: 3 } },
  })

  if (pendingCount === 0) return 0

  console.log(`[drainer] Found ${pendingCount} PENDING items, fetching batch...`)
  const result = await fetchDiscoveredItems(50)
  state.stats.itemsFetched += result.fetched

  return result.fetched
}

/**
 * Check for PDF_SCANNED evidence without OCR artifacts and queue OCR jobs
 */
async function drainPendingOcr(): Promise<number> {
  // Find scanned PDFs without OCR artifacts
  const pending = await db.evidence.findMany({
    where: {
      contentClass: "PDF_SCANNED",
      primaryTextArtifactId: null,
      // Exclude those with error in ocrMetadata
      OR: [
        { ocrMetadata: { equals: Prisma.DbNull } },
        { ocrMetadata: { path: ["error"], equals: Prisma.DbNull } },
      ],
    },
    select: { id: true },
    take: 10,
  })

  if (pending.length === 0) return 0

  const runId = `drain-ocr-${Date.now()}`
  await ocrQueue.addBulk(
    pending.map((e) => ({
      name: "ocr",
      data: { evidenceId: e.id, runId },
    }))
  )

  console.log(`[drainer] Queued ${pending.length} OCR jobs`)
  state.stats.ocrJobsQueued += pending.length

  return pending.length
}

/**
 * Check for FETCHED evidence without pointers and queue extract jobs
 */
async function drainFetchedEvidence(): Promise<number> {
  // Find evidence IDs from FETCHED items that don't have source pointers yet
  // Note: We use raw query because Evidence doesn't have discoveredItems relation
  const fetchedItems = await db.discoveredItem.findMany({
    where: {
      status: "FETCHED",
      evidenceId: { not: null },
    },
    select: { evidenceId: true },
    take: 100,
  })

  if (fetchedItems.length === 0) return 0

  const evidenceIds = fetchedItems
    .map((i) => i.evidenceId)
    .filter((id): id is string => id !== null)

  // Filter to only evidence without source pointers
  const newEvidence = await db.evidence.findMany({
    where: {
      id: { in: evidenceIds },
      sourcePointers: { none: {} },
    },
    select: { id: true },
    take: 50,
  })

  if (newEvidence.length === 0) return 0

  const runId = `drain-${Date.now()}`
  await extractQueue.addBulk(
    newEvidence.map((e) => ({
      name: "extract",
      data: { evidenceId: e.id, runId },
    }))
  )

  console.log(`[drainer] Queued ${newEvidence.length} extract jobs`)
  state.stats.extractJobsQueued += newEvidence.length

  return newEvidence.length
}

/**
 * Check for unprocessed source pointers and queue compose jobs
 */
async function drainSourcePointers(): Promise<number> {
  // Find pointers not yet composed into rules
  const pointers = await db.sourcePointer.findMany({
    where: {
      rules: { none: {} },
    },
    select: { id: true, domain: true },
    take: 50,
  })

  if (pointers.length === 0) return 0

  // Group by domain
  const byDomain = new Map<string, string[]>()
  for (const p of pointers) {
    const ids = byDomain.get(p.domain) || []
    ids.push(p.id)
    byDomain.set(p.domain, ids)
  }

  const runId = `drain-${Date.now()}`
  let queued = 0

  for (const [domain, pointerIds] of byDomain) {
    await composeQueue.add("compose", { pointerIds, domain, runId })
    queued++
  }

  console.log(`[drainer] Queued ${queued} compose jobs for ${pointers.length} pointers`)
  state.stats.composeJobsQueued += queued

  return queued
}

/**
 * Check for DRAFT rules ready for review
 * BATCH SIZE: Increased from 20 to 100 to leverage parallel processing
 * With concurrency: 5 in reviewer.worker.ts, we can process 5 reviews simultaneously
 * Larger batches mean fewer round trips and faster backlog drainage (issue #176)
 */
async function drainDraftRules(): Promise<number> {
  const drafts = await db.regulatoryRule.findMany({
    where: { status: "DRAFT" },
    select: { id: true },
    take: 100,
  })

  if (drafts.length === 0) return 0

  const runId = `drain-${Date.now()}`
  await reviewQueue.addBulk(
    drafts.map((r) => ({
      name: "review",
      data: { ruleId: r.id, runId },
    }))
  )

  console.log(`[drainer] Queued ${drafts.length} review jobs`)
  state.stats.reviewJobsQueued += drafts.length

  return drafts.length
}

/**
 * Check for open conflicts and queue arbiter jobs
 */
async function drainConflicts(): Promise<number> {
  const conflicts = await db.regulatoryConflict.findMany({
    where: { status: "OPEN" },
    select: { id: true },
    take: 10,
  })

  if (conflicts.length === 0) return 0

  const runId = `drain-${Date.now()}`
  for (const c of conflicts) {
    await arbiterQueue.add("arbiter", { conflictId: c.id, runId })
  }

  console.log(`[drainer] Queued ${conflicts.length} arbiter jobs`)
  state.stats.arbiterJobsQueued += conflicts.length

  return conflicts.length
}

/**
 * Check for APPROVED rules ready for release
 */
async function drainApprovedRules(): Promise<number> {
  const approved = await db.regulatoryRule.findMany({
    where: {
      status: "APPROVED",
      releases: { none: {} },
    },
    select: { id: true },
    take: 20,
  })

  if (approved.length === 0) return 0

  const runId = `drain-${Date.now()}`
  await releaseQueue.add("release", {
    ruleIds: approved.map((r) => r.id),
    runId,
  })

  console.log(`[drainer] Queued release job for ${approved.length} approved rules`)
  state.stats.releaseJobsQueued++

  return approved.length
}

/**
 * Run one drain cycle across all stages
 */
async function runDrainCycle(): Promise<boolean> {
  state.stats.cycleCount++
  let workDone = false

  // Stage 1: Fetch PENDING items → Evidence
  try {
    const fetched = await executeStage("pending-items", drainPendingItems)
    if (fetched > 0) {
      workDone = true
      console.log(`[drainer] Stage 1: Fetched ${fetched} items`)
    }
  } catch (error) {
    console.error("[drainer] Stage 1 error:", error instanceof Error ? error.message : error)
  }

  // Stage 1.5: Queue scanned PDFs for OCR
  try {
    const ocrQueued = await executeStage("pending-ocr", drainPendingOcr)
    if (ocrQueued > 0) {
      workDone = true
      console.log(`[drainer] Stage 1.5: Queued ${ocrQueued} OCR jobs`)
    }
  } catch (error) {
    console.error("[drainer] Stage 1.5 error:", error instanceof Error ? error.message : error)
  }

  // Stage 2: Queue Evidence for extraction
  try {
    const extracted = await executeStage("fetched-evidence", drainFetchedEvidence)
    if (extracted > 0) {
      workDone = true
      console.log(`[drainer] Stage 2: Queued ${extracted} extract jobs`)
    }
  } catch (error) {
    console.error("[drainer] Stage 2 error:", error instanceof Error ? error.message : error)
  }

  // Stage 3: Queue pointers for composition
  try {
    const composed = await executeStage("source-pointers", drainSourcePointers)
    if (composed > 0) {
      workDone = true
      console.log(`[drainer] Stage 3: Queued ${composed} compose jobs`)
    }
  } catch (error) {
    console.error("[drainer] Stage 3 error:", error instanceof Error ? error.message : error)
  }

  // Stage 4: Queue drafts for review
  try {
    const reviewed = await executeStage("draft-rules", drainDraftRules)
    if (reviewed > 0) {
      workDone = true
      console.log(`[drainer] Stage 4: Queued ${reviewed} review jobs`)
    }
  } catch (error) {
    console.error("[drainer] Stage 4 error:", error instanceof Error ? error.message : error)
  }

  // Stage 5: Queue conflicts for arbiter
  try {
    const arbitrated = await executeStage("conflicts", drainConflicts)
    if (arbitrated > 0) {
      workDone = true
      console.log(`[drainer] Stage 5: Queued ${arbitrated} arbiter jobs`)
    }
  } catch (error) {
    console.error("[drainer] Stage 5 error:", error instanceof Error ? error.message : error)
  }

  // Stage 6: Queue approved rules for release
  try {
    const released = await executeStage("approved-rules", drainApprovedRules)
    if (released > 0) {
      workDone = true
      console.log(`[drainer] Stage 6: Queued ${released} release jobs`)
    }
  } catch (error) {
    console.error("[drainer] Stage 6 error:", error instanceof Error ? error.message : error)
  }

  if (workDone) {
    state.lastActivity = new Date()
  }

  // PR #90 fix: Update heartbeat in Redis for stall detection
  // This allows the watchdog to detect if the drainer has stopped making progress
  const totalItemsProcessed =
    state.stats.itemsFetched +
    state.stats.ocrJobsQueued +
    state.stats.extractJobsQueued +
    state.stats.composeJobsQueued +
    state.stats.reviewJobsQueued +
    state.stats.arbiterJobsQueued +
    state.stats.releaseJobsQueued

  await updateDrainerHeartbeat({
    lastActivity: state.lastActivity.toISOString(),
    queueName: workDone ? "active" : "idle",
    itemsProcessed: totalItemsProcessed,
    cycleCount: state.stats.cycleCount,
  }).catch((err) => {
    // Don't fail the cycle if heartbeat update fails
    console.error("[drainer] Failed to update heartbeat:", err instanceof Error ? err.message : err)
  })

  return workDone
}

/**
 * Log current state
 */
function logState(): void {
  console.log(`[drainer] Stats after cycle ${state.stats.cycleCount}:`, {
    itemsFetched: state.stats.itemsFetched,
    ocrJobs: state.stats.ocrJobsQueued,
    extractJobs: state.stats.extractJobsQueued,
    composeJobs: state.stats.composeJobsQueued,
    reviewJobs: state.stats.reviewJobsQueued,
    arbiterJobs: state.stats.arbiterJobsQueued,
    releaseJobs: state.stats.releaseJobsQueued,
    backoffDelay: `${BACKOFF.currentDelay}ms`,
  })
}

/**
 * Main continuous loop
 */
async function startContinuousDraining(): Promise<void> {
  console.log("[drainer] Starting continuous draining loop...")
  console.log("[drainer] This worker will run 24/7 until saturation")
  state.isRunning = true

  while (state.isRunning) {
    const workDone = await runDrainCycle()

    if (workDone) {
      resetBackoff()
      // Log every 10 cycles when active
      if (state.stats.cycleCount % 10 === 0) {
        logState()
      }
    } else {
      increaseBackoff()
      // Log every backoff increase when idle
      console.log(`[drainer] No work found, backing off for ${BACKOFF.currentDelay}ms`)
    }

    // Wait before next cycle
    await new Promise((resolve) => setTimeout(resolve, BACKOFF.currentDelay))
  }
}

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  console.log(`[drainer] Received ${signal}, shutting down...`)
  state.isRunning = false
  logState()
  await closeRedis()
  process.exit(0)
}

process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT", () => shutdown("SIGINT"))

// Start
startContinuousDraining().catch((error) => {
  console.error("[drainer] Fatal error:", error)
  process.exit(1)
})
