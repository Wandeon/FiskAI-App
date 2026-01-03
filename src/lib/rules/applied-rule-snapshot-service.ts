// src/lib/rules/applied-rule-snapshot-service.ts
/**
 * AppliedRuleSnapshot Service
 *
 * SINGLE CHOKE POINT for creating AppliedRuleSnapshot records.
 * All snapshot creation MUST go through this service.
 *
 * DO NOT use db.appliedRuleSnapshot.create() directly outside this file.
 * Run `rg "appliedRuleSnapshot\.create" src/` to verify compliance.
 *
 * Responsibilities:
 * - Require either tenant context or explicit companyId
 * - Normalize inputs (table key casing, date truncation)
 * - Dedupe via upsert using unique key [companyId, ruleVersionId, dataHash]
 * - Return snapshot id for linking to PayoutLine/JoppdSubmissionLine
 * - Support transactional creation for atomicity with line insertions
 */

import { createHash } from "crypto"
import { db, type TransactionClient } from "@/lib/db"
import { getRuleVersionByIdWithTable } from "@/lib/fiscal-rules/ruleversion-store"
import { getTenantContext } from "@/lib/prisma-extensions"

/**
 * Error thrown when snapshot creation is attempted without proper tenant scoping.
 */
export class SnapshotTenantContextError extends Error {
  constructor() {
    super(
      "AppliedRuleSnapshot creation requires tenant context or explicit companyId. " +
        "Use runWithTenant() wrapper or pass companyId explicitly for batch jobs."
    )
    this.name = "SnapshotTenantContextError"
  }
}

/**
 * Prisma client or transaction client - either works for snapshot operations.
 */
export type SnapshotPrismaClient = typeof db | TransactionClient

/**
 * Input for creating an applied rule snapshot.
 */
export interface CreateSnapshotInput {
  /** Company ID - required if not in tenant context */
  companyId?: string

  /** RuleVersion ID from regulatory DB (soft ref, no FK) */
  ruleVersionId: string

  /** Rule table key, e.g., "pausalni-doprinos-2025" */
  ruleTableKey: string

  /** Version string, e.g., "v1.0.0" or "2025-01-01" */
  version: string

  /**
   * Rule effective date (legal date, no time component).
   * Will be truncated to date-only if a DateTime is passed.
   */
  effectiveFrom: Date

  /** Complete rule data at time of snapshot */
  snapshotData: Record<string, unknown>

  /**
   * Optional transaction client for atomic operations.
   * When provided, snapshot is created inside the caller's transaction.
   * RECOMMENDED: Always provide tx when creating snapshots alongside lines.
   */
  tx?: SnapshotPrismaClient
}

/**
 * Result of snapshot creation/lookup.
 */
export interface SnapshotResult {
  /** Snapshot ID for linking to PayoutLine/JoppdSubmissionLine */
  id: string

  /** Whether this was a new snapshot or existing dedupe match */
  created: boolean
}

/**
 * Compute SHA-256 hash of snapshot data for deduplication.
 * Deterministic: sorts keys before hashing.
 */
function computeDataHash(data: Record<string, unknown>): string {
  const normalized = JSON.stringify(data, Object.keys(data).sort())
  return createHash("sha256").update(normalized).digest("hex")
}

/**
 * Truncate datetime to date-only (midnight UTC).
 * effectiveFrom is a legal date concept, not a timestamp.
 */
function truncateToDate(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
}

/**
 * Normalize rule table key to lowercase with hyphens.
 * Ensures consistent lookup regardless of input casing.
 */
function normalizeTableKey(key: string): string {
  return key.toLowerCase().replace(/[_\s]+/g, "-")
}

/**
 * Create or find an existing AppliedRuleSnapshot.
 *
 * Deduplication: If a snapshot with the same [companyId, ruleVersionId, dataHash]
 * already exists, returns the existing snapshot instead of creating a duplicate.
 *
 * IMPORTANT: For atomic operations with line creation, pass the transaction client
 * via input.tx. This ensures snapshot and line are created in the same transaction.
 *
 * @throws SnapshotTenantContextError if no tenant context and no explicit companyId
 */
export async function getOrCreateAppliedRuleSnapshot(
  input: CreateSnapshotInput
): Promise<SnapshotResult> {
  // Resolve companyId from context or explicit input
  const context = getTenantContext()
  const companyId = input.companyId ?? context?.companyId

  if (!companyId) {
    throw new SnapshotTenantContextError()
  }

  // Use provided transaction client or fall back to db
  const client = input.tx ?? db

  // Normalize inputs
  const ruleTableKey = normalizeTableKey(input.ruleTableKey)
  const effectiveFrom = truncateToDate(input.effectiveFrom)
  const dataHash = computeDataHash(input.snapshotData)

  // Check for existing snapshot with same dedupe key
  // If exists: return existing (no update needed - snapshots are immutable)
  // If not: create new
  const existing = await client.appliedRuleSnapshot.findUnique({
    where: {
      companyId_ruleVersionId_dataHash: {
        companyId,
        ruleVersionId: input.ruleVersionId,
        dataHash,
      },
    },
    select: { id: true },
  })

  if (existing) {
    return { id: existing.id, created: false }
  }

  // Create new snapshot
  const snapshot = await client.appliedRuleSnapshot.create({
    data: {
      companyId,
      ruleVersionId: input.ruleVersionId,
      ruleTableKey,
      version: input.version,
      effectiveFrom,
      dataHash,
      snapshotData: input.snapshotData,
    },
    select: { id: true },
  })

  return { id: snapshot.id, created: true }
}

