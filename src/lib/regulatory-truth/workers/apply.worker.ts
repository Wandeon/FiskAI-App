// src/lib/regulatory-truth/workers/apply.worker.ts
//
// PHASE-D: Apply worker - handles persistence of composer proposals
// This is the single point of truth persistence in the RTL pipeline.
// Separates "proposal generation" (compose) from "truth persistence" (apply).

import { Job } from "bullmq"
import { createWorker, setupGracefulShutdown, type JobResult } from "./base"
import { reviewQueue } from "./queues"
import { jobsProcessed, jobDuration } from "./metrics"
import { applyComposerProposal, type ComposerProposal } from "../agents/composer"
import { updateRunOutcome } from "../agents/runner"

interface ApplyJobData {
  proposal: ComposerProposal
  domain: string
  runId: string
  parentJobId?: string
}

async function processApplyJob(job: Job<ApplyJobData>): Promise<JobResult> {
  const start = Date.now()
  const { proposal, domain, runId } = job.data

  // Validate proposal
  if (!proposal || !proposal.candidateFactIds) {
    console.error(`[apply] Invalid proposal in job ${job.id}`)
    return {
      success: false,
      duration: 0,
      error: "Invalid proposal - missing candidateFactIds",
    }
  }

  console.log(
    `[apply] Processing proposal for domain ${domain} with ${proposal.candidateFactIds.length} CandidateFacts`
  )

  try {
    // Apply the proposal (persistence)
    const result = await applyComposerProposal(proposal, {
      runId,
      jobId: String(job.id),
      parentJobId: job.data.parentJobId,
      queueName: "apply",
    })

    // INVARIANT ENFORCEMENT: Update AgentRun with actual item count
    // itemsProduced = 1 if rule created, 0 otherwise
    const itemsProduced = result.success && result.ruleId ? 1 : 0
    if (proposal.agentRunId) {
      await updateRunOutcome(proposal.agentRunId, itemsProduced)
    }

    if (result.success && result.ruleId) {
      // Queue review job
      await reviewQueue.add(
        "review",
        {
          ruleId: result.ruleId,
          runId,
          parentJobId: job.id,
        },
        { jobId: `review-${result.ruleId}` }
      )
      console.log(`[apply] Queued review job for rule ${result.ruleId}`)
    } else if (result.error?.includes("Conflict detected")) {
      // Conflict was created - arbiter will pick it up
      console.log(`[apply] Conflict detected for domain ${domain}`)
    }

    const duration = Date.now() - start
    jobsProcessed.inc({ worker: "apply", status: "success", queue: "apply" })
    jobDuration.observe({ worker: "apply", queue: "apply" }, duration / 1000)

    return {
      success: result.success,
      duration,
      data: {
        ruleId: result.ruleId,
        domain,
        sourcePointersCreated: result.sourcePointerIds.length,
        candidateFactsProcessed: proposal.candidateFactIds.length,
      },
    }
  } catch (error) {
    jobsProcessed.inc({ worker: "apply", status: "failed", queue: "apply" })
    return {
      success: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// Create and start worker
// Lock duration must exceed max job time
const worker = createWorker<ApplyJobData>("apply", processApplyJob, {
  name: "apply",
  concurrency: 1,
  lockDuration: 360000, // 6 minutes
  stalledInterval: 60000, // Check for stalled jobs every 60s
})

setupGracefulShutdown([worker])

console.log("[apply] Worker started")
