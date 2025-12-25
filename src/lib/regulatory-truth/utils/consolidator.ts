// src/lib/regulatory-truth/utils/consolidator.ts
// Consolidates duplicate rules and cleans up production data

import { db } from "@/lib/db"
import { logAuditEvent } from "./audit-log"
import { CANONICAL_ALIASES, normalizeSlug, isBlockedDomain } from "./concept-resolver"

// =============================================================================
// TYPES
// =============================================================================

export interface ConsolidationResult {
  success: boolean
  mergedRules: number
  quarantinedRules: number
  mergedConcepts: number
  pointersReassigned: number
  errors: string[]
  auditLog: Array<{
    action: string
    beforeId: string
    afterId: string
    reason: string
  }>
}

interface DuplicateGroup {
  canonicalSlug: string
  value: string
  valueType: string
  rules: Array<{
    id: string
    conceptSlug: string
    status: string
    createdAt: Date
    sourcePointerCount: number
  }>
}

// =============================================================================
// DUPLICATE DETECTION
// =============================================================================

/**
 * Find groups of duplicate rules that have the same value and valueType
 * AND are semantically related (in same alias family or have slug token overlap).
 *
 * SAFETY: We never merge unrelated concepts just because they share a value.
 * Example: "25%" could appear in VAT rate, withholding tax, or discount - these should not merge.
 */
