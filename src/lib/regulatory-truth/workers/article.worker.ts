// src/lib/regulatory-truth/workers/article.worker.ts
/**
 * Article Agent Worker - processes article generation jobs from queue
 *
 * Job types:
 * - article.generate: Create new article job and run full pipeline
 * - article.process: Run existing article job through pipeline
 *
 * Triggered by:
 * - High-impact news items (via news cron)
 * - RTL rule releases (via content sync events)
 * - Manual queue submissions
 */
import { Job } from "bullmq"
import { createWorker, setupGracefulShutdown, type JobResult } from "./base"
import { articleQueue } from "./queues"
import { jobsProcessed, jobDuration } from "./metrics"
import { db } from "@/lib/db"
import { createArticleJob, runArticleJob } from "@/lib/article-agent/orchestrator"
import type { ArticleType } from "@prisma/client"

export interface ArticleJobData {
  /** Type of article job operation */
  action: "generate" | "process"
  /** For 'process' action: existing job ID */
  jobId?: string
  /** For 'generate' action: article type */
  type?: ArticleType
  /** For 'generate' action: source URLs */
  sourceUrls?: string[]
  /** For 'generate' action: article topic */
  topic?: string
  /** For 'generate' action: max iterations */
  maxIterations?: number
  /** Optional metadata for tracing */
  metadata?: {
    triggeredBy?: string // e.g., "news-cron", "rtl-release", "manual"
    newsItemId?: string
    ruleId?: string
  }
}

async function processArticleJob(job: Job<ArticleJobData>): Promise<JobResult> {
  const start = Date.now()
  const { action, jobId, type, sourceUrls, topic, maxIterations, metadata } = job.data

  try {
    let articleJobId: string

    if (action === "generate") {
      // Validate required fields for generate action
      if (!type || !sourceUrls || sourceUrls.length === 0) {
        return {
          success: false,
          duration: 0,
          error: "Generate action requires type and sourceUrls",
        }
      }

      // Create new article job
      console.log(
        "[article-worker] Creating new " + type + " article job for: " + (topic || sourceUrls[0])
      )
      const newJob = await createArticleJob({
        type,
        sourceUrls,
        topic,
        maxIterations,
      })
      articleJobId = newJob.id
      console.log("[article-worker] Created article job: " + articleJobId)
    } else if (action === "process") {
      // Validate job ID for process action
      if (!jobId) {
        return {
          success: false,
          duration: 0,
          error: "Process action requires jobId",
        }
      }
      articleJobId = jobId

      // Verify job exists
      const existingJob = await db.articleJob.findUnique({
        where: { id: articleJobId },
      })
      if (!existingJob) {
        return {
          success: false,
          duration: 0,
          error: "Article job not found: " + articleJobId,
        }
      }
      console.log("[article-worker] Processing existing job: " + articleJobId)
    } else {
      return {
        success: false,
        duration: 0,
        error: "Unknown action: " + action,
      }
    }

    // Run the article generation pipeline
    const result = await runArticleJob(articleJobId)

    const duration = Date.now() - start
    jobsProcessed.inc({ worker: "article", status: "success", queue: "article" })
    jobDuration.observe({ worker: "article", queue: "article" }, duration / 1000)

    console.log("[article-worker] Job " + articleJobId + " completed with status: " + result.status)

    return {
      success: true,
      duration,
      data: {
        articleJobId,
        status: result.status,
        iteration: result.currentIteration,
        metadata,
      },
    }
  } catch (error) {
    jobsProcessed.inc({ worker: "article", status: "failed", queue: "article" })
    console.error("[article-worker] Job failed:", error)
    return {
      success: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// Create and start worker
// Lock duration must exceed max job time (article pipeline can take 10+ minutes)
const worker = createWorker<ArticleJobData>("article", processArticleJob, {
  name: "article",
  concurrency: 1, // Process one article at a time to avoid LLM rate limits
  lockDuration: 900000, // 15 minutes - article pipeline can be long
  stalledInterval: 120000, // Check for stalled jobs every 2 min
})

setupGracefulShutdown([worker])
