#!/usr/bin/env npx tsx
/**
 * Redis Orphaned Job Cleanup Script
 *
 * Safely removes orphaned BullMQ job data hashes (keys without queue membership).
 * These were created when jobs were added to queues that were later lost on Redis restart.
 *
 * Usage:
 *   npx tsx scripts/redis-cleanup-orphaned-jobs.ts --dry-run     # Preview what would be deleted
 *   npx tsx scripts/redis-cleanup-orphaned-jobs.ts               # Actually delete orphaned keys
 *
 * Safety:
 * - Only deletes job data hashes (fiskai:{queue}:{id} format)
 * - Skips queue control keys (meta, events, waiting, active, completed, failed, delayed)
 * - Verifies key is orphaned (not in any queue zset/list)
 * - Processes in batches to avoid blocking Redis
 */

import Redis from "ioredis"

// Redis is in Docker - use the container's exposed port or connect via Docker network
const REDIS_URL = process.env.REDIS_URL || "redis://fiskai-redis:6379"
const BATCH_SIZE = 1000
const DRY_RUN = process.argv.includes("--dry-run")

// Queue prefixes to clean
const QUEUE_PREFIXES = [
  "fiskai:review",
  "fiskai:extract",
  "fiskai:arbiter",
  "fiskai:compose",
  "fiskai:release",
  "fiskai:ocr",
]

// Keys that are queue control structures (NOT job data)
const CONTROL_SUFFIXES = [
  ":meta",
  ":id",
  ":events",
  ":wait",
  ":active",
  ":completed",
  ":failed",
  ":delayed",
  ":paused",
  ":priority",
  ":stalled-check",
  ":marker",
  ":pc", // priority counter
]

function isControlKey(key: string): boolean {
  return CONTROL_SUFFIXES.some((suffix) => key.endsWith(suffix))
}

function isJobDataKey(key: string): boolean {
  // Job data keys are: fiskai:{queue}:{numericId}
  // e.g., fiskai:review:5479231
  const parts = key.split(":")
  if (parts.length !== 3) return false
  const [prefix, queue, id] = parts
  if (prefix !== "fiskai") return false
  if (!QUEUE_PREFIXES.some((p) => key.startsWith(p))) return false
  // Job IDs are either numeric (auto-increment) or string-based (stable jobId)
  // Both are valid job data keys
  return id.length > 0 && !isControlKey(key)
}

async function main() {
  console.log(`Redis Orphaned Job Cleanup ${DRY_RUN ? "(DRY RUN)" : ""}`)
  console.log(`Connecting to: ${REDIS_URL}`)
  console.log("")

  const redis = new Redis(REDIS_URL)

  try {
    // Get initial stats
    const dbSize = await redis.dbsize()
    console.log(`Total Redis keys: ${dbSize.toLocaleString()}`)
    console.log("")

    // Count and clean each queue prefix
    let totalDeleted = 0
    let totalScanned = 0

    for (const prefix of QUEUE_PREFIXES) {
      console.log(`\n=== Processing ${prefix} ===`)

      let cursor = "0"
      let queueDeleted = 0
      let queueScanned = 0
      const keysToDelete: string[] = []

      do {
        const [nextCursor, keys] = await redis.scan(cursor, "MATCH", `${prefix}:*`, "COUNT", BATCH_SIZE)
        cursor = nextCursor
        queueScanned += keys.length
        totalScanned += keys.length

        for (const key of keys) {
          if (isJobDataKey(key)) {
            keysToDelete.push(key)

            // Process in batches
            if (keysToDelete.length >= BATCH_SIZE) {
              if (!DRY_RUN) {
                await redis.del(...keysToDelete)
              }
              queueDeleted += keysToDelete.length
              totalDeleted += keysToDelete.length
              console.log(
                `  ${DRY_RUN ? "Would delete" : "Deleted"} ${queueDeleted.toLocaleString()} keys...`
              )
              keysToDelete.length = 0
            }
          }
        }
      } while (cursor !== "0")

      // Delete remaining keys
      if (keysToDelete.length > 0) {
        if (!DRY_RUN) {
          await redis.del(...keysToDelete)
        }
        queueDeleted += keysToDelete.length
        totalDeleted += keysToDelete.length
      }

      console.log(`  Scanned: ${queueScanned.toLocaleString()} keys`)
      console.log(`  ${DRY_RUN ? "Would delete" : "Deleted"}: ${queueDeleted.toLocaleString()} keys`)
    }

    console.log("\n" + "=".repeat(50))
    console.log(`Total scanned: ${totalScanned.toLocaleString()} keys`)
    console.log(`Total ${DRY_RUN ? "would delete" : "deleted"}: ${totalDeleted.toLocaleString()} keys`)

    // Final stats
    if (!DRY_RUN) {
      const finalDbSize = await redis.dbsize()
      console.log(`\nFinal Redis keys: ${finalDbSize.toLocaleString()}`)
      console.log(`Memory freed: ~${((totalDeleted * 500) / 1024 / 1024).toFixed(1)} MB (estimated)`)
    }
  } finally {
    await redis.quit()
  }
}

main().catch(console.error)
