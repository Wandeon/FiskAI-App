// src/lib/security/rate-limit.ts
// Rate limiting and account security utilities with Redis backend for multi-instance support
// NOTE: This module is Edge Runtime compatible - uses lazy loading for Redis

interface RateLimitRecord {
  count: number
  resetAt: number
  blockedUntil?: number // Timestamp when block expires
}

// Redis key prefix for rate limiting
const RATE_LIMIT_PREFIX = "rate-limit:"

// Lazy-loaded Redis client to avoid Edge Runtime issues
let redisClient: Awaited<typeof import("@/lib/regulatory-truth/workers/redis")>["redis"] | null =
  null

async function getRedis() {
  if (redisClient) return redisClient
  // Dynamic import to avoid Edge Runtime bundling issues
  const { redis } = await import("@/lib/regulatory-truth/workers/redis")
  redisClient = redis
  return redisClient
}

// Detect Edge Runtime
function isEdgeRuntime(): boolean {
  return typeof (globalThis as unknown as { EdgeRuntime?: unknown }).EdgeRuntime !== "undefined"
}

// In-memory fallback for Edge Runtime and Redis failures
const inMemoryFallback = new Map<string, RateLimitRecord>()

// Critical limit types that should fail-closed when Redis is unavailable
// These are security-sensitive operations that should deny access if rate limiting
// cannot be properly enforced (prevents brute-force attacks when Redis is down)
const CRITICAL_LIMIT_TYPES = new Set<string>(["LOGIN", "PASSWORD_RESET", "OTP_SEND", "OTP_VERIFY"])

export const RATE_LIMITS = {
  LOGIN: {
    attempts: 5, // 5 attempts
    window: 15 * 60 * 1000, // 15 minutes
    blockDuration: 60 * 60 * 1000, // 1 hour block after max attempts
  },
  PASSWORD_RESET: {
    attempts: 3,
    window: 15 * 60 * 1000,
    blockDuration: 60 * 60 * 1000,
  },
  EMAIL_VERIFICATION: {
    attempts: 3, // 3 resend attempts
    window: 60 * 60 * 1000, // 1 hour
    blockDuration: 60 * 60 * 1000, // 1 hour block
  },
  OTP_SEND: {
    attempts: 3, // 3 codes per email per hour
    window: 60 * 60 * 1000, // 1 hour
    blockDuration: 60 * 60 * 1000, // 1 hour block
  },
  OTP_VERIFY: {
    attempts: 5, // 5 attempts per code
    window: 10 * 60 * 1000, // 10 minutes (code lifetime)
    blockDuration: 30 * 60 * 1000, // 30 minute lockout
  },
  API_CALLS: {
    attempts: 100,
    window: 15 * 60 * 1000, // 15 minutes
    blockDuration: 15 * 60 * 1000,
  },
  UNAUTHENTICATED_TRAFFIC: {
    attempts: 100, // 100 requests per window
    window: 60 * 1000, // 1 minute
    blockDuration: 60 * 1000, // 1 minute block
  },
  STAFF_API: {
    attempts: 200, // Staff portal API calls
    window: 15 * 60 * 1000, // 15 minutes
    blockDuration: 15 * 60 * 1000,
  },
  STAFF_BULK_EXPORT: {
    attempts: 10, // Bulk export operations
    window: 60 * 60 * 1000, // 1 hour
    blockDuration: 60 * 60 * 1000,
  },
  NEWSLETTER_IP: {
    attempts: 5, // Newsletter signups per IP
    window: 60 * 60 * 1000, // 1 hour
    blockDuration: 60 * 60 * 1000,
  },
  NEWSLETTER_EMAIL: {
    attempts: 3, // Newsletter signups per email
    window: 24 * 60 * 60 * 1000, // 24 hours
    blockDuration: 24 * 60 * 60 * 1000,
  },
  CONTACT_FORM: {
    attempts: 5, // Contact form submissions
    window: 60 * 60 * 1000, // 1 hour
    blockDuration: 60 * 60 * 1000,
  },
  ADMIN_EXPORT: {
    attempts: 10, // Admin export operations
    window: 60 * 60 * 1000, // 1 hour
    blockDuration: 60 * 60 * 1000,
  },
  SUPPORT_TICKET: {
    attempts: 10, // Support ticket creations
    window: 60 * 60 * 1000, // 1 hour
    blockDuration: 60 * 60 * 1000,
  },
  EXPORT: {
    attempts: 10, // Generic export operations (backup/restore)
    window: 60 * 60 * 1000, // 1 hour
    blockDuration: 60 * 60 * 1000,
  },
}

