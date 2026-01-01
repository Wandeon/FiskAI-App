/**
 * CRON 1: Fetch & Classify (runs at 23:00)
 *
 * Process:
 * 1. Fetch RSS from all active sources
 * 2. Filter items from today only
 * 3. Classify each item (high/medium/low impact)
 * 4. For high-impact: write article & create draft post
 * 5. For medium-impact: write digest entry & store for assembly
 * 6. Extract and store images from RSS
 */
import { NextRequest, NextResponse } from "next/server"
import { drizzleDb } from "@/lib/db/drizzle"
import { newsItems, newsPosts, newsPostSources } from "@/lib/db/schema"
import { fetchAllNews } from "@/lib/news/fetcher"
import {
  classifyNewsItem,
  writeArticle,
  recordNewsItemError,
  checkAndStartStage,
  completeStage,
  failStage,
  MAX_PROCESSING_ATTEMPTS,
} from "@/lib/news/pipeline"
import { eq, and, gte, lt, sql } from "drizzle-orm"
import { generateUniqueSlug } from "@/lib/news/slug"
import { enqueueArticleJob } from "@/lib/article-agent/queue"
import { isValidationError, formatValidationError } from "@/lib/api/validation"
export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 minutes
interface FetchClassifyResult {
  success: boolean
  summary: {
    fetched: number
    inserted: number
    skipped: number
    todayItems: number
    retryItems: number
    classified: {
      high: number
      medium: number
      low: number
    }
    postsCreated: {
      highImpact: number
      mediumImpact: number
    }
    articleJobsQueued: number
    failedItems: number
  }
  errors: string[]
}
/**
 * Extract image URL and source from RSS item
 */
function extractImageFromRSS(item: any): { url?: string; source?: string } {
  try {
    // Priority 1: media:content
    if (item["media:content"]) {
      const mediaContent = Array.isArray(item["media:content"])
        ? item["media:content"][0]
        : item["media:content"]
      if (mediaContent?.$ && mediaContent.$.url) {
        return { url: mediaContent.$.url, source: "media:content" }
      }
    }
    // Priority 2: enclosure
    if (item.enclosure && item.enclosure.url) {
      return { url: item.enclosure.url, source: "enclosure" }
    }
    // Priority 3: Parse content:encoded or description for <img> tags
    const content = item["content:encoded"] || item.description || ""
    if (typeof content === "string") {
      const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i)
      if (imgMatch && imgMatch[1]) {
        return { url: imgMatch[1], source: "content-img" }
      }
    }
    return {}
  } catch (error) {
    console.error("Error extracting image from RSS:", error)
    return {}
  }
}
/**
 * Main handler
 */
