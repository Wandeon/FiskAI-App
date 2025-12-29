import type { SystemStatusEventType, HeadlineStatus, RefreshStatus, RefreshQuality } from "./types"

/**
 * Minimal interface for snapshot diffing - only includes fields used by diffSnapshots.
 * This allows accepting both the local SystemStatusSnapshot and Prisma model results.
 */
export interface DiffableSnapshot {
  criticalCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  observedCount: number
  declaredCount: number
  refreshQuality: RefreshQuality | string
  lastRefreshStatus: RefreshStatus | string | null
  lastRefreshError: string | null
}

export interface SystemStatusEventInput {
  eventType: SystemStatusEventType
  severity: string
  message: string
  nextAction: string
  componentId?: string
  owner?: string
  link?: string
}

/**
 * Compares two system status snapshots and emits human-readable events
 * for changes that operators need to know about.
 *
 * Supported events:
 * - NEW_CRITICAL: Critical count increased
 * - CRITICAL_RESOLVED: Critical count decreased (issues fixed)
 * - NEW_OBSERVED: Observed count increased significantly
 * - DECLARED_MISSING: Declared count decreased (components removed from registry)
 * - UNKNOWN_INTEGRATION: Unknown integration count increased
 * - REFRESH_FAILED: Last refresh failed
 * - REFRESH_DEGRADED: Refresh quality is degraded
 */
export function diffSnapshots(
  prev: Partial<DiffableSnapshot> | null,
  next: DiffableSnapshot
): SystemStatusEventInput[] {
  const events: SystemStatusEventInput[] = []

  // Handle null previous snapshot (first refresh)
  if (!prev) {
    if (next.criticalCount > 0) {
      events.push({
        eventType: "NEW_CRITICAL",
        severity: "CRITICAL",
        message: `Initial scan found ${next.criticalCount} CRITICAL issue(s)`,
        nextAction: "Review top items and address CRITICAL issues",
      })
    }
    return events
  }

  // NEW_CRITICAL: Critical count increased
  const prevCritical = prev.criticalCount ?? 0
  const nextCritical = next.criticalCount ?? 0
  if (nextCritical > prevCritical) {
    events.push({
      eventType: "NEW_CRITICAL",
      severity: "CRITICAL",
      message: `${nextCritical - prevCritical} new CRITICAL issue(s) detected`,
      nextAction: "Open top item and follow the action",
    })
  }

  // CRITICAL_RESOLVED: Critical count decreased
  if (nextCritical < prevCritical) {
    events.push({
      eventType: "CRITICAL_RESOLVED",
      severity: "INFO",
      message: `${prevCritical - nextCritical} CRITICAL issue(s) resolved`,
      nextAction: "Continue monitoring",
    })
  }

  // NEW_OBSERVED: Significant increase in observed components
  const prevObserved = prev.observedCount ?? 0
  const nextObserved = next.observedCount ?? 0
  const observedDelta = nextObserved - prevObserved
  if (observedDelta > 5) {
    // Threshold for "significant"
    events.push({
      eventType: "NEW_OBSERVED",
      severity: "INFO",
      message: `${observedDelta} new components observed in codebase`,
      nextAction: "Review new components and add to registry if needed",
    })
  }

  // DECLARED_MISSING: Declared count decreased
  const prevDeclared = prev.declaredCount ?? 0
  const nextDeclared = next.declaredCount ?? 0
  if (nextDeclared < prevDeclared) {
    events.push({
      eventType: "DECLARED_MISSING",
      severity: "WARNING",
      message: `${prevDeclared - nextDeclared} component(s) removed from registry`,
      nextAction: "Verify intentional removal or restore declarations",
    })
  }

  // REFRESH_FAILED: Current refresh failed
  if (next.lastRefreshStatus === "FAILED") {
    events.push({
      eventType: "REFRESH_FAILED",
      severity: "ERROR",
      message: `Refresh failed: ${next.lastRefreshError || "Unknown error"}`,
      nextAction: "Check server logs and retry refresh",
    })
  }

  // REFRESH_DEGRADED: Current refresh has degraded quality
  if (next.refreshQuality === "DEGRADED" && prev.refreshQuality !== "DEGRADED") {
    events.push({
      eventType: "REFRESH_DEGRADED",
      severity: "WARNING",
      message: "Refresh completed with degraded quality - some data may be incomplete",
      nextAction: "Check harvester errors and retry if needed",
    })
  }

  return events
}
