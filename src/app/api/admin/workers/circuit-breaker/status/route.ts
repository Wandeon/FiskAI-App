// src/app/api/admin/workers/circuit-breaker/status/route.ts

import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-utils"
import { getCircuitBreakerStatus } from "@/lib/regulatory-truth/workers/circuit-breaker"

/**
 * GET /api/admin/workers/circuit-breaker/status
 *
 * Returns the status of all worker circuit breakers (opossum-based).
 * Shows which breakers are open, half-open, or closed, along with statistics.
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication and admin role
    const user = await getCurrentUser()
    if (!user || user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const status = getCircuitBreakerStatus()

    // Calculate summary statistics
    let openCount = 0
    let halfOpenCount = 0
    let closedCount = 0

    for (const breaker of Object.values(status)) {
      if (breaker.state === "open") openCount++
      else if (breaker.state === "halfOpen") halfOpenCount++
      else closedCount++
    }

    const overallHealthy = openCount === 0 && halfOpenCount === 0

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      healthy: overallHealthy,
      summary: {
        total: Object.keys(status).length,
        open: openCount,
        halfOpen: halfOpenCount,
        closed: closedCount,
      },
      breakers: status,
    })
  } catch (error) {
    console.error("[workers-circuit-breaker-status] Error fetching status:", error)
    return NextResponse.json({ error: "Failed to fetch circuit breaker status" }, { status: 500 })
  }
}
