// src/lib/regulatory-truth/workers/source-health.ts
//
// Source Health: Self-correcting feedback loop for RTL pipeline
// Computes rolling health scores and adapts routing/budget decisions automatically.
//
// Stability features:
// - Dwell time: Sources must stay in POOR/CRITICAL for minimum duration before upgrade
// - Stepwise transitions: Health state can only change one level at a time
// - Explainability: Every decision is recorded with reason and details
// - Starvation guard: Rare sources get occasional evaluation allowance
//

import { db } from "@/lib/db"

// Health score thresholds
export const HEALTH_THRESHOLDS = {
  EXCELLENT: 0.8, // High success rate, good token efficiency
  GOOD: 0.6, // Above average performance
  FAIR: 0.4, // Below average, needs monitoring
  POOR: 0.2, // Low performance, restrict access
  CRITICAL: 0.1, // Very poor, should be paused
}

// Health states (ordered from best to worst)
export type HealthState = "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "CRITICAL"
export const HEALTH_STATES: HealthState[] = ["EXCELLENT", "GOOD", "FAIR", "POOR", "CRITICAL"]

// Decision reasons for explainability
export type DecisionReason =
  | "HEALTH_UPGRADE" // Health improved, state upgraded
  | "HEALTH_DOWNGRADE" // Health worsened, state downgraded
  | "DWELL_TIME_BLOCKED" // Upgrade blocked due to insufficient dwell time
  | "STEPWISE_BLOCKED" // Upgrade blocked due to stepwise constraint
  | "AUTO_PAUSE" // Auto-paused due to critical health
  | "AUTO_UNPAUSE" // Auto-unpaused after pause expired
  | "MANUAL_PAUSE" // Manually paused by operator
  | "MANUAL_UNPAUSE" // Manually unpaused by operator
  | "STARVATION_ALLOWANCE" // Starvation allowance granted
  | "WINDOW_RESET" // Rolling window was reset

// Health configuration
export interface HealthConfig {
  windowSizeHours: number // Rolling window size (default: 168 = 7 days)
  minAttemptsForScore: number // Min attempts before health score is meaningful
  autoUnpauseHours: number // Hours before auto-unpause
  successWeight: number // Weight for success rate in score
  efficiencyWeight: number // Weight for token efficiency in score
  emptyPenalty: number // Penalty for empty outputs
  errorPenalty: number // Penalty for errors
  // Stability: Dwell time configuration (anti-flapping)
  minDwellHoursPoor: number // Min hours to stay in POOR before upgrade
  minDwellHoursCritical: number // Min hours to stay in CRITICAL before upgrade
  // Starvation guard configuration
  starvationAllowanceIntervalHours: number // Min hours between starvation allowances
  starvationAllowanceMaxPerWindow: number // Max allowances per rolling window
}

const DEFAULT_HEALTH_CONFIG: HealthConfig = {
  windowSizeHours: 168, // 7 days
  minAttemptsForScore: 10, // Need 10 attempts before reliable score
  autoUnpauseHours: 24, // Auto-unpause after 24 hours
  successWeight: 0.5, // 50% weight for success rate
  efficiencyWeight: 0.3, // 30% weight for token efficiency
  emptyPenalty: 0.1, // 10% penalty per 10% empty rate
  errorPenalty: 0.2, // 20% penalty per 10% error rate
  // Stability: Dwell time (anti-flapping)
  minDwellHoursPoor: 12, // Must stay in POOR for 12 hours minimum
  minDwellHoursCritical: 24, // Must stay in CRITICAL for 24 hours minimum
  // Starvation guard
  starvationAllowanceIntervalHours: 48, // One allowance every 48 hours max
  starvationAllowanceMaxPerWindow: 3, // Max 3 allowances per 7-day window
}

// Observation mode flag
export const isObservationMode = (): boolean => {
  return process.env.RTL_OBSERVATION_MODE === "true"
}

// Cached health config
let healthConfig: HealthConfig = { ...DEFAULT_HEALTH_CONFIG }

// In-memory cache for health data (reduces DB reads)
const healthCache = new Map<
  string,
  {
    data: SourceHealthData
    cachedAt: number
  }