export async function findDuplicateRuleGroups(): Promise<DuplicateGroup[]> {
  // Get all active rules (not REJECTED or DEPRECATED) with their pointer counts
  const rules = await db.regulatoryRule.findMany({
    where: {
      status: { notIn: ["REJECTED", "DEPRECATED"] },
    },
    select: {
      id: true,
      conceptSlug: true,
      value: true,
      valueType: true,
      status: true,
      createdAt: true,
      _count: {
        select: { sourcePointers: true },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  // First pass: group by (value, valueType)
  const rawGroups = new Map<string, typeof rules>()

  for (const rule of rules) {
    const key = `${rule.value}|${rule.valueType}`
    if (!rawGroups.has(key)) {
      rawGroups.set(key, [])
    }
    rawGroups.get(key)!.push(rule)
  }

  // Second pass: within each value group, cluster by semantic similarity
  const safeGroups: DuplicateGroup[] = []

  for (const [, rulesWithSameValue] of rawGroups) {
    if (rulesWithSameValue.length < 2) continue

    // Cluster rules that are semantically related
    const clusters = clusterBySimilarity(rulesWithSameValue)

    for (const cluster of clusters) {
      if (cluster.length < 2) continue

      const canonicalSlug = resolveToCanonical(cluster[0].conceptSlug)
      safeGroups.push({
        canonicalSlug,
        value: cluster[0].value,
        valueType: cluster[0].valueType,
        rules: cluster.map((r) => ({
          id: r.id,
          conceptSlug: r.conceptSlug,
          status: r.status,
          createdAt: r.createdAt,
          sourcePointerCount: r._count.sourcePointers,
        })),
      })
    }
  }

  return safeGroups
}

/**
 * Cluster rules by semantic similarity.
 * Rules are considered related if:
 * 1. They are in the same alias family, OR
 * 2. Their concept slugs have >= 50% token overlap
 */
function clusterBySimilarity<T extends { conceptSlug: string }>(rules: T[]): T[][] {
  const clusters: T[][] = []
  const assigned = new Set<number>()

  for (let i = 0; i < rules.length; i++) {
    if (assigned.has(i)) continue

    const cluster = [rules[i]]
    assigned.add(i)

    for (let j = i + 1; j < rules.length; j++) {
      if (assigned.has(j)) continue

      if (areSlugsRelated(rules[i].conceptSlug, rules[j].conceptSlug)) {
        cluster.push(rules[j])
        assigned.add(j)
      }
    }

    clusters.push(cluster)
  }

  return clusters
}

/**
 * Check if two slugs are semantically related.
 * Returns true if they are in the same alias family OR have significant token overlap.
 */
function areSlugsRelated(slug1: string, slug2: string): boolean {
  // Same slug
  if (slug1 === slug2) return true

  // Check if in same alias family
  const canonical1 = resolveToCanonical(slug1)
  const canonical2 = resolveToCanonical(slug2)
  if (canonical1 === canonical2) return true

  // Check token overlap (at least 50% of tokens must match)
  const tokens1 = extractTokens(slug1)
  const tokens2 = extractTokens(slug2)

  if (tokens1.size === 0 || tokens2.size === 0) return false

  const intersection = new Set([...tokens1].filter((t) => tokens2.has(t)))
  const minSize = Math.min(tokens1.size, tokens2.size)

  // Require at least 50% overlap AND at least 2 matching tokens
  return intersection.size >= Math.ceil(minSize * 0.5) && intersection.size >= 2
}

/**
 * Extract meaningful tokens from a slug.
 * Filters out common stop words and short tokens.
 */
function extractTokens(slug: string): Set<string> {
  const stopWords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "of",
    "for",
    "to",
    "in",
    "on",
    "at",
    "hr",
    "en",
    "date",
    "value",
    "rate",
    "type",
    "limit",
    "threshold",
    "rok",
    "datum",
    "vrijednost",
    "stopa",
    "prag",
    "granica",
  ])

  return new Set(
    normalizeSlug(slug)
      .split(/[-_]/)
      .filter((t) => t.length >= 3 && !stopWords.has(t))
  )
}

/**
 * Resolve a concept slug to its canonical form using the alias map
 */
function resolveToCanonical(slug: string): string {
  const normalized = normalizeSlug(slug)

  // Check each canonical slug's aliases
  for (const [canonical, aliases] of Object.entries(CANONICAL_ALIASES)) {
    if (canonical === slug || normalizeSlug(canonical) === normalized) {
      return canonical
    }
    for (const alias of aliases) {
      if (alias === slug || normalizeSlug(alias) === normalized) {
        return canonical
      }
    }
  }

  return slug // No alias found, use original
}

// =============================================================================
// RULE MERGING
// =============================================================================

/**
 * Merge duplicate rules into a single canonical rule.
 * Keeps the oldest rule with most source pointers as canonical.
 * Moves all pointers from duplicates to canonical rule.
 */
export async function mergeDuplicateRules(
  group: DuplicateGroup,
  dryRun = false
): Promise<{
  success: boolean
  canonicalId: string
  mergedIds: string[]
  pointersReassigned: number
  error?: string
}> {
  // Sort rules: prefer PUBLISHED > APPROVED > DRAFT, then by pointer count, then by age
  const sorted = [...group.rules].sort((a, b) => {
    // Status priority
    const statusOrder: Record<string, number> = {
      PUBLISHED: 0,
      APPROVED: 1,
      PENDING_REVIEW: 2,
      DRAFT: 3,
    }
    const statusDiff = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99)
    if (statusDiff !== 0) return statusDiff

    // More pointers = better
    const pointerDiff = b.sourcePointerCount - a.sourcePointerCount
    if (pointerDiff !== 0) return pointerDiff

    // Older = canonical
    return a.createdAt.getTime() - b.createdAt.getTime()
  })

  const canonical = sorted[0]
  const duplicates = sorted.slice(1)

  if (duplicates.length === 0) {
    return {
      success: true,
      canonicalId: canonical.id,
      mergedIds: [],
      pointersReassigned: 0,
    }
  }

  if (dryRun) {
    console.log(
      `[consolidator] Would merge ${duplicates.length} rules into ${canonical.id} (${group.canonicalSlug})`
    )
    return {
      success: true,
      canonicalId: canonical.id,
      mergedIds: duplicates.map((d) => d.id),
      pointersReassigned: duplicates.reduce((sum, d) => sum + d.sourcePointerCount, 0),
    }
  }

  try {
    let totalPointersReassigned = 0

    // Process each duplicate
    for (const dup of duplicates) {
      // Get pointers from duplicate
      const dupPointers = await db.sourcePointer.findMany({
        where: {
          rules: { some: { id: dup.id } },
        },
        select: { id: true },
      })

      // Disconnect pointers from duplicate, connect to canonical
      if (dupPointers.length > 0) {
        await db.regulatoryRule.update({
          where: { id: dup.id },
          data: {
            sourcePointers: {
              disconnect: dupPointers.map((p) => ({ id: p.id })),
            },
          },
        })

        // Check which pointers aren't already connected to canonical
        const canonicalPointers = await db.sourcePointer.findMany({
          where: {
            rules: { some: { id: canonical.id } },
          },
          select: { id: true },
        })
        const existingIds = new Set(canonicalPointers.map((p) => p.id))
        const newPointers = dupPointers.filter((p) => !existingIds.has(p.id))

        if (newPointers.length > 0) {
          await db.regulatoryRule.update({
            where: { id: canonical.id },
            data: {
              sourcePointers: {
                connect: newPointers.map((p) => ({ id: p.id })),
              },
            },
          })
          totalPointersReassigned += newPointers.length
        }
      }

      // Mark duplicate as rejected (consolidated)
      // Use unique slug to avoid constraint on (conceptSlug, effectiveFrom, status)
      const consolidatedSlug = `${dup.conceptSlug}-consolidated-${dup.id.slice(-8)}`
      await db.regulatoryRule.update({
        where: { id: dup.id },
        data: {
          status: "REJECTED",
          conceptSlug: consolidatedSlug,
          composerNotes: `[CONSOLIDATED] Merged into ${canonical.id} on ${new Date().toISOString()}. Original slug: ${dup.conceptSlug}`,
        },
      })

      // Log audit event
      await logAuditEvent({
        action: "RULE_MERGED",
        entityType: "RULE",
        entityId: dup.id,
        metadata: {
          mergedInto: canonical.id,
          canonicalSlug: group.canonicalSlug,
          originalSlug: dup.conceptSlug,
          pointersReassigned: dupPointers.length,
        },
      })
    }

    // Update canonical rule's concept slug if needed
    if (canonical.conceptSlug !== group.canonicalSlug) {
      await db.regulatoryRule.update({
        where: { id: canonical.id },
        data: { conceptSlug: group.canonicalSlug },
      })
    }

    console.log(
      `[consolidator] Merged ${duplicates.length} rules into ${canonical.id}, reassigned ${totalPointersReassigned} pointers`
    )

    return {
      success: true,
      canonicalId: canonical.id,
      mergedIds: duplicates.map((d) => d.id),
      pointersReassigned: totalPointersReassigned,
    }
  } catch (error) {
    return {
      success: false,
      canonicalId: canonical.id,
      mergedIds: [],
      pointersReassigned: 0,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// =============================================================================
// TEST DATA QUARANTINE
// =============================================================================

/**
 * Quarantine rules and pointers from test/heartbeat domains
 */
export async function quarantineTestData(dryRun = false): Promise<{
  rulesQuarantined: number
  pointersQuarantined: number
  errors: string[]
}> {
  const errors: string[] = []

  // Find rules linked to test domain pointers
  const testPointers = await db.sourcePointer.findMany({
    where: {
      OR: [
        { domain: { contains: "heartbeat" } },
        { domain: { contains: "test" } },
        { domain: { contains: "synthetic" } },
        { domain: { contains: "debug" } },
      ],
    },
    include: {
      rules: { select: { id: true, status: true } },
    },
  })

  if (dryRun) {
    const ruleIds = new Set(testPointers.flatMap((p) => p.rules.map((r) => r.id)))
    console.log(
      `[consolidator] Would quarantine ${testPointers.length} pointers and ${ruleIds.size} rules`
    )
    return {
      rulesQuarantined: ruleIds.size,
      pointersQuarantined: testPointers.length,
      errors: [],
    }
  }

  let rulesQuarantined = 0
  const processedRuleIds = new Set<string>()

  for (const pointer of testPointers) {
    try {
      // Soft-delete the pointer
      await db.sourcePointer.update({
        where: { id: pointer.id },
        data: { deletedAt: new Date() },
      })

      // Quarantine linked rules (if not already processed)
      for (const rule of pointer.rules) {
        if (processedRuleIds.has(rule.id)) continue
        processedRuleIds.add(rule.id)

        if (rule.status !== "REJECTED") {
          await db.regulatoryRule.update({
            where: { id: rule.id },
            data: {
              status: "REJECTED",
              composerNotes: `[TEST_DATA_REJECTED] Test data from domain: ${pointer.domain}`,
            },
          })
          rulesQuarantined++

          await logAuditEvent({
            action: "RULE_REJECTED_TEST_DATA",
            entityType: "RULE",
            entityId: rule.id,
            metadata: {
              reason: "Test data",
              domain: pointer.domain,
            },
          })
        }
      }
    } catch (error) {
      errors.push(
        `Pointer ${pointer.id}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  console.log(
    `[consolidator] Quarantined ${testPointers.length} pointers and ${rulesQuarantined} rules`
  )

  return {
    rulesQuarantined,
    pointersQuarantined: testPointers.length,
    errors,
  }
}

// =============================================================================
// CONCEPT CONSOLIDATION
// =============================================================================

/**
 * Merge duplicate concepts into canonical forms
 */
export async function consolidateConcepts(dryRun = false): Promise<{
  merged: number
  errors: string[]
}> {
  const errors: string[] = []
  let merged = 0

  for (const [canonical, aliases] of Object.entries(CANONICAL_ALIASES)) {
    // Find concepts matching any alias
    const aliasedConcepts = await db.concept.findMany({
      where: {
        slug: { in: aliases },
      },
    })

    if (aliasedConcepts.length === 0) continue

    // Find or create canonical concept
    let canonicalConcept = await db.concept.findFirst({
      where: { slug: canonical },
    })

    if (dryRun) {
      console.log(`[consolidator] Would merge ${aliasedConcepts.length} concepts into ${canonical}`)
      merged += aliasedConcepts.length
      continue
    }

    try {
      if (!canonicalConcept) {
        // Use first aliased concept as template
        const template = aliasedConcepts[0]
        canonicalConcept = await db.concept.create({
          data: {
            slug: canonical,
            nameHr: template.nameHr,
            nameEn: template.nameEn,
            aliases: aliases,
            tags: template.tags,
            description: template.description,
          },
        })
      } else {
        // Update aliases
        await db.concept.update({
          where: { id: canonicalConcept.id },
          data: { aliases: [...new Set([...(canonicalConcept.aliases || []), ...aliases])] },
        })
      }

      // Reassign rules from aliased concepts to canonical
      for (const aliased of aliasedConcepts) {
        await db.regulatoryRule.updateMany({
          where: { conceptId: aliased.id },
          data: { conceptId: canonicalConcept.id },
        })

        // Delete the aliased concept
        await db.concept.delete({ where: { id: aliased.id } })
        merged++

        await logAuditEvent({
          action: "CONCEPT_MERGED",
          entityType: "CONCEPT",
          entityId: aliased.id,
          metadata: {
            mergedInto: canonicalConcept.id,
            canonicalSlug: canonical,
            originalSlug: aliased.slug,
          },
        })
      }
    } catch (error) {
      errors.push(`Concept ${canonical}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return { merged, errors }
}

// =============================================================================
// MAIN CONSOLIDATION RUNNER
// =============================================================================

/**
 * Run full consolidation process
 */
export async function runConsolidation(dryRun = false): Promise<ConsolidationResult> {
  console.log(`[consolidator] Starting consolidation (dryRun: ${dryRun})`)

  const result: ConsolidationResult = {
    success: true,
    mergedRules: 0,
    quarantinedRules: 0,
    mergedConcepts: 0,
    pointersReassigned: 0,
    errors: [],
    auditLog: [],
  }

  // Step 1: Quarantine test data first
  console.log("[consolidator] Step 1: Quarantining test data...")
  const quarantine = await quarantineTestData(dryRun)
  result.quarantinedRules += quarantine.rulesQuarantined
  result.errors.push(...quarantine.errors)

  // Step 2: Find and merge duplicate rules
  console.log("[consolidator] Step 2: Finding duplicate rules...")
  const duplicateGroups = await findDuplicateRuleGroups()
  console.log(`[consolidator] Found ${duplicateGroups.length} duplicate groups`)

  for (const group of duplicateGroups) {
    const mergeResult = await mergeDuplicateRules(group, dryRun)
    if (mergeResult.success) {
      result.mergedRules += mergeResult.mergedIds.length
      result.pointersReassigned += mergeResult.pointersReassigned
      result.auditLog.push({
        action: "MERGE_RULES",
        beforeId: mergeResult.mergedIds.join(","),
        afterId: mergeResult.canonicalId,
        reason: `Duplicate ${group.value} (${group.valueType})`,
      })
    } else if (mergeResult.error) {
      result.errors.push(mergeResult.error)
    }
  }

  // Step 3: Consolidate concepts
  console.log("[consolidator] Step 3: Consolidating concepts...")
  const concepts = await consolidateConcepts(dryRun)
  result.mergedConcepts = concepts.merged
  result.errors.push(...concepts.errors)

  result.success = result.errors.length === 0

  console.log(
    `[consolidator] Consolidation complete: merged ${result.mergedRules} rules, quarantined ${result.quarantinedRules}, merged ${result.mergedConcepts} concepts`
  )

  return result
}
