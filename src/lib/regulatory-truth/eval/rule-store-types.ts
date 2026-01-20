// src/lib/regulatory-truth/eval/rule-store-types.ts
/**
 * Rule Store Types
 *
 * Types are separated from implementations to avoid database imports
 * in unit test contexts.
 */

import type { RegulatoryRule } from "@prisma/client"
import type { EdgeTrace } from "../graph/edge-types"

/**
 * Topic key format: domain/area/subarea
 * Maps to conceptSlug in the database.
 */
export type TopicKey = string

export type RuleSelectionReason =
  | "EFFECTIVE"
  | "FUTURE"
  | "EXPIRED"
  | "NO_RULE_FOUND"
  | "NO_COVERAGE"
  | "CONFLICT_MULTIPLE_EFFECTIVE"

/** Graph status for a rule's edges */
export type GraphStatus = "PENDING" | "CURRENT" | "STALE"

export interface RuleSelectionResult {
  success: boolean
  rule: RegulatoryRule | null
  reason: RuleSelectionReason
  /** If conflict, lists the conflicting rule IDs */
  conflictingRuleIds?: string[]
  /** Effective period of selected rule */
  effectivePeriod?: {
    from: string
    until: string | null
  }
  /** Edge trace for debugging and audit */
  edgeTrace?: EdgeTrace
  /** Earliest coverage date if reason is NO_COVERAGE/FUTURE */
  earliestCoverageDate?: string
  /** Rules that override the selected rule (context for evaluation) */
  overridingRuleIds?: string[]
  /** Graph status of the selected rule - STALE means edges may be incomplete */
  graphStatus?: GraphStatus
}

// =============================================================================
// RuleStore Interface (Dependency Injection)
// =============================================================================

/**
 * RuleStore interface for dependency injection.
 *
 * This interface allows query.ts to work with either:
 * - Real DB-backed implementation (production)
 * - Null/mock implementation (unit tests)
 *
 * Without using dynamic imports as a hacky workaround.
 */
export interface RuleStore {
  /**
   * Select the correct rule for a topic at a given date.
   * Returns null if DB is not available or topic not found.
   */
  selectRule(topicKey: TopicKey, asOfDate: Date): Promise<RuleSelectionResult | null>

  /**
   * Check if a rule exists for a topic (without temporal filtering).
   */
  hasRule?(topicKey: TopicKey): Promise<boolean>
}

/**
 * Null implementation of RuleStore for unit tests.
 * Always returns null, causing fallback to static RULE_REGISTRY.
 */
export const nullRuleStore: RuleStore = {
  selectRule: async () => null,
  hasRule: async () => false,
}
