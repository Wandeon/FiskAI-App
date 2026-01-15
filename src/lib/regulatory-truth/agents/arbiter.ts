// src/lib/regulatory-truth/agents/arbiter.ts

import { db, dbReg } from "@/lib/db"
import {
  ArbiterInputSchema,
  ArbiterOutputSchema,
  type ArbiterInput,
  type ArbiterOutput,
  type ConflictingItem,
} from "../schemas"
import { runAgent } from "./runner"
import type { AuthorityLevel } from "@prisma/client"
import { logAuditEvent } from "../utils/audit-log"
import { withSoftFail } from "../utils/soft-fail"
import { findOverridingRules, doesOverride } from "../taxonomy/precedence-builder"
import { requestConflictReview } from "../services/human-review-service"

// =============================================================================
// ARBITER AGENT
// =============================================================================

export interface ArbiterResult {
  success: boolean
  output: ArbiterOutput | null
  resolution: "RULE_A_PREVAILS" | "RULE_B_PREVAILS" | "MERGE_RULES" | "ESCALATE_TO_HUMAN" | null
  updatedConflictId: string | null
  error: string | null
}

/**
 * Map authority level enum to hierarchy score (lower = higher authority)
 */
export function getAuthorityScore(level: AuthorityLevel): number {
  switch (level) {
    case "LAW":
      return 1
    case "GUIDANCE":
      return 2
    case "PROCEDURE":
      return 3
    case "PRACTICE":
      return 4
    default:
      return 999
  }
}

// Type for evidence with source (fetched separately via dbReg)
type EvidenceWithSource = {
  id: string
  url: string
  source: {
    id: string
    name: string
    hierarchy: number
  } | null
}

/**
 * Build conflicting item description with full context
 */
function buildConflictingItemClaim(
  rule: {
    id: string
    titleHr: string
    titleEn: string | null
    value: string
    valueType: string
    authorityLevel: AuthorityLevel
    effectiveFrom: Date
    effectiveUntil: Date | null
    appliesWhen: string
    explanationHr: string | null
    sourcePointers: Array<{
      id: string
      evidenceId: string
      exactQuote: string
      extractedValue: string
      confidence: number
    }>
  },
  evidenceMap: Map<string, EvidenceWithSource>
): string {
  const sources = rule.sourcePointers
    .map((sp) => {
      const evidence = evidenceMap.get(sp.evidenceId)
      const sourceName = evidence?.source?.name ?? "Unknown"
      return `"${sp.exactQuote}" (from ${sourceName}, confidence: ${sp.confidence})`
    })
    .join("; ")

  return `
Rule: ${rule.titleHr} (${rule.titleEn || "N/A"})
Value: ${rule.value} (${rule.valueType})
Authority Level: ${rule.authorityLevel}
Effective: ${rule.effectiveFrom.toISOString().split("T")[0]} to ${rule.effectiveUntil?.toISOString().split("T")[0] || "indefinite"}
Applies When: ${rule.appliesWhen}
Explanation: ${rule.explanationHr || "N/A"}
Source Evidence: ${sources}
  `.trim()
}

/**
 * Handle SOURCE_CONFLICT type - conflicts between source pointers (not rules)
 * These are created by Composer when conflicting values are detected in source data
 */
