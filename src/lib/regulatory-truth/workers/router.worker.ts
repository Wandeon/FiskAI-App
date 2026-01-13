// src/lib/regulatory-truth/workers/router.worker.ts
//
// Router Worker: Decides pipeline path based on scout output + budget
// No LLM calls - pure routing logic based on scout results and budget state.
//

import { Job } from "bullmq"
import { createWorker, setupGracefulShutdown, type JobResult } from "./base"
import { extractQueue, ocrQueue } from "./queues"
import { jobsProcessed, jobDuration } from "./metrics"
import {
  checkBudgetWithHealth,
  openCircuit,
  type BudgetCheckResult,
  type LLMProvider,
} from "./budget-governor"
import { recordProgressEvent, classifyError, shouldOpenCircuit } from "./progress-tracker"
import { getSourceHealth, type SourceHealthData } from "./source-health"
import type { ScoutResult } from "./content-scout"
import { dbReg } from "@/lib/db"

// Routing decisions
export type RoutingDecision =
  | "SKIP" // Skip entirely, no value expected
  | "OCR" // Route to OCR worker first
  | "EXTRACT_LOCAL" // Extract using local Ollama
  | "EXTRACT_CLOUD" // Extract using cloud LLM (last resort)

// Router job input
export interface RouterJobData {
  evidenceId: string
  scoutResult: ScoutResult
  sourceSlug: string
  runId: string
  parentJobId?: string
}

// Router job output
export interface RouterJobResult extends JobResult {
  data?: {
    decision: RoutingDecision
    reason: string
    budgetCheck?: BudgetCheckResult
    recommendedProvider?: LLMProvider
    healthScore?: number
    minScoutScore?: number
  }
}

// Default routing thresholds (overridden by source health)
const DEFAULT_ROUTING_CONFIG = {
  worthItThreshold: 0.4, // Min score to proceed with extraction
  cloudThreshold: 0.7, // Min score for cloud LLM
  localPreferred: 0.5, // Score range where local is preferred
}

/**
 * Determine routing decision based on scout result, budget, and source health
 * Uses adaptive thresholds based on source health score
 */
function determineRouting(
  scoutResult: ScoutResult,
  budgetCheck: BudgetCheckResult,
  healthData?: SourceHealthData
): { decision: RoutingDecision; reason: string; minScoutScore: number } {
  // Use health-based threshold or default
  const minScoutScore = healthData?.minScoutScore ?? DEFAULT_ROUTING_CONFIG.worthItThreshold
  const cloudAllowed = budgetCheck.cloudAllowed ?? true
  const healthScore = healthData?.healthScore ?? 0.5

  // Check for explicit skip from scout
  if (scoutResult.skipReason) {
    return {
      decision: "SKIP",
      reason: scoutResult.skipReason,
      minScoutScore,
    }
  }

  // Check if score is below health-adjusted threshold
  if (scoutResult.worthItScore < minScoutScore) {
    return {
      decision: "SKIP",
      reason: `Low worth-it score: ${(scoutResult.worthItScore * 100).toFixed(1)}% < ${(minScoutScore * 100).toFixed(1)}% (health=${healthScore.toFixed(2)})`,
      minScoutScore,
    }
  }

  // Check if OCR is needed first
  if (scoutResult.needsOCR) {
    return {
      decision: "OCR",
      reason: "PDF requires OCR before extraction",
      minScoutScore,
    }
  }

  // Check budget constraints
  if (!budgetCheck.allowed) {
    return {
      decision: "SKIP",
      reason: `Budget denied: ${budgetCheck.denialReason}`,
      minScoutScore,
    }
  }

  // Determine extract type based on score, provider, and health
  if (budgetCheck.recommendedProvider === "LOCAL_OLLAMA") {
    return {
      decision: "EXTRACT_LOCAL",
      reason: `Local extraction (score=${(scoutResult.worthItScore * 100).toFixed(1)}%, health=${healthScore.toFixed(2)})`,
      minScoutScore,
    }
  }

  // Cloud extraction only for high-value content AND if health permits
  if (
    cloudAllowed &&
    scoutResult.worthItScore >= DEFAULT_ROUTING_CONFIG.cloudThreshold &&
    (budgetCheck.recommendedProvider === "CLOUD_OLLAMA" ||
      budgetCheck.recommendedProvider === "CLOUD_OPENAI")
  ) {
    return {
      decision: "EXTRACT_CLOUD",
      reason: `Cloud extraction (score=${(scoutResult.worthItScore * 100).toFixed(1)}%, health=${healthScore.toFixed(2)}, high-value)`,
      minScoutScore,
    }
  }

  // Cloud not allowed - use local (recommendedProvider is CLOUD_* at this point, but cloud is restricted)
  if (!cloudAllowed) {
    return {
      decision: "EXTRACT_LOCAL",
      reason: `Local extraction (score=${(scoutResult.worthItScore * 100).toFixed(1)}%, health=${healthScore.toFixed(2)}, cloud restricted)`,
      minScoutScore,
    }
  }

  // Default to local for medium-value content
  return {
    decision: "EXTRACT_LOCAL",
    reason: `Local extraction (score=${(scoutResult.worthItScore * 100).toFixed(1)}%, health=${healthScore.toFixed(2)})`,
    minScoutScore,
  }
}

