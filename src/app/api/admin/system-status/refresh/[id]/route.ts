/**
 * GET /api/admin/system-status/refresh/[id]
 *
 * Returns the status of a refresh job by ID.
 * Used for polling async job status.
 */

import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-utils"
import { getRefreshJob, getSnapshotById } from "@/lib/system-status/store"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Check admin auth
    const user = await getCurrentUser()
    if (!user || user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: "Job ID required" }, { status: 400 })
    }

    const job = await getRefreshJob(id)

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    // Build response
    const response: {
      id: string
      status: string
      mode: string
      startedAt: Date | null
      finishedAt: Date | null
      error: string | null
      headlinePreview?: {
        headlineStatus: string
        criticalCount: number
        highCount: number
      }
    } = {
      id: job.id,
      status: job.status,
      mode: job.mode,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      error: job.error,
    }

    // If job succeeded and has a snapshot, include headline preview
    if (job.status === "SUCCEEDED" && job.snapshotId) {
      const snapshot = await getSnapshotById(job.snapshotId)
      if (snapshot) {
        response.headlinePreview = {
          headlineStatus: snapshot.headlineStatus,
          criticalCount: snapshot.criticalCount,
          highCount: snapshot.highCount,
        }
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[system-status-refresh-status] Error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
