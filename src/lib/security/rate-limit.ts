// src/lib/security/rate-limit.ts
// Rate limiting and account security utilities with Redis backend for multi-instance support

import { redis } from "@/lib/regulatory-truth/workers/redis"

interface RateLimitRecord {
  count: number
  resetAt: number
  blockedUntil?: number // Timestamp when block expires
}

// Redis key prefix for rate limiting
const RATE_LIMIT_PREFIX = "rate-limit:"

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
}

/**
 * Get the Redis key for a rate limit identifier
 */
function getKey(identifier: string, limitType: string): string {
  return `${RATE_LIMIT_PREFIX}${limitType}:${identifier}`
}

/**
 * Check if an identifier has exceeded rate limits (async Redis-based)
 */
export async function checkRateLimit(
  identifier: string,
  limitType: keyof typeof RATE_LIMITS = "API_CALLS"
): Promise<{ allowed: boolean; resetAt?: number; blockedUntil?: number }> {
  const now = Date.now()
  const limit = RATE_LIMITS[limitType]
  const key = getKey(identifier, limitType)

  try {
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
    // If Redis is unavailable, fail open but log the error
    console.error("[rate-limit] Redis error, allowing request:", error)
    return { allowed: true }
  }
}

/**
 * Synchronous rate limit check (for backward compatibility)
 * Uses in-memory fallback when Redis is not immediately available
 * NOTE: This will not work across instances - use async checkRateLimit where possible
 */
const inMemoryFallback = new Map<string, RateLimitRecord>()

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
  try {
    await Promise.all(limitTypes.map((type) => redis.del(getKey(identifier, type))))
  } catch (error) {
    console.error("[rate-limit] Redis error during reset:", error)
  }
  // Also clear from fallback
  limitTypes.forEach((type) => inMemoryFallback.delete(getKey(identifier, type)))
}

/**
 * Get rate limit info for an identifier
 */
export async function getRateLimitInfo(
  identifier: string,
  limitType: keyof typeof RATE_LIMITS = "API_CALLS"
): Promise<RateLimitRecord | undefined> {
  try {
    const data = await redis.get(getKey(identifier, limitType))
    return data ? JSON.parse(data) : undefined
  } catch (error) {
    console.error("[rate-limit] Redis error during info fetch:", error)
    return undefined
  }
}
