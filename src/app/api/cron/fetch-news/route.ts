// src/app/api/cron/fetch-news/route.ts
import { NextRequest, NextResponse } from "next/server"
import { drizzleDb } from "@/lib/db/drizzle"
import { newsItems } from "@/lib/db/schema/news"
import { eq } from "drizzle-orm"
import { fetchAllNews } from "@/lib/news/fetcher"
import { summarizeNews } from "@/lib/news/ai-processor"

export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 minutes for fetching and processing

/**
 * GET /api/cron/fetch-news
 *
 * Cron job endpoint for fetching and processing news
 *
 * Authorization: Bearer <CRON_SECRET>
 *
 * This endpoint:
 * 1. Fetches news from all active sources
 * 2. Processes up to 10 pending items with AI
 * 3. Returns summary of work done
 */
export async function GET(request: NextRequest) {
  try {
    // Verify CRON_SECRET
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const timestamp = new Date().toISOString()
    console.log(`\n${"=".repeat(60)}`)
    console.log(`News Fetch Cron Job Started: ${timestamp}`)
    console.log("=".repeat(60) + "\n")

    // Step 1: Fetch news from all active sources
    console.log("STEP 1: Fetching news from active sources...\n")
    const fetchResult = await fetchAllNews()

    console.log("\n" + "-".repeat(60))
    console.log("Fetch Results:")
    console.log(`  - Total fetched: ${fetchResult.totalFetched}`)
    console.log(`  - New items inserted: ${fetchResult.totalInserted}`)
    console.log(`  - Duplicates skipped: ${fetchResult.totalSkipped}`)
    console.log(`  - Errors: ${fetchResult.totalErrors}`)
    console.log("-".repeat(60) + "\n")

    // Step 2: Process pending items with AI (limit 10 per run)
    console.log("STEP 2: Processing pending items with AI...\n")

    const pendingItems = await drizzleDb
      .select()
      .from(newsItems)
      .where(eq(newsItems.status, "pending"))
      .limit(10)

    console.log(`Found ${pendingItems.length} pending items to process\n`)

    let processedCount = 0
    let processingErrors = 0

    for (const item of pendingItems) {
      try {
        console.log(`  Processing: ${item.originalTitle.substring(0, 60)}...`)

        // Use AI to summarize and categorize
        const aiResult = await summarizeNews(item.originalContent || "", item.originalTitle)

        // Update item with AI results
        await drizzleDb
          .update(newsItems)
          .set({
            summaryHr: aiResult.summaryHr,
            categories: aiResult.categories,
            relevanceScore: aiResult.relevanceScore.toString(),
            processedAt: new Date(),
            status: "processed",
            updatedAt: new Date(),
          })
          .where(eq(newsItems.id, item.id))

        processedCount++
        console.log(`    Processed (relevance: ${aiResult.relevanceScore.toFixed(2)})`)

        // Add a small delay to avoid rate limiting
        if (processedCount < pendingItems.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      } catch (error) {
        processingErrors++
        console.error(`    Error processing item:`, error)
        // Continue with next item even if one fails
      }
    }

    console.log("\n" + "-".repeat(60))
    console.log("Processing Results:")
    console.log(`  - Items processed: ${processedCount}`)
    console.log(`  - Processing errors: ${processingErrors}`)
    console.log("-".repeat(60) + "\n")

    const endTimestamp = new Date().toISOString()
    console.log("=".repeat(60))
    console.log(`News Fetch Cron Job Completed: ${endTimestamp}`)
    console.log("=".repeat(60) + "\n")

    // Return summary
    return NextResponse.json({
      success: true,
      timestamp,
      fetched: {
        total: fetchResult.totalFetched,
        inserted: fetchResult.totalInserted,
        skipped: fetchResult.totalSkipped,
        errors: fetchResult.totalErrors,
        sources: fetchResult.sourceResults,
      },
      processed: {
        total: processedCount,
        errors: processingErrors,
        pending: pendingItems.length - processedCount,
      },
    })
  } catch (error) {
    console.error("\nFatal error in news fetch cron job:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
