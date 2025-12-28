import { HEADLINE_STATUSES } from "./types"
import type { HeadlineStatus, RefreshStatus, RefreshQuality } from "./types"
import {
  harvestAll,
  computeDrift,
  DECLARED_COMPONENTS,
  type DriftResult,
} from "@/lib/system-registry"

export interface TopItem {
  id: string
  name: string
  severity: string
  owner?: string
  link?: string
  reason?: string
}

export interface SystemStatusSnapshot {
  headlineStatus: HeadlineStatus
  refreshQuality: RefreshQuality
  criticalCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  observedCount: number
  declaredCount: number
  newDriftSinceDays: number
  lastRefreshStartedAt: Date | null
  lastRefreshEndedAt: Date | null
  lastRefreshStatus: RefreshStatus | null
  lastRefreshError: string | null
  topItems: TopItem[]
}

/**
 * Computes the system status snapshot by running the system registry
 * harvesters and drift computation.
 *
 * This is the core refresh pipeline that:
 * 1. Harvests observed components from the codebase
 * 2. Computes drift against declared components
 * 3. Determines headline status based on critical/high issues
 * 4. Extracts top priority items for the dashboard
 */
export async function computeSystemStatusSnapshot({
  requestedByUserId,
  timeoutSeconds,
}: {
  requestedByUserId: string
  timeoutSeconds: number
}): Promise<SystemStatusSnapshot> {
  const startedAt = new Date()
  let refreshQuality: RefreshQuality = "FULL"
  let refreshStatus: RefreshStatus = "SUCCESS"
  let refreshError: string | null = null

  try {
    // Harvest observed components from codebase
    const projectRoot = process.cwd()
    const harvestResult = await harvestAll(projectRoot)

    // Check for harvester errors (degraded quality)
    if (harvestResult.errors && harvestResult.errors.length > 0) {
      refreshQuality = "DEGRADED"
      console.warn(
        `[system-status] ${harvestResult.errors.length} harvester errors:`,
        harvestResult.errors.map((e) => e.message)
      )
    }

    // Compute drift against declared components
    const driftResult = computeDrift(harvestResult.components, DECLARED_COMPONENTS, projectRoot)

    // Determine headline status based on drift
    const headlineStatus = determineHeadlineStatus(driftResult)

    // Extract counts by severity
    const criticalCount = driftResult.summary.criticalIssues
    const highCount = driftResult.summary.highIssues

    // Count medium and low issues
    const mediumCount = countBySeverity(driftResult, "MEDIUM")
    const lowCount = countBySeverity(driftResult, "LOW")

    // Build top items for dashboard
    const topItems = buildTopItems(driftResult)

    return {
      headlineStatus,
      refreshQuality,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      observedCount: driftResult.summary.observedTotal,
      declaredCount: driftResult.summary.declaredTotal,
      newDriftSinceDays: 7, // This would track new issues since last check
      lastRefreshStartedAt: startedAt,
      lastRefreshEndedAt: new Date(),
      lastRefreshStatus: refreshStatus,
      lastRefreshError: refreshError,
      topItems,
    }
  } catch (error) {
    console.error("[system-status] Refresh failed:", error)
    refreshStatus = "FAILED"
    refreshError = error instanceof Error ? error.message : String(error)

    // Return degraded snapshot on error
    return {
      headlineStatus: "ACTION_REQUIRED",
      refreshQuality: "DEGRADED",
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      observedCount: 0,
      declaredCount: DECLARED_COMPONENTS.length,
      newDriftSinceDays: 7,
      lastRefreshStartedAt: startedAt,
      lastRefreshEndedAt: new Date(),
      lastRefreshStatus: refreshStatus,
      lastRefreshError: refreshError,
      topItems: [],
    }
  }
}

/**
 * Determines the headline status based on drift results.
 * - ACTION_REQUIRED: Any CRITICAL issues
 * - ATTENTION: Any HIGH issues or unknown integrations
 * - OK: No critical or high issues
 */
function determineHeadlineStatus(drift: DriftResult): HeadlineStatus {
  if (drift.summary.criticalIssues > 0) {
    return "ACTION_REQUIRED"
  }
  if (drift.summary.highIssues > 0 || drift.summary.unknownIntegrationCount > 0) {
    return "ATTENTION"
  }
  return "OK"
}

/**
 * Counts issues by severity across all drift categories.
 */
function countBySeverity(drift: DriftResult, severity: "MEDIUM" | "LOW"): number {
  let count = 0

  for (const entry of drift.observedNotDeclared) {
    if (entry.risk === severity) count++
  }
  for (const entry of drift.declaredNotObserved) {
    if (entry.risk === severity) count++
  }
  for (const entry of drift.metadataGaps) {
    if (entry.risk === severity) count++
  }
  for (const entry of drift.codeRefInvalid) {
    if (entry.risk === severity) count++
  }

  return count
}

/**
 * Builds the top priority items for the dashboard.
 * Returns up to 10 items, prioritized by severity.
 */
function buildTopItems(drift: DriftResult): TopItem[] {
  const items: TopItem[] = []

  // Add critical items first
  for (const entry of drift.codeRefInvalid.filter((e) => e.risk === "CRITICAL")) {
    items.push({
      id: entry.componentId,
      name: `${entry.type}: ${entry.componentId}`,
      severity: "CRITICAL",
      reason: entry.reason || "Invalid codeRef path",
      link: `docs/system-registry/drift-report.md#${entry.componentId}`,
    })
  }

  for (const entry of drift.declaredNotObserved.filter((e) => e.risk === "CRITICAL")) {
    items.push({
      id: entry.componentId,
      name: `${entry.type}: ${entry.componentId}`,
      severity: "CRITICAL",
      reason: "Declared but not observed - possible paper registry entry",
      link: `docs/system-registry/drift-report.md#${entry.componentId}`,
    })
  }

  // Add high priority items
  for (const entry of drift.unknownIntegrations) {
    items.push({
      id: entry.componentId,
      name: `Integration: ${entry.componentId}`,
      severity: "HIGH",
      reason: "Unknown integration requires triage",
      link: `docs/system-registry/drift-report.md#${entry.componentId}`,
    })
  }

  for (const entry of drift.codeRefInvalid.filter((e) => e.risk === "HIGH")) {
    items.push({
      id: entry.componentId,
      name: `${entry.type}: ${entry.componentId}`,
      severity: "HIGH",
      reason: entry.reason || "Invalid codeRef path",
      link: `docs/system-registry/drift-report.md#${entry.componentId}`,
    })
  }

  // Limit to 10 items
  return items.slice(0, 10)
}
