// src/app/api/admin/regulatory-truth/truth-health/route.ts
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import {
  collectTruthHealthMetrics,
  storeTruthHealthSnapshot,
  runConsolidatorHealthCheck,
} from "@/lib/regulatory-truth/utils/truth-health"
import { getCurrentUser } from "@/lib/auth-utils"

/**
 * GET /api/admin/regulatory-truth/truth-health
 * Returns current truth health metrics and recent snapshots
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.systemRole !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const includeHistory = req.nextUrl.searchParams.get("history") === "true"
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "10")

    // Get current metrics
    const currentMetrics = await collectTruthHealthMetrics()

    // Optionally get historical snapshots
    let history: any[] = []
    if (includeHistory) {
      history = await db.truthHealthSnapshot.findMany({
        orderBy: { timestamp: "desc" },
        take: limit,
      })
    }

    return NextResponse.json({
      current: currentMetrics,
      healthy: currentMetrics.alertsTriggered.length === 0,
      alerts: currentMetrics.alertsTriggered,
      history: includeHistory ? history : undefined,
    })
  } catch (error) {
    console.error("[truth-health] Error:", error)
    return NextResponse.json({ error: "Failed to get truth health metrics" }, { status: 500 })
  }
}

/**
 * POST /api/admin/regulatory-truth/truth-health
 * Triggers a manual health check and stores a snapshot
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.systemRole !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const action = req.nextUrl.searchParams.get("action") || "snapshot"

    if (action === "audit") {
      // Run consolidator health check (dry-run)
      const healthCheck = await runConsolidatorHealthCheck()

      return NextResponse.json({
        success: true,
        healthy: healthCheck.healthy,
        duplicateGroups: healthCheck.duplicateGroups,
        testDataLeakage: healthCheck.testDataLeakage,
        alerts: healthCheck.alerts,
      })
    }

    // Default: store a new snapshot
    const snapshot = await storeTruthHealthSnapshot()

    return NextResponse.json({
      success: true,
      snapshotId: snapshot.id,
      alerts: snapshot.alerts,
    })
  } catch (error) {
    console.error("[truth-health] Error:", error)
    return NextResponse.json({ error: "Failed to run truth health check" }, { status: 500 })
  }
}
