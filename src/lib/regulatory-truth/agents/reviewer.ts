// src/lib/regulatory-truth/agents/reviewer.ts

import { db } from "@/lib/db"
import {
  ReviewerInputSchema,
  ReviewerOutputSchema,
  type ReviewerInput,
  type ReviewerOutput,
} from "../schemas"
import { runAgent } from "./runner"
import { logAuditEvent } from "../utils/audit-log"
import { approveRule } from "../services/rule-status-service"

// =============================================================================
// REVIEWER AGENT
// =============================================================================

export interface ReviewerResult {
  success: boolean
  output: ReviewerOutput | null
  updatedRuleId: string | null
  error: string | null
}

/**
 * Find existing rules that might conflict with this one
 */
async function findConflictingRules(rule: {
  id: string
  conceptSlug: string
  effectiveFrom: Date
}): Promise<Array<{ id: string; conceptSlug: string }>> {
  return db.regulatoryRule.findMany({
    where: {
      id: { not: rule.id },
      conceptSlug: rule.conceptSlug,
      status: { in: ["PUBLISHED", "APPROVED"] },
      OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: rule.effectiveFrom } }],
    },
    select: { id: true, conceptSlug: true },
  })
}

/**
 * Auto-approve PENDING_REVIEW rules that meet criteria:
 * - Have been pending for at least 24 hours (grace period)
 * - Have confidence >= 0.90
 * - No open conflicts
 * - ONLY T2/T3 rules (T0/T1 NEVER auto-approved)
 *
 * This provides a grace period for lower-risk rules while ensuring
 * T0/T1 rules always require explicit human approval.
 */
