/**
 * Feature Deprecation Warnings
 *
 * Console warnings for deprecated feature usage in development mode.
 * These warnings help developers identify and migrate away from deprecated code.
 */

import { getDeprecationInfo, getDaysUntilSunset, DEPRECATED_FEATURES } from "./registry"
import type { DeprecationInfo } from "./types"

/** Track which warnings have been shown to avoid spam */
const shownWarnings = new Set<string>()

/**
 * Show a console warning for deprecated feature usage (dev mode only)
 */
export function warnDeprecatedFeature(featureId: string, context?: string): void {
  // Only warn in development
  if (process.env.NODE_ENV !== "development") return

  const info = getDeprecationInfo(featureId)
  if (!info || !info.showConsoleWarning) return

  // Prevent duplicate warnings per session
  const warningKey = `${featureId}:${context ?? "default"}`
  if (shownWarnings.has(warningKey)) return
  shownWarnings.add(warningKey)

  const daysRemaining = getDaysUntilSunset(featureId)
  const urgency = daysRemaining !== null && daysRemaining <= 30 ? "URGENT" : "WARNING"

  console.warn(
    `[DEPRECATION ${urgency}] ${info.featureName} (${featureId}) is deprecated.\n` +
      `  Reason: ${info.reason}\n` +
      `  Sunset Date: ${info.sunsetDate}` +
      (daysRemaining !== null ? ` (${daysRemaining} days remaining)` : "") +
      `\n` +
      (info.migrationTarget ? `  Migration: Use ${info.migrationTarget} instead\n` : "") +
      (info.migrationDocsUrl ? `  Docs: ${info.migrationDocsUrl}\n` : "") +
      (context ? `  Context: ${context}\n` : "") +
      (info.issueLink ? `  Issue: ${info.issueLink}` : "")
  )
}

/**
 * Create a deprecated function wrapper that logs warnings
 */
export function deprecateFunction<T extends (...args: unknown[]) => unknown>(
  fn: T,
  featureId: string,
  functionName: string
): T {
  return ((...args: unknown[]) => {
    warnDeprecatedFeature(featureId, `Function: ${functionName}()`)
    return fn(...args)
  }) as T
}

/**
 * Create a deprecated hook wrapper that logs warnings on first use
 */
export function deprecateHook<T>(useHook: () => T, featureId: string, hookName: string): () => T {
  return () => {
    warnDeprecatedFeature(featureId, `Hook: ${hookName}`)
    return useHook()
  }
}

/**
 * Log deprecation warning when a route is accessed
 * Use in page components or route handlers
 */
export function warnDeprecatedRoute(featureId: string, route: string): void {
  warnDeprecatedFeature(featureId, `Route: ${route}`)
}

/**
 * Log deprecation warning when an API endpoint is called
 * Use in API route handlers
 */
export function warnDeprecatedApi(featureId: string, endpoint: string): void {
  warnDeprecatedFeature(featureId, `API: ${endpoint}`)
}

/**
 * Get all deprecation warnings that should be shown to developers
 * Useful for displaying in a dev tools panel
 */
export function getActiveDeprecationWarnings(): DeprecationInfo[] {
  return DEPRECATED_FEATURES.filter(
    (d: DeprecationInfo) => d.phase === "deprecated" && d.showConsoleWarning
  )
}

/**
 * Check and warn about deprecated feature usage at app startup
 */
export function checkDeprecationsAtStartup(): void {
  if (process.env.NODE_ENV !== "development") return

  const urgentDeprecations = DEPRECATED_FEATURES.filter((d: DeprecationInfo) => {
    if (d.phase !== "deprecated") return false
    const days = getDaysUntilSunset(d.featureId)
    return days !== null && days <= 14
  })

  if (urgentDeprecations.length > 0) {
    console.warn(
      "\n" +
        "=".repeat(60) +
        "\n" +
        "[DEPRECATION NOTICE] The following features will be sunset soon:\n" +
        urgentDeprecations
          .map((d: DeprecationInfo) => {
            const days = getDaysUntilSunset(d.featureId)
            return `  - ${d.featureName} (${d.featureId}): ${days} days remaining`
          })
          .join("\n") +
        "\n" +
        "=".repeat(60) +
        "\n"
    )
  }
}
