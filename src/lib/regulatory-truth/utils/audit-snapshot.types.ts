// src/lib/regulatory-truth/utils/audit-snapshot.types.ts
//
// Pure types and hash functions for audit snapshots - no database dependencies

import { createHash } from "crypto"
import type { ConfidenceReasonEntry } from "./confidence-envelope.types"

// =============================================================================
// TYPES
// =============================================================================

/**
 * Source health state at the time of snapshot.
 */
export interface SourceHealthSnapshot {
  sourceSlug: string
  health: string // GOOD, POOR, CRITICAL
  stateChangedAt?: Date
  decisionReason?: string // From Mission #2 stability guards
}

/**
 * Routing/budget summary from budget governor.
 */
export interface RoutingBudgetSummary {
  observationMode: boolean
  dailyBudgetUsed: number
  dailyBudgetLimit: number
  activeRoutings: number
  pausedRoutings: number
  timestamp: Date
}

/**
 * Input for creating an audit snapshot.
 */
export interface AuditSnapshotInput {
  ruleId: string
  rule: {
    conceptSlug: string
    value: string
    valueType: string
    effectiveFrom: Date
    effectiveUntil: Date | null
    derivedConfidence: number
  }
  candidateFactIds: string[]
  agentRunIds: string[]
  sourcePointerIds: string[]
  confidenceScore: number
  confidenceReasons: ConfidenceReasonEntry[]
  sourceHealthStates: SourceHealthSnapshot[]
  routingBudgetSummary: RoutingBudgetSummary
  agentRunId?: string // The AgentRun that triggered this snapshot
  jobId?: string // BullMQ job ID for correlation
}

// =============================================================================
// HASH FUNCTIONS
// =============================================================================

/**
 * Compute SHA256 hash of rule content for deterministic comparison.
 *
 * Hash includes: conceptSlug, value, valueType, effectiveFrom, effectiveUntil, derivedConfidence
 */
export function computeRuleHash(rule: {
  conceptSlug: string
  value: string
  valueType: string
  effectiveFrom: Date
  effectiveUntil: Date | null
  derivedConfidence: number
}): string {
  const content = JSON.stringify({
    conceptSlug: rule.conceptSlug,
    value: rule.value,
    valueType: rule.valueType,
    effectiveFrom: rule.effectiveFrom.toISOString(),
    effectiveUntil: rule.effectiveUntil?.toISOString() ?? null,
    derivedConfidence: rule.derivedConfidence,
  })

  return createHash("sha256").update(content).digest("hex")
}

/**
 * Compute SHA256 hash of inputs for deterministic replay.
 *
 * Hash includes: candidateFactIds, agentRunIds, sourcePointerIds
 */
export function computeInputsHash(
  candidateFactIds: string[],
  agentRunIds: string[],
  sourcePointerIds: string[]
): string {
  const content = JSON.stringify({
    candidateFactIds: [...candidateFactIds].sort(),
    agentRunIds: [...agentRunIds].sort(),
    sourcePointerIds: [...sourcePointerIds].sort(),
  })

  return createHash("sha256").update(content).digest("hex")
}
