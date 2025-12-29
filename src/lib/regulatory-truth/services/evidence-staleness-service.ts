// src/lib/regulatory-truth/services/evidence-staleness-service.ts
/**
 * Evidence Staleness Service
 *
 * Handles expiration and staleness detection for regulatory evidence.
 * Implements GitHub issue #893: RTL Stale data handling.
 *
 * Key responsibilities:
 * 1. Check evidence staleness based on age and source verification
 * 2. Auto-deprecate rules past effectiveUntil dates
 * 3. Trigger re-crawl when source content changes
 * 4. Track evidence verification status
 */

import { db } from "@/lib/db"
import { fetchWithRateLimit } from "../utils/rate-limiter"
import { logAuditEvent } from "../utils/audit-log"

// Staleness thresholds in days by source hierarchy
// Higher authority sources require more frequent verification
const STALENESS_THRESHOLDS: Record<number, number> = {
  1: 30, // Laws (EU Directives, NN laws) - 30 days
  2: 21, // Regulations - 21 days
  3: 14, // Official guidance - 14 days
  4: 7, // Practice guides - 7 days
  5: 7, // Auto-created sources - 7 days
}

// Status constants
export const STALENESS_STATUS = {
  FRESH: "FRESH",
  AGING: "AGING",
  STALE: "STALE",
  EXPIRED: "EXPIRED",
} as const

export type StalenessStatus = (typeof STALENESS_STATUS)[keyof typeof STALENESS_STATUS]

export interface EvidenceStalenessCheck {
  evidenceId: string
  url: string
  lastVerifiedAt: Date | null
  sourceStillAvailable: boolean
  contentChanged: boolean
  newEtag: string | null
  newLastModified: Date | null
  staleDays: number
  status: StalenessStatus
}

export interface StalenessCheckResult {
  success: boolean
  checked: number
  stale: number
  expired: number
  unavailable: number
  changed: number
  errors: string[]
}

export interface RuleDeprecationResult {
  success: boolean
  deprecated: number
  errors: string[]
}

/**
 * Calculate staleness status based on days since verification and threshold.
 */
function calculateStalenessStatus(
  daysSinceVerification: number,
  threshold: number
): StalenessStatus {
  if (daysSinceVerification <= threshold * 0.5) {
    return STALENESS_STATUS.FRESH
  }
  if (daysSinceVerification <= threshold) {
    return STALENESS_STATUS.AGING
  }
  if (daysSinceVerification <= threshold * 2) {
    return STALENESS_STATUS.STALE
  }
  return STALENESS_STATUS.EXPIRED
}

/**
 * Check staleness of a single evidence record.
 * Performs HEAD request to verify source availability and detect changes.
 */
export async function checkEvidenceStaleness(
  evidenceId: string
): Promise<EvidenceStalenessCheck> {
  const evidence = await db.evidence.findUnique({
    where: { id: evidenceId },
    include: {
      source: {
        select: { hierarchy: true },
      },
    },
  })

  if (!evidence) {
    throw new Error(`Evidence ${evidenceId} not found`)
  }

  const now = new Date()
  const lastVerified = evidence.lastVerifiedAt || evidence.fetchedAt
  const daysSinceVerification = Math.floor(
    (now.getTime() - lastVerified.getTime()) / (1000 * 60 * 60 * 24)
  )
  const threshold = STALENESS_THRESHOLDS[evidence.source.hierarchy] || 14

  let sourceStillAvailable = true
  let contentChanged = false
  let newEtag: string | null = null
  let newLastModified: Date | null = null

  try {
    // Perform HEAD request to check source availability and headers
    const response = await fetchWithRateLimit(evidence.url, {
      method: "HEAD",
    })

    sourceStillAvailable = response.ok

    if (response.ok) {
      // Check ETag for changes
      newEtag = response.headers.get("etag")
      if (newEtag && evidence.sourceEtag && newEtag !== evidence.sourceEtag) {
        contentChanged = true
      }

      // Check Last-Modified for changes
      const lastModHeader = response.headers.get("last-modified")
      if (lastModHeader) {
        newLastModified = new Date(lastModHeader)
        if (evidence.sourceLastMod && newLastModified > evidence.sourceLastMod) {
          contentChanged = true
        }
      }
    }
  } catch (error) {
    // Network error - source may be temporarily unavailable
    console.error(`[staleness] Error checking ${evidence.url}:`, error)
    sourceStillAvailable = false
  }

  // Determine status - content change or unavailability makes it stale
  let status = calculateStalenessStatus(daysSinceVerification, threshold)
  if (contentChanged) {
    status = STALENESS_STATUS.STALE
  }
  if (!sourceStillAvailable) {
    status = STALENESS_STATUS.EXPIRED
  }

  return {
    evidenceId,
    url: evidence.url,
    lastVerifiedAt: evidence.lastVerifiedAt,
    sourceStillAvailable,
    contentChanged,
    newEtag,
    newLastModified,
    staleDays: daysSinceVerification,
    status,
  }
}

