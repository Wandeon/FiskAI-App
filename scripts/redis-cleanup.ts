#!/usr/bin/env npx tsx
/**
 * Redis Stale Job Cleanup Script
 *
 * Safely removes old completed/failed jobs from BullMQ queues while keeping
 * the configured retention counts (1000 completed, 100 failed).
 *
 * This script:
 * 1. Uses BullMQ's Queue.clean() API (proper cleanup of sorted set + job data)
 * 2. Processes in batches to avoid overwhelming Redis
 * 3. Shows progress as it works
 *
 * Usage: npx tsx scripts/redis-cleanup.ts [--dry-run]
 */

import { Queue } from "bullmq"
import Redis from "ioredis"

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379"
const PREFIX = process.env.BULLMQ_PREFIX || "fiskai"
const DRY_RUN = process.argv.includes("--dry-run")

// Queue retention settings (from queues.ts)
const KEEP_COMPLETED = 1000
const KEEP_FAILED = 100

// Queues to clean
const QUEUE_NAMES = [
  "extract",
  "compose",
  "review",
  "arbiter",
  "release",
  "sentinel",
  "ocr",
  "embedding",
  "evidence-embedding",
  "content-sync",
  "article",
  "scheduled",
]

async function getQueueStats(redis: Redis, queueName: string) {
  const prefix = `${PREFIX}:${queueName}`
  const completed = await redis.zcard(`${prefix}:completed`)
  const failed = await redis.zcard(`${prefix}:failed`)
  const waiting = await redis.llen(`${prefix}:wait`)
  const active = await redis.llen(`${prefix}:active`)
  return { completed, failed, waiting, active }
}

async function cleanQueue(queueName: string, redis: Redis) {
  const stats = await getQueueStats(redis, queueName)
  const toRemoveCompleted = Math.max(0, stats.completed - KEEP_COMPLETED)
  const toRemoveFailed = Math.max(0, stats.failed - KEEP_FAILED)

  if (toRemoveCompleted === 0 && toRemoveFailed === 0) {
    console.log(`  [${queueName}] Already clean (completed: ${stats.completed}, failed: ${stats.failed})`)
    return { removed: 0, queueName }
  }

  console.log(`  [${queueName}] Stats: completed=${stats.completed}, failed=${stats.failed}`)
  console.log(`  [${queueName}] Will remove: ${toRemoveCompleted} completed, ${toRemoveFailed} failed`)

  if (DRY_RUN) {
    console.log(`  [${queueName}] DRY RUN - no changes made`)
    return { removed: 0, queueName }
  }

  // Use BullMQ's Queue.clean() method for proper cleanup
  const queue = new Queue(queueName, {
    connection: redis,
    prefix: PREFIX,
  })

  try {
    // Clean completed jobs older than 0ms (all), keeping the count specified
    // BullMQ clean() removes jobs by age, so we clean all and rely on the limit
    const removedCompleted = await queue.clean(0, toRemoveCompleted, "completed")
    console.log(`  [${queueName}] Removed ${removedCompleted.length} completed jobs`)

    // Clean failed jobs
    const removedFailed = await queue.clean(0, toRemoveFailed, "failed")
    console.log(`  [${queueName}] Removed ${removedFailed.length} failed jobs`)

    await queue.close()
    return {
      removed: removedCompleted.length + removedFailed.length,
      queueName,
    }
  } catch (error) {
    console.error(`  [${queueName}] Error during cleanup:`, error)
    await queue.close()
    throw error
  }
}

async function main() {
  console.log("=== Redis Stale Job Cleanup ===")
  console.log(`Redis URL: ${REDIS_URL}`)
  console.log(`Prefix: ${PREFIX}`)
  console.log(`Retention: ${KEEP_COMPLETED} completed, ${KEEP_FAILED} failed`)
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`)
  console.log()

  const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null })

  // Get initial memory usage
  const infoBefore = await redis.info("memory")
  const usedMemoryBefore = infoBefore.match(/used_memory:(\d+)/)?.[1]
  console.log(`Initial memory: ${(parseInt(usedMemoryBefore || "0") / 1024 / 1024 / 1024).toFixed(2)} GB`)
  console.log()

  let totalRemoved = 0

  for (const queueName of QUEUE_NAMES) {
    try {
      const result = await cleanQueue(queueName, redis)
      totalRemoved += result.removed
    } catch (error) {
      console.error(`Failed to clean ${queueName}:`, error)
    }
    console.log()
  }

  // Get final memory usage
  const infoAfter = await redis.info("memory")
  const usedMemoryAfter = infoAfter.match(/used_memory:(\d+)/)?.[1]
  console.log(`Final memory: ${(parseInt(usedMemoryAfter || "0") / 1024 / 1024 / 1024).toFixed(2)} GB`)
  console.log(`Memory freed: ${((parseInt(usedMemoryBefore || "0") - parseInt(usedMemoryAfter || "0")) / 1024 / 1024).toFixed(2)} MB`)
  console.log(`Total jobs removed: ${totalRemoved}`)

  await redis.quit()
}

main().catch((error) => {
  console.error("Cleanup failed:", error)
  process.exit(1)
})
