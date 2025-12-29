/**
 * Feature Flag Types
 *
 * Centralized type definitions for the feature flag management system.
 */

import type {
  FeatureFlag,
  FeatureFlagOverride,
  FeatureFlagAuditLog,
  FeatureFlagScope,
  FeatureFlagStatus,
  FeatureFlagAuditAction,
} from "@prisma/client"

// Re-export Prisma types for convenience
export type {
  FeatureFlag,
  FeatureFlagOverride,
  FeatureFlagAuditLog,
  FeatureFlagScope,
  FeatureFlagStatus,
  FeatureFlagAuditAction,
}

/**
 * Feature flag with its overrides included
 */
export type FeatureFlagWithOverrides = FeatureFlag & {
  overrides: FeatureFlagOverride[]
}

/**
 * Feature flag with full relations
 */
export type FeatureFlagWithRelations = FeatureFlag & {
  overrides: FeatureFlagOverride[]
  auditLog: FeatureFlagAuditLog[]
}

/**
 * Context for evaluating feature flags
 */
export interface FeatureFlagContext {
  userId?: string
  companyId?: string
}

/**
 * Result of evaluating a feature flag
 */
export interface FeatureFlagEvaluation {
  enabled: boolean
  source: "default" | "rollout" | "override" | "status"
  flag: FeatureFlag | null
  override?: FeatureFlagOverride
}

/**
 * Input for creating a new feature flag
 */
export interface CreateFeatureFlagInput {
  key: string
  name: string
  description?: string
  scope?: FeatureFlagScope
  status?: FeatureFlagStatus
  defaultValue?: boolean
  rolloutPercentage?: number
  category?: string
  tags?: string[]
}

/**
 * Input for updating a feature flag
 */
export interface UpdateFeatureFlagInput {
  name?: string
  description?: string
  scope?: FeatureFlagScope
  status?: FeatureFlagStatus
  defaultValue?: boolean
  rolloutPercentage?: number
  category?: string
  tags?: string[]
}

/**
 * Input for creating a feature flag override
 */
export interface CreateOverrideInput {
  flagId: string
  companyId?: string
  userId?: string
  enabled: boolean
  expiresAt?: Date
}

/**
 * Filters for listing feature flags
 */
export interface FeatureFlagFilters {
  status?: FeatureFlagStatus
  scope?: FeatureFlagScope
  category?: string
  search?: string
}

/**
 * Summary statistics for feature flags
 */
export interface FeatureFlagStats {
  total: number
  active: number
  inactive: number
  archived: number
  byCategory: Record<string, number>
}

/**
 * Well-known feature flag keys for type safety
 */
export const FEATURE_FLAG_KEYS = {
  // AI Features
  AI_ASSISTANT: "ai_assistant",
  REASONING_UX: "reasoning_ux",
  AI_CATEGORIZATION: "ai_categorization",

  // Billing Features
  STRIPE_BILLING: "stripe_billing",
  INVOICE_AUTOPAY: "invoice_autopay",

  // UX Features
  NEW_DASHBOARD: "new_dashboard",
  DARK_MODE: "dark_mode",

  // Experimental
  BETA_FEATURES: "beta_features",
} as const

export type WellKnownFlagKey = (typeof FEATURE_FLAG_KEYS)[keyof typeof FEATURE_FLAG_KEYS]
