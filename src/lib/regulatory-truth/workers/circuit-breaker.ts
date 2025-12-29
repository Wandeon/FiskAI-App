// src/lib/regulatory-truth/workers/circuit-breaker.ts
import CircuitBreaker from "opossum"

interface CircuitBreakerOptions {
  timeout?: number
  errorThresholdPercentage?: number
  resetTimeout?: number
  name: string
}

const breakers = new Map<string, CircuitBreaker>()

export function createCircuitBreaker<T>(
  fn: (...args: unknown[]) => Promise<T>,
  options: CircuitBreakerOptions
): CircuitBreaker {
  if (breakers.has(options.name)) {
    return breakers.get(options.name)!
  }

  const breaker = new CircuitBreaker(fn, {
    timeout: options.timeout ?? 60000,
    errorThresholdPercentage: options.errorThresholdPercentage ?? 50,
    resetTimeout: options.resetTimeout ?? 300000, // 5 min
    name: options.name,
  })

  breaker.on("open", () => {
    console.warn(`[circuit-breaker] ${options.name} OPENED - requests will fail fast`)
  })

  breaker.on("halfOpen", () => {
    console.info(`[circuit-breaker] ${options.name} HALF-OPEN - testing recovery`)
  })

  breaker.on("close", () => {
    console.info(`[circuit-breaker] ${options.name} CLOSED - back to normal`)
  })

  breakers.set(options.name, breaker)
  return breaker
}

export function getCircuitBreakerStatus(): Record<string, { state: string; stats: object }> {
  const status: Record<string, { state: string; stats: object }> = {}
  for (const [name, breaker] of breakers) {
    status[name] = {
      state: breaker.opened ? "open" : breaker.halfOpen ? "halfOpen" : "closed",
      stats: breaker.stats,
    }
  }
  return status
}

/**
 * Manually reset a circuit breaker by name.
 * This forces the circuit breaker back to closed state, allowing requests to pass through.
 * Use this for manual intervention after transient issues are resolved.
 */
export function resetCircuitBreaker(name: string): boolean {
  const breaker = breakers.get(name)
  if (!breaker) {
    return false
  }

  // Close the circuit breaker and clear stats
  breaker.close()
  console.log(`[circuit-breaker] Manual reset for ${name}`)
  return true
}

/**
 * Reset all circuit breakers.
 * Returns the list of breakers that were reset.
 */
export function resetAllCircuitBreakers(): string[] {
  const resetNames: string[] = []
  for (const [name, breaker] of breakers) {
    if (breaker.opened || breaker.halfOpen) {
      breaker.close()
      resetNames.push(name)
    }
  }
  if (resetNames.length > 0) {
    console.log(`[circuit-breaker] Manual reset for all breakers: ${resetNames.join(", ")}`)
  }
  return resetNames
}
