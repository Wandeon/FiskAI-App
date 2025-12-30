import { NextRequest, NextResponse } from "next/server"
import { withApiLogging } from "@/lib/api-logging"
import { calculateDeterministicRule } from "@/lib/fiscal-rules"

export const POST = withApiLogging(async (request: NextRequest) => {
  try {
    const payload = await request.json()

    if (!payload?.tableKey) {
      return NextResponse.json({ error: "tableKey is required" }, { status: 400 })
    }

    const result = await calculateDeterministicRule(payload)

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
})