>()
const CACHE_TTL_MS = 30000 // 30 seconds

// Source health data for routing/budget decisions
export interface SourceHealthData {
  sourceSlug: string
  healthScore: number
  healthState: HealthState
  healthStateEnteredAt: Date
  isPaused: boolean
  pauseReason: string | null
  minScoutScore: number
  allowCloud: boolean
  budgetMultiplier: number
  successRate: number
  emptyRate: number
  errorRate: number
  avgTokensPerItem: number
  // Starvation guard
  lastStarvationAllowanceAt: Date | null
  starvationAllowanceCount: number
  canReceiveStarvationAllowance: boolean
}

// Decision details for explainability
export interface DecisionDetails {
  triggeredBy: string // What caused the decision
  metricValue?: number // Current value of relevant metric
  threshold?: number // Threshold that was crossed
  previousValue?: number // Previous value before change
  dwellHoursRemaining?: number // Hours remaining in dwell time (if blocked)
}

// Outcome record for batch updates
export interface OutcomeRecord {
  sourceSlug: string
  tokensUsed: number
  itemsProduced: number
  outcome: "SUCCESS" | "EMPTY" | "ERROR"
}

/**
 * Configure health scoring parameters
 */
export function configureHealth(config: Partial<HealthConfig>): void {
  healthConfig = { ...healthConfig, ...config }
  console.log("[source-health] Configuration updated:", healthConfig)
}

/**
 * Get current health config
 */
export function getHealthConfig(): HealthConfig {
  return { ...healthConfig }
}

/**
 * Compute health score from metrics
 * Returns a score between 0 and 1, higher is better
 */
export function computeHealthScore(
  successCount: number,
  emptyCount: number,
  errorCount: number,
  totalTokensUsed: number,
  totalItemsProduced: number,
  config: HealthConfig = healthConfig
): number {
  const totalAttempts = successCount + emptyCount + errorCount

  // Not enough data - return neutral score
  if (totalAttempts < config.minAttemptsForScore) {
    return 0.5
  }

  // Calculate rates
  const successRate = successCount / totalAttempts
  const emptyRate = emptyCount / totalAttempts
  const errorRate = errorCount / totalAttempts

  // Calculate token efficiency (items per 1000 tokens)
  // Normalize to 0-1 range (assume 1 item per 2000 tokens is average)
  const tokensPerItem = totalItemsProduced > 0 ? totalTokensUsed / totalItemsProduced : Infinity
  const efficiencyScore = tokensPerItem < Infinity ? Math.min(1, 2000 / tokensPerItem) : 0

  // Compute weighted score
  let score = successRate * config.successWeight + efficiencyScore * config.efficiencyWeight

  // Apply penalties
  score -= emptyRate * config.emptyPenalty * 10 // Scale up penalty effect
  score -= errorRate * config.errorPenalty * 10

  // Fill remaining weight with baseline
  const remainingWeight = 1 - config.successWeight - config.efficiencyWeight
  score += remainingWeight * 0.5 // Neutral baseline

  // Clamp to 0-1
  return Math.max(0, Math.min(1, score))
}

/**
 * Compute adaptive thresholds based on health score
 * Returns thresholds that restrict bad sources and reward good ones
 */
export function computeAdaptiveThresholds(healthScore: number): {
  minScoutScore: number
  allowCloud: boolean
  budgetMultiplier: number
} {
  // Excellent health: lower barriers, more budget
  if (healthScore >= HEALTH_THRESHOLDS.EXCELLENT) {
    return {
      minScoutScore: 0.3, // Lower scout threshold
      allowCloud: true,
      budgetMultiplier: 1.5, // 50% more budget
    }
  }

  // Good health: slightly relaxed
  if (healthScore >= HEALTH_THRESHOLDS.GOOD) {
    return {
      minScoutScore: 0.35,
      allowCloud: true,
      budgetMultiplier: 1.2, // 20% more budget
    }
  }

  // Fair health: default thresholds
  if (healthScore >= HEALTH_THRESHOLDS.FAIR) {
    return {
      minScoutScore: 0.4,
      allowCloud: true,
      budgetMultiplier: 1.0,
    }
  }

  // Poor health: higher barriers, less budget
  if (healthScore >= HEALTH_THRESHOLDS.POOR) {
    return {
      minScoutScore: 0.5, // Higher scout threshold
      allowCloud: false, // No cloud LLM
      budgetMultiplier: 0.5, // Half budget
    }
  }

  // Critical health: very restricted
  return {
    minScoutScore: 0.7, // Very high threshold
    allowCloud: false,
    budgetMultiplier: 0.2, // 20% of normal budget
  }
}

