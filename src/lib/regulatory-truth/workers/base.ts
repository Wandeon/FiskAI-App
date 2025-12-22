// src/lib/regulatory-truth/workers/base.ts
import { Worker, Job } from "bullmq"
import { createWorkerConnection, closeRedis } from "./redis"
import { deadletterQueue } from "./queues"

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

  // Error handling
  worker.on("failed", async (job, err) => {
    if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
      // Move to dead letter queue
      await deadletterQueue.add("failed", {
        originalQueue: queueName,
        jobId: job.id,
        jobName: job.name,
        jobData: job.data,
        error: err.message,
        failedAt: new Date().toISOString(),
      })
      console.log(`[${options.name}] Job ${job.id} moved to dead-letter queue`)
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
