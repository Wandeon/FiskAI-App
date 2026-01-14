// src/lib/regulatory-truth/watchdog/llm-provider-health.ts
/**
 * LLM Provider Health Ping Functions
 *
 * Provides lightweight health checks for LLM providers to detect
 * availability, authentication issues, and rate limiting.
 *
 * Each provider has a dedicated ping function that:
 * - Checks a lightweight endpoint (e.g., /v1/models, /api/tags)
 * - Returns a structured result with status, reason code, and latency
 * - Times out after TOTAL_TIMEOUT_MS to avoid hanging
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
  const endpoint = process.env.OLLAMA_ENDPOINT || "https://ollama.com"
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
 * Ping OpenAI provider
 *
 * Uses the /v1/models endpoint which is lightweight and
 * validates API key authentication.
 */
export async function pingOpenAI(): Promise<ProviderPingResult> {
  const apiKey = process.env.OPENAI_API_KEY
  const startTime = Date.now()

  // Fail fast if no API key configured
  if (!apiKey) {
    return {
      provider: "openai",
      status: "CRITICAL",
      reasonCode: "AUTH",
      latencyMs: 0,
      error: "OPENAI_API_KEY not configured",
      checkedAt: new Date(),
    }
  }

  try {
    const response = await fetchWithTimeout(
      "https://api.openai.com/v1/models",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
      },
      TOTAL_TIMEOUT_MS
    )

    const latencyMs = Date.now() - startTime

    if (response.ok) {
      return {
        provider: "openai",
        status: "HEALTHY",
        reasonCode: "OK",
        latencyMs,
        checkedAt: new Date(),
      }
    }

    const { status, reasonCode } = classifyError(null, response.status)
    return {
      provider: "openai",
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
      provider: "openai",
      status,
      reasonCode,
      latencyMs,
      error: error instanceof Error ? error.message : String(error),
      checkedAt: new Date(),
    }
  }
}

/**
 * Ping DeepSeek provider
 *
 * Uses the /v1/models endpoint which follows OpenAI-compatible API format.
 */
export async function pingDeepSeek(): Promise<ProviderPingResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  const startTime = Date.now()

  // Fail fast if no API key configured
  if (!apiKey) {
    return {
      provider: "deepseek",
      status: "CRITICAL",
      reasonCode: "AUTH",
      latencyMs: 0,
      error: "DEEPSEEK_API_KEY not configured",
      checkedAt: new Date(),
    }
  }

  try {
    const response = await fetchWithTimeout(
      "https://api.deepseek.com/v1/models",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
      },
      TOTAL_TIMEOUT_MS
    )

    const latencyMs = Date.now() - startTime

    if (response.ok) {
      return {
        provider: "deepseek",
        status: "HEALTHY",
        reasonCode: "OK",
        latencyMs,
        checkedAt: new Date(),
      }
    }

    const { status, reasonCode } = classifyError(null, response.status)
    return {
      provider: "deepseek",
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
      provider: "deepseek",
      status,
      reasonCode,
      latencyMs,
      error: error instanceof Error ? error.message : String(error),
      checkedAt: new Date(),
    }
  }
}

/**
 * Ping all providers in parallel
 *
 * Returns results for all three providers, useful for
 * health dashboards and failover decisions.
 */
export async function pingAllProviders(): Promise<ProviderPingResult[]> {
  return Promise.all([pingOllama(), pingOpenAI(), pingDeepSeek()])
}

/**
 * Determine the currently active LLM provider
 *
 * Priority:
 * 1. Explicit NEWS_AI_PROVIDER or AI_PROVIDER env var
 * 2. Inferred from available API keys (ollama > deepseek > openai)
 * 3. Default to ollama if nothing configured
 */
export function getActiveProvider(): LLMProvider {
  // Check explicit provider configuration
  const explicit = (process.env.NEWS_AI_PROVIDER || process.env.AI_PROVIDER || "").toLowerCase()
  if (explicit === "openai") return "openai"
  if (explicit === "deepseek") return "deepseek"
  if (explicit === "ollama") return "ollama"

  // Infer from available API keys
  if (process.env.OLLAMA_API_KEY) return "ollama"
  if (process.env.DEEPSEEK_API_KEY) return "deepseek"
  if (process.env.OPENAI_API_KEY) return "openai"

  // Default to ollama (self-hosted, no API key required)
  return "ollama"
}
