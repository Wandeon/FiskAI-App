// src/lib/regulatory-truth/services/rule-status-service.ts
// Domain service for regulatory rule status transitions.
// All status changes must go through here to ensure:
// 1. Proper regulatory context is set
// 2. Per-rule validation occurs
// 3. Transaction atomicity is maintained
// 4. Audit trail is complete

import { db, runWithRegulatoryContext } from "@/lib/db"
import { Prisma } from "@prisma/client"
import { logAuditEvent } from "../utils/audit-log"

export interface RuleStatusResult {
  ruleId: string
  success: boolean
  previousStatus: string
  newStatus: string
  error?: string
}

export interface PublishRulesResult {
  success: boolean
  results: RuleStatusResult[]
  publishedCount: number
  failedCount: number
  errors: string[]
}

export interface RevertRulesResult {
  success: boolean
  results: RuleStatusResult[]
  revertedCount: number
  failedCount: number
  errors: string[]
}

/**
 * Publish rules to PUBLISHED status within a transaction.
 *
 * This is the ONLY correct path to publish rules. It:
 * 1. Wraps all updates in a transaction (atomic)
 * 2. Sets regulatory context with source="releaser"
 * 3. Updates each rule individually so Prisma extension validates each
 * 4. Records per-rule audit events
 *
 * @param ruleIds - Array of rule IDs to publish (must be in APPROVED status)
 * @param source - The agent/service requesting publication (e.g., "releaser", "hnb-fetcher")
 * @param actorUserId - Optional user ID for audit trail
 */
export async function publishRules(
  ruleIds: string[],
  source: string,
  actorUserId?: string
): Promise<PublishRulesResult> {
  if (ruleIds.length === 0) {
    return {
      success: true,
      results: [],
      publishedCount: 0,
      failedCount: 0,
      errors: [],
    }
  }

  const results: RuleStatusResult[] = []
  const errors: string[] = []

  // Wrap entire operation in regulatory context
  return runWithRegulatoryContext({ source, actorUserId }, async () => {
    try {
      // Use transaction for atomicity - all or nothing
      await db.$transaction(
        async (tx) => {
          for (const ruleId of ruleIds) {
            try {
              // First get current status
              const existing = await tx.regulatoryRule.findUnique({
                where: { id: ruleId },
                select: { status: true, conceptSlug: true },
              })

              if (!existing) {
                results.push({
                  ruleId,
                  success: false,
                  previousStatus: "UNKNOWN",
                  newStatus: "PUBLISHED",
                  error: "Rule not found",
                })
                errors.push(`Rule ${ruleId} not found`)
                continue
              }

              if (existing.status !== "APPROVED") {
                results.push({
                  ruleId,
                  success: false,
                  previousStatus: existing.status,
                  newStatus: "PUBLISHED",
                  error: `Rule must be APPROVED to publish, was ${existing.status}`,
                })
                errors.push(
                  `Rule ${ruleId} (${existing.conceptSlug}) is ${existing.status}, not APPROVED`
                )
                continue
              }

              // Update status - Prisma extension will validate transition
              await tx.regulatoryRule.update({
                where: { id: ruleId },
                data: { status: "PUBLISHED" },
              })

              results.push({
                ruleId,
                success: true,
                previousStatus: existing.status,
                newStatus: "PUBLISHED",
              })
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error)
              results.push({
                ruleId,
                success: false,
                previousStatus: "UNKNOWN",
                newStatus: "PUBLISHED",
                error: errorMessage,
              })
              errors.push(`Rule ${ruleId}: ${errorMessage}`)
              // Re-throw to abort transaction
              throw error
            }
          }

          // If any rule failed, the transaction is already aborted
          if (errors.length > 0) {
            throw new Error(`Failed to publish ${errors.length} rule(s)`)
          }
        },
        {
          timeout: 30000,
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        }
      )

      // Log audit events after successful transaction
      for (const result of results.filter((r) => r.success)) {
        await logAuditEvent({
          action: "RULE_STATUS_CHANGED",
          entityType: "RULE",
          entityId: result.ruleId,
          performedBy: actorUserId,
          metadata: {
            previousStatus: result.previousStatus,
            newStatus: result.newStatus,
            source,
            method: "publishRules",
          },
        })
      }

      const publishedCount = results.filter((r) => r.success).length
      return {
        success: true,
        results,
        publishedCount,
        failedCount: 0,
        errors: [],
      }
    } catch (error) {
      // Transaction failed - no rules were published
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        success: false,
        results,
        publishedCount: 0,
        failedCount: ruleIds.length,
        errors: [errorMessage, ...errors],
      }
    }
  })
}

/**
 * Revert rules from PUBLISHED back to APPROVED status.
 *
 * Used during rollback operations. This:
 * 1. Wraps all updates in a transaction
 * 2. Sets regulatory context with source="rollback"
 * 3. Updates each rule individually
 * 4. Records per-rule audit events
 *
 * Note: This transition (PUBLISHED → APPROVED) is NOT in the normal allowed
 * transitions. We handle it specially for rollback by going to DEPRECATED
 * first conceptually, but practically we need to support reverting.
 *
 * @param ruleIds - Array of rule IDs to revert
 * @param source - The source of the revert (e.g., "rollback", "manual")
 * @param actorUserId - Optional user ID for audit trail
 */
