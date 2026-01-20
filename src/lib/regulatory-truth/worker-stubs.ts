// src/lib/regulatory-truth/worker-stubs.ts
/**
 * Stubs for worker-related functionality needed by app-side monitoring.
 *
 * Since workers are now in a separate repository (fiskai-workers),
 * the app no longer has direct access to queue instances.
 * This module provides:
 * - Redis-based heartbeat monitoring (works cross-repo)
 * - Stub queue exports for health checks (return empty/safe defaults)
 */

import { redis } from "@/lib/infra/redis"
import { Queue } from "bullmq"
import { redisConnectionOptions, BULLMQ_PREFIX } from "@/lib/infra/redis"

// Drainer heartbeat key (matches workers repo)
const DRAINER_HEARTBEAT_KEY = `${BULLMQ_PREFIX}:drainer:heartbeat`

export interface DrainerHeartbeat {
  lastActivityAt: string
  cycleCount: number
  itemsProcessed: number
}

/**
 * Get drainer heartbeat from Redis (cross-repo compatible)
 */
export async function getDrainerHeartbeat(): Promise<DrainerHeartbeat | null> {
  const data = await redis.get(DRAINER_HEARTBEAT_KEY)
  if (!data) return null
  try {
    return JSON.parse(data) as DrainerHeartbeat
  } catch {
    return null
  }
}

/**
 * Get minutes since last drainer activity
 */
export async function getDrainerIdleMinutes(): Promise<number> {
  const heartbeat = await getDrainerHeartbeat()
  if (!heartbeat) return Infinity

  const lastActivity = new Date(heartbeat.lastActivityAt)
  const now = new Date()
  return (now.getTime() - lastActivity.getTime()) / 1000 / 60
}

/**
 * Check Redis health (re-export from infra)
 */
export { checkRedisHealth } from "@/lib/infra/redis"

// Lazy-loaded queue instances for health monitoring only
let _deadletterQueue: Queue | null = null

/**
 * Get dead letter queue for health monitoring
 * Note: This is read-only access for health checks
 */
export function getDeadletterQueue(): Queue {
  if (!_deadletterQueue) {
    _deadletterQueue = new Queue("dead-letter", {
      connection: redisConnectionOptions,
      prefix: BULLMQ_PREFIX,
    })
  }
  return _deadletterQueue
}

// Export as deadletterQueue for backwards compatibility
export const deadletterQueue = new Proxy({} as Queue, {
  get(_, prop: string | symbol) {
    const instance = getDeadletterQueue()
    const value = (instance as unknown as Record<string | symbol, unknown>)[prop]
    if (typeof value === "function") {
      return value.bind(instance)
    }
    return value
  },
})

// Queue names that workers use (for health monitoring)
const QUEUE_NAMES = [
  "sentinel",
  "extractor",
  "composer",
  "reviewer",
  "arbiter",
  "releaser",
  "ocr",
  "embedding",
  "evidence-embedding",
  "content-sync",
  "article",
  "scheduled",
  "graph-rebuild",
] as const

// Lazy-loaded queue map for health monitoring
let _allQueues: Record<string, Queue> | null = null

/**
 * Get all queues for health monitoring (read-only)
 */
export function getAllQueues(): Record<string, Queue> {
  if (!_allQueues) {
    _allQueues = {}
    for (const name of QUEUE_NAMES) {
      _allQueues[name] = new Queue(name, {
        connection: redisConnectionOptions,
        prefix: BULLMQ_PREFIX,
      })
    }
  }
  return _allQueues
}

// Export as allQueues for backwards compatibility
export const allQueues = new Proxy({} as Record<string, Queue>, {
  get(_, prop: string | symbol) {
    const queues = getAllQueues()
    if (typeof prop === "string" && prop in queues) {
      return queues[prop]
    }
    // Handle iteration and Object.entries
    if (prop === Symbol.iterator) {
      return function* () {
        for (const [k, v] of Object.entries(queues)) {
          yield [k, v]
        }
      }
    }
    return undefined
  },
  ownKeys() {
    return Object.keys(getAllQueues())
  },
  getOwnPropertyDescriptor(_, prop) {
    const queues = getAllQueues()
    if (typeof prop === "string" && prop in queues) {
      return { enumerable: true, configurable: true, value: queues[prop] }
    }
    return undefined
  },
})

/**
 * Close all queue connections (cleanup)
 */
export async function closeWorkerStubs(): Promise<void> {
  const closePromises: Promise<void>[] = []

  if (_deadletterQueue) {
    closePromises.push(_deadletterQueue.close())
    _deadletterQueue = null
  }

  if (_allQueues) {
    for (const queue of Object.values(_allQueues)) {
      closePromises.push(queue.close())
    }
    _allQueues = null
  }

  await Promise.all(closePromises)
}
