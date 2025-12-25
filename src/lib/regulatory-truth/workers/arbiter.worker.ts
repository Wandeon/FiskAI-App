// src/lib/regulatory-truth/workers/arbiter.worker.ts
import { Job } from "bullmq"
import { createWorker, setupGracefulShutdown, type JobResult } from "./base"
import { jobsProcessed, jobDuration } from "./metrics"
import { llmLimiter } from "./rate-limiter"
import { runArbiter } from "../agents/arbiter"

interface ArbiterJobData {
  conflictId: string
  runId: string
  parentJobId?: string
}

async function processArbiterJob(job: Job<ArbiterJobData>): Promise<JobResult> {
  const start = Date.now()
  const { conflictId } = job.data

  try {
    // Rate limit LLM calls
    const result = await llmLimiter.schedule(() => runArbiter(conflictId))

    const duration = Date.now() - start
    jobsProcessed.inc({ worker: "arbiter", status: "success", queue: "arbiter" })
    jobDuration.observe({ worker: "arbiter", queue: "arbiter" }, duration / 1000)

    return {
      success: result.success,
      duration,
      data: { resolution: result.resolution },
    }
  } catch (error) {
    jobsProcessed.inc({ worker: "arbiter", status: "failed", queue: "arbiter" })
    return {
      success: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// Create and start worker
// Lock duration must exceed max job time (agent timeout is 5 min = 300000ms)
const worker = createWorker<ArbiterJobData>("arbiter", processArbiterJob, {
  name: "arbiter",
  concurrency: 1,
  lockDuration: 360000, // 6 minutes - exceeds 5 min agent timeout
  stalledInterval: 60000, // Check for stalled jobs every 60s
})

setupGracefulShutdown([worker])

console.log("[arbiter] Worker started")
