// src/lib/news/fetcher.ts
import { drizzleDb } from "@/lib/db/drizzle"
import { newsSources, newsItems } from "@/lib/db/schema"
import { eq, and, sql } from "drizzle-orm"
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
 */
export async function fetchFromScrape(source: NewsSource): Promise<NewNewsItem[]> {
  const { JSDOM } = await import("jsdom")

  const scrapeConfigs: Record<
    string,
    {
      newsUrl: string
      itemSelector: string
      titleSelector: string
      linkSelector: string
      dateSelector?: string
      contentSelector?: string
    }
  > = {
    "porezna-uprava": {
      newsUrl: "https://porezna-uprava.gov.hr/novosti/33",
      itemSelector: ".news.box-border",
      titleSelector: ".link_vijest",
      linkSelector: ".link_vijest",
      dateSelector: ".datum_vijest",
    },
    fina: {
      newsUrl: "https://www.fina.hr/novosti",
      itemSelector: ".news-item, article",
      titleSelector: "h3 a, .title a",
      linkSelector: "h3 a, .title a",
      dateSelector: ".date, time",
    },
    hgk: {
      newsUrl: "https://www.hgk.hr/vijesti",
      itemSelector: ".news-card, .vijest-item",
      titleSelector: "h3, .title",
      linkSelector: "a",
      dateSelector: ".date, time",
    },
    "narodne-novine": {
      newsUrl: "https://narodne-novine.nn.hr/clanci/sluzbeni/",
      itemSelector: ".document-item, .nn-item, tr",
      titleSelector: "a",
      linkSelector: "a",
      dateSelector: ".date, td:first-child",
    },
  }

  const config = scrapeConfigs[source.id]
  if (!config) {
    console.warn(`No scrape config for source: ${source.id}`)
    return []
  }

  try {
    const response = await fetch(config.newsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FiskAI/1.0; +https://fiskai.eu)",
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()
    const dom = new JSDOM(html)
    const doc = dom.window.document

    const items: NewNewsItem[] = []
    const newsElements = doc.querySelectorAll(config.itemSelector)

    for (const el of Array.from(newsElements).slice(0, 20)) {
      const titleEl = el.querySelector(config.titleSelector)
      const linkEl = el.querySelector(config.linkSelector) as HTMLAnchorElement
      const dateEl = config.dateSelector ? el.querySelector(config.dateSelector) : null

      const title = titleEl?.textContent?.trim()
      let link = linkEl?.href || linkEl?.getAttribute("href")

      if (!title || !link) continue

      // Make relative URLs absolute
      if (link.startsWith("/")) {
        const baseUrl = new URL(config.newsUrl)
        link = `${baseUrl.origin}${link}`
      }

      const dateText = dateEl?.textContent?.trim()
      let publishedAt = new Date()
      if (dateText) {
        const parsed = new Date(dateText)
        if (!isNaN(parsed.getTime())) {
          publishedAt = parsed
        }
      }

      items.push({
        sourceId: source.id,
        originalTitle: title,
        originalContent: "",
        sourceUrl: link,
        publishedAt,
        fetchedAt: new Date(),
        status: "pending",
      })
    }

    return items
  } catch (error) {
    console.error(`Error scraping ${source.id}:`, error)
    return []
  }
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
export async function updateSourceLastFetched(sourceId: string): Promise<void> {
  await drizzleDb
    .update(newsSources)
    .set({
      lastFetchedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(newsSources.id, sourceId))
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

      await updateSourceLastFetched(source.id)

      console.log(
        `✓ ${source.name}: Fetched ${items.length}, Inserted ${inserted}, Skipped ${skipped}`
      )
    } catch (error) {
      const errorMsg = `Failed to fetch from ${source.name}: ${error instanceof Error ? error.message : String(error)}`
      errors.push(errorMsg)
      console.error(errorMsg)
    }
  }

  return {
    totalFetched,
    totalInserted,
    totalSkipped,
    errors,
  }
}