export async function GET(request: NextRequest) {
  console.log("[CRON 1] Starting fetch-classify job...")
  const result: FetchClassifyResult = {
    success: false,
    summary: {
      fetched: 0,
      inserted: 0,
      skipped: 0,
      todayItems: 0,
      retryItems: 0,
      classified: { high: 0, medium: 0, low: 0 },
      postsCreated: { highImpact: 0, mediumImpact: 0 },
      articleJobsQueued: 0,
      failedItems: 0,
    },
    errors: [],
  }

  let pipelineRunId: string | undefined

  try {
    // 1. Verify authorization
    const authHeader = request.headers.get("authorization")
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`
    if (!authHeader || authHeader !== expectedAuth) {
      console.error("[CRON 1] Unauthorized request")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 1.5. Check pipeline coordination (fetch-classify has no dependencies)
    const pipelineCheck = await checkAndStartStage("fetch-classify")
    if (!pipelineCheck.canProceed) {
      console.log(`[CRON 1] Cannot proceed: ${pipelineCheck.reason}`)
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

    // 2. Fetch RSS from all active sources
    console.log("[CRON 1] Fetching news from active sources...")
    const fetchResult = await fetchAllNews()
    result.summary.fetched = fetchResult.totalFetched
    result.summary.inserted = fetchResult.totalInserted
    result.summary.skipped = fetchResult.totalSkipped
    result.errors.push(...fetchResult.errors)
    console.log(`[CRON 1] Fetch complete: ${fetchResult.totalInserted} new items`)
    // 3. Filter items from today only (published_at >= today 00:00)
    // Also include items that failed previously but are eligible for retry
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    // Get new items from today
    const newTodayItems = await drizzleDb
      .select()
      .from(newsItems)
      .where(
        and(
          eq(newsItems.status, "pending"),
          gte(newsItems.publishedAt, todayStart),
          sql`${newsItems.impactLevel} IS NULL` // Not yet classified
        )
      )
    // Get items that failed but are eligible for retry (under max attempts)
    const retryItems = await drizzleDb
      .select()
      .from(newsItems)
      .where(
        and(
          eq(newsItems.status, "pending"),
          lt(newsItems.processingAttempts, MAX_PROCESSING_ATTEMPTS),
          sql`${newsItems.processingAttempts} > 0` // Has been attempted before
        )
      )
    // Combine both sets (avoid duplicates by using a Map)
    const itemsMap = new Map<string, (typeof newTodayItems)[0]>()
    for (const item of newTodayItems) {
      itemsMap.set(item.id, item)
    }
    for (const item of retryItems) {
      itemsMap.set(item.id, item)
    }
    const todayItems = Array.from(itemsMap.values())
    result.summary.todayItems = newTodayItems.length
    result.summary.retryItems = retryItems.length
    console.log(
      `[CRON 1] Processing ${newTodayItems.length} new items + ${retryItems.length} retry items...`
    )
    if (todayItems.length === 0) {
      result.success = true
      console.log("[CRON 1] No items to process. Job complete.")
      return NextResponse.json(result)
    }
    // 4. Classify each item
    for (const item of todayItems) {
      try {
        console.log(`[CRON 1] Classifying: ${item.originalTitle}`)
        const classification = await classifyNewsItem(item)
        // Update news_items with impact_level
        await drizzleDb
          .update(newsItems)
          .set({
            impactLevel: classification.impact,
            updatedAt: new Date(),
          })
          .where(eq(newsItems.id, item.id))
        // Track classification counts
        result.summary.classified[classification.impact]++
        console.log(`[CRON 1] Classified as ${classification.impact}: ${item.originalTitle}`)
        // 5. Handle high-impact items: write article & create draft post
        if (classification.impact === "high") {
          try {
            console.log(`[CRON 1] Writing article for high-impact: ${item.originalTitle}`)
            const article = await writeArticle(item, "high")
            // Create news_posts record with unique slug
            const slug = await generateUniqueSlug(article.title)
            const [post] = await drizzleDb
              .insert(newsPosts)
              .values({
                slug,
                type: "individual",
                title: article.title,
                content: article.content,
                excerpt: article.excerpt,
                categoryId: classification.suggestedCategory || "poslovanje",
                impactLevel: "high",
                status: "draft",
                aiPasses: {
                  write: {
                    timestamp: new Date().toISOString(),
                    title: article.title,
                    content: article.content,
                    excerpt: article.excerpt,
                    classification: classification,
                  },
                },
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              .returning()
            // Link news_item to post
            await drizzleDb.insert(newsPostSources).values({
              postId: post.id,
              newsItemId: item.id,
            })
            // Update news_item with assignment
            await drizzleDb
              .update(newsItems)
              .set({
                assignedToPostId: post.id,
                status: "processed",
                processedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(newsItems.id, item.id))
            result.summary.postsCreated.highImpact++
            console.log(`[CRON 1] Created draft post: ${article.title}`)
            // Optionally queue Article Agent job for enhanced fact-checking
            // Only if ARTICLE_AGENT_ENABLED is set (disabled by default to avoid duplicate processing)
            if (process.env.ARTICLE_AGENT_ENABLED === "true") {
              try {
                const queueResult = await enqueueArticleJob({
                  type: "NEWS",
                  sourceUrls: [item.sourceUrl],
                  topic: item.originalTitle,
                  triggeredBy: "news-cron",
                  newsItemId: item.id,
                })
                if (queueResult.success) {
                  result.summary.articleJobsQueued++
                  console.log(`[CRON 1] Queued Article Agent job: ${queueResult.queueJobId}`)
                }
              } catch (articleError) {
                // Non-blocking - log and continue
                console.warn(`[CRON 1] Failed to queue Article Agent job:`, articleError)
              }
            }
          } catch (error) {
            const errorMsg = `Failed to write article for ${item.id}: ${error instanceof Error ? error.message : String(error)}`
            console.error(`[CRON 1] ${errorMsg}`)
            result.errors.push(errorMsg)
          }
        }
        // 6. Handle medium-impact items: write digest entry
        if (classification.impact === "medium") {
          try {
            console.log(`[CRON 1] Writing digest entry for medium-impact: ${item.originalTitle}`)
            const digestEntry = await writeArticle(item, "medium")
            // Update news_item with digest entry data
            await drizzleDb
              .update(newsItems)
              .set({
                summaryHr: digestEntry.excerpt, // Store digest summary
                status: "processed",
                processedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(newsItems.id, item.id))
            result.summary.postsCreated.mediumImpact++
            console.log(`[CRON 1] Stored digest entry: ${item.originalTitle}`)
          } catch (error) {
            const errorMsg = `Failed to write digest entry for ${item.id}: ${error instanceof Error ? error.message : String(error)}`
            console.error(`[CRON 1] ${errorMsg}`)
            result.errors.push(errorMsg)
          }
        }
        // 7. Handle low-impact items: mark as processed but skip
        if (classification.impact === "low") {
          await drizzleDb
            .update(newsItems)
            .set({
              status: "processed",
              processedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(newsItems.id, item.id))
        }
      } catch (error) {
        const errorMsg = `Failed to process item ${item.id}: ${error instanceof Error ? error.message : String(error)}`
        console.error(`[CRON 1] ${errorMsg}`)
        result.errors.push(errorMsg)
        // Record the error for retry tracking
        try {
          const { shouldRetry, attempts } = await recordNewsItemError(
            item.id,
            error instanceof Error ? error : String(error)
          )
          if (shouldRetry) {
            console.log(
              `[CRON 1] Item ${item.id} will be retried (attempt ${attempts}/${MAX_PROCESSING_ATTEMPTS})`
            )
          } else {
            console.log(
              `[CRON 1] Item ${item.id} moved to dead-letter queue after ${attempts} attempts`
            )
            result.summary.failedItems++
          }
        } catch (recordError) {
          console.error(`[CRON 1] Failed to record error for item ${item.id}:`, recordError)
        }
      }
    }
    result.success = true
    console.log("[CRON 1] Job complete!")
    console.log(`[CRON 1] Summary: ${JSON.stringify(result.summary, null, 2)}`)

    // Mark pipeline stage as completed
    if (pipelineRunId) {
      await completeStage(pipelineRunId, result.summary, result.errors)
    }

    return NextResponse.json(result)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error("[CRON 1] Fatal error:", errorMsg)
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
        errors: result.errors,
      },
      { status: 500 }
    )
  }
}
