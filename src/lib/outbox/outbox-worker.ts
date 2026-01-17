// src/lib/outbox/outbox-worker.ts
/**
 * Outbox Worker
 *
 * Background processor that polls for pending outbox events and executes
 * their handlers. Integrates with the existing BullMQ infrastructure for
 * proper concurrency and health monitoring.
 *
 * Usage:
 *   // Run standalone
 *   npx tsx src/lib/outbox/outbox-worker.ts
 *
 *   // Or import and start programmatically
 *   import { startOutboxWorker } from "@/lib/outbox/outbox-worker"
 *   startOutboxWorker()
 */

import { Worker, Job } from "bullmq"
import { Queue } from "bullmq"
import { redis, createWorkerConnection } from "@/lib/infra/redis"
import {
  getPendingEvents,
  processEvent,
  resetStuckEvents,
  cleanupCompletedEvents,
  getOutboxStats,
} from "./outbox-service"
import { getEventHandler } from "./handlers"

// Configuration
const POLL_INTERVAL_MS = parseInt(process.env.OUTBOX_POLL_INTERVAL_MS || "5000")
const BATCH_SIZE = parseInt(process.env.OUTBOX_BATCH_SIZE || "10")
const STUCK_TIMEOUT_MINUTES = parseInt(process.env.OUTBOX_STUCK_TIMEOUT_MINUTES || "30")
const CLEANUP_RETENTION_DAYS = parseInt(process.env.OUTBOX_CLEANUP_RETENTION_DAYS || "7")
const PREFIX = process.env.BULLMQ_PREFIX || "fiskai"

// Create outbox queue (used for scheduled polling jobs)
export const outboxQueue = new Queue("outbox", {
  connection: redis,
  prefix: PREFIX,
  defaultJobOptions: {
    attempts: 1, // Polling job itself doesn't retry - events have their own retry logic
    removeOnComplete: { age: 3600000 }, // 1 hour
    removeOnFail: false,
  },
})

// Job data interface
interface OutboxJobData {
  type: "poll" | "cleanup" | "reset-stuck"
}

/**
 * Process a batch of pending outbox events.
 */
async function processPendingEvents(): Promise<number> {
  const events = await getPendingEvents(BATCH_SIZE)

  if (events.length === 0) {
    return 0
  }

  console.log(`[outbox-worker] Processing ${events.length} pending events`)

  let processed = 0
  for (const event of events) {
    try {
      const handler = getEventHandler(event.eventType)

      if (!handler) {
        console.warn(`[outbox-worker] No handler for event type: ${event.eventType}`)
        // Skip unknown event types - they'll stay pending
        continue
      }

      await processEvent(event.id, handler)
      processed++
    } catch (error) {
      // processEvent handles its own error logging
      console.error(`[outbox-worker] Error processing event ${event.id}:`, error)
    }
  }

  return processed
}

/**
 * Run maintenance tasks (reset stuck events, cleanup old events).
 */
async function runMaintenance(): Promise<void> {
  // Reset stuck events
  const resetCount = await resetStuckEvents(STUCK_TIMEOUT_MINUTES)
  if (resetCount > 0) {
    console.log(`[outbox-worker] Reset ${resetCount} stuck events`)
  }

  // Cleanup old completed events
  const cleanupCount = await cleanupCompletedEvents(CLEANUP_RETENTION_DAYS)
  if (cleanupCount > 0) {
    console.log(`[outbox-worker] Cleaned up ${cleanupCount} old completed events`)
  }
}

/**
 * Create and start the outbox worker.
 */
export function startOutboxWorker(): Worker<OutboxJobData> {
  const workerConnection = createWorkerConnection()

  const worker = new Worker<OutboxJobData>(
    "outbox",
    async (job: Job<OutboxJobData>) => {
      const startTime = Date.now()

      switch (job.data.type) {
        case "poll": {
          const processed = await processPendingEvents()
          const duration = Date.now() - startTime
          console.log(`[outbox-worker] Poll completed: ${processed} events in ${duration}ms`)
          return { processed, duration }
        }

        case "cleanup": {
          await runMaintenance()
          const duration = Date.now() - startTime
          console.log(`[outbox-worker] Maintenance completed in ${duration}ms`)
          return { duration }
        }

        case "reset-stuck": {
          const count = await resetStuckEvents(STUCK_TIMEOUT_MINUTES)
          const duration = Date.now() - startTime
          console.log(`[outbox-worker] Reset stuck: ${count} events in ${duration}ms`)
          return { count, duration }
        }

        default:
          throw new Error(`Unknown job type: ${job.data.type}`)
      }
    },
    {
      connection: workerConnection,
      prefix: PREFIX,
      concurrency: 1, // Process one batch at a time
    }
  )

  // Event handlers
  worker.on("completed", (job) => {
    console.log(`[outbox-worker] Job ${job.id} completed`)
  })

  worker.on("failed", (job, err) => {
    console.error(`[outbox-worker] Job ${job?.id} failed:`, err)
  })

  worker.on("error", (err) => {
    console.error(`[outbox-worker] Worker error:`, err)
  })

  console.log(
    `[outbox-worker] Started with poll interval ${POLL_INTERVAL_MS}ms, batch size ${BATCH_SIZE}`
  )

  return worker
}

/**
 * Schedule recurring poll jobs.
 *
 * This sets up a repeatable job that polls for pending events.
 * Should be called once at startup.
 */
export async function schedulePolling(): Promise<void> {
  // Remove existing repeatable jobs to avoid duplicates
  const repeatableJobs = await outboxQueue.getRepeatableJobs()
  for (const job of repeatableJobs) {
    await outboxQueue.removeRepeatableByKey(job.key)
  }

  // Schedule polling job
  await outboxQueue.add(
    "poll",
    { type: "poll" },
    {
      repeat: {
        every: POLL_INTERVAL_MS,
      },
    }
  )

  // Schedule daily maintenance (cleanup + reset stuck)
  await outboxQueue.add(
    "maintenance",
    { type: "cleanup" },
    {
      repeat: {
        pattern: "0 3 * * *", // 3 AM daily
      },
    }
  )

  console.log(
    `[outbox-worker] Scheduled polling every ${POLL_INTERVAL_MS}ms and daily maintenance at 3 AM`
  )
}

/**
 * Get health status of the outbox system.
 */
export async function getOutboxHealth() {
  const stats = await getOutboxStats()
  const queueStats = await outboxQueue.getJobCounts()

  return {
    outbox: stats,
    queue: {
      waiting: queueStats.waiting,
      active: queueStats.active,
      completed: queueStats.completed,
      failed: queueStats.failed,
    },
    config: {
      pollIntervalMs: POLL_INTERVAL_MS,
      batchSize: BATCH_SIZE,
      stuckTimeoutMinutes: STUCK_TIMEOUT_MINUTES,
      cleanupRetentionDays: CLEANUP_RETENTION_DAYS,
    },
  }
}

// Run as standalone script
if (require.main === module) {
  console.log("[outbox-worker] Starting standalone worker...")

  Promise.all([schedulePolling(), Promise.resolve(startOutboxWorker())])
    .then(() => {
      console.log("[outbox-worker] Worker running. Press Ctrl+C to stop.")
    })
    .catch((error) => {
      console.error("[outbox-worker] Failed to start:", error)
      process.exit(1)
    })

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("[outbox-worker] Shutting down...")
    process.exit(0)
  })

  process.on("SIGTERM", () => {
    console.log("[outbox-worker] Shutting down...")
    process.exit(0)
  })
}
