// src/lib/regulatory-truth/watchdog/health-monitors.ts

import { db } from "@/lib/db"
import type { WatchdogHealthStatus, WatchdogCheckType } from "@prisma/client"
import type { HealthCheckResult } from "./types"
import { getThreshold } from "./types"
import { raiseAlert } from "./alerting"
import {
  allQueues,
  checkRedisHealth,
  deadletterQueue,
  getDrainerIdleMinutes,
  getDrainerHeartbeat,
} from "../workers"

/**
 * Update health status in database
 */
async function updateHealth(result: HealthCheckResult): Promise<void> {
  await db.watchdogHealth.upsert({
    where: {
      checkType_entityId: {
        checkType: result.checkType,
        entityId: result.entityId,
      },
    },
    create: {
      checkType: result.checkType,
      entityId: result.entityId,
      status: result.status,
      metric: result.metric,
      threshold: result.threshold,
      message: result.message,
      lastHealthy: result.status === "HEALTHY" ? new Date() : undefined,
    },
    update: {
      status: result.status,
      metric: result.metric,
      threshold: result.threshold,
      message: result.message,
      lastChecked: new Date(),
      lastHealthy: result.status === "HEALTHY" ? new Date() : undefined,
    },
  })
}

/**
 * Check for stale sources (no new items in X days)
 */
export async function checkStaleSources(): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = []
  const warningDays = getThreshold("STALE_SOURCE_WARNING_DAYS")
  const criticalDays = getThreshold("STALE_SOURCE_CRITICAL_DAYS")

  const sources = await db.regulatorySource.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      evidence: {
        orderBy: { fetchedAt: "desc" },
        take: 1,
        select: { fetchedAt: true },
      },
    },
  })

  for (const source of sources) {
    const lastFetch = source.evidence[0]?.fetchedAt
    const daysSince = lastFetch
      ? (Date.now() - lastFetch.getTime()) / (1000 * 60 * 60 * 24)
      : Infinity

    let status: WatchdogHealthStatus = "HEALTHY"
    if (daysSince >= criticalDays) {
      status = "CRITICAL"
      await raiseAlert({
        severity: "CRITICAL",
        type: "STALE_SOURCE",
        entityId: source.id,
        message: `Source "${source.name}" has no new items for ${Math.floor(daysSince)} days`,
      })
    } else if (daysSince >= warningDays) {
      status = "WARNING"
      await raiseAlert({
        severity: "WARNING",
        type: "STALE_SOURCE",
        entityId: source.id,
        message: `Source "${source.name}" has no new items for ${Math.floor(daysSince)} days`,
      })
    }

    const result: HealthCheckResult = {
      checkType: "STALE_SOURCE",
      entityId: source.id,
      status,
      metric: daysSince,
      threshold: status === "CRITICAL" ? criticalDays : warningDays,
      message: `${Math.floor(daysSince)} days since last item`,
    }

    await updateHealth(result)
    results.push(result)
  }

  return results
}

/**
 * Check scraper failure rate
 */
export async function checkScraperFailureRate(): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = []
  const warningRate = getThreshold("FAILURE_RATE_WARNING")
  const criticalRate = getThreshold("FAILURE_RATE_CRITICAL")
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)

  // Count fetches by status in last 24h
  const fetchStats = await db.evidence.groupBy({
    by: ["sourceId"],
    where: { fetchedAt: { gte: cutoff } },
    _count: { id: true },
  })

  // This is simplified - in practice you'd track fetch attempts vs successes
  // For now, we'll check based on evidence with empty content
  for (const stat of fetchStats) {
    const total = stat._count.id
    const failed = await db.evidence.count({
      where: {
        sourceId: stat.sourceId,
        fetchedAt: { gte: cutoff },
        OR: [{ rawContent: "" }, { rawContent: null }],
      },
    })

    const failureRate = total > 0 ? failed / total : 0
    let status: WatchdogHealthStatus = "HEALTHY"

    if (failureRate >= criticalRate) {
      status = "CRITICAL"
      await raiseAlert({
        severity: "CRITICAL",
        type: "SCRAPER_FAILURE",
        entityId: stat.sourceId,
        message: `Scraper failure rate is ${(failureRate * 100).toFixed(1)}%`,
      })
    } else if (failureRate >= warningRate) {
      status = "WARNING"
      await raiseAlert({
        severity: "WARNING",
        type: "SCRAPER_FAILURE",
        entityId: stat.sourceId,
        message: `Scraper failure rate is ${(failureRate * 100).toFixed(1)}%`,
      })
    }

    const result: HealthCheckResult = {
      checkType: "SCRAPER_FAILURE",
      entityId: stat.sourceId,
      status,
      metric: failureRate,
      threshold: status === "CRITICAL" ? criticalRate : warningRate,
      message: `${(failureRate * 100).toFixed(1)}% failure rate (${failed}/${total})`,
    }

    await updateHealth(result)
    results.push(result)
  }

  return results
}

