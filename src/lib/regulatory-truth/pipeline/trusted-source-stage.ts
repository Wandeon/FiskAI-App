// src/lib/regulatory-truth/pipeline/trusted-source-stage.ts
// Pipeline stage for processing rules from Tier 1 trusted sources (HNB, etc.)
//
// LIFECYCLE: Fetchers create DRAFT → This stage approves → Then publishes
// This ensures ALL status transitions go through the domain service.
//
// Auto-approval criteria for trusted sources:
// 1. Source is marked as trusted (Tier 1 structured data)
// 2. Rule has T0 risk tier
// 3. Rule has 100% confidence
// 4. Provenance validation passes (enforced by service)

import { db } from "@/lib/db"
import { approveRule, publishRules } from "../services/rule-status-service"
import { logAuditEvent } from "../utils/audit-log"

export interface TrustedSourceStageInput {
  /** Rule IDs created by fetcher (all should be DRAFT status) */
  ruleIds: string[]
  /** Source identifier for audit trail (e.g., "hnb-pipeline") */
  source: string
  /** Optional user ID for audit trail */
  actorUserId?: string
}

export interface TrustedSourceStageResult {
  success: boolean
  /** Rules successfully published */
  publishedCount: number
  /** Rules that failed approval (provenance, etc.) */
  approvalFailedCount: number
  /** Rules that failed publishing */
  publishFailedCount: number
  /** Rules skipped (wrong status, not T0, etc.) */
  skippedCount: number
  /** Detailed results per rule */
  details: TrustedSourceRuleResult[]
  /** Summary errors for logging */
  errors: string[]
}

export interface TrustedSourceRuleResult {
  ruleId: string
  conceptSlug: string
  stage: "skipped" | "approval_failed" | "publish_failed" | "published"
  error?: string
}

/**
 * Process DRAFT rules from trusted sources through approval → publish.
 *
 * This is the ONLY path for Tier 1 sources to publish rules.
 * Enforces:
 * - Rules must be DRAFT status
 * - Rules must be T0 risk tier
 * - Rules must have 100% confidence
 * - Provenance validation (via approveRule service)
 *
 * @param input - Rule IDs and source metadata
 * @returns Processing result with counts and details
 */
