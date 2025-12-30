import { after, describe, it, mock } from "node:test"
import assert from "node:assert"
import { checkRateLimit } from "../security/rate-limit"
import { closeRedis, redis } from "../regulatory-truth/workers/redis"

describe("rate-limit fail closed", () => {
  after(async () => {
    await closeRedis()
  })

  it("denies critical limit types when Redis throws", async () => {
    const restore = mock.method(redis, "get", async () => {
      throw new Error("redis down")
    })

    const result = await checkRateLimit("user", "LOGIN")

    restore.mock.restore()

    assert.strictEqual(result.allowed, false)
  })
})