/**
 * Check rule quality (average confidence)
 */
export async function checkQualityDegradation(): Promise<HealthCheckResult> {
  const warningConf = getThreshold("CONFIDENCE_WARNING")
  const criticalConf = getThreshold("CONFIDENCE_CRITICAL")
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const stats = await db.regulatoryRule.aggregate({
    where: { createdAt: { gte: cutoff } },
    _avg: { confidence: true },
    _count: { id: true },
  })

  const avgConfidence = stats._avg.confidence ?? 1
  let status: WatchdogHealthStatus = "HEALTHY"

  if (avgConfidence < criticalConf) {
    status = "CRITICAL"
    await raiseAlert({
      severity: "CRITICAL",
      type: "QUALITY_DEGRADATION",
      message: `Average rule confidence is ${(avgConfidence * 100).toFixed(1)}%`,
    })
  } else if (avgConfidence < warningConf) {
    status = "WARNING"
    await raiseAlert({
      severity: "WARNING",
      type: "QUALITY_DEGRADATION",
      message: `Average rule confidence is ${(avgConfidence * 100).toFixed(1)}%`,
    })
  }

  const result: HealthCheckResult = {
    checkType: "QUALITY_DEGRADATION",
    entityId: "global",
    status,
    metric: avgConfidence,
    threshold: status === "CRITICAL" ? criticalConf : warningConf,
    message: `Avg confidence: ${(avgConfidence * 100).toFixed(1)}% (${stats._count.id} rules)`,
  }

  await updateHealth(result)
  return result
}

/**
 * Check rejection rate
 */
export async function checkRejectionRate(): Promise<HealthCheckResult> {
  const warningRate = getThreshold("REJECTION_RATE_WARNING")
  const criticalRate = getThreshold("REJECTION_RATE_CRITICAL")
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const approved = await db.regulatoryRule.count({
    where: { status: "APPROVED", updatedAt: { gte: cutoff } },
  })
  const rejected = await db.regulatoryRule.count({
    where: { status: "REJECTED", updatedAt: { gte: cutoff } },
  })

  const total = approved + rejected
  const rejectionRate = total > 0 ? rejected / total : 0
  let status: WatchdogHealthStatus = "HEALTHY"

  if (rejectionRate >= criticalRate) {
    status = "CRITICAL"
    await raiseAlert({
      severity: "CRITICAL",
      type: "HIGH_REJECTION_RATE",
      message: `Rejection rate is ${(rejectionRate * 100).toFixed(1)}%`,
    })
  } else if (rejectionRate >= warningRate) {
    status = "WARNING"
    await raiseAlert({
      severity: "WARNING",
      type: "HIGH_REJECTION_RATE",
      message: `Rejection rate is ${(rejectionRate * 100).toFixed(1)}%`,
    })
  }

  const result: HealthCheckResult = {
    checkType: "REJECTION_RATE",
    entityId: "global",
    status,
    metric: rejectionRate,
    threshold: status === "CRITICAL" ? criticalRate : warningRate,
    message: `${(rejectionRate * 100).toFixed(1)}% rejection rate (${rejected}/${total})`,
  }

  await updateHealth(result)
  return result
}

/**
 * Run all health checks
 */
export async function runAllHealthChecks(): Promise<HealthCheckResult[]> {
  console.log("[health] Running all health checks...")

  const results: HealthCheckResult[] = []

  const staleResults = await checkStaleSources()
  results.push(...staleResults)

  const failureResults = await checkScraperFailureRate()
  results.push(...failureResults)

  const qualityResult = await checkQualityDegradation()
  results.push(qualityResult)

  const rejectionResult = await checkRejectionRate()
  results.push(rejectionResult)

  // PR #90 fix: Add drainer stall check
  const drainerResult = await checkDrainerStall()
  results.push(drainerResult)

  const healthy = results.filter((r) => r.status === "HEALTHY").length
  const warning = results.filter((r) => r.status === "WARNING").length
  const critical = results.filter((r) => r.status === "CRITICAL").length

  console.log(`[health] Complete: ${healthy} healthy, ${warning} warnings, ${critical} critical`)

  return results
}

