/**
 * Feature Flag Service
 *
 * Centralized service for managing feature flags with:
 * - CRUD operations for flags and overrides
 * - Evaluation logic with rollout support
 * - Audit logging for all changes
 * - Caching for high-performance evaluation
 */

import { prisma } from "@/lib/prisma"
import type {
  FeatureFlag,
  FeatureFlagOverride,
  FeatureFlagWithOverrides,
  FeatureFlagContext,
  FeatureFlagEvaluation,
  CreateFeatureFlagInput,
  UpdateFeatureFlagInput,
  CreateOverrideInput,
  FeatureFlagFilters,
  FeatureFlagStats,
} from "./types"

// =============================================================================
// In-Memory Cache
// =============================================================================

interface CacheEntry {
  flags: FeatureFlagWithOverrides[]
  timestamp: number
}

let cache: CacheEntry | null = null
const CACHE_TTL_MS = 60_000 // 1 minute cache

function isCacheValid(): boolean {
  return cache !== null && Date.now() - cache.timestamp < CACHE_TTL_MS
}

export function invalidateCache(): void {
  cache = null
}

// =============================================================================
// Flag Retrieval
// =============================================================================

/**
 * Get all feature flags with their overrides (cached)
 */
export async function getAllFlags(): Promise<FeatureFlagWithOverrides[]> {
  if (isCacheValid()) {
    return cache!.flags
  }

  const flags = await prisma.featureFlag.findMany({
    include: {
      overrides: true,
    },
    orderBy: { key: "asc" },
  })

  cache = { flags, timestamp: Date.now() }
  return flags
}

/**
 * Get a single flag by key
 */
export async function getFlagByKey(key: string): Promise<FeatureFlagWithOverrides | null> {
  const flags = await getAllFlags()
  return flags.find((f) => f.key === key) ?? null
}

/**
 * Get a single flag by ID
 */
export async function getFlagById(id: string): Promise<FeatureFlagWithOverrides | null> {
  return prisma.featureFlag.findUnique({
    where: { id },
    include: { overrides: true },
  })
}

/**
 * List flags with optional filters
 */
export async function listFlags(filters?: FeatureFlagFilters): Promise<FeatureFlagWithOverrides[]> {
  const flags = await getAllFlags()

  return flags.filter((flag) => {
    if (filters?.status && flag.status !== filters.status) return false
    if (filters?.scope && flag.scope !== filters.scope) return false
    if (filters?.category && flag.category !== filters.category) return false
    if (filters?.search) {
      const search = filters.search.toLowerCase()
      const matchesKey = flag.key.toLowerCase().includes(search)
      const matchesName = flag.name.toLowerCase().includes(search)
      const matchesDesc = flag.description?.toLowerCase().includes(search)
      if (!matchesKey && !matchesName && !matchesDesc) return false
    }
    return true
  })
}

/**
 * Get flag statistics
 */
export async function getFlagStats(): Promise<FeatureFlagStats> {
  const flags = await getAllFlags()

  const stats: FeatureFlagStats = {
    total: flags.length,
    active: 0,
    inactive: 0,
    archived: 0,
    byCategory: {},
  }

  for (const flag of flags) {
    if (flag.status === "ACTIVE") stats.active++
    else if (flag.status === "INACTIVE") stats.inactive++
    else if (flag.status === "ARCHIVED") stats.archived++

    const category = flag.category || "uncategorized"
    stats.byCategory[category] = (stats.byCategory[category] || 0) + 1
  }

  return stats
}

// =============================================================================
// Flag Evaluation
// =============================================================================

/**
 * Simple string hash for consistent user bucketing
 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

/**
 * Check if a user is in the rollout percentage
 */
function isInRollout(userId: string, percentage: number): boolean {
  if (percentage <= 0) return false
  if (percentage >= 100) return true
  return hashString(userId) % 100 < percentage
}

/**
 * Find applicable override for a context
 */
