/**
 * Feature Deprecation Registry
 *
 * Central registry for tracking deprecated features. This file should be
 * updated when deprecating features to ensure proper warnings and migration paths.
 *
 * @see docs/02_FEATURES/FEATURE_REGISTRY.md for feature status
 */

import type { DeprecationInfo, DeprecationSummary, FeatureLifecyclePhase } from "./types"

/**
 * Registry of all deprecated features.
 *
 * To deprecate a feature:
 * 1. Add entry here with all required metadata
 * 2. Update FEATURE_REGISTRY.md status to [X]
 * 3. Add DeprecationNotice component to affected routes
 * 4. Document migration path if applicable
 */
export const DEPRECATED_FEATURES: DeprecationInfo[] = [
  // Example entry (commented out - uncomment to test):
  // {
  //   featureId: "F036",
  //   featureName: "Recurring Expenses",
  //   announcedAt: "2025-01-15",
  //   sunsetDate: "2025-04-15",
  //   phase: "deprecated",
  //   reason: "Feature never fully implemented. Use manual expense creation instead.",
  //   owner: "team:finance",
  //   showBanner: true,
  //   showConsoleWarning: true,
  // },
]

/**
 * Get deprecation info for a feature by ID
 */
export function getDeprecationInfo(featureId: string): DeprecationInfo | null {
  return DEPRECATED_FEATURES.find((d) => d.featureId === featureId) ?? null
}

/**
 * Check if a feature is deprecated (any phase except active)
 */
export function isFeatureDeprecated(featureId: string): boolean {
  const info = getDeprecationInfo(featureId)
  return info !== null && info.phase !== "active"
}

/**
 * Check if a feature has been sunset (removed)
 */
export function isFeatureSunset(featureId: string): boolean {
  const info = getDeprecationInfo(featureId)
  return info?.phase === "sunset"
}

/**
 * Get the current lifecycle phase for a feature
 */
export function getFeaturePhase(featureId: string): FeatureLifecyclePhase {
  const info = getDeprecationInfo(featureId)
  return info?.phase ?? "active"
}

/**
 * Get all features in a specific phase
 */
export function getFeaturesByPhase(phase: FeatureLifecyclePhase): DeprecationInfo[] {
  return DEPRECATED_FEATURES.filter((d) => d.phase === phase)
}

/**
 * Calculate days until sunset for a deprecated feature
 */
export function getDaysUntilSunset(featureId: string): number | null {
  const info = getDeprecationInfo(featureId)
  if (!info || info.phase === "sunset") return null

  const sunset = new Date(info.sunsetDate)
  const today = new Date()
  const diffTime = sunset.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

/**
 * Get deprecation summary for admin dashboard
 */
export function getDeprecationSummary(): DeprecationSummary {
  const now = new Date()
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const deprecated = DEPRECATED_FEATURES.filter((d) => d.phase === "deprecated")
  const sunset = DEPRECATED_FEATURES.filter((d) => d.phase === "sunset")

  const upcomingSunsets = deprecated
    .filter((d) => {
      const sunsetDate = new Date(d.sunsetDate)
      return sunsetDate >= now && sunsetDate <= thirtyDaysFromNow
    })
    .map((d) => ({
      featureId: d.featureId,
      featureName: d.featureName,
      sunsetDate: d.sunsetDate,
      daysRemaining: getDaysUntilSunset(d.featureId) ?? 0,
    }))
    .sort((a, b) => a.daysRemaining - b.daysRemaining)

  const recentlySunset = sunset
    .filter((d) => {
      const sunsetDate = new Date(d.sunsetDate)
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      return sunsetDate >= thirtyDaysAgo && sunsetDate <= now
    })
    .map((d) => ({
      featureId: d.featureId,
      featureName: d.featureName,
      sunsetDate: d.sunsetDate,
    }))

  return {
    totalDeprecated: deprecated.length,
    upcomingSunsets,
    recentlySunset,
    usageStats: [], // To be populated by usage tracking
  }
}

/**
 * Auto-update phase based on sunset date
 * Call this at app startup or via cron to auto-transition phases
 */
export function updateDeprecationPhases(): void {
  const now = new Date()

  for (const feature of DEPRECATED_FEATURES) {
    if (feature.phase === "deprecated") {
      const sunsetDate = new Date(feature.sunsetDate)
      if (now >= sunsetDate) {
        // Note: In production, this would update a database record
        // For now, we log a warning that manual update is needed
        console.warn(
          `[DEPRECATION] Feature ${feature.featureId} (${feature.featureName}) ` +
            `has passed its sunset date (${feature.sunsetDate}). ` +
            `Update phase to "sunset" in registry.ts`
        )
      }
    }
  }
}
