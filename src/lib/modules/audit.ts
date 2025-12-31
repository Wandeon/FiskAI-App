/**
 * Module Entitlement Audit System
 *
 * Provides comprehensive audit logging for all entitlement changes,
 * enabling compliance tracking and change history.
 */

import type { ModuleKey } from "./definitions"
import type { CompanyEntitlements, ModuleEntitlement, PermissionAction } from "./permissions"

/**
 * Types of entitlement changes that can be audited
 */
export const ENTITLEMENT_CHANGE_TYPES = [
  "MODULE_ENABLED",
  "MODULE_DISABLED",
  "PERMISSIONS_UPDATED",
  "TRIAL_STARTED",
  "TRIAL_EXPIRED",
  "PLAN_UPGRADED",
  "PLAN_DOWNGRADED",
  "ENTITLEMENTS_MIGRATED",
  "MANUAL_OVERRIDE",
] as const

export type EntitlementChangeType = (typeof ENTITLEMENT_CHANGE_TYPES)[number]

/**
 * Audit log entry for entitlement changes
 */
export interface EntitlementAuditEntry {
  id: string
  companyId: string
  userId: string
  changeType: EntitlementChangeType
  moduleKey?: ModuleKey
  previousValue?: Partial<ModuleEntitlement> | null
  newValue?: Partial<ModuleEntitlement> | null
  previousPlan?: string
  newPlan?: string
  reason?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  createdAt: Date
}

/**
 * Input for creating an audit entry
 */
