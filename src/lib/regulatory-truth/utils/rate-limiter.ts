// src/lib/regulatory-truth/utils/rate-limiter.ts

interface RateLimitConfig {
  requestDelayMs: number
  maxRequestsPerMinute: number
  maxConcurrentRequests: number
  // Retry configuration
  maxRetries: number
  baseRetryDelayMs: number
  maxRetryDelayMs: number
  // Timeout configuration
  requestTimeoutMs: number
}

interface DomainStats {
  lastRequestAt: number
  requestsThisMinute: number
  consecutiveErrors: number
  isCircuitBroken: boolean
  circuitBrokenAt?: number
  // Health tracking
  totalRequests: number
  successfulRequests: number
  lastSuccessAt?: number
  lastErrorMessage?: string
}

const DEFAULT_CONFIG: RateLimitConfig = {
  requestDelayMs: 2000, // 2 seconds between requests
  maxRequestsPerMinute: 20,
  maxConcurrentRequests: 1,
  // Retry defaults
  maxRetries: 3,
  baseRetryDelayMs: 1000,
  maxRetryDelayMs: 30000,
  // Timeout defaults
  requestTimeoutMs: 30000, // 30 seconds
}

const CIRCUIT_BREAKER_THRESHOLD = 5
const CIRCUIT_BREAKER_RESET_MS = 60 * 60 * 1000 // 1 hour

// Retryable error patterns
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504])
const RETRYABLE_ERROR_MESSAGES = [
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "socket hang up",
  "network",
  "timeout",
]

/**
 * Check if an error is retryable based on status code or error message.
 */
export function isRetryableError(error: unknown, statusCode?: number): boolean {
  // Check status code
  if (statusCode && RETRYABLE_STATUS_CODES.has(statusCode)) {
    return true
  }

  // Check error message patterns
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase()
    return RETRYABLE_ERROR_MESSAGES.some((pattern) => errorMessage.includes(pattern.toLowerCase()))
  }

  return false
}