/**
 * Check Redis connection health
 */
export async function checkRedisConnectionHealth(): Promise<HealthCheckResult> {
  const healthy = await checkRedisHealth()

  return {
    checkType: "PIPELINE_HEALTH" as const,
    entityId: "redis",
    status: healthy ? "HEALTHY" : "CRITICAL",
    message: healthy ? "Redis connected" : "Redis connection failed",
  }
}

/**
 * Check dead letter queue for accumulated failures
 */
export async function checkDeadLetterQueueHealth(): Promise<HealthCheckResult> {
  const counts = await deadletterQueue.getJobCounts("waiting", "failed")
  const total = counts.waiting + counts.failed

  let status: "HEALTHY" | "WARNING" | "CRITICAL" = "HEALTHY"
  if (total > 50) status = "CRITICAL"
  else if (total > 10) status = "WARNING"

  return {
    checkType: "REJECTION_RATE" as const,
    entityId: "dead-letter-queue",
    status,
    message: `${total} jobs in dead-letter queue`,
  }
}

/**
 * Check queue backlogs
 */
export async function checkQueueBacklogHealth(): Promise<HealthCheckResult> {
  const backlogs: Record<string, number> = {}
  let maxBacklog = 0

  for (const [name, queue] of Object.entries(allQueues)) {
    const counts = await queue.getJobCounts("waiting")
    backlogs[name] = counts.waiting
    maxBacklog = Math.max(maxBacklog, counts.waiting)
  }

  let status: "HEALTHY" | "WARNING" | "CRITICAL" = "HEALTHY"
  if (maxBacklog > 100) status = "CRITICAL"
  else if (maxBacklog > 50) status = "WARNING"

  return {
    checkType: "PIPELINE_HEALTH" as const,
    entityId: "queue-backlog",
    status,
    message: `Max queue backlog: ${maxBacklog}`,
  }
}

/**
 * PR #90 fix: Check drainer stall status
 * Detects when the continuous drainer hasn't made progress for too long
 */
export async function checkDrainerStall(): Promise<HealthCheckResult> {
  const warningMinutes = getThreshold("DRAINER_STALL_WARNING_MINUTES")
  const criticalMinutes = getThreshold("DRAINER_STALL_CRITICAL_MINUTES")

  const idleMinutes = await getDrainerIdleMinutes()
  const heartbeat = await getDrainerHeartbeat()

  let status: WatchdogHealthStatus = "HEALTHY"

  if (idleMinutes === Infinity) {
    // No heartbeat found - drainer may not have started
    status = "WARNING"
    await raiseAlert({
      severity: "WARNING",
      type: "DRAINER_STALL",
      message: "Drainer has no heartbeat - may not be running",
      details: { idleMinutes, heartbeat: null },
    })
  } else if (idleMinutes >= criticalMinutes) {
    status = "CRITICAL"
    await raiseAlert({
      severity: "CRITICAL",
      type: "DRAINER_STALL",
      message: `Drainer stalled for ${Math.floor(idleMinutes)} minutes`,
      details: { idleMinutes, heartbeat },
    })
  } else if (idleMinutes >= warningMinutes) {
    status = "WARNING"
    await raiseAlert({
      severity: "WARNING",
      type: "DRAINER_STALL",
      message: `Drainer idle for ${Math.floor(idleMinutes)} minutes`,
      details: { idleMinutes, heartbeat },
    })
  }

  const result: HealthCheckResult = {
    checkType: "DRAINER_PROGRESS",
    entityId: "continuous-drainer",
    status,
    metric: idleMinutes === Infinity ? -1 : idleMinutes,
    threshold: status === "CRITICAL" ? criticalMinutes : warningMinutes,
    message:
      idleMinutes === Infinity
        ? "No heartbeat found"
        : `${Math.floor(idleMinutes)} minutes since last activity (cycle ${heartbeat?.cycleCount ?? 0}, ${heartbeat?.itemsProcessed ?? 0} items)`,
  }

  await updateHealth(result)
  return result
}
