// src/lib/regulatory-truth/utils/evidence-strength.ts
// Computes evidence strength for regulatory rules based on source diversity

import { db, dbReg } from "@/lib/db"
import type { AuthorityLevel } from "@prisma/client"

// Type for evidence with source (fetched separately via dbReg)
type EvidenceWithSource = {
  id: string
  sourceId: string | null
  source: {
    id: string
    name: string
  } | null
}

export type EvidenceStrength = "MULTI_SOURCE" | "SINGLE_SOURCE"

export interface EvidenceStrengthResult {
  strength: EvidenceStrength
  distinctSourceCount: number
  distinctEvidenceCount: number
  pointerCount: number
  canPublish: boolean
  blockReason?: string
}

// Authority levels that allow SINGLE_SOURCE rules to be published
const SINGLE_SOURCE_ALLOWED_TIERS: AuthorityLevel[] = ["LAW"]

/**
 * Compute evidence strength for a rule based on source diversity
 *
 * MULTI_SOURCE: 2+ distinct RegulatorySource records contribute evidence
 * SINGLE_SOURCE: Only 1 source contributes evidence
 */
export async function computeEvidenceStrength(ruleId: string): Promise<EvidenceStrengthResult> {
  const rule = await db.regulatoryRule.findUnique({
    where: { id: ruleId },
  })

  if (!rule) {
    return {
      strength: "SINGLE_SOURCE",
      distinctSourceCount: 0,
      distinctEvidenceCount: 0,
      pointerCount: 0,
      canPublish: false,
      blockReason: "Rule not found",
    }
  }

  // Query source pointers separately (many-to-many relation, no evidence include)
  const sourcePointers = await db.sourcePointer.findMany({
    where: { rules: { some: { id: ruleId } } },
  })

  // Fetch evidence records separately via dbReg (soft reference via evidenceId)
  const evidenceIds = sourcePointers.map((sp) => sp.evidenceId)
  const evidenceRecords = await dbReg.evidence.findMany({
    where: { id: { in: evidenceIds } },
    include: { source: true },
  })
  const evidenceMap = new Map<string, EvidenceWithSource>(evidenceRecords.map((e) => [e.id, e]))

  return computeEvidenceStrengthFromPointers(sourcePointers, rule.authorityLevel, evidenceMap)
}

/**
 * Compute evidence strength from loaded source pointers
 * Use this when you already have the pointers loaded to avoid extra DB query
 *
 * @param sourcePointers - Array of source pointers with evidenceId
 * @param authorityLevel - Authority level of the rule
 * @param evidenceMap - Map of evidenceId -> evidence record (fetched separately via dbReg)
 */
export function computeEvidenceStrengthFromPointers(
  sourcePointers: Array<{
    id: string
    evidenceId: string
  }>,
  authorityLevel: AuthorityLevel,
  evidenceMap: Map<string, EvidenceWithSource>
): EvidenceStrengthResult {
  const pointerCount = sourcePointers.length

  // Count distinct evidence and source IDs
  const evidenceIds = new Set<string>()
  const sourceIds = new Set<string>()

  for (const pointer of sourcePointers) {
    const evidence = evidenceMap.get(pointer.evidenceId)
    if (evidence?.id) {
      evidenceIds.add(evidence.id)
    }
    if (evidence?.source?.id) {
      sourceIds.add(evidence.source.id)
    }
  }

  const distinctEvidenceCount = evidenceIds.size
  const distinctSourceCount = sourceIds.size

  // Determine strength based on distinct sources
  const strength: EvidenceStrength = distinctSourceCount >= 2 ? "MULTI_SOURCE" : "SINGLE_SOURCE"

  // Determine if rule can be published
  let canPublish = true
  let blockReason: string | undefined

  if (strength === "SINGLE_SOURCE") {
    // SINGLE_SOURCE rules can only publish if authority is LAW
    if (!SINGLE_SOURCE_ALLOWED_TIERS.includes(authorityLevel)) {
      canPublish = false
      blockReason = `SINGLE_SOURCE rule with ${authorityLevel} authority requires corroboration from second source`
    }
  }

  // Additional check: must have at least one pointer
  if (pointerCount === 0) {
    canPublish = false
    blockReason = "Rule has no source pointers"
  }

  return {
    strength,
    distinctSourceCount,
    distinctEvidenceCount,
    pointerCount,
    canPublish,
    blockReason,
  }
}

/**
 * Check if a batch of rules can all be published based on evidence strength
 * Returns list of rules that are blocked with reasons
 */
