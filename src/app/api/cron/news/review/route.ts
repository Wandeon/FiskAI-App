/**
 * CRON 2: Review (runs at 23:30)
 *
 * Process:
 * 1. Get all news_posts with status='draft'
 * 2. For each post:
 *    - Call reviewer to get quality feedback
 *    - Store feedback in ai_passes.review
 *    - Update status='reviewing'
 */

import { NextRequest, NextResponse } from "next/server"
import { drizzleDb } from "@/lib/db/drizzle"
import { newsItems, newsPosts, newsPostSources } from "@/lib/db/schema"
import {
  needsRewrite,
  reviewArticle,
  recordNewsPostError,
  checkAndStartStage,
  completeStage,
  failStage,
  MAX_PROCESSING_ATTEMPTS,
} from "@/lib/news/pipeline"
import { eq, and, lt, sql } from "drizzle-orm"
import { isValidationError, formatValidationError } from "@/lib/api/validation"

export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 minutes

interface ReviewResult {
  success: boolean
  summary: {
    totalDrafts: number
    retryPosts: number
    reviewed: number
    averageScore: number
    needsRewrite: number
    failedPosts: number
  }
  reviews: Array<{
    postId: string
    title: string
    score: number
    needsRewrite: boolean
  }>
  errors: string[]
}

/**
 * Main handler
 */
