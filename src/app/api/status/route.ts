import { NextResponse } from "next/server"
import { withApiLogging } from "@/lib/api-logging"

export const dynamic = "force-dynamic"

/**
 * System status endpoint
 * Returns non-sensitive system information for monitoring
 * Does NOT require authentication (for monitoring tools)
 */
export const GET = withApiLogging(async () => {
  const uptimeSeconds = Math.round(process.uptime())
  const memUsage = process.memoryUsage()

  // Convert bytes to MB for readability
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024)
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024)
  const rssMB = Math.round(memUsage.rss / 1024 / 1024)

  // Format uptime into human-readable format
  const days = Math.floor(uptimeSeconds / 86400)
  const hours = Math.floor((uptimeSeconds % 86400) / 3600)
  const minutes = Math.floor((uptimeSeconds % 3600) / 60)
  const seconds = uptimeSeconds % 60

  let uptimeFormatted = ""
  if (days > 0) uptimeFormatted += `${days}d `
  if (hours > 0) uptimeFormatted += `${hours}h `
  if (minutes > 0) uptimeFormatted += `${minutes}m `
  uptimeFormatted += `${seconds}s`

  return NextResponse.json({
    status: "operational",
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || process.env.npm_package_version || "0.1.0",
    environment: process.env.NODE_ENV || "development",
    uptime: {
      seconds: uptimeSeconds,
      formatted: uptimeFormatted.trim(),
    },
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    memory: {
      heapUsedMB,
      heapTotalMB,
      heapUsagePercent: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
      rssMB,
    },
  })
})
