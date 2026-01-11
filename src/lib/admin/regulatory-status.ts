/**
 * Regulatory Pipeline Status Query
 *
 * Server-only module for fetching regulatory truth layer status.
 * Used by:
 * - /admin/regulatory page (direct call)
 * - /api/admin/regulatory-truth/status (API endpoint)
 *
 * This separation ensures the page doesn't need to make an unauthenticated
 * fetch() to the API - it can call this function directly since it already
 * has its own auth check.
 */

import "server-only"
import { db } from "@/lib/db"
import { dbReg } from "@/lib/db/regulatory"

/**
 * Pipeline health status
 */
export type HealthStatus = "healthy" | "warning" | "critical"

/**
 * Recent activity item from agent runs
 */
export interface RecentActivityItem {
  id: string
  type: string
  completedAt: Date | null
  confidence: number | null
  summary: string
}

/**
 * Full pipeline status response
 */
export interface RegulatoryPipelineStatus {
  timestamp: string
  health: {
    status: HealthStatus
    score: number
  }
  sources: {
    total: number
    active: number
    inactive: number
    needingCheck: number
    byPriority: Record<string, number>
  }
  rules: {
    total: number
    byStatus: {
      DRAFT: number
      PENDING_REVIEW: number
      APPROVED: number
      PUBLISHED: number
      DEPRECATED: number
      REJECTED: number
    }
  }
  evidence: {
    total: number
    lastCollected: Date | null
  }
  sourcePointers: {
    total: number
  }
  conflicts: {
    active: number
  }
  agents: {
    runs24h: number
    byType: Record<string, { completed: number; failed: number; running: number }>
  }
  latestRelease: {
    id: string
    version: string
    releasedAt: Date
    rulesCount: number
  } | null
  recentActivity: RecentActivityItem[]
}

/**
 * Fetch the regulatory pipeline status.
 *
 * This function contains all the status query logic and can be called
 * directly from server components or from API routes.
 *
 * @returns Full pipeline status object
 */
