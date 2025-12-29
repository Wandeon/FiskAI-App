import { NextResponse } from "next/server"
import { withApiLogging } from "@/lib/api-logging"
import { getContentPipelineHealth } from "@/lib/regulatory-truth/monitoring/metrics"

export const dynamic = "force-dynamic"

/**
 * Content pipeline health check endpoint
 * Returns health status for Article Agent and Content Sync pipelines
 * Does NOT require authentication (for load balancers/monitoring)
 */
export const GET = withApiLogging(async () => {
  const start = Date.now()

  try {
    const health = await getContentPipelineHealth()
    const latency = Date.now() - start

    const statusCode = health.overallStatus === "unhealthy" ? 503 : 200

    return NextResponse.json(
      {
        status: health.overallStatus,
        timestamp: new Date().toISOString(),
        latencyMs: latency,
        pipelines: {
          articleAgent: health.articleAgent,
          contentSync: health.contentSync,
        },
        version: process.env.APP_VERSION || process.env.npm_package_version || "0.1.0",
      },
      { status: statusCode }
    )
  } catch (error) {
    const latency = Date.now() - start

    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        latencyMs: latency,
        error: error instanceof Error ? error.message : "Health check failed",
        version: process.env.APP_VERSION || process.env.npm_package_version || "0.1.0",
      },
      { status: 503 }
    )
  }
})
