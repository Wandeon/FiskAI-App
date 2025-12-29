// src/lib/regulatory-truth/workers/reviewer.worker.ts
import { Job } from "bullmq"
import { createWorker, setupGracefulShutdown, type JobResult } from "./base"
import { releaseQueue } from "./queues"
import { jobsProcessed, jobDuration } from "./metrics"
import { llmLimiter } from "./rate-limiter"
import { runReviewer } from "../agents/reviewer"
import { db } from "@/lib/db"

interface ReviewJobData {
  ruleId: string
  runId: string
  parentJobId?: string
}

async function processReviewJob(job: Job<ReviewJobData>): Promise<JobResult> {
  const start = Date.now()
  const { ruleId, runId } = job.data

  try {
    // Rate limit LLM calls
    const result = await llmLimiter.schedule(() => runReviewer(ruleId))

    if (result.success) {
      // Check if rule was auto-approved
      const rule = await db.regulatoryRule.findUnique({
        where: { id: ruleId },
        select: { status: true },
      })

      if (rule?.status === "APPROVED") {
        // Queue for release
        await releaseQueue.add("release-single", {
          ruleIds: [ruleId],
          runId,
          parentJobId: job.id,
        })
      }
    }

    const duration = Date.now() - start
    jobsProcessed.inc({ worker: "reviewer", status: "success", queue: "review" })
    jobDuration.observe({ worker: "reviewer", queue: "review" }, duration / 1000)

    return {
      success: result.success,
      duration,
      data: {
        decision: result.output?.review_result?.decision,
      },
    }
  } catch (error) {
    jobsProcessed.inc({ worker: "reviewer", status: "failed", queue: "review" })
    return {
      success: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// Create and start worker
// Lock duration must exceed max job time (agent timeout is 5 min = 300000ms)
// CONCURRENCY: Increased from 1 to 5 to process multiple reviews in parallel
// This helps drain the 509 DRAFT rules bottleneck identified in issue #176
const worker = createWorker<ReviewJobData>("review", processReviewJob, {
  name: "reviewer",
  concurrency: 5,
  lockDuration: 360000, // 6 minutes - exceeds 5 min agent timeout
  stalledInterval: 60000, // Check for stalled jobs every 60s
})

setupGracefulShutdown([worker])

console.log("[reviewer] Worker started")
