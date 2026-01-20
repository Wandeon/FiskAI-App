// src/lib/regulatory-truth/utils/api-idempotency.ts
// Idempotency guard for RTL API endpoints (approve/publish)
//
// Prevents duplicate operations and detects payload mismatches.
// Uses releaseId as the idempotency key.

import { db } from "@/lib/db"
import { ApiIdempotencyRoute } from "@prisma/client"
import { createHash } from "crypto"

// =============================================================================
// TYPES
// =============================================================================

export interface IdempotencyCheckResult {
  /** Whether this is a new request (should proceed) */
  isNew: boolean
  /** Whether this is an exact replay (same payload) - return cached/OK response */
  isReplay: boolean
  /** Whether this is a conflict (same key, different payload) */
  isConflict: boolean
  /** Error message if conflict */
  error?: string
  /** Existing record if found */
  existing?: {
    id: string
    createdAt: Date
    requestMeta: unknown
    /** Stored response from first execution - REQUIRED for replay */
    responseSummary: unknown | null
  }
}

export interface CanonicalPayload {
  ruleIds: string[]
  source: string
  actor: string
  autoApprove?: boolean
  sourceSlug?: string
}

// =============================================================================
// CANONICAL PAYLOAD HASHING
// =============================================================================

/**
 * Compute a stable hash of the canonical payload fields.
 * Only includes fields that define intent, not volatile fields.
 * ruleIds are sorted to ensure order-independence.
 */
export function computePayloadHash(payload: CanonicalPayload): string {
  // Sort ruleIds for deterministic ordering
  const sortedRuleIds = [...payload.ruleIds].sort()

  // Build canonical object with explicit key order
  const canonical = {
    ruleIds: sortedRuleIds,
    source: payload.source,
    actor: payload.actor,
    autoApprove: payload.autoApprove ?? false,
    sourceSlug: payload.sourceSlug ?? null,
  }

  // Use stable JSON stringify
  const json = JSON.stringify(canonical)

  // SHA256 hash
  return createHash("sha256").update(json).digest("hex")
}

// =============================================================================
// IDEMPOTENCY CHECK
// =============================================================================

/**
 * Check idempotency for an API request.
 *
 * Returns:
 * - isNew: true if this is a new request (proceed with operation)
 * - isReplay: true if this is an exact replay (return 200, don't redo)
 * - isConflict: true if same key but different payload (return 409)
 *
 * If isNew, automatically creates the idempotency record.
 */
export async function checkIdempotency(
  route: ApiIdempotencyRoute,
  releaseId: string,
  payload: CanonicalPayload,
  requestMeta?: Record<string, unknown>
): Promise<IdempotencyCheckResult> {
  const payloadHash = computePayloadHash(payload)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

  // Try to find existing record
  const existing = await db.apiIdempotencyKey.findUnique({
    where: {
      route_key: {
        route,
        key: releaseId,
      },
    },
  })

  if (!existing) {
    // New request - create record and proceed
    await db.apiIdempotencyKey.create({
      data: {
        key: releaseId,
        route,
        payloadHash,
        expiresAt,
        requestMeta: requestMeta,
      },
    })

    return { isNew: true, isReplay: false, isConflict: false }
  }

  // Check if expired (treat as new if expired)
  if (existing.expiresAt < new Date()) {
    // Expired - delete and recreate
    await db.apiIdempotencyKey.delete({
      where: { id: existing.id },
    })
    await db.apiIdempotencyKey.create({
      data: {
        key: releaseId,
        route,
        payloadHash,
        expiresAt,
        requestMeta: requestMeta,
      },
    })

    return { isNew: true, isReplay: false, isConflict: false }
  }

  // Check payload hash
  if (existing.payloadHash === payloadHash) {
    // Same payload - check if we have a stored response
    if (existing.responseSummary === null) {
      // INCOMPLETE: Key was created but response was never stored (crash scenario)
      // Treat as new request but don't recreate the key
      // The endpoint should proceed and store the response when done
      console.log(
        `[idempotency] Incomplete key for ${releaseId}: proceeding with execution (will store response)`
      )
      return { isNew: true, isReplay: false, isConflict: false }
    }

    // Exact replay with stored response - return without redoing
    return {
      isNew: false,
      isReplay: true,
      isConflict: false,
      existing: {
        id: existing.id,
        createdAt: existing.createdAt,
        requestMeta: existing.requestMeta,
        responseSummary: existing.responseSummary,
      },
    }
  }

  // Conflict - same key, different payload
  return {
    isNew: false,
    isReplay: false,
    isConflict: true,
    error:
      `Idempotency conflict: releaseId "${releaseId}" was already used with a different payload. ` +
      `Original request at ${existing.createdAt.toISOString()}. ` +
      `Use a new releaseId for different operations.`,
    existing: {
      id: existing.id,
      createdAt: existing.createdAt,
      requestMeta: existing.requestMeta,
      responseSummary: existing.responseSummary,
    },
  }
}

// =============================================================================
// STORE RESPONSE
// =============================================================================

/**
 * Store the response summary for an idempotency key.
 * Call this AFTER successful execution to enable deterministic replay.
 *
 * @param route - The API route
 * @param releaseId - The idempotency key
 * @param responseSummary - The response to store (counts, results, errors)
 */
export async function storeResponseSummary(
  route: ApiIdempotencyRoute,
  releaseId: string,
  responseSummary: object
): Promise<void> {
  await db.apiIdempotencyKey.update({
    where: {
      route_key: {
        route,
        key: releaseId,
      },
    },
    data: {
      responseSummary,
    },
  })
}

// =============================================================================
// CLEANUP (for future use)
// =============================================================================

/**
 * Delete expired idempotency keys.
 * Run this periodically (e.g., daily) to keep the table small.
 */
export async function cleanupExpiredKeys(): Promise<number> {
  const result = await db.apiIdempotencyKey.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  })
  return result.count
}
