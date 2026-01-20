// src/lib/regulatory-truth/eval/rule-store.ts
/**
 * Rule Store - DB-backed rule selection with KG edge integration
 *
 * Uses the Statutory Reference Graph (SRG) edges for:
 * - SUPERSEDES: temporal ordering within same conceptSlug
 * - OVERRIDES: specific rules overriding general rules
 *
 * The selection algorithm uses edge traversal to determine which rule
 * is authoritative for a given date, rather than just comparing effectiveFrom.
 */

import { db } from "@/lib/db"
import type { RegulatoryRule } from "@prisma/client"
import { isTemporallyEffective, type TemporalFilterReason } from "../utils/temporal-filter"
import { buildEdgeTrace, findSupersedingRules } from "../graph/edge-builder"
import { findOverridingRules } from "../taxonomy/precedence-builder"
import type { TopicKey, RuleSelectionResult, RuleSelectionReason } from "./rule-store-types"

// Re-export types for convenience
export type { TopicKey, RuleSelectionResult, RuleSelectionReason }

// =============================================================================
// Configuration
// =============================================================================

/**
 * Mapping from topic keys to conceptSlug patterns.
 * This allows the eval module to use semantic topic keys
 * while the DB uses conceptSlugs.
 */
const TOPIC_TO_CONCEPT_SLUG: Record<TopicKey, string> = {
  "TAX/VAT/REGISTRATION": "pdv-prag-obveznog-upisa",
  // Add more mappings as needed
}

// =============================================================================
// Rule Selection
// =============================================================================

/**
 * Select the correct rule for a topic at a given date.
 *
 * Selection algorithm using SRG edges:
 * 1. Map topicKey to conceptSlug
 * 2. Query RegulatoryRule by conceptSlug with status=PUBLISHED
 * 3. Filter to those temporally effective at asOfDate
 * 4. If multiple effective rules:
 *    a. Use SUPERSEDES edges from the SRG to find the authoritative rule
 *    b. A rule is authoritative if no other effective rule supersedes it
 *    c. If multiple authoritative rules remain, return CONFLICT
 * 5. Build edge trace for selected rule
 * 6. Check for OVERRIDES edges (context for evaluation)
 */