export async function checkBatchEvidenceStrength(ruleIds: string[]): Promise<{
  canPublishAll: boolean
  blockedRules: Array<{
    ruleId: string
    conceptSlug: string
    strength: EvidenceStrength
    reason: string
  }>
  passedRules: string[]
}> {
  const rules = await db.regulatoryRule.findMany({
    where: { id: { in: ruleIds } },
  })

  // Query all source pointers for all rules in one query (no evidence include)
  const allSourcePointers = await db.sourcePointer.findMany({
    where: { rules: { some: { id: { in: ruleIds } } } },
    include: {
      rules: { select: { id: true } },
    },
  })

  // Fetch evidence records separately via dbReg (soft reference via evidenceId)
  const evidenceIds = allSourcePointers.map((sp) => sp.evidenceId)
  const evidenceRecords = await dbReg.evidence.findMany({
    where: { id: { in: evidenceIds } },
    include: { source: true },
  })
  const evidenceMap = new Map<string, EvidenceWithSource>(evidenceRecords.map((e) => [e.id, e]))

  // Group pointers by rule ID
  const pointersByRuleId = new Map<string, typeof allSourcePointers>()
  for (const pointer of allSourcePointers) {
    for (const ruleRef of pointer.rules) {
      if (!pointersByRuleId.has(ruleRef.id)) {
        pointersByRuleId.set(ruleRef.id, [])
      }
      pointersByRuleId.get(ruleRef.id)!.push(pointer)
    }
  }

  const blockedRules: Array<{
    ruleId: string
    conceptSlug: string
    strength: EvidenceStrength
    reason: string
  }> = []
  const passedRules: string[] = []

  for (const rule of rules) {
    const rulePointers = pointersByRuleId.get(rule.id) || []
    const result = computeEvidenceStrengthFromPointers(
      rulePointers,
      rule.authorityLevel,
      evidenceMap
    )

    if (result.canPublish) {
      passedRules.push(rule.id)
    } else {
      blockedRules.push({
        ruleId: rule.id,
        conceptSlug: rule.conceptSlug,
        strength: result.strength,
        reason: result.blockReason || "Unknown reason",
      })
    }
  }

  return {
    canPublishAll: blockedRules.length === 0,
    blockedRules,
    passedRules,
  }
}

/**
 * Get evidence strength metrics for all rules (for health dashboard)
 */
export async function getEvidenceStrengthMetrics(): Promise<{
  totalRules: number
  multiSourceRules: number
  singleSourceRules: number
  singleSourceCanPublish: number
  singleSourceBlocked: number
}> {
  // Get all non-rejected rules
  const rules = await db.regulatoryRule.findMany({
    where: { status: { not: "REJECTED" } },
  })

  if (rules.length === 0) {
    return {
      totalRules: 0,
      multiSourceRules: 0,
      singleSourceRules: 0,
      singleSourceCanPublish: 0,
      singleSourceBlocked: 0,
    }
  }

  const ruleIds = rules.map((r) => r.id)

  // Query all source pointers for all rules in one query (no evidence include)
  const allSourcePointers = await db.sourcePointer.findMany({
    where: { rules: { some: { id: { in: ruleIds } } } },
    include: {
      rules: { select: { id: true } },
    },
  })

  // Fetch evidence records separately via dbReg (soft reference via evidenceId)
  const evidenceIds = allSourcePointers.map((sp) => sp.evidenceId)
  const evidenceRecords = await dbReg.evidence.findMany({
    where: { id: { in: evidenceIds } },
    include: { source: true },
  })
  const evidenceMap = new Map<string, EvidenceWithSource>(evidenceRecords.map((e) => [e.id, e]))

  // Group pointers by rule ID
  const pointersByRuleId = new Map<string, typeof allSourcePointers>()
  for (const pointer of allSourcePointers) {
    for (const ruleRef of pointer.rules) {
      if (!pointersByRuleId.has(ruleRef.id)) {
        pointersByRuleId.set(ruleRef.id, [])
      }
      pointersByRuleId.get(ruleRef.id)!.push(pointer)
    }
  }

  let multiSourceRules = 0
  let singleSourceCanPublish = 0
  let singleSourceBlocked = 0

  for (const rule of rules) {
    const rulePointers = pointersByRuleId.get(rule.id) || []
    const result = computeEvidenceStrengthFromPointers(
      rulePointers,
      rule.authorityLevel,
      evidenceMap
    )

    if (result.strength === "MULTI_SOURCE") {
      multiSourceRules++
    } else {
      if (result.canPublish) {
        singleSourceCanPublish++
      } else {
        singleSourceBlocked++
      }
    }
  }

  return {
    totalRules: rules.length,
    multiSourceRules,
    singleSourceRules: singleSourceCanPublish + singleSourceBlocked,
    singleSourceCanPublish,
    singleSourceBlocked,
  }
}
