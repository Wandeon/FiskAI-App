import { NextResponse } from "next/server"
import { withApiLogging } from "@/lib/api-logging"
import { checkDatabaseHealth } from "@/lib/monitoring/system-health"

export const dynamic = "force-dynamic"

/**
 * Health check endpoint
 * Returns 200 if healthy, 503 if unhealthy
 * Does NOT require authentication (for load balancers/monitoring)
 */
export const GET = withApiLogging(async () => {
  const checks: Record<string, { status: string; latencyMs?: number; message?: string }> = {}
  let overallStatus: "healthy" | "unhealthy" = "healthy"

  // Database connectivity check
  const dbStart = Date.now()
  try {
    const dbHealth = await checkDatabaseHealth()
    const latency = Date.now() - dbStart

    if (dbHealth.connected) {
      checks.database = {
        status: "up",
        latencyMs: latency,
      }
    } else {
      checks.database = {
        status: "down",
        latencyMs: latency,
      }
      overallStatus = "unhealthy"
    }
  } catch (error) {
    checks.database = {
      status: "down",
      latencyMs: Date.now() - dbStart,
      message: error instanceof Error ? error.message : "Database check failed",
    }
    overallStatus = "unhealthy"
  }

  // Basic app functionality check
  try {
    // Test that the process is running and responsive
    const memUsage = process.memoryUsage()
    const heapPercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)

    checks.app = {
      status: heapPercent < 95 ? "up" : "degraded",
      latencyMs: 0,
      message: `heap ${heapPercent}%`,
    }

    // Avoid flapping container healthchecks: treat high heap usage as degraded unless truly critical.
    if (heapPercent >= 99) {
      overallStatus = "unhealthy"
    }
  } catch (error) {
    checks.app = {
      status: "down",
      message: error instanceof Error ? error.message : "App check failed",
    }
    overallStatus = "unhealthy"
  }

  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
    version: process.env.APP_VERSION || process.env.npm_package_version || "0.1.0",
  }

  const statusCode = overallStatus === "unhealthy" ? 503 : 200

  return NextResponse.json(response, { status: statusCode })
})