/**
 * Get health state from score
 */
export function getHealthStateFromScore(score: number): HealthState {
  if (score >= HEALTH_THRESHOLDS.EXCELLENT) return "EXCELLENT"
  if (score >= HEALTH_THRESHOLDS.GOOD) return "GOOD"
  if (score >= HEALTH_THRESHOLDS.FAIR) return "FAIR"
  if (score >= HEALTH_THRESHOLDS.POOR) return "POOR"
  return "CRITICAL"
}

/**
 * Get index of health state (0 = EXCELLENT, 4 = CRITICAL)
 */
export function getHealthStateIndex(state: HealthState): number {
  return HEALTH_STATES.indexOf(state)
}

/**
 * Check if dwell time constraint is satisfied for state upgrade
 * Returns { allowed: boolean, hoursRemaining: number }
 */
export function checkDwellTime(
  currentState: HealthState,
  stateEnteredAt: Date,
  config: HealthConfig = healthConfig
): { allowed: boolean; hoursRemaining: number } {
  const now = new Date()
  const hoursInState = (now.getTime() - stateEnteredAt.getTime()) / (1000 * 60 * 60)

  // Only POOR and CRITICAL have dwell time requirements for upgrades
  if (currentState === "CRITICAL") {
    const required = config.minDwellHoursCritical
    if (hoursInState < required) {
      return { allowed: false, hoursRemaining: required - hoursInState }
    }
  } else if (currentState === "POOR") {
    const required = config.minDwellHoursPoor
    if (hoursInState < required) {
      return { allowed: false, hoursRemaining: required - hoursInState }
    }
  }

  return { allowed: true, hoursRemaining: 0 }
}

/**
 * Compute allowed state transition with stepwise and dwell time constraints
 * Returns the target state (may be same as current if blocked)
 */
export function computeAllowedStateTransition(
  currentState: HealthState,
  targetState: HealthState,
  stateEnteredAt: Date,
  config: HealthConfig = healthConfig
): {
  allowedState: HealthState
  blocked: boolean
  reason: DecisionReason | null
  details: DecisionDetails | null
} {
  const currentIndex = getHealthStateIndex(currentState)
  const targetIndex = getHealthStateIndex(targetState)

  // If target is same as current, no change needed
  if (currentIndex === targetIndex) {
    return { allowedState: currentState, blocked: false, reason: null, details: null }
  }

  // Downgrade: Always allowed (no constraints on getting worse)
  if (targetIndex > currentIndex) {
    return {
      allowedState: targetState,
      blocked: false,
      reason: "HEALTH_DOWNGRADE",
      details: {
        triggeredBy: "health_score_decrease",
        previousValue: currentIndex,
        metricValue: targetIndex,
      },
    }
  }

  // Upgrade: Apply stepwise constraint (can only go up one level at a time)
  const stepwiseTarget = HEALTH_STATES[currentIndex - 1] // One level better

  // Check dwell time for POOR/CRITICAL upgrades
  const dwellCheck = checkDwellTime(currentState, stateEnteredAt, config)
  if (!dwellCheck.allowed) {
    return {
      allowedState: currentState,
      blocked: true,
      reason: "DWELL_TIME_BLOCKED",
      details: {
        triggeredBy: "dwell_time_constraint",
        metricValue: dwellCheck.hoursRemaining,
        threshold:
          currentState === "CRITICAL" ? config.minDwellHoursCritical : config.minDwellHoursPoor,
        dwellHoursRemaining: dwellCheck.hoursRemaining,
      },
    }
  }

  // Stepwise constraint: If target is more than one level better, cap at one level
  if (targetIndex < currentIndex - 1) {
    return {
      allowedState: stepwiseTarget,
      blocked: true,
      reason: "STEPWISE_BLOCKED",
      details: {
        triggeredBy: "stepwise_constraint",
        previousValue: currentIndex,
        metricValue: targetIndex,
        threshold: currentIndex - 1,
      },
    }
  }

  // Normal upgrade (one level)
  return {
    allowedState: stepwiseTarget,
    blocked: false,
    reason: "HEALTH_UPGRADE",
    details: {
      triggeredBy: "health_score_increase",
      previousValue: currentIndex,
      metricValue: targetIndex,
    },
  }
}