export interface CreateAuditEntryInput {
  companyId: string
  userId: string
  changeType: EntitlementChangeType
  moduleKey?: ModuleKey
  previousValue?: Partial<ModuleEntitlement> | null
  newValue?: Partial<ModuleEntitlement> | null
  previousPlan?: string
  newPlan?: string
  reason?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

/**
 * Generate a unique audit entry ID
 */
function generateAuditId(): string {
  return `ent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Create an audit entry for an entitlement change
 */
export function createAuditEntry(input: CreateAuditEntryInput): EntitlementAuditEntry {
  return {
    id: generateAuditId(),
    ...input,
    createdAt: new Date(),
  }
}

/**
 * Detect changes between two entitlement states
 */
export function detectEntitlementChanges(
  previous: CompanyEntitlements | null,
  current: CompanyEntitlements,
  userId: string,
  companyId: string,
  metadata?: { ipAddress?: string; userAgent?: string; reason?: string }
): EntitlementAuditEntry[] {
  const entries: EntitlementAuditEntry[] = []
  const previousModules = previous?.modules ?? {}
  const currentModules = current.modules

  // Check for plan changes
  if (previous?.subscriptionPlan !== current.subscriptionPlan) {
    const isPlanUpgrade = comparePlans(previous?.subscriptionPlan, current.subscriptionPlan) > 0

    entries.push(
      createAuditEntry({
        companyId,
        userId,
        changeType: isPlanUpgrade ? "PLAN_UPGRADED" : "PLAN_DOWNGRADED",
        previousPlan: previous?.subscriptionPlan,
        newPlan: current.subscriptionPlan,
        reason: metadata?.reason,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      })
    )
  }

  // Get all unique module keys from both states
  const allModuleKeys = Array.from(
    new Set([...Object.keys(previousModules), ...Object.keys(currentModules)])
  ) as ModuleKey[]

  for (const moduleKey of allModuleKeys) {
    const prev = previousModules[moduleKey]
    const curr = currentModules[moduleKey]

    // Module was disabled (removed)
    if (prev && !curr) {
      entries.push(
        createAuditEntry({
          companyId,
          userId,
          changeType: "MODULE_DISABLED",
          moduleKey,
          previousValue: prev,
          newValue: null,
          reason: metadata?.reason,
          ipAddress: metadata?.ipAddress,
          userAgent: metadata?.userAgent,
        })
      )
      continue
    }

    // Module was enabled (added)
    if (!prev && curr) {
      const changeType = curr.expiresAt ? "TRIAL_STARTED" : "MODULE_ENABLED"
      entries.push(
        createAuditEntry({
          companyId,
          userId,
          changeType,
          moduleKey,
          previousValue: null,
          newValue: curr,
          reason: metadata?.reason ?? curr.reason,
          ipAddress: metadata?.ipAddress,
          userAgent: metadata?.userAgent,
          metadata: curr.expiresAt ? { trialExpiresAt: curr.expiresAt } : undefined,
        })
      )
      continue
    }

    // Module exists in both - check for permission changes
    if (prev && curr) {
      const permissionsChanged = !arraysEqual(prev.permissions, curr.permissions)
      const expirationChanged =
        (prev.expiresAt?.toString() ?? null) !== (curr.expiresAt?.toString() ?? null)

      if (permissionsChanged || expirationChanged) {
        entries.push(
          createAuditEntry({
            companyId,
            userId,
            changeType: "PERMISSIONS_UPDATED",
            moduleKey,
            previousValue: prev,
            newValue: curr,
            reason: metadata?.reason,
            ipAddress: metadata?.ipAddress,
            userAgent: metadata?.userAgent,
            metadata: {
              permissionsAdded: curr.permissions.filter(
                (p: PermissionAction) => !prev.permissions.includes(p)
              ),
              permissionsRemoved: prev.permissions.filter(
                (p: PermissionAction) => !curr.permissions.includes(p)
              ),
            },
          })
        )
      }
    }
  }

  return entries
}

/**
 * Compare subscription plans to determine if it's an upgrade or downgrade
 * Returns positive if newPlan > oldPlan (upgrade), negative if downgrade
 */
function comparePlans(oldPlan?: string, newPlan?: string): number {
  const planRanks: Record<string, number> = {
    free: 0,
    starter: 1,
    professional: 2,
    enterprise: 3,
  }

  const oldRank = planRanks[oldPlan ?? "free"] ?? 0
  const newRank = planRanks[newPlan ?? "free"] ?? 0

  return newRank - oldRank
}

/**
 * Helper to compare arrays for equality
 */
function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((val, idx) => val === sortedB[idx])
}

/**
 * Format an audit entry for display
 */
export function formatAuditEntry(entry: EntitlementAuditEntry): string {
  const timestamp = entry.createdAt.toISOString()

  switch (entry.changeType) {
    case "MODULE_ENABLED":
      return `[${timestamp}] Module "${entry.moduleKey}" enabled by ${entry.userId}${entry.reason ? ` - ${entry.reason}` : ""}`

    case "MODULE_DISABLED":
      return `[${timestamp}] Module "${entry.moduleKey}" disabled by ${entry.userId}${entry.reason ? ` - ${entry.reason}` : ""}`

    case "PERMISSIONS_UPDATED":
      const meta = entry.metadata as { permissionsAdded?: string[]; permissionsRemoved?: string[] }
      const added = meta?.permissionsAdded?.join(", ") ?? ""
      const removed = meta?.permissionsRemoved?.join(", ") ?? ""
      return `[${timestamp}] Permissions updated for "${entry.moduleKey}" by ${entry.userId}. Added: [${added}], Removed: [${removed}]`

    case "TRIAL_STARTED":
      const trialMeta = entry.metadata as { trialExpiresAt?: Date }
      return `[${timestamp}] Trial started for "${entry.moduleKey}" by ${entry.userId}, expires: ${trialMeta?.trialExpiresAt}`

    case "TRIAL_EXPIRED":
      return `[${timestamp}] Trial expired for "${entry.moduleKey}"`

    case "PLAN_UPGRADED":
      return `[${timestamp}] Plan upgraded from "${entry.previousPlan}" to "${entry.newPlan}" by ${entry.userId}`

    case "PLAN_DOWNGRADED":
      return `[${timestamp}] Plan downgraded from "${entry.previousPlan}" to "${entry.newPlan}" by ${entry.userId}`

    case "ENTITLEMENTS_MIGRATED":
      return `[${timestamp}] Entitlements migrated to v2 format by ${entry.userId}`

    case "MANUAL_OVERRIDE":
      return `[${timestamp}] Manual entitlement override for "${entry.moduleKey}" by ${entry.userId}${entry.reason ? ` - ${entry.reason}` : ""}`

    default:
      return `[${timestamp}] ${entry.changeType} by ${entry.userId}`
  }
}

/**
 * Query filter for audit entries
 */
export interface AuditQueryFilter {
  companyId?: string
  userId?: string
  moduleKey?: ModuleKey
  changeTypes?: EntitlementChangeType[]
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}

/**
 * Filter audit entries based on query criteria
 */
export function filterAuditEntries(
  entries: EntitlementAuditEntry[],
  filter: AuditQueryFilter
): EntitlementAuditEntry[] {
  let result = entries

  if (filter.companyId) {
    result = result.filter((e) => e.companyId === filter.companyId)
  }

  if (filter.userId) {
    result = result.filter((e) => e.userId === filter.userId)
  }

  if (filter.moduleKey) {
    result = result.filter((e) => e.moduleKey === filter.moduleKey)
  }

  if (filter.changeTypes && filter.changeTypes.length > 0) {
    result = result.filter((e) => filter.changeTypes!.includes(e.changeType))
  }

  if (filter.startDate) {
    result = result.filter((e) => e.createdAt >= filter.startDate!)
  }

  if (filter.endDate) {
    result = result.filter((e) => e.createdAt <= filter.endDate!)
  }

  // Sort by createdAt descending (newest first)
  result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  // Apply pagination
  const offset = filter.offset ?? 0
  const limit = filter.limit ?? 100

  return result.slice(offset, offset + limit)
}

/**
 * Summary of audit entries for reporting
 */
export interface AuditSummary {
  totalChanges: number
  changesByType: Record<EntitlementChangeType, number>
  changesByModule: Record<ModuleKey, number>
  uniqueUsers: number
  dateRange: { start: Date; end: Date } | null
}

/**
 * Generate a summary of audit entries
 */
export function summarizeAuditEntries(entries: EntitlementAuditEntry[]): AuditSummary {
  const changesByType = {} as Record<EntitlementChangeType, number>
  const changesByModule = {} as Record<ModuleKey, number>
  const uniqueUsers = new Set<string>()
  let minDate: Date | null = null
  let maxDate: Date | null = null

  for (const entry of entries) {
    // Count by type
    changesByType[entry.changeType] = (changesByType[entry.changeType] ?? 0) + 1

    // Count by module
    if (entry.moduleKey) {
      changesByModule[entry.moduleKey] = (changesByModule[entry.moduleKey] ?? 0) + 1
    }

    // Track unique users
    uniqueUsers.add(entry.userId)

    // Track date range
    if (!minDate || entry.createdAt < minDate) minDate = entry.createdAt
    if (!maxDate || entry.createdAt > maxDate) maxDate = entry.createdAt
  }

  return {
    totalChanges: entries.length,
    changesByType,
    changesByModule,
    uniqueUsers: uniqueUsers.size,
    dateRange: minDate && maxDate ? { start: minDate, end: maxDate } : null,
  }
}
