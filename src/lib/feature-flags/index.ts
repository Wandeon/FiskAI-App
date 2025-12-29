/**
 * Feature Flag Management System
 *
 * Centralized feature flag management for FiskAI with:
 * - Database-backed flags with Prisma
 * - Scoped flags (global, tenant, user)
 * - Gradual rollout with percentage-based targeting
 * - Override support with expiration
 * - Full audit logging
 * - React hook for client-side usage
 *
 * @example
 * // Server-side evaluation
 * import { isEnabled, evaluateFlag } from "@/lib/feature-flags"
 *
 * const enabled = await isEnabled("reasoning_ux", { userId: "user123" })
 *
 * // With full evaluation details
 * const result = await evaluateFlag("new_dashboard", { companyId: "company456" })
 * console.log(result.enabled, result.source)
 *
 * @example
 * // Client-side hook (see useFeatureFlag.ts)
 * const { enabled, loading } = useFeatureFlag("reasoning_ux")
 */

// Core service functions
export {
  // Flag retrieval
  getAllFlags,
  getFlagByKey,
  getFlagById,
  listFlags,
  getFlagStats,

  // Flag evaluation
  evaluateFlag,
  evaluateFlags,
  isEnabled,

  // Flag management
  createFlag,
  updateFlag,
  deleteFlag,

  // Override management
  createOverride,
  deleteOverride,
  getCompanyOverrides,
  getUserOverrides,

  // Audit log
  getFlagAuditLog,
  getRecentAuditLog,

  // Utilities
  cleanupExpiredOverrides,
  invalidateCache,
} from "./service"

// Types
export type {
  FeatureFlag,
  FeatureFlagOverride,
  FeatureFlagAuditLog,
  FeatureFlagScope,
  FeatureFlagStatus,
  FeatureFlagAuditAction,
  FeatureFlagWithOverrides,
  FeatureFlagWithRelations,
  FeatureFlagContext,
  FeatureFlagEvaluation,
  CreateFeatureFlagInput,
  UpdateFeatureFlagInput,
  CreateOverrideInput,
  FeatureFlagFilters,
  FeatureFlagStats,
  WellKnownFlagKey,
} from "./types"

export { FEATURE_FLAG_KEYS } from "./types"