/**
 * Check if source is eligible for starvation allowance
 */
export function checkStarvationAllowanceEligibility(
  healthState: HealthState,
  lastAllowanceAt: Date | null,
  allowanceCount: number,
  windowStartAt: Date,
  config: HealthConfig = healthConfig
): { eligible: boolean; reason: string } {
  // Only POOR and CRITICAL sources need starvation allowance
  if (healthState !== "POOR" && healthState !== "CRITICAL") {
    return { eligible: false, reason: "Source health state does not require starvation allowance" }
  }

  // Check max allowances per window
  if (allowanceCount >= config.starvationAllowanceMaxPerWindow) {
    return {
      eligible: false,
      reason: `Max allowances (${config.starvationAllowanceMaxPerWindow}) reached in current window`,
    }
  }

  // Check interval since last allowance
  if (lastAllowanceAt) {
    const hoursSinceLastAllowance = (Date.now() - lastAllowanceAt.getTime()) / (1000 * 60 * 60)
    if (hoursSinceLastAllowance < config.starvationAllowanceIntervalHours) {
      return {
        eligible: false,
        reason: `Minimum interval (${config.starvationAllowanceIntervalHours}h) not reached. Hours since last: ${hoursSinceLastAllowance.toFixed(1)}`,
      }
    }
  }

  return { eligible: true, reason: "Eligible for starvation allowance" }
}

/**
 * Get health data for a source (with caching)
 */
export async function getSourceHealth(sourceSlug: string): Promise<SourceHealthData> {
  // Check cache
  const cached = healthCache.get(sourceSlug)
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.data
  }

  // Fetch from DB
  let health = await db.sourceHealth.findUnique({
    where: { sourceSlug },
  })

  // Create default if not exists
  if (!health) {
    health = await db.sourceHealth.create({
      data: {
        sourceSlug,
        healthScore: 0.5, // Neutral starting score
        healthState: "FAIR", // Default state
        healthStateEnteredAt: new Date(),
        windowSizeHours: healthConfig.windowSizeHours,
      },
    })
  }

  // Check if window needs reset
  const windowEnd = new Date(
    health.windowStartAt.getTime() + health.windowSizeHours * 60 * 60 * 1000
  )
  if (new Date() > windowEnd) {
    // Reset window - also reset starvation allowance count
    health = await db.sourceHealth.update({
      where: { sourceSlug },
      data: {
        windowStartAt: new Date(),
        totalAttempts: 0,
        successCount: 0,
        emptyCount: 0,
        errorCount: 0,
        totalTokensUsed: 0,
        totalItemsProduced: 0,
        starvationAllowanceCount: 0, // Reset per-window count
        lastDecisionReason: "WINDOW_RESET",
        lastDecisionAt: new Date(),
        lastDecisionDetails: { triggeredBy: "window_expiry" },
      },
    })
    console.log(`[source-health] Window reset for source: ${sourceSlug}`)
  }

  // Check auto-unpause
  if (health.isPaused && health.pauseExpiresAt && new Date() > health.pauseExpiresAt) {
    health = await db.sourceHealth.update({
      where: { sourceSlug },
      data: {
        isPaused: false,
        pausedAt: null,
        pauseReason: null,
        pauseExpiresAt: null,
        lastDecisionReason: "AUTO_UNPAUSE",
        lastDecisionAt: new Date(),
        lastDecisionDetails: { triggeredBy: "pause_expiry" },
      },
    })
    console.log(`[source-health] Auto-unpaused source: ${sourceSlug}`)
  }

  // Calculate rates
  const totalAttempts = health.totalAttempts || 1
  const successRate = health.successCount / totalAttempts
  const emptyRate = health.emptyCount / totalAttempts
  const errorRate = health.errorCount / totalAttempts

  // Check starvation allowance eligibility
  const starvationEligibility = checkStarvationAllowanceEligibility(
    health.healthState as HealthState,
    health.lastStarvationAllowanceAt,
    health.starvationAllowanceCount,
    health.windowStartAt,
    healthConfig
  )

  const data: SourceHealthData = {
    sourceSlug: health.sourceSlug,
    healthScore: health.healthScore,
    healthState: health.healthState as HealthState,
    healthStateEnteredAt: health.healthStateEnteredAt,
    isPaused: health.isPaused,
    pauseReason: health.pauseReason,
    minScoutScore: health.minScoutScore,
    allowCloud: health.allowCloud,
    budgetMultiplier: health.budgetMultiplier,
    successRate,
    emptyRate,
    errorRate,
    avgTokensPerItem: health.avgTokensPerItem,
    // Starvation guard
    lastStarvationAllowanceAt: health.lastStarvationAllowanceAt,
    starvationAllowanceCount: health.starvationAllowanceCount,
    canReceiveStarvationAllowance: starvationEligibility.eligible,
  }

  // Update cache
  healthCache.set(sourceSlug, { data, cachedAt: Date.now() })

  return data
}