async function handleSourceConflict(conflict: {
  id: string
  description: string
  metadata: unknown
}): Promise<ArbiterResult> {
  const metadata = conflict.metadata as {
    sourcePointerIds?: string[]
    conflictingPointerIds?: string[]
    conflictDetails?: unknown
  } | null

  if (!metadata?.sourcePointerIds || metadata.sourcePointerIds.length === 0) {
    return {
      success: false,
      output: null,
      resolution: null,
      updatedConflictId: null,
      error: `SOURCE_CONFLICT has no sourcePointerIds in metadata: ${conflict.id}`,
    }
  }

  // Fetch the conflicting source pointers
  const sourcePointers = await db.sourcePointer.findMany({
    where: { id: { in: metadata.sourcePointerIds } },
  })

  // Fetch evidence records separately via dbReg (soft reference via evidenceId)
  const spEvidenceIds = sourcePointers.map((sp) => sp.evidenceId)
  const spEvidenceRecords = await dbReg.evidence.findMany({
    where: { id: { in: spEvidenceIds } },
    include: { source: true },
  })
  const spEvidenceMap = new Map(spEvidenceRecords.map((e) => [e.id, e]))

  if (sourcePointers.length < 2) {
    // Not enough pointers to have a conflict - mark as resolved
    await db.regulatoryConflict.update({
      where: { id: conflict.id },
      data: {
        status: "RESOLVED",
        resolution: {
          strategy: "auto_resolved",
          rationaleHr: "Nedovoljno pokazivača za sukob",
          rationaleEn: "Insufficient pointers for conflict",
        },
        resolvedAt: new Date(),
      },
    })

    return {
      success: true,
      output: null,
      resolution: "ESCALATE_TO_HUMAN", // Treated as resolved edge case
      updatedConflictId: conflict.id,
      error: null,
    }
  }

  // For SOURCE_CONFLICT, we escalate to human review by default
  // The human reviewer should examine the conflicting source data and decide which to use
  await db.regulatoryConflict.update({
    where: { id: conflict.id },
    data: {
      status: "ESCALATED",
      requiresHumanReview: true,
      humanReviewReason:
        "SOURCE_CONFLICT detected - conflicting values in source data require human review to determine correct value",
      resolution: {
        strategy: "human_review_required",
        rationaleHr: "Pronađene su proturječne vrijednosti u izvornim podacima",
        rationaleEn: "Conflicting values found in source data",
        sourcePointerIds: metadata.sourcePointerIds,
        pointerSummary: sourcePointers.map((sp) => {
          const evidence = spEvidenceMap.get(sp.evidenceId)
          return {
            id: sp.id,
            domain: sp.domain,
            value: sp.extractedValue,
            source: evidence?.source?.name,
            confidence: sp.confidence,
          }
        }),
      },
    },
  })

  // Create centralized human review request (Issue #884)
  await requestConflictReview(conflict.id, {
    conflictType: "SOURCE_CONFLICT",
    escalationReason: "source_data_conflict",
  })

  // Log audit event
  await logAuditEvent({
    action: "CONFLICT_ESCALATED",
    entityType: "CONFLICT",
    entityId: conflict.id,
    metadata: {
      conflictType: "SOURCE_CONFLICT",
      pointerCount: sourcePointers.length,
      reason: "Conflicting source pointer values require human review",
    },
  })

  return {
    success: true,
    output: null,
    resolution: "ESCALATE_TO_HUMAN",
    updatedConflictId: conflict.id,
    error: null,
  }
}

/**
 * Run the Arbiter agent to resolve a conflict between two rules
 */
