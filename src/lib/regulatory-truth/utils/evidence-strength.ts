// src/lib/regulatory-truth/utils/evidence-strength.ts
// Computes evidence strength for regulatory rules based on source diversity

import { db } from "@/lib/db"
import type { AuthorityLevel } from "@prisma/client"

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
      strength: "SINGLE_SOURCE",
      distinctSourceCount: 0,
      distinctEvidenceCount: 0,
      pointerCount: 0,
      canPublish: false,
      blockReason: "Rule not found",
    }
  }

  return computeEvidenceStrengthFromPointers(rule.sourcePointers, rule.authorityLevel)
}

/**
 * Compute evidence strength from loaded source pointers
 * Use this when you already have the pointers loaded to avoid extra DB query
 */
export function computeEvidenceStrengthFromPointers(
  sourcePointers: Array<{
    id: string
    evidence?: {
      id: string
      source?: {
        id: string
        name?: string
      } | null
    } | null
  }>,
  authorityLevel: AuthorityLevel
): EvidenceStrengthResult {
  const pointerCount = sourcePointers.length

  // Count distinct evidence and source IDs
  const evidenceIds = new Set<string>()
  const sourceIds = new Set<string>()

  for (const pointer of sourcePointers) {
    if (pointer.evidence?.id) {
      evidenceIds.add(pointer.evidence.id)
    }
    if (pointer.evidence?.source?.id) {
      sourceIds.add(pointer.evidence.source.id)
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

  const blockedRules: Array<{
    ruleId: string
    conceptSlug: string
    strength: EvidenceStrength
    reason: string
  }> = []
  const passedRules: string[] = []

  for (const rule of rules) {
    const result = computeEvidenceStrengthFromPointers(rule.sourcePointers, rule.authorityLevel)

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
  // Get all non-rejected rules with their pointers
  const rules = await db.regulatoryRule.findMany({
    where: { status: { not: "REJECTED" } },
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

  let multiSourceRules = 0
  let singleSourceCanPublish = 0
  let singleSourceBlocked = 0

  for (const rule of rules) {
    const result = computeEvidenceStrengthFromPointers(rule.sourcePointers, rule.authorityLevel)

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
