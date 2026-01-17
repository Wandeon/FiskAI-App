// src/lib/regulatory-truth/watchdog/llm-circuit-breaker.ts
/**
 * LLM Provider Circuit Breaker
 *
 * MIGRATION NOTE: The circuit breaker implementation has been moved to @/lib/infra/circuit-breaker
 * to enable sharing between app and workers without cross-repo dependencies.
 *
 * This file re-exports from the shared location for backwards compatibility.
 * New code should import directly from @/lib/infra/circuit-breaker.
 */

// Re-export all circuit breaker functionality from shared infra module
export {
  type LLMProvider,
  type CircuitState,
  type CircuitBreakerState,
  LLMCircuitBreaker,
  llmCircuitBreaker,
} from "@/lib/infra/circuit-breaker"
