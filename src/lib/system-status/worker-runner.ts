#!/usr/bin/env npx tsx
/**
 * System Status Worker Runner
 *
 * Standalone script to run the system status refresh worker.
 *
 * Usage:
 *   npx tsx src/lib/system-status/worker-runner.ts
 *
 * Environment variables:
 *   REDIS_URL - Redis connection URL (default: redis://localhost:6379)
 *   BULLMQ_PREFIX - Queue prefix (default: fiskai)
 *   DATABASE_URL - PostgreSQL connection string
 */

import { createSystemStatusWorker, setupGracefulShutdown } from "./worker"

async function main() {
  console.log("[system-status-worker] Starting worker...")
  console.log(`[system-status-worker] Redis: ${process.env.REDIS_URL || "redis://localhost:6379"}`)
  console.log(`[system-status-worker] Prefix: ${process.env.BULLMQ_PREFIX || "fiskai"}`)

  const worker = createSystemStatusWorker()

  setupGracefulShutdown(worker)

  console.log("[system-status-worker] Worker started, waiting for jobs...")

  // Keep the process running
  await new Promise(() => {
    // This promise never resolves - worker runs until signal received
  })
}

main().catch((error) => {
  console.error("[system-status-worker] Fatal error:", error)
  process.exit(1)
})
