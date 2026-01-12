// src/lib/regulatory-truth/workers/__tests__/redis-url-parsing.test.ts
import { describe, it, expect } from "vitest"
import { buildRedisOptions } from "../redis"

describe("buildRedisOptions", () => {
  it("parses simple redis://host:port/db URL", () => {
    const opts = buildRedisOptions("redis://localhost:6379/0")

    expect(opts.host).toBe("localhost")
    expect(opts.port).toBe(6379)
    expect(opts.db).toBe(0)
    expect(opts.username).toBeUndefined()
    expect(opts.password).toBeUndefined()
    expect(opts.tls).toBeUndefined()
    // BullMQ required options
    expect(opts.maxRetriesPerRequest).toBeNull()
    expect(opts.enableReadyCheck).toBe(false)
  })

  it("parses redis://:password@host:port/db URL (password only)", () => {
    const opts = buildRedisOptions("redis://:mypassword@host:6379/0")

    expect(opts.host).toBe("host")
    expect(opts.port).toBe(6379)
    expect(opts.db).toBe(0)
    expect(opts.username).toBeUndefined() // Empty username maps to undefined (ioredis accepts this)
    expect(opts.password).toBe("mypassword")
    expect(opts.tls).toBeUndefined()
  })

  it("parses redis://user:password@host:port/db URL (ACL auth)", () => {
    const opts = buildRedisOptions("redis://default:secretpass@host:6379/2")

    expect(opts.host).toBe("host")
    expect(opts.port).toBe(6379)
    expect(opts.db).toBe(2)
    expect(opts.username).toBe("default")
    expect(opts.password).toBe("secretpass")
    expect(opts.tls).toBeUndefined()
  })

  it("parses rediss:// URL with TLS enabled", () => {
    const opts = buildRedisOptions("rediss://default:pass@host:6380/1")

    expect(opts.host).toBe("host")
    expect(opts.port).toBe(6380)
    expect(opts.db).toBe(1)
    expect(opts.username).toBe("default")
    expect(opts.password).toBe("pass")
    expect(opts.tls).toEqual({})
  })

  it("handles URL-encoded special characters in password", () => {
    // Password: p@ss:word/123
    const opts = buildRedisOptions("redis://user:p%40ss%3Aword%2F123@host:6379/0")

    expect(opts.password).toBe("p@ss:word/123")
    expect(opts.username).toBe("user")
  })

  it("defaults port to 6379 when not specified", () => {
    const opts = buildRedisOptions("redis://localhost/0")

    expect(opts.port).toBe(6379)
  })

  it("defaults db to 0 when not specified", () => {
    const opts = buildRedisOptions("redis://localhost:6379")

    expect(opts.db).toBe(0)
  })

  it("handles prod-like URL format", () => {
    // Matches actual production URL pattern
    const opts = buildRedisOptions(
      "redis://default:5a42cf3f43b0fe332f10ca17ff4c2931cab329fb486dd663304ae7b39f3a7e0a@fiskai-redis-vps:6379"
    )

    expect(opts.host).toBe("fiskai-redis-vps")
    expect(opts.port).toBe(6379)
    expect(opts.db).toBe(0)
    expect(opts.username).toBe("default")
    expect(opts.password).toBe("5a42cf3f43b0fe332f10ca17ff4c2931cab329fb486dd663304ae7b39f3a7e0a")
    expect(opts.tls).toBeUndefined()
  })
})
