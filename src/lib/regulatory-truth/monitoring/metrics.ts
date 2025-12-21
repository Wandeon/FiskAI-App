// src/lib/regulatory-truth/monitoring/metrics.ts
import { db } from "@/lib/db"

export interface PipelineMetrics {
  // Discovery metrics
  activeEndpoints: number
  endpointsWithErrors: number
  pendingItems: number
  fetchedItems: number

  // Processing metrics
  evidenceTotal: number
  evidenceUnprocessed: number
  pointersTotal: number
  pointersUngrouped: number

  // Rule metrics
  rulesDraft: number
  rulesApproved: number
  rulesActive: number
  rulesStale: number

  // Conflict metrics
  conflictsOpen: number
  conflictsResolved: number

  // Release metrics
  releasesTotal: number
  latestReleaseVersion: string | null
  latestReleaseDate: Date | null

  // Agent run metrics
  agentRunsToday: number
  agentRunsSuccess: number
  agentRunsFailed: number

  // Timing
  collectedAt: Date
}

/**
 * Collect current pipeline metrics.
 */
export async function collectMetrics(): Promise<PipelineMetrics> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [
    activeEndpoints,
    endpointsWithErrors,
    pendingItems,
    fetchedItems,
    evidenceTotal,
    evidenceUnprocessed,
    pointersTotal,
    pointersUngrouped,
    rulesDraft,
    rulesApproved,
    rulesActive,
    conflictsOpen,
    conflictsResolved,
    releasesTotal,
    latestRelease,
    agentRunsToday,
    agentRunsSuccess,
    agentRunsFailed,
  ] = await Promise.all([
    // Discovery
    db.discoveryEndpoint.count({ where: { isActive: true } }),
    db.discoveryEndpoint.count({ where: { consecutiveErrors: { gte: 3 } } }),
    db.discoveredItem.count({ where: { status: "PENDING" } }),
    db.discoveredItem.count({ where: { status: "FETCHED" } }),

    // Evidence
    db.evidence.count(),
    db.evidence.count({
      where: {
        sourcePointers: { none: {} },
      },
    }),

    // Pointers
    db.sourcePointer.count(),
    db.sourcePointer.count({
      where: {
        rules: { none: {} },
      },
    }),

    // Rules
    db.regulatoryRule.count({ where: { status: "DRAFT" } }),
    db.regulatoryRule.count({ where: { status: "APPROVED" } }),
    db.regulatoryRule.count({ where: { status: "ACTIVE" } }),

    // Conflicts
    db.regulatoryConflict.count({ where: { status: "OPEN" } }),
    db.regulatoryConflict.count({ where: { status: "RESOLVED" } }),

    // Releases
    db.ruleRelease.count(),
    db.ruleRelease.findFirst({
      orderBy: { releasedAt: "desc" },
      select: { version: true, releasedAt: true },
    }),

    // Agent runs
    db.agentRun.count({ where: { startedAt: { gte: today } } }),
    db.agentRun.count({ where: { startedAt: { gte: today }, status: "completed" } }),
    db.agentRun.count({ where: { startedAt: { gte: today }, status: "failed" } }),
  ])

  return {
    activeEndpoints,
    endpointsWithErrors,
    pendingItems,
    fetchedItems,
    evidenceTotal,
    evidenceUnprocessed,
    pointersTotal,
    pointersUngrouped,
    rulesDraft,
    rulesApproved,
    rulesActive,
    rulesStale: 0, // TODO: Calculate based on effectiveUntil
    conflictsOpen,
    conflictsResolved,
    releasesTotal,
    latestReleaseVersion: latestRelease?.version ?? null,
    latestReleaseDate: latestRelease?.releasedAt ?? null,
    agentRunsToday,
    agentRunsSuccess,
    agentRunsFailed,
    collectedAt: new Date(),
  }
}

/**
 * Get endpoint health summary.
 */
export async function getEndpointHealth(): Promise<
  Array<{
    id: string
    name: string
    domain: string
    status: "healthy" | "degraded" | "failing"
    lastScrapedAt: Date | null
    consecutiveErrors: number
    itemsDiscovered: number
  }>
> {
  const endpoints = await db.discoveryEndpoint.findMany({
    where: { isActive: true },
    include: {
      _count: { select: { discoveries: true } },
    },
    orderBy: { priority: "asc" },
  })

  return endpoints.map((ep) => ({
    id: ep.id,
    name: ep.name,
    domain: ep.domain,
    status:
      ep.consecutiveErrors === 0 ? "healthy" : ep.consecutiveErrors < 3 ? "degraded" : "failing",
    lastScrapedAt: ep.lastScrapedAt,
    consecutiveErrors: ep.consecutiveErrors,
    itemsDiscovered: ep._count.discoveries,
  }))
}

/**
 * Get recent agent runs.
 */
export async function getRecentAgentRuns(limit: number = 20): Promise<
  Array<{
    id: string
    agentType: string
    startedAt: Date
    completedAt: Date | null
    success: boolean
    error: string | null
    inputId: string | null
    outputId: string | null
  }>
> {
  const runs = await db.agentRun.findMany({
    orderBy: { startedAt: "desc" },
    take: limit,
  })

  return runs.map((run) => ({
    id: run.id,
    agentType: run.agentType,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    success: run.status === "completed",
    error: run.error,
    inputId: run.evidenceId,
    outputId: run.ruleId,
  }))
}
