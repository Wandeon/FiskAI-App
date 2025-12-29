/**
 * CRON 3: Publish (runs at 00:00)
 *
 * Process:
 * 1. Get all news_posts with status='reviewing'
 * 2. For each post:
 *    - If review score < 7: call rewriter with feedback
 *    - Generate excerpt if not present
 *    - Store final in ai_passes.final
 *    - Update status='published', published_at=today 06:00
 * 3. Assemble digest post from medium-impact items
 * 4. Create digest post with status='published'
 */

import { NextRequest, NextResponse } from "next/server"
import { drizzleDb } from "@/lib/db/drizzle"
import { newsPosts, newsItems, newsPostSources } from "@/lib/db/schema"
import {
  rewriteArticle,
  needsRewrite,
  assembleDigest,
  recordNewsPostError,
  MAX_PROCESSING_ATTEMPTS,
  type ReviewFeedback,
  type RewriteResult,
} from "@/lib/news/pipeline"
import { generateUniqueSlug } from "@/lib/news/slug"
import { eq, and, isNull, lt, sql } from "drizzle-orm"

export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 minutes

interface PublishResult {
  success: boolean
  summary: {
    totalReviewing: number
    retryPosts: number
    rewritten: number
    published: number
    digestCreated: boolean
    digestItemCount: number
    failedPosts: number
  }
  published: Array<{
    postId: string
    title: string
    wasRewritten: boolean
    publishedAt: string
  }>
  errors: string[]
}

/**
 * Generate excerpt from content if missing
 */
