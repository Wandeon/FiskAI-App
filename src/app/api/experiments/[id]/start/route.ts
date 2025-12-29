/**
 * Start Experiment API
 *
 * POST /api/experiments/:id/start - Start an experiment
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { startExperiment } from "@/lib/experiments"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const experiment = await startExperiment(params.id)

    return NextResponse.json({ experiment })
  } catch (error) {
    console.error("Error starting experiment:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start experiment" },
      { status: 400 }
    )
  }
}
