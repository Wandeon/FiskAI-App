// src/lib/regulatory-truth/workers/utils/version-guard.ts
// CRITICAL: This runs BEFORE Redis connection - no external dependencies

import { redis } from "../redis"

export interface VersionInfo {
  gitSha: string
  buildDate: string
  workerType: string
  expectedSha: string | undefined
  startedAt: string
}

/**
 * Get version info from environment variables (baked into Docker image)
 */
export function getVersionInfo(): VersionInfo {
  return {
    gitSha: process.env.GIT_SHA || "unknown",
    buildDate: process.env.BUILD_DATE || "unknown",
    workerType: process.env.WORKER_TYPE || "unknown",
    expectedSha: process.env.EXPECTED_GIT_SHA,
    startedAt: new Date().toISOString(),
  }
}

/**
 * HARD GUARD: Assert version matches expected in production
 * This MUST run before ANY other initialization (including Redis)
 *
 * Rules:
 * 1. If NODE_ENV=production and EXPECTED_GIT_SHA is set:
 *    - GIT_SHA must exist and must equal EXPECTED_GIT_SHA
 *    - Otherwise: exit(1) immediately
 * 2. If NODE_ENV=production and GIT_SHA is "unknown":
 *    - exit(1) immediately (image built without version info)
 * 3. In development: warn but don't crash
 */
export function assertVersionGuard(): void {
  const info = getVersionInfo()
  const isProduction = process.env.NODE_ENV === "production"

  console.log(`[version] Worker: ${info.workerType}`)
  console.log(`[version] GIT_SHA: ${info.gitSha}`)
  console.log(`[version] EXPECTED_GIT_SHA: ${info.expectedSha || "(not set)"}`)

  if (!isProduction) {
    if (info.expectedSha && info.gitSha !== info.expectedSha) {
      console.warn(`[version] WARNING: SHA mismatch in development`)
    }
    return
  }

  if (info.gitSha === "unknown") {
    console.error("[version] FATAL: GIT_SHA is 'unknown' in production!")
    console.error("[version] Image was built without --build-arg GIT_SHA")
    console.error("[version] This worker CANNOT run - may be stale code.")
    process.exit(1)
  }

  if (info.expectedSha && info.gitSha !== info.expectedSha) {
    console.error("[version] FATAL: Version mismatch!")
    console.error(`[version]   Image SHA:    ${info.gitSha}`)
    console.error(`[version]   Expected SHA: ${info.expectedSha}`)
    console.error("[version] This worker is running STALE code. Exiting.")
    process.exit(1)
  }

  console.log(`[version] Version check passed: ${info.gitSha}`)
}

/**
 * HARD GUARD: Assert not running via tsx in production
 */
export function assertNotTsx(): void {
  const isProduction = process.env.NODE_ENV === "production"
  const hasTsx = process.argv.some((arg) => arg.includes("tsx"))

  if (isProduction && hasTsx) {
    console.error("[version] FATAL: Running via tsx in production!")
    console.error("[version] Workers must be compiled to JS and run with node.")
    process.exit(1)
  }
}

/**
 * Run all startup guards (call this FIRST in every worker)
 */
export function runStartupGuards(): void {
  assertNotTsx()
  assertVersionGuard()
}

/**
 * Register worker version in Redis (call AFTER Redis is connected)
 */
export async function registerWorkerVersion(): Promise<void> {
  const info = getVersionInfo()
  const key = `fiskai:worker:${info.workerType}:version`

  await redis.hset(key, {
    gitSha: info.gitSha,
    buildDate: info.buildDate,
    startedAt: info.startedAt,
    pid: process.pid.toString(),
  })

  await redis.expire(key, 86400) // 24 hours
  console.log(`[version] Registered ${info.workerType}: ${info.gitSha}`)
}