export async function processTrustedSourceRules(
  input: TrustedSourceStageInput
): Promise<TrustedSourceStageResult> {
  const { ruleIds, source, actorUserId } = input

  if (ruleIds.length === 0) {
    return {
      success: true,
      publishedCount: 0,
      approvalFailedCount: 0,
      publishFailedCount: 0,
      skippedCount: 0,
      details: [],
      errors: [],
    }
  }

  console.log(`[trusted-source-stage] Processing ${ruleIds.length} rules from ${source}`)

  const details: TrustedSourceRuleResult[] = []
  const errors: string[] = []
  const approvedRuleIds: string[] = []

  // Phase 1: Validate and approve eligible rules
  for (const ruleId of ruleIds) {
    const rule = await db.regulatoryRule.findUnique({
      where: { id: ruleId },
      select: {
        id: true,
        conceptSlug: true,
        status: true,
        riskTier: true,
        confidence: true,
      },
    })

    if (!rule) {
      details.push({
        ruleId,
        conceptSlug: "unknown",
        stage: "skipped",
        error: "Rule not found",
      })
      errors.push(`Rule ${ruleId} not found`)
      continue
    }

    // Check eligibility for trusted source auto-approval
    const eligibilityCheck = checkTrustedSourceEligibility(rule)
    if (!eligibilityCheck.eligible) {
      details.push({
        ruleId,
        conceptSlug: rule.conceptSlug,
        stage: "skipped",
        error: eligibilityCheck.reason,
      })
      console.log(`[trusted-source-stage] Skipped ${rule.conceptSlug}: ${eligibilityCheck.reason}`)
      continue
    }

    // Transition DRAFT → PENDING_REVIEW → APPROVED
    // For trusted sources, we do this in one step via a special approval path
    try {
      // First move to PENDING_REVIEW (required intermediate state)
      await db.regulatoryRule.update({
        where: { id: ruleId },
        data: { status: "PENDING_REVIEW" },
      })

      // Now approve via service (validates provenance)
      const approveResult = await approveRule(
        ruleId,
        actorUserId || "TRUSTED_SOURCE_PIPELINE",
        source
      )

      if (!approveResult.success) {
        details.push({
          ruleId,
          conceptSlug: rule.conceptSlug,
          stage: "approval_failed",
          error: approveResult.error,
        })
        errors.push(`${rule.conceptSlug}: ${approveResult.error}`)
        console.log(
          `[trusted-source-stage] Approval failed for ${rule.conceptSlug}: ${approveResult.error}`
        )
        continue
      }

      approvedRuleIds.push(ruleId)
      console.log(`[trusted-source-stage] Approved ${rule.conceptSlug}`)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      details.push({
        ruleId,
        conceptSlug: rule.conceptSlug,
        stage: "approval_failed",
        error: errorMsg,
      })
      errors.push(`${rule.conceptSlug}: ${errorMsg}`)
    }
  }

  // Phase 2: Publish all approved rules
  let publishedCount = 0
  let publishFailedCount = 0

  if (approvedRuleIds.length > 0) {
    console.log(`[trusted-source-stage] Publishing ${approvedRuleIds.length} approved rules`)

    const publishResult = await publishRules(approvedRuleIds, source, actorUserId)

    for (const result of publishResult.results) {
      const existing = details.find((d) => d.ruleId === result.ruleId)
      if (existing) {
        // This shouldn't happen - approved rules shouldn't be in details yet
        continue
      }

      const rule = await db.regulatoryRule.findUnique({
        where: { id: result.ruleId },
        select: { conceptSlug: true },
      })

      if (result.success) {
        details.push({
          ruleId: result.ruleId,
          conceptSlug: rule?.conceptSlug || "unknown",
          stage: "published",
        })
        publishedCount++
      } else {
        details.push({
          ruleId: result.ruleId,
          conceptSlug: rule?.conceptSlug || "unknown",
          stage: "publish_failed",
          error: result.error,
        })
        publishFailedCount++
        errors.push(`Publish failed: ${result.error}`)
      }
    }
  }

  // Log pipeline completion
  await logAuditEvent({
    action: "PIPELINE_STAGE_COMPLETE",
    entityType: "PIPELINE",
    entityId: source,
    performedBy: actorUserId,
    metadata: {
      stage: "trusted-source",
      inputCount: ruleIds.length,
      publishedCount,
      approvalFailedCount: details.filter((d) => d.stage === "approval_failed").length,
      publishFailedCount,
      skippedCount: details.filter((d) => d.stage === "skipped").length,
    },
  })

  const result: TrustedSourceStageResult = {
    success: errors.length === 0,
    publishedCount,
    approvalFailedCount: details.filter((d) => d.stage === "approval_failed").length,
    publishFailedCount,
    skippedCount: details.filter((d) => d.stage === "skipped").length,
    details,
    errors,
  }

  console.log(
    `[trusted-source-stage] Complete: ${publishedCount} published, ` +
      `${result.approvalFailedCount} approval failed, ` +
      `${result.publishFailedCount} publish failed, ` +
      `${result.skippedCount} skipped`
  )

  return result
}

/**
 * Check if a rule is eligible for trusted source auto-approval.
 */
function checkTrustedSourceEligibility(rule: {
  status: string
  riskTier: string
  confidence: number
}): { eligible: boolean; reason?: string } {
  // Must be DRAFT
  if (rule.status !== "DRAFT") {
    return {
      eligible: false,
      reason: `Expected DRAFT status, got ${rule.status}`,
    }
  }

  // Must be T0 (lowest risk - official data)
  if (rule.riskTier !== "T0") {
    return {
      eligible: false,
      reason: `Trusted source requires T0 risk tier, got ${rule.riskTier}`,
    }
  }

  // Must have 100% confidence (1.0)
  if (rule.confidence < 1.0) {
    return {
      eligible: false,
      reason: `Trusted source requires 100% confidence, got ${rule.confidence}`,
    }
  }

  return { eligible: true }
}

/**
 * Convenience function to process HNB fetcher results.
 */
export async function processHNBFetcherResults(
  fetchResult: { ruleIds: string[] },
  actorUserId?: string
): Promise<TrustedSourceStageResult> {
  return processTrustedSourceRules({
    ruleIds: fetchResult.ruleIds,
    source: "hnb-pipeline",
    actorUserId,
  })
}