export async function runArbiter(conflictId: string): Promise<ArbiterResult> {
  // Get conflict from database (without itemA/itemB relations - they were removed)
  const conflict = await db.regulatoryConflict.findUnique({
    where: { id: conflictId },
  })

  if (!conflict) {
    return {
      success: false,
      output: null,
      resolution: null,
      updatedConflictId: null,
      error: `Conflict not found: ${conflictId}`,
    }
  }

  // Handle SOURCE_CONFLICT type - these have null itemAId/itemBId and use metadata.sourcePointerIds
  if (conflict.conflictType === "SOURCE_CONFLICT") {
    return handleSourceConflict(conflict)
  }

  if (!conflict.itemAId || !conflict.itemBId) {
    return {
      success: false,
      output: null,
      resolution: null,
      updatedConflictId: null,
      error: `One or both conflicting rules not found for conflict: ${conflictId}`,
    }
  }

  // Fetch rules separately using soft reference IDs (without evidence relation)
  const [itemA, itemB] = await Promise.all([
    db.regulatoryRule.findUnique({
      where: { id: conflict.itemAId },
      include: {
        sourcePointers: true,
      },
    }),
    db.regulatoryRule.findUnique({
      where: { id: conflict.itemBId },
      include: {
        sourcePointers: true,
      },
    }),
  ])

  if (!itemA || !itemB) {
    return {
      success: false,
      output: null,
      resolution: null,
      updatedConflictId: null,
      error: `One or both conflicting rules not found for conflict: ${conflictId}`,
    }
  }

  // Fetch all evidence records for both rules' source pointers
  const allEvidenceIds = [
    ...itemA.sourcePointers.map((sp) => sp.evidenceId),
    ...itemB.sourcePointers.map((sp) => sp.evidenceId),
  ]
  const allEvidenceRecords = await dbReg.evidence.findMany({
    where: { id: { in: allEvidenceIds } },
    include: { source: true },
  })
  const evidenceMap = new Map<string, EvidenceWithSource>(allEvidenceRecords.map((e) => [e.id, e]))

  // ==========================================================================
  // TASK 1.3: TRY DETERMINISTIC RESOLUTION BEFORE LLM
  // ==========================================================================
  // Resolution hierarchy:
  // 1. Authority hierarchy (LAW > GUIDANCE > PROCEDURE > PRACTICE)
  // 2. Source hierarchy (Constitution > Law > Regulation > Guidance)
  // 3. Temporal (newer effective date wins if dates differ)
  //
  // Critical safeguards:
  // - T0/T1 rules NEVER auto-resolved (recommendationOnly=true → human review)
  // - Only T2/T3 rules can be auto-resolved (recommendationOnly=false → apply directly)

  // Get source hierarchy for each rule (lowest number = highest authority)
  const getLowestSourceHierarchy = (
    pointers: Array<{ evidenceId: string }>,
    evMap: Map<string, EvidenceWithSource>
  ): number | undefined => {
    let lowest: number | undefined
    for (const sp of pointers) {
      const evidence = evMap.get(sp.evidenceId)
      if (evidence?.source?.hierarchy !== undefined) {
        if (lowest === undefined || evidence.source.hierarchy < lowest) {
          lowest = evidence.source.hierarchy
        }
      }
    }
    return lowest
  }

  const ruleAForResolution: RuleForResolution = {
    id: itemA.id,
    riskTier: itemA.riskTier as "T0" | "T1" | "T2" | "T3",
    authorityLevel: itemA.authorityLevel,
    effectiveFrom: itemA.effectiveFrom,
    sourceHierarchy: getLowestSourceHierarchy(itemA.sourcePointers, evidenceMap),
  }

  const ruleBForResolution: RuleForResolution = {
    id: itemB.id,
    riskTier: itemB.riskTier as "T0" | "T1" | "T2" | "T3",
    authorityLevel: itemB.authorityLevel,
    effectiveFrom: itemB.effectiveFrom,
    sourceHierarchy: getLowestSourceHierarchy(itemB.sourcePointers, evidenceMap),
  }

  const deterministicResult = tryDeterministicResolution(ruleAForResolution, ruleBForResolution)

  console.log(
    `[arbiter] Deterministic resolution for conflict ${conflictId}: ` +
      `resolved=${deterministicResult.resolved}, recommendationOnly=${deterministicResult.recommendationOnly}`
  )

  // Handle deterministic resolution
  if (deterministicResult.resolved) {
    // Determine resolution type
    const detResolution: "RULE_A_PREVAILS" | "RULE_B_PREVAILS" | "ESCALATE_TO_HUMAN" =
      deterministicResult.recommendationOnly
        ? "ESCALATE_TO_HUMAN" // T0/T1: Escalate to human review
        : deterministicResult.winner === itemA.id
          ? "RULE_A_PREVAILS"
          : "RULE_B_PREVAILS"

    // Create audit trail for deterministic resolution
    await createConflictResolutionAudit(
      conflictId,
      detResolution,
      itemA.id,
      itemB.id,
      deterministicResult.reason,
      {
        authorityComparison: {
          scoreA: getAuthorityScore(itemA.authorityLevel),
          scoreB: getAuthorityScore(itemB.authorityLevel),
        },
        sourceComparison: {
          sourceAHierarchy: ruleAForResolution.sourceHierarchy ?? null,
          sourceBHierarchy: ruleBForResolution.sourceHierarchy ?? null,
          sourceAName: null, // Not tracked at this level
          sourceBName: null,
        },
        temporalAnalysis: {
          effectiveFromA: itemA.effectiveFrom.toISOString(),
          effectiveFromB: itemB.effectiveFrom.toISOString(),
        },
      }
    )

    if (deterministicResult.recommendationOnly) {
      // T0/T1: Create recommendation and escalate to human review
      console.log(
        `[arbiter] T0/T1 conflict detected - creating recommendation for human review: ${conflictId}`
      )

      // Update conflict with recommendation (but don't auto-resolve)
      await db.regulatoryConflict.update({
        where: { id: conflict.id },
        data: {
          status: "ESCALATED",
          resolution: {
            deterministicRecommendation: {
              winningItemId: deterministicResult.winner,
              losingItemId: deterministicResult.loser,
              reason: deterministicResult.reason,
            },
            strategy: "deterministic_recommendation",
            rationaleHr: `Preporučeno rješenje (zahtijeva ljudski pregled): ${deterministicResult.reason}`,
            rationaleEn: `Recommended resolution (requires human review): ${deterministicResult.reason}`,
          },
          requiresHumanReview: true,
          humanReviewReason: `T0/T1 rule conflict - deterministic recommendation provided but requires human approval`,
        },
      })

      // Create human review request
      await requestConflictReview(conflict.id, {
        conflictType: conflict.conflictType,
        ruleATier: itemA.riskTier,
        ruleBTier: itemB.riskTier,
        escalationReason: "tier_protection",
      })

      // Log audit event
      await logAuditEvent({
        action: "CONFLICT_ESCALATED",
        entityType: "CONFLICT",
        entityId: conflictId,
        metadata: {
          resolution: "ESCALATE_TO_HUMAN",
          method: "deterministic_recommendation",
          reason: deterministicResult.reason,
          recommendedWinner: deterministicResult.winner,
          tierA: itemA.riskTier,
          tierB: itemB.riskTier,
        },
      })

      return {
        success: true,
        output: null,
        resolution: "ESCALATE_TO_HUMAN",
        updatedConflictId: conflict.id,
        error: null,
      }
    } else {
      // T2/T3: Apply deterministic resolution directly (no LLM needed)
      console.log(
        `[arbiter] T2/T3 conflict resolved deterministically: ${conflictId} -> ${detResolution}`
      )

      // Update conflict with resolution
      await db.regulatoryConflict.update({
        where: { id: conflict.id },
        data: {
          status: "RESOLVED",
          resolution: {
            winningItemId: deterministicResult.winner,
            losingItemId: deterministicResult.loser,
            strategy: "deterministic",
            rationaleHr: deterministicResult.reason,
            rationaleEn: deterministicResult.reason,
            resolution: detResolution,
          },
          confidence: 1.0, // Deterministic resolutions have full confidence
          requiresHumanReview: false,
          resolvedAt: new Date(),
        },
      })

      // Update the losing rule's status
      if (detResolution === "RULE_A_PREVAILS") {
        await db.regulatoryRule.update({
          where: { id: itemB.id },
          data: {
            status: "DEPRECATED",
            reviewerNotes: JSON.stringify({
              deprecated_reason: "Deterministic conflict resolution - Rule A prevails",
              conflict_id: conflict.id,
              superseded_by: itemA.id,
              resolution_reason: deterministicResult.reason,
            }),
          },
        })
      } else if (detResolution === "RULE_B_PREVAILS") {
        await db.regulatoryRule.update({
          where: { id: itemA.id },
          data: {
            status: "DEPRECATED",
            reviewerNotes: JSON.stringify({
              deprecated_reason: "Deterministic conflict resolution - Rule B prevails",
              conflict_id: conflict.id,
              superseded_by: itemB.id,
              resolution_reason: deterministicResult.reason,
            }),
          },
        })
      }

      // Log audit event
      await logAuditEvent({
        action: "CONFLICT_RESOLVED",
        entityType: "CONFLICT",
        entityId: conflictId,
        metadata: {
          resolution: detResolution,
          method: "deterministic",
          reason: deterministicResult.reason,
          winner: deterministicResult.winner,
          loser: deterministicResult.loser,
          tierA: itemA.riskTier,
          tierB: itemB.riskTier,
        },
      })

      return {
        success: true,
        output: null,
        resolution: detResolution,
        updatedConflictId: conflict.id,
        error: null,
      }
    }
  }

  // Deterministic resolution not possible - fall through to LLM arbitration
  console.log(
    `[arbiter] Deterministic resolution not possible for ${conflictId}: ${deterministicResult.reason}`
  )

  // ==========================================================================
  // END TASK 1.3: DETERMINISTIC RESOLUTION
  // ==========================================================================

  // Build conflicting items for the agent
  const conflictingItems: ConflictingItem[] = [
    {
      item_id: itemA.id,
      item_type: "rule",
      claim: buildConflictingItemClaim(itemA, evidenceMap),
    },
    {
      item_id: itemB.id,
      item_type: "rule",
      claim: buildConflictingItemClaim(itemB, evidenceMap),
    },
  ]

  // Build input for agent
  const input: ArbiterInput = {
    conflictId: conflict.id,
    conflictType: conflict.conflictType,
    conflictingItems,
  }

  // Run the agent
  const result = await runAgent<ArbiterInput, ArbiterOutput>({
    agentType: "ARBITER",
    input,
    inputSchema: ArbiterInputSchema,
    outputSchema: ArbiterOutputSchema,
    temperature: 0.1,
    maxRetries: 3,
  })

  if (!result.success || !result.output) {
    return {
      success: false,
      output: null,
      resolution: null,
      updatedConflictId: null,
      error: result.error,
    }
  }

  const arbitration = result.output.arbitration

  // Determine resolution based on winning item
  let resolution: "RULE_A_PREVAILS" | "RULE_B_PREVAILS" | "MERGE_RULES" | "ESCALATE_TO_HUMAN"

  if (arbitration.requires_human_review) {
    resolution = "ESCALATE_TO_HUMAN"
  } else if (arbitration.resolution.winning_item_id === itemA.id) {
    resolution = "RULE_A_PREVAILS"
  } else if (arbitration.resolution.winning_item_id === itemB.id) {
    resolution = "RULE_B_PREVAILS"
  } else {
    // If agent suggests something else or unclear, escalate
    resolution = "ESCALATE_TO_HUMAN"
  }

  // Additional escalation logic based on business rules
  const shouldEscalate = checkEscalationCriteria(itemA, itemB, arbitration)
  if (shouldEscalate) {
    resolution = "ESCALATE_TO_HUMAN"
  }

  // Update conflict with resolution
  const updatedConflict = await db.regulatoryConflict.update({
    where: { id: conflict.id },
    data: {
      status: resolution === "ESCALATE_TO_HUMAN" ? "ESCALATED" : "RESOLVED",
      resolution: {
        winningItemId: arbitration.resolution.winning_item_id,
        strategy: arbitration.resolution.resolution_strategy,
        rationaleHr: arbitration.resolution.rationale_hr,
        rationaleEn: arbitration.resolution.rationale_en,
        resolution,
      },
      confidence: arbitration.confidence,
      requiresHumanReview: arbitration.requires_human_review || shouldEscalate,
      humanReviewReason:
        arbitration.human_review_reason || (shouldEscalate ? "Escalated by business rules" : null),
      resolvedAt: resolution !== "ESCALATE_TO_HUMAN" ? new Date() : null,
    },
  })

  // Create centralized human review request if escalating (Issue #884)
  if (resolution === "ESCALATE_TO_HUMAN") {
    const escalationReason =
      itemA.riskTier === "T0" && itemB.riskTier === "T0"
        ? "both_t0"
        : arbitration.confidence < 0.8
          ? "low_confidence"
          : "equal_authority"

    await requestConflictReview(conflict.id, {
      conflictType: conflict.conflictType,
      ruleATier: itemA.riskTier,
      ruleBTier: itemB.riskTier,
      confidence: arbitration.confidence,
      escalationReason,
    })
  }

  // Log audit event for conflict resolution
  await logAuditEvent({
    action: "CONFLICT_RESOLVED",
    entityType: "CONFLICT",
    entityId: conflictId,
    metadata: {
      resolution,
      strategy: arbitration.resolution.resolution_strategy,
      confidence: arbitration.confidence,
    },
  })

  // If one rule prevails, update the losing rule's status
  if (resolution === "RULE_A_PREVAILS") {
    await db.regulatoryRule.update({
      where: { id: itemB.id },
      data: {
        status: "DEPRECATED",
        reviewerNotes: JSON.stringify({
          deprecated_reason: "Conflict resolution - Rule A prevails",
          conflict_id: conflict.id,
          superseded_by: itemA.id,
          arbiter_rationale: arbitration.resolution.rationale_hr,
        }),
      },
    })
  } else if (resolution === "RULE_B_PREVAILS") {
    await db.regulatoryRule.update({
      where: { id: itemA.id },
      data: {
        status: "DEPRECATED",
        reviewerNotes: JSON.stringify({
          deprecated_reason: "Conflict resolution - Rule B prevails",
          conflict_id: conflict.id,
          superseded_by: itemB.id,
          arbiter_rationale: arbitration.resolution.rationale_hr,
        }),
      },
    })
  }

  return {
    success: true,
    output: result.output,
    resolution,
    updatedConflictId: updatedConflict.id,
    error: null,
  }
}