/**
 * Calculate exponential backoff delay with jitter.
 * Uses full jitter strategy: delay = random(0, min(maxDelay, baseDelay * 2^attempt))
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  // Exponential component: baseDelay * 2^attempt
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt)

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs)

  // Add full jitter: random value between 0 and cappedDelay
  const jitter = Math.random() * cappedDelay

  return Math.floor(jitter)
}

class DomainRateLimiter {
  private domainStats: Map<string, DomainStats> = new Map()
  private config: RateLimitConfig

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  private getStats(domain: string): DomainStats {
    if (!this.domainStats.has(domain)) {
      this.domainStats.set(domain, {
        lastRequestAt: 0,
        requestsThisMinute: 0,
        consecutiveErrors: 0,
        isCircuitBroken: false,
        totalRequests: 0,
        successfulRequests: 0,
      })
    }
    return this.domainStats.get(domain)!
  }

  /**
   * Get health status for all tracked domains.
   */
  getHealthStatus(): {
    domains: Record<
      string,
      {
        isHealthy: boolean
        successRate: number
        consecutiveErrors: number
        isCircuitBroken: boolean
        lastSuccessAt?: string
        lastError?: string
      }
    >
    overallHealthy: boolean
  } {
    const domains: Record<
      string,
      {
        isHealthy: boolean
        successRate: number
        consecutiveErrors: number
        isCircuitBroken: boolean
        lastSuccessAt?: string
        lastError?: string
      }
    > = {}
    let hasUnhealthyDomain = false

    for (const [domain, stats] of this.domainStats.entries()) {
      const successRate =
        stats.totalRequests > 0 ? stats.successfulRequests / stats.totalRequests : 1
      const isHealthy = !stats.isCircuitBroken && stats.consecutiveErrors < 3

      if (!isHealthy) {
        hasUnhealthyDomain = true
      }

      domains[domain] = {
        isHealthy,
        successRate: Math.round(successRate * 100) / 100,
        consecutiveErrors: stats.consecutiveErrors,
        isCircuitBroken: stats.isCircuitBroken,
        lastSuccessAt: stats.lastSuccessAt
          ? new Date(stats.lastSuccessAt).toISOString()
          : undefined,
        lastError: stats.lastErrorMessage,
      }
    }

    return {
      domains,
      overallHealthy: !hasUnhealthyDomain,
    }
  }

  async waitForSlot(domain: string): Promise<void> {
    const stats = this.getStats(domain)

    // Check circuit breaker
    if (stats.isCircuitBroken) {
      const timeSinceBroken = Date.now() - (stats.circuitBrokenAt || 0)
      if (timeSinceBroken < CIRCUIT_BREAKER_RESET_MS) {
        throw new Error(
          `Circuit breaker open for ${domain}. Resets in ${Math.round((CIRCUIT_BREAKER_RESET_MS - timeSinceBroken) / 1000 / 60)} minutes`
        )
      }
      // Auto-reset circuit breaker
      stats.isCircuitBroken = false
      stats.consecutiveErrors = 0
    }

    // Wait for rate limit delay
    const timeSinceLastRequest = Date.now() - stats.lastRequestAt
    if (timeSinceLastRequest < this.config.requestDelayMs) {
      const waitTime = this.config.requestDelayMs - timeSinceLastRequest
      await this.delay(waitTime)
    }

    stats.lastRequestAt = Date.now()
    stats.requestsThisMinute++
  }

  recordSuccess(domain: string): void {
    const stats = this.getStats(domain)
    stats.consecutiveErrors = 0
    stats.totalRequests++
    stats.successfulRequests++
    stats.lastSuccessAt = Date.now()
  }

  recordError(domain: string, errorMessage?: string): void {
    const stats = this.getStats(domain)
    stats.consecutiveErrors++
    stats.totalRequests++
    stats.lastErrorMessage = errorMessage

    if (stats.consecutiveErrors >= CIRCUIT_BREAKER_THRESHOLD) {
      stats.isCircuitBroken = true
      stats.circuitBrokenAt = Date.now()
      console.log(
        `[rate-limiter] Circuit breaker OPEN for ${domain} after ${stats.consecutiveErrors} consecutive errors`
      )
    }
  }

  /**
   * Get the configuration for use in retry logic.
   */
  getConfig(): RateLimitConfig {
    return { ...this.config }
  }

  resetCircuitBreaker(domain: string): void {
    const stats = this.getStats(domain)
    stats.isCircuitBroken = false
    stats.consecutiveErrors = 0
    console.log(`[rate-limiter] Circuit breaker RESET for ${domain}`)
  }

  getStatus(domain: string): { isCircuitBroken: boolean; consecutiveErrors: number } {
    const stats = this.getStats(domain)
    return {
      isCircuitBroken: stats.isCircuitBroken,
      consecutiveErrors: stats.consecutiveErrors,
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// Singleton instance
export const rateLimiter = new DomainRateLimiter()

/**
 * Fetch options with retry configuration.
 */
export interface FetchWithRetryOptions extends RequestInit {
  maxRetries?: number
  baseRetryDelayMs?: number
  maxRetryDelayMs?: number
  timeoutMs?: number
  onRetry?: (attempt: number, error: Error, delay: number) => void
}

/**
 * Create an AbortController with a timeout.
 */
function createTimeoutController(timeoutMs: number): {
  controller: AbortController
  timeoutId: NodeJS.Timeout
} {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Request timeout after ${timeoutMs}ms`))
  }, timeoutMs)

  return { controller, timeoutId }
}

/**
 * Helper function for fetching with rate limiting, retry logic, and timeout.
 * Implements exponential backoff with jitter for transient failures.
 */
export async function fetchWithRateLimit(
  url: string,
  options?: FetchWithRetryOptions
): Promise<Response> {
  const domain = new URL(url).hostname
  const config = rateLimiter.getConfig()

  const maxRetries = options?.maxRetries ?? config.maxRetries
  const baseRetryDelayMs = options?.baseRetryDelayMs ?? config.baseRetryDelayMs
  const maxRetryDelayMs = options?.maxRetryDelayMs ?? config.maxRetryDelayMs
  const timeoutMs = options?.timeoutMs ?? config.requestTimeoutMs

  let lastError: Error | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Wait for rate limit slot
    await rateLimiter.waitForSlot(domain)

    // Create timeout controller
    const { controller, timeoutId } = createTimeoutController(timeoutMs)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "User-Agent": "FiskAI/1.0 (regulatory-monitoring; +https://fiskai.hr)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
          "Accept-Language": "hr,en;q=0.9",
          ...options?.headers,
        },
      })

      // Clear timeout on success
      clearTimeout(timeoutId)

      if (response.ok) {
        rateLimiter.recordSuccess(domain)
        return response
      }

      // Check if this is a retryable status code
      if (isRetryableError(null, response.status) && attempt < maxRetries) {
        const errorMsg = `HTTP ${response.status}: ${response.statusText}`
        lastError = new Error(errorMsg)
        rateLimiter.recordError(domain, errorMsg)

        const delay = calculateBackoffDelay(attempt, baseRetryDelayMs, maxRetryDelayMs)
        console.log(
          `[rate-limiter] Retryable error for ${domain}: ${errorMsg}. ` +
            `Retry ${attempt + 1}/${maxRetries} in ${delay}ms`
        )

        options?.onRetry?.(attempt + 1, lastError, delay)
        await rateLimiter["delay"](delay)
        continue
      }

      // Non-retryable response or exhausted retries
      if (response.status >= 400) {
        rateLimiter.recordError(domain, `HTTP ${response.status}`)
      }

      return response
    } catch (error) {
      // Clear timeout on error
      clearTimeout(timeoutId)

      const errorMessage = error instanceof Error ? error.message : String(error)
      lastError = error instanceof Error ? error : new Error(errorMessage)

      // Check if this is a retryable error
      if (isRetryableError(error) && attempt < maxRetries) {
        rateLimiter.recordError(domain, errorMessage)

        const delay = calculateBackoffDelay(attempt, baseRetryDelayMs, maxRetryDelayMs)
        console.log(
          `[rate-limiter] Retryable network error for ${domain}: ${errorMessage}. ` +
            `Retry ${attempt + 1}/${maxRetries} in ${delay}ms`
        )

        options?.onRetry?.(attempt + 1, lastError, delay)
        await rateLimiter["delay"](delay)
        continue
      }

      // Non-retryable error or exhausted retries
      rateLimiter.recordError(domain, errorMessage)
      throw error
    }
  }

  // Should not reach here, but if we do, throw the last error
  throw lastError || new Error(`Failed to fetch ${url} after ${maxRetries} retries`)
}

/**
 * Check sentinel health status for all tracked domains.
 */
export function getSentinelHealth(): {
  domains: Record<
    string,
    {
      isHealthy: boolean
      successRate: number
      consecutiveErrors: number
      isCircuitBroken: boolean
      lastSuccessAt?: string
      lastError?: string
    }
  >
  overallHealthy: boolean
} {
  return rateLimiter.getHealthStatus()
}

export { DomainRateLimiter }
