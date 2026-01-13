// src/lib/regulatory-truth/utils/rule-revocation.ts
//
// Mission #3: Deterministic Rollback Capability
//
// Provides the ability to:
// - Mark a RegulatoryRule as REVOKED with a reason
// - Trace lineage back to the originating CandidateFact/AgentRun
// - Make rollback a structured, auditable action

import { db } from "@/lib/db"
import { logAuditEvent } from "./audit-log"

// Re-export pure types
export {
  RevocationReason,
  type RevocationInput,
  type RevocationResult,
  type RuleLineage,
} from "./rule-revocation.types"

import {
  RevocationReason,
  type RevocationInput,
  type RevocationResult,
  type RuleLineage,
} from "./rule-revocation.types"

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

/**
 * Revoke a rule with a reason.
 *
 * This:
 * 1. Changes status to REVOKED
 * 2. Sets revokedAt and revokedReason
 * 3. Logs an audit event
 * 4. Returns lineage for tracing
 */
export async function revokeRule(input: RevocationInput): Promise<RevocationResult> {
  // Fetch the rule with its relations
  const rule = await db.regulatoryRule.findUnique({
    where: { id: input.ruleId },
    include: {
      sourcePointers: {
        select: { id: true, evidenceId: true },
      },
      supersededBy: {
        select: { id: true },
      },
    },
  })

  if (!rule) {
    return {
      success: false,
      ruleId: input.ruleId,
      previousStatus: "UNKNOWN",
      lineage: {
        candidateFactIds: [],
        agentRunIds: [],
        sourcePointerIds: [],
        evidenceIds: [],
        supersededRuleIds: [],
      },
      error: `Rule ${input.ruleId} not found`,
    }
  }

  // Prevent double revocation
  if (rule.status === "REVOKED") {
    return {
      success: false,
      ruleId: input.ruleId,
      previousStatus: rule.status,
      lineage: {
        candidateFactIds: [],
        agentRunIds: [],
        sourcePointerIds: [],
        evidenceIds: [],
        supersededRuleIds: [],
      },
      error: `Rule ${input.ruleId} is already revoked`,
    }
  }

  const previousStatus = rule.status
  const revokedReason = `[${input.reason}] ${input.detail}`

  // Update the rule
  await db.regulatoryRule.update({
    where: { id: input.ruleId },
    data: {
      status: "REVOKED",
      revokedAt: new Date(),
      revokedReason,
    },
  })

  // Get lineage information
  const lineage = await getFullLineage(input.ruleId)

  // Log audit event
  await logAuditEvent({
    action: "RULE_REVOKED",
    entityType: "RULE",
    entityId: input.ruleId,
    performedBy: input.performedBy,
    metadata: {
      reason: input.reason,
      detail: input.detail,
      previousStatus,
      lineage: {
        candidateFactCount: lineage.candidateFactIds.length,
        agentRunCount: lineage.agentRunIds.length,
        sourcePointerCount: lineage.sourcePointerIds.length,
        evidenceCount: lineage.evidenceIds.length,
      },
    },
  })

  console.log(
    `[revocation] Revoked rule ${input.ruleId} (reason: ${input.reason}) by ${input.performedBy}`
  )

  return {
    success: true,
    ruleId: input.ruleId,
    previousStatus,
    lineage,
  }
}

/**
 * Get full lineage for a rule.
 *
 * Traces back to:
 * - CandidateFacts that were promoted to this rule
 * - AgentRuns involved in creating this rule
 * - SourcePointers linked to this rule
 * - Evidence records behind the source pointers
 */
export async function getFullLineage(ruleId: string): Promise<RuleLineage> {
  // Get rule with all relations
  const rule = await db.regulatoryRule.findUnique({
    where: { id: ruleId },
    include: {
      sourcePointers: {
        select: { id: true, evidenceId: true },
      },
      agentRuns: {
        select: { id: true },
      },
      supersededBy: {
        select: { id: true },
      },
    },
  })

  if (!rule) {
    return {
      candidateFactIds: [],
      agentRunIds: [],
      sourcePointerIds: [],
      evidenceIds: [],
      supersededRuleIds: [],
    }
  }

  // Get the new envelope fields if they exist
  const candidateFactIds = rule.originatingCandidateFactIds || []
  const agentRunIds = rule.originatingAgentRunIds || rule.agentRuns.map((ar) => ar.id)

  // If originatingCandidateFactIds is empty, try to find from CandidateFact table
  let finalCandidateFactIds = candidateFactIds
  if (finalCandidateFactIds.length === 0) {
    const promotedFacts = await db.candidateFact.findMany({
      where: { promotedToRuleFactId: ruleId },
      select: { id: true },
    })
    finalCandidateFactIds = promotedFacts.map((cf) => cf.id)
  }

  return {
    candidateFactIds: finalCandidateFactIds,
    agentRunIds,
    sourcePointerIds: rule.sourcePointers.map((sp) => sp.id),
    evidenceIds: rule.sourcePointers.map((sp) => sp.evidenceId),
    supersededRuleIds: rule.supersededBy.map((r) => r.id),
  }
}

