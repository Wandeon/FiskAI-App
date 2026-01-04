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
 * Compare source hierarchy when authority levels are equal.
 * Returns the rule that should prevail based on source hierarchy, or null if they're equal.
 *
 * Source hierarchy (lower = higher authority):
 * 1 = Ustav (Constitution)
 * 2 = Zakon (Law)
 * 3 = Podzakonski akt (Regulation)
 * 4 = Pravilnik (Ordinance)
 * 5 = Uputa (Instruction)
 * 6 = Mišljenje (Opinion)
 * 7 = Praksa (Practice)
 */
async function compareSourceHierarchy(
  ruleA: {
    id: string
    sourcePointers: Array<{
      evidenceId: string
    }>
  },
  ruleB: {
    id: string
    sourcePointers: Array<{
      evidenceId: string
    }>
  },
  evidenceMap: Map<string, EvidenceWithSource>
): Promise<{
  winningRuleId: string | null
  sourceAHierarchy: number | null
  sourceBHierarchy: number | null
  sourceAName: string | null
  sourceBName: string | null
  reason: string
}> {
  // Get the highest authority source for each rule (lowest hierarchy number)
  const sourceA = ruleA.sourcePointers.reduce(
    (highest, sp) => {
      const evidence = evidenceMap.get(sp.evidenceId)
      if (!evidence?.source) return highest
      if (!highest || evidence.source.hierarchy < highest.hierarchy) {
        return { hierarchy: evidence.source.hierarchy, name: evidence.source.name }
      }
      return highest
    },
    null as { hierarchy: number; name: string } | null
  )

  const sourceB = ruleB.sourcePointers.reduce(
    (highest, sp) => {
      const evidence = evidenceMap.get(sp.evidenceId)
      if (!evidence?.source) return highest
      if (!highest || evidence.source.hierarchy < highest.hierarchy) {
        return { hierarchy: evidence.source.hierarchy, name: evidence.source.name }
      }
      return highest
    },
    null as { hierarchy: number; name: string } | null
  )

  if (!sourceA || !sourceB) {
    return {
      winningRuleId: null,
      sourceAHierarchy: sourceA?.hierarchy ?? null,
      sourceBHierarchy: sourceB?.hierarchy ?? null,
      sourceAName: sourceA?.name ?? null,
      sourceBName: sourceB?.name ?? null,
      reason: "One or both rules lack source evidence",
    }
  }

  if (sourceA.hierarchy < sourceB.hierarchy) {
    return {
      winningRuleId: ruleA.id,
      sourceAHierarchy: sourceA.hierarchy,
      sourceBHierarchy: sourceB.hierarchy,
      sourceAName: sourceA.name,
      sourceBName: sourceB.name,
      reason: `Source hierarchy: ${sourceA.name} (hierarchy ${sourceA.hierarchy}) prevails over ${sourceB.name} (hierarchy ${sourceB.hierarchy})`,
    }
  } else if (sourceB.hierarchy < sourceA.hierarchy) {
    return {
      winningRuleId: ruleB.id,
      sourceAHierarchy: sourceA.hierarchy,
      sourceBHierarchy: sourceB.hierarchy,
      sourceAName: sourceA.name,
      sourceBName: sourceB.name,
      reason: `Source hierarchy: ${sourceB.name} (hierarchy ${sourceB.hierarchy}) prevails over ${sourceA.name} (hierarchy ${sourceA.hierarchy})`,
    }
  }

  return {
    winningRuleId: null,
    sourceAHierarchy: sourceA.hierarchy,
    sourceBHierarchy: sourceB.hierarchy,
    sourceAName: sourceA.name,
    sourceBName: sourceB.name,
    reason: `Equal source hierarchy: both from ${sourceA.name} (hierarchy ${sourceA.hierarchy})`,
  }
}

/**
 * Apply lex posterior (newer law wins) as tiebreaker.
 */
function applyLexPosterior(
  ruleA: {
    id: string
    effectiveFrom: Date
    titleHr: string
  },
  ruleB: {
    id: string
    effectiveFrom: Date
    titleHr: string
  }
): {
  winningRuleId: string
  reason: string
} {
  if (ruleA.effectiveFrom.getTime() > ruleB.effectiveFrom.getTime()) {
    return {
      winningRuleId: ruleA.id,
      reason: `Lex posterior: "${ruleA.titleHr}" effective from ${ruleA.effectiveFrom.toISOString().split("T")[0]} is newer than "${ruleB.titleHr}" from ${ruleB.effectiveFrom.toISOString().split("T")[0]}`,
    }
  } else if (ruleB.effectiveFrom.getTime() > ruleA.effectiveFrom.getTime()) {
    return {
      winningRuleId: ruleB.id,
      reason: `Lex posterior: "${ruleB.titleHr}" effective from ${ruleB.effectiveFrom.toISOString().split("T")[0]} is newer than "${ruleA.titleHr}" from ${ruleA.effectiveFrom.toISOString().split("T")[0]}`,
    }
  } else {
    // Same effective date - fall back to alphabetical by ID for determinism
    return {
      winningRuleId: ruleA.id < ruleB.id ? ruleA.id : ruleB.id,
      reason: `Same effective date (${ruleA.effectiveFrom.toISOString().split("T")[0]}), using deterministic ID ordering as final tiebreaker`,
    }
  }
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
