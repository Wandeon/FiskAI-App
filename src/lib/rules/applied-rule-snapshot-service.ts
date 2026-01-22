// src/lib/rules/applied-rule-snapshot-service.ts
/**
 * Applied Rule Snapshot Service
 *
 * Manages the creation and deduplication of AppliedRuleSnapshot records.
 * These snapshots capture the exact rule data used when computing payroll,
 * JOPPD, and other regulated calculations.
 *
 * ARCHITECTURAL NOTE:
 * This simplified version does not query the regulatory database directly.
 * The regulatory truth layer has been moved to fiskai-intelligence service.
 * Rule data is passed in directly, and ruleVersionId is a soft reference.
 *
 * For dynamic rule resolution, integrate with Intelligence API:
 * POST https://iapi.fiskai.hr/v1/rules/resolve
 */

import { createHash } from "crypto"

import { Prisma } from "@prisma/client"

import { db } from "@/lib/db"

// Types for transaction-aware operations
// Using 'any' to avoid complex Prisma type inference issues with transactions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaTransaction = any

/**
 * Parameters for creating/finding an applied rule snapshot.
 */
export interface AppliedRuleSnapshotParams {
  companyId: string
  ruleVersionId: string // Soft reference to RuleVersion in regulatory DB
  ruleTableKey: string // e.g., "pausalni-doprinos-2025"
  version: string // e.g., "v1.0.0" or "2025-01-01"
  effectiveFrom: Date // Legal effective date (truncated to midnight UTC)
  snapshotData: Record<string, unknown> // Complete rule data at time of snapshot
}

/**
 * Result of getOrCreateAppliedRuleSnapshot.
 */
export interface AppliedRuleSnapshotResult {
  id: string
  created: boolean // true if new snapshot was created, false if existing was found
}

/**
 * In-memory cache for snapshot deduplication within a transaction.
 * Key: `${companyId}:${ruleVersionId}:${dataHash}`
 */
export type SnapshotCache = Map<string, string>

/**
 * Create a new snapshot cache for use within a transaction.
 * Cache is scoped to the transaction - if tx rolls back, cached IDs become invalid.
 */
export function createSnapshotCache(): SnapshotCache {
  return new Map()
}

/**
 * Compute SHA-256 hash of snapshot data for deduplication.
 */
function computeDataHash(data: Record<string, unknown>): string {
  const json = JSON.stringify(data, Object.keys(data).sort())
  return createHash("sha256").update(json).digest("hex")
}

/**
 * Truncate a Date to midnight UTC for effectiveFrom semantics.
 * Croatian regulatory dates are date-only, not timestamps.
 */
function truncateToDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

/**
 * Get or create an AppliedRuleSnapshot with transaction support and caching.
 *
 * This is the preferred method for bulk operations (e.g., payout creation)
 * where multiple lines may reference the same rule version.
 *
 * @param ruleVersionId - Soft reference to the rule version
 * @param companyId - Company for tenant isolation
 * @param cache - Cache to avoid duplicate lookups within the transaction
 * @param tx - Prisma transaction client (optional, uses db if not provided)
 * @returns The snapshot ID, or null if ruleVersionId is invalid
 */
export async function getOrCreateSnapshotCached(
  ruleVersionId: string,
  companyId: string,
  cache: SnapshotCache,
  tx?: PrismaTransaction
): Promise<string | null> {
  // For simplified version without regulatory DB access,
  // we create a minimal snapshot with just the ruleVersionId reference
  const snapshotData = { ruleVersionId }
  const dataHash = computeDataHash(snapshotData)
  const cacheKey = `${companyId}:${ruleVersionId}:${dataHash}`

  // Check cache first
  const cached = cache.get(cacheKey)
  if (cached) {
    return cached
  }

  const client = tx || db
  const effectiveFrom = truncateToDate(new Date())

  // Try to find existing snapshot
  const existing = await client.appliedRuleSnapshot.findFirst({
    where: {
      companyId,
      ruleVersionId,
      dataHash,
    },
    select: { id: true },
  })

  if (existing) {
    cache.set(cacheKey, existing.id)
    return existing.id
  }

  // Create new snapshot
  const created = await client.appliedRuleSnapshot.create({
    data: {
      companyId,
      ruleVersionId,
      ruleTableKey: "unknown", // Will be populated when Intelligence API integration is added
      version: "1.0.0",
      effectiveFrom,
      dataHash,
      snapshotData: snapshotData as Prisma.InputJsonValue,
    },
    select: { id: true },
  })

  cache.set(cacheKey, created.id)
  return created.id
}

/**
 * Get or create an AppliedRuleSnapshot with full parameters.
 *
 * Use this for admin/testing operations where you have complete rule data.
 * For production payout/JOPPD creation, use getOrCreateSnapshotCached.
 *
 * @param params - Full snapshot parameters including rule data
 * @returns Result with snapshot ID and whether it was created
 */
export async function getOrCreateAppliedRuleSnapshot(
  params: AppliedRuleSnapshotParams
): Promise<AppliedRuleSnapshotResult> {
  const dataHash = computeDataHash(params.snapshotData)
  const effectiveFrom = truncateToDate(params.effectiveFrom)

  // Try to find existing snapshot by unique constraint
  const existing = await db.appliedRuleSnapshot.findFirst({
    where: {
      companyId: params.companyId,
      ruleVersionId: params.ruleVersionId,
      dataHash,
    },
    select: { id: true },
  })

  if (existing) {
    return { id: existing.id, created: false }
  }

  // Create new snapshot
  const created = await db.appliedRuleSnapshot.create({
    data: {
      companyId: params.companyId,
      ruleVersionId: params.ruleVersionId,
      ruleTableKey: params.ruleTableKey,
      version: params.version,
      effectiveFrom,
      dataHash,
      snapshotData: params.snapshotData as Prisma.InputJsonValue,
    },
    select: { id: true },
  })

  return { id: created.id, created: true }
}

/**
 * Bulk create or find snapshots for multiple rule version IDs.
 * Returns a map of ruleVersionId -> snapshotId.
 *
 * @param ruleVersionIds - Array of rule version IDs to snapshot
 * @param companyId - Company for tenant isolation
 * @returns Map of ruleVersionId to snapshotId
 */
export async function bulkGetOrCreateSnapshots(
  ruleVersionIds: string[],
  companyId: string
): Promise<Map<string, string>> {
  const cache = createSnapshotCache()
  const result = new Map<string, string>()

  // Process in transaction for consistency
  await db.$transaction(async (tx) => {
    for (const ruleVersionId of ruleVersionIds) {
      const snapshotId = await getOrCreateSnapshotCached(ruleVersionId, companyId, cache, tx)
      if (snapshotId) {
        result.set(ruleVersionId, snapshotId)
      }
    }
  })

  return result
}
