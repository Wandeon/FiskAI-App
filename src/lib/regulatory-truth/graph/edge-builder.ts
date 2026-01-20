// src/lib/regulatory-truth/graph/edge-builder.ts
/**
 * Edge Builder - Event-driven edge computation for the Statutory Reference Graph
 *
 * Replaces the batch "buildKnowledgeGraph" anti-pattern with on-demand edge computation.
 * Called when a rule is upserted to maintain graph consistency.
 */

import { db } from "@/lib/db"
import type { RegulatoryRule } from "@prisma/client"
import { createEdgeWithCycleCheck, CycleDetectedError } from "./cycle-detection"
import type { EdgeBuildResult, EdgeTrace } from "./edge-types"

// Re-export types for convenience
export type { EdgeBuildResult, EdgeTrace }

// =============================================================================
// Edge Rebuilding (Event-driven)
// =============================================================================

/**
 * Rebuild all SRG edges for a given rule.
 *
 * Called on rule upsert to maintain graph consistency.
 * Computes:
 * - SUPERSEDES chain for same conceptSlug (by effectiveFrom date)
 * - OVERRIDES edges from rule's assertions/claims
 * - DEPENDS_ON edges from appliesWhen DSL
 *
 * This replaces the nightly batch build with deterministic, on-demand computation.
 */
export async function rebuildEdgesForRule(ruleId: string): Promise<EdgeBuildResult> {
  const result: EdgeBuildResult = {
    ruleId,
    supersedes: { created: 0, deleted: 0, errors: [] },
    overrides: { created: 0, deleted: 0, errors: [] },
    dependsOn: { created: 0, deleted: 0, errors: [] },
    totalEdges: 0,
  }

  // Get the rule
  const rule = await db.regulatoryRule.findUnique({
    where: { id: ruleId },
    include: {
      atomicClaims: {
        include: { exceptions: true },
      },
    },
  })

  if (!rule) {
    result.supersedes.errors.push(`Rule not found: ${ruleId}`)
    return result
  }

  // Only process PUBLISHED or APPROVED rules
  if (rule.status !== "PUBLISHED" && rule.status !== "APPROVED") {
    return result
  }

  // 1. Rebuild SUPERSEDES edges
  const supersedesResult = await rebuildSupersedesEdges(rule)
  result.supersedes = supersedesResult

  // 2. Rebuild OVERRIDES edges (from ClaimExceptions)
  const overridesResult = await rebuildOverridesEdges(rule)
  result.overrides = overridesResult

  // 3. Rebuild DEPENDS_ON edges (from appliesWhen DSL)
  const dependsOnResult = await rebuildDependsOnEdges(rule)
  result.dependsOn = dependsOnResult

  // Count total edges
  const edges = await db.graphEdge.count({
    where: {
      OR: [{ fromRuleId: ruleId }, { toRuleId: ruleId }],
      namespace: "SRG",
    },
  })
  result.totalEdges = edges

  return result
}

/**
 * Rebuild SUPERSEDES edges for a rule based on temporal ordering.
 *
 * For rules with the same conceptSlug:
 * - A rule with later effectiveFrom SUPERSEDES rules with earlier effectiveFrom
 * - Edge: newerRule -> olderRule (newer supersedes older)
 */
async function rebuildSupersedesEdges(
  rule: RegulatoryRule
): Promise<EdgeBuildResult["supersedes"]> {
  const result = { created: 0, deleted: 0, errors: [] as string[] }

  // Find all published rules with same conceptSlug
  // RTL2 GUARD: Only consider rules with RTL2 lineage to prevent legacy contamination
  const sameConceptRules = await db.regulatoryRule.findMany({
    where: {
      conceptSlug: rule.conceptSlug,
      status: { in: ["PUBLISHED", "APPROVED"] },
      revokedAt: null,
      id: { not: rule.id },
      // RTL2: Skip legacy rules without lineage
      originatingCandidateFactIds: { isEmpty: false },
    },
    orderBy: { effectiveFrom: "desc" },
  })

  if (sameConceptRules.length === 0) {
    return result
  }

  // Delete existing SUPERSEDES edges from/to this rule
  const deleted = await db.graphEdge.deleteMany({
    where: {
      OR: [{ fromRuleId: rule.id }, { toRuleId: rule.id }],
      relation: "SUPERSEDES",
      namespace: "SRG",
    },
  })
  result.deleted = deleted.count

  // Find rules this rule supersedes (rules with earlier effectiveFrom)
  const olderRules = sameConceptRules.filter((r) => r.effectiveFrom < rule.effectiveFrom)

  // Find rules that supersede this rule (rules with later effectiveFrom)
  const newerRules = sameConceptRules.filter((r) => r.effectiveFrom > rule.effectiveFrom)

  // Create edges: this rule supersedes older rules (only the most recent one)
  if (olderRules.length > 0) {
    // Only create edge to the immediately preceding rule (most recent older)
    const immediatelyPreceding = olderRules[0] // Already sorted desc
    try {
      await createEdgeWithCycleCheck({
        fromRuleId: rule.id,
        toRuleId: immediatelyPreceding.id,
        relation: "SUPERSEDES",
        validFrom: rule.effectiveFrom,
        notes: `${rule.conceptSlug}: ${rule.effectiveFrom.toISOString().split("T")[0]} supersedes ${immediatelyPreceding.effectiveFrom.toISOString().split("T")[0]}`,
      })
      result.created++
    } catch (error) {
      if (error instanceof CycleDetectedError) {
        result.errors.push(`Cycle prevented: ${rule.id} -> ${immediatelyPreceding.id}`)
      } else {
        throw error
      }
    }
  }

  // Create edges: newer rules supersede this rule
  for (const newerRule of newerRules) {
    // Check if edge already exists (created by the other rule's rebuild)
    const existing = await db.graphEdge.findFirst({
      where: {
        fromRuleId: newerRule.id,
        toRuleId: rule.id,
        relation: "SUPERSEDES",
      },
    })

    if (!existing) {
      try {
        await createEdgeWithCycleCheck({
          fromRuleId: newerRule.id,
          toRuleId: rule.id,
          relation: "SUPERSEDES",
          validFrom: newerRule.effectiveFrom,
          notes: `${rule.conceptSlug}: ${newerRule.effectiveFrom.toISOString().split("T")[0]} supersedes ${rule.effectiveFrom.toISOString().split("T")[0]}`,
        })
        result.created++
      } catch (error) {
        if (error instanceof CycleDetectedError) {
          result.errors.push(`Cycle prevented: ${newerRule.id} -> ${rule.id}`)
        } else {
          throw error
        }
      }
    }
  }

  return result
}

