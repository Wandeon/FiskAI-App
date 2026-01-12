// src/app/api/admin/sentinel/health/route.ts

import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-utils"
import { getSentinelHealth } from "@/lib/regulatory-truth/utils/rate-limiter"
import { db } from "@/lib/db"
import { dbReg } from "@/lib/db/regulatory"

/**
 * GET /api/admin/sentinel/health
 *
 * Returns Sentinel health status including:
 * - Domain health from rate limiter (circuit breaker states, error rates)
 * - Recent discovery runs
 * - Source checking statistics
 * - Discovery velocity metrics
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication and admin role
    const user = await getCurrentUser()
    if (!user || user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get health data from rate limiter (domain circuit breaker states)
    const rateLimiterHealth = getSentinelHealth()

    // Get recent Sentinel runs (last 24 hours)
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentRuns = await db.agentRun.findMany({
      where: {
        agentType: "SENTINEL",
        startedAt: { gte: last24h },
      },
      orderBy: { startedAt: "desc" },
      take: 20,
      select: {
        id: true,
        status: true,
        startedAt: true,
        completedAt: true,
        error: true,
        output: true,
      },
    })

    // Calculate run statistics
    const totalRuns = recentRuns.length
    const completedRuns = recentRuns.filter((r) => r.status === "COMPLETED").length
    const failedRuns = recentRuns.filter((r) => r.status === "FAILED").length
    const runningRuns = recentRuns.filter((r) => r.status === "RUNNING").length
    const successRate = totalRuns > 0 ? completedRuns / totalRuns : 1

    // Get source statistics
    const totalSources = await dbReg.regulatorySource.count({
      where: { isActive: true },
    })

    // Get sources needing check
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

    // Get recent discovery statistics (last 7 days)
    const last7days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentDiscoveries = await db.discoveredItem.count({
      where: {
        createdAt: { gte: last7days },
      },
    })

    // Get evidence fetched in last 24h
    const recentEvidence = await dbReg.evidence.count({
      where: {
        fetchedAt: { gte: last24h },
      },
    })

    // Get last successful run
    const lastSuccessfulRun = recentRuns.find((r) => r.status === "COMPLETED")

    // Get endpoints by domain
    const endpointsByDomain = await db.$queryRaw<
      Array<{ domain: string; count: number; lastChecked: Date | null }>
    >`
      SELECT
        SUBSTRING("baseUrl" FROM 'https?://([^/]+)') as domain,
        COUNT(*) as count,
        MAX("lastFetchedAt") as "lastChecked"
      FROM "RegulatorySource"
      WHERE "isActive" = true
      GROUP BY domain
      ORDER BY count DESC
    `

    // Calculate overall health
    const domainHealthy = rateLimiterHealth.overallHealthy
    const runsHealthy = successRate >= 0.8
    const sourcesCurrent = needsCheckCount < totalSources * 0.2 // Less than 20% need checking

    let overallStatus: "healthy" | "warning" | "critical"
    if (domainHealthy && runsHealthy && sourcesCurrent) {
      overallStatus = "healthy"
    } else if (
      (domainHealthy && runsHealthy) ||
      (domainHealthy && sourcesCurrent) ||
      (runsHealthy && sourcesCurrent)
    ) {
      overallStatus = "warning"
    } else {
      overallStatus = "critical"
    }

    const response = {
      timestamp: new Date().toISOString(),
      status: overallStatus,
      domains: rateLimiterHealth.domains,
      runs: {
        total24h: totalRuns,
        completed: completedRuns,
        failed: failedRuns,
        running: runningRuns,
        successRate: Math.round(successRate * 100) / 100,
        lastSuccessful: lastSuccessfulRun
          ? {
              id: lastSuccessfulRun.id,
              startedAt: lastSuccessfulRun.startedAt,
              completedAt: lastSuccessfulRun.completedAt,
              duration: lastSuccessfulRun.completedAt
                ? new Date(lastSuccessfulRun.completedAt).getTime() -
                  new Date(lastSuccessfulRun.startedAt).getTime()
                : null,
              output: lastSuccessfulRun.output,
            }
          : null,
        recent: recentRuns.map((run) => ({
          id: run.id,
          status: run.status,
          startedAt: run.startedAt,
          completedAt: run.completedAt,
          duration:
            run.completedAt && run.startedAt
              ? new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()
              : null,
          error: run.error,
        })),
      },
      sources: {
        total: totalSources,
        needingCheck: needsCheckCount,
        percentageOverdue:
          totalSources > 0 ? Math.round((needsCheckCount / totalSources) * 100) : 0,
      },
      discovery: {
        last7days: recentDiscoveries,
        evidenceFetched24h: recentEvidence,
      },
      endpoints: endpointsByDomain.map((e) => ({
        domain: e.domain,
        count: Number(e.count),
        lastChecked: e.lastChecked,
      })),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[sentinel-health] Error fetching Sentinel health:", error)
    return NextResponse.json({ error: "Failed to fetch Sentinel health status" }, { status: 500 })
  }
}