/**
 * Get the Redis key for a rate limit identifier
 */
function getKey(identifier: string, limitType: string): string {
  return `${RATE_LIMIT_PREFIX}${limitType}:${identifier}`
}

/**
 * Check if an identifier has exceeded rate limits (async Redis-based)
 * Falls back to in-memory when in Edge Runtime or Redis unavailable
 */
export async function checkRateLimit(
  identifier: string,
  limitType: keyof typeof RATE_LIMITS = "API_CALLS"
): Promise<{ allowed: boolean; resetAt?: number; blockedUntil?: number }> {
  // In Edge Runtime, use in-memory fallback (ioredis doesn't work in Edge)
  if (isEdgeRuntime()) {
    return checkRateLimitInMemory(identifier, limitType)
  }

  const now = Date.now()
  const limit = RATE_LIMITS[limitType]
  const key = getKey(identifier, limitType)

  try {
    const redis = await getRedis()
    const data = await redis.get(key)
    const record: RateLimitRecord | null = data ? JSON.parse(data) : null

    if (!record) {
      // First attempt in this window
      const newRecord: RateLimitRecord = {
        count: 1,
        resetAt: now + limit.window,
      }
      // Set with TTL equal to the window duration (in seconds)
      await redis.setex(key, Math.ceil(limit.window / 1000), JSON.stringify(newRecord))
      return { allowed: true, resetAt: now + limit.window }
    }

    // Check if currently blocked
    if (record.blockedUntil && record.blockedUntil > now) {
      return {
        allowed: false,
        resetAt: record.resetAt,
        blockedUntil: record.blockedUntil,
      }
    }

    // Check if we need to reset the window (expired)
    if (record.resetAt < now) {
      const newRecord: RateLimitRecord = {
        count: 1,
        resetAt: now + limit.window,
      }
      await redis.setex(key, Math.ceil(limit.window / 1000), JSON.stringify(newRecord))
      return { allowed: true, resetAt: now + limit.window }
    }

    // Check if we've exceeded the limit
    if (record.count >= limit.attempts) {
      // Block the user
      const blockedRecord: RateLimitRecord = {
        count: record.count + 1,
        resetAt: record.resetAt,
        blockedUntil: now + limit.blockDuration,
      }
      // Set TTL to the block duration
      await redis.setex(key, Math.ceil(limit.blockDuration / 1000), JSON.stringify(blockedRecord))
      return {
        allowed: false,
        resetAt: record.resetAt,
        blockedUntil: now + limit.blockDuration,
      }
    }

    // Increment count
    const updatedRecord: RateLimitRecord = {
      ...record,
      count: record.count + 1,
    }
    // Preserve remaining TTL
    const ttl = await redis.ttl(key)
    if (ttl > 0) {
      await redis.setex(key, ttl, JSON.stringify(updatedRecord))
    } else {
      await redis.setex(key, Math.ceil(limit.window / 1000), JSON.stringify(updatedRecord))
    }

    return { allowed: true, resetAt: record.resetAt }
  } catch (error) {
    console.error("[rate-limit] Redis error, using in-memory fallback:", error)

    // For critical security-sensitive operations, fail-closed when Redis is unavailable
    // This prevents brute-force attacks when rate limiting cannot be enforced properly
    if (CRITICAL_LIMIT_TYPES.has(limitType)) {
      return { allowed: false }
    }

    // For non-critical operations, fall back to in-memory
    return checkRateLimitInMemory(identifier, limitType)
  }
}

/**
 * In-memory rate limit check (for Edge Runtime and fallback)
 */
