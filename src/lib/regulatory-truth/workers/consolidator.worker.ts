// src/lib/regulatory-truth/workers/consolidator.worker.ts
import { Job } from "bullmq"
import { createWorker, setupGracefulShutdown, type JobResult } from "./base"
import { jobsProcessed, jobDuration } from "./metrics"
import { runConsolidation } from "../utils/consolidator"

interface ConsolidatorJobData {
  runId: string
  dryRun?: boolean
  parentJobId?: string
}

async function processConsolidatorJob(job: Job<ConsolidatorJobData>): Promise<JobResult> {
  const start = Date.now()
  const { dryRun = false } = job.data

  try {
    const result = await runConsolidation(dryRun)

    const duration = Date.now() - start
    const status = result.success ? "success" : "failed"
    jobsProcessed.inc({ worker: "consolidator", status, queue: "consolidator" })
    jobDuration.observe({ worker: "consolidator", queue: "consolidator" }, duration / 1000)

    return {
      success: result.success,
      duration,
      data: {
        mergedRules: result.mergedRules,
        quarantinedRules: result.quarantinedRules,
        mergedConcepts: result.mergedConcepts,
        pointersReassigned: result.pointersReassigned,
        errors: result.errors,
      },
    }
  } catch (error) {
    jobsProcessed.inc({ worker: "consolidator", status: "failed", queue: "consolidator" })
    return {
      success: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// Create and start worker
// Lock duration must exceed max job time (consolidation can take several minutes)
const worker = createWorker<ConsolidatorJobData>("consolidator", processConsolidatorJob, {
  name: "consolidator",
  concurrency: 1, // Only one consolidation at a time
  lockDuration: 600000, // 10 minutes - consolidation can take a while
  stalledInterval: 120000, // Check for stalled jobs every 2 min
})

setupGracefulShutdown([worker])

console.log("[consolidator] Worker started")
