// src/lib/regulatory-truth/workers/queues.ts
import { Queue, QueueEvents } from "bullmq"
import { redis } from "./redis"

const PREFIX = process.env.BULLMQ_PREFIX || "fiskai"
const RETENTION_MS = parseInt(process.env.JOB_RETENTION_HOURS || "24") * 60 * 60 * 1000

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 10000, // 10s, 20s, 40s
  },
  removeOnComplete: { age: RETENTION_MS },
  removeOnFail: false, // Keep for inspection
}

// Queue factory
function createQueue(name: string, limiter?: { max: number; duration: number }) {
  return new Queue(name, {
    connection: redis,
    prefix: PREFIX,
    defaultJobOptions,
    ...(limiter && { limiter }),
  })
}

// Pipeline queues
export const sentinelQueue = createQueue("sentinel", { max: 5, duration: 60000 })
export const extractQueue = createQueue("extract", { max: 10, duration: 60000 })
export const ocrQueue = createQueue("ocr", { max: 2, duration: 60000 })
export const composeQueue = createQueue("compose", { max: 5, duration: 60000 })
export const reviewQueue = createQueue("review", { max: 5, duration: 60000 })
export const arbiterQueue = createQueue("arbiter", { max: 3, duration: 60000 })
export const releaseQueue = createQueue("release", { max: 2, duration: 60000 })
export const consolidatorQueue = createQueue("consolidator", { max: 1, duration: 300000 }) // 5 min rate limit

// Content sync queue - processes MDX patching jobs
// Lower rate limit since it involves git operations
export const contentSyncQueue = createQueue("content-sync", { max: 2, duration: 60000 })

// Article Agent queue - processes article generation jobs
// Lower rate limit since each job involves multiple LLM calls
export const articleQueue = createQueue("article", { max: 2, duration: 60000 })

// Backup queue - processes scheduled company data backups
// Rate limited to avoid overwhelming the system during batch operations
export const backupQueue = createQueue("backup", { max: 2, duration: 60000 })

// Control queues
export const scheduledQueue = createQueue("scheduled")
export const deadletterQueue = createQueue("deadletter")

// System status queue (used by human-control-layer)
// Custom job options: 2 attempts (1 initial + 1 retry for transient errors)
export const systemStatusQueue = new Queue("system-status", {
  connection: redis,
  prefix: PREFIX,
  defaultJobOptions: {
    attempts: 2, // Allow 1 retry for transient errors
    removeOnComplete: { age: RETENTION_MS },
    removeOnFail: false, // Keep for inspection
  },
})

// All queues for health checks
export const allQueues = {
  sentinel: sentinelQueue,
  extract: extractQueue,
  ocr: ocrQueue,
  compose: composeQueue,
  review: reviewQueue,
  arbiter: arbiterQueue,
  release: releaseQueue,
  consolidator: consolidatorQueue,
  contentSync: contentSyncQueue,
  article: articleQueue,
  backup: backupQueue,
  scheduled: scheduledQueue,
  deadletter: deadletterQueue,
  "system-status": systemStatusQueue,
}

// Queue events for monitoring
export function createQueueEvents(queueName: string): QueueEvents {
  return new QueueEvents(queueName, { connection: redis, prefix: PREFIX })
}
