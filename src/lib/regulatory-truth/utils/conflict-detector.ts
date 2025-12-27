// src/lib/regulatory-truth/utils/conflict-detector.ts

import { db } from "@/lib/db"
import { CANONICAL_ALIASES, normalizeSlug } from "./concept-resolver"

export interface ConflictSeed {
  type: "VALUE_MISMATCH" | "DATE_OVERLAP" | "AUTHORITY_SUPERSEDE" | "CROSS_SLUG_DUPLICATE"
  existingRuleId: string
  newRuleId: string
  reason: string
}

/**
 * Check for structural conflicts when a new rule is created.
 * These are deterministic checks, not AI-based.
 */
export async function detectStructuralConflicts(newRule: {
  id: string
  conceptSlug: string
  value: string
  effectiveFrom: Date | null
  effectiveUntil: Date | null
  authorityLevel: string
  articleNumber?: string | null
}): Promise<ConflictSeed[]> {
  const conflicts: ConflictSeed[] = []

  // Find existing rules for same concept
  const existingRules = await db.regulatoryRule.findMany({
    where: {
      conceptSlug: newRule.conceptSlug,
      status: { in: ["PUBLISHED", "APPROVED", "PENDING_REVIEW"] },
      id: { not: newRule.id },
    },
    include: {
      sourcePointers: {
        select: {
          articleNumber: true,
        },
        take: 1,
      },
    },
  })

  for (const existing of existingRules) {
    // Check 1: Same concept, different value, overlapping dates
    if (existing.value !== newRule.value) {
      const datesOverlap = checkDateOverlap(
        existing.effectiveFrom,
        existing.effectiveUntil,
        newRule.effectiveFrom,
        newRule.effectiveUntil
      )

      if (datesOverlap) {
        conflicts.push({
          type: "VALUE_MISMATCH",
          existingRuleId: existing.id,
          newRuleId: newRule.id,
          reason: `Same concept "${newRule.conceptSlug}" with different values: "${existing.value}" vs "${newRule.value}" during overlapping period`,
        })
      }
    }

    // Check 2: Higher authority supersedes
    // Lower authority level number = higher authority (LAW=1, GUIDANCE=2, etc.)
    const existingAuthorityRank = getAuthorityRank(existing.authorityLevel)
    const newAuthorityRank = getAuthorityRank(newRule.authorityLevel)

    if (newAuthorityRank < existingAuthorityRank) {
      conflicts.push({
        type: "AUTHORITY_SUPERSEDE",
        existingRuleId: existing.id,
        newRuleId: newRule.id,
        reason: `New rule from higher authority (${newRule.authorityLevel}) may supersede existing (${existing.authorityLevel})`,
      })
    }
  }

  // Check 3: Same article reference, different value
  if (newRule.articleNumber) {
    const sameArticle = await db.regulatoryRule.findMany({
      where: {
        id: { not: newRule.id },
        status: { in: ["PUBLISHED", "APPROVED"] },
        sourcePointers: {
          some: { articleNumber: newRule.articleNumber },
        },
      },
    })

    for (const existing of sameArticle) {
      if (existing.value !== newRule.value) {
        conflicts.push({
          type: "VALUE_MISMATCH",
          existingRuleId: existing.id,
          newRuleId: newRule.id,
          reason: `Same article "${newRule.articleNumber}" with different values`,
        })
      }
    }
  }

  // Check 4: Cross-slug duplicates - same value+valueType but different concept slugs
  // This catches LLM variations like "vat-standard-rate" vs "pdv-standardna-stopa"
  const crossSlugDuplicates = await detectCrossSlugDuplicates(newRule)
  conflicts.push(...crossSlugDuplicates)

  return conflicts
}

/**
 * Detect potential duplicates across different concept slugs.
 * Catches LLM naming variations that refer to the same regulatory fact.
 */
async function detectCrossSlugDuplicates(newRule: {
  id: string
  conceptSlug: string
  value: string
  effectiveFrom: Date | null
}): Promise<ConflictSeed[]> {
  const conflicts: ConflictSeed[] = []

  // Find all alias slugs that might match this concept
  const aliasSlugSet = getRelatedSlugs(newRule.conceptSlug)

  if (aliasSlugSet.size === 0) {
    // No known aliases, check for exact value+valueType matches across ALL slugs
    const sameValue = await db.regulatoryRule.findMany({
      where: {
        id: { not: newRule.id },
        value: newRule.value,
        conceptSlug: { not: newRule.conceptSlug },
        status: { in: ["PUBLISHED", "APPROVED", "PENDING_REVIEW", "DRAFT"] },
      },
      select: {
        id: true,
        conceptSlug: true,
        effectiveFrom: true,
        effectiveUntil: true,
      },
    })

    for (const existing of sameValue) {
      // Check if dates overlap
      const datesOverlap = checkDateOverlap(
        existing.effectiveFrom,
        existing.effectiveUntil,
        newRule.effectiveFrom,
        null
      )

      if (datesOverlap) {
        conflicts.push({
          type: "CROSS_SLUG_DUPLICATE",
          existingRuleId: existing.id,
          newRuleId: newRule.id,
          reason: `Potential duplicate: same value "${newRule.value}" with different slugs: "${existing.conceptSlug}" vs "${newRule.conceptSlug}"`,
        })
      }
    }
  } else {
    // Check against known alias slugs
    const aliasArray = Array.from(aliasSlugSet)

    const relatedRules = await db.regulatoryRule.findMany({
      where: {
        id: { not: newRule.id },
        conceptSlug: { in: aliasArray },
        value: newRule.value,
        status: { in: ["PUBLISHED", "APPROVED", "PENDING_REVIEW", "DRAFT"] },
      },
      select: {
        id: true,
        conceptSlug: true,
        effectiveFrom: true,
        effectiveUntil: true,
      },
    })

    for (const existing of relatedRules) {
      const datesOverlap = checkDateOverlap(
        existing.effectiveFrom,
        existing.effectiveUntil,
        newRule.effectiveFrom,
        null
      )

      if (datesOverlap) {
        conflicts.push({
          type: "CROSS_SLUG_DUPLICATE",
          existingRuleId: existing.id,
          newRuleId: newRule.id,
          reason: `Known alias duplicate: "${existing.conceptSlug}" is alias of "${newRule.conceptSlug}" with same value "${newRule.value}"`,
        })
      }
    }
  }

  return conflicts
}

