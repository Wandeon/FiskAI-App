// src/app/api/admin/regulatory-truth/sources/[id]/check/route.ts

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth-utils"

/**
 * POST /api/admin/regulatory-truth/sources/[id]/check
 *
 * Manually trigger a check for a specific regulatory source
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user || user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Get the source
    const source = await db.regulatorySource.findUnique({
      where: { id },
      select: { id: true, name: true, isActive: true },
    })

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 })
    }

    if (!source.isActive) {
      return NextResponse.json({ error: "Source is not active" }, { status: 400 })
    }

    // Create an agent run record for this check
    const agentRun = await db.agentRun.create({
      data: {
        agentType: "SENTINEL",
        status: "running",
        input: {
          sourceId: source.id,
          sourceName: source.name,
          triggeredBy: user.id,
          triggeredAt: new Date().toISOString(),
          manual: true,
        },
      },
    })

    // In a real implementation, this would:
    // 1. Queue a job to run the Sentinel agent for this source
    // 2. The agent would fetch the source, compare hashes, etc.
    // 3. Return the job ID for monitoring

    return NextResponse.json({
      success: true,
      message: `Triggered check for source: ${source.name}`,
      jobId: agentRun.id,
      source: {
        id: source.id,
        name: source.name,
      },
    })
  } catch (error) {
    console.error("[check] Error triggering source check:", error)
    return NextResponse.json({ error: "Failed to trigger source check" }, { status: 500 })
  }
}
