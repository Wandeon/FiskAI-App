#!/usr/bin/env npx tsx
// scripts/verify-worker-versions.ts
// Verify all running workers have the expected GIT_SHA

import { execSync } from "child_process"
import Redis from "ioredis"

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379"

function getExpectedSha(): string {
  if (process.env.EXPECTED_GIT_SHA) {
    return process.env.EXPECTED_GIT_SHA
  }

  try {
    const sha = execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim()
    console.log("Warning: Using git rev-parse HEAD (EXPECTED_GIT_SHA not set)")
    console.log("   On server, set EXPECTED_GIT_SHA for accurate comparison\n")
    return sha
  } catch {
    console.error("ERROR: Cannot determine expected SHA")
    console.error("Set EXPECTED_GIT_SHA or run from a git repo")
    process.exit(1)
  }
}

async function main() {
  const redis = new Redis(REDIS_URL)
  const expectedSha = getExpectedSha()

  console.log(`Expected GIT_SHA: ${expectedSha}\n`)

  const workerKeys = await redis.keys("fiskai:worker:*:version")

  if (workerKeys.length === 0) {
    console.log("No workers registered in Redis")
    console.log("Workers register on startup - are they running?")
    await redis.quit()
    process.exit(0)
  }

  let hasStale = false

  console.log("Workers:")
  for (const key of workerKeys) {
    const data = await redis.hgetall(key)
    const workerType = key.split(":")[2]
    const match = data.gitSha === expectedSha
    const status = match ? "[OK]" : "[STALE]"

    console.log(`  ${status} ${workerType}`)
    console.log(`      SHA: ${data.gitSha}`)
    console.log(`      Started: ${data.startedAt}`)

    if (!match) hasStale = true
  }

  await redis.quit()

  if (hasStale) {
    console.log("\n[ERROR] Some workers are running stale code!")
    console.log("   Rebuild and restart affected workers.")
    process.exit(1)
  }

  console.log("\n[OK] All workers running expected version")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