/**
 * Record an outcome and update health metrics
 * Applies stability constraints (dwell time, stepwise transitions) and records decision reasons
 */
export async function recordOutcome(record: OutcomeRecord): Promise<void> {
  const { sourceSlug, tokensUsed, itemsProduced, outcome } = record

  // Get current health (creates if not exists)
  const health = await db.sourceHealth.findUnique({
    where: { sourceSlug },
  })

  if (!health) {
    // Create new record with this outcome
    const thresholds = computeAdaptiveThresholds(0.5)
    await db.sourceHealth.create({
      data: {
        sourceSlug,
        totalAttempts: 1,
        successCount: outcome === "SUCCESS" ? 1 : 0,
        emptyCount: outcome === "EMPTY" ? 1 : 0,
        errorCount: outcome === "ERROR" ? 1 : 0,
        totalTokensUsed: tokensUsed,
        totalItemsProduced: itemsProduced,
        avgTokensPerItem: itemsProduced > 0 ? tokensUsed / itemsProduced : 0,
        healthScore: 0.5,
        healthState: "FAIR",
        healthStateEnteredAt: new Date(),
        ...thresholds,
      },
    })
    return
  }

  // Incremental update
  const newTotalAttempts = health.totalAttempts + 1
  const newSuccessCount = health.successCount + (outcome === "SUCCESS" ? 1 : 0)
  const newEmptyCount = health.emptyCount + (outcome === "EMPTY" ? 1 : 0)
  const newErrorCount = health.errorCount + (outcome === "ERROR" ? 1 : 0)
  const newTotalTokens = health.totalTokensUsed + tokensUsed
  const newTotalItems = health.totalItemsProduced + itemsProduced

  // Compute new health score
  const newHealthScore = computeHealthScore(
    newSuccessCount,
    newEmptyCount,
    newErrorCount,
    newTotalTokens,
    newTotalItems
  )

  // Compute target state based on new score
  const targetState = getHealthStateFromScore(newHealthScore)
  const currentState = health.healthState as HealthState

  // Apply stability constraints (dwell time + stepwise)
  const transition = computeAllowedStateTransition(
    currentState,
    targetState,
    health.healthStateEnteredAt,
    healthConfig
  )

  // Compute thresholds based on the actual allowed state (not raw target)
  const effectiveScore =
    transition.allowedState === currentState
      ? health.healthScore // Keep old score if state didn't change
      : newHealthScore
  const thresholds = computeAdaptiveThresholds(effectiveScore)

  // Check if should auto-pause
  const shouldPause =
    newHealthScore < HEALTH_THRESHOLDS.CRITICAL &&
    newTotalAttempts >= healthConfig.minAttemptsForScore

  // Determine state change data
  const stateChanged = transition.allowedState !== currentState
  const stateChangeData = stateChanged
    ? {
        healthState: transition.allowedState,
        healthStateEnteredAt: new Date(),
        previousHealthState: currentState,
      }
    : {}

  // Determine decision reason
  let decisionReason: DecisionReason | null = null
  let decisionDetails: DecisionDetails | null = null

  if (transition.reason) {
    decisionReason = transition.reason
    decisionDetails = transition.details
  } else if (shouldPause && !health.isPaused) {
    decisionReason = "AUTO_PAUSE"
    decisionDetails = {
      triggeredBy: "health_score_critical",
      metricValue: newHealthScore,
      threshold: HEALTH_THRESHOLDS.CRITICAL,
    }
  }

  await db.sourceHealth.update({
    where: { sourceSlug },
    data: {
      totalAttempts: newTotalAttempts,
      successCount: newSuccessCount,
      emptyCount: newEmptyCount,
      errorCount: newErrorCount,
      totalTokensUsed: newTotalTokens,
      totalItemsProduced: newTotalItems,
      avgTokensPerItem: newTotalItems > 0 ? newTotalTokens / newTotalItems : 0,
      healthScore: newHealthScore,
      lastBatchAt: new Date(),
      ...thresholds,
      ...stateChangeData,
      // Record decision if there was one
      ...(decisionReason
        ? {
            lastDecisionReason: decisionReason,
            lastDecisionAt: new Date(),
            lastDecisionDetails: decisionDetails as object | undefined,
          }
        : {}),
      // Auto-pause if critical
      ...(shouldPause && !health.isPaused
        ? {
            isPaused: true,
            pausedAt: new Date(),
            pauseReason: "LOW_HEALTH",
            pauseExpiresAt: new Date(Date.now() + healthConfig.autoUnpauseHours * 60 * 60 * 1000),
          }
        : {}),
    },
  })

  // Invalidate cache
  healthCache.delete(sourceSlug)

  // Logging
  if (stateChanged) {
    console.log(
      `[source-health] Source ${sourceSlug} state transition: ${currentState} -> ${transition.allowedState} (reason=${transition.reason})`
    )
  }

  if (transition.blocked) {
    console.log(
      `[source-health] Source ${sourceSlug} upgrade blocked: ${transition.reason} (target was ${targetState})`
    )
  }

  if (shouldPause && !health.isPaused) {
    console.warn(
      `[source-health] Source ${sourceSlug} auto-paused: healthScore=${newHealthScore.toFixed(3)} < ${HEALTH_THRESHOLDS.CRITICAL}`
    )
  }
}

