// src/lib/regulatory-truth/monitoring/metrics.ts
import { db } from "@/lib/db"
import { drizzleDb } from "@/lib/db/drizzle"
import { contentSyncEvents } from "@/lib/db/schema/content-sync"
import { sql, count, avg } from "drizzle-orm"

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
    rulesStale,
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
    db.regulatoryRule.count({ where: { status: "PUBLISHED" } }),

    // Stale rules (effectiveUntil has passed)
    db.regulatoryRule.count({
      where: {
        status: "PUBLISHED",
        effectiveUntil: { lt: new Date() },
      },
    }),

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
    rulesStale,
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

// =============================================================================
// Content Pipeline Metrics - Article Agent
// =============================================================================

export interface ArticleAgentMetrics {
  // Job counts
  totalJobs: number
  jobsToday: number
  jobsThisWeek: number

  // Status breakdown
  synthesizing: number
  planning: number
  drafting: number
  verifying: number
  needsReview: number
  approved: number
  published: number
  rejected: number

  // Success rates
  successRate: number // approved + published / total completed
  needsReviewRate: number

  // Performance
  avgIterationsToApproval: number
  avgVerificationConfidence: number

  // Timing
  collectedAt: Date
}

/**
 * Collect Article Agent pipeline metrics.
 */
export async function collectArticleAgentMetrics(): Promise<ArticleAgentMetrics> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  weekAgo.setHours(0, 0, 0, 0)

  const [
    totalJobs,
    jobsToday,
    jobsThisWeek,
    synthesizing,
    planning,
    drafting,
    verifying,
    needsReview,
    approved,
    published,
    rejected,
    avgIterations,
    avgConfidence,
  ] = await Promise.all([
    db.articleJob.count(),
    db.articleJob.count({ where: { createdAt: { gte: today } } }),
    db.articleJob.count({ where: { createdAt: { gte: weekAgo } } }),
    db.articleJob.count({ where: { status: "SYNTHESIZING" } }),
    db.articleJob.count({ where: { status: "PLANNING" } }),
    db.articleJob.count({ where: { status: "DRAFTING" } }),
    db.articleJob.count({ where: { status: "VERIFYING" } }),
    db.articleJob.count({ where: { status: "NEEDS_REVIEW" } }),
    db.articleJob.count({ where: { status: "APPROVED" } }),
    db.articleJob.count({ where: { status: "PUBLISHED" } }),
    db.articleJob.count({ where: { status: "REJECTED" } }),
    db.articleJob.aggregate({
      where: { status: { in: ["APPROVED", "PUBLISHED"] } },
      _avg: { currentIteration: true },
    }),
    db.draftParagraph.aggregate({
      _avg: { confidence: true },
    }),
  ])

  const totalCompleted = approved + published + rejected + needsReview
  const successRate = totalCompleted > 0 ? (approved + published) / totalCompleted : 0
  const needsReviewRate = totalCompleted > 0 ? needsReview / totalCompleted : 0

  return {
    totalJobs,
    jobsToday,
    jobsThisWeek,
    synthesizing,
    planning,
    drafting,
    verifying,
    needsReview,
    approved,
    published,
    rejected,
    successRate: Math.round(successRate * 100),
    needsReviewRate: Math.round(needsReviewRate * 100),
    avgIterationsToApproval: avgIterations._avg.currentIteration ?? 0,
    avgVerificationConfidence: Math.round((avgConfidence._avg.confidence ?? 0) * 100),
    collectedAt: new Date(),
  }
}

/**
 * Get recent Article Agent jobs.
 */
export async function getRecentArticleJobs(limit: number = 20): Promise<
  Array<{
    id: string
    type: string
    status: string
    topic: string | null
    currentIteration: number
    maxIterations: number
    createdAt: Date
    updatedAt: Date
  }>
> {
  const jobs = await db.articleJob.findMany({
    orderBy: { updatedAt: "desc" },
    take: limit,
  })

  return jobs.map((job) => ({
    id: job.id,
    type: job.type,
    status: job.status,
    topic: job.topic,
    currentIteration: job.currentIteration,
    maxIterations: job.maxIterations,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  }))
}

