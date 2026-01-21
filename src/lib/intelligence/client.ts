// src/lib/intelligence/client.ts
/**
 * Intelligence API Client
 *
 * FiskAI communicates with fiskai-intelligence ONLY via this client.
 * The accounting app does not embed regulatory logic - it calls the API.
 *
 * Required environment variables:
 * - INTELLIGENCE_API_BASE_URL: e.g., "https://intelligence.fiskai.hr"
 * - INTELLIGENCE_API_TOKEN: Bearer token for authentication
 */

import {
  IntelligenceNotConfiguredError,
  IntelligenceApiError,
  type RuleResolutionRequest,
  type RuleResolutionResponse,
  type IntelligenceHealthResponse,
} from "./types"

/**
 * Check if Intelligence API is configured.
 */
export function isIntelligenceConfigured(): boolean {
  return Boolean(process.env.INTELLIGENCE_API_BASE_URL && process.env.INTELLIGENCE_API_TOKEN)
}

/**
 * Get Intelligence API configuration.
 * Throws if not configured.
 */
function getConfig(feature: string): { baseUrl: string; token: string } {
  const baseUrl = process.env.INTELLIGENCE_API_BASE_URL
  const token = process.env.INTELLIGENCE_API_TOKEN

  if (!baseUrl || !token) {
    throw new IntelligenceNotConfiguredError(feature)
  }

  return { baseUrl: baseUrl.replace(/\/$/, ""), token }
}

/**
 * Make an authenticated request to the Intelligence API.
 */
async function intelligenceRequest<T>(
  feature: string,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const { baseUrl, token } = getConfig(feature)
  const url = `${baseUrl}${path}`

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error")
    throw new IntelligenceApiError(response.status, errorText)
  }

  return response.json() as Promise<T>
}

/**
 * Resolve a rule version for a given table key and effective date.
 *
 * @param tableKey - The rule table key (e.g., "JOPPD_CODEBOOK", "PER_DIEM")
 * @param effectiveDate - The date for which to resolve the rule
 * @returns The resolved rule version with data
 * @throws IntelligenceNotConfiguredError if API not configured
 * @throws IntelligenceApiError if API call fails
 */
export async function resolveRule(
  tableKey: string,
  effectiveDate: Date
): Promise<RuleResolutionResponse> {
  const request: RuleResolutionRequest = {
    tableKey,
    effectiveDate: effectiveDate.toISOString().split("T")[0],
  }

  return intelligenceRequest<RuleResolutionResponse>("resolveRule", "/v1/rules/resolve", {
    method: "POST",
    body: JSON.stringify(request),
  })
}

/**
 * Check Intelligence API health.
 *
 * @returns Health status if configured and reachable
 * @throws IntelligenceNotConfiguredError if API not configured
 * @throws IntelligenceApiError if API call fails
 */
export async function checkIntelligenceHealth(): Promise<IntelligenceHealthResponse> {
  return intelligenceRequest<IntelligenceHealthResponse>("healthCheck", "/v1/health", {
    method: "GET",
  })
}

/**
 * Check if Intelligence API is configured and reachable.
 * Does not throw - returns status object.
 */
export async function getIntelligenceStatus(): Promise<{
  configured: boolean
  reachable: boolean
  status?: "healthy" | "degraded" | "unhealthy"
  error?: string
}> {
  if (!isIntelligenceConfigured()) {
    return { configured: false, reachable: false }
  }

  try {
    const health = await checkIntelligenceHealth()
    return {
      configured: true,
      reachable: true,
      status: health.status,
    }
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