/**
 * Batch update health metrics from PipelineProgress data
 * Call this periodically (e.g., every hour) to sync with telemetry
 */
export async function syncHealthFromProgress(since?: Date): Promise<number> {
  const windowStart = since || new Date(Date.now() - healthConfig.windowSizeHours * 60 * 60 * 1000)

  // Aggregate outcomes from PipelineProgress for extract stage
  const stats = await db.pipelineProgress.groupBy({
    by: ["sourceSlug"],
    where: {
      timestamp: { gte: windowStart },
      stageName: { in: ["extract", "compose"] }, // LLM-using stages
    },
    _count: { id: true },
    _sum: {
      tokensUsed: true,
      producedCount: true,
    },
  })

  // Get error counts
  const errorStats = await db.pipelineProgress.groupBy({
    by: ["sourceSlug"],
    where: {
      timestamp: { gte: windowStart },
      stageName: { in: ["extract", "compose"] },
      errorClass: { not: null },
    },
    _count: { id: true },
  })

  // Get empty counts (tokens used but nothing produced)
  const emptyStats = await db.pipelineProgress.groupBy({
    by: ["sourceSlug"],
    where: {
      timestamp: { gte: windowStart },
      stageName: { in: ["extract", "compose"] },
      tokensUsed: { gt: 0 },
      producedCount: 0,
      errorClass: null,
    },
    _count: { id: true },
  })

  const errorMap = new Map(errorStats.map((e) => [e.sourceSlug, e._count.id]))
  const emptyMap = new Map(emptyStats.map((e) => [e.sourceSlug, e._count.id]))

  let updatedCount = 0

  for (const stat of stats) {
    const sourceSlug = stat.sourceSlug
    const totalAttempts = stat._count.id
    const errorCount = errorMap.get(sourceSlug) || 0
    const emptyCount = emptyMap.get(sourceSlug) || 0
    const successCount = Math.max(0, totalAttempts - errorCount - emptyCount)
    const totalTokens = stat._sum.tokensUsed || 0
    const totalItems = stat._sum.producedCount || 0

    // Compute health score
    const healthScore = computeHealthScore(
      successCount,
      emptyCount,
      errorCount,
      totalTokens,
      totalItems
    )

    // Compute adaptive thresholds
    const thresholds = computeAdaptiveThresholds(healthScore)

    // Check if should auto-pause
    const shouldPause =
      healthScore < HEALTH_THRESHOLDS.CRITICAL && totalAttempts >= healthConfig.minAttemptsForScore

    // Upsert health record
    await db.sourceHealth.upsert({
      where: { sourceSlug },
      create: {
        sourceSlug,
        windowStartAt: windowStart,
        windowSizeHours: healthConfig.windowSizeHours,
        totalAttempts,
        successCount,
        emptyCount,
        errorCount,
        totalTokensUsed: totalTokens,
        totalItemsProduced: totalItems,
        avgTokensPerItem: totalItems > 0 ? totalTokens / totalItems : 0,
        healthScore,
        lastBatchAt: new Date(),
        ...thresholds,
        ...(shouldPause
          ? {
              isPaused: true,
              pausedAt: new Date(),
              pauseReason: "LOW_HEALTH",
              pauseExpiresAt: new Date(Date.now() + healthConfig.autoUnpauseHours * 60 * 60 * 1000),
            }
          : {}),
      },
      update: {
        windowStartAt: windowStart,
        totalAttempts,
        successCount,
        emptyCount,
        errorCount,
        totalTokensUsed: totalTokens,
        totalItemsProduced: totalItems,
        avgTokensPerItem: totalItems > 0 ? totalTokens / totalItems : 0,
        healthScore,
        lastBatchAt: new Date(),
        ...thresholds,
        ...(shouldPause
          ? {
              isPaused: true,
              pausedAt: new Date(),
              pauseReason: "LOW_HEALTH",
              pauseExpiresAt: new Date(Date.now() + healthConfig.autoUnpauseHours * 60 * 60 * 1000),
            }
          : {}),
      },
    })

    // Invalidate cache
    healthCache.delete(sourceSlug)
    updatedCount++
  }

  console.log(`[source-health] Synced ${updatedCount} sources from PipelineProgress`)
  return updatedCount
}