export async function revertRulesToApproved(
  ruleIds: string[],
  source: string,
  actorUserId?: string
): Promise<RevertRulesResult> {
  if (ruleIds.length === 0) {
    return {
      success: true,
      results: [],
      revertedCount: 0,
      failedCount: 0,
      errors: [],
    }
  }

  const results: RuleStatusResult[] = []
  const errors: string[] = []

  // For rollback, we need bypassApproval to allow PUBLISHED → APPROVED
  // This is a special case that only rollback should use
  return runWithRegulatoryContext({ source, actorUserId, bypassApproval: true }, async () => {
    try {
      await db.$transaction(
        async (tx) => {
          for (const ruleId of ruleIds) {
            try {
              const existing = await tx.regulatoryRule.findUnique({
                where: { id: ruleId },
                select: { status: true, conceptSlug: true },
              })

              if (!existing) {
                results.push({
                  ruleId,
                  success: false,
                  previousStatus: "UNKNOWN",
                  newStatus: "APPROVED",
                  error: "Rule not found",
                })
                errors.push(`Rule ${ruleId} not found`)
                continue
              }

              if (existing.status !== "PUBLISHED") {
                results.push({
                  ruleId,
                  success: false,
                  previousStatus: existing.status,
                  newStatus: "APPROVED",
                  error: `Rule is ${existing.status}, not PUBLISHED`,
                })
                errors.push(
                  `Rule ${ruleId} (${existing.conceptSlug}) is ${existing.status}, not PUBLISHED`
                )
                continue
              }

              // Update status
              await tx.regulatoryRule.update({
                where: { id: ruleId },
                data: { status: "APPROVED" },
              })

              results.push({
                ruleId,
                success: true,
                previousStatus: existing.status,
                newStatus: "APPROVED",
              })
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error)
              results.push({
                ruleId,
                success: false,
                previousStatus: "UNKNOWN",
                newStatus: "APPROVED",
                error: errorMessage,
              })
              errors.push(`Rule ${ruleId}: ${errorMessage}`)
              throw error
            }
          }

          if (errors.length > 0) {
            throw new Error(`Failed to revert ${errors.length} rule(s)`)
          }
        },
        {
          timeout: 30000,
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        }
      )

      // Log audit events after successful transaction
      for (const result of results.filter((r) => r.success)) {
        await logAuditEvent({
          action: "RULE_STATUS_CHANGED",
          entityType: "RULE",
          entityId: result.ruleId,
          performedBy: actorUserId,
          metadata: {
            previousStatus: result.previousStatus,
            newStatus: result.newStatus,
            source,
            method: "revertRulesToApproved",
            isRollback: true,
          },
        })
      }

      const revertedCount = results.filter((r) => r.success).length
      return {
        success: true,
        results,
        revertedCount,
        failedCount: 0,
        errors: [],
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        success: false,
        results,
        revertedCount: 0,
        failedCount: ruleIds.length,
        errors: [errorMessage, ...errors],
      }
    }
  })
}

/**
 * Approve a rule (PENDING_REVIEW → APPROVED).
 *
 * @param ruleId - The rule ID to approve
 * @param approvedBy - User ID who approved
 * @param source - The source of approval (e.g., "reviewer", "manual")
 */
export async function approveRule(
  ruleId: string,
  approvedBy: string,
  source: string
): Promise<RuleStatusResult> {
  return runWithRegulatoryContext({ source, actorUserId: approvedBy }, async () => {
    try {
      const existing = await db.regulatoryRule.findUnique({
        where: { id: ruleId },
        select: { status: true, conceptSlug: true },
      })

      if (!existing) {
        return {
          ruleId,
          success: false,
          previousStatus: "UNKNOWN",
          newStatus: "APPROVED",
          error: "Rule not found",
        }
      }

      if (existing.status !== "PENDING_REVIEW") {
        return {
          ruleId,
          success: false,
          previousStatus: existing.status,
          newStatus: "APPROVED",
          error: `Rule must be PENDING_REVIEW to approve, was ${existing.status}`,
        }
      }

      await db.regulatoryRule.update({
        where: { id: ruleId },
        data: {
          status: "APPROVED",
          approvedBy,
          approvedAt: new Date(),
        },
      })

      await logAuditEvent({
        action: "RULE_APPROVED",
        entityType: "RULE",
        entityId: ruleId,
        performedBy: approvedBy,
        metadata: {
          previousStatus: existing.status,
          source,
        },
      })

      return {
        ruleId,
        success: true,
        previousStatus: existing.status,
        newStatus: "APPROVED",
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        ruleId,
        success: false,
        previousStatus: "UNKNOWN",
        newStatus: "APPROVED",
        error: errorMessage,
      }
    }
  })
}
