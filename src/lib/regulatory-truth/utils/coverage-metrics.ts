// src/lib/regulatory-truth/utils/coverage-metrics.ts
// Live coverage accounting and saturation tracking

import { cliDb as db, dbReg } from "../cli-db"

export interface CoverageMetrics {
  timestamp: string

  // Discovery layer
  discovery: {
    endpoints: { total: number; active: number; degraded: number; dead: number }
    items: { total: number; pending: number; fetched: number; processed: number; failed: number }
    saturationPercent: number
  }

  // Evidence layer
  evidence: {
    total: number
    byContentType: Record<string, number>
    unextracted: number
    extractionRate: number
  }

  // Pointer layer
  pointers: {
    total: number
    byDomain: Record<string, number>
    unlinked: number
    linkageRate: number
  }

  // Rule layer
  rules: {
    total: number
    byStatus: Record<string, number>
    byRiskTier: Record<string, number>
    publishedRate: number
  }

  // Conflict layer
  conflicts: {
    total: number
    open: number
    resolved: number
    escalated: number
    resolutionRate: number
  }

  // Release layer
  releases: {
    total: number
    latestVersion: string | null
    totalRulesPublished: number
  }

  // Health indicators
  health: {
    pipelineStalled: boolean
    queueBacklog: number
    oldestPendingAge: number | null // hours
    unresolvedConflictsOver7Days: number
  }
}

export async function collectCoverageMetrics(): Promise<CoverageMetrics> {
  const timestamp = new Date().toISOString()

  // Discovery metrics
  const endpointStats = await db.discoveryEndpoint.groupBy({
    by: ["isActive"],
    _count: true,
  })

  const itemStats = await db.discoveredItem.groupBy({
    by: ["status"],
    _count: true,
  })

  const totalItems = await db.discoveredItem.count()
  const processedItems = await db.discoveredItem.count({
    where: { status: { in: ["FETCHED", "PROCESSED"] } },
  })

  // Evidence metrics
  const evidenceTotal = await dbReg.evidence.count({ where: { deletedAt: null } })
  const evidenceByType = await dbReg.evidence.groupBy({
    by: ["contentType"],
    _count: true,
    where: { deletedAt: null },
  })
  // Get evidenceIds that have at least one SourcePointer (relation removed, use manual query)
  const pointersWithEvidence = await db.sourcePointer.findMany({
    where: { deletedAt: null },
    select: { evidenceId: true },
    distinct: ["evidenceId"],
  })
  const evidenceIdsWithPointers = pointersWithEvidence.map((p) => p.evidenceId)
  const unextractedEvidence =
    evidenceIdsWithPointers.length > 0
      ? await dbReg.evidence.count({
          where: { deletedAt: null, id: { notIn: evidenceIdsWithPointers } },
        })
      : evidenceTotal

  // Pointer metrics
  const pointerTotal = await db.sourcePointer.count({ where: { deletedAt: null } })
  const pointersByDomain = await db.sourcePointer.groupBy({
    by: ["domain"],
    _count: true,
    where: { deletedAt: null },
  })
  const unlinkedPointers = await db.sourcePointer.count({
    where: {
      deletedAt: null,
      rules: {
        none: {},
      },
    },
  })

  // Rule metrics
  const ruleTotal = await db.regulatoryRule.count()
  const rulesByStatus = await db.regulatoryRule.groupBy({
    by: ["status"],
    _count: true,
  })
  const rulesByTier = await db.regulatoryRule.groupBy({
    by: ["riskTier"],
    _count: true,
  })
  const publishedRules = await db.regulatoryRule.count({ where: { status: "PUBLISHED" } })

  // Conflict metrics
  const conflictTotal = await db.regulatoryConflict.count()
  const conflictsByStatus = await db.regulatoryConflict.groupBy({
    by: ["status"],
    _count: true,
  })
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const oldConflicts = await db.regulatoryConflict.count({
    where: { status: "OPEN", createdAt: { lt: sevenDaysAgo } },
  })

  // Release metrics
  const releaseTotal = await db.ruleRelease.count()
  const latestRelease = await db.ruleRelease.findFirst({
    orderBy: { releasedAt: "desc" },
    select: { version: true },
  })

  // Health metrics
  const pendingItems = await db.discoveredItem.count({ where: { status: "PENDING" } })
  const oldestPending = await db.discoveredItem.findFirst({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  })

  const oldestPendingAge = oldestPending
    ? (Date.now() - oldestPending.createdAt.getTime()) / (1000 * 60 * 60)
    : null

  return {
    timestamp,

    discovery: {
      endpoints: {
        total: endpointStats.reduce((sum, s) => sum + s._count, 0),
        active: endpointStats.find((s) => s.isActive)?._count || 0,
        degraded: 0, // TODO: track degraded endpoints
        dead: endpointStats.find((s) => !s.isActive)?._count || 0,
      },
      items: {
        total: totalItems,
        pending: itemStats.find((s) => s.status === "PENDING")?._count || 0,
        fetched: itemStats.find((s) => s.status === "FETCHED")?._count || 0,
        processed: itemStats.find((s) => s.status === "PROCESSED")?._count || 0,
        failed: itemStats.find((s) => s.status === "FAILED")?._count || 0,
      },
      saturationPercent: totalItems > 0 ? (processedItems / totalItems) * 100 : 0,
    },

    evidence: {
      total: evidenceTotal,
      byContentType: Object.fromEntries(evidenceByType.map((e) => [e.contentType, e._count])),
      unextracted: unextractedEvidence,
      extractionRate:
        evidenceTotal > 0 ? ((evidenceTotal - unextractedEvidence) / evidenceTotal) * 100 : 0,
    },

    pointers: {
      total: pointerTotal,
      byDomain: Object.fromEntries(pointersByDomain.map((p) => [p.domain, p._count])),
      unlinked: unlinkedPointers,
      linkageRate: pointerTotal > 0 ? ((pointerTotal - unlinkedPointers) / pointerTotal) * 100 : 0,
    },

    rules: {
      total: ruleTotal,
      byStatus: Object.fromEntries(rulesByStatus.map((r) => [r.status, r._count])),
      byRiskTier: Object.fromEntries(rulesByTier.map((r) => [r.riskTier, r._count])),
      publishedRate: ruleTotal > 0 ? (publishedRules / ruleTotal) * 100 : 0,
    },

    conflicts: {
      total: conflictTotal,
      open: conflictsByStatus.find((c) => c.status === "OPEN")?._count || 0,
      resolved: conflictsByStatus.find((c) => c.status === "RESOLVED")?._count || 0,
      escalated: conflictsByStatus.find((c) => c.status === "ESCALATED")?._count || 0,
      resolutionRate:
        conflictTotal > 0
          ? ((conflictsByStatus.find((c) => c.status === "RESOLVED")?._count || 0) /
              conflictTotal) *
            100
          : 0,
    },

    releases: {
      total: releaseTotal,
      latestVersion: latestRelease?.version || null,
      totalRulesPublished: publishedRules,
    },

    health: {
      pipelineStalled: pendingItems > 100 && (oldestPendingAge || 0) > 24,
      queueBacklog: pendingItems + unextractedEvidence + unlinkedPointers,
      oldestPendingAge,
      unresolvedConflictsOver7Days: oldConflicts,
    },
  }
}

