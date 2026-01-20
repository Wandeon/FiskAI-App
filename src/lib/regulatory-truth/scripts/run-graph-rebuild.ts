// src/lib/regulatory-truth/scripts/run-graph-rebuild.ts
/**
 * Graph Rebuild Worker Script
 *
 * Runs as a BullMQ worker that processes graph-rebuild jobs with exponential backoff.
 * Ensures STALE rules eventually become CURRENT even after transient failures.
 *
 * Usage:
 *   # Run as worker (continuous)
 *   npx tsx src/lib/regulatory-truth/scripts/run-graph-rebuild.ts
 *
 *   # Run sweep only (one-shot)
 *   npx tsx src/lib/regulatory-truth/scripts/run-graph-rebuild.ts --sweep
 *
 *   # Rebuild specific rule (one-shot)
 *   npx tsx src/lib/regulatory-truth/scripts/run-graph-rebuild.ts <ruleId>
 */

import { config } from "dotenv"

// Load environment variables BEFORE importing any modules that use them
config({ path: ".env.local" })
config({ path: ".env" })

import { Worker, Job } from "bullmq"
import { buildRedisOptions } from "@/lib/infra/redis"
import {
  processGraphRebuildJob,
  sweepStuckRules,
  type GraphRebuildJobData,
} from "../graph/graph-rebuild-worker"
import { rebuildEdgesForRule } from "../graph/edge-builder"
import { db } from "@/lib/db"

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379"
const BULLMQ_PREFIX = process.env.BULLMQ_PREFIX || "fiskai"
const WORKER_CONCURRENCY = parseInt(process.env.GRAPH_REBUILD_CONCURRENCY || "1", 10)

// Max attempts before giving up (configured via env, default 4 = 5min, 30min, 2h, 12h)
const MAX_ATTEMPTS = parseInt(process.env.GRAPH_REBUILD_MAX_ATTEMPTS || "4", 10)

async function main() {
  const args = process.argv.slice(2)

  // Mode: sweep only
  if (args.includes("--sweep")) {
    console.log("[graph-rebuild] Running sweep for stuck rules...")
    const count = await sweepStuckRules()
    console.log(`[graph-rebuild] Sweep complete. Enqueued ${count} rules.`)
    process.exit(0)
  }

  // Mode: rebuild specific rule
  if (args.length > 0 && !args[0].startsWith("--")) {
    const ruleId = args[0]
    console.log(`[graph-rebuild] Rebuilding edges for rule: ${ruleId}`)

    try {
      const result = await rebuildEdgesForRule(ruleId)
      console.log(`[graph-rebuild] Result:`, result)

      // Update graphStatus to CURRENT
      await db.regulatoryRule.update({
        where: { id: ruleId },
        data: { graphStatus: "CURRENT" },
      })
      console.log(`[graph-rebuild] graphStatus set to CURRENT`)
      process.exit(0)
    } catch (error) {
      console.error(`[graph-rebuild] Failed:`, error)
      process.exit(1)
    }
  }

  // Mode: run as worker (continuous)
  console.log("[graph-rebuild] Starting worker...")
  console.log(`  Redis: ${REDIS_URL}`)
  console.log(`  Prefix: ${BULLMQ_PREFIX}`)
  console.log(`  Concurrency: ${WORKER_CONCURRENCY}`)
  console.log(`  Max attempts: ${MAX_ATTEMPTS}`)

  const redisOptions = buildRedisOptions(REDIS_URL)

  const worker = new Worker<GraphRebuildJobData>(
    "graph-rebuild",
    async (job: Job<GraphRebuildJobData>) => {
      const { ruleId, attempt } = job.data

      // Check max attempts
      if (attempt >= MAX_ATTEMPTS) {
        console.warn(
          `[graph-rebuild] Max attempts (${MAX_ATTEMPTS}) reached for rule ${ruleId}, skipping`
        )
        return { success: false, reason: "max_attempts_exceeded" }
      }

      const success = await processGraphRebuildJob(job.data)
      return { success }
    },
    {
      connection: redisOptions,
      prefix: BULLMQ_PREFIX,
      concurrency: WORKER_CONCURRENCY,
    }
  )

  worker.on("completed", (job, result) => {
    console.log(`[graph-rebuild] Job ${job.id} completed: ${result.success ? "SUCCESS" : "FAILED"}`)
  })

  worker.on("failed", (job, error) => {
    console.error(`[graph-rebuild] Job ${job?.id} failed:`, error.message)
  })

  worker.on("error", (error) => {
    console.error("[graph-rebuild] Worker error:", error)
  })

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("[graph-rebuild] Received SIGTERM, shutting down...")
    void worker.close().then(() => process.exit(0))
  })

  process.on("SIGINT", () => {
    console.log("[graph-rebuild] Received SIGINT, shutting down...")
    void worker.close().then(() => process.exit(0))
  })

  console.log("[graph-rebuild] Worker running. Press Ctrl+C to stop.")
}

main().catch((error) => {
  console.error("[graph-rebuild] Fatal error:", error)
  process.exit(1)
})
