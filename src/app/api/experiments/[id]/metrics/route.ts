/**
 * Experiment Metrics API
 *
 * GET /api/experiments/:id/metrics - Get experiment metrics and analysis
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getExperimentReport } from "@/lib/experiments"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const report = await getExperimentReport(id)

    return NextResponse.json(report)
  } catch (error) {
    console.error("Error getting experiment metrics:", error)
    return NextResponse.json({ error: "Failed to get experiment metrics" }, { status: 500 })
  }
}
