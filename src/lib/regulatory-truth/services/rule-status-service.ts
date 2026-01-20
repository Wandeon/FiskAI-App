// src/lib/regulatory-truth/services/rule-status-service.ts
// Domain service for regulatory rule status transitions.
// All status changes must go through here to ensure:
// 1. Proper regulatory context is set
// 2. Per-rule validation occurs
// 3. Transaction atomicity is maintained
// 4. Audit trail is complete
// 5. PROVENANCE VALIDATION: Every quote must exist in evidence

import { db, dbReg, runWithRegulatoryContext, getRegulatoryContext } from "@/lib/db"
import { isAutoApprovalAllowed } from "../policy/auto-approval-policy"
import { Prisma } from "@prisma/client"
import { logAuditEvent } from "../utils/audit-log"
import { rebuildEdgesForRule } from "../graph/edge-builder"
import { raiseAlert } from "../watchdog/alerting"
import { enqueueGraphRebuildJob } from "@/lib/infra/queues"
import {
  validateQuoteInEvidence,
  isMatchTypeAcceptableForTier,
  type RuleProvenanceResult,
  type ProvenanceValidationResult,
} from "../utils/quote-in-evidence"
import { getExtractableContent } from "../utils/content-provider"

/**
 * Prisma transaction client type - compatible with both full client and tx client.
 * Use this when a function needs to accept either db or tx from $transaction.
 */
type PrismaTransactionClient = Omit<
  typeof db,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>

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
 * @param prismaClient - Optional Prisma client (pass tx for transaction atomicity)
 * @returns Validation result with per-pointer details
 */
