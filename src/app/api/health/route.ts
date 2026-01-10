import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * Liveness probe endpoint for container orchestration
 *
 * Design principles:
 * - Always returns 200 if the process is alive and can handle requests
 * - No external dependencies (no DB, no Redis, no network calls)
 * - Fast response (< 10ms)
 * - No authentication required
 *
 * For full readiness checks (DB, memory, etc.), use /api/health/ready
 *
 * This endpoint is used by:
 * - Docker HEALTHCHECK in Dockerfile
 * - Kubernetes liveness probes
 * - Load balancer health checks
 */
export async function GET() {
  const memUsage = process.memoryUsage()
  const heapPercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)

  const response = {
    status: "ok",
    timestamp: new Date().toISOString(),
    version: process.env.SOURCE_COMMIT?.slice(0, 8) || process.env.npm_package_version || "dev",
    uptime: Math.round(process.uptime()),
    memory: {
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapPercent,
    },
  }

  return NextResponse.json(response, { status: 200 })
}
