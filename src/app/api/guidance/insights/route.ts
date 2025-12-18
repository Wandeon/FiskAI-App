// src/app/api/guidance/insights/route.ts
import { NextResponse } from "next/server"
import { getCurrentUser, getCurrentCompany } from "@/lib/auth-utils"
import { getAllPatternInsights } from "@/lib/guidance/patterns"

export const dynamic = "force-dynamic"

/**
 * GET /api/guidance/insights
 *
 * Get AI-powered pattern insights for the current company.
 */
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const company = await getCurrentCompany(user.id!)
    if (!company) {
      return NextResponse.json({ error: "No company found" }, { status: 404 })
    }

    const insights = await getAllPatternInsights(company.id)

    return NextResponse.json({ insights })
  } catch (error) {
    console.error("Error fetching insights:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
