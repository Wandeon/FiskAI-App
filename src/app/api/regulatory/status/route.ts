// src/app/api/regulatory/status/route.ts
import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-utils"
import {
  collectMetrics,
  getEndpointHealth,
  getRecentAgentRuns,
} from "@/lib/regulatory-truth/monitoring/metrics"
import { getSchedulerStatus } from "@/lib/regulatory-truth/scheduler/cron"

export async function GET() {
  try {
    // Check authentication
    const user = await getCurrentUser()
    if (!user || user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Collect all status information
    const [metrics, endpointHealth, recentRuns] = await Promise.all([
      collectMetrics(),
      getEndpointHealth(),
      getRecentAgentRuns(20),
    ])

    const schedulerStatus = getSchedulerStatus()

    return NextResponse.json({
      metrics,
      endpointHealth,
      recentRuns,
      scheduler: schedulerStatus,
    })
  } catch (error) {
    console.error("[api/regulatory/status] Error:", error)
    return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 })
  }
}
