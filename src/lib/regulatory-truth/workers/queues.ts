// src/lib/regulatory-truth/workers/queues.ts
import { Queue, QueueEvents, JobsOptions } from "bullmq"
import { redis } from "./redis"

const PREFIX = process.env.BULLMQ_PREFIX || "fiskai"
const RETENTION_MS = parseInt(process.env.JOB_RETENTION_HOURS || "24") * 60 * 60 * 1000

// DLQ configuration
export const DLQ_THRESHOLD = parseInt(process.env.DLQ_ALERT_THRESHOLD || "10")
export const DLQ_RETENTION_DAYS = parseInt(process.env.DLQ_RETENTION_DAYS || "30")
const DLQ_RETENTION_MS = DLQ_RETENTION_DAYS * 24 * 60 * 60 * 1000

const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 10000, // 10s, 20s, 40s
  },
  removeOnComplete: { age: RETENTION_MS },
  removeOnFail: false, // Keep temporarily for DLQ processing
}

// DLQ job options - longer retention for analysis
const dlqJobOptions: JobsOptions = {
  attempts: 1, // DLQ jobs don't retry automatically
  removeOnComplete: { age: DLQ_RETENTION_MS },
  removeOnFail: false, // Keep failed DLQ jobs for inspection
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

// Embedding queue - generates embeddings for published rules
// Higher rate limit since embeddings are lightweight
export const embeddingQueue = createQueue("embedding", { max: 10, duration: 60000 })

// Evidence embedding queue - generates embeddings for Evidence records
// Uses dedicated queue with retry logic for semantic duplicate detection (GitHub issue #828)
export const evidenceEmbeddingQueue = createQueue("evidence-embedding", {
  max: 5,
  duration: 60000,
})

// Control queues
export const scheduledQueue = createQueue("scheduled")

// Dead Letter Queue with custom retention for permanently failed jobs
export const deadletterQueue = new Queue("deadletter", {
  connection: redis,
  prefix: PREFIX,
  defaultJobOptions: dlqJobOptions,
})

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
  embedding: embeddingQueue,
  "evidence-embedding": evidenceEmbeddingQueue,
  scheduled: scheduledQueue,
  deadletter: deadletterQueue,
  "system-status": systemStatusQueue,
}

// Queue events for monitoring
export function createQueueEvents(queueName: string): QueueEvents {
  return new QueueEvents(queueName, { connection: redis, prefix: PREFIX })
}

// DLQ job data structure
export interface DeadLetterJobData {
  originalQueue: string
  originalJobId: string | undefined
  originalJobName: string
  originalJobData: unknown
  error: string
  stackTrace?: string
  attemptsMade: number
  failedAt: string
  firstFailedAt?: string
}
