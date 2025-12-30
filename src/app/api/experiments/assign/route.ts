/**
 * Experiment Assignment API
 *
 * POST /api/experiments/assign - Assign user to experiment variant
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { assignUserToExperiment, trackEnrollment } from "@/lib/experiments"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { experimentId, forceVariant, skipExposure } = body

    if (!experimentId) {
      return NextResponse.json({ error: "experimentId is required" }, { status: 400 })
    }

    const assignment = await assignUserToExperiment(experimentId, session.user.id, {
      forceVariant,
      skipExposure,
    })

    if (!assignment) {
      return NextResponse.json({ error: "User not eligible for experiment" }, { status: 404 })
    }

    // Track enrollment
    await trackEnrollment(experimentId, session.user.id, assignment.variantName)

    return NextResponse.json({ assignment })
  } catch (error) {
    console.error("Error assigning user to experiment:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to assign user" },
      { status: 400 }
    )
  }
}
