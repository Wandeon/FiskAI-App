// src/lib/regulatory-truth/workers/__tests__/integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { redis, checkRedisHealth, closeRedis } from "../redis"
import { sentinelQueue, extractQueue } from "../queues"

describe("Worker Integration", () => {
  beforeAll(async () => {
    // Ensure Redis is available
    const healthy = await checkRedisHealth()
    if (!healthy) {
      throw new Error("Redis not available for tests")
    }
  })

  afterAll(async () => {
    await closeRedis()
  })

  it("should connect to Redis", async () => {
    const healthy = await checkRedisHealth()
    expect(healthy).toBe(true)
  })

  // Skip: Flaky test - job may be picked up by worker before cleanup
  it.skip("should add job to sentinel queue", async () => {
    const job = await sentinelQueue.add("test-sentinel", {
      runId: "test-run",
      priority: "CRITICAL",
    })

    expect(job.id).toBeDefined()
    expect(job.name).toBe("test-sentinel")

    // Clean up
    await job.remove()
  })

  it("should add job to extract queue with delay", async () => {
    const job = await extractQueue.add(
      "test-extract",
      { evidenceId: "test-evidence", runId: "test-run" },
      { delay: 1000 }
    )

    expect(job.id).toBeDefined()
    const state = await job.getState()
    expect(state).toBe("delayed")

    // Clean up
    await job.remove()
  })
})
