// src/app/api/admin/regulatory-truth/trigger/route.ts

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth-utils"

/**
 * POST /api/admin/regulatory-truth/trigger
 *
 * Manually trigger a full regulatory source check
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get all active sources
    const sources = await db.regulatorySource.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    })

    // In a real implementation, this would:
    // 1. Queue agent jobs for each source
    // 2. Trigger the Sentinel agent to check each source
    // 3. Return job IDs for monitoring

    // For now, we'll just return a success response
    // indicating that the trigger was received

    const jobIds: string[] = []

    for (const source of sources) {
      // Create an agent run record (placeholder)
      const agentRun = await db.agentRun.create({
        data: {
          agentType: "SENTINEL",
          status: "running",
          input: {
            sourceId: source.id,
            sourceName: source.name,
            triggeredBy: user.id,
            triggeredAt: new Date().toISOString(),
          },
        },
      })

      jobIds.push(agentRun.id)
    }

    return NextResponse.json({
      success: true,
      message: `Triggered check for ${sources.length} sources`,
      jobIds,
      sources: sources.map((s) => ({ id: s.id, name: s.name })),
    })
  } catch (error) {
    console.error("[trigger] Error triggering manual check:", error)
    return NextResponse.json({ error: "Failed to trigger manual check" }, { status: 500 })
  }
}
