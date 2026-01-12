// src/app/api/admin/regulatory-truth/sources/[id]/check/route.ts

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { dbReg } from "@/lib/db/regulatory"
import { getCurrentUser } from "@/lib/auth-utils"
import { parseParams, isValidationError, formatValidationError } from "@/lib/api/validation"

const paramsSchema = z.object({
  id: z.string().min(1, "Source ID is required"),
})

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

    const { id } = parseParams(await params, paramsSchema)

    // Get the source
    const source = await dbReg.regulatorySource.findUnique({
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
        status: "RUNNING",
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
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("[check] Error triggering source check:", error)
    return NextResponse.json({ error: "Failed to trigger source check" }, { status: 500 })
  }
}
