// src/lib/intelligence/index.ts
/**
 * Intelligence API Client
 *
 * FiskAI communicates with fiskai-intelligence ONLY via HTTP API.
 * This module provides the client contract.
 */

export {
  IntelligenceNotConfiguredError,
  IntelligenceApiError,
  type RuleResolutionRequest,
  type RuleResolutionResponse,
  type JoppdRulesRequest,
  type JoppdRulesResponse,
  type IntelligenceHealthResponse,
} from "./types"

export {
  isIntelligenceConfigured,
  resolveRule,
  checkIntelligenceHealth,
  getIntelligenceStatus,
} from "./client"
