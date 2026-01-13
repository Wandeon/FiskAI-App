// src/lib/regulatory-truth/utils/audit-snapshot.ts
//
// Mission #3: Audit Snapshots
//
// Creates immutable audit records on Apply success. These capture the full
// context at the moment a rule was created/updated, enabling:
// - Deterministic replay ("why did this rule get created?")
// - External audit ("show me the state when rule X was made")
// - Lineage tracking ("what inputs led to this output?")

import { db } from "@/lib/db"

// Re-export pure types and hash functions
export {
  type SourceHealthSnapshot,
  type RoutingBudgetSummary,
  type AuditSnapshotInput,
  computeRuleHash,
  computeInputsHash,
} from "./audit-snapshot.types"

import {
  computeRuleHash,
  computeInputsHash,
  type AuditSnapshotInput,
  type RoutingBudgetSummary,
  type SourceHealthSnapshot,
} from "./audit-snapshot.types"

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

/**
 * Create an immutable audit snapshot for a rule.
 *
 * This should be called immediately after a rule is created or significantly updated.
 * The snapshot is immutable - once created, it cannot be modified.
 */
export async function createAuditSnapshot(input: AuditSnapshotInput): Promise<string> {
  const ruleHash = computeRuleHash(input.rule)
  const inputsHash = computeInputsHash(
    input.candidateFactIds,
    input.agentRunIds,
    input.sourcePointerIds
  )

  // Convert source health states to JSON-friendly format
  const sourceHealthState: Record<string, unknown> = {}
  for (const state of input.sourceHealthStates) {
    sourceHealthState[state.sourceSlug] = {
      health: state.health,
      stateChangedAt: state.stateChangedAt?.toISOString(),
      decisionReason: state.decisionReason,
    }
  }

  // Create the snapshot
  const snapshot = await db.auditSnapshot.create({
    data: {
      ruleId: input.ruleId,
      ruleHash,
      inputsHash,
      sourceHealthState,
      routingBudgetSummary: {
        observationMode: input.routingBudgetSummary.observationMode,
        dailyBudgetUsed: input.routingBudgetSummary.dailyBudgetUsed,
        dailyBudgetLimit: input.routingBudgetSummary.dailyBudgetLimit,
        activeRoutings: input.routingBudgetSummary.activeRoutings,
        pausedRoutings: input.routingBudgetSummary.pausedRoutings,
        timestamp: input.routingBudgetSummary.timestamp.toISOString(),
      },
      confidenceScore: input.confidenceScore,
      confidenceReasons: input.confidenceReasons,
      candidateFactIds: input.candidateFactIds,
      agentRunIds: input.agentRunIds,
      sourcePointerIds: input.sourcePointerIds,
      agentRunId: input.agentRunId,
      jobId: input.jobId,
    },
  })

  console.log(`[audit-snapshot] Created snapshot ${snapshot.id} for rule ${input.ruleId}`)

  return snapshot.id
}

/**
 * Get all audit snapshots for a rule.
 */
export async function getAuditSnapshots(ruleId: string) {
  return db.auditSnapshot.findMany({
    where: { ruleId },
    orderBy: { createdAt: "desc" },
  })
}

/**
 * Get the latest audit snapshot for a rule.
 */
export async function getLatestAuditSnapshot(ruleId: string) {
  return db.auditSnapshot.findFirst({
    where: { ruleId },
    orderBy: { createdAt: "desc" },
  })
}

/**
 * Verify that a rule matches its audit snapshot (deterministic replay check).
 */
export async function verifyRuleAgainstSnapshot(
  rule: {
    id: string
    conceptSlug: string
    value: string
    valueType: string
    effectiveFrom: Date
    effectiveUntil: Date | null
    derivedConfidence: number
  },
  snapshotId: string
): Promise<{ matches: boolean; expectedHash: string; actualHash: string }> {
  const snapshot = await db.auditSnapshot.findUnique({
    where: { id: snapshotId },
  })

  if (!snapshot) {
    throw new Error(`Snapshot ${snapshotId} not found`)
  }

  const actualHash = computeRuleHash(rule)

  return {
    matches: actualHash === snapshot.ruleHash,
    expectedHash: snapshot.ruleHash,
    actualHash,
  }
}

/**
 * Helper to get current routing/budget summary for snapshot.
 * This queries the current state from the budget governor tables.
 */
export async function getCurrentRoutingBudgetSummary(): Promise<RoutingBudgetSummary> {
  // Get observation mode from environment
  const observationMode = process.env.RTL_OBSERVATION_MODE === "true"

  // Count active and paused routings from source health
  const [activeCount, pausedCount] = await Promise.all([
    db.sourceHealth.count({
      where: { healthState: "GOOD" },
    }),
    db.sourceHealth.count({
      where: { healthState: { in: ["POOR", "CRITICAL"] } },
    }),
  ])

  // Get today's budget usage from AgentRun
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const dailyUsage = await db.agentRun.aggregate({
    where: {
      startedAt: { gte: today },
      agentType: { in: ["COMPOSER", "EXTRACTOR", "REVIEWER"] },
    },
    _sum: { tokensUsed: true },
  })

  return {
    observationMode,
    dailyBudgetUsed: dailyUsage._sum.tokensUsed || 0,
    dailyBudgetLimit: parseInt(process.env.RTL_DAILY_TOKEN_BUDGET || "1000000", 10),
    activeRoutings: activeCount,
    pausedRoutings: pausedCount,
    timestamp: new Date(),
  }
}

/**
 * Helper to get current source health states for snapshot.
 */
export async function getCurrentSourceHealthStates(): Promise<SourceHealthSnapshot[]> {
  const healthRecords = await db.sourceHealth.findMany({
    select: {
      sourceSlug: true,
      healthState: true,
      healthStateEnteredAt: true,
      lastDecisionReason: true,
    },
  })

  return healthRecords.map((r) => ({
    sourceSlug: r.sourceSlug,
    health: r.healthState,
    stateChangedAt: r.healthStateEnteredAt ?? undefined,
    decisionReason: r.lastDecisionReason ?? undefined,
  }))
}
