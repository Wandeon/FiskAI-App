// src/lib/regulatory-truth/workers/composer.worker.ts
//
// PHASE-D: Composer worker - generates proposals only, no persistence
// Separates "proposal generation" (compose) from "truth persistence" (apply).
// Persistence is handled by the apply worker.
//
import { Job } from "bullmq"
import { createWorker, setupGracefulShutdown, type JobResult } from "./base"
import { applyQueue } from "./queues"
import { jobsProcessed, jobDuration } from "./metrics"
import { llmLimiter } from "./rate-limiter"
import { generateComposerProposal } from "../agents/composer"

// PHASE-D: Composer now accepts candidateFactIds instead of pointerIds
interface ComposeJobData {
  candidateFactIds: string[]
  domain: string
  runId: string
  parentJobId?: string
  // Legacy field for backward compatibility during migration
  pointerIds?: string[]
}

async function processComposeJob(job: Job<ComposeJobData>): Promise<JobResult> {
  const start = Date.now()
  const { candidateFactIds, domain, runId } = job.data

  // PHASE-D: Require candidateFactIds
  if (!candidateFactIds || candidateFactIds.length === 0) {
    console.error(`[composer] No candidateFactIds provided for domain ${domain}`)
    return {
      success: false,
      duration: 0,
      error: "No candidateFactIds provided - PHASE-D requires CandidateFact input",
    }
  }

  try {
    // PHASE-D: Generate proposal only (no persistence)
    // Rate limit LLM calls
    const proposal = await llmLimiter.schedule(() =>
      generateComposerProposal(candidateFactIds, {
        runId,
        jobId: String(job.id),
        parentJobId: job.data.parentJobId,
        queueName: "compose",
      })
    )

    if (!proposal.success) {
      const duration = Date.now() - start
      jobsProcessed.inc({ worker: "composer", status: "failed", queue: "compose" })
      jobDuration.observe({ worker: "composer", queue: "compose" }, duration / 1000)
      return {
        success: false,
        duration,
        error: proposal.error || "Proposal generation failed",
      }
    }

    // PHASE-D: Queue apply job for persistence
    // Apply worker handles: SourcePointer creation, RegulatoryRule creation, review queueing
    // Use sorted candidate fact IDs for stable jobId (order-independent)
    const sortedIds = [...candidateFactIds].sort().join(",")
    await applyQueue.add(
      "apply",
      {
        proposal,
        domain,
        runId,
        parentJobId: job.id,
      },
      { jobId: `apply-${domain}-${sortedIds}` }
    )
    console.log(
      `[composer] Queued apply job for domain ${domain} with ${candidateFactIds.length} CandidateFacts`
    )

    const duration = Date.now() - start
    jobsProcessed.inc({ worker: "composer", status: "success", queue: "compose" })
    jobDuration.observe({ worker: "composer", queue: "compose" }, duration / 1000)

    return {
      success: true,
      duration,
      data: {
        domain,
        candidateFactsProcessed: candidateFactIds.length,
        proposalQueued: true,
        agentRunId: proposal.agentRunId,
      },
    }
  } catch (error) {
    jobsProcessed.inc({ worker: "composer", status: "failed", queue: "compose" })
    return {
      success: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// Create and start worker
// Lock duration must exceed max job time (agent timeout is 5 min = 300000ms)
const worker = createWorker<ComposeJobData>("compose", processComposeJob, {
  name: "composer",
  concurrency: 1,
  lockDuration: 360000, // 6 minutes - exceeds 5 min agent timeout
  stalledInterval: 60000, // Check for stalled jobs every 60s
})

setupGracefulShutdown([worker])

console.log("[composer] Worker started")