/**
 * Rebuild OVERRIDES edges from ClaimExceptions.
 *
 * When a claim has exceptions, the exception's overridesTo conceptSlug
 * points to rules that override the general rule.
 */
async function rebuildOverridesEdges(
  rule: RegulatoryRule & { atomicClaims: Array<{ exceptions: Array<{ overridesTo: string }> }> }
): Promise<EdgeBuildResult["overrides"]> {
  const result = { created: 0, deleted: 0, errors: [] as string[] }

  // Delete existing OVERRIDES edges where this rule is the target (overridden)
  const deleted = await db.graphEdge.deleteMany({
    where: {
      toRuleId: rule.id,
      relation: "OVERRIDES",
      namespace: "SRG",
    },
  })
  result.deleted = deleted.count

  // Process exceptions from claims
  for (const claim of rule.atomicClaims) {
    for (const exception of claim.exceptions) {
      // Find the overriding rule by conceptSlug
      // RTL2 GUARD: Only consider rules with RTL2 lineage
      const overridingRule = await db.regulatoryRule.findFirst({
        where: {
          conceptSlug: exception.overridesTo,
          status: { in: ["PUBLISHED", "APPROVED"] },
          revokedAt: null,
          // RTL2: Skip legacy rules without lineage
          originatingCandidateFactIds: { isEmpty: false },
        },
      })

      if (!overridingRule) {
        result.errors.push(`Overriding rule not found: ${exception.overridesTo}`)
        continue
      }

      try {
        await createEdgeWithCycleCheck({
          fromRuleId: overridingRule.id,
          toRuleId: rule.id,
          relation: "OVERRIDES",
          validFrom: new Date(),
          notes: `Exception: ${exception.overridesTo} overrides ${rule.conceptSlug}`,
        })
        result.created++
      } catch (error) {
        if (error instanceof CycleDetectedError) {
          result.errors.push(`Cycle prevented: ${overridingRule.id} -> ${rule.id}`)
        } else if (String(error).includes("Unique constraint")) {
          // Edge already exists, skip
        } else {
          throw error
        }
      }
    }
  }

  return result
}

/**
 * Rebuild DEPENDS_ON edges from appliesWhen DSL.
 *
 * Parses the appliesWhen JSON to extract concept references.
 */
async function rebuildDependsOnEdges(rule: RegulatoryRule): Promise<EdgeBuildResult["dependsOn"]> {
  const result = { created: 0, deleted: 0, errors: [] as string[] }

  // Delete existing DEPENDS_ON edges from this rule
  const deleted = await db.graphEdge.deleteMany({
    where: {
      fromRuleId: rule.id,
      relation: "DEPENDS_ON",
      namespace: "SRG",
    },
  })
  result.deleted = deleted.count

  // Parse appliesWhen to extract dependencies
  const dependencies = extractDependencies(rule.appliesWhen)

  for (const depSlug of dependencies) {
    // Find the dependency rule
    // RTL2 GUARD: Only consider rules with RTL2 lineage
    const depRule = await db.regulatoryRule.findFirst({
      where: {
        conceptSlug: depSlug,
        status: { in: ["PUBLISHED", "APPROVED"] },
        revokedAt: null,
        // Must be effective (simplified check)
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: new Date() } }],
        // RTL2: Skip legacy rules without lineage
        originatingCandidateFactIds: { isEmpty: false },
      },
      orderBy: { effectiveFrom: "desc" },
    })

    if (!depRule || depRule.id === rule.id) {
      continue
    }

    try {
      await createEdgeWithCycleCheck({
        fromRuleId: rule.id,
        toRuleId: depRule.id,
        relation: "DEPENDS_ON",
        validFrom: rule.effectiveFrom,
        notes: `${rule.conceptSlug} depends on ${depSlug}`,
      })
      result.created++
    } catch (error) {
      if (error instanceof CycleDetectedError) {
        result.errors.push(`Cycle prevented: ${rule.id} -> ${depRule.id}`)
      } else if (String(error).includes("Unique constraint")) {
        // Edge already exists
      } else {
        throw error
      }
    }
  }

  return result
}

