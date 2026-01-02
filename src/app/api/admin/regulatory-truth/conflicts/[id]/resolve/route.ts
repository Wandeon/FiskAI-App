// src/app/api/admin/regulatory-truth/conflicts/[id]/resolve/route.ts

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { Prisma } from "@prisma/client"
import { getCurrentUser } from "@/lib/auth-utils"
import {
  parseParams,
  parseBody,
  isValidationError,
  formatValidationError,
} from "@/lib/api/validation"
import { ruleIdSchema, resolveConflictSchema } from "../../../../_schemas"

/**
 * POST /api/admin/regulatory-truth/conflicts/[id]/resolve
 *
 * Resolve a regulatory conflict
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user || user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = parseParams(await params, ruleIdSchema)
    const { action, winningRuleId, reason } = await parseBody(request, resolveConflictSchema)

    // Get the conflict
    const conflict = await db.regulatoryConflict.findUnique({
      where: { id },
      select: {
        status: true,
        resolution: true,
        itemAId: true,
        itemBId: true,
      },
    })

    if (!conflict) {
      return NextResponse.json({ error: "Conflict not found" }, { status: 404 })
    }

    if (conflict.status !== "OPEN") {
      return NextResponse.json({ error: "Conflict is not open" }, { status: 400 })
    }

    let resolutionData: Prisma.JsonValue = conflict.resolution

    if (action === "accept") {
      // Accept the arbiter's recommendation
      if (!conflict.resolution) {
        return NextResponse.json({ error: "No arbiter recommendation available" }, { status: 400 })
      }
      // Resolution data already set
    } else if (action === "override") {
      // Human override
      if (!winningRuleId || !reason) {
        return NextResponse.json(
          { error: "Winning rule ID and reason are required for override" },
          { status: 400 }
        )
      }

      if (winningRuleId !== conflict.itemAId && winningRuleId !== conflict.itemBId) {
        return NextResponse.json({ error: "Invalid winning rule ID" }, { status: 400 })
      }

      resolutionData = {
        winningItemId: winningRuleId,
        strategy: "human_override",
        rationaleHr: reason,
        rationaleEn: reason,
      }
    }

    // Update conflict status to resolved
    const updatedConflict = await db.regulatoryConflict.update({
      where: { id },
      data: {
        status: "RESOLVED",
        resolution: resolutionData as Prisma.InputJsonValue,
        resolvedBy: user.id,
        resolvedAt: new Date(),
      },
    })

    // If there's a winning rule, we should potentially:
    // 1. Mark the losing rule as deprecated
    // 2. Publish the winning rule if it's approved
    // For now, we'll just log this - the actual implementation depends on business logic

    const resolvedWinningRuleId = (resolutionData as { winningItemId?: string }).winningItemId
    const losingRuleId =
      resolvedWinningRuleId === conflict.itemAId ? conflict.itemBId : conflict.itemAId

    // Optionally deprecate the losing rule (only if we have a losing rule ID)
    if (losingRuleId) {
      await db.regulatoryRule.update({
        where: { id: losingRuleId },
        data: {
          status: "DEPRECATED",
          reviewerNotes: `Deprecated due to conflict resolution. Conflict ID: ${id}`,
        },
      })
    }

    return NextResponse.json({
      success: true,
      conflict: updatedConflict,
    })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("[resolve] Error resolving conflict:", error)
    return NextResponse.json({ error: "Failed to resolve conflict" }, { status: 500 })
  }
}
