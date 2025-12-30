// src/lib/regulatory-truth/workers/evidence-embedding.worker.ts
// Worker that generates embeddings for Evidence records with retry logic
// GitHub Issue #828: Evidence embedding generation is fire-and-forget without retry

import { Job } from "bullmq"
import { createWorker, setupGracefulShutdown, type JobResult } from "./base"
import { jobsProcessed, jobDuration } from "./metrics"
import { prisma } from "@/lib/prisma"
import { generateEvidenceEmbedding } from "../utils/evidence-embedder"

export interface EvidenceEmbeddingJobData {
  evidenceId: string
  runId: string
  attempt?: number
}

const MAX_ATTEMPTS = 3

async function processEvidenceEmbeddingJob(
  job: Job<EvidenceEmbeddingJobData>
): Promise<JobResult> {
  const start = Date.now()
  const { evidenceId } = job.data
  const attempt = job.attemptsMade + 1

  console.log(
    `[evidence-embedding-worker] Processing embedding job for evidence ${evidenceId} (attempt ${attempt}/${MAX_ATTEMPTS})`
  )

  try {
    // Mark as processing
    await prisma.evidence.update({
      where: { id: evidenceId },
      data: {
        embeddingStatus: "PROCESSING",
        embeddingAttempts: attempt,
        embeddingUpdatedAt: new Date(),
        embeddingError: null,
      },
    })

    // Generate the embedding
    const embedding = await generateEvidenceEmbedding(evidenceId)

    // Mark as completed
    await prisma.evidence.update({
      where: { id: evidenceId },
      data: {
        embeddingStatus: "COMPLETED",
        embeddingUpdatedAt: new Date(),
        embeddingError: null,
      },
    })

    const duration = Date.now() - start
    jobsProcessed.inc({
      worker: "evidence-embedding",
      status: "success",
      queue: "evidence-embedding",
    })
    jobDuration.observe(
      { worker: "evidence-embedding", queue: "evidence-embedding" },
      duration / 1000
    )

    console.log(
      `[evidence-embedding-worker] Successfully generated embedding for evidence ${evidenceId} (${embedding.length} dimensions)`
    )

    return {
      success: true,
      duration,
      data: {
        evidenceId,
        embeddingDimensions: embedding.length,
      },
    }
  } catch (error) {
    const duration = Date.now() - start
    const errorMessage = error instanceof Error ? error.message : String(error)

    jobsProcessed.inc({
      worker: "evidence-embedding",
      status: "failed",
      queue: "evidence-embedding",
    })
    jobDuration.observe(
      { worker: "evidence-embedding", queue: "evidence-embedding" },
      duration / 1000
    )

    // Update status based on whether we have exhausted retries
    const isFinalAttempt = attempt >= MAX_ATTEMPTS
    await prisma.evidence.update({
      where: { id: evidenceId },
      data: {
        embeddingStatus: isFinalAttempt ? "FAILED" : "PENDING",
        embeddingError: errorMessage,
        embeddingUpdatedAt: new Date(),
      },
    })

    console.error(
      `[evidence-embedding-worker] Failed to generate embedding for evidence ${evidenceId}: ${errorMessage}`
    )

    // Throw to trigger BullMQ retry mechanism
    throw error
  }
}

// Create and start worker
const worker = createWorker<EvidenceEmbeddingJobData>(
  "evidence-embedding",
  processEvidenceEmbeddingJob,
  {
    name: "evidence-embedding",
    concurrency: 2, // Process 2 evidence records in parallel
  }
)

setupGracefulShutdown([worker])

console.log(
  "[evidence-embedding-worker] Worker started, listening for evidence embedding jobs"
)