/**
 * Manually pause a source
 */
export async function pauseSource(
  sourceSlug: string,
  reason: string,
  durationHours?: number
): Promise<void> {
  const expiresAt = durationHours ? new Date(Date.now() + durationHours * 60 * 60 * 1000) : null
  const now = new Date()

  await db.sourceHealth.upsert({
    where: { sourceSlug },
    create: {
      sourceSlug,
      isPaused: true,
      pausedAt: now,
      pauseReason: reason,
      pauseExpiresAt: expiresAt,
      lastDecisionReason: "MANUAL_PAUSE",
      lastDecisionAt: now,
      lastDecisionDetails: {
        triggeredBy: "manual_pause",
        metricValue: durationHours ?? null,
      },
    },
    update: {
      isPaused: true,
      pausedAt: now,
      pauseReason: reason,
      pauseExpiresAt: expiresAt,
      lastDecisionReason: "MANUAL_PAUSE",
      lastDecisionAt: now,
      lastDecisionDetails: {
        triggeredBy: "manual_pause",
        metricValue: durationHours ?? null,
      },
    },
  })

  healthCache.delete(sourceSlug)
  console.log(`[source-health] Paused source: ${sourceSlug} (reason=${reason})`)
}

/**
 * Manually unpause a source
 */
export async function unpauseSource(sourceSlug: string): Promise<void> {
  const now = new Date()

  await db.sourceHealth.update({
    where: { sourceSlug },
    data: {
      isPaused: false,
      pausedAt: null,
      pauseReason: null,
      pauseExpiresAt: null,
      lastDecisionReason: "MANUAL_UNPAUSE",
      lastDecisionAt: now,
      lastDecisionDetails: {
        triggeredBy: "manual_unpause",
      },
    },
  })

  healthCache.delete(sourceSlug)
  console.log(`[source-health] Unpaused source: ${sourceSlug}`)
}

