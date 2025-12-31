/**
 * Pipeline Coordinator
 *
 * Manages cron job dependencies to prevent race conditions between stages.
 * Each stage checks if the previous stage completed before proceeding.
 *
 * Pipeline stages:
 * 1. fetch-classify (CRON 1 at 23:00) - No dependencies
 * 2. review (CRON 2 at 23:30) - Depends on fetch-classify
 * 3. publish (CRON 3 at 00:00) - Depends on review
 */

import { drizzleDb } from "@/lib/db/drizzle"
import { newsPipelineRuns } from "@/lib/db/schema"
import { eq, and, gte, lt } from "drizzle-orm"

export type PipelineStage = "fetch-classify" | "review" | "publish"
export type PipelineStatus = "running" | "completed" | "failed"

const STAGE_DEPENDENCIES: Record<PipelineStage, PipelineStage | null> = {
  "fetch-classify": null,
  review: "fetch-classify",
  publish: "review",
}

// Maximum wait time for dependent stage (in ms) - 15 minutes
const MAX_WAIT_TIME_MS = 15 * 60 * 1000

// Poll interval when waiting for dependent stage (in ms) - 30 seconds
const POLL_INTERVAL_MS = 30 * 1000

/**
 * Get the start of the pipeline run date (today at 00:00)
 * Note: For the publish stage running at 00:00, we need the previous day's date
 */
function getPipelineRunDate(stage: PipelineStage): Date {
  const now = new Date()
  const runDate = new Date(now)

  // For publish stage running at 00:00, use previous day's date
  // since fetch-classify and review ran on the previous calendar day
  if (stage === "publish" && now.getHours() < 12) {
    runDate.setDate(runDate.getDate() - 1)
  }

  runDate.setHours(0, 0, 0, 0)
  return runDate
}

/**
 * Check if a previous stage is currently running
 */
export async function isStageRunning(stage: PipelineStage, runDate: Date): Promise<boolean> {
  const startOfDay = new Date(runDate)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(runDate)
  endOfDay.setHours(23, 59, 59, 999)

  const runs = await drizzleDb
    .select()
    .from(newsPipelineRuns)
    .where(
      and(
        eq(newsPipelineRuns.stage, stage),
        eq(newsPipelineRuns.status, "running"),
        gte(newsPipelineRuns.runDate, startOfDay),
        lt(newsPipelineRuns.runDate, endOfDay)
      )
    )
    .limit(1)

  return runs.length > 0
}

/**
 * Check if a stage completed successfully for the given run date
 */
export async function didStageComplete(stage: PipelineStage, runDate: Date): Promise<boolean> {
  const startOfDay = new Date(runDate)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(runDate)
  endOfDay.setHours(23, 59, 59, 999)

  const runs = await drizzleDb
    .select()
    .from(newsPipelineRuns)
    .where(
      and(
        eq(newsPipelineRuns.stage, stage),
        eq(newsPipelineRuns.status, "completed"),
        gte(newsPipelineRuns.runDate, startOfDay),
        lt(newsPipelineRuns.runDate, endOfDay)
      )
    )
    .limit(1)

  return runs.length > 0
}

/**
 * Wait for a dependent stage to complete, with timeout
 */
async function waitForStage(
  stage: PipelineStage,
  runDate: Date,
  maxWaitMs: number = MAX_WAIT_TIME_MS
): Promise<{ ready: boolean; reason?: string }> {
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitMs) {
    // Check if the stage completed
    if (await didStageComplete(stage, runDate)) {
      return { ready: true }
    }

    // Check if the stage is still running
    if (await isStageRunning(stage, runDate)) {
      console.log(
        `[Pipeline] Waiting for ${stage} to complete... (${Math.round((Date.now() - startTime) / 1000)}s elapsed)`
      )
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
      continue
    }

    // Stage is not running and not completed - it may not have started yet
    // or it failed. Wait a bit and check again.
    console.log(
      `[Pipeline] Stage ${stage} not found, waiting... (${Math.round((Date.now() - startTime) / 1000)}s elapsed)`
    )
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }

  return {
    ready: false,
    reason: `Timeout waiting for ${stage} to complete after ${maxWaitMs / 1000}s`,
  }
}

export interface PipelineCheckResult {
  canProceed: boolean
  reason?: string
  runId?: string
}

/**
 * Check if a stage can proceed based on its dependencies
 * Also marks the stage as "running" if it can proceed
 */
export async function checkAndStartStage(stage: PipelineStage): Promise<PipelineCheckResult> {
  const runDate = getPipelineRunDate(stage)
  const now = new Date()

  console.log(
    `[Pipeline] Checking if ${stage} can start for run date ${runDate.toISOString().split("T")[0]}`
  )

  // Check if this stage is already running for today
  if (await isStageRunning(stage, runDate)) {
    return {
      canProceed: false,
      reason: `Stage ${stage} is already running for ${runDate.toISOString().split("T")[0]}`,
    }
  }

  // Check if this stage already completed for today
  if (await didStageComplete(stage, runDate)) {
    return {
      canProceed: false,
      reason: `Stage ${stage} already completed for ${runDate.toISOString().split("T")[0]}`,
    }
  }

  // Check dependency
  const dependsOn = STAGE_DEPENDENCIES[stage]
  if (dependsOn) {
    console.log(`[Pipeline] Stage ${stage} depends on ${dependsOn}`)

    // First check if it's already complete
    if (!(await didStageComplete(dependsOn, runDate))) {
      // If not complete, wait for it
      const waitResult = await waitForStage(dependsOn, runDate)
      if (!waitResult.ready) {
        return {
          canProceed: false,
          reason: waitResult.reason,
        }
      }
    }
  }

  // Mark this stage as running
  const [run] = await drizzleDb
    .insert(newsPipelineRuns)
    .values({
      runDate,
      stage,
      status: "running",
      startedAt: now,
      summary: {},
      errors: [],
    })
    .returning()

  console.log(`[Pipeline] Stage ${stage} started with run ID ${run.id}`)

  return {
    canProceed: true,
    runId: run.id,
  }
}

/**
 * Mark a stage as completed
 */
export async function completeStage(
  runId: string,
  summary: Record<string, unknown> = {},
  errors: string[] = []
): Promise<void> {
  await drizzleDb
    .update(newsPipelineRuns)
    .set({
      status: errors.length > 0 && summary === undefined ? "failed" : "completed",
      completedAt: new Date(),
      summary,
      errors,
    })
    .where(eq(newsPipelineRuns.id, runId))

  console.log(`[Pipeline] Stage run ${runId} completed`)
}

/**
 * Mark a stage as failed
 */
export async function failStage(runId: string, errors: string[] = []): Promise<void> {
  await drizzleDb
    .update(newsPipelineRuns)
    .set({
      status: "failed",
      completedAt: new Date(),
      errors,
    })
    .where(eq(newsPipelineRuns.id, runId))

  console.log(`[Pipeline] Stage run ${runId} failed`)
}

/**
 * Get pipeline status for a given date
 */
export async function getPipelineStatus(
  runDate: Date
): Promise<
  { stage: PipelineStage; status: PipelineStatus; startedAt: Date; completedAt: Date | null }[]
> {
  const startOfDay = new Date(runDate)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(runDate)
  endOfDay.setHours(23, 59, 59, 999)

  const runs = await drizzleDb
    .select()
    .from(newsPipelineRuns)
    .where(and(gte(newsPipelineRuns.runDate, startOfDay), lt(newsPipelineRuns.runDate, endOfDay)))

  return runs.map((run) => ({
    stage: run.stage as PipelineStage,
    status: run.status as PipelineStatus,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
  }))
}