async function validateRuleProvenance(
  ruleId: string,
  riskTier: string,
  prismaClient: PrismaTransactionClient = db
): Promise<RuleProvenanceResult> {
  // Load rule
  const rule = await prismaClient.regulatoryRule.findUnique({
    where: { id: ruleId },
  })

  // Query source pointers separately (many-to-many relation, no evidence include)
  const sourcePointers = await prismaClient.sourcePointer.findMany({
    where: { rules: { some: { id: ruleId } } },
  })

  // Fetch evidence records separately via dbReg (soft reference via evidenceId)
  // Include contentHash for audit trail
  const evidenceIds = sourcePointers.map((sp) => sp.evidenceId)
  const evidenceRecords = await dbReg.evidence.findMany({
    where: { id: { in: evidenceIds } },
    select: {
      id: true,
      contentHash: true,
    },
  })
  const evidenceHashMap = new Map(evidenceRecords.map((e) => [e.id, e.contentHash]))

  // Pre-fetch extractable content for all evidence IDs
  // This uses content-provider which correctly resolves artifact text for PDFs
  const evidenceContentMap = new Map<string, string>()
  for (const evidenceId of new Set(evidenceIds)) {
    try {
      const content = await getExtractableContent(evidenceId)
      evidenceContentMap.set(evidenceId, content.text)
    } catch {
      // Evidence not found - will fail validation below
      evidenceContentMap.set(evidenceId, "")
    }
  }

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
  if (sourcePointers.length === 0) {
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

  for (const pointer of sourcePointers) {
    // Get extractable content (artifact text for PDFs, rawContent for HTML)
    const evidenceContent = evidenceContentMap.get(pointer.evidenceId) ?? ""
    const contentHash = evidenceHashMap.get(pointer.evidenceId) ?? undefined

    // Validate quote exists in evidence content
    const validationResult = validateQuoteInEvidence(
      pointer.id,
      pointer.evidenceId,
      pointer.exactQuote,
      evidenceContent,
      contentHash
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

    // NOTE: HARD GATE for T0/T1 exact-match requirement REMOVED (2026-01-16)
    // NORMALIZED matches are now accepted for all tiers per policy change.
    // The isMatchTypeAcceptableForTier() function handles all tier-based policy.
    // Offsets are still recorded when available but not required for validation.

    // Persist offsets and matchType to SourcePointer
    // ALWAYS record what we found, including NOT_FOUND failures
    // This ensures NOT_FOUND is distinguished from PENDING_VERIFICATION
    // NOTE: Uses prismaClient (may be tx) for transaction atomicity
    const matchTypeEnum = matchTypeToEnum(validationResult.matchResult.matchType)
    if (validationResult.matchResult.found) {
      // Quote found - persist offsets and matchType
      await prismaClient.sourcePointer.update({
        where: { id: pointer.id },
        data: {
          startOffset: validationResult.matchResult.start,
          endOffset: validationResult.matchResult.end,
          matchType: matchTypeEnum,
        },
      })
    } else {
      // Quote NOT found - persist NOT_FOUND status (no offsets)
      // This is CRITICAL: without this, NOT_FOUND looks like PENDING_VERIFICATION
      await prismaClient.sourcePointer.update({
        where: { id: pointer.id },
        data: {
          matchType: matchTypeEnum, // Will be "NOT_FOUND"
          // Explicitly clear offsets to signal broken provenance
          startOffset: null,
          endOffset: null,
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
              // Pass tx for transaction atomicity - provenance writes must be part of tx
              const provenanceResult = await validateRuleProvenance(ruleId, existing.riskTier, tx)
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

              // Update status and set graphStatus to PENDING
              // graphStatus will be set to CURRENT after edge rebuild succeeds (post-commit)
              // This ensures rules are auditable even if process crashes after commit
              await tx.regulatoryRule.update({
                where: { id: ruleId },
                data: { status: "PUBLISHED", graphStatus: "PENDING" },
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

      // ========================================
      // EVENT-DRIVEN EDGE BUILDING
      // ========================================
      // After transaction commits, rebuild SRG edges for each published rule.
      // This replaces the batch buildKnowledgeGraph() with on-demand edge computation.
      // Edges are built outside the transaction to avoid blocking publish on graph failures.
      const publishedRuleIds = results.filter((r) => r.success).map((r) => r.ruleId)
      for (const ruleId of publishedRuleIds) {
        try {
          const edgeResult = await rebuildEdgesForRule(ruleId)
          console.log(
            `[rule-status] Built edges for ${ruleId}: ` +
              `SUPERSEDES=${edgeResult.supersedes.created}, ` +
              `OVERRIDES=${edgeResult.overrides.created}, ` +
              `DEPENDS_ON=${edgeResult.dependsOn.created}`
          )

          // Update graphStatus to CURRENT on success
          await db.regulatoryRule.update({
            where: { id: ruleId },
            data: { graphStatus: "CURRENT" },
          })

          // Log edge errors as warnings (not fatal)
          const allEdgeErrors = [
            ...edgeResult.supersedes.errors,
            ...edgeResult.overrides.errors,
            ...edgeResult.dependsOn.errors,
          ]
          if (allEdgeErrors.length > 0) {
            console.warn(`[rule-status] Edge warnings for ${ruleId}:`, allEdgeErrors)
          }
        } catch (edgeError) {
          // Edge build failed - mark rule as STALE and raise alert
          // This is NON-FATAL: the rule is still published, but edges need attention
          console.error(`[rule-status] Edge build failed for ${ruleId}:`, edgeError)

          await db.regulatoryRule.update({
            where: { id: ruleId },
            data: { graphStatus: "STALE" },
          })

          const errorMessage = edgeError instanceof Error ? edgeError.message : String(edgeError)
          const errorStack = edgeError instanceof Error ? edgeError.stack : undefined

          await raiseAlert({
            severity: "WARNING",
            type: "PIPELINE_FAILURE",
            entityId: ruleId, // Enable per-rule dedupe
            message: `[Graph] Edge build failed for rule ${ruleId}: ${errorMessage}`,
            details: {
              ruleId,
              errorName: edgeError instanceof Error ? edgeError.name : "Unknown",
              errorMessage,
              stack: errorStack,
              phase: "post-publish-edge-rebuild",
            },
          })

          // Enqueue retry with backoff (attempt 0 = first retry after 5 minutes)
          await enqueueGraphRebuildJob(ruleId, 0)
        }
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
        // There are TWO types of auto-approval:
        //
        // 1. STRUCTURED SOURCE auto-approval (sourceSlug provided):
        //    Rules from machine-parseable sources (HNB API, etc.)
        //    MUST pass allowlist check in isAutoApprovalAllowed()
        //
        // 2. GRACE PERIOD auto-approval (no sourceSlug):
        //    Rules that have been PENDING_REVIEW for 24h+ and weren't rejected
        //    Already passed queue gate, so allowlist check is skipped
        //    But T0/T1 are still blocked (enforced in autoApproveEligibleRules)
        //
        if (isAutoApproveRequest && options?.sourceSlug) {
          // Structured source auto-approval - enforce allowlist
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
        // Note: If isAutoApproveRequest && !sourceSlug, this is grace-period auto-approve
        // We allow it through but audit will show autoApprove=true for transparency

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

/**
 * Revoke a published rule (mark as revoked but keep record).
 *
 * Per Appendix A: Rollback Capability. This sets revokedAt and revokedReason
 * but does NOT delete the rule - it remains in the database for audit trail.
 * Revoked rules are excluded from assistant queries (status check + revokedAt check).
 *
 * Use cases:
 * - Quality issues detected after publication
 * - Incorrect regulatory information
 * - Safe mode escalation triggers
 *
 * @param ruleId - The rule ID to revoke
 * @param reason - Human-readable reason for revocation
 * @param actorUserId - User ID performing the revocation
 */
export async function revokeRule(
  ruleId: string,
  reason: string,
  actorUserId?: string
): Promise<RuleStatusResult> {
  return runWithRegulatoryContext({ source: "revoke", actorUserId }, async () => {
    try {
      const existing = await db.regulatoryRule.findUnique({
        where: { id: ruleId },
        select: { status: true, conceptSlug: true, revokedAt: true },
      })

      if (!existing) {
        return {
          ruleId,
          success: false,
          previousStatus: "UNKNOWN",
          newStatus: "REVOKED",
          error: "Rule not found",
        }
      }

      if (existing.revokedAt) {
        return {
          ruleId,
          success: false,
          previousStatus: existing.status,
          newStatus: "REVOKED",
          error: `Rule was already revoked at ${existing.revokedAt.toISOString()}`,
        }
      }

      // Update rule with revocation fields
      await db.regulatoryRule.update({
        where: { id: ruleId },
        data: {
          revokedAt: new Date(),
          revokedReason: reason,
          // Keep status as-is - the revokedAt field indicates revocation
          // This allows us to see what state the rule was in when revoked
        },
      })

      await logAuditEvent({
        action: "RULE_REVOKED",
        entityType: "RULE",
        entityId: ruleId,
        performedBy: actorUserId,
        metadata: {
          previousStatus: existing.status,
          reason,
          conceptSlug: existing.conceptSlug,
        },
      })

      console.log(`[rule-status] Revoked rule ${ruleId} (${existing.conceptSlug}): ${reason}`)

      return {
        ruleId,
        success: true,
        previousStatus: existing.status,
        newStatus: "REVOKED",
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        ruleId,
        success: false,
        previousStatus: "UNKNOWN",
        newStatus: "REVOKED",
        error: errorMessage,
      }
    }
  })
}

/**
 * Bulk revoke rules that match certain criteria.
 *
 * Per Appendix A: Automatic Rollback Trigger.
 * Used when safe mode conditions are met.
 *
 * @param ruleIds - Array of rule IDs to revoke
 * @param reason - Shared reason for all revocations
 * @param actorUserId - User ID performing the revocations
 */
export async function revokeRules(
  ruleIds: string[],
  reason: string,
  actorUserId?: string
): Promise<{
  success: boolean
  revokedCount: number
  failedCount: number
  errors: string[]
}> {
  if (ruleIds.length === 0) {
    return { success: true, revokedCount: 0, failedCount: 0, errors: [] }
  }

  const results = await Promise.all(ruleIds.map((id) => revokeRule(id, reason, actorUserId)))

  const errors = results.filter((r) => !r.success).map((r) => r.error || "Unknown error")
  const revokedCount = results.filter((r) => r.success).length
  const failedCount = results.filter((r) => !r.success).length

  return {
    success: failedCount === 0,
    revokedCount,
    failedCount,
    errors,
  }
}

// Re-export provenance types for consumers
export type { RuleProvenanceResult, ProvenanceValidationResult }
