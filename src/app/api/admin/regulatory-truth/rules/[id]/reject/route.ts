// src/app/api/admin/regulatory-truth/rules/[id]/reject/route.ts

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth-utils"

/**
 * POST /api/admin/regulatory-truth/rules/[id]/reject
 *
 * Reject a rule pending review
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user || user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { reason } = body

    if (!reason) {
      return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 })
    }

    // Get the rule
    const rule = await db.regulatoryRule.findUnique({
      where: { id },
      select: { status: true },
    })

    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 })
    }

    if (rule.status !== "PENDING_REVIEW") {
      return NextResponse.json({ error: "Rule is not pending review" }, { status: 400 })
    }

    // Update rule to rejected
    const updatedRule = await db.regulatoryRule.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewerNotes: reason,
        approvedBy: user.id, // Track who rejected it
        approvedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      rule: updatedRule,
    })
  } catch (error) {
    console.error("[reject] Error rejecting rule:", error)
    return NextResponse.json({ error: "Failed to reject rule" }, { status: 500 })
  }
}
