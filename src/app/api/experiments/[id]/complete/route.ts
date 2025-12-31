/**
 * Complete Experiment API
 *
 * POST /api/experiments/:id/complete - Complete an experiment
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { completeExperiment } from "@/lib/experiments"

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

    const body = await request.json()
    const experiment = await completeExperiment(id, {
      controlValue: body.controlValue,
      variantValue: body.variantValue,
    })

    return NextResponse.json({ experiment })
  } catch (error) {
    console.error("Error completing experiment:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to complete experiment" },
      { status: 400 }
    )
  }
}