// =============================================================================
// Content Pipeline Metrics - Content Sync
// =============================================================================

export interface ContentSyncMetrics {
  // Event counts
  totalEvents: number
  eventsToday: number
  eventsThisWeek: number

  // Status breakdown
  pending: number
  enqueued: number
  processing: number
  done: number
  failed: number
  deadLettered: number
  skipped: number

  // Success rates
  successRate: number // done / total processed
  failureRate: number
  deadLetterRate: number

  // Dead letter reasons
  deadLetterReasons: Array<{
    reason: string
    count: number
  }>

  // Performance
  avgAttemptsToSuccess: number

  // Timing
  collectedAt: Date
}

/**
 * Collect Content Sync pipeline metrics.
 */
export async function collectContentSyncMetrics(): Promise<ContentSyncMetrics> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  weekAgo.setHours(0, 0, 0, 0)

  // Use Drizzle for content sync events
  const statusCounts = await drizzleDb
    .select({
      status: contentSyncEvents.status,
      count: count(),
    })
    .from(contentSyncEvents)
    .groupBy(contentSyncEvents.status)

  const todayCounts = await drizzleDb
    .select({ count: count() })
    .from(contentSyncEvents)
    .where(sql`${contentSyncEvents.createdAt} >= ${today}`)

  const weekCounts = await drizzleDb
    .select({ count: count() })
    .from(contentSyncEvents)
    .where(sql`${contentSyncEvents.createdAt} >= ${weekAgo}`)

  const totalCount = await drizzleDb
    .select({ count: count() })
    .from(contentSyncEvents)

  const avgAttempts = await drizzleDb
    .select({ avg: avg(contentSyncEvents.attempts) })
    .from(contentSyncEvents)
    .where(sql`${contentSyncEvents.status} = 'DONE'`)

  const deadLetterReasons = await drizzleDb
    .select({
      reason: contentSyncEvents.deadLetterReason,
      count: count(),
    })
    .from(contentSyncEvents)
    .where(sql`${contentSyncEvents.status} = 'DEAD_LETTERED'`)
    .groupBy(contentSyncEvents.deadLetterReason)

  // Extract counts by status
  const getStatusCount = (status: string) => {
    const found = statusCounts.find((s) => s.status === status)
    return found ? Number(found.count) : 0
  }

  const pending = getStatusCount("PENDING")
  const enqueued = getStatusCount("ENQUEUED")
  const processing = getStatusCount("PROCESSING")
  const done = getStatusCount("DONE")
  const failed = getStatusCount("FAILED")
  const deadLettered = getStatusCount("DEAD_LETTERED")
  const skipped = getStatusCount("SKIPPED")

  const totalProcessed = done + failed + deadLettered + skipped
  const successRate = totalProcessed > 0 ? (done + skipped) / totalProcessed : 0
  const failureRate = totalProcessed > 0 ? failed / totalProcessed : 0
  const deadLetterRate = totalProcessed > 0 ? deadLettered / totalProcessed : 0

  return {
    totalEvents: Number(totalCount[0]?.count ?? 0),
    eventsToday: Number(todayCounts[0]?.count ?? 0),
    eventsThisWeek: Number(weekCounts[0]?.count ?? 0),
    pending,
    enqueued,
    processing,
    done,
    failed,
    deadLettered,
    skipped,
    successRate: Math.round(successRate * 100),
    failureRate: Math.round(failureRate * 100),
    deadLetterRate: Math.round(deadLetterRate * 100),
    deadLetterReasons: deadLetterReasons
      .filter((r) => r.reason !== null)
      .map((r) => ({
        reason: r.reason!,
        count: Number(r.count),
      })),
    avgAttemptsToSuccess: Number(avgAttempts[0]?.avg ?? 0),
    collectedAt: new Date(),
  }
}