/**
 * Check staleness of all evidence records that are due for verification.
 * Uses batch processing with rate limiting.
 */
export async function checkAllEvidenceStaleness(
  limit: number = 100
): Promise<StalenessCheckResult> {
  const result: StalenessCheckResult = {
    success: true,
    checked: 0,
    stale: 0,
    expired: 0,
    unavailable: 0,
    changed: 0,
    errors: [],
  }

  try {
    // Find evidence that needs verification
    // Prioritize: never verified, then oldest verified
    const evidenceToCheck = await db.evidence.findMany({
      where: {
        deletedAt: null,
        OR: [
          { lastVerifiedAt: null },
          {
            lastVerifiedAt: {
              lt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Older than 24 hours
            },
          },
        ],
      },
      orderBy: [{ lastVerifiedAt: "asc" }], // NULL values first, then oldest
      take: limit,
      select: { id: true },
    })

    console.log(`[staleness] Checking ${evidenceToCheck.length} evidence records`)

    for (const { id } of evidenceToCheck) {
      try {
        const check = await checkEvidenceStaleness(id)
        result.checked++

        // Update evidence record with verification results
        await db.evidence.update({
          where: { id },
          data: {
            lastVerifiedAt: new Date(),
            sourceEtag: check.newEtag || undefined,
            sourceLastMod: check.newLastModified || undefined,
            verifyCount: { increment: 1 },
            stalenessStatus: check.status,
            hasChanged: check.contentChanged,
          },
        })

        if (check.status === STALENESS_STATUS.STALE) {
          result.stale++
        }
        if (check.status === STALENESS_STATUS.EXPIRED) {
          result.expired++
        }
        if (!check.sourceStillAvailable) {
          result.unavailable++
        }
        if (check.contentChanged) {
          result.changed++

          // Log audit event for content change detection
          await logAuditEvent({
            action: "EVIDENCE_CONTENT_CHANGED",
            entityType: "EVIDENCE",
            entityId: id,
            metadata: {
              url: check.url,
              previousEtag: undefined,
              newEtag: check.newEtag,
              staleDays: check.staleDays,
            },
          })
        }

        // Rate limit between checks
        await new Promise((resolve) => setTimeout(resolve, 500))
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        result.errors.push(`Evidence ${id}: ${errorMsg}`)
      }
    }

    console.log(
      `[staleness] Check complete: ${result.checked} checked, ${result.stale} stale, ${result.changed} changed`
    )
  } catch (error) {
    result.success = false
    const errorMsg = error instanceof Error ? error.message : String(error)
    result.errors.push(errorMsg)
  }

  return result
}

/**
 * Auto-deprecate rules that have passed their effectiveUntil date.
 * This ensures outdated regulatory rules are no longer served to users.
 */
