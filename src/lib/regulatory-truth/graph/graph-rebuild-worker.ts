// src/lib/regulatory-truth/graph/graph-rebuild-worker.ts
/**
 * Graph Rebuild Worker
 *
 * Processes queued graph rebuild jobs with exponential backoff.
 * This ensures STALE rules eventually become CURRENT even after transient failures.
 */

import { db } from "@/lib/db"
import { rebuildEdgesForRule } from "./edge-builder"
import { raiseAlert } from "../watchdog/alerting"
import { enqueueGraphRebuildJob } from "@/lib/infra/queues"

export interface GraphRebuildJobData {
  ruleId: string
  attempt: number
}

/**
 * Process a single graph rebuild job.
 * Called by the BullMQ worker when a job is dequeued.
 *
 * @returns true if rebuild succeeded (graphStatus = CURRENT)
 * @returns false if rebuild failed (graphStatus = STALE, retry enqueued)
 */
export async function processGraphRebuildJob(data: GraphRebuildJobData): Promise<boolean> {
  const { ruleId, attempt } = data

  console.log(
    `[graph-rebuild-worker] Processing rebuild for rule ${ruleId}, attempt ${attempt + 1}`
  )

  // Verify rule exists and is in PENDING/STALE state
  const rule = await db.regulatoryRule.findUnique({
    where: { id: ruleId },
    select: { id: true, status: true, graphStatus: true, conceptSlug: true },
  })

  if (!rule) {
    console.warn(`[graph-rebuild-worker] Rule ${ruleId} not found, skipping`)
    return false
  }

  // Only process PUBLISHED rules with PENDING/STALE graph status
  if (rule.status !== "PUBLISHED") {
    console.log(`[graph-rebuild-worker] Rule ${ruleId} is ${rule.status}, not PUBLISHED - skipping`)
    return false
  }

  if (rule.graphStatus === "CURRENT") {
    console.log(`[graph-rebuild-worker] Rule ${ruleId} already CURRENT - skipping`)
    return true
  }

  try {
    // Rebuild edges
    const edgeResult = await rebuildEdgesForRule(ruleId)

    console.log(
      `[graph-rebuild-worker] Rebuilt edges for ${ruleId}: ` +
        `SUPERSEDES=${edgeResult.supersedes.created}, ` +
        `OVERRIDES=${edgeResult.overrides.created}, ` +
        `DEPENDS_ON=${edgeResult.dependsOn.created}`
    )

    // Update graphStatus to CURRENT on success
    await db.regulatoryRule.update({
      where: { id: ruleId },
      data: { graphStatus: "CURRENT" },
    })

    console.log(`[graph-rebuild-worker] Rule ${ruleId} graphStatus set to CURRENT`)

    // Log any edge warnings (not fatal)
    const allEdgeErrors = [
      ...edgeResult.supersedes.errors,
      ...edgeResult.overrides.errors,
      ...edgeResult.dependsOn.errors,
    ]
    if (allEdgeErrors.length > 0) {
      console.warn(`[graph-rebuild-worker] Edge warnings for ${ruleId}:`, allEdgeErrors)
    }

    return true
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    console.error(`[graph-rebuild-worker] Rebuild failed for ${ruleId}:`, error)

    // Ensure graphStatus is STALE
    await db.regulatoryRule.update({
      where: { id: ruleId },
      data: { graphStatus: "STALE" },
    })

    // Alert (will dedupe based on entityId)
    await raiseAlert({
      severity: "WARNING",
      type: "PIPELINE_FAILURE",
      entityId: ruleId,
      message: `[Graph] Rebuild retry ${attempt + 1} failed for rule ${ruleId}: ${errorMessage}`,
      details: {
        ruleId,
        attempt: attempt + 1,
        errorName: error instanceof Error ? error.name : "Unknown",
        errorMessage,
        stack: errorStack,
        phase: "graph-rebuild-worker",
      },
    })

    // Enqueue next retry (will return undefined if max retries exceeded)
    const nextJobId = await enqueueGraphRebuildJob(ruleId, attempt + 1)
    if (!nextJobId) {
      // Max retries exceeded - raise critical alert
      await raiseAlert({
        severity: "CRITICAL",
        type: "PIPELINE_FAILURE",
        entityId: ruleId,
        message: `[Graph] Max retries exceeded for rule ${ruleId} - manual intervention required`,
        details: {
          ruleId,
          totalAttempts: attempt + 1,
          lastError: errorMessage,
          phase: "graph-rebuild-worker-exhausted",
        },
      })
    }

    return false
  }
}

/**
 * Sweep for stuck PENDING/STALE rules and enqueue them for rebuild.
 * Should be called periodically (e.g., hourly) by a cron job or orchestrator.
 *
 * @param maxAge - Only enqueue rules older than this (ms). Default: 1 hour
 * @returns Number of rules enqueued
 */
export async function sweepStuckRules(maxAge: number = 60 * 60 * 1000): Promise<number> {
  const cutoff = new Date(Date.now() - maxAge)

  const stuckRules = await db.regulatoryRule.findMany({
    where: {
      status: "PUBLISHED",
      graphStatus: { in: ["PENDING", "STALE"] },
      updatedAt: { lt: cutoff },
    },
    select: { id: true, graphStatus: true, conceptSlug: true, updatedAt: true },
    take: 100, // Process max 100 per sweep
    orderBy: { updatedAt: "asc" }, // Oldest first
  })

  console.log(`[graph-rebuild-worker] Found ${stuckRules.length} stuck rules to sweep`)

  let enqueued = 0
  for (const rule of stuckRules) {
    const jobId = await enqueueGraphRebuildJob(rule.id, 0)
    if (jobId) {
      enqueued++
      console.log(
        `[graph-rebuild-worker] Enqueued stuck rule ${rule.id} (${rule.conceptSlug}), ` +
          `status: ${rule.graphStatus}, last updated: ${rule.updatedAt.toISOString()}`
      )
    }
  }

  return enqueued
}