function findOverride(
  overrides: FeatureFlagOverride[],
  context: FeatureFlagContext
): FeatureFlagOverride | undefined {
  const now = new Date()

  // Filter out expired overrides
  const validOverrides = overrides.filter((o) => !o.expiresAt || o.expiresAt > now)

  // Priority: User-specific > Company-specific > Global
  if (context.userId) {
    const userOverride = validOverrides.find((o) => o.userId === context.userId)
    if (userOverride) return userOverride
  }

  if (context.companyId) {
    const companyOverride = validOverrides.find(
      (o) => o.companyId === context.companyId && !o.userId
    )
    if (companyOverride) return companyOverride
  }

  return undefined
}

/**
 * Evaluate a feature flag for a given context
 */
export async function evaluateFlag(
  key: string,
  context: FeatureFlagContext = {}
): Promise<FeatureFlagEvaluation> {
  const flag = await getFlagByKey(key)

  // Flag not found - return disabled
  if (!flag) {
    return { enabled: false, source: "default", flag: null }
  }

  // Flag is not active
  if (flag.status !== "ACTIVE") {
    return {
      enabled: false,
      source: "status",
      flag,
    }
  }

  // Check for overrides
  const override = findOverride(flag.overrides, context)
  if (override) {
    return {
      enabled: override.enabled,
      source: "override",
      flag,
      override,
    }
  }

  // Check rollout percentage
  if (flag.rolloutPercentage > 0 && flag.rolloutPercentage < 100) {
    const identifier = context.userId || context.companyId
    if (identifier) {
      return {
        enabled: isInRollout(identifier, flag.rolloutPercentage),
        source: "rollout",
        flag,
      }
    }
  }

  // Full rollout or default value
  if (flag.rolloutPercentage >= 100) {
    return { enabled: true, source: "rollout", flag }
  }

  return {
    enabled: flag.defaultValue,
    source: "default",
    flag,
  }
}

/**
 * Quick check if a flag is enabled (convenience wrapper)
 */
export async function isEnabled(key: string, context?: FeatureFlagContext): Promise<boolean> {
  const result = await evaluateFlag(key, context)
  return result.enabled
}

/**
 * Evaluate multiple flags at once
 */
export async function evaluateFlags(
  keys: string[],
  context: FeatureFlagContext = {}
): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {}
  for (const key of keys) {
    const evaluation = await evaluateFlag(key, context)
    results[key] = evaluation.enabled
  }
  return results
}

// =============================================================================
// Flag Management (CRUD)
// =============================================================================

/**
 * Create a new feature flag
 */
export async function createFlag(
  input: CreateFeatureFlagInput,
  userId: string
): Promise<FeatureFlag> {
  const flag = await prisma.featureFlag.create({
    data: {
      key: input.key,
      name: input.name,
      description: input.description,
      scope: input.scope ?? "GLOBAL",
      status: input.status ?? "INACTIVE",
      defaultValue: input.defaultValue ?? false,
      rolloutPercentage: input.rolloutPercentage ?? 0,
      category: input.category,
      tags: input.tags ?? [],
      createdBy: userId,
      updatedBy: userId,
    },
  })

  // Log creation
  await prisma.featureFlagAuditLog.create({
    data: {
      flagId: flag.id,
      action: "CREATED",
      userId,
      newValue: flag as unknown as object,
    },
  })

  invalidateCache()
  return flag
}

/**
 * Update a feature flag
 */
