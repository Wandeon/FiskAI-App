// src/app/api/regulatory/trigger/route.ts
import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-utils"

export async function POST(request: Request) {
  try {
    // Check authentication
    const user = await getCurrentUser()
    if (!user || user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { phase } = body as { phase?: string }

    // Trigger appropriate phase
    if (phase === "discovery") {
      const { runSentinel, fetchDiscoveredItems } =
        await import("@/lib/regulatory-truth/agents/sentinel")
      const result = await runSentinel()
      const fetchResult = await fetchDiscoveredItems(50)

      return NextResponse.json({
        success: true,
        phase: "discovery",
        result: {
          ...result,
          fetched: fetchResult.fetched,
        },
      })
    }

    if (phase === "extraction") {
      const { runExtractorBatch } = await import("@/lib/regulatory-truth/agents/extractor")
      const result = await runExtractorBatch(20)

      return NextResponse.json({
        success: true,
        phase: "extraction",
        result,
      })
    }

    // Default: trigger full pipeline
    const { triggerManualRun } = await import("@/lib/regulatory-truth/scheduler/cron")

    // Run in background (don't await)
    triggerManualRun().catch(console.error)

    return NextResponse.json({
      success: true,
      phase: "full",
      message: "Full pipeline triggered in background",
    })
  } catch (error) {
    console.error("[api/regulatory/trigger] Error:", error)
    return NextResponse.json({ error: "Failed to trigger pipeline" }, { status: 500 })
  }
}
