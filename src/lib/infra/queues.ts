// src/lib/infra/queues.ts
/**
 * Minimal Queue Producer for App
 *
 * Provides queue access for the app to enqueue jobs for workers.
 * Workers are in a separate repo but share the same Redis queues.
 */

import { Queue } from "bullmq"
import { buildRedisOptions } from "./redis"

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379"
const BULLMQ_PREFIX = process.env.BULLMQ_PREFIX || "fiskai"

const redisOptions = buildRedisOptions(REDIS_URL)

// Lazy-initialized queues for job submission
let _scheduledQueue: Queue | null = null
let _articleQueue: Queue | null = null
let _backupQueue: Queue | null = null
let _evidenceEmbeddingQueue: Queue | null = null
let _contentSyncQueue: Queue | null = null
let _extractQueue: Queue | null = null
let _ocrQueue: Queue | null = null
let _embeddingQueue: Queue | null = null
let _selectorAdaptationQueue: Queue | null = null
let _nnSentinelQueue: Queue | null = null
let _nnFetchQueue: Queue | null = null
let _graphRebuildQueue: Queue | null = null

/**
 * Get the scheduled queue for triggering pipeline runs
 */
export function getScheduledQueue(): Queue {
  if (!_scheduledQueue) {
    _scheduledQueue = new Queue("scheduled", {
      connection: redisOptions,
      prefix: BULLMQ_PREFIX,
    })
  }
  return _scheduledQueue
}

/**
 * Get the article queue for generating articles
 */
export function getArticleQueue(): Queue {
  if (!_articleQueue) {
    _articleQueue = new Queue("article", {
      connection: redisOptions,
      prefix: BULLMQ_PREFIX,
    })
  }
  return _articleQueue
}

/**
 * Get the backup queue for backup jobs
 */
export function getBackupQueue(): Queue {
  if (!_backupQueue) {
    _backupQueue = new Queue("backup", {
      connection: redisOptions,
      prefix: BULLMQ_PREFIX,
    })
  }
  return _backupQueue
}

/**
 * Get the evidence embedding queue for embedding generation
 */
export function getEvidenceEmbeddingQueue(): Queue {
  if (!_evidenceEmbeddingQueue) {
    _evidenceEmbeddingQueue = new Queue("evidence-embedding", {
      connection: redisOptions,
      prefix: BULLMQ_PREFIX,
    })
  }
  return _evidenceEmbeddingQueue
}

/**
 * Get the content sync queue for syncing content changes
 */
export function getContentSyncQueue(): Queue {
  if (!_contentSyncQueue) {
    _contentSyncQueue = new Queue("content-sync", {
      connection: redisOptions,
      prefix: BULLMQ_PREFIX,
    })
  }
  return _contentSyncQueue
}

/**
 * Enqueue a content sync job by event ID
 */
export async function enqueueContentSyncJob(eventId: string): Promise<string | undefined> {
  const job = await getContentSyncQueue().add(
    "sync",
    { eventId },
    { jobId: `content-sync-${eventId}` }
  )
  return job.id
}

/**
 * Get the extract queue for fact extraction jobs
 */
export function getExtractQueue(): Queue {
  if (!_extractQueue) {
    _extractQueue = new Queue("extractor", {
      connection: redisOptions,
      prefix: BULLMQ_PREFIX,
    })
  }
  return _extractQueue
}

/**
 * Get the OCR queue for OCR processing jobs
 */
export function getOcrQueue(): Queue {
  if (!_ocrQueue) {
    _ocrQueue = new Queue("ocr", {
      connection: redisOptions,
      prefix: BULLMQ_PREFIX,
    })
  }
  return _ocrQueue
}

/**
 * Get the embedding queue for rule embedding generation
 */
export function getEmbeddingQueue(): Queue {
  if (!_embeddingQueue) {
    _embeddingQueue = new Queue("embedding", {
      connection: redisOptions,
      prefix: BULLMQ_PREFIX,
    })
  }
  return _embeddingQueue
}

/**
 * Get the selector adaptation queue
 */
export function getSelectorAdaptationQueue(): Queue {
  if (!_selectorAdaptationQueue) {
    _selectorAdaptationQueue = new Queue("selector-adaptation", {
      connection: redisOptions,
      prefix: BULLMQ_PREFIX,
    })
  }
  return _selectorAdaptationQueue
}

/**
 * Get the NN sentinel queue for enumeration jobs
 */
export function getNNSentinelQueue(): Queue {
  if (!_nnSentinelQueue) {
    _nnSentinelQueue = new Queue("nn-sentinel", {
      connection: redisOptions,
      prefix: BULLMQ_PREFIX,
    })
  }
  return _nnSentinelQueue
}

/**
 * Get the NN fetch queue for fetching NN documents
 */
export function getNNFetchQueue(): Queue {
  if (!_nnFetchQueue) {
    _nnFetchQueue = new Queue("nn-fetch", {
      connection: redisOptions,
      prefix: BULLMQ_PREFIX,
    })
  }
  return _nnFetchQueue
}