/**
 * Check if conflict should be escalated to human review based on business rules
 */
export function checkEscalationCriteria(
  ruleA: {
    authorityLevel: AuthorityLevel
    riskTier: string
    effectiveFrom: Date
    confidence: number
  },
  ruleB: {
    authorityLevel: AuthorityLevel
    riskTier: string
    effectiveFrom: Date
    confidence: number
  },
  arbitration: ArbiterOutput["arbitration"]
): boolean {
  // Escalate if low confidence in resolution
  if (arbitration.confidence < 0.8) {
    return true
  }

  // Escalate if both rules are T0 (critical)
  if (ruleA.riskTier === "T0" && ruleB.riskTier === "T0") {
    return true
  }

  // Escalate if authority levels are equal (can't use hierarchy to resolve)
  const scoreA = getAuthorityScore(ruleA.authorityLevel)
  const scoreB = getAuthorityScore(ruleB.authorityLevel)
  if (scoreA === scoreB && arbitration.resolution.resolution_strategy === "hierarchy") {
    return true
  }

  // Escalate if effective dates are the same and strategy is temporal
  if (
    ruleA.effectiveFrom.getTime() === ruleB.effectiveFrom.getTime() &&
    arbitration.resolution.resolution_strategy === "temporal"
  ) {
    return true
  }

  // Escalate if either rule has low confidence
  if (ruleA.confidence < 0.85 || ruleB.confidence < 0.85) {
    return true
  }

  return false
}

