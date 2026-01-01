// src/app/api/admin/regulatory-truth/rules/[id]/reject/route.ts

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth-utils"
import { logAuditEvent } from "@/lib/regulatory-truth/utils/audit-log"
import {
  parseParams,
  parseBody,
  isValidationError,
  formatValidationError,
} from "@/lib/api/validation"
import { ruleIdSchema, rejectRuleSchema } from "../../../../_schemas"

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

    const { id } = parseParams(await params, ruleIdSchema)
    const { reason } = await parseBody(request, rejectRuleSchema)

    // Get the rule with existing reviewerNotes
    const rule = await db.regulatoryRule.findUnique({
      where: { id },
      select: { status: true, reviewerNotes: true },
    })

    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 })
    }

    if (rule.status !== "PENDING_REVIEW") {
      return NextResponse.json({ error: "Rule is not pending review" }, { status: 400 })
    }

    // Update rule to rejected with rejection info in reviewerNotes
    const updatedRule = await db.regulatoryRule.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewerNotes: JSON.stringify({
          rejectedBy: user.id,
          rejectedAt: new Date().toISOString(),
          reason: reason,
          previousNotes: rule.reviewerNotes,
        }),
      },
    })

    // Log audit event for rule rejection
    await logAuditEvent({
      action: "RULE_REJECTED",
      entityType: "RULE",
      entityId: id,
      performedBy: user.id,
      metadata: {
        reason: reason,
        previousStatus: rule.status,
      },
    })

    return NextResponse.json({
      success: true,
      rule: updatedRule,
    })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("[reject] Error rejecting rule:", error)
    return NextResponse.json({ error: "Failed to reject rule" }, { status: 500 })
  }
}
