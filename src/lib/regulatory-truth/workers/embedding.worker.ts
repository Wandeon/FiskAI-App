// src/lib/regulatory-truth/workers/embedding.worker.ts
// Worker that generates embeddings for published regulatory rules

import { Job } from "bullmq"
import { createWorker, setupGracefulShutdown, type JobResult } from "./base"
import { jobsProcessed, jobDuration } from "./metrics"
import { generateEmbeddingsForRule } from "../services/embedding-service"

interface EmbeddingJobData {
  ruleId: string
  runId: string
  parentJobId?: string
}

async function processEmbeddingJob(job: Job<EmbeddingJobData>): Promise<JobResult> {
  const start = Date.now()
  const { ruleId } = job.data

  console.log(`[embedding-worker] Processing embedding job for rule ${ruleId}`)

  try {
    const result = await generateEmbeddingsForRule(ruleId)

    const duration = Date.now() - start
    jobsProcessed.inc({ worker: "embedding", status: "success", queue: "embedding" })
    jobDuration.observe({ worker: "embedding", queue: "embedding" }, duration / 1000)

    if (!result.success) {
      console.error(
        `[embedding-worker] Embedding generation failed for rule ${ruleId}: ${result.error}`
      )
      return {
        success: false,
        duration,
        error: result.error || "Unknown error",
      }
    }

    console.log(
      `[embedding-worker] Successfully generated ${result.chunkCount} embeddings for rule ${ruleId}`
    )

    return {
      success: true,
      duration,
      data: {
        ruleId,
        chunkCount: result.chunkCount,
      },
    }
  } catch (error) {
    const duration = Date.now() - start
    jobsProcessed.inc({ worker: "embedding", status: "failed", queue: "embedding" })
    jobDuration.observe({ worker: "embedding", queue: "embedding" }, duration / 1000)

    console.error(`[embedding-worker] Unexpected error processing rule ${ruleId}:`, error)

    return {
      success: false,
      duration,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// Create and start worker
const worker = createWorker<EmbeddingJobData>("embedding", processEmbeddingJob, {
  name: "embedding",
  concurrency: 1, // Serial processing - GPU-01 can only handle one request at a time
})

setupGracefulShutdown([worker])

console.log("[embedding-worker] Worker started, listening for embedding jobs")
