// src/lib/regulatory-truth/workers/progress-tracker.ts
//
// Progress Tracker: Structured observability for pipeline stages
// Records every stage execution for "Did we spend tokens and get persisted value?"
//

import { db } from "@/lib/db"
import { recordOutcome, type OutcomeRecord } from "./source-health"

// Pipeline stage names
export type StageName =
  | "scout"
  | "router"
  | "ocr"
  | "extract"
  | "compose"
  | "apply"
  | "review"
  | "arbiter"
  | "release"

// Error classification for retry decisions
export type ErrorClass =
  | "TRANSIENT" // Network timeout, rate limit - retry
  | "VALIDATION" // Schema/format error - no retry
  | "AUTH" // Authentication error - circuit open
  | "QUOTA" // Quota exceeded - circuit open
  | "CONTENT" // Bad content - skip source
  | "INTERNAL" // Bug - needs investigation

// Progress event for observability
export interface ProgressEvent {
  stageName: StageName
  evidenceId?: string
  sourceSlug: string
  runId: string
  timestamp: Date
  producedCount: number // Items created by this stage
  downstreamQueuedCount: number // Jobs queued to next stage
  tokensUsed?: number // LLM tokens consumed
  durationMs?: number // Processing time
  skipReason?: string // Why skipped (if applicable)
  errorClass?: string // Error classification
  errorMessage?: string // Error details
  metadata?: Record<string, unknown> // Stage-specific data
}

// Aggregated stats for monitoring
export interface StageStats {
  stageName: StageName
  totalRuns: number
  successCount: number
  skipCount: number
  errorCount: number
  totalTokensUsed: number
  totalItemsProduced: number
  avgDurationMs: number
  lastRunAt: Date | null
}

// Source health tracking (legacy interface for backwards compatibility)
// For adaptive health scoring, use SourceHealthData from ./source-health
export interface ProgressSourceHealth {
  sourceSlug: string
  totalEvidence: number
  processedCount: number
  skippedCount: number
  errorCount: number
  totalTokensUsed: number
  totalRulesProduced: number
  tokenEfficiency: number // rules per 1000 tokens
  lastProcessedAt: Date | null
  status: "HEALTHY" | "DEGRADED" | "UNHEALTHY"
}

// Stages that use LLM tokens (for health tracking)
const LLM_USING_STAGES: StageName[] = ["extract", "compose"]

// In-memory buffer for batched writes
const eventBuffer: ProgressEvent[] = []
const BUFFER_FLUSH_INTERVAL = 5000 // 5 seconds
const BUFFER_MAX_SIZE = 100

let flushTimeout: NodeJS.Timeout | null = null

/**
 * Record a progress event
 * Events are buffered and written in batches for performance
 */
export async function recordProgressEvent(event: ProgressEvent): Promise<void> {
  eventBuffer.push(event)

  // Log immediately for debugging
  const logLevel = event.errorClass ? "error" : event.skipReason ? "warn" : "info"
  const message = `[progress] ${event.stageName} | ${event.sourceSlug} | produced=${event.producedCount} queued=${event.downstreamQueuedCount}${event.tokensUsed ? ` tokens=${event.tokensUsed}` : ""}${event.skipReason ? ` skip="${event.skipReason}"` : ""}${event.errorClass ? ` error=${event.errorClass}` : ""}`

  if (logLevel === "error") {
    console.error(message)
  } else if (logLevel === "warn") {
    console.warn(message)
  } else {
    console.log(message)
  }

  // Flush if buffer is full
  if (eventBuffer.length >= BUFFER_MAX_SIZE) {
    await flushEventBuffer()
  } else if (!flushTimeout) {
    // Schedule flush
    flushTimeout = setTimeout(() => void flushEventBuffer(), BUFFER_FLUSH_INTERVAL)
  }
}

/**
 * Derive health outcome from a progress event
 */
function deriveOutcome(event: ProgressEvent): OutcomeRecord["outcome"] {
  if (event.errorClass) {
    return "ERROR"
  }
  if (event.tokensUsed && event.tokensUsed > 0 && event.producedCount === 0) {
    return "EMPTY"
  }
  return "SUCCESS"
}

/**
 * Update source health from LLM-using events
 */
async function updateSourceHealth(events: ProgressEvent[]): Promise<void> {
  // Filter to LLM-using stages only
  const llmEvents = events.filter(
    (e) => LLM_USING_STAGES.includes(e.stageName) && e.tokensUsed !== undefined
  )

  if (llmEvents.length === 0) {
    return
  }

  // Group by source and aggregate
  const bySource = new Map<string, OutcomeRecord[]>()
  for (const event of llmEvents) {
    const records = bySource.get(event.sourceSlug) || []
    records.push({
      sourceSlug: event.sourceSlug,
      tokensUsed: event.tokensUsed || 0,
      itemsProduced: event.producedCount,
      outcome: deriveOutcome(event),
    })
    bySource.set(event.sourceSlug, records)
  }

  // Record outcomes for each source
  for (const [sourceSlug, records] of bySource) {
    for (const record of records) {
      try {
        await recordOutcome(record)
      } catch (error) {
        // Log but don't fail - health tracking is observability
        console.error(`[progress] Failed to record outcome for ${sourceSlug}:`, error)
      }
    }
  }
}

