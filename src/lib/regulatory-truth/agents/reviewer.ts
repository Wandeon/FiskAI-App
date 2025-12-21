// src/lib/regulatory-truth/agents/reviewer.ts

import { db } from "@/lib/db"
import {
  ReviewerInputSchema,
  ReviewerOutputSchema,
  type ReviewerInput,
  type ReviewerOutput,
} from "../schemas"
import { runAgent } from "./runner"

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
      // Auto-approve for T2/T3 rules with high confidence
      if (
        (rule.riskTier === "T2" || rule.riskTier === "T3") &&
        reviewOutput.computed_confidence >= 0.95
      ) {
        newStatus = "APPROVED"
      } else {
        // Even if agent says APPROVE, T0/T1 must go to PENDING_REVIEW for human
        newStatus = "PENDING_REVIEW"
      }
      break

    case "REJECT":
      newStatus = "REJECTED"
      break

    case "ESCALATE_HUMAN":
    case "ESCALATE_ARBITER":
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

  return {
    success: true,
    output: result.output,
    updatedRuleId: updatedRule.id,
    error: null,
  }
}
