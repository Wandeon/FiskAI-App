// src/app/api/admin/regulatory-truth/revalidation/route.ts
import { NextRequest, NextResponse } from "next/server"
import {
  getRulesNeedingRevalidation,
  applyConfidenceDecay,
} from "@/lib/regulatory-truth/utils/confidence-decay"

export async function GET(req: NextRequest) {
  try {
    const maxConfidence = parseFloat(req.nextUrl.searchParams.get("maxConfidence") || "0.75")
    const rules = await getRulesNeedingRevalidation(maxConfidence)

    return NextResponse.json({
      count: rules.length,
      rules,
    })
  } catch (error) {
    console.error("[revalidation] Error:", error)
    return NextResponse.json({ error: "Failed to get rules needing revalidation" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const result = await applyConfidenceDecay()

    return NextResponse.json({
      success: true,
      checked: result.checked,
      decayed: result.decayed,
      details: result.details,
    })
  } catch (error) {
    console.error("[revalidation] Error:", error)
    return NextResponse.json({ error: "Failed to apply confidence decay" }, { status: 500 })
  }
}