export async function updateFlag(
  id: string,
  input: UpdateFeatureFlagInput,
  userId: string,
  reason?: string
): Promise<FeatureFlag> {
  const previous = await prisma.featureFlag.findUnique({ where: { id } })
  if (!previous) throw new Error("Feature flag not found")

  const flag = await prisma.featureFlag.update({
    where: { id },
    data: {
      ...input,
      updatedBy: userId,
    },
  })

  // Determine audit action
  let action: "UPDATED" | "ENABLED" | "DISABLED" | "ARCHIVED" | "ROLLOUT_CHANGED" = "UPDATED"
  if (input.status === "ACTIVE" && previous.status !== "ACTIVE") action = "ENABLED"
  else if (input.status === "INACTIVE" && previous.status !== "INACTIVE") action = "DISABLED"
  else if (input.status === "ARCHIVED") action = "ARCHIVED"
  else if (input.rolloutPercentage !== undefined && input.rolloutPercentage !== previous.rolloutPercentage)
    action = "ROLLOUT_CHANGED"

  await prisma.featureFlagAuditLog.create({
    data: {
      flagId: flag.id,
      action,
      userId,
      previousValue: previous as unknown as object,
      newValue: flag as unknown as object,
      reason,
    },
  })

  invalidateCache()
  return flag
}

/**
 * Delete a feature flag (hard delete)
 */
export async function deleteFlag(id: string, userId: string): Promise<void> {
  const previous = await prisma.featureFlag.findUnique({ where: { id } })
  if (!previous) throw new Error("Feature flag not found")

  // Log before deletion
  await prisma.featureFlagAuditLog.create({
    data: {
      flagId: id,
      action: "ARCHIVED",
      userId,
      previousValue: previous as unknown as object,
      reason: "Flag deleted",
    },
  })

  await prisma.featureFlag.delete({ where: { id } })
  invalidateCache()
}

// =============================================================================
// Override Management
// =============================================================================

/**
 * Create a feature flag override
 */
export async function createOverride(
  input: CreateOverrideInput,
  userId: string
): Promise<FeatureFlagOverride> {
  const override = await prisma.featureFlagOverride.create({
    data: {
      flagId: input.flagId,
      companyId: input.companyId,
      userId: input.userId,
      enabled: input.enabled,
      expiresAt: input.expiresAt,
    },
  })

  await prisma.featureFlagAuditLog.create({
    data: {
      flagId: input.flagId,
      action: "OVERRIDE_ADDED",
      userId,
      newValue: override as unknown as object,
    },
  })

  invalidateCache()
  return override
}

/**
 * Delete a feature flag override
 */
export async function deleteOverride(overrideId: string, userId: string): Promise<void> {
  const override = await prisma.featureFlagOverride.findUnique({ where: { id: overrideId } })
  if (!override) throw new Error("Override not found")

  await prisma.featureFlagAuditLog.create({
    data: {
      flagId: override.flagId,
      action: "OVERRIDE_REMOVED",
      userId,
      previousValue: override as unknown as object,
    },
  })

  await prisma.featureFlagOverride.delete({ where: { id: overrideId } })
  invalidateCache()
}

/**
 * Get overrides for a specific company
 */
export async function getCompanyOverrides(companyId: string): Promise<FeatureFlagOverride[]> {
  return prisma.featureFlagOverride.findMany({
    where: { companyId },
  })
}

/**
 * Get overrides for a specific user
 */
export async function getUserOverrides(userId: string): Promise<FeatureFlagOverride[]> {
  return prisma.featureFlagOverride.findMany({
    where: { userId },
  })
}

// =============================================================================
// Audit Log
// =============================================================================

/**
 * Get audit log for a flag
 */
export async function getFlagAuditLog(flagId: string, limit = 50) {
  return prisma.featureFlagAuditLog.findMany({
    where: { flagId },
    orderBy: { createdAt: "desc" },
    take: limit,
  })
}

/**
 * Get recent audit log entries
 */
export async function getRecentAuditLog(limit = 100) {
  return prisma.featureFlagAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      flag: {
        select: { key: true, name: true },
      },
    },
  })
}

// =============================================================================
// Cleanup Utilities
// =============================================================================

/**
 * Clean up expired overrides
 */
export async function cleanupExpiredOverrides(): Promise<number> {
  const result = await prisma.featureFlagOverride.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  })
  if (result.count > 0) invalidateCache()
  return result.count
}