/**
 * Create audit trail for conflict resolution.
 */
async function createConflictResolutionAudit(
  conflictId: string,
  resolution: "RULE_A_PREVAILS" | "RULE_B_PREVAILS" | "MERGE_RULES" | "ESCALATE_TO_HUMAN",
  ruleAId: string | null,
  ruleBId: string | null,
  reason: string,
  metadata: {
    authorityComparison?: { scoreA: number; scoreB: number }
    sourceComparison?: {
      sourceAHierarchy: number | null
      sourceBHierarchy: number | null
      sourceAName: string | null
      sourceBName: string | null
    }
    temporalAnalysis?: { effectiveFromA: string; effectiveFromB: string }
    aiArbitration?: {
      strategy: string
      confidence: number
      rationaleHr: string
      rationaleEn: string
    }
  }
): Promise<void> {
  await dbReg.conflictResolutionAudit.create({
    data: {
      conflictId,
      ruleAId,
      ruleBId,
      resolution,
      reason,
      resolvedBy: "ARBITER_AGENT",
      metadata,
    },
  })
}

/**
 * Get all open conflicts that need arbitration
 */
export async function getPendingConflicts(): Promise<
  Array<{
    id: string
    conflictType: string
    description: string
    createdAt: Date
    itemAId: string | null
    itemBId: string | null
    itemA: { id: string; titleHr: string; riskTier: string } | null
    itemB: { id: string; titleHr: string; riskTier: string } | null
  }>
