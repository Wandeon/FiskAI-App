// src/lib/regulatory-truth/workers/base.ts
import { Worker, Job } from "bullmq"
import { createWorkerConnection, closeRedis } from "./redis"
import { deadletterQueue, DLQ_THRESHOLD, type DeadLetterJobData } from "./queues"

const PREFIX = process.env.BULLMQ_PREFIX || "fiskai"

export interface WorkerOptions {
  name: string
  concurrency?: number
  lockDuration?: number
  stalledInterval?: number
}

export interface JobResult {
  success: boolean
  data?: unknown
  error?: string
  duration: number
}

export type JobProcessor<T> = (job: Job<T>) => Promise<JobResult>

/**
 * Moves a permanently failed job to the Dead Letter Queue.
 * This removes the job from the main queue to prevent memory accumulation.
 */
async function moveToDeadLetterQueue<T>(
  job: Job<T>,
  error: Error,
  queueName: string,
  workerName: string
): Promise<void> {
  const dlqData: DeadLetterJobData = {
    originalQueue: queueName,
    originalJobId: job.id,
    originalJobName: job.name,
    originalJobData: job.data,
    error: error.message,
    stackTrace: error.stack,
    attemptsMade: job.attemptsMade,
    failedAt: new Date().toISOString(),
    firstFailedAt: job.processedOn ? new Date(job.processedOn).toISOString() : undefined,
  }

  // Add to DLQ with metadata for analysis
  await deadletterQueue.add("dead-letter", dlqData, {
    jobId: `dlq-${queueName}-${job.id}-${Date.now()}`,
  })

  // Remove from main queue to prevent memory pressure
  try {
    await job.remove()
    console.log(`[${workerName}] Job ${job.id} moved to DLQ and removed from ${queueName}`)
  } catch (removeError) {
    // Job may have already been removed or cleaned up
    console.warn(`[${workerName}] Could not remove job ${job.id} from ${queueName}:`, removeError)
  }

  // Check DLQ depth and alert if threshold exceeded
  await checkDLQThreshold(workerName)
}

/**
 * Checks if DLQ depth exceeds threshold and logs an alert.
 * In production, this could integrate with monitoring systems (e.g., Slack, PagerDuty).
 */
async function checkDLQThreshold(workerName: string): Promise<void> {
  try {
    const dlqCounts = await deadletterQueue.getJobCounts("waiting", "active", "delayed")
    const totalDLQJobs = dlqCounts.waiting + dlqCounts.active + dlqCounts.delayed

    if (totalDLQJobs >= DLQ_THRESHOLD) {
      console.error(
        `[${workerName}] DLQ ALERT: Dead letter queue depth (${totalDLQJobs}) ` +
          `exceeds threshold (${DLQ_THRESHOLD}). Investigation required!`
      )
      // Future: Integrate with alerting system (Slack, PagerDuty, etc.)
    }
  } catch (error) {
    console.warn(`[${workerName}] Could not check DLQ depth:`, error)
  }
}

export function createWorker<T>(
  queueName: string,
  processor: JobProcessor<T>,
  options: WorkerOptions
): Worker<T> {
  const connection = createWorkerConnection()
  const concurrency = options.concurrency ?? parseInt(process.env.WORKER_CONCURRENCY || "2")

  const worker = new Worker<T>(
    queueName,
    async (job) => {
      const start = Date.now()
      console.log(`[${options.name}] Processing job ${job.id}: ${job.name}`)

      try {
        const result = await processor(job)
        console.log(`[${options.name}] Job ${job.id} completed in ${result.duration}ms`)
        return result
      } catch (error) {
        console.error(`[${options.name}] Job ${job.id} failed:`, error)
        throw error
      }
    },
    {
      connection,
      prefix: PREFIX,
      concurrency,
      lockDuration: options.lockDuration ?? 60000,
      stalledInterval: options.stalledInterval ?? 30000,
      maxStalledCount: 2,
    }
  )

  // Handle permanently failed jobs (all retries exhausted)
  worker.on("failed", async (job, err) => {
    if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
      await moveToDeadLetterQueue(job, err, queueName, options.name)
    }
  })

  worker.on("error", (err) => {
    console.error(`[${options.name}] Worker error:`, err)
  })

  return worker
}

// Graceful shutdown helper
export function setupGracefulShutdown(workers: Worker[]): void {
  const shutdown = async (signal: string) => {
    console.log(`\n[workers] Received ${signal}, shutting down gracefully...`)

    await Promise.all(
      workers.map(async (w) => {
        console.log(`[workers] Closing worker: ${w.name}`)
        await w.close()
      })
    )

    await closeRedis()
    console.log("[workers] Shutdown complete")
    process.exit(0)
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"))
  process.on("SIGINT", () => shutdown("SIGINT"))
}
