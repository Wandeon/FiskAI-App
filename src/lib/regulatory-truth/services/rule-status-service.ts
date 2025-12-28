// src/lib/regulatory-truth/services/rule-status-service.ts
// Domain service for regulatory rule status transitions.
// All status changes must go through here to ensure:
// 1. Proper regulatory context is set
// 2. Per-rule validation occurs
// 3. Transaction atomicity is maintained
// 4. Audit trail is complete
// 5. PROVENANCE VALIDATION: Every quote must exist in evidence

import { db, runWithRegulatoryContext, getRegulatoryContext } from "@/lib/db"
import { isAutoApprovalAllowed } from "../policy/auto-approval-policy"
import { Prisma } from "@prisma/client"
import { logAuditEvent } from "../utils/audit-log"
import {
  validateQuoteInEvidence,
  isMatchTypeAcceptableForTier,
  type RuleProvenanceResult,
  type ProvenanceValidationResult,
} from "../utils/quote-in-evidence"

export interface RuleStatusResult {
  ruleId: string
  success: boolean
  previousStatus: string
  newStatus: string
  error?: string
  /** Provenance validation details (if validation was performed) */
  provenanceResult?: RuleProvenanceResult
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
 * HARD GATE: Validate provenance for a rule.
 *
 * Checks that every SourcePointer.exactQuote exists in its Evidence.rawContent.
 * This is the choke point that prevents fabricated or mis-anchored quotes.
 *
 * Side effect: Updates SourcePointer with offsets and matchType if found.
 * This ensures we persist the byte-level anchoring for audit and UI display.
 *
 * @param ruleId - Rule to validate
 * @param riskTier - Risk tier for policy enforcement (T0/T1 require exact, T2/T3 allow normalized)
 * @returns Validation result with per-pointer details
 */
async function validateRuleProvenance(
  ruleId: string,
  riskTier: string
): Promise<RuleProvenanceResult> {
  // Load rule with all source pointers and their evidence
  const rule = await db.regulatoryRule.findUnique({
    where: { id: ruleId },
    include: {
      sourcePointers: {
        include: {
          evidence: {
            select: {
              id: true,
              rawContent: true,
              contentHash: true,
            },
          },
        },
      },
    },
  })

  if (!rule) {
    return {
      ruleId,
      valid: false,
      pointerResults: [],
      failures: [
        {
          valid: false,
          pointerId: "N/A",
          evidenceId: "N/A",
          matchResult: { found: false, matchType: "not_found" },
          error: `Rule ${ruleId} not found`,
        },
      ],
    }
  }

  // INVARIANT: Must have at least one source pointer
  if (rule.sourcePointers.length === 0) {
    return {
      ruleId,
      valid: false,
      pointerResults: [],
      failures: [
        {
          valid: false,
          pointerId: "N/A",
          evidenceId: "N/A",
          matchResult: { found: false, matchType: "not_found" },
          error: `Rule ${ruleId} has no source pointers - cannot verify provenance`,
        },
      ],
    }
  }

  const pointerResults: ProvenanceValidationResult[] = []
  const failures: ProvenanceValidationResult[] = []
  const isCriticalTier = riskTier === "T0" || riskTier === "T1"

  for (const pointer of rule.sourcePointers) {
    // Validate quote exists in evidence
    const validationResult = validateQuoteInEvidence(
      pointer.id,
      pointer.evidenceId,
      pointer.exactQuote,
      pointer.evidence.rawContent,
      pointer.evidence.contentHash ?? undefined
    )

    // Apply tier-based policy
    if (validationResult.valid) {
      const policyCheck = isMatchTypeAcceptableForTier(
        validationResult.matchResult.matchType,
        riskTier
      )

      if (!policyCheck.acceptable) {
        validationResult.valid = false
        validationResult.error = policyCheck.reason
      }
    }

    // HARD GATE: T0/T1 require EXACT match with valid offsets
    if (validationResult.valid && isCriticalTier) {
      // Must be exact match (already checked by isMatchTypeAcceptableForTier, but be explicit)
      if (validationResult.matchResult.matchType !== "exact") {
        validationResult.valid = false
        validationResult.error = `${riskTier} rules require EXACT match, got ${validationResult.matchResult.matchType}`
      }
      // Must have valid offsets
      else if (
        validationResult.matchResult.start === undefined ||
        validationResult.matchResult.end === undefined
      ) {
        validationResult.valid = false
        validationResult.error = `${riskTier} rules require byte-level offsets, offsets are missing`
      }
    }

    // Persist offsets and matchType to SourcePointer
    // This happens even if validation fails - we record what we found
    if (validationResult.matchResult.found) {
      const matchTypeEnum = matchTypeToEnum(validationResult.matchResult.matchType)
      await db.sourcePointer.update({
        where: { id: pointer.id },
        data: {
          startOffset: validationResult.matchResult.start,
          endOffset: validationResult.matchResult.end,
          matchType: matchTypeEnum,
        },
      })
    }

    pointerResults.push(validationResult)
    if (!validationResult.valid) {
      failures.push(validationResult)
    }
  }

  return {
    ruleId,
    valid: failures.length === 0,
    pointerResults,
    failures,
  }
}

/**
 * Convert internal match type to Prisma enum.
 */
function matchTypeToEnum(
  matchType: "exact" | "normalized" | "not_found"
): "EXACT" | "NORMALIZED" | "NOT_FOUND" {
  switch (matchType) {
    case "exact":
      return "EXACT"
    case "normalized":
      return "NORMALIZED"
    case "not_found":
      return "NOT_FOUND"
  }
}

/**
 * Format provenance failures into actionable error message.
 */
function formatProvenanceErrors(result: RuleProvenanceResult): string {
  if (result.failures.length === 0) return ""

  const errorLines = result.failures.map((f) => {
    const preview = f.matchResult.debug?.quotePreview || "N/A"
    return `- Pointer ${f.pointerId}: ${f.error} (quote: "${preview}...")`
  })

  return `Provenance validation failed for rule ${result.ruleId}:\n${errorLines.join("\n")}`
}

/**
 * Publish rules to PUBLISHED status within a transaction.
 *
 * This is the ONLY correct path to publish rules. It:
 * 1. Wraps all updates in a transaction (atomic)
 * 2. Sets regulatory context with source
 * 3. VALIDATES PROVENANCE for every rule (HARD GATE)
 * 4. Updates each rule individually so Prisma extension validates each
 * 5. Records per-rule audit events
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
              // First get current status and risk tier
              const existing = await tx.regulatoryRule.findUnique({
                where: { id: ruleId },
                select: { status: true, conceptSlug: true, riskTier: true },
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

              // ========================================
              // HARD GATE: PROVENANCE VALIDATION
              // ========================================
              const provenanceResult = await validateRuleProvenance(ruleId, existing.riskTier)
              if (!provenanceResult.valid) {
                const errorMsg = formatProvenanceErrors(provenanceResult)
                results.push({
                  ruleId,
                  success: false,
                  previousStatus: existing.status,
                  newStatus: "PUBLISHED",
                  error: errorMsg,
                  provenanceResult,
                })
                errors.push(errorMsg)
                // Abort transaction - provenance failure is fatal
                throw new Error(`Provenance validation failed for ${existing.conceptSlug}`)
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
                provenanceResult,
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
            provenanceValidated: true,
            matchTypes: result.provenanceResult?.pointerResults.map((p) => p.matchResult.matchType),
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
 * transitions. We handle it specially for rollback.
 *
 * NOTE: Rollback does NOT re-validate provenance because the rule was already
 * published with valid provenance. We're just reverting the status.
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
 * VALIDATES PROVENANCE before approving.
 * If autoApprove is requested, also validates against allowlist policy.
 *
 * @param ruleId - The rule ID to approve
 * @param approvedBy - User ID who approved (or pipeline ID for auto-approve)
 * @param source - The source of approval (e.g., "reviewer", "manual", "hnb-pipeline")
 * @param options - Optional: sourceSlug for auto-approval allowlist check
 */
export async function approveRule(
  ruleId: string,
  approvedBy: string,
  source: string,
  options?: {
    /** Source slug for allowlist matching (required if autoApprove=true in context) */
    sourceSlug?: string
  }
): Promise<RuleStatusResult> {
  // Get context to check if auto-approve is requested
  const ctx = getRegulatoryContext()
  const isAutoApproveRequest = ctx?.autoApprove === true

  return runWithRegulatoryContext(
    { source, actorUserId: approvedBy, autoApprove: isAutoApproveRequest },
    async () => {
      try {
        const existing = await db.regulatoryRule.findUnique({
          where: { id: ruleId },
          select: {
            status: true,
            conceptSlug: true,
            riskTier: true,
            authorityLevel: true,
            confidence: true,
          },
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

        // ========================================
        // HARD GATE: AUTO-APPROVAL ALLOWLIST
        // ========================================
        // If auto-approve is requested, enforce the allowlist policy
        if (isAutoApproveRequest) {
          if (!options?.sourceSlug) {
            return {
              ruleId,
              success: false,
              previousStatus: existing.status,
              newStatus: "APPROVED",
              error: "Auto-approval requires sourceSlug for allowlist check",
            }
          }

          const allowlistCheck = isAutoApprovalAllowed(
            {
              conceptSlug: existing.conceptSlug,
              riskTier: existing.riskTier,
              authorityLevel: existing.authorityLevel,
              confidence: existing.confidence,
            },
            options.sourceSlug
          )

          if (!allowlistCheck.allowed) {
            return {
              ruleId,
              success: false,
              previousStatus: existing.status,
              newStatus: "APPROVED",
              error: `Auto-approval denied: ${allowlistCheck.reason}`,
            }
          }
        }

        // ========================================
        // HARD GATE: PROVENANCE VALIDATION
        // ========================================
        const provenanceResult = await validateRuleProvenance(ruleId, existing.riskTier)
        if (!provenanceResult.valid) {
          const errorMsg = formatProvenanceErrors(provenanceResult)
          return {
            ruleId,
            success: false,
            previousStatus: existing.status,
            newStatus: "APPROVED",
            error: errorMsg,
            provenanceResult,
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
            provenanceValidated: true,
            matchTypes: provenanceResult.pointerResults.map((p) => p.matchResult.matchType),
            isAutoApprove: isAutoApproveRequest,
          },
        })

        return {
          ruleId,
          success: true,
          previousStatus: existing.status,
          newStatus: "APPROVED",
          provenanceResult,
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
    }
  )
}

// Re-export provenance types for consumers
export type { RuleProvenanceResult, ProvenanceValidationResult }