/**
 * Get the graph rebuild queue for edge rebuilding jobs
 */
export function getGraphRebuildQueue(): Queue {
  if (!_graphRebuildQueue) {
    _graphRebuildQueue = new Queue("graph-rebuild", {
      connection: redisOptions,
      prefix: BULLMQ_PREFIX,
    })
  }
  return _graphRebuildQueue
}

/**
 * Backoff delays for graph rebuild retries (in ms)
 * 5min, 30min, 2h, 12h
 */
const GRAPH_REBUILD_BACKOFF_DELAYS = [
  5 * 60 * 1000, // 5 minutes
  30 * 60 * 1000, // 30 minutes
  2 * 60 * 60 * 1000, // 2 hours
  12 * 60 * 60 * 1000, // 12 hours
]

/**
 * Enqueue a graph rebuild job for a rule with exponential backoff
 *
 * @param ruleId - The rule ID to rebuild edges for
 * @param attempt - Current attempt number (0-based, default 0)
 * @returns The job ID if enqueued, undefined if max retries exceeded
 */
export async function enqueueGraphRebuildJob(
  ruleId: string,
  attempt: number = 0
): Promise<string | undefined> {
  // Max retries = length of backoff array
  if (attempt >= GRAPH_REBUILD_BACKOFF_DELAYS.length) {
    console.warn(`[graph-rebuild] Max retries exceeded for rule ${ruleId}, not re-enqueueing`)
    return undefined
  }

  const delay = GRAPH_REBUILD_BACKOFF_DELAYS[attempt]
  const job = await getGraphRebuildQueue().add(
    "rebuild",
    { ruleId, attempt },
    {
      jobId: `graph-rebuild-${ruleId}-${attempt}`,
      delay,
      attempts: 1, // No BullMQ auto-retries - we manage attempts via job data
      removeOnComplete: 100, // Keep last 100 completed jobs
      removeOnFail: 1000, // Keep last 1000 failed jobs for debugging
    }
  )

  console.log(
    `[graph-rebuild] Enqueued rebuild for rule ${ruleId}, attempt ${attempt + 1}/${GRAPH_REBUILD_BACKOFF_DELAYS.length}, delay ${delay / 1000}s`
  )
  return job.id
}

// Backwards-compatible queue exports (proxy to lazy getters)
export const extractQueue = new Proxy({} as Queue, {
  get(_, prop: string | symbol) {
    const instance = getExtractQueue()
    const value = (instance as unknown as Record<string | symbol, unknown>)[prop]
    if (typeof value === "function") {
      return value.bind(instance)
    }
    return value
  },
})

export const ocrQueue = new Proxy({} as Queue, {
  get(_, prop: string | symbol) {
    const instance = getOcrQueue()
    const value = (instance as unknown as Record<string | symbol, unknown>)[prop]
    if (typeof value === "function") {
      return value.bind(instance)
    }
    return value
  },
})

export const embeddingQueue = new Proxy({} as Queue, {
  get(_, prop: string | symbol) {
    const instance = getEmbeddingQueue()
    const value = (instance as unknown as Record<string | symbol, unknown>)[prop]
    if (typeof value === "function") {
      return value.bind(instance)
    }
    return value
  },
})

export const evidenceEmbeddingQueue = new Proxy({} as Queue, {
  get(_, prop: string | symbol) {
    const instance = getEvidenceEmbeddingQueue()
    const value = (instance as unknown as Record<string | symbol, unknown>)[prop]
    if (typeof value === "function") {
      return value.bind(instance)
    }
    return value
  },
})

export const selectorAdaptationQueue = new Proxy({} as Queue, {
  get(_, prop: string | symbol) {
    const instance = getSelectorAdaptationQueue()
    const value = (instance as unknown as Record<string | symbol, unknown>)[prop]
    if (typeof value === "function") {
      return value.bind(instance)
    }
    return value
  },
})

/**
 * Close all queue connections (for cleanup)
 */
export async function closeQueues(): Promise<void> {
  const queues = [
    _scheduledQueue,
    _articleQueue,
    _backupQueue,
    _evidenceEmbeddingQueue,
    _contentSyncQueue,
    _extractQueue,
    _ocrQueue,
    _embeddingQueue,
    _selectorAdaptationQueue,
    _nnSentinelQueue,
    _nnFetchQueue,
    _graphRebuildQueue,
  ].filter(Boolean) as Queue[]
  await Promise.all(queues.map((q) => q.close()))
  _scheduledQueue = null
  _articleQueue = null
  _backupQueue = null
  _evidenceEmbeddingQueue = null
  _contentSyncQueue = null
  _extractQueue = null
  _ocrQueue = null
  _embeddingQueue = null
  _selectorAdaptationQueue = null
  _nnSentinelQueue = null
  _nnFetchQueue = null
}