> {
  // Get conflicts without itemA/itemB relations (they were removed)
  const conflicts = await db.regulatoryConflict.findMany({
    where: {
      status: "OPEN",
    },
    orderBy: [
      { createdAt: "asc" }, // Oldest first
    ],
  })

  // Collect all rule IDs needed
  const ruleIds = conflicts
    .flatMap((c) => [c.itemAId, c.itemBId])
    .filter((id): id is string => id !== null)

  // Fetch all rules at once
  const rules = await db.regulatoryRule.findMany({
    where: { id: { in: ruleIds } },
    select: {
      id: true,
      titleHr: true,
      riskTier: true,
    },
  })

  // Build a map for quick lookup
  const ruleMap = new Map(rules.map((r) => [r.id, r]))

  // Return conflicts with resolved itemA/itemB
  return conflicts.map((c) => ({
    id: c.id,
    conflictType: c.conflictType,
    description: c.description,
    createdAt: c.createdAt,
    itemAId: c.itemAId,
    itemBId: c.itemBId,
    itemA: c.itemAId ? (ruleMap.get(c.itemAId) ?? null) : null,
    itemB: c.itemBId ? (ruleMap.get(c.itemBId) ?? null) : null,
  }))
}

/**
 * Batch process multiple conflicts
 */
export async function runArbiterBatch(limit: number = 10): Promise<{
  processed: number
  resolved: number
  escalated: number
  failed: number
  errors: string[]
}> {
  const conflicts = await getPendingConflicts()
  const toProcess = conflicts.slice(0, limit)

  const results = {
    processed: 0,
    resolved: 0,
    escalated: 0,
    failed: 0,
    errors: [] as string[],
  }

  for (const conflict of toProcess) {
    console.log(`[arbiter] Processing conflict: ${conflict.id}`)

    // Use soft-fail wrapper to prevent single failures from blocking entire batch
    const softFailResult = await withSoftFail(() => runArbiter(conflict.id), null, {
      operation: "arbiter_batch",
      entityType: "rule",
      metadata: {
        conflictId: conflict.id,
        conflictType: conflict.conflictType,
      },
    })

    results.processed++

    if (!softFailResult.success || !softFailResult.data?.success) {
      results.failed++
      const errorMsg = softFailResult.error || softFailResult.data?.error || "Unknown error"
      results.errors.push(`${conflict.id}: ${errorMsg}`)
    } else if (softFailResult.data.resolution === "ESCALATE_TO_HUMAN") {
      results.escalated++
    } else {
      results.resolved++
    }
  }

  console.log(
    `[arbiter] Batch complete: ${results.processed} processed, ${results.resolved} resolved, ${results.escalated} escalated, ${results.failed} failed`
  )

  return results
}

