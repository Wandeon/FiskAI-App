import { NextRequest, NextResponse } from "next/server"
import { buildAnswer } from "@/lib/assistant/query-engine/answer-builder"
import { validateResponse } from "@/lib/assistant/validation"
import type { Surface } from "@/lib/assistant/types"

interface ChatRequest {
  query: string
  surface: Surface
  companyId?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatRequest

    // Validate request
    if (!body.query || typeof body.query !== "string" || body.query.trim().length === 0) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 })
    }

    if (!body.surface || !["MARKETING", "APP"].includes(body.surface)) {
      return NextResponse.json({ error: "Invalid surface" }, { status: 400 })
    }

    // Build answer from rules
    const response = await buildAnswer(body.query.trim(), body.surface, body.companyId)

    // Validate response before sending
    const validation = validateResponse(response)
    if (!validation.valid) {
      console.error("[Assistant API] Invalid response:", validation.errors)
      return NextResponse.json(
        { error: "Response validation failed", details: validation.errors },
        { status: 500 }
      )
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Assistant chat error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
