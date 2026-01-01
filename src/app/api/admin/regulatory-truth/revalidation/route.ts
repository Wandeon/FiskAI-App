// src/app/api/admin/regulatory-truth/revalidation/route.ts
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser } from "@/lib/auth-utils"
import { logAuditEvent } from "@/lib/regulatory-truth/utils/audit-log"
import {
  getRulesNeedingRevalidation,
  applyConfidenceDecay,
} from "@/lib/regulatory-truth/utils/confidence-decay"
import { parseQuery, isValidationError, formatValidationError } from "@/lib/api/validation"

const getQuerySchema = z.object({
  maxConfidence: z.coerce.number().min(0).max(1).default(0.75),
})

/**
 * GET /api/admin/regulatory-truth/revalidation
 *
 * Get rules that need revalidation (low confidence).
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

    const { maxConfidence } = parseQuery(req.nextUrl.searchParams, getQuerySchema)
    const rules = await getRulesNeedingRevalidation(maxConfidence)

    return NextResponse.json({
      count: rules.length,
      rules,
    })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("[revalidation] Error:", error)
    return NextResponse.json({ error: "Failed to get rules needing revalidation" }, { status: 500 })
  }
}

/**
 * POST /api/admin/regulatory-truth/revalidation
 *
 * Apply confidence decay to rules.
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

    const result = await applyConfidenceDecay()

    // Log audit event for confidence decay operation
    await logAuditEvent({
      action: "CONFIDENCE_DECAY_APPLIED",
      entityType: "SYSTEM",
      entityId: "batch",
      performedBy: user.id,
      metadata: {
        checked: result.checked,
        decayed: result.decayed,
      },
    })

    return NextResponse.json({
      success: true,
      checked: result.checked,
      decayed: result.decayed,
      details: result.details,
    })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("[revalidation] Error:", error)
    return NextResponse.json({ error: "Failed to apply confidence decay" }, { status: 500 })
  }
}
