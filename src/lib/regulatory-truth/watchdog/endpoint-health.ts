// src/lib/regulatory-truth/watchdog/endpoint-health.ts
// Endpoint health monitoring for Discovery v1
// Implements alerts for SLA breach, consecutive errors, circuit breaker

import { db } from "@/lib/db"
import { DiscoveryPriority } from "@prisma/client"
import { raiseAlert } from "./alerting"
import { sendSlackMessage } from "./slack"
import { rateLimiter } from "../utils/rate-limiter"

// Thresholds (can be moved to config if needed)
const SLA_BREACH_HOURS = 24
const CONSECUTIVE_ERRORS_THRESHOLD = 3

export interface EndpointHealthStatus {
  id: string
  domain: string
  path: string
  name: string
  priority: DiscoveryPriority
  lastSuccessAt: Date | null
  consecutiveErrors: number
  lastError: string | null
  isActive: boolean
  // Computed health flags
  isSlaBreached: boolean
  hasConsecutiveErrors: boolean
  hoursSinceSuccess: number | null
}

export interface EndpointHealthReport {
  timestamp: Date
  runId: string
  totalCritical: number
  healthyCritical: number
  unhealthyCritical: number
  endpoints: EndpointHealthStatus[]
  alertsRaised: string[]
}

/**
 * Compute health status for all CRITICAL endpoints.
 * Returns structured data for alerting and reporting.
 */
export async function computeEndpointHealth(
  priority: DiscoveryPriority = "CRITICAL"
): Promise<EndpointHealthStatus[]> {
  const now = new Date()
  const slaThreshold = new Date(now.getTime() - SLA_BREACH_HOURS * 60 * 60 * 1000)

  const endpoints = await db.discoveryEndpoint.findMany({
    where: {
      priority,
      isActive: true,
    },
    select: {
      id: true,
      domain: true,
      path: true,
      name: true,
      priority: true,
      lastScrapedAt: true,
      consecutiveErrors: true,
      lastError: true,
      isActive: true,
    },
  })

  return endpoints.map((ep) => {
    const lastSuccessAt = ep.lastScrapedAt
    const hoursSinceSuccess = lastSuccessAt
      ? (now.getTime() - lastSuccessAt.getTime()) / (1000 * 60 * 60)
      : null

    // SLA breach: never scraped OR last success > 24h ago
    const isSlaBreached = lastSuccessAt === null || lastSuccessAt < slaThreshold

    // Consecutive errors threshold
    const hasConsecutiveErrors = ep.consecutiveErrors >= CONSECUTIVE_ERRORS_THRESHOLD

    return {
      id: ep.id,
      domain: ep.domain,
      path: ep.path,
      name: ep.name,
      priority: ep.priority,
      lastSuccessAt,
      consecutiveErrors: ep.consecutiveErrors,
      lastError: ep.lastError,
      isActive: ep.isActive,
      isSlaBreached,
      hasConsecutiveErrors,
      hoursSinceSuccess:
        hoursSinceSuccess !== null ? Math.round(hoursSinceSuccess * 10) / 10 : null,
    }
  })
}

/**
 * Get circuit breaker status for all tracked domains.
 */
export function getCircuitBreakerStatus(): {
  domain: string
  isOpen: boolean
  consecutiveErrors: number
}[] {
  const health = rateLimiter.getHealthStatus()
  return Object.entries(health.domains).map(([domain, status]) => ({
    domain,
    isOpen: status.isCircuitBroken,
    consecutiveErrors: status.consecutiveErrors,
  }))
}

/**
 * Run endpoint health checks and raise alerts for unhealthy conditions.
 * Called by scheduler after sentinel runs.
 */