/**
 * Get recent Content Sync events.
 */
export async function getRecentContentSyncEvents(limit: number = 20): Promise<
  Array<{
    eventId: string
    type: string
    status: string
    ruleId: string
    conceptId: string
    domain: string
    attempts: number
    createdAt: Date
    processedAt: Date | null
    lastError: string | null
    deadLetterReason: string | null
  }>
> {
  const events = await drizzleDb
    .select({
      eventId: contentSyncEvents.eventId,
      type: contentSyncEvents.type,
      status: contentSyncEvents.status,
      ruleId: contentSyncEvents.ruleId,
      conceptId: contentSyncEvents.conceptId,
      domain: contentSyncEvents.domain,
      attempts: contentSyncEvents.attempts,
      createdAt: contentSyncEvents.createdAt,
      processedAt: contentSyncEvents.processedAt,
      lastError: contentSyncEvents.lastError,
      deadLetterReason: contentSyncEvents.deadLetterReason,
    })
    .from(contentSyncEvents)
    .orderBy(sql`${contentSyncEvents.createdAt} DESC`)
    .limit(limit)

  return events.map((e) => ({
    eventId: e.eventId,
    type: e.type,
    status: e.status,
    ruleId: e.ruleId,
    conceptId: e.conceptId,
    domain: e.domain,
    attempts: e.attempts,
    createdAt: e.createdAt,
    processedAt: e.processedAt,
    lastError: e.lastError,
    deadLetterReason: e.deadLetterReason,
  }))
}

// =============================================================================
// Combined Content Pipeline Health
// =============================================================================

export interface ContentPipelineHealth {
  articleAgent: {
    status: "healthy" | "degraded" | "unhealthy"
    activeJobs: number
    pendingReview: number
    recentFailures: number
  }
  contentSync: {
    status: "healthy" | "degraded" | "unhealthy"
    pendingEvents: number
    processingEvents: number
    deadLettered: number
  }
  overallStatus: "healthy" | "degraded" | "unhealthy"
}

/**
 * Get overall content pipeline health status.
 */
export async function getContentPipelineHealth(): Promise<ContentPipelineHealth> {
  const [articleMetrics, syncMetrics] = await Promise.all([
    collectArticleAgentMetrics(),
    collectContentSyncMetrics(),
  ])

  // Determine Article Agent health
  const articleActiveJobs =
    articleMetrics.synthesizing +
    articleMetrics.planning +
    articleMetrics.drafting +
    articleMetrics.verifying
  const articlePendingReview = articleMetrics.needsReview
  const articleRecentFailures = articleMetrics.rejected

  let articleStatus: "healthy" | "degraded" | "unhealthy" = "healthy"
  if (articlePendingReview > 10 || articleRecentFailures > 5) {
    articleStatus = "unhealthy"
  } else if (articlePendingReview > 5 || articleRecentFailures > 2) {
    articleStatus = "degraded"
  }

  // Determine Content Sync health
  let syncStatus: "healthy" | "degraded" | "unhealthy" = "healthy"
  if (syncMetrics.deadLettered > 10 || syncMetrics.failed > 20) {
    syncStatus = "unhealthy"
  } else if (syncMetrics.deadLettered > 3 || syncMetrics.failed > 5) {
    syncStatus = "degraded"
  }

  // Overall status
  let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy"
  if (articleStatus === "unhealthy" || syncStatus === "unhealthy") {
    overallStatus = "unhealthy"
  } else if (articleStatus === "degraded" || syncStatus === "degraded") {
    overallStatus = "degraded"
  }

  return {
    articleAgent: {
      status: articleStatus,
      activeJobs: articleActiveJobs,
      pendingReview: articlePendingReview,
      recentFailures: articleRecentFailures,
    },
    contentSync: {
      status: syncStatus,
      pendingEvents: syncMetrics.pending + syncMetrics.enqueued,
      processingEvents: syncMetrics.processing,
      deadLettered: syncMetrics.deadLettered,
    },
    overallStatus,
  }
}
