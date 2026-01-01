// src/app/api/admin/regulatory-truth/rules/[id]/approve/route.ts

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth-utils"
import { logAuditEvent } from "@/lib/regulatory-truth/utils/audit-log"
import { validateValueInQuote } from "@/lib/regulatory-truth/utils/deterministic-validators"
import { parseParams, isValidationError, formatValidationError } from "@/lib/api/validation"
import { ruleIdSchema } from "../../../../_schemas"

/**
 * POST /api/admin/regulatory-truth/rules/[id]/approve
 *
 * Approve a rule pending review
 *
 * Validation gates (same as Reviewer/Releaser - see PR #87 GAP-1 fix):
 * 1. Rule must have at least 1 SourcePointer
 * 2. Each SourcePointer must have valid evidenceId and exactQuote
 * 3. Quote must contain the rule value (deterministic validation)
 * 4. T0/T1 rules require human reviewer (not SYSTEM)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user || user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = parseParams(await params, ruleIdSchema)

    // Get the rule with all required data for validation
    const rule = await db.regulatoryRule.findUnique({
      where: { id },
      select: {
        status: true,
        riskTier: true,
        value: true,
        valueType: true,
        sourcePointers: {
          where: { deletedAt: null },
          select: {
            id: true,
            evidenceId: true,
            exactQuote: true,
            extractedValue: true,
          },
        },
      },
    })

    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 })
    }

    if (rule.status !== "PENDING_REVIEW") {
      return NextResponse.json({ error: "Rule is not pending review" }, { status: 400 })
    }

    // ===== POINTER VALIDATION GATES (PR #87 GAP-1 fix) =====

    // Gate 1: Must have at least 1 SourcePointer
    if (!rule.sourcePointers || rule.sourcePointers.length === 0) {
      return NextResponse.json(
        {
          error: "Cannot approve rule without source pointers",
          code: "NO_SOURCE_POINTERS",
          details: "Rules must have at least one evidence-backed source pointer to be approved",
        },
        { status: 400 }
      )
    }

    // Gate 2 & 3: Validate each SourcePointer
    const pointerErrors: string[] = []

    for (const pointer of rule.sourcePointers) {
      // Gate 2: Must have valid evidenceId and exactQuote
      if (!pointer.evidenceId) {
        pointerErrors.push(`SourcePointer ${pointer.id} missing evidenceId`)
        continue
      }
      if (!pointer.exactQuote || pointer.exactQuote.trim().length < 5) {
        pointerErrors.push(
          `SourcePointer ${pointer.id} has invalid exactQuote (too short or empty)`
        )
        continue
      }

      // Gate 3: Quote must contain the value (deterministic validation)
      // Use pointer's extracted value or fall back to rule value
      const valueToCheck = pointer.extractedValue || rule.value
      if (valueToCheck && rule.valueType !== "text") {
        const quoteValidation = validateValueInQuote(valueToCheck, pointer.exactQuote)
        if (!quoteValidation.valid) {
          pointerErrors.push(`SourcePointer ${pointer.id}: ${quoteValidation.error}`)
        }
      }
    }

    if (pointerErrors.length > 0) {
      return NextResponse.json(
        {
          error: "Source pointer validation failed",
          code: "POINTER_VALIDATION_FAILED",
          details: pointerErrors,
        },
        { status: 400 }
      )
    }

    // Gate 4: T0/T1 rules require human reviewer (not SYSTEM)
    if (rule.riskTier === "T0" || rule.riskTier === "T1") {
      // user.id is validated at this point, ensure it's not a system account
      if (user.email?.includes("system@") || user.email?.includes("noreply@")) {
        return NextResponse.json(
          {
            error: "T0/T1 rules require human reviewer",
            code: "HUMAN_REVIEW_REQUIRED",
            details: "High-risk rules (T0/T1) cannot be approved by system accounts",
          },
          { status: 400 }
        )
      }
    }

    // ===== END VALIDATION GATES =====

    // Update rule to approved
    const updatedRule = await db.regulatoryRule.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedBy: user.id,
        approvedAt: new Date(),
      },
    })

    // Log audit event for rule approval
    await logAuditEvent({
      action: "RULE_APPROVED",
      entityType: "RULE",
      entityId: id,
      performedBy: user.id,
      metadata: {
        riskTier: rule.riskTier,
        previousStatus: "PENDING_REVIEW",
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
    console.error("[approve] Error approving rule:", error)
    return NextResponse.json({ error: "Failed to approve rule" }, { status: 500 })
  }
}