/**
 * Batch revoke rules by concept slug.
 *
 * Useful when a regulatory source is completely retracted.
 */
export async function batchRevokeByConceptSlug(
  conceptSlug: string,
  reason: RevocationReason,
  detail: string,
  performedBy: string
): Promise<{ revokedCount: number; ruleIds: string[] }> {
  const rules = await db.regulatoryRule.findMany({
    where: {
      conceptSlug,
      status: { not: "REVOKED" },
    },
    select: { id: true },
  })

  const ruleIds: string[] = []

  for (const rule of rules) {
    const result = await revokeRule({
      ruleId: rule.id,
      reason,
      detail,
      performedBy,
    })

    if (result.success) {
      ruleIds.push(rule.id)
    }
  }

  console.log(
    `[revocation] Batch revoked ${ruleIds.length} rules for concept ${conceptSlug} by ${performedBy}`
  )

  return {
    revokedCount: ruleIds.length,
    ruleIds,
  }
}

/**
 * Batch revoke rules by evidence ID.
 *
 * Useful when an evidence source is retracted or found to be invalid.
 */
export async function batchRevokeByEvidenceId(
  evidenceId: string,
  reason: RevocationReason,
  detail: string,
  performedBy: string
): Promise<{ revokedCount: number; ruleIds: string[] }> {
  // Find all rules linked to this evidence through source pointers
  const sourcePointers = await db.sourcePointer.findMany({
    where: { evidenceId },
    include: {
      rules: {
        select: { id: true, status: true },
      },
    },
  })

  const ruleIdsToRevoke = new Set<string>()
  for (const sp of sourcePointers) {
    for (const rule of sp.rules) {
      if (rule.status !== "REVOKED") {
        ruleIdsToRevoke.add(rule.id)
      }
    }
  }

  const ruleIds: string[] = []

  for (const ruleId of ruleIdsToRevoke) {
    const result = await revokeRule({
      ruleId,
      reason,
      detail: `${detail} (evidence: ${evidenceId})`,
      performedBy,
    })

    if (result.success) {
      ruleIds.push(ruleId)
    }
  }

  console.log(
    `[revocation] Batch revoked ${ruleIds.length} rules linked to evidence ${evidenceId} by ${performedBy}`
  )

  return {
    revokedCount: ruleIds.length,
    ruleIds,
  }
}

/**
 * Get revoked rules with pagination.
 */
export async function getRevokedRules(options?: {
  limit?: number
  offset?: number
  fromDate?: Date
  toDate?: Date
}) {
  return db.regulatoryRule.findMany({
    where: {
      status: "REVOKED",
      ...(options?.fromDate || options?.toDate
        ? {
            revokedAt: {
              ...(options?.fromDate && { gte: options.fromDate }),
              ...(options?.toDate && { lte: options.toDate }),
            },
          }
        : {}),
    },
    orderBy: { revokedAt: "desc" },
    skip: options?.offset ?? 0,
    take: options?.limit ?? 100,
    select: {
      id: true,
      conceptSlug: true,
      titleHr: true,
      value: true,
      revokedAt: true,
      revokedReason: true,
      derivedConfidence: true,
    },
  })
}

/**
 * Get revocation statistics.
 */
export async function getRevocationStats(): Promise<{
  totalRevoked: number
  revokedLast24h: number
  revokedLast7d: number
  byReason: Record<string, number>
}> {
  const now = new Date()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [totalRevoked, revokedLast24h, revokedLast7d, allRevoked] = await Promise.all([
    db.regulatoryRule.count({ where: { status: "REVOKED" } }),
    db.regulatoryRule.count({
      where: { status: "REVOKED", revokedAt: { gte: yesterday } },
    }),
    db.regulatoryRule.count({
      where: { status: "REVOKED", revokedAt: { gte: lastWeek } },
    }),
    db.regulatoryRule.findMany({
      where: { status: "REVOKED" },
      select: { revokedReason: true },
    }),
  ])

  // Count by reason (extract reason code from "[REASON] detail" format)
  const byReason: Record<string, number> = {}
  for (const rule of allRevoked) {
    const match = rule.revokedReason?.match(/^\[([A-Z_]+)\]/)
    const reason = match ? match[1] : "UNKNOWN"
    byReason[reason] = (byReason[reason] || 0) + 1
  }

  return {
    totalRevoked,
    revokedLast24h,
    revokedLast7d,
    byReason,
  }
}