export function formatCoverageReport(metrics: CoverageMetrics): string {
  return `
# Regulatory Truth Layer Coverage Report

**Generated:** ${metrics.timestamp}

## Discovery Layer
- Endpoints: ${metrics.discovery.endpoints.active} active / ${metrics.discovery.endpoints.total} total
- Items: ${metrics.discovery.items.total} total
  - Pending: ${metrics.discovery.items.pending}
  - Fetched: ${metrics.discovery.items.fetched}
  - Processed: ${metrics.discovery.items.processed}
  - Failed: ${metrics.discovery.items.failed}
- **Saturation: ${metrics.discovery.saturationPercent.toFixed(1)}%**

## Evidence Layer
- Total: ${metrics.evidence.total}
- By type: ${Object.entries(metrics.evidence.byContentType)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ")}
- Unextracted: ${metrics.evidence.unextracted}
- **Extraction rate: ${metrics.evidence.extractionRate.toFixed(1)}%**

## Pointer Layer
- Total: ${metrics.pointers.total}
- Unlinked: ${metrics.pointers.unlinked}
- **Linkage rate: ${metrics.pointers.linkageRate.toFixed(1)}%**

## Rule Layer
- Total: ${metrics.rules.total}
- By status: ${Object.entries(metrics.rules.byStatus)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ")}
- By tier: ${Object.entries(metrics.rules.byRiskTier)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ")}
- **Published rate: ${metrics.rules.publishedRate.toFixed(1)}%**

## Conflicts
- Total: ${metrics.conflicts.total}
- Open: ${metrics.conflicts.open}
- Resolved: ${metrics.conflicts.resolved}
- Escalated: ${metrics.conflicts.escalated}
- **Resolution rate: ${metrics.conflicts.resolutionRate.toFixed(1)}%**

## Releases
- Total releases: ${metrics.releases.total}
- Latest version: ${metrics.releases.latestVersion || "N/A"}
- Rules published: ${metrics.releases.totalRulesPublished}

## Health
- Pipeline stalled: ${metrics.health.pipelineStalled ? "YES" : "NO"}
- Queue backlog: ${metrics.health.queueBacklog}
- Oldest pending: ${metrics.health.oldestPendingAge ? metrics.health.oldestPendingAge.toFixed(1) + " hours" : "N/A"}
- Conflicts >7 days: ${metrics.health.unresolvedConflictsOver7Days}
`.trim()
}
