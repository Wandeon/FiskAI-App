/**
 * System Status Async Worker
 *
 * Processes system status refresh jobs in the background.
 * Uses BullMQ for job management with:
 * - Concurrency = 1 (only one refresh at a time)
 * - Max 1 retry for transient failures
 * - Lock TTL heartbeat while running
 */

import { Worker, Job, UnrecoverableError } from "bullmq"
import { computeSystemStatusSnapshot } from "./refresh"
import { diffSnapshots } from "./diff"
import {
  getCurrentSnapshot,
  saveSnapshot,
  saveEvents,
  updateRefreshJob,
  releaseRefreshLock,
  getRefreshJob,
  acquireRefreshLock,
} from "./store"
import { sendSystemStatusAlerts } from "./alerting"
import { createWorkerConnection, closeRedis } from "@/lib/regulatory-truth/workers/redis"
import { deadletterQueue } from "@/lib/regulatory-truth/workers/queues"

const PREFIX = process.env.BULLMQ_PREFIX || "fiskai"
const QUEUE_NAME = "system-status"

// ============================================================================
// Job Payload Types
// ============================================================================

export interface RefreshJobPayload {
  jobId: string
  userId: string
  timeoutSeconds: number
  lockKey: string
}

// ============================================================================
// Transient Error Detection
// ============================================================================

/**
 * Determines if an error is transient (retryable).
 * Non-transient errors (validation, configuration) should not be retried.
 */
function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()

  // Network/connection errors are transient
  if (
    message.includes("timeout") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("network") ||
    message.includes("temporarily unavailable") ||
    message.includes("service unavailable") ||
    message.includes("rate limit")
  ) {
    return true
  }

  // Database connection errors are transient
  if (
    message.includes("connection") ||
    message.includes("prisma") ||
    message.includes("database")
  ) {
    return true
  }

  // All other errors are considered non-transient
  return false
}

// ============================================================================
// Job Processor
// ============================================================================

/**
 * Process a single refresh job.
 * This is the core logic extracted for reuse.
 */
export async function processRefreshJob(
  payload: RefreshJobPayload,
  heartbeat?: () => Promise<void>
): Promise<{ snapshotId: string; eventsCount: number }> {
  const { jobId, userId, timeoutSeconds, lockKey } = payload

  try {
    // Update job to RUNNING
    await updateRefreshJob(jobId, {
      status: "RUNNING",
      startedAt: new Date(),
    })

    // Heartbeat after status update
    if (heartbeat) await heartbeat()

    // Get previous snapshot for diff
    const prevSnapshot = await getCurrentSnapshot()

    // Heartbeat before compute (which might take time)
    if (heartbeat) await heartbeat()

    // Compute new snapshot
    const snapshot = await computeSystemStatusSnapshot({
      requestedByUserId: userId,
      timeoutSeconds,
    })

    // Heartbeat after compute
    if (heartbeat) await heartbeat()

    // Calculate diff events
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events = prevSnapshot ? diffSnapshots(prevSnapshot as any, snapshot) : []

    // Save snapshot and events
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma type mismatch
    const savedSnapshot = await saveSnapshot(snapshot as unknown as any)
    if (events.length > 0) {
      await saveEvents(
        events.map((e) => ({
          ...e,
          requestedByUserId: userId,
        }))
      )

      // Send alerts for important events (external monitoring integration)
      const alertableEvents = events.filter(
        (e) => e.severity === "CRITICAL" || e.severity === "ERROR" || e.severity === "WARNING"
      )
      if (alertableEvents.length > 0) {
        try {
          const alertResult = await sendSystemStatusAlerts(alertableEvents)
          console.log(
            `[system-status-worker] Alerts sent: ${alertResult.sent}, skipped: ${alertResult.skipped}, errors: ${alertResult.errors}`
          )
        } catch (alertError) {
          // Don't fail the job if alerting fails
          console.error("[system-status-worker] Failed to send alerts:", alertError)
        }
      }
    }

    // Heartbeat after save
    if (heartbeat) await heartbeat()

    // Update job to SUCCEEDED
    await updateRefreshJob(jobId, {
      status: "SUCCEEDED",
      finishedAt: new Date(),
      snapshotId: savedSnapshot.id,
    })

    console.log(
      `[system-status-worker] Job ${jobId} completed: snapshot=${savedSnapshot.id}, events=${events.length}`
    )

    return {
      snapshotId: savedSnapshot.id,
      eventsCount: events.length,
    }
  } catch (error) {
    console.error(`[system-status-worker] Job ${jobId} failed:`, error)

    // Update job to FAILED
    await updateRefreshJob(jobId, {
      status: "FAILED",
      finishedAt: new Date(),
      error: error instanceof Error ? error.message : String(error),
    })

    // Prevent retries for non-transient errors
    if (!isTransientError(error)) {
      throw new UnrecoverableError(error instanceof Error ? error.message : String(error))
    }
    throw error // Allow retry for transient errors
  } finally {
    // Always release lock
    await releaseRefreshLock(lockKey)
  }
}

