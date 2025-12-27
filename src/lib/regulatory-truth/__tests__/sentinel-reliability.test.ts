// src/lib/regulatory-truth/__tests__/sentinel-reliability.test.ts
//
// Tests for Sentinel reliability improvements:
// - Exponential backoff with jitter
// - Timeout handling
// - Health checks
// - Retryable error detection
// - Circuit breaker behavior

import { describe, it, beforeEach, mock } from "node:test"
import assert from "node:assert"
import { isRetryableError, calculateBackoffDelay, DomainRateLimiter } from "../utils/rate-limiter"

describe("Sentinel Reliability", () => {
  describe("isRetryableError", () => {
    it("should identify retryable HTTP status codes", () => {
      // 408 Request Timeout
      assert.strictEqual(isRetryableError(null, 408), true)
      // 429 Too Many Requests
      assert.strictEqual(isRetryableError(null, 429), true)
      // 500 Internal Server Error
      assert.strictEqual(isRetryableError(null, 500), true)
      // 502 Bad Gateway
      assert.strictEqual(isRetryableError(null, 502), true)
      // 503 Service Unavailable
      assert.strictEqual(isRetryableError(null, 503), true)
      // 504 Gateway Timeout
      assert.strictEqual(isRetryableError(null, 504), true)
    })

    it("should identify non-retryable HTTP status codes", () => {
      // 400 Bad Request
      assert.strictEqual(isRetryableError(null, 400), false)
      // 401 Unauthorized
      assert.strictEqual(isRetryableError(null, 401), false)
      // 403 Forbidden
      assert.strictEqual(isRetryableError(null, 403), false)
      // 404 Not Found
      assert.strictEqual(isRetryableError(null, 404), false)
      // 200 OK
      assert.strictEqual(isRetryableError(null, 200), false)
    })

    it("should identify retryable network errors by message", () => {
      assert.strictEqual(isRetryableError(new Error("ECONNRESET")), true)
      assert.strictEqual(isRetryableError(new Error("ETIMEDOUT")), true)
      assert.strictEqual(isRetryableError(new Error("ENOTFOUND")), true)
      assert.strictEqual(isRetryableError(new Error("ECONNREFUSED")), true)
      assert.strictEqual(isRetryableError(new Error("EAI_AGAIN")), true)
      assert.strictEqual(isRetryableError(new Error("socket hang up")), true)
      assert.strictEqual(isRetryableError(new Error("network error")), true)
      assert.strictEqual(isRetryableError(new Error("Request timeout")), true)
    })

    it("should identify non-retryable errors", () => {
      assert.strictEqual(isRetryableError(new Error("Invalid JSON")), false)
      assert.strictEqual(isRetryableError(new Error("Parse error")), false)
      assert.strictEqual(isRetryableError(new Error("Unknown error")), false)
    })

    it("should handle non-Error objects", () => {
      assert.strictEqual(isRetryableError("string error"), false)
      assert.strictEqual(isRetryableError(123), false)
      assert.strictEqual(isRetryableError(null), false)
      assert.strictEqual(isRetryableError(undefined), false)
    })
  })

  describe("calculateBackoffDelay", () => {
    it("should return delay less than or equal to max delay", () => {
      const baseDelay = 1000
      const maxDelay = 30000

      for (let attempt = 0; attempt < 10; attempt++) {
        const delay = calculateBackoffDelay(attempt, baseDelay, maxDelay)
        assert.ok(delay <= maxDelay, `Delay ${delay} exceeds max ${maxDelay}`)
        assert.ok(delay >= 0, `Delay ${delay} should be non-negative`)
      }
    })

    it("should increase average delay with attempt number", () => {
      const baseDelay = 1000
      const maxDelay = 60000
      const samples = 100

      // Calculate average delays for different attempts
      let avgDelay0 = 0
      let avgDelay2 = 0
      let avgDelay4 = 0

      for (let i = 0; i < samples; i++) {
        avgDelay0 += calculateBackoffDelay(0, baseDelay, maxDelay)
        avgDelay2 += calculateBackoffDelay(2, baseDelay, maxDelay)
        avgDelay4 += calculateBackoffDelay(4, baseDelay, maxDelay)
      }

      avgDelay0 /= samples
      avgDelay2 /= samples
      avgDelay4 /= samples

      // Later attempts should have higher average delays
      // Note: With jitter, this is probabilistic, but should hold on average
      assert.ok(
        avgDelay2 > avgDelay0 * 1.5,
        `Attempt 2 delay (${avgDelay2}) should be significantly higher than attempt 0 (${avgDelay0})`
      )
      assert.ok(
        avgDelay4 > avgDelay2 * 1.5,
        `Attempt 4 delay (${avgDelay4}) should be significantly higher than attempt 2 (${avgDelay2})`
      )
    })

    it("should produce different delays (jitter)", () => {
      const baseDelay = 1000
      const maxDelay = 30000
      const attempt = 2
      const samples = 10

      const delays = new Set<number>()
      for (let i = 0; i < samples; i++) {
        delays.add(calculateBackoffDelay(attempt, baseDelay, maxDelay))
      }

      // With jitter, we should get multiple different values
      assert.ok(delays.size > 1, `Expected multiple different delay values, got ${delays.size}`)
    })

    it("should cap at max delay for high attempt numbers", () => {
      const baseDelay = 1000
      const maxDelay = 5000

      // Very high attempt number
      const delay = calculateBackoffDelay(100, baseDelay, maxDelay)
      assert.ok(delay <= maxDelay, `Delay ${delay} exceeds max ${maxDelay}`)
    })
  })

  describe("DomainRateLimiter", () => {
    describe("health status tracking", () => {
      it("should start with healthy status", () => {
        const limiter = new DomainRateLimiter()
        const health = limiter.getHealthStatus()

        assert.strictEqual(health.overallHealthy, true)
        assert.deepStrictEqual(health.domains, {})
      })

      it("should track successful requests", async () => {
        const limiter = new DomainRateLimiter()

        limiter.recordSuccess("example.com")
        limiter.recordSuccess("example.com")

        const health = limiter.getHealthStatus()
        assert.strictEqual(health.domains["example.com"].successRate, 1.0)
        assert.strictEqual(health.domains["example.com"].consecutiveErrors, 0)
        assert.strictEqual(health.domains["example.com"].isHealthy, true)
      })

      it("should track failed requests", () => {
        const limiter = new DomainRateLimiter()

        limiter.recordSuccess("example.com")
        limiter.recordError("example.com", "Connection refused")
        limiter.recordError("example.com", "Timeout")

        const health = limiter.getHealthStatus()
        assert.strictEqual(health.domains["example.com"].successRate, 0.33)
        assert.strictEqual(health.domains["example.com"].consecutiveErrors, 2)
        assert.strictEqual(health.domains["example.com"].lastError, "Timeout")
      })

      it("should reset consecutive errors on success", () => {
        const limiter = new DomainRateLimiter()

        limiter.recordError("example.com", "Error 1")
        limiter.recordError("example.com", "Error 2")
        limiter.recordSuccess("example.com")

        const health = limiter.getHealthStatus()
        assert.strictEqual(health.domains["example.com"].consecutiveErrors, 0)
        assert.strictEqual(health.domains["example.com"].isHealthy, true)
      })

      it("should mark domain unhealthy after 3 consecutive errors", () => {
        const limiter = new DomainRateLimiter()

        limiter.recordError("example.com", "Error 1")
        limiter.recordError("example.com", "Error 2")
        limiter.recordError("example.com", "Error 3")

        const health = limiter.getHealthStatus()
        assert.strictEqual(health.domains["example.com"].isHealthy, false)
        assert.strictEqual(health.overallHealthy, false)
      })
    })

    describe("circuit breaker", () => {
      it("should open circuit breaker after 5 consecutive errors", () => {
        const limiter = new DomainRateLimiter()

        for (let i = 0; i < 5; i++) {
          limiter.recordError("example.com", `Error ${i + 1}`)
        }

        const status = limiter.getStatus("example.com")
        assert.strictEqual(status.isCircuitBroken, true)
        assert.strictEqual(status.consecutiveErrors, 5)
      })

      it("should not open circuit breaker for less than 5 errors", () => {
        const limiter = new DomainRateLimiter()

        for (let i = 0; i < 4; i++) {
          limiter.recordError("example.com", `Error ${i + 1}`)
        }

        const status = limiter.getStatus("example.com")
        assert.strictEqual(status.isCircuitBroken, false)
        assert.strictEqual(status.consecutiveErrors, 4)
      })

      it("should allow manual circuit breaker reset", () => {
        const limiter = new DomainRateLimiter()

        for (let i = 0; i < 5; i++) {
          limiter.recordError("example.com", `Error ${i + 1}`)
        }

        limiter.resetCircuitBreaker("example.com")

        const status = limiter.getStatus("example.com")
        assert.strictEqual(status.isCircuitBroken, false)
        assert.strictEqual(status.consecutiveErrors, 0)
      })
    })

    describe("rate limiting", () => {
      it("should throw when circuit breaker is open", async () => {
        const limiter = new DomainRateLimiter()

        // Open the circuit breaker
        for (let i = 0; i < 5; i++) {
          limiter.recordError("example.com", `Error ${i + 1}`)
        }

        // Should throw when trying to wait for slot
        await assert.rejects(() => limiter.waitForSlot("example.com"), /Circuit breaker open/)
      })
    })

    describe("configuration", () => {
      it("should use default configuration", () => {
        const limiter = new DomainRateLimiter()
        const config = limiter.getConfig()

        assert.strictEqual(config.requestDelayMs, 2000)
        assert.strictEqual(config.maxRequestsPerMinute, 20)
        assert.strictEqual(config.maxRetries, 3)
        assert.strictEqual(config.requestTimeoutMs, 30000)
      })

      it("should allow custom configuration", () => {
        const limiter = new DomainRateLimiter({
          requestDelayMs: 5000,
          maxRetries: 5,
          requestTimeoutMs: 60000,
        })
        const config = limiter.getConfig()

        assert.strictEqual(config.requestDelayMs, 5000)
        assert.strictEqual(config.maxRetries, 5)
        assert.strictEqual(config.requestTimeoutMs, 60000)
      })
    })

    describe("multi-domain tracking", () => {
      it("should track domains independently", () => {
        const limiter = new DomainRateLimiter()

        limiter.recordSuccess("domain1.com")
        limiter.recordSuccess("domain1.com")
        limiter.recordError("domain2.com", "Error")
        limiter.recordError("domain2.com", "Error")
        limiter.recordError("domain2.com", "Error")

        const health = limiter.getHealthStatus()

        assert.strictEqual(health.domains["domain1.com"].isHealthy, true)
        assert.strictEqual(health.domains["domain1.com"].successRate, 1.0)

        assert.strictEqual(health.domains["domain2.com"].isHealthy, false)
        assert.strictEqual(health.domains["domain2.com"].successRate, 0)

        // Overall should be unhealthy because domain2 is unhealthy
        assert.strictEqual(health.overallHealthy, false)
      })

      it("should not affect other domains when one has errors", () => {
        const limiter = new DomainRateLimiter()

        // Open circuit breaker for domain1
        for (let i = 0; i < 5; i++) {
          limiter.recordError("domain1.com", `Error ${i + 1}`)
        }

        // domain2 should still be accessible
        const status1 = limiter.getStatus("domain1.com")
        const status2 = limiter.getStatus("domain2.com")

        assert.strictEqual(status1.isCircuitBroken, true)
        assert.strictEqual(status2.isCircuitBroken, false)
      })
    })
  })

  describe("Integration: Retry behavior simulation", () => {
    it("should simulate successful retry after transient failure", async () => {
      const limiter = new DomainRateLimiter({
        requestDelayMs: 0, // No delay for tests
        baseRetryDelayMs: 10,
        maxRetryDelayMs: 100,
      })

      let attemptCount = 0
      const maxAttempts = 3

      // Simulate a function that fails twice then succeeds
      const fetchWithRetry = async (): Promise<string> => {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          attemptCount++
          try {
            await limiter.waitForSlot("test.com")

            // Fail first two attempts
            if (attempt < 2) {
              limiter.recordError("test.com", "Transient error")
              throw new Error("Transient error")
            }

            // Succeed on third attempt
            limiter.recordSuccess("test.com")
            return "success"
          } catch (error) {
            if (attempt === maxAttempts - 1) throw error
            // Wait for backoff
            await new Promise((resolve) =>
              setTimeout(resolve, calculateBackoffDelay(attempt, 10, 100))
            )
          }
        }
        throw new Error("All retries exhausted")
      }

      const result = await fetchWithRetry()
      assert.strictEqual(result, "success")
      assert.strictEqual(attemptCount, 3)

      // Verify health status shows recovery
      const health = limiter.getHealthStatus()
      assert.strictEqual(health.domains["test.com"].consecutiveErrors, 0)
    })

    it("should exhaust retries and fail", async () => {
      const limiter = new DomainRateLimiter({
        requestDelayMs: 0,
        baseRetryDelayMs: 10,
        maxRetryDelayMs: 100,
      })

      let attemptCount = 0
      const maxAttempts = 3

      // Simulate a function that always fails
      const fetchWithRetry = async (): Promise<string> => {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          attemptCount++
          try {
            await limiter.waitForSlot("test.com")
            limiter.recordError("test.com", "Persistent error")
            throw new Error("Persistent error")
          } catch (error) {
            if (attempt === maxAttempts - 1) throw error
            await new Promise((resolve) =>
              setTimeout(resolve, calculateBackoffDelay(attempt, 10, 100))
            )
          }
        }
        throw new Error("All retries exhausted")
      }

      await assert.rejects(fetchWithRetry, /Persistent error/)
      assert.strictEqual(attemptCount, 3)

      // Verify health status shows errors
      const health = limiter.getHealthStatus()
      assert.strictEqual(health.domains["test.com"].consecutiveErrors, 3)
      assert.strictEqual(health.domains["test.com"].isHealthy, false)
    })
  })
})
