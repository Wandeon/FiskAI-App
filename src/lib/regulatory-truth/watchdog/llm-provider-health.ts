// src/lib/regulatory-truth/watchdog/llm-provider-health.ts
/**
 * LLM Provider Health Ping Functions
 *
 * Provides lightweight health checks for Ollama to detect
 * availability, authentication issues, and rate limiting.
 */

import type { LLMProvider } from "./llm-circuit-breaker"

export type HealthStatus = "HEALTHY" | "DEGRADED" | "CRITICAL"
export type ReasonCode = "OK" | "TIMEOUT" | "DNS" | "AUTH" | "5XX" | "RATE_LIMIT" | "UNKNOWN"

export interface ProviderPingResult {
  provider: LLMProvider
  status: HealthStatus
  reasonCode: ReasonCode
  latencyMs: number
  error?: string
  checkedAt: Date
}

const TOTAL_TIMEOUT_MS = 5000

/**
 * Fetch with timeout using AbortController
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timeout)
    return response
  } catch (error) {
    clearTimeout(timeout)
    throw error
  }
}

/**
 * Classify an error or HTTP status into health status and reason code
 */
function classifyError(
  error: unknown,
  statusCode?: number
): { status: HealthStatus; reasonCode: ReasonCode } {
  // HTTP status code based classification
  if (statusCode === 401 || statusCode === 403) {
    return { status: "CRITICAL", reasonCode: "AUTH" }
  }
  if (statusCode === 429) {
    return { status: "DEGRADED", reasonCode: "RATE_LIMIT" }
  }
  if (statusCode && statusCode >= 500) {
    return { status: "CRITICAL", reasonCode: "5XX" }
  }

  // Error message based classification
  const message = error instanceof Error ? error.message.toLowerCase() : ""
  if (message.includes("timeout") || message.includes("abort")) {
    return { status: "CRITICAL", reasonCode: "TIMEOUT" }
  }
  if (message.includes("enotfound") || message.includes("dns")) {
    return { status: "CRITICAL", reasonCode: "DNS" }
  }

  return { status: "CRITICAL", reasonCode: "UNKNOWN" }
}

/**
 * Ping Ollama provider
 *
 * Uses the /api/tags endpoint which is lightweight and
 * available on both local and cloud Ollama instances.
 */
export async function pingOllama(): Promise<ProviderPingResult> {
  const endpoint = process.env.OLLAMA_ENDPOINT || "http://localhost:11434"
  const apiKey = process.env.OLLAMA_API_KEY
  const startTime = Date.now()

  try {
    const response = await fetchWithTimeout(
      `${endpoint}/api/tags`,
      {
        method: "GET",
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      },
      TOTAL_TIMEOUT_MS
    )

    const latencyMs = Date.now() - startTime

    if (response.ok) {
      return {
        provider: "ollama",
        status: "HEALTHY",
        reasonCode: "OK",
        latencyMs,
        checkedAt: new Date(),
      }
    }

    const { status, reasonCode } = classifyError(null, response.status)
    return {
      provider: "ollama",
      status,
      reasonCode,
      latencyMs,
      error: `HTTP ${response.status}`,
      checkedAt: new Date(),
    }
  } catch (error) {
    const latencyMs = Date.now() - startTime
    const { status, reasonCode } = classifyError(error)
    return {
      provider: "ollama",
      status,
      reasonCode,
      latencyMs,
      error: error instanceof Error ? error.message : String(error),
      checkedAt: new Date(),
    }
  }
}

/**
 * Ping all providers
 *
 * Returns results for Ollama provider, useful for
 * health dashboards and failover decisions.
 */
export async function pingAllProviders(): Promise<ProviderPingResult[]> {
  return Promise.all([pingOllama()])
}

/**
 * Determine the currently active LLM provider
 *
 * Returns "ollama" as it's the only supported provider.
 */
export function getActiveProvider(): LLMProvider {
  return "ollama"
}
