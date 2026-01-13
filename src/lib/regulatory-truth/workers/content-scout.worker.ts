// src/lib/regulatory-truth/workers/content-scout.worker.ts
//
// Content Scout Worker: Pre-LLM quality assessment
// Runs deterministic checks before expensive LLM calls.
// Optional local Ollama for uncertain cases.
//

import { Job } from "bullmq"
import { createWorker, setupGracefulShutdown, type JobResult } from "./base"
import { routerQueue } from "./queues"
import { jobsProcessed, jobDuration } from "./metrics"
import { scoutContent, shouldUseLocalLlm, hashContent, type ScoutResult } from "./content-scout"
import { recordProgressEvent, type ProgressEvent } from "./progress-tracker"
import { dbReg } from "@/lib/db"

export interface ScoutJobData {
  evidenceId: string
  runId: string
  parentJobId?: string
}

export interface ScoutJobResult extends JobResult {
  data?: {
    scoutResult: ScoutResult
    usedLocalLlm: boolean
    routingDecision: "PROCEED" | "SKIP" | "OCR_FIRST"
  }
}

// Cache for content hashes to detect duplicates within batch
const recentHashes = new Set<string>()
const MAX_HASH_CACHE_SIZE = 10000

function addToHashCache(hash: string): void {
  if (recentHashes.size >= MAX_HASH_CACHE_SIZE) {
    // Clear oldest half when full
    const entries = Array.from(recentHashes)
    recentHashes.clear()
    entries.slice(Math.floor(entries.length / 2)).forEach((h) => recentHashes.add(h))
  }
  recentHashes.add(hash)
}

async function processScoutJob(job: Job<ScoutJobData>): Promise<ScoutJobResult> {
  const start = Date.now()
  const { evidenceId, runId } = job.data

  try {
    // Fetch evidence content
    const evidence = await dbReg.evidence.findUnique({
      where: { id: evidenceId },
      include: { source: true },
    })

    if (!evidence) {
      return {
        success: false,
        duration: Date.now() - start,
        error: `Evidence not found: ${evidenceId}`,
      }
    }

    const sourceSlug = evidence.source?.slug || "unknown"

    // Run deterministic scout
    const scoutResult = scoutContent(evidence.rawContent, evidence.contentType, recentHashes)

    // Add hash to cache for duplicate detection
    const contentHash = hashContent(evidence.rawContent)
    addToHashCache(contentHash)

    // Track whether we used local LLM (not implemented yet, placeholder)
    let usedLocalLlm = false

    // Check if we should use local LLM to refine the result
    if (shouldUseLocalLlm(scoutResult)) {
      // TODO: Implement local Ollama call for uncertain cases
      // For now, we proceed with deterministic result
      usedLocalLlm = false
      console.log(`[scout] Evidence ${evidenceId} would benefit from local LLM (not implemented)`)
    }

    // Determine routing decision
    let routingDecision: "PROCEED" | "SKIP" | "OCR_FIRST"
    if (scoutResult.skipReason) {
      routingDecision = "SKIP"
    } else if (scoutResult.needsOCR) {
      routingDecision = "OCR_FIRST"
    } else {
      routingDecision = "PROCEED"
    }

    // Record progress event
    const progressEvent: ProgressEvent = {
      stageName: "scout",
      evidenceId,
      sourceSlug,
      runId,
      timestamp: new Date(),
      producedCount: routingDecision === "SKIP" ? 0 : 1,
      downstreamQueuedCount: routingDecision === "SKIP" ? 0 : 1,
      skipReason: scoutResult.skipReason,
      metadata: {
        worthItScore: scoutResult.worthItScore,
        docType: scoutResult.docType,
        boilerplateRatio: scoutResult.boilerplateRatio,
        determinismConfidence: scoutResult.determinismConfidence,
        usedLocalLlm,
      },
    }
    await recordProgressEvent(progressEvent)

    // Queue router job with scout result
    await routerQueue.add(
      "route",
      {
        evidenceId,
        scoutResult,
        sourceSlug,
        runId,
        parentJobId: job.id,
      },
      { jobId: `route-${evidenceId}` }
    )

    const duration = Date.now() - start
    jobsProcessed.inc({ worker: "scout", status: "success", queue: "scout" })
    jobDuration.observe({ worker: "scout", queue: "scout" }, duration / 1000)

    console.log(
      `[scout] Evidence ${evidenceId}: ${routingDecision} (score=${(scoutResult.worthItScore * 100).toFixed(1)}%, type=${scoutResult.docType})`
    )

    return {
      success: true,
      duration,
      data: {
        scoutResult,
        usedLocalLlm,
        routingDecision,
      },
    }
  } catch (error) {
    jobsProcessed.inc({ worker: "scout", status: "failed", queue: "scout" })

    // Record error in progress
    await recordProgressEvent({
      stageName: "scout",
      evidenceId,
      sourceSlug: "unknown",
      runId,
      timestamp: new Date(),
      producedCount: 0,
      downstreamQueuedCount: 0,
      errorClass: error instanceof Error ? error.name : "UnknownError",
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
const worker = createWorker<ScoutJobData>("scout", processScoutJob, {
  name: "scout",
  concurrency: 5, // High concurrency since mostly CPU-bound
  lockDuration: 60000,
  stalledInterval: 30000,
})

setupGracefulShutdown([worker])

console.log("[scout] Worker started")
