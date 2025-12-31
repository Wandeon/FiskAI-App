/**
 * Experiments API - Individual Experiment Operations
 *
 * GET /api/experiments/:id - Get experiment details
 * PATCH /api/experiments/:id - Update experiment
 * DELETE /api/experiments/:id - Delete experiment
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getExperiment, updateExperiment, deleteExperiment } from "@/lib/experiments"
import type { UpdateExperimentInput } from "@/lib/experiments/types"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can view experiments
    if (session.user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const experiment = await getExperiment(id)

    if (!experiment) {
      return NextResponse.json({ error: "Experiment not found" }, { status: 404 })
    }

    return NextResponse.json({ experiment })
  } catch (error) {
    console.error("Error getting experiment:", error)
    return NextResponse.json({ error: "Failed to get experiment" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can update experiments
    if (session.user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const input: UpdateExperimentInput = {
      name: body.name,
      description: body.description,
      hypothesis: body.hypothesis,
      trafficPercent: body.trafficPercent,
      successMetric: body.successMetric,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      status: body.status,
    }

    const experiment = await updateExperiment(id, input)

    return NextResponse.json({ experiment })
  } catch (error) {
    console.error("Error updating experiment:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update experiment" },
      { status: 400 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can delete experiments
    if (session.user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await deleteExperiment(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting experiment:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete experiment" },
      { status: 400 }
    )
  }
}