function generateExcerptFromContent(content: string, maxLength: number = 200): string {
  // Remove markdown formatting
  const plainText = content
    .replace(/#{1,6}\s/g, "") // Remove headers
    .replace(/\*\*(.+?)\*\*/g, "$1") // Remove bold
    .replace(/\*(.+?)\*/g, "$1") // Remove italic
    .replace(/\[(.+?)\]\(.+?\)/g, "$1") // Remove links
    .replace(/```[\s\S]*?```/g, "") // Remove code blocks
    .replace(/`(.+?)`/g, "$1") // Remove inline code
    .trim()

  // Take first sentence or maxLength characters
  const firstSentence = plainText.match(/^[^.!?]+[.!?]/)?.[0] || plainText

  if (firstSentence.length <= maxLength) {
    return firstSentence
  }

  return firstSentence.substring(0, maxLength).trim() + "..."
}


/**
 * Main handler
 */
export async function GET(request: NextRequest) {
  console.log("[CRON 3] Starting publish job...")

  const result: PublishResult = {
    success: false,
    summary: {
      totalReviewing: 0,
      retryPosts: 0,
      rewritten: 0,
      published: 0,
      digestCreated: false,
      digestItemCount: 0,
      failedPosts: 0,
    },
    published: [],
    errors: [],
  }

  try {
    // 1. Verify authorization
    const authHeader = request.headers.get("authorization")
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

    if (!authHeader || authHeader !== expectedAuth) {
      console.error("[CRON 3] Unauthorized request")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. Get all news_posts with status='reviewing' (including retry-eligible posts)
    console.log("[CRON 3] Fetching posts under review...")

    // Get new reviewing posts
    const newReviewingPosts = await drizzleDb
      .select()
      .from(newsPosts)
      .where(
        and(
          eq(newsPosts.status, "reviewing"),
          sql`${newsPosts.processingAttempts} = 0 OR ${newsPosts.processingAttempts} IS NULL`
        )
      )

    // Get posts that failed during publish but are eligible for retry
    const retryPosts = await drizzleDb
      .select()
      .from(newsPosts)
      .where(
        and(
          eq(newsPosts.status, "reviewing"),
          lt(newsPosts.processingAttempts, MAX_PROCESSING_ATTEMPTS),
          sql`${newsPosts.processingAttempts} > 0`
        )
      )

    // Combine both sets
    const postsMap = new Map<string, typeof newReviewingPosts[0]>()
    for (const post of newReviewingPosts) {
      postsMap.set(post.id, post)
    }
    for (const post of retryPosts) {
      postsMap.set(post.id, post)
    }
    const reviewingPosts = Array.from(postsMap.values())

    result.summary.totalReviewing = newReviewingPosts.length
    result.summary.retryPosts = retryPosts.length
    console.log(`[CRON 3] Found ${newReviewingPosts.length} new posts + ${retryPosts.length} retry posts to publish`)

    // 3. Process each post
    for (const post of reviewingPosts) {
      try {
        console.log(`[CRON 3] Processing: ${post.title}`)

        let finalTitle = post.title
        let finalContent = post.content
        let finalExcerpt = post.excerpt
        let wasRewritten = false

        const aiPasses =
          typeof post.aiPasses === "object" && post.aiPasses !== null
            ? (post.aiPasses as Record<string, any>)
            : {}

        const reviewData = aiPasses.review as ReviewFeedback | undefined

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

        // Check if rewrite is needed (low score or factual issues)
        if (reviewData && needsRewrite(reviewData)) {
          try {
            console.log(`[CRON 3] Rewriting post (score ${reviewData.score}/10): ${post.title}`)

            const rewritten = await rewriteArticle(
              { title: post.title, content: post.content },
              reviewData,
              source
            )

            finalTitle = rewritten.title
            finalContent = rewritten.content
            finalExcerpt = rewritten.excerpt
            wasRewritten = true

            result.summary.rewritten++
            console.log(`[CRON 3] Rewrite complete: ${finalTitle}`)
          } catch (error) {
            const errorMsg = `Failed to rewrite post ${post.id}: ${error instanceof Error ? error.message : String(error)}`
            console.error(`[CRON 3] ${errorMsg}`)
            result.errors.push(errorMsg)
            // Continue with original content
          }
        }

        // Generate excerpt if not present
        if (!finalExcerpt || finalExcerpt.trim().length === 0) {
          finalExcerpt = generateExcerptFromContent(finalContent)
          console.log(`[CRON 3] Generated excerpt: ${finalExcerpt.substring(0, 50)}...`)
        }

        // Set published_at to today at 06:00
        const publishedAt = new Date()
        publishedAt.setHours(6, 0, 0, 0)

        // Update post with final content and publish
        await drizzleDb
          .update(newsPosts)
          .set({
            title: finalTitle,
            content: finalContent,
            excerpt: finalExcerpt,
            status: "published",
            publishedAt,
            aiPasses: {
              ...aiPasses,
              final: {
                timestamp: new Date().toISOString(),
                title: finalTitle,
                content: finalContent,
                excerpt: finalExcerpt,
                wasRewritten,
                reviewScore: reviewData?.score,
              },
            },
            updatedAt: new Date(),
          })
          .where(eq(newsPosts.id, post.id))

        result.summary.published++
        result.published.push({
          postId: post.id,
          title: finalTitle,
          wasRewritten,
          publishedAt: publishedAt.toISOString(),
        })

        console.log(`[CRON 3] Published: ${finalTitle}`)
      } catch (error) {
        const errorMsg = `Failed to publish post ${post.id} (${post.title}): ${error instanceof Error ? error.message : String(error)}`
        console.error(`[CRON 3] ${errorMsg}`)
        result.errors.push(errorMsg)

        // Record the error for retry tracking
        try {
          const { shouldRetry, attempts } = await recordNewsPostError(post.id, error instanceof Error ? error : String(error))
          if (shouldRetry) {
            console.log(`[CRON 3] Post ${post.id} will be retried (attempt ${attempts}/${MAX_PROCESSING_ATTEMPTS})`)
          } else {
            console.log(`[CRON 3] Post ${post.id} moved to dead-letter queue after ${attempts} attempts`)
            result.summary.failedPosts++
          }
        } catch (recordError) {
          console.error(`[CRON 3] Failed to record error for post ${post.id}:`, recordError)
        }
      }
    }

    // 4. Assemble digest from medium-impact items
    console.log("[CRON 3] Assembling daily digest...")

    try {
      // Get medium-impact items that are processed but not assigned to a post
      const mediumItems = await drizzleDb
        .select()
        .from(newsItems)
        .where(
          and(
            eq(newsItems.impactLevel, "medium"),
            eq(newsItems.status, "processed"),
            isNull(newsItems.assignedToPostId)
          )
        )

      console.log(`[CRON 3] Found ${mediumItems.length} medium-impact items for digest`)

      if (mediumItems.length > 0) {
        const digestItems = mediumItems.map((item) => ({
          id: item.id,
          title: item.originalTitle,
          summary: item.summaryHr || item.originalContent?.substring(0, 200) || "",
          sourceUrl: item.sourceUrl,
        }))

        const digest = await assembleDigest(digestItems)

        // Create digest post with unique slug
        const digestSlug = await generateUniqueSlug(digest.title)
        const publishedAt = new Date()
        publishedAt.setHours(6, 0, 0, 0)

        const [digestPost] = await drizzleDb
          .insert(newsPosts)
          .values({
            slug: digestSlug,
            type: "digest",
            title: digest.title,
            content: digest.content,
            excerpt: digest.intro,
            impactLevel: "medium",
            status: "published",
            publishedAt,
            aiPasses: {
              digest: {
                timestamp: new Date().toISOString(),
                intro: digest.intro,
                sections: digest.sections,
                itemCount: mediumItems.length,
              },
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning()

        // Link medium-impact items to digest post
        for (const item of mediumItems) {
          await drizzleDb.insert(newsPostSources).values({
            postId: digestPost.id,
            newsItemId: item.id,
          })

          await drizzleDb
            .update(newsItems)
            .set({
              assignedToPostId: digestPost.id,
              updatedAt: new Date(),
            })
            .where(eq(newsItems.id, item.id))
        }

        result.summary.digestCreated = true
        result.summary.digestItemCount = mediumItems.length

        console.log(`[CRON 3] Digest created: ${digest.title} (${mediumItems.length} items)`)
      } else {
        console.log("[CRON 3] No medium-impact items for digest")
      }
    } catch (error) {
      const errorMsg = `Failed to create digest: ${error instanceof Error ? error.message : String(error)}`
      console.error(`[CRON 3] ${errorMsg}`)
      result.errors.push(errorMsg)
    }

    result.success = true
    console.log("[CRON 3] Job complete!")
    console.log(`[CRON 3] Summary: ${JSON.stringify(result.summary, null, 2)}`)

    return NextResponse.json(result)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error("[CRON 3] Fatal error:", errorMsg)
    result.errors.push(errorMsg)

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: errorMsg,
        summary: result.summary,
        published: result.published,
        errors: result.errors,
      },
      { status: 500 }
    )
  }
}
