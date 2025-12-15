import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withApiLogging } from "@/lib/api-logging"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"

interface HealthCheck {
  status: "ok" | "degraded" | "failed"
  latency?: number
  message?: string
}

/**
 * Readiness probe endpoint for Kubernetes/Docker
 * More strict than /health - checks if app is ready to receive traffic
 * Returns 200 if ready, 503 if not ready
 * Does NOT require authentication (for orchestration tools)
 */
export const GET = withApiLogging(async () => {
  const checks: Record<string, HealthCheck> = {}
  let overallStatus: "ready" | "not_ready" = "ready"

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
    overallStatus = "not_ready"
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
  const uptimeSeconds = Math.round(process.uptime())

  // App should be running for at least 5 seconds before being ready
  if (uptimeSeconds < 5) {
    checks.uptime = {
      status: "failed",
      message: "App still initializing",
    }
    overallStatus = "not_ready"
  } else {
    checks.uptime = {
      status: "ok",
      message: `${uptimeSeconds}s`,
    }
  }

  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || process.env.npm_package_version || "0.1.0",
    uptime: uptimeSeconds,
    checks,
  }

  const statusCode = overallStatus === "not_ready" ? 503 : 200

  return NextResponse.json(response, { status: statusCode })
})
