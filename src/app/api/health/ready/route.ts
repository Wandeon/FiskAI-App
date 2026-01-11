import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withApiLogging } from "@/lib/api-logging"
import { logger } from "@/lib/logger"
import { verifyAllFeatureContracts } from "@/lib/admin/feature-contracts"
import { READINESS_FAILURE_REASONS, type ReadinessFailurePayload } from "@/lib/health/constants"
import { emitContractFailureAlert } from "@/lib/health/alerting"

export const dynamic = "force-dynamic"

const alertLogger = logger.child({ context: "health-ready" })

interface HealthCheck {
  status: "ok" | "degraded" | "failed"
  latency?: number
  message?: string
  details?: Record<string, unknown>
}

/**
 * Readiness probe endpoint for Kubernetes/Docker
 * More strict than /health - checks if app is ready to receive traffic
 * Returns 200 if ready, 503 if not ready
 * Does NOT require authentication (for orchestration tools)
 *
 * On failure, returns structured JSON with:
 * - reason: machine-readable failure code
 * - failingFeatures: for contract failures, which features are missing tables
 * - action: suggested remediation
 */
export const GET = withApiLogging(async () => {
  const checks: Record<string, HealthCheck> = {}
  let overallStatus: "ready" | "not_ready" = "ready"
  let failureReason: string | undefined
  let failingFeatures:
    | Array<{ featureId: string; name: string; missingTables: string[] }>
    | undefined

  const version =
    process.env.SOURCE_COMMIT?.slice(0, 8) ||
    process.env.APP_VERSION ||
    process.env.npm_package_version ||
    "dev"
  const env = process.env.NODE_ENV || "development"
  const uptimeSeconds = Math.round(process.uptime())

  // Database check - CRITICAL for readiness
  const dbStart = Date.now()
  try {
    // More comprehensive DB check - verify we can actually query
    await db.$queryRaw`SELECT 1`
    const latency = Date.now() - dbStart

    // Stricter latency requirement for readiness
    if (latency > 5000) {
      checks.database = {
        status: "failed",
        latency,
        message: "Database response too slow",
      }
      overallStatus = "not_ready"
      failureReason = READINESS_FAILURE_REASONS.DATABASE_UNAVAILABLE
    } else {
      checks.database = {
        status: "ok",
        latency,
      }
    }
  } catch (error) {
    logger.error({ error }, "Database readiness check failed")
    checks.database = {
      status: "failed",
      latency: Date.now() - dbStart,
      message: error instanceof Error ? error.message : "Unknown error",
    }
    overallStatus = "not_ready"
    failureReason = READINESS_FAILURE_REASONS.DATABASE_UNAVAILABLE
  }

  // Memory check - CRITICAL for readiness
  const memUsage = process.memoryUsage()
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024)
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024)
  const heapPercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)

  // Stricter memory threshold for readiness (90% vs 95% in health)
  if (heapPercent > 90) {
    checks.memory = {
      status: "failed",
      message: `${heapUsedMB}MB / ${heapTotalMB}MB (${heapPercent}%) - Too high`,
    }
    if (overallStatus === "ready") {
      overallStatus = "not_ready"
      failureReason = READINESS_FAILURE_REASONS.MEMORY_CRITICAL
    }
  } else if (heapPercent > 80) {
    checks.memory = {
      status: "degraded",
      message: `${heapUsedMB}MB / ${heapTotalMB}MB (${heapPercent}%)`,
    }
  } else {
    checks.memory = {
      status: "ok",
      message: `${heapUsedMB}MB / ${heapTotalMB}MB (${heapPercent}%)`,
    }
  }

  // Uptime check - ensure app has been running for minimum time
  // App should be running for at least 5 seconds before being ready
  if (uptimeSeconds < 5) {
    checks.uptime = {
      status: "failed",
      message: "App still initializing",
    }
    if (overallStatus === "ready") {
      overallStatus = "not_ready"
      failureReason = READINESS_FAILURE_REASONS.INITIALIZING
    }
  } else {
    checks.uptime = {
      status: "ok",
      message: `${uptimeSeconds}s`,
    }
  }

  // Type A Feature Contracts - CRITICAL for readiness
  // If any Type A feature is enabled but missing tables, deployment has failed
  try {
    const { allHealthy, features } = await verifyAllFeatureContracts()
    const enabledFeatures = features.filter((f) => f.enabled)
    const unhealthyFeatures = enabledFeatures.filter((f) => !f.healthy)

    if (enabledFeatures.length === 0) {
      checks.featureContracts = {
        status: "ok",
        message: "No Type A features enabled",
      }
    } else if (allHealthy) {
      checks.featureContracts = {
        status: "ok",
        message: `${enabledFeatures.length} Type A feature(s) healthy`,
        details: {
          features: enabledFeatures.map((f) => f.name),
        },
      }
    } else {
      // Type A contract violation is a deployment defect
      failingFeatures = unhealthyFeatures.map((f) => ({
        featureId: f.featureId,
        name: f.name,
        missingTables: [...f.missingTables],
      }))

      checks.featureContracts = {
        status: "failed",
        message: `${unhealthyFeatures.length} Type A feature(s) missing tables`,
        details: {
          unhealthy: failingFeatures,
        },
      }

      if (overallStatus === "ready") {
        overallStatus = "not_ready"
        failureReason = READINESS_FAILURE_REASONS.MISSING_FEATURE_TABLES
      }

      logger.error(
        { unhealthyFeatures: failingFeatures, severity: "CRITICAL" },
        "Type A feature contract violation detected in readiness check"
      )

      // Emit throttled alert for contract failure (fire-and-forget to not block readiness)
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      emitContractFailureAlert(failingFeatures, version).catch((err) => {
        alertLogger.error({ error: err }, "Failed to emit contract failure alert")
      })
    }
  } catch (error) {
    logger.error({ error }, "Failed to verify feature contracts")
    checks.featureContracts = {
      status: "degraded",
      message: "Could not verify feature contracts",
    }
  }

  // Build response
  if (overallStatus === "not_ready" && failureReason) {
    // Return structured failure payload for actionable alerting
    const failurePayload: ReadinessFailurePayload = {
      status: "not_ready",
      reason: failureReason as ReadinessFailurePayload["reason"],
      timestamp: new Date().toISOString(),
      version,
      env,
      uptime: uptimeSeconds,
      message: getFailureMessage(failureReason, failingFeatures),
      action: getFailureAction(failureReason),
      ...(failingFeatures && { failingFeatures }),
    }

    return NextResponse.json(failurePayload, { status: 503 })
  }

  // Success response
  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version,
    uptime: uptimeSeconds,
    checks,
  }

  return NextResponse.json(response, { status: 200 })
})