export async function getRegulatoryPipelineStatus(): Promise<RegulatoryPipelineStatus> {
  // Get source counts by status
  const sourceStats = await dbReg.regulatorySource.groupBy({
    by: ["isActive"],
    _count: true,
  })

  const activeSources =
    sourceStats.find((s: { isActive: boolean; _count: number }) => s.isActive)?._count || 0
  const inactiveSources =
    sourceStats.find((s: { isActive: boolean; _count: number }) => !s.isActive)?._count || 0
  const totalSources = activeSources + inactiveSources

  // Get sources by priority (based on fetchIntervalHours)
  const sourcesByPriority = await db.$queryRaw<Array<{ priority: string; count: number }>>`
    SELECT
      CASE
        WHEN "fetchIntervalHours" <= 24 THEN 'T0'
        WHEN "fetchIntervalHours" <= 168 THEN 'T1'
        ELSE 'T2'
      END as priority,
      COUNT(*) as count
    FROM "RegulatorySource"
    WHERE "isActive" = true
    GROUP BY
      CASE
        WHEN "fetchIntervalHours" <= 24 THEN 'T0'
        WHEN "fetchIntervalHours" <= 168 THEN 'T1'
        ELSE 'T2'
      END
    ORDER BY priority
  `

  // Get sources that need checking
  const sourcesNeedingCheck = await db.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*) as count
    FROM "RegulatorySource"
    WHERE "isActive" = true
      AND (
        "lastFetchedAt" IS NULL
        OR "lastFetchedAt" < NOW() - ("fetchIntervalHours" || ' hours')::INTERVAL
      )
  `

  const needsCheckCount = Number(sourcesNeedingCheck[0]?.count || 0)

  // Get rule counts by status
  const ruleStats = await db.regulatoryRule.groupBy({
    by: ["status"],
    _count: true,
  })

  const rulesByStatus = {
    DRAFT: ruleStats.find((r) => r.status === "DRAFT")?._count || 0,
    PENDING_REVIEW: ruleStats.find((r) => r.status === "PENDING_REVIEW")?._count || 0,
    APPROVED: ruleStats.find((r) => r.status === "APPROVED")?._count || 0,
    PUBLISHED: ruleStats.find((r) => r.status === "PUBLISHED")?._count || 0,
    DEPRECATED: ruleStats.find((r) => r.status === "DEPRECATED")?._count || 0,
    REJECTED: ruleStats.find((r) => r.status === "REJECTED")?._count || 0,
  }

  const totalRules = Object.values(rulesByStatus).reduce((sum, count) => sum + count, 0)

  // Get recent agent runs (last 24 hours)
  const recentAgentRuns = await db.agentRun.groupBy({
    by: ["agentType", "status"],
    where: {
      startedAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    },
    _count: true,
  })

  const agentRunsByType: Record<string, { completed: number; failed: number; running: number }> = {}

  for (const run of recentAgentRuns) {
    if (!agentRunsByType[run.agentType]) {
      agentRunsByType[run.agentType] = { completed: 0, failed: 0, running: 0 }
    }
    if (run.status === "completed") {
      agentRunsByType[run.agentType].completed = run._count
    } else if (run.status === "failed") {
      agentRunsByType[run.agentType].failed = run._count
    } else if (run.status === "running") {
      agentRunsByType[run.agentType].running = run._count
    }
  }

  // Get total agent runs in last 24h
  const totalAgentRuns24h = await db.agentRun.count({
    where: {
      startedAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    },
  })

  // Get latest evidence collection timestamp
  const latestEvidence = await dbReg.evidence.findFirst({
    orderBy: { fetchedAt: "desc" },
    select: { fetchedAt: true },
  })

  // Get latest rule release
  const latestRelease = await db.ruleRelease.findFirst({
    orderBy: { releasedAt: "desc" },
    select: {
      id: true,
      version: true,
      releasedAt: true,
      _count: {
        select: { rules: true },
      },
    },
  })

  // Get total counts
  const totalEvidence = await dbReg.evidence.count()
  const totalSourcePointers = await db.sourcePointer.count()
  const totalConflicts = await db.regulatoryConflict.count({
    where: {
      status: { in: ["OPEN", "ESCALATED"] },
    },
  })

  // Calculate pipeline health score (0-100)
  const failureRate =
    totalAgentRuns24h > 0
      ? recentAgentRuns.filter((r) => r.status === "failed").reduce((sum, r) => sum + r._count, 0) /
        totalAgentRuns24h
      : 0

  const pendingReviewPercentage = totalRules > 0 ? rulesByStatus.PENDING_REVIEW / totalRules : 0
  const healthScore = Math.round(
    100 - failureRate * 30 - pendingReviewPercentage * 20 - (needsCheckCount > 10 ? 20 : 0)
  )

  // Determine health status
  let healthStatus: HealthStatus
  if (healthScore >= 80) {
    healthStatus = "healthy"
  } else if (healthScore >= 60) {
    healthStatus = "warning"
  } else {
    healthStatus = "critical"
  }

  // Get recent activity (last 10 significant events)
  const recentActivity = await db.agentRun.findMany({
    where: {
      status: "completed",
      agentType: { in: ["SENTINEL", "COMPOSER", "REVIEWER", "RELEASER"] },
    },
    orderBy: { completedAt: "desc" },
    take: 10,
    select: {
      id: true,
      agentType: true,
      completedAt: true,
      confidence: true,
      output: true,
    },
  })

  return {
    timestamp: new Date().toISOString(),
    health: {
      status: healthStatus,
      score: healthScore,
    },
    sources: {
      total: totalSources,
      active: activeSources,
      inactive: inactiveSources,
      needingCheck: needsCheckCount,
      byPriority: sourcesByPriority.reduce(
        (acc, item) => {
          acc[item.priority] = Number(item.count)
          return acc
        },
        {} as Record<string, number>
      ),
    },
    rules: {
      total: totalRules,
      byStatus: rulesByStatus,
    },
    evidence: {
      total: totalEvidence,
      lastCollected: latestEvidence?.fetchedAt ?? null,
    },
    sourcePointers: {
      total: totalSourcePointers,
    },
    conflicts: {
      active: totalConflicts,
    },
    agents: {
      runs24h: totalAgentRuns24h,
      byType: agentRunsByType,
    },
    latestRelease: latestRelease
      ? {
          id: latestRelease.id,
          version: latestRelease.version,
          releasedAt: latestRelease.releasedAt,
          rulesCount: latestRelease._count.rules,
        }
      : null,
    recentActivity: recentActivity.map((run) => ({
      id: run.id,
      type: run.agentType,
      completedAt: run.completedAt,
      confidence: run.confidence,
      summary:
        run.agentType === "SENTINEL"
          ? "Source checked"
          : run.agentType === "COMPOSER"
            ? "Rule drafted"
            : run.agentType === "REVIEWER"
              ? "Rule reviewed"
              : run.agentType === "RELEASER"
                ? "Release published"
                : "Agent run",
    })),
  }
}
