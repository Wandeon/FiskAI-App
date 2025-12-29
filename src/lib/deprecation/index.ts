/**
 * Feature Deprecation System
 *
 * Provides lifecycle management for deprecated features including:
 * - Registry of deprecated features with sunset dates
 * - Console warnings in development mode
 * - UI components for user-facing deprecation notices
 * - Admin dashboard for tracking deprecation status
 *
 * @example
 * // Check if a feature is deprecated
 * import { isFeatureDeprecated, getDeprecationInfo } from "@/lib/deprecation"
 *
 * if (isFeatureDeprecated("F036")) {
 *   const info = getDeprecationInfo("F036")
 *   console.log(`Feature ${info?.featureName} is deprecated`)
 * }
 *
 * @example
 * // Warn about deprecated feature usage
 * import { warnDeprecatedRoute } from "@/lib/deprecation"
 *
 * export default function RecurringExpensesPage() {
 *   warnDeprecatedRoute("F036", "/expenses/recurring")
 *   // ...
 * }
 *
 * @example
 * // Deprecate a function
 * import { deprecateFunction } from "@/lib/deprecation"
 *
 * const legacyFunction = deprecateFunction(
 *   originalFunction,
 *   "F036",
 *   "legacyFunction"
 * )
 */

export * from "./types"
export * from "./registry"
export * from "./warnings"

// Re-export commonly used items for convenience
export {
  DEPRECATED_FEATURES,
  getDeprecationInfo,
  isFeatureDeprecated,
  isFeatureSunset,
  getFeaturePhase,
  getFeaturesByPhase,
  getDaysUntilSunset,
  getDeprecationSummary,
  updateDeprecationPhases,
} from "./registry"

export {
  warnDeprecatedFeature,
  deprecateFunction,
  deprecateHook,
  warnDeprecatedRoute,
  warnDeprecatedApi,
  getActiveDeprecationWarnings,
  checkDeprecationsAtStartup,
} from "./warnings"