// ============================================================================
// BullMQ Worker
// ============================================================================

/**
 * Create a BullMQ worker for system status refresh jobs.
 */
export function createSystemStatusWorker(): Worker<RefreshJobPayload> {
  const connection = createWorkerConnection()

  const worker = new Worker<RefreshJobPayload>(
    QUEUE_NAME,
    async (job: Job<RefreshJobPayload>) => {
      const { jobId, userId, timeoutSeconds, lockKey } = job.data

      console.log(`[system-status-worker] Processing job ${job.id} (refresh: ${jobId})`)

      // Verify the job record exists and is pending/running
      const existingJob = await getRefreshJob(jobId)
      if (!existingJob) {
        throw new Error(`Job record ${jobId} not found`)
      }

      if (existingJob.status !== "PENDING" && existingJob.status !== "RUNNING") {
        console.log(
          `[system-status-worker] Job ${jobId} already in terminal state: ${existingJob.status}`
        )
        return { skipped: true, reason: "already_completed" }
      }

      // Try to acquire lock if not already held
      if (existingJob.status === "PENDING") {
        const lockAcquired = await acquireRefreshLock({
          lockKey,
          lockedUntil: new Date(Date.now() + timeoutSeconds * 1000),
          requestedByUserId: userId,
          jobId,
        })

        if (!lockAcquired) {
          // Another process is handling this
          console.log(`[system-status-worker] Could not acquire lock for job ${jobId}`)
          return { skipped: true, reason: "lock_held" }
        }
      }

      // Process with heartbeat support
      const lockDuration = 120000 // Match worker lockDuration setting
      const result = await processRefreshJob(job.data, async () => {
        // Extend the lock to prevent job from being marked as stalled
        await job.extendLock(job.token!, lockDuration)
      })

      return result
    },
    {
      connection,
      prefix: PREFIX,
      concurrency: 1, // Only one refresh at a time
      lockDuration: 120000, // 2 minute lock
      stalledInterval: 30000, // Check for stalled jobs every 30s
      maxStalledCount: 2,
    }
  )

  // Configure retry behavior
  worker.on("failed", (job, err) => {
    if (!job) return

    const attemptsMade = job.attemptsMade
    const maxAttempts = job.opts.attempts || 2

    console.error(
      `[system-status-worker] Job ${job.id} failed (attempt ${attemptsMade}/${maxAttempts}):`,
      err.message
    )

    // Move to dead letter queue after max attempts
    if (attemptsMade >= maxAttempts) {
      void deadletterQueue
        .add("failed", {
          originalQueue: "system-status",
          jobId: job.id,
          jobName: job.name,
          data: job.data,
          error: err.message,
          failedAt: new Date().toISOString(),
        })
        .then(() => console.log(`[system-status-worker] Job ${job.id} moved to dead letter queue`))
    } else if (isTransientError(err)) {
      console.log(`[system-status-worker] Job ${job.id} will be retried (transient error)`)
    } else {
      console.log(`[system-status-worker] Job ${job.id} will not be retried (non-transient error)`)
    }
  })

  worker.on("completed", (job) => {
    console.log(`[system-status-worker] Job ${job?.id} completed`)
  })

  worker.on("error", (err) => {
    console.error("[system-status-worker] Worker error:", err)
  })

  return worker
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

export function setupGracefulShutdown(worker: Worker): void {
  const shutdown = async (signal: string) => {
    console.log(`\n[system-status-worker] Received ${signal}, shutting down gracefully...`)
    await worker.close()
    await closeRedis()
    console.log("[system-status-worker] Shutdown complete")
    process.exit(0)
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"))
  process.on("SIGINT", () => void shutdown("SIGINT"))
}
