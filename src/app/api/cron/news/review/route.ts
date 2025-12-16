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
import { newsPosts } from "@/lib/db/schema"
import { reviewArticle, type ReviewFeedback } from "@/lib/news/pipeline"
import { eq } from "drizzle-orm"

export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 minutes

interface ReviewResult {
  success: boolean
  summary: {
    totalDrafts: number
    reviewed: number
    averageScore: number
    needsRewrite: number
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
      reviewed: 0,
      averageScore: 0,
      needsRewrite: 0,
    },
    reviews: [],
    errors: [],
  }

  try {
    // 1. Verify authorization
    const authHeader = request.headers.get("authorization")
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

    if (!authHeader || authHeader !== expectedAuth) {
      console.error("[CRON 2] Unauthorized request")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. Get all news_posts with status='draft'
    console.log("[CRON 2] Fetching draft posts...")

    const draftPosts = await drizzleDb.select().from(newsPosts).where(eq(newsPosts.status, "draft"))

    result.summary.totalDrafts = draftPosts.length
    console.log(`[CRON 2] Found ${draftPosts.length} draft posts to review`)

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

        // Call reviewer
        const feedback = await reviewArticle({
          title: post.title,
          content: post.content,
        })

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
                problems: feedback.problems,
                suggestions: feedback.suggestions,
                rewrite_focus: feedback.rewrite_focus,
              },
            },
            updatedAt: new Date(),
          })
          .where(eq(newsPosts.id, post.id))

        const needsRewrite = feedback.score < 7
        if (needsRewrite) {
          result.summary.needsRewrite++
        }

        result.reviews.push({
          postId: post.id,
          title: post.title,
          score: feedback.score,
          needsRewrite,
        })

        result.summary.reviewed++

        console.log(`[CRON 2] Reviewed: ${post.title} - Score: ${feedback.score}/10`)
      } catch (error) {
        const errorMsg = `Failed to review post ${post.id} (${post.title}): ${error instanceof Error ? error.message : String(error)}`
        console.error(`[CRON 2] ${errorMsg}`)
        result.errors.push(errorMsg)
      }
    }

    // Calculate average score
    if (result.summary.reviewed > 0) {
      result.summary.averageScore = Math.round((totalScore / result.summary.reviewed) * 10) / 10
    }

    result.success = true
    console.log("[CRON 2] Job complete!")
    console.log(`[CRON 2] Summary: ${JSON.stringify(result.summary, null, 2)}`)

    return NextResponse.json(result)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error("[CRON 2] Fatal error:", errorMsg)
    result.errors.push(errorMsg)

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
