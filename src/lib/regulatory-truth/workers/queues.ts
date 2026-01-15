// src/lib/regulatory-truth/workers/queues.ts
import { Queue, QueueEvents, JobsOptions } from "bullmq"
import { getBullMqOptions, BULLMQ_PREFIX } from "./redis"

// DLQ configuration
export const DLQ_THRESHOLD = parseInt(process.env.DLQ_ALERT_THRESHOLD || "10")
export const DLQ_RETENTION_DAYS = parseInt(process.env.DLQ_RETENTION_DAYS || "30")

const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 10000, // 10s, 20s, 40s
  },
  // Keep last 1000 completed jobs (count-based prevents unbounded growth)
  removeOnComplete: { count: 1000 },
  // Keep last 100 failed jobs for DLQ processing (was: keep forever = OOM)
  removeOnFail: { count: 100 },
}

// DLQ job options - keep more for analysis but still bounded
const dlqJobOptions: JobsOptions = {
  attempts: 1, // DLQ jobs don't retry automatically
  removeOnComplete: { count: 5000 }, // Keep more DLQ history
  removeOnFail: { count: 500 }, // Keep failed DLQ jobs for inspection (bounded)
}

// Queue factory
function createQueue(name: string, limiter?: { max: number; duration: number }) {
  const opts = getBullMqOptions()
  return new Queue(name, {
    ...opts,
    defaultJobOptions,
    ...(limiter && { limiter }),
  })
}

// Pipeline queues
export const sentinelQueue = createQueue("sentinel", { max: 5, duration: 60000 })

// Pre-LLM scouting and routing (cheap-first strategy)
// Scout: deterministic quality assessment, high throughput
export const scoutQueue = createQueue("scout", { max: 20, duration: 60000 })
// Router: budget-aware routing decisions, no LLM calls
export const routerQueue = createQueue("router", { max: 20, duration: 60000 })

export const extractQueue = createQueue("extract", { max: 10, duration: 60000 })
export const ocrQueue = createQueue("ocr", { max: 2, duration: 60000 })
export const composeQueue = createQueue("compose", { max: 5, duration: 60000 })
// PHASE-D: Apply stage handles persistence (SourcePointer + RegulatoryRule creation)
// Separates "proposal generation" (compose) from "truth persistence" (apply)
export const applyQueue = createQueue("apply", { max: 5, duration: 60000 })
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

// Regression detection queue - daily snapshots of PUBLISHED rules
// Task 2.2: RTL Autonomy - Automated Regression Testing
export const regressionDetectorQueue = createQueue("regression-detector", {
  max: 1,
  duration: 86400000, // Once per day
})

// Selector adaptation queue - LLM-based selector suggestions when format drift detected
// Task 3.2: RTL Autonomy - LLM-Based Selector Adaptation
// Low rate limit since each job involves LLM calls and human review
export const selectorAdaptationQueue = createQueue("selector-adaptation", {
  max: 1,
  duration: 300000, // 5 min rate limit - don't overwhelm LLM
})

// Revalidation queue - scheduled re-validation of published rules
// Task 4.2: RTL Autonomy - Continuous Re-Validation
// Runs validation suite on published rules based on risk tier schedule:
// - T0: Weekly, T1: Bi-weekly, T2: Monthly, T3: Quarterly
// Low rate limit since it runs validation suite on multiple rules
export const revalidationQueue = createQueue("revalidation", {
  max: 1,
  duration: 3600000, // 1 hour rate limit - allow time for full validation
})

// Control queues
export const scheduledQueue = createQueue("scheduled")

// Dead Letter Queue with custom retention for permanently failed jobs
export const deadletterQueue = new Queue("deadletter", {
  ...getBullMqOptions(),
  defaultJobOptions: dlqJobOptions,
})

// System status queue (used by human-control-layer)
// Custom job options: 2 attempts (1 initial + 1 retry for transient errors)
export const systemStatusQueue = new Queue("system-status", {
  ...getBullMqOptions(),
  defaultJobOptions: {
    attempts: 2, // Allow 1 retry for transient errors
    removeOnComplete: { count: 500 }, // Keep recent status checks
    removeOnFail: { count: 50 }, // Keep failures for debugging (bounded)
  },
})

// All queues for health checks
export const allQueues = {
  sentinel: sentinelQueue,
  scout: scoutQueue,
  router: routerQueue,
  extract: extractQueue,
  ocr: ocrQueue,
  compose: composeQueue,
  apply: applyQueue,
  review: reviewQueue,
  arbiter: arbiterQueue,
  release: releaseQueue,
  consolidator: consolidatorQueue,
  contentSync: contentSyncQueue,
  article: articleQueue,
  backup: backupQueue,
  embedding: embeddingQueue,
  "evidence-embedding": evidenceEmbeddingQueue,
  "regression-detector": regressionDetectorQueue,
  "selector-adaptation": selectorAdaptationQueue,
  revalidation: revalidationQueue,
  scheduled: scheduledQueue,
  deadletter: deadletterQueue,
  "system-status": systemStatusQueue,
}

// Queue events for monitoring
export function createQueueEvents(queueName: string): QueueEvents {
  return new QueueEvents(queueName, getBullMqOptions())
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
  // Classification fields for auto-healing
  errorCategory?: string // ErrorCategory enum value
  idempotencyKey?: string // jobId + payloadHash for deduplication
  isRetryable?: boolean // Whether this error is eligible for auto-retry
}
