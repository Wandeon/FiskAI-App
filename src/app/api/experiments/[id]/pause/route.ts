/**
 * Pause Experiment API
 *
 * POST /api/experiments/:id/pause - Pause an experiment
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { pauseExperiment } from "@/lib/experiments"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const experiment = await pauseExperiment(id)

    return NextResponse.json({ experiment })
  } catch (error) {
    console.error("Error pausing experiment:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to pause experiment" },
      { status: 400 }
    )
  }
}