/**
 * Flush buffered events to database
 */
async function flushEventBuffer(): Promise<void> {
  if (flushTimeout) {
    clearTimeout(flushTimeout)
    flushTimeout = null
  }

  if (eventBuffer.length === 0) {
    return
  }

  const eventsToWrite = [...eventBuffer]
  eventBuffer.length = 0

  try {
    // Write to PipelineProgress table
    await db.pipelineProgress.createMany({
      data: eventsToWrite.map((e) => ({
        stageName: e.stageName,
        evidenceId: e.evidenceId,
        sourceSlug: e.sourceSlug,
        runId: e.runId,
        timestamp: e.timestamp,
        producedCount: e.producedCount,
        downstreamQueuedCount: e.downstreamQueuedCount,
        tokensUsed: e.tokensUsed,
        durationMs: e.durationMs,
        skipReason: e.skipReason,
        errorClass: e.errorClass,
        errorMessage: e.errorMessage,
        metadata: e.metadata as object | undefined,
      })),
      skipDuplicates: true,
    })

    // Update source health from LLM-using events (non-blocking)
    void updateSourceHealth(eventsToWrite)
  } catch (error) {
    // Log but don't fail - progress tracking is observability, not critical path
    console.error("[progress] Failed to flush event buffer:", error)
    // Put events back for retry
    eventBuffer.unshift(...eventsToWrite)
  }
}

/**
 * Get stage stats for monitoring dashboard
 */
export async function getStageStats(
  since: Date = new Date(Date.now() - 24 * 60 * 60 * 1000)
): Promise<StageStats[]> {
  const stats = await db.pipelineProgress.groupBy({
    by: ["stageName"],
    where: {
      timestamp: { gte: since },
    },
    _count: { id: true },
    _sum: {
      tokensUsed: true,
      producedCount: true,
      durationMs: true,
    },
    _max: { timestamp: true },
  })

  // Get skip and error counts
  const skipCounts = await db.pipelineProgress.groupBy({
    by: ["stageName"],
    where: {
      timestamp: { gte: since },
      skipReason: { not: null },
    },
    _count: { id: true },
  })

  const errorCounts = await db.pipelineProgress.groupBy({
    by: ["stageName"],
    where: {
      timestamp: { gte: since },
      errorClass: { not: null },
    },
    _count: { id: true },
  })

  const skipMap = new Map(skipCounts.map((s) => [s.stageName, s._count.id]))
  const errorMap = new Map(errorCounts.map((e) => [e.stageName, e._count.id]))

  return stats.map((s) => ({
    stageName: s.stageName as StageName,
    totalRuns: s._count.id,
    successCount: s._count.id - (skipMap.get(s.stageName) || 0) - (errorMap.get(s.stageName) || 0),
    skipCount: skipMap.get(s.stageName) || 0,
    errorCount: errorMap.get(s.stageName) || 0,
    totalTokensUsed: s._sum.tokensUsed || 0,
    totalItemsProduced: s._sum.producedCount || 0,
    avgDurationMs: s._count.id > 0 ? (s._sum.durationMs || 0) / s._count.id : 0,
    lastRunAt: s._max.timestamp,
  }))
}

/**
 * Get source health metrics from progress data (legacy function)
 * For adaptive health scoring, use getSourceHealth from ./source-health
 */
export async function getProgressSourceHealth(
  since: Date = new Date(Date.now() - 24 * 60 * 60 * 1000)
): Promise<ProgressSourceHealth[]> {
  // Get per-source stats
  const sourceStats = await db.pipelineProgress.groupBy({
    by: ["sourceSlug"],
    where: {
      timestamp: { gte: since },
    },
    _count: { id: true },
    _sum: {
      tokensUsed: true,
      producedCount: true,
    },
    _max: { timestamp: true },
  })

  // Get skip counts per source
  const skipCounts = await db.pipelineProgress.groupBy({
    by: ["sourceSlug"],
    where: {
      timestamp: { gte: since },
      skipReason: { not: null },
    },
    _count: { id: true },
  })

  // Get error counts per source
  const errorCounts = await db.pipelineProgress.groupBy({
    by: ["sourceSlug"],
    where: {
      timestamp: { gte: since },
      errorClass: { not: null },
    },
    _count: { id: true },
  })

  // Get rules produced per source (from apply stage)
  const rulesProduced = await db.pipelineProgress.groupBy({
    by: ["sourceSlug"],
    where: {
      timestamp: { gte: since },
      stageName: "apply",
      producedCount: { gt: 0 },
    },
    _sum: { producedCount: true },
  })

  const skipMap = new Map(skipCounts.map((s) => [s.sourceSlug, s._count.id]))
  const errorMap = new Map(errorCounts.map((e) => [e.sourceSlug, e._count.id]))
  const rulesMap = new Map(rulesProduced.map((r) => [r.sourceSlug, r._sum.producedCount || 0]))

  return sourceStats.map((s) => {
    const totalTokens = s._sum.tokensUsed || 0
    const totalRules = rulesMap.get(s.sourceSlug) || 0
    const errorCount = errorMap.get(s.sourceSlug) || 0
    const skipCount = skipMap.get(s.sourceSlug) || 0

    // Calculate token efficiency (rules per 1000 tokens)
    const tokenEfficiency = totalTokens > 0 ? (totalRules / totalTokens) * 1000 : 0

    // Determine health status
    const errorRate = s._count.id > 0 ? errorCount / s._count.id : 0
    const skipRate = s._count.id > 0 ? skipCount / s._count.id : 0
    let status: "HEALTHY" | "DEGRADED" | "UNHEALTHY"

    if (errorRate > 0.3 || (totalTokens > 1000 && tokenEfficiency < 0.01)) {
      status = "UNHEALTHY"
    } else if (errorRate > 0.1 || skipRate > 0.5) {
      status = "DEGRADED"
    } else {
      status = "HEALTHY"
    }

    return {
      sourceSlug: s.sourceSlug,
      totalEvidence: s._count.id,
      processedCount: s._count.id - skipCount - errorCount,
      skippedCount: skipCount,
      errorCount,
      totalTokensUsed: totalTokens,
      totalRulesProduced: totalRules,
      tokenEfficiency,
      lastProcessedAt: s._max.timestamp,
      status,
    }
  })
}