/**
 * Batch create snapshots for multiple rules.
 * Uses individual getOrCreateAppliedRuleSnapshot calls with dedupe.
 *
 * @param inputs - Array of snapshot inputs
 * @param companyId - Required for batch jobs outside tenant context
 * @param tx - Optional transaction client for atomic operations
 * @returns Array of snapshot results in same order as inputs
 */
export async function batchGetOrCreateSnapshots(
  inputs: CreateSnapshotInput[],
  companyId?: string,
  tx?: SnapshotPrismaClient
): Promise<SnapshotResult[]> {
  const results: SnapshotResult[] = []

  for (const input of inputs) {
    const result = await getOrCreateAppliedRuleSnapshot({
      ...input,
      companyId: input.companyId ?? companyId,
      tx: input.tx ?? tx,
    })
    results.push(result)
  }

  return results
}

/**
 * Resolve RuleVersion by ID and create/get a snapshot.
 *
 * This is the primary entry point for dual-write from PayoutLine/JoppdSubmissionLine.
 * It fetches the RuleVersion with its table, extracts the data, and creates a snapshot.
 *
 * IMPORTANT: For atomic operations, pass the transaction client. The RuleVersion lookup
 * uses the regulatory prisma client (separate DB), but snapshot creation uses the
 * provided tx to ensure atomicity with line creation.
 *
 * @param ruleVersionId - ID of the RuleVersion to snapshot
 * @param companyId - Company ID (required if not in tenant context)
 * @param tx - Optional transaction client for atomic snapshot creation
 * @returns Snapshot ID, or null if RuleVersion not found
 */
export async function getOrCreateSnapshotFromRuleVersionId(
  ruleVersionId: string,
  companyId?: string,
  tx?: SnapshotPrismaClient
): Promise<string | null> {
  // Resolve companyId from context or explicit input
  const context = getTenantContext()
  const resolvedCompanyId = companyId ?? context?.companyId

  if (!resolvedCompanyId) {
    throw new SnapshotTenantContextError()
  }

  // PR#10: Use ruleversion-store for RuleVersion lookup (supports core/regulatory/dual modes)
  // Note: The store handles source selection based on RULE_VERSION_SOURCE env var
  const ruleVersion = await getRuleVersionByIdWithTable(ruleVersionId)

  if (!ruleVersion) {
    return null
  }

  // Create snapshot using the provided transaction client for atomicity
  const result = await getOrCreateAppliedRuleSnapshot({
    companyId: resolvedCompanyId,
    ruleVersionId: ruleVersion.id,
    ruleTableKey: ruleVersion.table.key,
    version: ruleVersion.version,
    effectiveFrom: ruleVersion.effectiveFrom,
    snapshotData: ruleVersion.data as Record<string, unknown>,
    tx,
  })

  return result.id
}

/**
 * In-memory cache for snapshot resolution during a single operation.
 * Key: `${companyId}:${ruleVersionId}`
 * Value: snapshot ID
 *
 * Use createSnapshotCache() at the start of a batch operation,
 * then pass the cache to getOrCreateSnapshotCached() for each line.
 */
export type SnapshotCache = Map<string, string>

export function createSnapshotCache(): SnapshotCache {
  return new Map()
}

/**
 * Get or create snapshot with in-memory caching.
 *
 * For batch operations (payroll runs with many lines), use this to avoid
 * repeated DB lookups for the same ruleVersionId.
 *
 * IMPORTANT: For atomic operations, pass the transaction client. The cache
 * stores snapshot IDs that were created within the transaction, so if the
 * transaction rolls back, the cached IDs become invalid. Create a fresh
 * cache per transaction.
 *
 * @param ruleVersionId - ID of the RuleVersion to snapshot
 * @param companyId - Company ID
 * @param cache - In-memory cache from createSnapshotCache()
 * @param tx - Optional transaction client for atomic operations
 * @returns Snapshot ID, or null if RuleVersion not found
 */
export async function getOrCreateSnapshotCached(
  ruleVersionId: string,
  companyId: string,
  cache: SnapshotCache,
  tx?: SnapshotPrismaClient
): Promise<string | null> {
  const cacheKey = `${companyId}:${ruleVersionId}`

  // Check cache first
  const cached = cache.get(cacheKey)
  if (cached) {
    return cached
  }

  // Resolve and cache
  const snapshotId = await getOrCreateSnapshotFromRuleVersionId(ruleVersionId, companyId, tx)
  if (snapshotId) {
    cache.set(cacheKey, snapshotId)
  }

  return snapshotId
}
