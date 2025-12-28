import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET() {
  // Verify CRON_SECRET
  const headersList = await headers()
  const authHeader = headersList.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 7) // 7 days ago

    const result = await db.systemRegistryStatusEvent.deleteMany({
      where: {
        createdAt: { lt: cutoff },
      },
    })

    console.log(`[system-status-cleanup] Deleted ${result.count} events older than 7 days`)

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      cutoffDate: cutoff.toISOString(),
    })
  } catch (error) {
    console.error("[system-status-cleanup] Error:", error)
    return NextResponse.json(
      { error: "Cleanup failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