/**
 * Get "tokens burned with itemsProduced = 0" metric
 */
export async function getTokenWaste(
  since: Date = new Date(Date.now() - 24 * 60 * 60 * 1000)
): Promise<{
  totalTokensUsed: number
  wastedTokens: number
  wastePercentage: number
  byStage: Record<string, { used: number; wasted: number }>
}> {
  // Get total tokens by stage
  const totalByStage = await db.pipelineProgress.groupBy({
    by: ["stageName"],
    where: {
      timestamp: { gte: since },
      tokensUsed: { gt: 0 },
    },
    _sum: { tokensUsed: true },
  })

  // Get wasted tokens (tokens used but nothing produced)
  const wastedByStage = await db.pipelineProgress.groupBy({
    by: ["stageName"],
    where: {
      timestamp: { gte: since },
      tokensUsed: { gt: 0 },
      producedCount: 0,
    },
    _sum: { tokensUsed: true },
  })

  const totalMap = new Map(totalByStage.map((t) => [t.stageName, t._sum.tokensUsed || 0]))
  const wastedMap = new Map(wastedByStage.map((w) => [w.stageName, w._sum.tokensUsed || 0]))

  let totalTokensUsed = 0
  let wastedTokens = 0
  const byStage: Record<string, { used: number; wasted: number }> = {}

  for (const [stage, used] of totalMap) {
    const wasted = wastedMap.get(stage) || 0
    totalTokensUsed += used
    wastedTokens += wasted
    byStage[stage] = { used, wasted }
  }

  return {
    totalTokensUsed,
    wastedTokens,
    wastePercentage: totalTokensUsed > 0 ? (wastedTokens / totalTokensUsed) * 100 : 0,
    byStage,
  }
}

/**
 * Classify error for retry decisions
 */
export function classifyError(error: Error): ErrorClass {
  const message = error.message.toLowerCase()
  const name = error.name.toLowerCase()

  // Auth errors - circuit open
  if (
    message.includes("401") ||
    message.includes("403") ||
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("authentication")
  ) {
    return "AUTH"
  }

  // Quota errors - circuit open
  if (
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("quota") ||
    message.includes("too many requests")
  ) {
    return "QUOTA"
  }

  // Transient errors - retry
  if (
    message.includes("timeout") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("network") ||
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504")
  ) {
    return "TRANSIENT"
  }

  // Validation errors - no retry
  if (
    message.includes("validation") ||
    message.includes("schema") ||
    message.includes("invalid") ||
    message.includes("parse") ||
    name.includes("zod")
  ) {
    return "VALIDATION"
  }

  // Content errors - skip source
  if (
    message.includes("empty") ||
    message.includes("no content") ||
    message.includes("blocked") ||
    message.includes("not found")
  ) {
    return "CONTENT"
  }

  // Default to internal - needs investigation
  return "INTERNAL"
}

/**
 * Determine if error should trigger retry
 */
export function shouldRetry(errorClass: ErrorClass): boolean {
  return errorClass === "TRANSIENT"
}

/**
 * Determine if error should open circuit
 */
export function shouldOpenCircuit(errorClass: ErrorClass): boolean {
  return errorClass === "AUTH" || errorClass === "QUOTA"
}

// Ensure buffer is flushed on shutdown
process.on("beforeExit", () => void flushEventBuffer())

// Re-export SourceHealth interface as alias for backwards compatibility
/** @deprecated Use ProgressSourceHealth instead */
export type SourceHealth = ProgressSourceHealth

// Re-export getSourceHealth as alias for backwards compatibility
/** @deprecated Use getProgressSourceHealth instead */
export const getSourceHealth = getProgressSourceHealth