/**
 * Get all source health data for monitoring
 */
export async function getAllSourceHealth(): Promise<SourceHealthData[]> {
  const records = await db.sourceHealth.findMany({
    orderBy: { healthScore: "desc" },
  })

  return records.map((h) => {
    const starvationEligibility = checkStarvationAllowanceEligibility(
      h.healthState as HealthState,
      h.lastStarvationAllowanceAt,
      h.starvationAllowanceCount,
      h.windowStartAt,
      healthConfig
    )

    return {
      sourceSlug: h.sourceSlug,
      healthScore: h.healthScore,
      healthState: h.healthState as HealthState,
      healthStateEnteredAt: h.healthStateEnteredAt,
      isPaused: h.isPaused,
      pauseReason: h.pauseReason,
      minScoutScore: h.minScoutScore,
      allowCloud: h.allowCloud,
      budgetMultiplier: h.budgetMultiplier,
      successRate: h.totalAttempts > 0 ? h.successCount / h.totalAttempts : 0,
      emptyRate: h.totalAttempts > 0 ? h.emptyCount / h.totalAttempts : 0,
      errorRate: h.totalAttempts > 0 ? h.errorCount / h.totalAttempts : 0,
      avgTokensPerItem: h.avgTokensPerItem,
      lastStarvationAllowanceAt: h.lastStarvationAllowanceAt,
      starvationAllowanceCount: h.starvationAllowanceCount,
      canReceiveStarvationAllowance: starvationEligibility.eligible,
    }
  })
}

/**
 * Grant starvation allowance to a source
 * This allows a POOR/CRITICAL source to receive a minimal evaluation budget
 * Returns true if allowance was granted, false if not eligible
 */
export async function grantStarvationAllowance(sourceSlug: string): Promise<{
  granted: boolean
  reason: string
}> {
  const health = await db.sourceHealth.findUnique({
    where: { sourceSlug },
  })

  if (!health) {
    return { granted: false, reason: "Source not found" }
  }

  const eligibility = checkStarvationAllowanceEligibility(
    health.healthState as HealthState,
    health.lastStarvationAllowanceAt,
    health.starvationAllowanceCount,
    health.windowStartAt,
    healthConfig
  )

  if (!eligibility.eligible) {
    return { granted: false, reason: eligibility.reason }
  }

  // Grant the allowance
  await db.sourceHealth.update({
    where: { sourceSlug },
    data: {
      lastStarvationAllowanceAt: new Date(),
      starvationAllowanceCount: health.starvationAllowanceCount + 1,
      lastDecisionReason: "STARVATION_ALLOWANCE",
      lastDecisionAt: new Date(),
      lastDecisionDetails: {
        triggeredBy: "starvation_guard",
        metricValue: health.starvationAllowanceCount + 1,
        threshold: healthConfig.starvationAllowanceMaxPerWindow,
      },
    },
  })

  // Invalidate cache
  healthCache.delete(sourceSlug)

  console.log(
    `[source-health] Starvation allowance granted to ${sourceSlug} (count=${health.starvationAllowanceCount + 1})`
  )

  return { granted: true, reason: "Starvation allowance granted" }
}

/**
 * Clear health cache (for testing)
 */
export function _clearCache(): void {
  healthCache.clear()
}

/**
 * Reset for testing
 */
export function _resetForTesting(): void {
  healthCache.clear()
  healthConfig = { ...DEFAULT_HEALTH_CONFIG }
}
