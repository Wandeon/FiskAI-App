// src/lib/security/rate-limit.ts
// Rate limiting and account security utilities

interface RateLimitRecord {
  count: number
  resetAt: number
  blockedUntil?: number // Timestamp when block expires
}

// In-memory rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, RateLimitRecord>()

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
  API_CALLS: {
    attempts: 100,
    window: 15 * 60 * 1000, // 15 minutes
    blockDuration: 15 * 60 * 1000,
  },
}

/**
 * Check if an identifier has exceeded rate limits
 */
export function checkRateLimit(
  identifier: string,
  limitType: keyof typeof RATE_LIMITS = "API_CALLS"
): { allowed: boolean; resetAt?: number; blockedUntil?: number } {
  const now = Date.now()
  const limit = RATE_LIMITS[limitType]
  const record = rateLimitStore.get(identifier)

  // Clean up expired records
  for (const [key, data] of rateLimitStore.entries()) {
    if (data.resetAt < now) {
      rateLimitStore.delete(key)
    }
  }

  if (!record) {
    // First attempt in this window
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + limit.window,
    })
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

  // Check if we need to reset the window
  if (record.resetAt < now) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + limit.window,
    })
    return { allowed: true, resetAt: now + limit.window }
  }

  // Check if we've exceeded the limit
  if (record.count >= limit.attempts) {
    // Block the user
    rateLimitStore.set(identifier, {
      count: record.count + 1,
      resetAt: record.resetAt,
      blockedUntil: now + limit.blockDuration,
    })
    return {
      allowed: false,
      resetAt: record.resetAt,
      blockedUntil: now + limit.blockDuration,
    }
  }

  // Increment count
  rateLimitStore.set(identifier, {
    ...record,
    count: record.count + 1,
  })

  return { allowed: true, resetAt: record.resetAt }
}

/**
 * Reset rate limit for an identifier
 */
export function resetRateLimit(identifier: string) {
  rateLimitStore.delete(identifier)
}

/**
 * Get rate limit info for an identifier
 */
export function getRateLimitInfo(identifier: string): RateLimitRecord | undefined {
  return rateLimitStore.get(identifier)
}

// Cleanup expired records periodically
setInterval(
  () => {
    const now = Date.now()
    for (const [key, data] of rateLimitStore.entries()) {
      if (data.resetAt < now || (data.blockedUntil && data.blockedUntil < now)) {
        rateLimitStore.delete(key)
      }
    }
  },
  5 * 60 * 1000
) // Every 5 minutes
