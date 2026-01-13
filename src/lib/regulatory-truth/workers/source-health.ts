// src/lib/regulatory-truth/workers/source-health.ts
//
// Source Health: Self-correcting feedback loop for RTL pipeline
// Computes rolling health scores and adapts routing/budget decisions automatically.
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

// Health configuration
export interface HealthConfig {
  windowSizeHours: number // Rolling window size (default: 168 = 7 days)
  minAttemptsForScore: number // Min attempts before health score is meaningful
  autoUnpauseHours: number // Hours before auto-unpause
  successWeight: number // Weight for success rate in score
  efficiencyWeight: number // Weight for token efficiency in score
  emptyPenalty: number // Penalty for empty outputs
  errorPenalty: number // Penalty for errors
}

const DEFAULT_HEALTH_CONFIG: HealthConfig = {
  windowSizeHours: 168, // 7 days
  minAttemptsForScore: 10, // Need 10 attempts before reliable score
  autoUnpauseHours: 24, // Auto-unpause after 24 hours
  successWeight: 0.5, // 50% weight for success rate
  efficiencyWeight: 0.3, // 30% weight for token efficiency
  emptyPenalty: 0.1, // 10% penalty per 10% empty rate
  errorPenalty: 0.2, // 20% penalty per 10% error rate
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
  isPaused: boolean
  pauseReason: string | null
  minScoutScore: number
  allowCloud: boolean
  budgetMultiplier: number
  successRate: number
  emptyRate: number
  errorRate: number
  avgTokensPerItem: number
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
        windowSizeHours: healthConfig.windowSizeHours,
      },
    })
  }

  // Check if window needs reset
  const windowEnd = new Date(
    health.windowStartAt.getTime() + health.windowSizeHours * 60 * 60 * 1000
  )
  if (new Date() > windowEnd) {
    // Reset window
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
      },
    })
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
      },
    })
    console.log(`[source-health] Auto-unpaused source: ${sourceSlug}`)
  }

  // Calculate rates
  const totalAttempts = health.totalAttempts || 1
  const successRate = health.successCount / totalAttempts
  const emptyRate = health.emptyCount / totalAttempts
  const errorRate = health.errorCount / totalAttempts

  const data: SourceHealthData = {
    sourceSlug: health.sourceSlug,
    healthScore: health.healthScore,
    isPaused: health.isPaused,
    pauseReason: health.pauseReason,
    minScoutScore: health.minScoutScore,
    allowCloud: health.allowCloud,
    budgetMultiplier: health.budgetMultiplier,
    successRate,
    emptyRate,
    errorRate,
    avgTokensPerItem: health.avgTokensPerItem,
  }

  // Update cache
  healthCache.set(sourceSlug, { data, cachedAt: Date.now() })

  return data
}

/**
 * Record an outcome and update health metrics
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

  // Compute new thresholds
  const thresholds = computeAdaptiveThresholds(newHealthScore)

  // Check if should auto-pause
  const shouldPause =
    newHealthScore < HEALTH_THRESHOLDS.CRITICAL &&
    newTotalAttempts >= healthConfig.minAttemptsForScore

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

  await db.sourceHealth.upsert({
    where: { sourceSlug },
    create: {
      sourceSlug,
      isPaused: true,
      pausedAt: new Date(),
      pauseReason: reason,
      pauseExpiresAt: expiresAt,
    },
    update: {
      isPaused: true,
      pausedAt: new Date(),
      pauseReason: reason,
      pauseExpiresAt: expiresAt,
    },
  })

  healthCache.delete(sourceSlug)
  console.log(`[source-health] Paused source: ${sourceSlug} (reason=${reason})`)
}

/**
 * Manually unpause a source
 */
export async function unpauseSource(sourceSlug: string): Promise<void> {
  await db.sourceHealth.update({
    where: { sourceSlug },
    data: {
      isPaused: false,
      pausedAt: null,
      pauseReason: null,
      pauseExpiresAt: null,
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

  return records.map((h) => ({
    sourceSlug: h.sourceSlug,
    healthScore: h.healthScore,
    isPaused: h.isPaused,
    pauseReason: h.pauseReason,
    minScoutScore: h.minScoutScore,
    allowCloud: h.allowCloud,
    budgetMultiplier: h.budgetMultiplier,
    successRate: h.totalAttempts > 0 ? h.successCount / h.totalAttempts : 0,
    emptyRate: h.totalAttempts > 0 ? h.emptyCount / h.totalAttempts : 0,
    errorRate: h.totalAttempts > 0 ? h.errorCount / h.totalAttempts : 0,
    avgTokensPerItem: h.avgTokensPerItem,
  }))
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