async function processRouterJob(job: Job<RouterJobData>): Promise<RouterJobResult> {
  const start = Date.now()
  const { evidenceId, scoutResult, sourceSlug, runId } = job.data

  try {
    // Fetch health data and check budget with health-aware caps
    const healthData = await getSourceHealth(sourceSlug)
    const budgetCheck = await checkBudgetWithHealth(
      sourceSlug,
      evidenceId,
      scoutResult.estimatedTokens
    )

    // Determine routing with health-aware thresholds
    const { decision, reason, minScoutScore } = determineRouting(
      scoutResult,
      budgetCheck,
      healthData
    )

    // Record progress event with health metadata
    await recordProgressEvent({
      stageName: "router",
      evidenceId,
      sourceSlug,
      runId,
      timestamp: new Date(),
      producedCount: decision === "SKIP" ? 0 : 1,
      downstreamQueuedCount: decision === "SKIP" ? 0 : 1,
      skipReason: decision === "SKIP" ? reason : undefined,
      metadata: {
        decision,
        reason,
        worthItScore: scoutResult.worthItScore,
        budgetAllowed: budgetCheck.allowed,
        budgetDenialReason: budgetCheck.denialReason,
        recommendedProvider: budgetCheck.recommendedProvider,
        // Health-aware metadata
        healthScore: healthData.healthScore,
        minScoutScore,
        cloudAllowed: budgetCheck.cloudAllowed,
        adjustedSourceCap: budgetCheck.adjustedSourceCap,
        budgetMultiplier: healthData.budgetMultiplier,
        isPaused: healthData.isPaused,
      },
    })

    // Route to appropriate queue
    switch (decision) {
      case "OCR":
        await ocrQueue.add(
          "ocr",
          {
            evidenceId,
            runId,
            parentJobId: job.id,
          },
          { jobId: `ocr-${evidenceId}` }
        )
        console.log(`[router] Evidence ${evidenceId} → OCR (${reason})`)
        break

      case "EXTRACT_LOCAL":
        await extractQueue.add(
          "extract",
          {
            evidenceId,
            runId,
            parentJobId: job.id,
            llmProvider: "LOCAL_OLLAMA",
          },
          { jobId: `extract-${evidenceId}` }
        )
        console.log(`[router] Evidence ${evidenceId} → EXTRACT_LOCAL (${reason})`)
        break

      case "EXTRACT_CLOUD":
        await extractQueue.add(
          "extract",
          {
            evidenceId,
            runId,
            parentJobId: job.id,
            llmProvider: "CLOUD_OLLAMA",
          },
          { jobId: `extract-${evidenceId}` }
        )
        console.log(`[router] Evidence ${evidenceId} → EXTRACT_CLOUD (${reason})`)
        break

      case "SKIP":
        console.log(`[router] Evidence ${evidenceId} → SKIP (${reason})`)
        break
    }

    const duration = Date.now() - start
    jobsProcessed.inc({ worker: "router", status: "success", queue: "router" })
    jobDuration.observe({ worker: "router", queue: "router" }, duration / 1000)

    return {
      success: true,
      duration,
      data: {
        decision,
        reason,
        budgetCheck,
        recommendedProvider: budgetCheck.recommendedProvider,
        healthScore: healthData.healthScore,
        minScoutScore,
      },
    }
  } catch (error) {
    const errorClass = classifyError(error instanceof Error ? error : new Error(String(error)))

    // Open circuit for auth/quota errors
    if (shouldOpenCircuit(errorClass)) {
      openCircuit(errorClass as "AUTH_ERROR" | "QUOTA_ERROR")
    }

    jobsProcessed.inc({ worker: "router", status: "failed", queue: "router" })

    // Record error in progress
    await recordProgressEvent({
      stageName: "router",
      evidenceId,
      sourceSlug,
      runId,
      timestamp: new Date(),
      producedCount: 0,
      downstreamQueuedCount: 0,
      errorClass,
      errorMessage: error instanceof Error ? error.message : String(error),
    })

    return {
      success: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// Create and start worker
const worker = createWorker<RouterJobData>("router", processRouterJob, {
  name: "router",
  concurrency: 10, // High concurrency since no LLM calls
  lockDuration: 30000,
  stalledInterval: 15000,
})

setupGracefulShutdown([worker])

console.log("[router] Worker started")