export async function GET(request: NextRequest) {
  console.log("[CRON 2] Starting review job...")

  const result: ReviewResult = {
    success: false,
    summary: {
      totalDrafts: 0,
      retryPosts: 0,
      reviewed: 0,
      averageScore: 0,
      needsRewrite: 0,
      failedPosts: 0,
    },
    reviews: [],
    errors: [],
  }

  let pipelineRunId: string | undefined

  try {
    // 1. Verify authorization
    const authHeader = request.headers.get("authorization")
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

    if (!authHeader || authHeader !== expectedAuth) {
      console.error("[CRON 2] Unauthorized request")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 1.5. Check pipeline coordination (review depends on fetch-classify)
    const pipelineCheck = await checkAndStartStage("review")
    if (!pipelineCheck.canProceed) {
      console.log(`[CRON 2] Cannot proceed: ${pipelineCheck.reason}`)
      return NextResponse.json(
        {
          success: false,
          error: "Pipeline stage blocked",
          reason: pipelineCheck.reason,
        },
        { status: 409 }
      )
    }
    pipelineRunId = pipelineCheck.runId

    // 2. Get all news_posts with status='draft' (including retry-eligible posts)
    console.log("[CRON 2] Fetching draft posts...")

    // Get new draft posts
    const newDraftPosts = await drizzleDb
      .select()
      .from(newsPosts)
      .where(
        and(
          eq(newsPosts.status, "draft"),
          sql`${newsPosts.processingAttempts} = 0 OR ${newsPosts.processingAttempts} IS NULL`
        )
      )

    // Get posts that failed but are eligible for retry
    const retryPosts = await drizzleDb
      .select()
      .from(newsPosts)
      .where(
        and(
          eq(newsPosts.status, "draft"),
          lt(newsPosts.processingAttempts, MAX_PROCESSING_ATTEMPTS),
          sql`${newsPosts.processingAttempts} > 0`
        )
      )

    // Combine both sets
    const postsMap = new Map<string, (typeof newDraftPosts)[0]>()
    for (const post of newDraftPosts) {
      postsMap.set(post.id, post)
    }
    for (const post of retryPosts) {
      postsMap.set(post.id, post)
    }
    const draftPosts = Array.from(postsMap.values())

    result.summary.totalDrafts = newDraftPosts.length
    result.summary.retryPosts = retryPosts.length
    console.log(
      `[CRON 2] Found ${newDraftPosts.length} new drafts + ${retryPosts.length} retry posts to review`
    )

    if (draftPosts.length === 0) {
      result.success = true
      console.log("[CRON 2] No drafts to review. Job complete.")
      return NextResponse.json(result)
    }

    let totalScore = 0

    // 3. Review each post
    for (const post of draftPosts) {
      try {
        console.log(`[CRON 2] Reviewing: ${post.title}`)

        const sourceRows = await drizzleDb
          .select({
            title: newsItems.originalTitle,
            content: newsItems.originalContent,
            url: newsItems.sourceUrl,
          })
          .from(newsPostSources)
          .innerJoin(newsItems, eq(newsPostSources.newsItemId, newsItems.id))
          .where(eq(newsPostSources.postId, post.id))
          .limit(1)

        const source = sourceRows[0]
          ? {
              title: sourceRows[0].title,
              content: sourceRows[0].content || "",
              url: sourceRows[0].url,
            }
          : undefined

        // Call reviewer (with source when available for fact-checking)
        const feedback = await reviewArticle(
          {
            title: post.title,
            content: post.content,
          },
          source
        )

        totalScore += feedback.score

        // Get existing aiPasses
        const aiPasses =
          typeof post.aiPasses === "object" && post.aiPasses !== null
            ? (post.aiPasses as Record<string, any>)
            : {}

        // Update post with review feedback
        await drizzleDb
          .update(newsPosts)
          .set({
            status: "reviewing",
            aiPasses: {
              ...aiPasses,
              review: {
                timestamp: new Date().toISOString(),
                score: feedback.score,
                factual_issues: feedback.factual_issues,
                problems: feedback.problems,
                suggestions: feedback.suggestions,
                rewrite_focus: feedback.rewrite_focus,
              },
            },
            updatedAt: new Date(),
          })
          .where(eq(newsPosts.id, post.id))

        const requiresRewrite = needsRewrite(feedback)
        if (requiresRewrite) {
          result.summary.needsRewrite++
        }

        result.reviews.push({
          postId: post.id,
          title: post.title,
          score: feedback.score,
          needsRewrite: requiresRewrite,
        })

        result.summary.reviewed++

        console.log(`[CRON 2] Reviewed: ${post.title} - Score: ${feedback.score}/10`)
      } catch (error) {
        const errorMsg = `Failed to review post ${post.id} (${post.title}): ${error instanceof Error ? error.message : String(error)}`
        console.error(`[CRON 2] ${errorMsg}`)
        result.errors.push(errorMsg)

        // Record the error for retry tracking
        try {
          const { shouldRetry, attempts } = await recordNewsPostError(
            post.id,
            error instanceof Error ? error : String(error)
          )
          if (shouldRetry) {
            console.log(
              `[CRON 2] Post ${post.id} will be retried (attempt ${attempts}/${MAX_PROCESSING_ATTEMPTS})`
            )
          } else {
            console.log(
              `[CRON 2] Post ${post.id} moved to dead-letter queue after ${attempts} attempts`
            )
            result.summary.failedPosts++
          }
        } catch (recordError) {
          console.error(`[CRON 2] Failed to record error for post ${post.id}:`, recordError)
        }
      }
    }

    // Calculate average score
    if (result.summary.reviewed > 0) {
      result.summary.averageScore = Math.round((totalScore / result.summary.reviewed) * 10) / 10
    }

    result.success = true
    console.log("[CRON 2] Job complete!")
    console.log(`[CRON 2] Summary: ${JSON.stringify(result.summary, null, 2)}`)

    // Mark pipeline stage as completed
    if (pipelineRunId) {
      await completeStage(pipelineRunId, result.summary, result.errors)
    }

    return NextResponse.json(result)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error("[CRON 2] Fatal error:", errorMsg)
    result.errors.push(errorMsg)

    // Mark pipeline stage as failed
    if (pipelineRunId) {
      await failStage(pipelineRunId, result.errors)
    }

    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: errorMsg,
        summary: result.summary,
        reviews: result.reviews,
        errors: result.errors,
      },
      { status: 500 }
    )
  }
}
