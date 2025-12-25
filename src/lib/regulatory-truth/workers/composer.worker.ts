// src/lib/regulatory-truth/workers/composer.worker.ts
import { Job } from "bullmq"
import { createWorker, setupGracefulShutdown, type JobResult } from "./base"
import { reviewQueue } from "./queues"
import { jobsProcessed, jobDuration } from "./metrics"
import { llmLimiter } from "./rate-limiter"
import { runComposer } from "../agents/composer"

interface ComposeJobData {
  pointerIds: string[]
  domain: string
  runId: string
  parentJobId?: string
}

async function processComposeJob(job: Job<ComposeJobData>): Promise<JobResult> {
  const start = Date.now()
  const { pointerIds, domain, runId } = job.data

  try {
    // Rate limit LLM calls
    const result = await llmLimiter.schedule(() => runComposer(pointerIds))

    if (result.success && result.ruleId) {
      // Queue review job
      await reviewQueue.add("review", {
        ruleId: result.ruleId,
        runId,
        parentJobId: job.id,
      })
    } else if (result.error?.includes("Conflict detected")) {
      // Conflict was created - arbiter will pick it up
      console.log(`[composer] Conflict detected for domain ${domain}`)
    }

    const duration = Date.now() - start
    jobsProcessed.inc({ worker: "composer", status: "success", queue: "compose" })
    jobDuration.observe({ worker: "composer", queue: "compose" }, duration / 1000)

    return {
      success: result.success,
      duration,
      data: { ruleId: result.ruleId, domain },
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
