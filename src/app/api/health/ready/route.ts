import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    // Check database connectivity
    await db.$queryRaw`SELECT 1`

    return NextResponse.json({
      status: "ready",
      timestamp: new Date().toISOString(),
      checks: {
        database: "ok",
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: "not_ready",
        timestamp: new Date().toISOString(),
        checks: {
          database: "failed",
        },
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    )
  }
}
