// src/app/api/regulatory/trigger/route.ts
import { NextRequest, NextResponse } from "next/server"
import { scheduledQueue } from "@/lib/regulatory-truth/workers/queues"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const phases = body.phases || ["sentinel", "extract", "compose", "review", "release"]

    const job = await scheduledQueue.add("scheduled", {
      type: "pipeline-run",
      runId: `api-${Date.now()}`,
      triggeredBy: "api",
      phases,
    })

    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: "queued",
      message: "Pipeline run queued successfully",
    })
  } catch (error) {
    console.error("[trigger] Error:", error)
    return NextResponse.json({ error: "Failed to queue pipeline run" }, { status: 500 })
  }
}
