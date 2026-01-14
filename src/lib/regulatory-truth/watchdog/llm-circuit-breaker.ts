// src/lib/regulatory-truth/watchdog/llm-circuit-breaker.ts
/**
 * LLM Provider Circuit Breaker
 *
 * Implements the circuit breaker pattern for LLM providers to prevent
 * cascading failures and provide graceful degradation.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit tripped, requests are blocked
 * - HALF_OPEN: Testing if provider recovered, single probe allowed
 *
 * Transitions:
 * - CLOSED -> OPEN: After FAILURE_THRESHOLD consecutive failures
 * - OPEN -> HALF_OPEN: After OPEN_DURATION_MS elapsed
 * - HALF_OPEN -> CLOSED: On success (probe passed)
 * - HALF_OPEN -> OPEN: On failure (probe failed)
 */

import { redis } from "@/lib/regulatory-truth/workers/redis"

export type LLMProvider = "ollama" | "openai" | "deepseek"
export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN"

export interface CircuitBreakerState {
  provider: LLMProvider
  state: CircuitState
  consecutiveFailures: number
  lastFailureAt: number | null
  lastSuccessAt: number | null
  openedAt: number | null
  lastError: string | null
}

const REDIS_KEY_PREFIX = "llm-circuit:"
const FAILURE_THRESHOLD = 5
const OPEN_DURATION_MS = 5 * 60 * 1000 // 5 minutes
const FAILURE_WINDOW_MS = 2 * 60 * 1000 // 2 minutes
const STATE_TTL_SECONDS = 3600 // 1 hour

export class LLMCircuitBreaker {
  private getRedisKey(provider: LLMProvider): string {
    return `${REDIS_KEY_PREFIX}${provider}`
  }

  private getDefaultState(provider: LLMProvider): CircuitBreakerState {
    return {
      provider,
      state: "CLOSED",
      consecutiveFailures: 0,
      lastFailureAt: null,
      lastSuccessAt: null,
      openedAt: null,
      lastError: null,
    }
  }

  async getState(provider: LLMProvider): Promise<CircuitBreakerState> {
    const key = this.getRedisKey(provider)
    const data = await redis.get(key)

    if (!data) {
      return this.getDefaultState(provider)
    }

    let state: CircuitBreakerState
    try {
      state = JSON.parse(data) as CircuitBreakerState
    } catch {
      // Corrupted data in Redis - return default state and clean up
      console.warn(`[llm-circuit] Corrupted state for ${provider}, resetting`)
      await redis.del(key)
      return {
        provider,
        state: "CLOSED",
        consecutiveFailures: 0,
        lastFailureAt: null,
        lastSuccessAt: null,
        openedAt: null,
        lastError: null,
      }
    }

    // Check if OPEN should transition to HALF_OPEN
    if (state.state === "OPEN" && state.openedAt) {
      const elapsed = Date.now() - state.openedAt
      if (elapsed >= OPEN_DURATION_MS) {
        state.state = "HALF_OPEN"
        await this.saveState(provider, state)
      }
    }

    return state
  }

  private async saveState(provider: LLMProvider, state: CircuitBreakerState): Promise<void> {
    const key = this.getRedisKey(provider)
    await redis.set(key, JSON.stringify(state), "EX", STATE_TTL_SECONDS)
  }

  /**
   * Check if a call to the provider is allowed
   * Returns true for CLOSED and HALF_OPEN (probe), false for OPEN
   */
  async canCall(provider: LLMProvider): Promise<boolean> {
    const state = await this.getState(provider)

    if (state.state === "CLOSED") return true
    if (state.state === "HALF_OPEN") return true // Allow probe
    return false // OPEN
  }

  /**
   * Record a successful call to the provider
   * Resets consecutive failures and closes the circuit
   */
  async recordSuccess(provider: LLMProvider): Promise<void> {
    const state = await this.getState(provider)

    state.consecutiveFailures = 0
    state.lastSuccessAt = Date.now()
    state.state = "CLOSED"
    state.openedAt = null
    state.lastError = null

    await this.saveState(provider, state)
    console.log(`[llm-circuit] ${provider} circuit CLOSED after success`)
  }

  /**
   * Record a failed call to the provider
   * Increments consecutive failures and may open the circuit
   */
  async recordFailure(provider: LLMProvider, error: string): Promise<void> {
    const state = await this.getState(provider)
    const now = Date.now()

    // If in HALF_OPEN state and we get a failure, go back to OPEN
    if (state.state === "HALF_OPEN") {
      state.state = "OPEN"
      state.openedAt = now
      state.lastFailureAt = now
      state.lastError = error
      await this.saveState(provider, state)
      console.log(`[llm-circuit] ${provider} circuit re-OPENED after probe failure: ${error}`)
      return
    }

    // Reset counter if last failure was outside the window
    if (state.lastFailureAt && now - state.lastFailureAt > FAILURE_WINDOW_MS) {
      state.consecutiveFailures = 0
    }

    state.consecutiveFailures++
    state.lastFailureAt = now
    state.lastError = error

    // Check if we should open the circuit
    if (state.consecutiveFailures >= FAILURE_THRESHOLD && state.state !== "OPEN") {
      state.state = "OPEN"
      state.openedAt = now
      console.log(
        `[llm-circuit] ${provider} circuit OPEN after ${state.consecutiveFailures} failures: ${error}`
      )
    }

    await this.saveState(provider, state)
  }

  /**
   * Get states for all known providers
   */
  async getAllStates(): Promise<CircuitBreakerState[]> {
    const providers: LLMProvider[] = ["ollama", "openai", "deepseek"]
    return Promise.all(providers.map((p) => this.getState(p)))
  }

  /**
   * Reset the circuit breaker state for a provider
   * Used for manual recovery or testing
   */
  async reset(provider: LLMProvider): Promise<void> {
    const key = this.getRedisKey(provider)
    await redis.del(key)
    console.log(`[llm-circuit] ${provider} circuit RESET`)
  }
}

// Singleton instance
export const llmCircuitBreaker = new LLMCircuitBreaker()
