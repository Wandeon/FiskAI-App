// src/lib/regulatory-truth/workers/extractor.worker.ts
import { Job } from "bullmq"
import { createWorker, setupGracefulShutdown, type JobResult } from "./base"
import { extractQueue } from "./queues"
import { jobsProcessed, jobDuration } from "./metrics"
import { llmLimiter } from "./rate-limiter"
import { runExtractor } from "../agents/extractor"
import { updateRunOutcome } from "../agents/runner"
import { dbReg } from "@/lib/db/regulatory"
import { isReadyForExtraction } from "../utils/content-provider"

// PHASE-D: Compose imports disabled until composer is migrated to CandidateFacts
// import { composeQueue } from "./queues"
// import { getDomainDelay } from "./rate-limiter"
// import { db } from "@/lib/db"

interface ExtractJobData {
  evidenceId: string
  runId: string
  parentJobId?: string
}

async function processExtractJob(job: Job<ExtractJobData>): Promise<JobResult> {
  const start = Date.now()
  const { evidenceId, runId } = job.data

  try {
    // Check if evidence is ready for extraction (has required artifacts)
    const ready = await isReadyForExtraction(evidenceId)
    if (!ready) {
      // Re-queue with delay - OCR might still be processing
      console.log(`[extractor] Evidence ${evidenceId} not ready, requeueing...`)
      await extractQueue.add(
        "extract",
        { evidenceId, runId },
        { delay: 30000, jobId: `extract-${evidenceId}` }
      )
      return {
        success: true,
        duration: 0,
        data: { requeued: true, reason: "awaiting_artifact" },
      }
    }

    // Get evidence with source info for rate limiting
    const evidence = await dbReg.evidence.findUnique({
      where: { id: evidenceId },
      include: { source: true },
    })

    if (!evidence) {
      return { success: false, duration: 0, error: `Evidence not found: ${evidenceId}` }
    }

    // Rate limit LLM calls
    const result = await llmLimiter.schedule(() =>
      runExtractor(evidenceId, {
        runId,
        jobId: String(job.id),
        parentJobId: job.data.parentJobId,
        sourceSlug: evidence.source?.slug,
        queueName: "extract",
      })
    )

    // PHASE-D: Update AgentRun.itemsProduced with the count of CandidateFacts created
    // This ensures SUCCESS_APPLIED/SUCCESS_NO_CHANGE is set correctly based on actual items
    if (result.success && result.agentRunId) {
      await updateRunOutcome(result.agentRunId, result.candidateFactIds.length)
    }

    // PHASE-D: Compose queueing is DISABLED until composer is migrated to use CandidateFacts
    // The composer agent (runComposer) is tightly coupled to SourcePointer:
    // - Takes sourcePointerIds as input
    // - Queries db.sourcePointer.findMany()
    // - Connects rules to sourcePointers
    //
    // Since PHASE-D removed SourcePointer creation, compose would fail immediately.
    // CandidateFacts are stored and itemsProduced is updated correctly above.
    // TODO: Migrate composer.ts and composer.worker.ts to use CandidateFacts
    //
    // if (result.success && result.candidateFactIds.length > 0) {
    //   ... queue compose jobs with candidateFactIds ...
    // }

    const duration = Date.now() - start
    jobsProcessed.inc({ worker: "extractor", status: "success", queue: "extract" })
    jobDuration.observe({ worker: "extractor", queue: "extract" }, duration / 1000)

    return {
      success: true,
      duration,
      // PHASE-D: Report candidateFactsCreated instead of pointersCreated
      data: { candidateFactsCreated: result.candidateFactIds.length },
    }
  } catch (error) {
    jobsProcessed.inc({ worker: "extractor", status: "failed", queue: "extract" })
    return {
      success: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// Create and start worker
// Lock duration must exceed max job time (agent timeout is 5 min = 300000ms)
const worker = createWorker<ExtractJobData>("extract", processExtractJob, {
  name: "extractor",
  concurrency: 2,
  lockDuration: 360000, // 6 minutes - exceeds 5 min agent timeout
  stalledInterval: 60000, // Check for stalled jobs every 60s
})

setupGracefulShutdown([worker])

console.log("[extractor] Worker started")
