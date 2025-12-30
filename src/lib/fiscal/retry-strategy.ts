// src/lib/fiscal/retry-strategy.ts
// Unified retry strategy for fiscal operations
// Addresses issue #753 - standardizes exponential backoff across all fiscal cron jobs

/**
 * Retry configuration for fiscal operations
 *
 * Strategy:
 * - Base delay: 60 seconds (1 minute)
 * - Exponential backoff: power of 2 (60s, 2m, 4m, 8m, 16m, 32m, 1h, 2h, 4h, 4h...)
 * - Max delay: 4 hours (balances aggressive retry with rate limiting)
 * - Max attempts: 10
 * - Jitter: ±10% to prevent thundering herd
 *
 * Total retry window: ~8.5 hours
 * Well within Croatian 48-hour fiscalization deadline
 */
export const RETRY_CONFIG = {
  baseDelaySeconds: 60, // 1 minute
  maxDelaySeconds: 4 * 60 * 60, // 4 hours max
  maxAttempts: 10,
  jitterPercent: 0.1, // ±10% jitter
} as const

/**
 * Calculate next retry time with exponential backoff and jitter
 *
 * @param attemptCount - Current attempt number (1-indexed)
 * @returns Date object for next retry
 *
 * Example progression:
 * - Attempt 1: 60s + jitter
 * - Attempt 2: 120s + jitter
 * - Attempt 3: 240s + jitter
 * - Attempt 4: 480s + jitter
 * - Attempt 5: 960s + jitter
 * - Attempt 6: 1920s + jitter
 * - Attempt 7: 3840s + jitter
 * - Attempt 8+: 14400s (4h max) + jitter
 */
export function calculateNextRetry(attemptCount: number): Date {
  // Exponential backoff with power of 2
  const delay = Math.min(
    RETRY_CONFIG.baseDelaySeconds * Math.pow(2, attemptCount - 1),
    RETRY_CONFIG.maxDelaySeconds
  )

  // Add jitter to prevent thundering herd
  const jitter = delay * RETRY_CONFIG.jitterPercent * (Math.random() * 2 - 1)
  const finalDelay = delay + jitter

  return new Date(Date.now() + finalDelay * 1000)
}

/**
 * Get retry delay in seconds for a given attempt
 * Useful for logging and debugging
 *
 * @param attemptCount - Current attempt number (1-indexed)
 * @returns Delay in seconds (without jitter)
 */
export function getRetryDelaySeconds(attemptCount: number): number {
  return Math.min(
    RETRY_CONFIG.baseDelaySeconds * Math.pow(2, attemptCount - 1),
    RETRY_CONFIG.maxDelaySeconds
  )
}

/**
 * Format retry delay as human-readable string
 *
 * @param seconds - Delay in seconds
 * @returns Formatted string (e.g., "2m", "1h", "4h")
 */
export function formatRetryDelay(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`
  } else if (seconds < 3600) {
    return `${Math.round(seconds / 60)}m`
  } else {
    return `${Math.round(seconds / 3600)}h`
  }
}