function checkRateLimitInMemory(
  identifier: string,
  limitType: keyof typeof RATE_LIMITS
): { allowed: boolean; resetAt?: number; blockedUntil?: number } {
  const now = Date.now()
  const limit = RATE_LIMITS[limitType]
  const key = getKey(identifier, limitType)
  const record = inMemoryFallback.get(key)

  if (!record) {
    inMemoryFallback.set(key, { count: 1, resetAt: now + limit.window })
    return { allowed: true, resetAt: now + limit.window }
  }

  if (record.blockedUntil && record.blockedUntil > now) {
    return { allowed: false, resetAt: record.resetAt, blockedUntil: record.blockedUntil }
  }

  if (record.resetAt < now) {
    inMemoryFallback.set(key, { count: 1, resetAt: now + limit.window })
    return { allowed: true, resetAt: now + limit.window }
  }

  if (record.count >= limit.attempts) {
    inMemoryFallback.set(key, {
      count: record.count + 1,
      resetAt: record.resetAt,
      blockedUntil: now + limit.blockDuration,
    })
    return { allowed: false, resetAt: record.resetAt, blockedUntil: now + limit.blockDuration }
  }

  inMemoryFallback.set(key, { ...record, count: record.count + 1 })
  return { allowed: true, resetAt: record.resetAt }
}

/**
 * Synchronous rate limit check (for backward compatibility)
 * Uses in-memory fallback when Redis is not immediately available
 * NOTE: This will not work across instances - use async checkRateLimit where possible
 */
export function checkRateLimitSync(
  identifier: string,
  limitType: keyof typeof RATE_LIMITS = "API_CALLS"
): { allowed: boolean; resetAt?: number; blockedUntil?: number } {
  console.warn(
    "[rate-limit] Using sync rate limit check - this will not work across instances. Use async checkRateLimit instead."
  )
  const now = Date.now()
  const limit = RATE_LIMITS[limitType]
  const key = getKey(identifier, limitType)
  const record = inMemoryFallback.get(key)

  if (!record) {
    inMemoryFallback.set(key, {
      count: 1,
      resetAt: now + limit.window,
    })
    return { allowed: true, resetAt: now + limit.window }
  }

  if (record.blockedUntil && record.blockedUntil > now) {
    return { allowed: false, resetAt: record.resetAt, blockedUntil: record.blockedUntil }
  }

  if (record.resetAt < now) {
    inMemoryFallback.set(key, { count: 1, resetAt: now + limit.window })
    return { allowed: true, resetAt: now + limit.window }
  }

  if (record.count >= limit.attempts) {
    inMemoryFallback.set(key, {
      count: record.count + 1,
      resetAt: record.resetAt,
      blockedUntil: now + limit.blockDuration,
    })
    return { allowed: false, resetAt: record.resetAt, blockedUntil: now + limit.blockDuration }
  }

  inMemoryFallback.set(key, { ...record, count: record.count + 1 })
  return { allowed: true, resetAt: record.resetAt }
}

/**
 * Reset rate limit for an identifier
 */
export async function resetRateLimit(identifier: string): Promise<void> {
  // Reset all limit types for this identifier
  const limitTypes = Object.keys(RATE_LIMITS) as (keyof typeof RATE_LIMITS)[]

  // Clear from in-memory fallback first
  limitTypes.forEach((type) => inMemoryFallback.delete(getKey(identifier, type)))

  // Skip Redis in Edge Runtime
  if (isEdgeRuntime()) return

  try {
    const redis = await getRedis()
    await Promise.all(limitTypes.map((type) => redis.del(getKey(identifier, type))))
  } catch (error) {
    console.error("[rate-limit] Redis error during reset:", error)
  }
}

/**
 * Get rate limit info for an identifier
 */
export async function getRateLimitInfo(
  identifier: string,
  limitType: keyof typeof RATE_LIMITS = "API_CALLS"
): Promise<RateLimitRecord | undefined> {
  // In Edge Runtime, use in-memory fallback
  if (isEdgeRuntime()) {
    return inMemoryFallback.get(getKey(identifier, limitType))
  }

  try {
    const redis = await getRedis()
    const data = await redis.get(getKey(identifier, limitType))
    return data ? JSON.parse(data) : undefined
  } catch (error) {
    console.error("[rate-limit] Redis error during info fetch:", error)
    return inMemoryFallback.get(getKey(identifier, limitType))
  }
}
