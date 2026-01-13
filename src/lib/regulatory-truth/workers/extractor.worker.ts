// src/lib/regulatory-truth/workers/extractor.worker.ts
import { Job } from "bullmq"
import { createWorker, setupGracefulShutdown, type JobResult } from "./base"
import { composeQueue, extractQueue } from "./queues"
import { jobsProcessed, jobDuration } from "./metrics"
import { llmLimiter, getDomainDelay } from "./rate-limiter"
import { runExtractor } from "../agents/extractor"
import { updateRunOutcome } from "../agents/runner"
import { db } from "@/lib/db"
import { dbReg } from "@/lib/db/regulatory"
import { isReadyForExtraction } from "../utils/content-provider"

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

    // PHASE-D: Use candidateFactIds for item count (sourcePointerIds always empty)
    const itemsProduced = result.candidateFactIds.length

    // INVARIANT ENFORCEMENT: Update AgentRun with actual item count
    // This ensures outcome reflects reality: itemsProduced > 0 → SUCCESS_APPLIED
    if (result.agentRunId) {
      await updateRunOutcome(result.agentRunId, itemsProduced)
    }

    // PHASE-D: Queue compose jobs using candidateFactIds (not sourcePointerIds)
    // CandidateFact is now the inter-stage carrier between extractor and composer
    if (result.success && result.candidateFactIds.length > 0) {
      // Group candidate facts by domain and queue compose jobs
      const candidateFacts = await db.candidateFact.findMany({
        where: { id: { in: result.candidateFactIds } },
        select: { id: true, suggestedDomain: true },
      })

      const byDomain = new Map<string, string[]>()
      for (const cf of candidateFacts) {
        const domain = cf.suggestedDomain || "unknown"
        const ids = byDomain.get(domain) || []
        ids.push(cf.id)
        byDomain.set(domain, ids)
      }

      // Queue compose job for each domain
      for (const [domain, candidateIds] of byDomain) {
        // Use sorted candidate fact IDs for stable jobId (order-independent)
        const sortedIds = [...candidateIds].sort().join(",")
        await composeQueue.add(
          "compose",
          { candidateFactIds: candidateIds, domain, runId, parentJobId: job.id },
          { delay: getDomainDelay(domain), jobId: `compose-${domain}-${sortedIds}` }
        )
        console.log(
          `[extractor] Queued compose job for domain ${domain} with ${candidateIds.length} CandidateFacts`
        )
      }
    }

    const duration = Date.now() - start
    jobsProcessed.inc({ worker: "extractor", status: "success", queue: "extract" })
    jobDuration.observe({ worker: "extractor", queue: "extract" }, duration / 1000)

    return {
      success: true,
      duration,
      data: { candidateFactsCreated: itemsProduced },
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