/**
 * Get all related slugs (canonical + aliases) for a given concept slug
 */
function getRelatedSlugs(slug: string): Set<string> {
  const related = new Set<string>()
  const normalized = normalizeSlug(slug)

  // Check if this slug is a canonical or known alias
  for (const [canonical, aliases] of Object.entries(CANONICAL_ALIASES)) {
    const canonicalNorm = normalizeSlug(canonical)

    // If slug matches canonical
    if (slug === canonical || normalized === canonicalNorm) {
      related.add(canonical)
      aliases.forEach((a) => related.add(a))
    }

    // If slug matches any alias
    for (const alias of aliases) {
      if (slug === alias || normalized === normalizeSlug(alias)) {
        related.add(canonical)
        aliases.forEach((a) => related.add(a))
        break
      }
    }
  }

  // Remove self
  related.delete(slug)

  return related
}

/**
 * Check if two date ranges overlap
 */
function checkDateOverlap(
  start1: Date | null,
  end1: Date | null,
  start2: Date | null,
  end2: Date | null
): boolean {
  const s1 = start1?.getTime() || 0
  const e1 = end1?.getTime() || Infinity
  const s2 = start2?.getTime() || 0
  const e2 = end2?.getTime() || Infinity

  return s1 <= e2 && s2 <= e1
}

/**
 * Convert authority level to numeric rank for comparison
 * Lower number = higher authority
 */
function getAuthorityRank(level: string): number {
  // Must match AuthorityLevel enum in prisma/schema.prisma
  const ranks: Record<string, number> = {
    LAW: 1, // Legally binding (Narodne novine)
    GUIDANCE: 2, // Interpretation (Porezna uprava)
    PROCEDURE: 3, // Technical execution (FINA, HZMO, HZZO)
    PRACTICE: 4, // What passes inspections
  }
  return ranks[level] || 999
}

/**
 * Create conflict records for detected structural conflicts.
 */
export async function seedConflicts(conflicts: ConflictSeed[]): Promise<number> {
  let created = 0

  for (const conflict of conflicts) {
    // Check if conflict already exists
    const existing = await db.regulatoryConflict.findFirst({
      where: {
        OR: [
          { itemAId: conflict.existingRuleId, itemBId: conflict.newRuleId },
          { itemAId: conflict.newRuleId, itemBId: conflict.existingRuleId },
        ],
        status: "OPEN",
      },
    })

    if (!existing) {
      // Map internal conflict types to database enum
      const conflictType = mapConflictType(conflict.type)

      await db.regulatoryConflict.create({
        data: {
          conflictType,
          itemAId: conflict.existingRuleId,
          itemBId: conflict.newRuleId,
          description: conflict.reason,
          status: "OPEN",
          metadata: {
            detectionMethod: "STRUCTURAL",
            conflictSubtype: conflict.type,
            detectedAt: new Date().toISOString(),
          },
        },
      })
      created++
      console.log(`[conflict] Created ${conflict.type}: ${conflict.reason}`)
    }
  }

  return created
}

/**
 * Map internal conflict type to database ConflictType enum
 */
function mapConflictType(
  internalType: ConflictSeed["type"]
): "SOURCE_CONFLICT" | "SCOPE_CONFLICT" | "TEMPORAL_CONFLICT" {
  // Must match ConflictType enum in prisma/schema.prisma
  switch (internalType) {
    case "AUTHORITY_SUPERSEDE":
      return "TEMPORAL_CONFLICT"
    case "DATE_OVERLAP":
      return "TEMPORAL_CONFLICT"
    case "VALUE_MISMATCH":
      return "SOURCE_CONFLICT"
    case "CROSS_SLUG_DUPLICATE":
      return "SCOPE_CONFLICT" // Cross-slug duplicates are scope conflicts
    default:
      return "SOURCE_CONFLICT"
  }
}
