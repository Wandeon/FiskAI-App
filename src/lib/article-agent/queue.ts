// src/lib/article-agent/queue.ts
/**
 * Queue helpers for Article Agent
 *
 * Provides functions to enqueue article generation jobs for background processing.
 */
import { articleQueue } from "@/lib/regulatory-truth/workers/queues"
import type { ArticleType } from "@prisma/client"

export interface EnqueueArticleJobParams {
  /** Article type (NEWS, GUIDE, HOWTO, etc.) */
  type: ArticleType
  /** Source URLs to extract content from */
  sourceUrls: string[]
  /** Optional topic/title for the article */
  topic?: string
  /** Max rewrite iterations (default: 3) */
  maxIterations?: number
  /** Trigger source for tracing */
  triggeredBy?: "news-cron" | "rtl-release" | "manual" | "api"
  /** Optional news item ID if triggered by news pipeline */
  newsItemId?: string
  /** Optional rule ID if triggered by RTL release */
  ruleId?: string
  /** Delay before processing (ms) */
  delay?: number
}

export interface EnqueueResult {
  success: boolean
  queueJobId?: string
  error?: string
}

/**
 * Enqueue a new article generation job for background processing.
 *
 * @example
 * // From news cron job
 * await enqueueArticleJob({
 *   type: "NEWS",
 *   sourceUrls: [newsItem.sourceUrl],
 *   topic: newsItem.originalTitle,
 *   triggeredBy: "news-cron",
 *   newsItemId: newsItem.id,
 * })
 *
 * @example
 * // From RTL rule release
 * await enqueueArticleJob({
 *   type: "GUIDE",
 *   sourceUrls: [primarySourceUrl],
 *   topic: "Promjena PDV praga: " + newValue,
 *   triggeredBy: "rtl-release",
 *   ruleId: rule.id,
 * })
 */
export async function enqueueArticleJob(params: EnqueueArticleJobParams): Promise<EnqueueResult> {
  try {
    const job = await articleQueue.add(
      "article.generate",
      {
        action: "generate",
        type: params.type,
        sourceUrls: params.sourceUrls,
        topic: params.topic,
        maxIterations: params.maxIterations,
        metadata: {
          triggeredBy: params.triggeredBy,
          newsItemId: params.newsItemId,
          ruleId: params.ruleId,
        },
      },
      {
        delay: params.delay,
        // Use a job ID based on the first source URL to prevent duplicates
        jobId: generateJobId(params.type, params.sourceUrls[0]),
      }
    )

    console.log(
      "[article-queue] Enqueued article job: " +
        job.id +
        " for " +
        (params.topic || params.sourceUrls[0])
    )

    return {
      success: true,
      queueJobId: job.id,
    }
  } catch (error) {
    console.error("[article-queue] Failed to enqueue article job:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Enqueue an existing article job for continued processing.
 * Use this when a job is in a non-terminal state and needs to resume.
 */
export async function enqueueExistingArticleJob(
  jobId: string,
  triggeredBy?: string
): Promise<EnqueueResult> {
  try {
    const job = await articleQueue.add(
      "article.process",
      {
        action: "process",
        jobId,
        metadata: {
          triggeredBy: triggeredBy || "resume",
        },
      },
      {
        jobId: "process-" + jobId,
      }
    )

    console.log("[article-queue] Enqueued existing article job for processing: " + jobId)

    return {
      success: true,
      queueJobId: job.id,
    }
  } catch (error) {
    console.error("[article-queue] Failed to enqueue existing article job:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Generate a deterministic job ID to prevent duplicate jobs.
 */
function generateJobId(type: ArticleType, sourceUrl: string): string {
  const date = new Date().toISOString().split("T")[0]
  const urlHash = simpleHash(sourceUrl)
  return "article-" + type.toLowerCase() + "-" + date + "-" + urlHash
}

/**
 * Simple hash function for URL deduplication.
 */
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36).substring(0, 8)
}
