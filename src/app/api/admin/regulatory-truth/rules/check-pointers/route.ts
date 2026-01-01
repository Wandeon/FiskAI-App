// src/app/api/admin/regulatory-truth/rules/check-pointers/route.ts

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth-utils"
import { logAuditEvent } from "@/lib/regulatory-truth/utils/audit-log"
import { parseBody, isValidationError, formatValidationError } from "@/lib/api/validation"

const postBodySchema = z.object({
  action: z.enum(["flag", "delete"]).default("flag"),
  dryRun: z.boolean().default(true),
})

/**
 * GET /api/admin/regulatory-truth/rules/check-pointers
 *
 * Identify rules without source pointers (violates RTL-009).
 * These rules cannot be verified and should not exist.
 *
 * SECURITY: Requires ADMIN authentication (fixed in PR #87)
 */
export async function GET(req: NextRequest) {
  try {
    // Authentication required - this was previously unauthenticated (security fix)
    const user = await getCurrentUser()
    if (!user || user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    // Find all rules
    const allRules = await db.regulatoryRule.findMany({
      select: {
        id: true,
        conceptSlug: true,
        status: true,
        riskTier: true,
        confidence: true,
        createdAt: true,
        sourcePointers: {
          select: { id: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    // Identify rules without source pointers
    const rulesWithoutPointers = allRules.filter((r) => r.sourcePointers.length === 0)

    // Group by status for reporting
    const byStatus = rulesWithoutPointers.reduce(
      (acc, rule) => {
        acc[rule.status] = (acc[rule.status] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    // Group by risk tier
    const byRiskTier = rulesWithoutPointers.reduce(
      (acc, rule) => {
        acc[rule.riskTier] = (acc[rule.riskTier] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    return NextResponse.json({
      total: allRules.length,
      withoutPointers: rulesWithoutPointers.length,
      percentageWithoutPointers: ((rulesWithoutPointers.length / allRules.length) * 100).toFixed(2),
      byStatus,
      byRiskTier,
      rules: rulesWithoutPointers.map((r) => ({
        id: r.id,
        conceptSlug: r.conceptSlug,
        status: r.status,
        riskTier: r.riskTier,
        confidence: r.confidence,
        createdAt: r.createdAt,
        pointerCount: r.sourcePointers.length,
      })),
    })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/regulatory-truth/rules/check-pointers
 *
 * Flag rules without source pointers by updating their status.
 *
 * Body: { action: "flag" | "delete", dryRun: boolean }
 *
 * SECURITY: Requires ADMIN authentication (fixed in PR #87)
 */
export async function POST(req: NextRequest) {
  try {
    // Authentication required - this was previously unauthenticated (security fix)
    const user = await getCurrentUser()
    if (!user || user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { action, dryRun } = await parseBody(req, postBodySchema)

    // Find rules without source pointers
    const rulesWithoutPointers = await db.regulatoryRule.findMany({
      where: {
        sourcePointers: {
          none: {},
        },
      },
      select: {
        id: true,
        conceptSlug: true,
        status: true,
        riskTier: true,
        confidence: true,
        composerNotes: true,
      },
    })

    if (rulesWithoutPointers.length === 0) {
      return NextResponse.json({
        message: "No rules without source pointers found",
        affected: 0,
        dryRun,
      })
    }

    const affected: Array<{
      id: string
      conceptSlug: string
      oldStatus: string
      newStatus?: string
      action: string
    }> = []

    if (!dryRun) {
      for (const rule of rulesWithoutPointers) {
        if (action === "flag") {
          // Flag by moving to REJECTED status and adding a note
          await db.regulatoryRule.update({
            where: { id: rule.id },
            data: {
              status: "REJECTED",
              reviewerNotes: `[SYSTEM] Rejected: Rule has no source pointers. Rules must be traceable to evidence (RTL-009).`,
              composerNotes: `${rule.composerNotes || ""}\n[FLAGGED] No source pointers - cannot verify`,
            },
          })

          // Audit log for destructive operation
          await logAuditEvent({
            action: "RULE_REJECTED",
            entityType: "RULE",
            entityId: rule.id,
            performedBy: user.id,
            metadata: {
              reason: "NO_SOURCE_POINTERS",
              previousStatus: rule.status,
              automated: false,
            },
          })

          affected.push({
            id: rule.id,
            conceptSlug: rule.conceptSlug,
            oldStatus: rule.status,
            newStatus: "REJECTED",
            action: "flagged",
          })
        } else if (action === "delete") {
          // Delete the rule entirely
          await db.regulatoryRule.delete({
            where: { id: rule.id },
          })

          // Audit log for destructive operation
          await logAuditEvent({
            action: "RULE_DELETED",
            entityType: "RULE",
            entityId: rule.id,
            performedBy: user.id,
            metadata: {
              reason: "NO_SOURCE_POINTERS",
              previousStatus: rule.status,
              conceptSlug: rule.conceptSlug,
            },
          })

          affected.push({
            id: rule.id,
            conceptSlug: rule.conceptSlug,
            oldStatus: rule.status,
            action: "deleted",
          })
        }
      }
    } else {
      // Dry run - just report what would happen
      for (const rule of rulesWithoutPointers) {
        affected.push({
          id: rule.id,
          conceptSlug: rule.conceptSlug,
          oldStatus: rule.status,
          newStatus: action === "flag" ? "REJECTED" : undefined,
          action: action === "flag" ? "would-flag" : "would-delete",
        })
      }
    }

    return NextResponse.json({
      dryRun,
      action,
      totalRulesWithoutPointers: rulesWithoutPointers.length,
      affected: affected.length,
      changes: affected,
    })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
