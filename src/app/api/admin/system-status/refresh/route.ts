/**
 * POST /api/admin/system-status/refresh
 *
 * Triggers a system status refresh. Uses hybrid sync/async approach:
 * - Attempts sync refresh with 15s timeout
 * - If sync succeeds, returns 200 with snapshot
 * - If slow/timeout, enqueues async job and returns 202 with job ID
 */

import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-utils"
import { computeSystemStatusSnapshot } from "@/lib/system-status/refresh"
import { diffSnapshots } from "@/lib/system-status/diff"
import {
  getCurrentSnapshot,
  saveSnapshot,
  saveEvents,
  createRefreshJob,
  updateRefreshJob,
  acquireRefreshLock,
  releaseRefreshLock,
  getRunningJobByDedupeKey,
} from "@/lib/system-status/store"

// Constants
const SYNC_TIMEOUT_MS = 15_000 // 15 seconds
const SYNC_TIMEOUT_SECONDS = 15
const ASYNC_TIMEOUT_SECONDS = 120
const DEDUPE_KEY = "system-status-refresh"

export async function POST(request: NextRequest) {
  try {
    // Check admin auth
    const user = await getCurrentUser()
    if (!user || user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse request body for mode preference
    let mode: "sync" | "async" = "sync"
    try {
      const body = await request.json()
      if (body.mode === "async") {
        mode = "async"
      }
    } catch {
      // No body or invalid JSON, use default mode
    }

    const timeoutSeconds = mode === "async" ? ASYNC_TIMEOUT_SECONDS : SYNC_TIMEOUT_SECONDS

    // Check for already running job (dedupe)
    const existingJob = await getRunningJobByDedupeKey(DEDUPE_KEY)
    if (existingJob) {
      return NextResponse.json(
        {
          status: "already_running",
          jobId: existingJob.id,
          message: "A refresh is already in progress",
        },
        { status: 202 }
      )
    }

    // Create job record
    const job = await createRefreshJob({
      mode: mode === "async" ? "ASYNC" : "SYNC",
      dedupeKey: DEDUPE_KEY,
      lockKey: DEDUPE_KEY,
      requestedByUserId: user.id,
      timeoutSeconds,
    })

    // Acquire lock
    const lockAcquired = await acquireRefreshLock({
      lockKey: DEDUPE_KEY,
      lockedUntil: new Date(Date.now() + timeoutSeconds * 1000),
      requestedByUserId: user.id,
      jobId: job.id,
    })

    if (!lockAcquired) {
      await updateRefreshJob(job.id, {
        status: "FAILED",
        error: "Could not acquire lock",
        finishedAt: new Date(),
      })
      return NextResponse.json({ error: "Could not acquire refresh lock" }, { status: 409 })
    }

    // If async mode requested, return immediately with job ID
    if (mode === "async") {
      // In a real implementation, we would enqueue to a background worker here
      // For now, we'll start the job but not wait for it
      // Task 6 will implement the actual worker
      processRefreshAsync(job.id, user.id, timeoutSeconds, DEDUPE_KEY).catch((error) => {
        console.error("[system-status-refresh] Async job error:", error)
      })

      return NextResponse.json(
        {
          status: "accepted",
          jobId: job.id,
          message: "Refresh job queued",
        },
        { status: 202 }
      )
    }

    // Sync mode: attempt with timeout
    try {
      await updateRefreshJob(job.id, {
        status: "RUNNING",
        startedAt: new Date(),
      })

      // Create a promise that rejects after timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("SYNC_TIMEOUT")), SYNC_TIMEOUT_MS)
      })

      // Race between the actual work and the timeout
      const snapshot = await Promise.race([
        computeSystemStatusSnapshot({
          requestedByUserId: user.id,
          timeoutSeconds,
        }),
        timeoutPromise,
      ])

      // Get previous snapshot for diff
      const prevSnapshot = await getCurrentSnapshot()

      // Generate events from diff
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events = prevSnapshot ? diffSnapshots(prevSnapshot as any, snapshot) : []

      // Save snapshot and events
      const savedSnapshot = await saveSnapshot(snapshot as unknown as any)
      if (events.length > 0) {
        await saveEvents(
          events.map((e) => ({
            ...e,
            requestedByUserId: user.id,
          }))
        )
      }

      // Update job as succeeded
      await updateRefreshJob(job.id, {
        status: "SUCCEEDED",
        finishedAt: new Date(),
        snapshotId: savedSnapshot.id,
      })

      // Release lock
      await releaseRefreshLock(DEDUPE_KEY)

      return NextResponse.json({
        status: "success",
        jobId: job.id,
        snapshot: {
          id: savedSnapshot.id,
          headlineStatus: savedSnapshot.headlineStatus,
          criticalCount: savedSnapshot.criticalCount,
          highCount: savedSnapshot.highCount,
          mediumCount: savedSnapshot.mediumCount,
          lowCount: savedSnapshot.lowCount,
        },
        eventsGenerated: events.length,
      })
    } catch (error) {
      // Check if this was a timeout
      if (error instanceof Error && error.message === "SYNC_TIMEOUT") {
        // Switch to async mode
        // In real implementation, we'd enqueue to a background worker
        processRefreshAsync(job.id, user.id, ASYNC_TIMEOUT_SECONDS, DEDUPE_KEY).catch((err) => {
          console.error("[system-status-refresh] Async fallback error:", err)
        })

        return NextResponse.json(
          {
            status: "accepted",
            jobId: job.id,
            message: "Sync timeout, switched to async processing",
          },
          { status: 202 }
        )
      }

      // Other error - fail the job
      await updateRefreshJob(job.id, {
        status: "FAILED",
        finishedAt: new Date(),
        error: error instanceof Error ? error.message : String(error),
      })

      await releaseRefreshLock(DEDUPE_KEY)

      return NextResponse.json(
        {
          error: "Refresh failed",
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("[system-status-refresh] Error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

/**
 * Process refresh asynchronously.
 * In a real implementation, this would be handled by a background worker (Task 6).
 * For now, this runs in the same process but doesn't block the response.
 */
async function processRefreshAsync(
  jobId: string,
  userId: string,
  timeoutSeconds: number,
  lockKey: string
): Promise<void> {
  try {
    await updateRefreshJob(jobId, {
      status: "RUNNING",
      startedAt: new Date(),
    })

    const snapshot = await computeSystemStatusSnapshot({
      requestedByUserId: userId,
      timeoutSeconds,
    })

    const prevSnapshot = await getCurrentSnapshot()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events = prevSnapshot ? diffSnapshots(prevSnapshot as any, snapshot) : []

    const savedSnapshot = await saveSnapshot(snapshot as unknown as any)
    if (events.length > 0) {
      await saveEvents(
        events.map((e) => ({
          ...e,
          requestedByUserId: userId,
        }))
      )
    }

    await updateRefreshJob(jobId, {
      status: "SUCCEEDED",
      finishedAt: new Date(),
      snapshotId: savedSnapshot.id,
    })
  } catch (error) {
    console.error("[system-status-refresh] Async processing error:", error)
    await updateRefreshJob(jobId, {
      status: "FAILED",
      finishedAt: new Date(),
      error: error instanceof Error ? error.message : String(error),
    })
  } finally {
    // Always release lock, even if saveSnapshot, saveEvents, or updateRefreshJob fail
    await releaseRefreshLock(lockKey)
  }
}