export async function selectRuleFromDb(
  topicKey: TopicKey,
  asOfDate: Date
): Promise<RuleSelectionResult> {
  // Map topic key to concept slug
  const conceptSlug = TOPIC_TO_CONCEPT_SLUG[topicKey]
  if (!conceptSlug) {
    return {
      success: false,
      rule: null,
      reason: "NO_RULE_FOUND",
    }
  }

  // Query all PUBLISHED rules for this concept
  const rules = await db.regulatoryRule.findMany({
    where: {
      conceptSlug,
      status: "PUBLISHED",
      revokedAt: null, // Not revoked
    },
    orderBy: {
      effectiveFrom: "desc",
    },
  })

  if (rules.length === 0) {
    return {
      success: false,
      rule: null,
      reason: "NO_RULE_FOUND",
    }
  }

  // Filter to temporally effective rules
  const effectiveRules: RegulatoryRule[] = []
  const reasons: TemporalFilterReason[] = []

  for (const rule of rules) {
    const result = isTemporallyEffective(
      {
        effectiveFrom: rule.effectiveFrom,
        effectiveUntil: rule.effectiveUntil,
      },
      asOfDate
    )
    reasons.push(result.reason)
    if (result.isEffective) {
      effectiveRules.push(rule)
    }
  }

  // No effective rules - determine why
  if (effectiveRules.length === 0) {
    const hasFuture = reasons.includes("FUTURE")
    const hasExpired = reasons.includes("EXPIRED")

    // Find earliest coverage date for helpful error message
    const sortedByFrom = [...rules].sort(
      (a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime()
    )
    const earliestDate = sortedByFrom[0]?.effectiveFrom.toISOString().split("T")[0]

    // Use NO_COVERAGE for dates before any rule (clearer than FUTURE for historical queries)
    if (hasFuture && rules.every((r) => asOfDate < r.effectiveFrom)) {
      return {
        success: false,
        rule: null,
        reason: "NO_COVERAGE",
        earliestCoverageDate: earliestDate,
      }
    }

    return {
      success: false,
      rule: null,
      reason: hasFuture ? "FUTURE" : hasExpired ? "EXPIRED" : "NO_RULE_FOUND",
      earliestCoverageDate: earliestDate,
    }
  }

  // Single effective rule - success
  if (effectiveRules.length === 1) {
    const rule = effectiveRules[0]
    const edgeTrace = await buildEdgeTrace(rule.id)
    const overridingRuleIds = await findOverridingRules(rule.id)

    return {
      success: true,
      rule,
      reason: "EFFECTIVE",
      effectivePeriod: {
        from: rule.effectiveFrom.toISOString().split("T")[0],
        until: rule.effectiveUntil?.toISOString().split("T")[0] ?? null,
      },
      edgeTrace,
      overridingRuleIds: overridingRuleIds.length > 0 ? overridingRuleIds : undefined,
      // Include graphStatus for evaluation gate (STALE = edges incomplete)
      graphStatus: (rule as { graphStatus?: string }).graphStatus as
        | "PENDING"
        | "CURRENT"
        | "STALE"
        | undefined,
    }
  }

  // Multiple effective rules - use SRG SUPERSEDES edges to find authoritative rule
  // A rule is authoritative if no other effective rule supersedes it
  const effectiveRuleIds = new Set(effectiveRules.map((r) => r.id))
  const supersededByEffective = new Set<string>()

  // For each effective rule, check if another effective rule supersedes it
  for (const rule of effectiveRules) {
    const supersedingRuleIds = await findSupersedingRules(rule.id)

    // If any superseding rule is also effective, this rule is superseded
    for (const supersedingId of supersedingRuleIds) {
      if (effectiveRuleIds.has(supersedingId)) {
        supersededByEffective.add(rule.id)
        break
      }
    }
  }

  // Find authoritative rules (not superseded by any effective rule)
  const authoritativeRules = effectiveRules.filter((r) => !supersededByEffective.has(r.id))

  if (authoritativeRules.length === 0) {
    // This shouldn't happen with proper edges, but handle gracefully
    // Fall back to most recent by effectiveFrom
    const mostRecent = effectiveRules[0] // Already sorted desc
    const edgeTrace = await buildEdgeTrace(mostRecent.id)
    const overridingRuleIds = await findOverridingRules(mostRecent.id)

    return {
      success: true,
      rule: mostRecent,
      reason: "EFFECTIVE",
      effectivePeriod: {
        from: mostRecent.effectiveFrom.toISOString().split("T")[0],
        until: mostRecent.effectiveUntil?.toISOString().split("T")[0] ?? null,
      },
      edgeTrace,
      overridingRuleIds: overridingRuleIds.length > 0 ? overridingRuleIds : undefined,
      graphStatus: (mostRecent as { graphStatus?: string }).graphStatus as
        | "PENDING"
        | "CURRENT"
        | "STALE"
        | undefined,
    }
  }

  if (authoritativeRules.length === 1) {
    // Single authoritative rule - success
    const rule = authoritativeRules[0]
    const edgeTrace = await buildEdgeTrace(rule.id)
    const overridingRuleIds = await findOverridingRules(rule.id)

    return {
      success: true,
      rule,
      reason: "EFFECTIVE",
      effectivePeriod: {
        from: rule.effectiveFrom.toISOString().split("T")[0],
        until: rule.effectiveUntil?.toISOString().split("T")[0] ?? null,
      },
      edgeTrace,
      overridingRuleIds: overridingRuleIds.length > 0 ? overridingRuleIds : undefined,
      graphStatus: (rule as { graphStatus?: string }).graphStatus as
        | "PENDING"
        | "CURRENT"
        | "STALE"
        | undefined,
    }
  }

  // Multiple authoritative rules - genuine conflict
  return {
    success: false,
    rule: null,
    reason: "CONFLICT_MULTIPLE_EFFECTIVE",
    conflictingRuleIds: authoritativeRules.map((r) => r.id),
  }
}

/**
 * Check if a rule exists for a topic (without temporal filtering).
 * Useful for coverage checks.
 */
export async function hasRuleForTopic(topicKey: TopicKey): Promise<boolean> {
  const conceptSlug = TOPIC_TO_CONCEPT_SLUG[topicKey]
  if (!conceptSlug) return false

  const count = await db.regulatoryRule.count({
    where: {
      conceptSlug,
      status: "PUBLISHED",
      revokedAt: null,
    },
  })

  return count > 0
}

/**
 * Get all effective date ranges for a topic.
 * Useful for UI to show coverage periods.
 */
export async function getRuleCoverage(
  topicKey: TopicKey
): Promise<Array<{ from: string; until: string | null; ruleId: string }>> {
  const conceptSlug = TOPIC_TO_CONCEPT_SLUG[topicKey]
  if (!conceptSlug) return []

  const rules = await db.regulatoryRule.findMany({
    where: {
      conceptSlug,
      status: "PUBLISHED",
      revokedAt: null,
    },
    select: {
      id: true,
      effectiveFrom: true,
      effectiveUntil: true,
    },
    orderBy: {
      effectiveFrom: "asc",
    },
  })

  return rules.map((r) => ({
    from: r.effectiveFrom.toISOString().split("T")[0],
    until: r.effectiveUntil?.toISOString().split("T")[0] ?? null,
    ruleId: r.id,
  }))
}

// =============================================================================
// DB-Backed RuleStore Implementation
// =============================================================================

import type { RuleStore } from "./rule-store-types"

/**
 * DB-backed implementation of RuleStore.
 *
 * Wraps the existing selectRuleFromDb and hasRuleForTopic functions
 * in the RuleStore interface for dependency injection.
 */
export const dbRuleStore: RuleStore = {
  selectRule: async (topicKey, asOfDate) => {
    return selectRuleFromDb(topicKey as "TAX/VAT/REGISTRATION", asOfDate)
  },
  hasRule: async (topicKey) => {
    return hasRuleForTopic(topicKey as "TAX/VAT/REGISTRATION")
  },
}
