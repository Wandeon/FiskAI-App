// src/lib/news/fetcher.ts
import { drizzleDb } from "@/lib/db/drizzle"
import { newsSources, newsItems } from "@/lib/db/schema"
import { eq, and, lt, sql } from "drizzle-orm"
import Parser from "rss-parser"
import { summarizeNews } from "./ai-processor"
import type { NewsSource, NewNewsItem } from "@/lib/db/schema"

const parser = new Parser({
  customFields: {
    item: [
      ["content:encoded", "contentEncoded"],
      ["description", "description"],
    ],
  },
})

/**
 * Get all active news sources from the database
 */
export async function getActiveSources(): Promise<NewsSource[]> {
  return drizzleDb.select().from(newsSources).where(eq(newsSources.isActive, true))
}

/**
 * Get sources that need to be fetched (based on fetchIntervalHours)
 */
export async function getSourcesDueForFetch(): Promise<NewsSource[]> {
  const now = new Date()

  return drizzleDb
    .select()
    .from(newsSources)
    .where(
      and(
        eq(newsSources.isActive, true),
        sql`${newsSources.lastFetchedAt} IS NULL OR ${newsSources.lastFetchedAt} < ${new Date(now.getTime() - 60 * 60 * 1000)}::timestamp`
      )
    )
}

/**
 * Fetch news from an RSS feed
 */
export async function fetchFromRSS(source: NewsSource): Promise<NewNewsItem[]> {
  if (!source.feedUrl) {
    throw new Error(`RSS feed URL not configured for source: ${source.id}`)
  }

  try {
    const feed = await parser.parseURL(source.feedUrl)
    const items: NewNewsItem[] = []

    for (const item of feed.items) {
      if (!item.title || !item.link) continue

      // Get content from either content:encoded or description
      const content =
        (item as any).contentEncoded || (item as any).description || item.content || ""

      items.push({
        sourceId: source.id,
        originalTitle: item.title,
        originalContent: content.substring(0, 10000), // Limit content length
        sourceUrl: item.link,
        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        fetchedAt: new Date(),
        status: "pending",
      })
    }

    return items
  } catch (error) {
    console.error(`Error fetching RSS for ${source.id}:`, error)
    throw error
  }
}

/**
 * Fetch news from a web page using scraping
 * Note: This is a placeholder - actual implementation would need a web scraping library
 */
export async function fetchFromScrape(source: NewsSource): Promise<NewNewsItem[]> {
  console.warn(
    `Web scraping not fully implemented for source: ${source.id}. Use RSS feeds instead.`
  )
  return []
}

/**
 * Fetch news from a single source based on its type
 */
export async function fetchFromSource(source: NewsSource): Promise<NewNewsItem[]> {
  if (source.feedType === "rss") {
    return fetchFromRSS(source)
  } else if (source.feedType === "scrape") {
    return fetchFromScrape(source)
  }

  throw new Error(`Unknown feed type: ${source.feedType}`)
}

/**
 * Save news items to database with conflict handling (skip duplicates)
 */
export async function saveNewsItems(
  items: NewNewsItem[]
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0
  let skipped = 0

  for (const item of items) {
    try {
      // Check if item already exists (by URL)
      const existing = await drizzleDb
        .select()
        .from(newsItems)
        .where(eq(newsItems.sourceUrl, item.sourceUrl))
        .limit(1)

      if (existing.length > 0) {
        skipped++
        continue
      }

      // Insert new item
      await drizzleDb.insert(newsItems).values(item)
      inserted++
    } catch (error) {
      console.error(`Error saving news item:`, error)
      skipped++
    }
  }

  return { inserted, skipped }
}

/**
 * Update the lastFetchedAt timestamp for a source
 */
export async function updateSourceLastFetched(
  sourceId: string,
  success: boolean = true,
  error?: string
): Promise<void> {
  const updateData: any = {
    lastFetchedAt: new Date(),
    updatedAt: new Date(),
  }

  if (success) {
    updateData.lastSuccessAt = new Date()
    updateData.lastError = null
  } else if (error) {
    updateData.lastError = error
  }

  await drizzleDb.update(newsSources).set(updateData).where(eq(newsSources.id, sourceId))
}

/**
 * Process unprocessed news items with AI summarization
 */
export async function processUnprocessedNews(
  limit: number = 10
): Promise<{ processed: number; failed: number }> {
  // Get pending items
  const unprocessed = await drizzleDb
    .select()
    .from(newsItems)
    .where(eq(newsItems.status, "pending"))
    .limit(limit)

  let processed = 0
  let failed = 0

  for (const item of unprocessed) {
    try {
      // Summarize with AI
      const summary = await summarizeNews(item.originalContent || "", item.originalTitle)

      // Update the item
      await drizzleDb
        .update(newsItems)
        .set({
          summaryHr: summary.summaryHr,
          categories: summary.categories,
          relevanceScore: String(summary.relevanceScore),
          status: "processed",
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(newsItems.id, item.id))

      processed++
    } catch (error) {
      console.error(`Error processing news item ${item.id}:`, error)
      failed++
    }
  }

  return { processed, failed }
}

/**
 * Main orchestrator function to fetch all news from active sources
 */
export async function fetchAllNews(): Promise<{
  totalFetched: number
  totalInserted: number
  totalSkipped: number
  errors: string[]
}> {
  const sources = await getSourcesDueForFetch()
  let totalFetched = 0
  let totalInserted = 0
  let totalSkipped = 0
  const errors: string[] = []

  for (const source of sources) {
    try {
      console.log(`Fetching news from: ${source.name}`)

      const items = await fetchFromSource(source)
      totalFetched += items.length

      const { inserted, skipped } = await saveNewsItems(items)
      totalInserted += inserted
      totalSkipped += skipped

      await updateSourceLastFetched(source.id, true)

      console.log(
        `✓ ${source.name}: Fetched ${items.length}, Inserted ${inserted}, Skipped ${skipped}`
      )
    } catch (error) {
      const errorMsg = `Failed to fetch from ${source.name}: ${error instanceof Error ? error.message : String(error)}`
      errors.push(errorMsg)
      console.error(errorMsg)

      await updateSourceLastFetched(
        source.id,
        false,
        error instanceof Error ? error.message : String(error)
      )
    }
  }

  return {
    totalFetched,
    totalInserted,
    totalSkipped,
    errors,
  }
}
