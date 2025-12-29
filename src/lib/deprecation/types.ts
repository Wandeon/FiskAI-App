/**
 * Feature Deprecation Types
 *
 * Defines the lifecycle states and metadata for deprecated features.
 * Used by the deprecation registry and UI components.
 */

/**
 * Lifecycle phase for a feature
 */
export type FeatureLifecyclePhase =
  | "active" // Feature is fully supported
  | "deprecated" // Feature is deprecated, sunset date announced
  | "sunset" // Feature has been removed/disabled

/**
 * Deprecation metadata for a feature
 */
export interface DeprecationInfo {
  /** Feature ID (matches FEATURE_REGISTRY.md) */
  featureId: string
  /** Human-readable feature name */
  featureName: string
  /** When deprecation was announced (ISO date) */
  announcedAt: string
  /** When the feature will be/was removed (ISO date) */
  sunsetDate: string
  /** Current lifecycle phase */
  phase: FeatureLifecyclePhase
  /** Reason for deprecation */
  reason: string
  /** Feature ID or path to migrate to (if applicable) */
  migrationTarget?: string
  /** URL to migration documentation */
  migrationDocsUrl?: string
  /** Team responsible for the deprecation */
  owner: string
  /** GitHub issue or discussion link */
  issueLink?: string
  /** Show UI warning banner to users */
  showBanner: boolean
  /** Show console warning in development */
  showConsoleWarning: boolean
}

/**
 * Deprecation notice display options
 */
export interface DeprecationNoticeOptions {
  /** How prominent the notice should be */
  prominence: "inline" | "banner" | "modal"
  /** Whether the notice can be dismissed */
  dismissible: boolean
  /** Storage key for dismissal state */
  dismissKey?: string
}

/**
 * Feature usage event for tracking
 */
export interface FeatureUsageEvent {
  featureId: string
  timestamp: Date
  userId?: string
  companyId?: string
  route: string
  action: "view" | "interact" | "api_call"
}

/**
 * Deprecation summary for admin dashboard
 */
export interface DeprecationSummary {
  totalDeprecated: number
  upcomingSunsets: Array<{
    featureId: string
    featureName: string
    sunsetDate: string
    daysRemaining: number
  }>
  recentlySunset: Array<{
    featureId: string
    featureName: string
    sunsetDate: string
  }>
  usageStats: Array<{
    featureId: string
    featureName: string
    usageCount: number
    lastUsed: string | null
  }>
}
