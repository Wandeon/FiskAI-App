// src/lib/regulatory-truth/agents/arbiter.ts

import { db } from "@/lib/db"
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

/**
 * Build conflicting item description with full context
 */
function buildConflictingItemClaim(rule: {
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
    exactQuote: string
    extractedValue: string
    confidence: number
    evidence: {
      url: string
      source: {
        name: string
        hierarchy: number
      }
    }
  }>
}): string {
  const sources = rule.sourcePointers
    .map(
      (sp) => `"${sp.exactQuote}" (from ${sp.evidence.source.name}, confidence: ${sp.confidence})`
    )
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
    include: {
      evidence: {
        include: { source: true },
      },
    },
  })

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
        pointerSummary: sourcePointers.map((sp) => ({
          id: sp.id,
          domain: sp.domain,
          value: sp.extractedValue,
          source: sp.evidence?.source?.name,
          confidence: sp.confidence,
        })),
      },
    },
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
  // Get conflict from database with both rules and their evidence
  const conflict = await db.regulatoryConflict.findUnique({
    where: { id: conflictId },
    include: {
      itemA: {
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
      },
      itemB: {
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
      },
    },
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

  // Handle SOURCE_CONFLICT type - these have null itemA/itemB and use metadata.sourcePointerIds
  if (conflict.conflictType === "SOURCE_CONFLICT") {
    return handleSourceConflict(conflict)
  }

  if (!conflict.itemA || !conflict.itemB) {
    return {
      success: false,
      output: null,
      resolution: null,
      updatedConflictId: null,
      error: `One or both conflicting rules not found for conflict: ${conflictId}`,
    }
  }

  // Build conflicting items for the agent
  const conflictingItems: ConflictingItem[] = [
    {
      item_id: conflict.itemA.id,
      item_type: "rule",
      claim: buildConflictingItemClaim(conflict.itemA),
    },
    {
      item_id: conflict.itemB.id,
      item_type: "rule",
      claim: buildConflictingItemClaim(conflict.itemB),
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
  } else if (arbitration.resolution.winning_item_id === conflict.itemA.id) {
    resolution = "RULE_A_PREVAILS"
  } else if (arbitration.resolution.winning_item_id === conflict.itemB.id) {
    resolution = "RULE_B_PREVAILS"
  } else {
    // If agent suggests something else or unclear, escalate
    resolution = "ESCALATE_TO_HUMAN"
  }

  // Additional escalation logic based on business rules
  const shouldEscalate = checkEscalationCriteria(conflict.itemA, conflict.itemB, arbitration)
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
      where: { id: conflict.itemB.id },
      data: {
        status: "DEPRECATED",
        reviewerNotes: JSON.stringify({
          deprecated_reason: "Conflict resolution - Rule A prevails",
          conflict_id: conflict.id,
          superseded_by: conflict.itemA.id,
          arbiter_rationale: arbitration.resolution.rationale_hr,
        }),
      },
    })
  } else if (resolution === "RULE_B_PREVAILS") {
    await db.regulatoryRule.update({
      where: { id: conflict.itemA.id },
      data: {
        status: "DEPRECATED",
        reviewerNotes: JSON.stringify({
          deprecated_reason: "Conflict resolution - Rule B prevails",
          conflict_id: conflict.id,
          superseded_by: conflict.itemB.id,
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
 * Get all open conflicts that need arbitration
 */
export async function getPendingConflicts(): Promise<
  Array<{
    id: string
    conflictType: string
    description: string
    createdAt: Date
    itemA: { id: string; titleHr: string; riskTier: string } | null
    itemB: { id: string; titleHr: string; riskTier: string } | null
  }>
> {
  const conflicts = await db.regulatoryConflict.findMany({
    where: {
      status: "OPEN",
    },
    include: {
      itemA: {
        select: {
          id: true,
          titleHr: true,
          riskTier: true,
        },
      },
      itemB: {
        select: {
          id: true,
          titleHr: true,
          riskTier: true,
        },
      },
    },
    orderBy: [
      { createdAt: "asc" }, // Oldest first
    ],
  })

  return conflicts
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
    try {
      console.log(`[arbiter] Processing conflict: ${conflict.id}`)
      const result = await runArbiter(conflict.id)

      results.processed++

      if (!result.success) {
        results.failed++
        results.errors.push(`${conflict.id}: ${result.error}`)
      } else if (result.resolution === "ESCALATE_TO_HUMAN") {
        results.escalated++
      } else {
        results.resolved++
      }
    } catch (error) {
      results.failed++
      results.errors.push(
        `${conflict.id}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  console.log(
    `[arbiter] Batch complete: ${results.processed} processed, ${results.resolved} resolved, ${results.escalated} escalated, ${results.failed} failed`
  )

  return results
}