/**
 * Get human-readable message for failure reason
 */
function getFailureMessage(
  reason: string,
  failingFeatures?: Array<{ featureId: string; name: string; missingTables: string[] }>
): string {
  switch (reason) {
    case READINESS_FAILURE_REASONS.DATABASE_UNAVAILABLE:
      return "Database is unreachable or responding too slowly"
    case READINESS_FAILURE_REASONS.MEMORY_CRITICAL:
      return "Memory usage exceeds safe threshold (>90%)"
    case READINESS_FAILURE_REASONS.INITIALIZING:
      return "Application is still initializing"
    case READINESS_FAILURE_REASONS.MISSING_FEATURE_TABLES:
      if (failingFeatures) {
        const names = failingFeatures.map((f) => f.name).join(", ")
        return `Type A feature contract violation: ${names} missing required tables`
      }
      return "Type A feature contract violation: required tables missing"
    default:
      return "Application is not ready"
  }
}

/**
 * Get suggested action for failure reason
 */
function getFailureAction(reason: string): string {
  switch (reason) {
    case READINESS_FAILURE_REASONS.DATABASE_UNAVAILABLE:
      return "Check database connectivity and performance"
    case READINESS_FAILURE_REASONS.MEMORY_CRITICAL:
      return "Restart the application or investigate memory leak"
    case READINESS_FAILURE_REASONS.INITIALIZING:
      return "Wait for application startup to complete"
    case READINESS_FAILURE_REASONS.MISSING_FEATURE_TABLES:
      return "Run database migrations: npm run prisma:migrate && npm run db:migrate"
    default:
      return "Investigate application health"
  }
}
