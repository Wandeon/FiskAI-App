// src/lib/intelligence/types.ts
/**
 * Types for Intelligence API client
 *
 * FiskAI communicates with fiskai-intelligence ONLY via HTTP API.
 * These types define the contract.
 */

/**
 * Error thrown when Intelligence API is not configured.
 * FiskAI cannot function for regulatory-dependent features without it.
 */
export class IntelligenceNotConfiguredError extends Error {
  constructor(feature: string) {
    super(
      `Intelligence API not configured. Feature "${feature}" requires INTELLIGENCE_API_BASE_URL and INTELLIGENCE_API_TOKEN environment variables.`
    )
    this.name = "IntelligenceNotConfiguredError"
  }
}

/**
 * Error thrown when Intelligence API call fails.
 */
export class IntelligenceApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(`Intelligence API error (${statusCode}): ${message}`)
    this.name = "IntelligenceApiError"
  }
}

/**
 * JOPPD rule resolution request
 */
export interface JoppdRulesRequest {
  tableKey: "JOPPD_CODEBOOK"
  effectiveDate: string // ISO date
}

/**
 * JOPPD rule resolution response
 */
export interface JoppdRulesResponse {
  ruleVersionId: string
  version: string
  effectiveFrom: string
  data: Record<string, unknown>
}

/**
 * Generic rule resolution request
 */
export interface RuleResolutionRequest {
  tableKey: string
  effectiveDate: string
}

/**
 * Generic rule resolution response
 */
export interface RuleResolutionResponse {
  ruleVersionId: string
  version: string
  effectiveFrom: string
  data: Record<string, unknown>
}

/**
 * Health check response from Intelligence API
 */
export interface IntelligenceHealthResponse {
  status: "healthy" | "degraded" | "unhealthy"
  version?: string
  timestamp: string
}