/**
 * Extract concept slugs from appliesWhen DSL.
 *
 * Handles:
 * - JSON with concept_ref fields
 * - JSON with rule_ref fields
 * - Fallback regex for slug patterns
 */
function extractDependencies(appliesWhen: string): string[] {
  const dependencies: string[] = []

  try {
    const parsed = JSON.parse(appliesWhen)

    const findRefs = (obj: unknown): void => {
      if (!obj || typeof obj !== "object") return

      if (Array.isArray(obj)) {
        obj.forEach(findRefs)
        return
      }

      const o = obj as Record<string, unknown>

      // Check for concept_ref or similar fields
      if (o.concept_ref && typeof o.concept_ref === "string") {
        dependencies.push(o.concept_ref)
      }

      // Check for rule_ref
      if (o.rule_ref && typeof o.rule_ref === "string") {
        dependencies.push(o.rule_ref)
      }

      // Check for depends_on array
      if (Array.isArray(o.depends_on)) {
        for (const dep of o.depends_on) {
          if (typeof dep === "string") {
            dependencies.push(dep)
          }
        }
      }

      // Recurse into nested objects
      Object.values(o).forEach(findRefs)
    }

    findRefs(parsed)
  } catch {
    // Not JSON - skip regex fallback as it's too unreliable
    // Better to have no edges than wrong edges
  }

  return [...new Set(dependencies)]
}

// =============================================================================
// Edge Traversal for Rule Selection
// =============================================================================

/**
 * Build an edge trace for a selected rule.
 *
 * Traverses the SRG to collect:
 * - Supersession chain (all rules this rule supersedes)
 * - Rules that override this rule
 * - Any conflicts detected
 */
export async function buildEdgeTrace(ruleId: string): Promise<EdgeTrace> {
  const trace: EdgeTrace = {
    selectedRuleId: ruleId,
    traversedEdges: [],
    supersessionChain: [],
    overriddenBy: [],
  }

  // Get supersession chain (what this rule supersedes)
  let currentId: string | null = ruleId
  const visited = new Set<string>()

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId)

    const supersedesEdge: { fromRuleId: string; toRuleId: string } | null =
      await db.graphEdge.findFirst({
        where: {
          fromRuleId: currentId,
          relation: "SUPERSEDES",
          namespace: "SRG",
        },
      })

    if (supersedesEdge) {
      trace.traversedEdges.push({
        from: supersedesEdge.fromRuleId,
        to: supersedesEdge.toRuleId,
        type: "SUPERSEDES",
        direction: "outgoing",
      })
      trace.supersessionChain.push(supersedesEdge.toRuleId)
      currentId = supersedesEdge.toRuleId
    } else {
      currentId = null
    }
  }

  // Get rules that override this rule
  const overridesEdges = await db.graphEdge.findMany({
    where: {
      toRuleId: ruleId,
      relation: "OVERRIDES",
      namespace: "SRG",
    },
  })

  for (const edge of overridesEdges) {
    trace.traversedEdges.push({
      from: edge.fromRuleId,
      to: edge.toRuleId,
      type: "OVERRIDES",
      direction: "incoming",
    })
    trace.overriddenBy.push(edge.fromRuleId)
  }

  return trace
}

/**
 * Find all rules that supersede a given rule (directly or transitively).
 */
export async function findSupersedingRules(ruleId: string): Promise<string[]> {
  const result: string[] = []
  const visited = new Set<string>()
  const queue = [ruleId]

  while (queue.length > 0) {
    const currentId = queue.shift()!
    if (visited.has(currentId)) continue
    visited.add(currentId)

    const edges = await db.graphEdge.findMany({
      where: {
        toRuleId: currentId,
        relation: "SUPERSEDES",
        namespace: "SRG",
      },
    })

    for (const edge of edges) {
      result.push(edge.fromRuleId)
      queue.push(edge.fromRuleId)
    }
  }

  return result
}

/**
 * Find all rules that this rule supersedes (directly or transitively).
 */
export async function findSupersededRules(ruleId: string): Promise<string[]> {
  const result: string[] = []
  const visited = new Set<string>()
  const queue = [ruleId]

  while (queue.length > 0) {
    const currentId = queue.shift()!
    if (visited.has(currentId)) continue
    visited.add(currentId)

    const edges = await db.graphEdge.findMany({
      where: {
        fromRuleId: currentId,
        relation: "SUPERSEDES",
        namespace: "SRG",
      },
    })

    for (const edge of edges) {
      result.push(edge.toRuleId)
      queue.push(edge.toRuleId)
    }
  }

  return result
}