export async function autoApproveEligibleRules(): Promise<{
  approved: number
  skipped: number
  errors: string[]
}> {
  const gracePeriodHours = parseInt(process.env.AUTO_APPROVE_GRACE_HOURS || "24")
  const minConfidence = parseFloat(process.env.AUTO_APPROVE_MIN_CONFIDENCE || "0.90")
  const cutoffDate = new Date(Date.now() - gracePeriodHours * 60 * 60 * 1000)

  console.log(
    `[auto-approve] Looking for PENDING_REVIEW rules older than ${gracePeriodHours}h with confidence >= ${minConfidence}`
  )

  // Find eligible rules (NEVER auto-approve T0/T1)
  const eligibleRules = await db.regulatoryRule.findMany({
    where: {
      status: "PENDING_REVIEW",
      updatedAt: { lt: cutoffDate },
      confidence: { gte: minConfidence },
      // NEVER auto-approve T0/T1 - only T2/T3
      riskTier: { in: ["T2", "T3"] },
      // No open conflicts
      conflictsA: { none: { status: "OPEN" } },
      conflictsB: { none: { status: "OPEN" } },
    },
    select: {
      id: true,
      conceptSlug: true,
      riskTier: true,
      confidence: true,
      updatedAt: true,
    },
  })

  // Log count of T0/T1 rules awaiting human approval
  const skippedCritical = await db.regulatoryRule.count({
    where: {
      status: "PENDING_REVIEW",
      riskTier: { in: ["T0", "T1"] },
    },
  })

  if (skippedCritical > 0) {
    console.log(`[auto-approve] ${skippedCritical} T0/T1 rules awaiting human approval`)
  }

  const results = { approved: 0, skipped: 0, errors: [] as string[] }

  for (const rule of eligibleRules) {
    try {
      // INVARIANT: NEVER approve rules without source pointers
      const pointerCount = await db.sourcePointer.count({
        where: { rules: { some: { id: rule.id } } },
      })

      if (pointerCount === 0) {
        console.log(
          `[auto-approve] BLOCKED: ${rule.conceptSlug} has 0 source pointers - cannot approve without evidence`
        )
        results.skipped++
        continue
      }

      // Use approveRule service for proper context and audit trail
      const approveResult = await approveRule(rule.id, "AUTO_APPROVE_SYSTEM", "auto-approve")
      if (!approveResult.success) {
        console.log(`[auto-approve] FAILED: ${rule.conceptSlug} - ${approveResult.error}`)
        results.errors.push(`${rule.id}: ${approveResult.error}`)
        continue
      }

      // Update reviewer notes separately (service handles status + audit)
      await db.regulatoryRule.update({
        where: { id: rule.id },
        data: {
          reviewerNotes: JSON.stringify({
            auto_approved: true,
            reason: `Grace period (${gracePeriodHours}h) elapsed with confidence ${rule.confidence}`,
            approved_at: new Date().toISOString(),
          }),
        },
      })

      console.log(`[auto-approve] Approved: ${rule.conceptSlug} (confidence: ${rule.confidence})`)
      results.approved++
    } catch (error) {
      results.errors.push(`${rule.id}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  console.log(
    `[auto-approve] Complete: ${results.approved} approved, ${results.skipped} skipped, ${results.errors.length} errors`
  )
  return results
}

/**
 * Run the Reviewer agent to validate a Draft Rule
 */
export async function runReviewer(ruleId: string): Promise<ReviewerResult> {
  // Get rule from database with source pointers
  const rule = await db.regulatoryRule.findUnique({
    where: { id: ruleId },
    include: {
      sourcePointers: {
        include: {
          evidence: {
            include: {
              source: true,
            },
          },
        },
      },
    },
  })

  if (!rule) {
    return {
      success: false,
      output: null,
      updatedRuleId: null,
      error: `Rule not found: ${ruleId}`,
    }
  }

  // Build input for agent
  const input: ReviewerInput = {
    draftRuleId: rule.id,
    draftRule: {
      conceptSlug: rule.conceptSlug,
      titleHr: rule.titleHr,
      riskTier: rule.riskTier,
      appliesWhen: rule.appliesWhen,
      value: rule.value,
      confidence: rule.confidence,
    },
    sourcePointers: rule.sourcePointers.map((sp) => ({
      id: sp.id,
      exactQuote: sp.exactQuote,
      extractedValue: sp.extractedValue,
      confidence: sp.confidence,
    })),
  }

  // Run the agent
  const result = await runAgent<ReviewerInput, ReviewerOutput>({
    agentType: "REVIEWER",
    input,
    inputSchema: ReviewerInputSchema,
    outputSchema: ReviewerOutputSchema,
    temperature: 0.1,
    ruleId: rule.id,
  })

  if (!result.success || !result.output) {
    return {
      success: false,
      output: null,
      updatedRuleId: null,
      error: result.error,
    }
  }

  // Process review decision
  const reviewOutput = result.output.review_result
  let newStatus = rule.status

  switch (reviewOutput.decision) {
    case "APPROVE":
      // INVARIANT: NEVER approve rules without source pointers
      const pointerCount = await db.sourcePointer.count({
        where: { rules: { some: { id: rule.id } } },
      })

      if (pointerCount === 0) {
        newStatus = "PENDING_REVIEW"
        console.log(
          `[reviewer] BLOCKED: Rule ${rule.conceptSlug} has 0 source pointers - cannot approve without evidence`
        )
        break
      }

      // NEVER auto-approve T0/T1 - always require human review
      if (rule.riskTier === "T0" || rule.riskTier === "T1") {
        newStatus = "PENDING_REVIEW"
        console.log(
          `[reviewer] ${rule.riskTier} rule ${rule.conceptSlug} requires human approval (never auto-approved)`
        )
      } else if (
        (rule.riskTier === "T2" || rule.riskTier === "T3") &&
        reviewOutput.computed_confidence >= 0.95
      ) {
        // Auto-approve for T2/T3 rules with high confidence
        newStatus = "APPROVED"
      } else {
        newStatus = "PENDING_REVIEW"
      }
      break

    case "REJECT":
      newStatus = "REJECTED"
      break

    case "ESCALATE_HUMAN":
      newStatus = "PENDING_REVIEW"
      break

    case "ESCALATE_ARBITER":
      // Find potentially conflicting rules
      const conflictingRules = await findConflictingRules(rule)

      if (conflictingRules.length > 0) {
        // Create conflict for Arbiter
        const conflict = await db.regulatoryConflict.create({
          data: {
            conflictType: "SCOPE_CONFLICT",
            status: "OPEN",
            itemAId: rule.id,
            itemBId: conflictingRules[0].id,
            description:
              reviewOutput.human_review_reason || "Potential conflict detected during review",
            metadata: {
              detectedBy: "REVIEWER",
              allConflictingRuleIds: conflictingRules.map((r) => r.id),
            },
          },
        })
        console.log(`[reviewer] Created conflict ${conflict.id} for Arbiter`)
      }

      newStatus = "PENDING_REVIEW"
      break
  }

  // Update rule with review results
  const updatedRule = await db.regulatoryRule.update({
    where: { id: rule.id },
    data: {
      status: newStatus,
      reviewerNotes: JSON.stringify({
        decision: reviewOutput.decision,
        validation_checks: reviewOutput.validation_checks,
        computed_confidence: reviewOutput.computed_confidence,
        issues_found: reviewOutput.issues_found,
        human_review_reason: reviewOutput.human_review_reason,
        reviewer_notes: reviewOutput.reviewer_notes,
        reviewed_at: new Date().toISOString(),
      }),
      confidence: reviewOutput.computed_confidence,
      ...(newStatus === "APPROVED" && {
        approvedAt: new Date(),
      }),
    },
  })

  // Log audit event for review decision
  await logAuditEvent({
    action:
      newStatus === "APPROVED"
        ? "RULE_APPROVED"
        : newStatus === "REJECTED"
          ? "RULE_REJECTED"
          : "RULE_CREATED",
    entityType: "RULE",
    entityId: rule.id,
    metadata: {
      decision: reviewOutput.decision,
      newStatus,
      confidence: reviewOutput.computed_confidence,
    },
  })

  return {
    success: true,
    output: result.output,
    updatedRuleId: updatedRule.id,
    error: null,
  }
}