export async function runEndpointHealthCheck(runId: string): Promise<EndpointHealthReport> {
  const timestamp = new Date()
  const alertsRaised: string[] = []

  // 1. Get CRITICAL endpoint health
  const endpoints = await computeEndpointHealth("CRITICAL")

  const totalCritical = endpoints.length
  const unhealthy = endpoints.filter((e) => e.isSlaBreached || e.hasConsecutiveErrors)
  const healthyCritical = totalCritical - unhealthy.length

  console.log(
    `[endpoint-health] Checked ${totalCritical} CRITICAL endpoints: ` +
      `${healthyCritical} healthy, ${unhealthy.length} unhealthy`
  )

  // 2. Raise alerts for SLA breaches
  for (const ep of endpoints.filter((e) => e.isSlaBreached)) {
    const alertId = await raiseAlert({
      severity: "CRITICAL",
      type: "ENDPOINT_SLA_BREACH",
      entityId: ep.id,
      message: `CRITICAL endpoint "${ep.name}" SLA breach: ${
        ep.lastSuccessAt
          ? `last success ${ep.hoursSinceSuccess}h ago`
          : "never successfully scraped"
      }`,
      details: {
        endpoint: `${ep.domain}${ep.path}`,
        name: ep.name,
        priority: ep.priority,
        lastSuccessAt: ep.lastSuccessAt?.toISOString() ?? null,
        hoursSinceSuccess: ep.hoursSinceSuccess,
        threshold: SLA_BREACH_HOURS,
        runId,
      },
    })
    alertsRaised.push(alertId)
  }

  // 3. Raise alerts for consecutive errors (only if not already SLA breached to avoid spam)
  for (const ep of endpoints.filter((e) => e.hasConsecutiveErrors && !e.isSlaBreached)) {
    const alertId = await raiseAlert({
      severity: "CRITICAL",
      type: "ENDPOINT_CONSECUTIVE_ERRORS",
      entityId: ep.id,
      message: `CRITICAL endpoint "${ep.name}" has ${ep.consecutiveErrors} consecutive errors`,
      details: {
        endpoint: `${ep.domain}${ep.path}`,
        name: ep.name,
        priority: ep.priority,
        consecutiveErrors: ep.consecutiveErrors,
        lastError: ep.lastError,
        threshold: CONSECUTIVE_ERRORS_THRESHOLD,
        runId,
      },
    })
    alertsRaised.push(alertId)
  }

  // 4. Check circuit breakers
  const breakers = getCircuitBreakerStatus()
  for (const breaker of breakers.filter((b) => b.isOpen)) {
    const alertId = await raiseAlert({
      severity: "CRITICAL",
      type: "CIRCUIT_BREAKER_OPEN",
      entityId: breaker.domain,
      message: `Circuit breaker OPEN for domain "${breaker.domain}" after ${breaker.consecutiveErrors} errors`,
      details: {
        domain: breaker.domain,
        consecutiveErrors: breaker.consecutiveErrors,
        runId,
      },
    })
    alertsRaised.push(alertId)
  }

  // 5. Check for recovered endpoints (previously had alerts, now healthy)
  await checkForRecoveries(endpoints, runId)

  return {
    timestamp,
    runId,
    totalCritical,
    healthyCritical,
    unhealthyCritical: unhealthy.length,
    endpoints,
    alertsRaised,
  }
}

/**
 * Check for endpoints that have recovered from unhealthy state.
 * Sends Slack-only notification (not stored as alert).
 */
async function checkForRecoveries(
  currentHealth: EndpointHealthStatus[],
  runId: string
): Promise<void> {
  // Find endpoints that are now healthy
  const healthyEndpoints = currentHealth.filter((e) => !e.isSlaBreached && !e.hasConsecutiveErrors)

  if (healthyEndpoints.length === 0) return

  // Check if any of these had recent unresolved alerts
  const { db } = await import("@/lib/db")
  const recentAlerts = await db.watchdogAlert.findMany({
    where: {
      type: {
        in: ["ENDPOINT_SLA_BREACH", "ENDPOINT_CONSECUTIVE_ERRORS"],
      },
      entityId: {
        in: healthyEndpoints.map((e) => e.id),
      },
      resolvedAt: null,
      occurredAt: {
        // Only look at alerts from last 7 days
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    },
  })

  if (recentAlerts.length === 0) return

  // Group by endpoint
  const alertsByEndpoint = new Map<string, typeof recentAlerts>()
  for (const alert of recentAlerts) {
    if (!alert.entityId) continue
    const existing = alertsByEndpoint.get(alert.entityId) || []
    existing.push(alert)
    alertsByEndpoint.set(alert.entityId, existing)
  }

  // Send recovery notifications and resolve alerts
  for (const [endpointId, alerts] of alertsByEndpoint) {
    const endpoint = healthyEndpoints.find((e) => e.id === endpointId)
    if (!endpoint) continue

    // Send Slack notification (not stored as alert)
    await sendSlackMessage({
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: "✅ Endpoint Recovered", emoji: true },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Endpoint:*\n${endpoint.name}` },
            { type: "mrkdwn", text: `*Domain:*\n${endpoint.domain}` },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `Endpoint \`${endpoint.domain}${endpoint.path}\` has recovered and is now healthy.`,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Run: ${runId} | Resolved ${alerts.length} alert(s)`,
            },
          ],
        },
      ],
    })

    // Resolve the alerts
    for (const alert of alerts) {
      await db.watchdogAlert.update({
        where: { id: alert.id },
        data: { resolvedAt: new Date() },
      })
    }

    console.log(
      `[endpoint-health] Endpoint "${endpoint.name}" recovered, resolved ${alerts.length} alert(s)`
    )
  }
}

/**
 * Export sendSlackMessage for internal use (recovery notifications)
 */
export { sendSlackMessage } from "./slack"