/**
 * Resolve which rule takes precedence when multiple rules match
 *
 * Uses lex specialis principle: specific rules override general rules
 * Resolution order:
 * 1. Check OVERRIDES edges
 * 2. Check specificity (more qualifiers = more specific)
 * 3. Check authority level (LAW > GUIDANCE > PROCEDURE > PRACTICE)
 * 4. Check recency (newer effective date wins)
 */
export async function resolveRulePrecedence(ruleIds: string[]): Promise<{
  winningRuleId: string
  reasoning: string
  overriddenRuleIds: string[]
}> {
  if (ruleIds.length === 0) {
    throw new Error("No rules to resolve")
  }

  if (ruleIds.length === 1) {
    return {
      winningRuleId: ruleIds[0],
      reasoning: "Single rule matched",
      overriddenRuleIds: [],
    }
  }

  // Fetch all rules
  const rules = await db.regulatoryRule.findMany({
    where: { id: { in: ruleIds } },
    include: {
      incomingEdges: {
        where: { relation: "OVERRIDES" },
      },
    },
  })

  // Step 1: Check for OVERRIDES edges
  for (const rule of rules) {
    // A rule with no incoming OVERRIDES edges is a candidate for winning
    const overridingRuleIds = await findOverridingRules(rule.id)
    const hasActiveOverride = overridingRuleIds.some((id) => ruleIds.includes(id))

    if (!hasActiveOverride) {
      // This rule is not overridden by any rule in our set
      // Check if it overrides others
      let overridesOthers = false
      const overridden: string[] = []

      for (const otherId of ruleIds) {
        if (otherId !== rule.id && (await doesOverride(rule.id, otherId))) {
          overridesOthers = true
          overridden.push(otherId)
        }
      }

      if (overridesOthers) {
        return {
          winningRuleId: rule.id,
          reasoning: `Lex specialis: Rule ${rule.conceptSlug} overrides ${overridden.length} general rule(s)`,
          overriddenRuleIds: overridden,
        }
      }
    }
  }

  // Step 2: Sort by authority level
  const authorityOrder = ["LAW", "GUIDANCE", "PROCEDURE", "PRACTICE"]
  const sortedByAuthority = [...rules].sort((a, b) => {
    return authorityOrder.indexOf(a.authorityLevel) - authorityOrder.indexOf(b.authorityLevel)
  })

  if (sortedByAuthority[0].authorityLevel !== sortedByAuthority[1].authorityLevel) {
    return {
      winningRuleId: sortedByAuthority[0].id,
      reasoning: `Authority: ${sortedByAuthority[0].authorityLevel} takes precedence over ${sortedByAuthority[1].authorityLevel}`,
      overriddenRuleIds: sortedByAuthority.slice(1).map((r) => r.id),
    }
  }

  // Step 3: Sort by effective date (most recent wins)
  const sortedByDate = [...rules].sort(
    (a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime()
  )

  return {
    winningRuleId: sortedByDate[0].id,
    reasoning: `Recency: Rule effective from ${sortedByDate[0].effectiveFrom.toISOString()} is most recent`,
    overriddenRuleIds: sortedByDate.slice(1).map((r) => r.id),
  }
}

// =============================================================================
// TASK 1.3: DETERMINISTIC CONFLICT PRE-RESOLUTION
// =============================================================================
// Resolution hierarchy (checked in order):
// 1. Authority hierarchy (LAW > GUIDANCE > PROCEDURE > PRACTICE)
// 2. Source hierarchy (Constitution > Law > Regulation > Guidance)
// 3. Temporal (newer effective date wins if dates differ)
//
// Critical safeguards:
// - T0/T1 rules NEVER auto-resolved (recommendation only)
// - Only T2/T3 rules can be auto-resolved
// - Audit trail with reasoning for all resolutions

/**
 * Minimal rule data required for deterministic resolution.
 * This type is decoupled from the full RegulatoryRule to enable pure unit testing.
 */
export interface RuleForResolution {
  id: string
  riskTier: "T0" | "T1" | "T2" | "T3"
  authorityLevel: AuthorityLevel
  effectiveFrom: Date
  sourceHierarchy?: number // 1=Ustav, 2=Zakon, 3=Podzakonski, 4=Pravilnik, 5=Uputa, 6=Misljenje, 7=Praksa
}

/**
 * Result of deterministic resolution attempt.
 */
export interface DeterministicResolution {
  /** Whether a deterministic resolution was found */
  resolved: boolean
  /** ID of the winning rule (if resolved) */
  winner?: string
  /** ID of the losing rule (if resolved) */
  loser?: string
  /** Human-readable explanation of the resolution or why it could not be resolved */
  reason: string
  /** True if this is a recommendation only (T0/T1 rules) - requires human approval */
  recommendationOnly: boolean
}

/**
 * Check if a risk tier requires human approval (T0 or T1).
 */
function isHighRiskTier(tier: string): boolean {
  return tier === "T0" || tier === "T1"
}

/**
 * Attempt deterministic resolution of a conflict between two rules.
 *
 * This function tries to resolve conflicts WITHOUT invoking the LLM by applying
 * well-defined hierarchies:
 *
 * 1. Authority hierarchy: LAW > GUIDANCE > PROCEDURE > PRACTICE
 * 2. Source hierarchy: Constitution(1) > Law(2) > Regulation(3) > ... > Practice(7)
 * 3. Temporal: Newer effective date wins (lex posterior)
 *
 * CRITICAL: T0/T1 rules are NEVER auto-resolved. If either rule is T0 or T1,
 * the resolution is marked as `recommendationOnly: true` and requires human approval.
 *
 * @param ruleA First rule in the conflict
 * @param ruleB Second rule in the conflict
 * @returns DeterministicResolution with resolution details and audit info
 */
export function tryDeterministicResolution(
  ruleA: RuleForResolution,
  ruleB: RuleForResolution
): DeterministicResolution {
  // Edge case: same rule ID
  if (ruleA.id === ruleB.id) {
    return {
      resolved: false,
      reason: "Cannot resolve conflict: same rule ID for both sides",
      recommendationOnly: false,
    }
  }

  // Determine if this requires human approval (T0/T1 protection)
  const requiresHumanApproval = isHighRiskTier(ruleA.riskTier) || isHighRiskTier(ruleB.riskTier)
  const tierContext = requiresHumanApproval
    ? `[${ruleA.riskTier}/${ruleB.riskTier} - recommendation only, requires human approval] `
    : ""

  // Step 1: Try authority hierarchy resolution
  const authorityScoreA = getAuthorityScore(ruleA.authorityLevel)
  const authorityScoreB = getAuthorityScore(ruleB.authorityLevel)

  if (authorityScoreA !== authorityScoreB) {
    const winner = authorityScoreA < authorityScoreB ? ruleA : ruleB
    const loser = authorityScoreA < authorityScoreB ? ruleB : ruleA

    return {
      resolved: true,
      winner: winner.id,
      loser: loser.id,
      reason: `${tierContext}Resolved by authority hierarchy: ${winner.authorityLevel} (score ${getAuthorityScore(winner.authorityLevel)}) prevails over ${loser.authorityLevel} (score ${getAuthorityScore(loser.authorityLevel)})`,
      recommendationOnly: requiresHumanApproval,
    }
  }

  // Step 2: Try source hierarchy resolution (when authority is equal)
  // Lower hierarchy number = higher authority (1=Constitution, 7=Practice)
  const sourceA = ruleA.sourceHierarchy ?? 999
  const sourceB = ruleB.sourceHierarchy ?? 999

  if (sourceA !== sourceB && sourceA !== 999 && sourceB !== 999) {
    const winner = sourceA < sourceB ? ruleA : ruleB
    const loser = sourceA < sourceB ? ruleB : ruleA
    const winnerSource = winner.sourceHierarchy ?? 999
    const loserSource = loser.sourceHierarchy ?? 999

    return {
      resolved: true,
      winner: winner.id,
      loser: loser.id,
      reason: `${tierContext}Resolved by source hierarchy: source level ${winnerSource} prevails over source level ${loserSource}`,
      recommendationOnly: requiresHumanApproval,
    }
  }

  // Step 3: Try temporal resolution (lex posterior - newer wins)
  const effectiveA = ruleA.effectiveFrom.getTime()
  const effectiveB = ruleB.effectiveFrom.getTime()

  if (effectiveA !== effectiveB) {
    const winner = effectiveA > effectiveB ? ruleA : ruleB
    const loser = effectiveA > effectiveB ? ruleB : ruleA

    return {
      resolved: true,
      winner: winner.id,
      loser: loser.id,
      reason: `${tierContext}Resolved by temporal precedence (lex posterior): ${winner.effectiveFrom.toISOString().split("T")[0]} is newer than ${loser.effectiveFrom.toISOString().split("T")[0]}`,
      recommendationOnly: requiresHumanApproval,
    }
  }

  // Step 4: Unable to resolve deterministically
  return {
    resolved: false,
    reason: `${tierContext}Deterministic resolution unresolved: equal authority (${ruleA.authorityLevel}), equal/missing source hierarchy, and same effective date (${ruleA.effectiveFrom.toISOString().split("T")[0]}). Requires LLM arbitration or human review.`,
    recommendationOnly: requiresHumanApproval,
  }
}