export async function deprecateExpiredRules(): Promise<RuleDeprecationResult> {
  const result: RuleDeprecationResult = {
    success: true,
    deprecated: 0,
    errors: [],
  }

  try {
    const now = new Date()

    // Find published rules past their effectiveUntil date
    const expiredRules = await db.regulatoryRule.findMany({
      where: {
        effectiveUntil: { lte: now },
        status: "PUBLISHED",
      },
      select: {
        id: true,
        conceptSlug: true,
        effectiveUntil: true,
      },
    })

    console.log(`[staleness] Found ${expiredRules.length} expired rules to deprecate`)

    for (const rule of expiredRules) {
      try {
        await db.regulatoryRule.update({
          where: { id: rule.id },
          data: { status: "DEPRECATED" },
        })

        await logAuditEvent({
          action: "RULE_AUTO_DEPRECATED",
          entityType: "RULE",
          entityId: rule.id,
          metadata: {
            conceptSlug: rule.conceptSlug,
            effectiveUntil: rule.effectiveUntil?.toISOString(),
            reason: "Past effectiveUntil date",
          },
        })

        result.deprecated++
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        result.errors.push(`Rule ${rule.id}: ${errorMsg}`)
      }
    }

    console.log(`[staleness] Deprecated ${result.deprecated} expired rules`)
  } catch (error) {
    result.success = false
    const errorMsg = error instanceof Error ? error.message : String(error)
    result.errors.push(errorMsg)
  }

  return result
}

/**
 * Queue stale evidence for re-crawl.
 * Creates new DiscoveredItem entries for evidence that needs re-fetching.
 */
export async function queueStaleEvidenceForRecrawl(
  limit: number = 50
): Promise<{ queued: number; errors: string[] }> {
  const result = {
    queued: 0,
    errors: [] as string[],
  }

  try {
    // Find stale or expired evidence with changed content
    const staleEvidence = await db.evidence.findMany({
      where: {
        deletedAt: null,
        OR: [
          { stalenessStatus: STALENESS_STATUS.STALE },
          { stalenessStatus: STALENESS_STATUS.EXPIRED },
          { hasChanged: true },
        ],
      },
      take: limit,
      include: {
        source: {
          select: { id: true, url: true },
        },
      },
    })

    console.log(`[staleness] Queueing ${staleEvidence.length} stale evidence for re-crawl`)

    for (const evidence of staleEvidence) {
      try {
        // Find the discovery endpoint for this domain
        const url = new URL(evidence.url)
        const endpoint = await db.discoveryEndpoint.findFirst({
          where: { domain: url.hostname },
        })

        if (!endpoint) {
          result.errors.push(
            `No endpoint found for domain ${url.hostname} (evidence ${evidence.id})`
          )
          continue
        }

        // Check if already queued
        const existing = await db.discoveredItem.findFirst({
          where: {
            url: evidence.url,
            status: "PENDING",
          },
        })

        if (existing) {
          continue // Already queued
        }

        // Create discovered item for re-fetch
        await db.discoveredItem.create({
          data: {
            endpointId: endpoint.id,
            url: evidence.url,
            status: "PENDING",
            nodeType: "LEAF",
            freshnessRisk: "CRITICAL", // High priority for stale content
          },
        })

        // Mark evidence as queued for refresh
        await db.evidence.update({
          where: { id: evidence.id },
          data: {
            hasChanged: false, // Reset change flag
          },
        })

        result.queued++
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        result.errors.push(`Evidence ${evidence.id}: ${errorMsg}`)
      }
    }

    console.log(`[staleness] Queued ${result.queued} items for re-crawl`)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    result.errors.push(errorMsg)
  }

  return result
}

/**
 * Get staleness statistics for monitoring.
 */
export async function getStalenessStats(): Promise<{
  total: number
  fresh: number
  aging: number
  stale: number
  expired: number
  neverVerified: number
  changedContent: number
}> {
  const [total, fresh, aging, stale, expired, neverVerified, changedContent] =
    await Promise.all([
      db.evidence.count({ where: { deletedAt: null } }),
      db.evidence.count({
        where: { deletedAt: null, stalenessStatus: STALENESS_STATUS.FRESH },
      }),
      db.evidence.count({
        where: { deletedAt: null, stalenessStatus: STALENESS_STATUS.AGING },
      }),
      db.evidence.count({
        where: { deletedAt: null, stalenessStatus: STALENESS_STATUS.STALE },
      }),
      db.evidence.count({
        where: { deletedAt: null, stalenessStatus: STALENESS_STATUS.EXPIRED },
      }),
      db.evidence.count({
        where: { deletedAt: null, lastVerifiedAt: null },
      }),
      db.evidence.count({
        where: { deletedAt: null, hasChanged: true },
      }),
    ])

  return {
    total,
    fresh,
    aging,
    stale,
    expired,
    neverVerified,
    changedContent,
  }
}
