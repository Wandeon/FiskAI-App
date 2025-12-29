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

// ============================================================================
// Scrape Health Monitoring
// ============================================================================

interface ScrapeHealth {
  consecutiveFailures: number
  lastSuccessCount: number
  lastSuccessAt: Date | null
  lastError: string | null
}

const scrapeHealthMap = new Map<string, ScrapeHealth>()

function getScrapeHealth(sourceId: string): ScrapeHealth {
  if (!scrapeHealthMap.has(sourceId)) {
    scrapeHealthMap.set(sourceId, {
      consecutiveFailures: 0,
      lastSuccessCount: 0,
      lastSuccessAt: null,
      lastError: null,
    })
  }
  return scrapeHealthMap.get(sourceId)!
}

function recordScrapeSuccess(sourceId: string, itemCount: number): void {
  const health = getScrapeHealth(sourceId)
  health.consecutiveFailures = 0
  health.lastSuccessCount = itemCount
  health.lastSuccessAt = new Date()
  health.lastError = null
}

function recordScrapeFailure(sourceId: string, error: string): void {
  const health = getScrapeHealth(sourceId)
  health.consecutiveFailures++
  health.lastError = error

  if (health.consecutiveFailures >= 3) {
    console.warn(
      `[SCRAPE_ALERT] Source "${sourceId}" has failed ${health.consecutiveFailures} consecutive times. ` +
        `Last error: ${error}. Last success: ${health.lastSuccessAt?.toISOString() || "never"}`
    )
  }
}

/**
 * Get scrape health status for all sources (for monitoring/admin dashboard)
 */
export function getScrapeHealthStatus(): Record<string, ScrapeHealth> {
  const status: Record<string, ScrapeHealth> = {}
  scrapeHealthMap.forEach((health, sourceId) => {
    status[sourceId] = { ...health }
  })
  return status
}

// ============================================================================
// Source Management
// ============================================================================

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

// ============================================================================
// RSS Fetching
// ============================================================================

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

      const content =
        (item as any).contentEncoded || (item as any).description || item.content || ""

      items.push({
        sourceId: source.id,
        originalTitle: item.title,
        originalContent: content.substring(0, 10000),
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

// ============================================================================
// Resilient Web Scraping
// ============================================================================

/**
 * Scrape configuration with multiple fallback selectors for resilience.
 * Each selector array is tried in order until one returns results.
 */
interface ResilientScrapeConfig {
  newsUrl: string
  itemSelectors: string[]
  titleSelectors: string[]
  linkSelectors: string[]
  dateSelectors: string[]
}

const scrapeConfigs: Record<string, ResilientScrapeConfig> = {
  "porezna-uprava": {
    newsUrl: "https://porezna-uprava.gov.hr/novosti/33",
    itemSelectors: [
      ".news.box-border",
      ".news-item",
      ".vijest",
      "article",
      ".content-item",
      "[class*='news']",
      "[class*='vijest']",
    ],
    titleSelectors: [
      ".link_vijest",
      "h3 a",
      "h2 a",
      ".title a",
      ".naslov a",
      "a[href*='novost']",
      "a[href*='vijest']",
      "a",
    ],
    linkSelectors: [".link_vijest", "h3 a", "h2 a", ".title a", "a[href*='novost']", "a"],
    dateSelectors: [
      ".datum_vijest",
      ".date",
      "time",
      ".datum",
      "[class*='date']",
      "[class*='datum']",
    ],
  },
  fina: {
    newsUrl: "https://www.fina.hr/novosti",
    itemSelectors: [
      ".news-item",
      "article",
      ".vijest-item",
      ".card",
      ".post",
      "[class*='news']",
      "[class*='vijest']",
    ],
    titleSelectors: ["h3 a", ".title a", "h2 a", ".naslov a", "a[href*='novost']", "a"],
    linkSelectors: ["h3 a", ".title a", "h2 a", "a[href*='novost']", "a"],
    dateSelectors: [".date", "time", ".datum", "[datetime]", "[class*='date']"],
  },
  hgk: {
    newsUrl: "https://www.hgk.hr/vijesti",
    itemSelectors: [
      ".news-card",
      ".vijest-item",
      "article",
      ".card",
      ".post-item",
      "[class*='news']",
      "[class*='vijest']",
    ],
    titleSelectors: ["h3", ".title", "h2", ".naslov", "a[href*='vijest']", "a"],
    linkSelectors: ["a[href*='vijest']", "h3 a", ".title a", "a"],
    dateSelectors: [".date", "time", ".datum", "[datetime]", "[class*='date']"],
  },
  "narodne-novine": {
    newsUrl: "https://narodne-novine.nn.hr/clanci/sluzbeni/",
    itemSelectors: [
      ".document-item",
      ".nn-item",
      "tr",
      "article",
      ".clanak",
      "[class*='document']",
      "[class*='clanak']",
    ],
    titleSelectors: ["a[href*='clanci']", "td a", ".title a", "a"],
    linkSelectors: ["a[href*='clanci']", "td a", "a"],
    dateSelectors: [".date", "td:first-child", "time", "[class*='date']", "[class*='datum']"],
  },
}

/**
 * Generic fallback selectors for unknown sources or when all specific selectors fail
 */
const genericFallbackSelectors: ResilientScrapeConfig = {
  newsUrl: "",
  itemSelectors: [
    "article",
    "[class*='news']",
    "[class*='vijest']",
    "[class*='post']",
    "[class*='item']",
    ".card",
    "li",
  ],
  titleSelectors: ["h1 a", "h2 a", "h3 a", ".title a", "a[href]"],
  linkSelectors: ["h1 a", "h2 a", "h3 a", ".title a", "a[href]"],
  dateSelectors: ["time", "[datetime]", ".date", ".datum", "[class*='date']"],
}

/**
 * Try multiple selectors and return the first one that finds elements
 */
function trySelectors(doc: Document, selectors: string[]): NodeListOf<Element> | null {
  for (const selector of selectors) {
    try {
      const elements = doc.querySelectorAll(selector)
      if (elements.length > 0) {
        return elements
      }
    } catch {
      continue
    }
  }
  return null
}

/**
 * Try multiple selectors on an element and return the first match
 */
function tryElementSelectors(el: Element, selectors: string[]): Element | null {
  for (const selector of selectors) {
    try {
      const found = el.querySelector(selector)
      if (found) {
        return found
      }
    } catch {
      continue
    }
  }
  return null
}

/**
 * Parse dates in various Croatian and international formats
 */
function parseDate(dateText: string): Date | null {
  // Try ISO format first
  let parsed = new Date(dateText)
  if (!isNaN(parsed.getTime())) {
    return parsed
  }

  // Croatian date formats: DD.MM.YYYY, DD. MM. YYYY
  const croatianMatch = dateText.match(/(\d{1,2})\.?\s*(\d{1,2})\.?\s*(\d{4})/)
  if (croatianMatch) {
    const [, day, month, year] = croatianMatch
    parsed = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    if (!isNaN(parsed.getTime())) {
      return parsed
    }
  }

  // DD/MM/YYYY format
  const slashMatch = dateText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (slashMatch) {
    const [, day, month, year] = slashMatch
    parsed = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    if (!isNaN(parsed.getTime())) {
      return parsed
    }
  }

  return null
}

/**
 * Fetch news from a web page using scraping with fallback selectors
 */
export async function fetchFromScrape(source: NewsSource): Promise<NewNewsItem[]> {
  const { JSDOM } = await import("jsdom")

  let config = scrapeConfigs[source.id]
  if (!config) {
    console.warn(`[SCRAPE] No specific config for ${source.id}, using generic fallbacks`)
    config = {
      ...genericFallbackSelectors,
      newsUrl: source.url,
    }
  }

  try {
    const response = await fetch(config.newsUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "hr,en;q=0.9",
      },
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      const error = `HTTP ${response.status}: ${response.statusText}`
      recordScrapeFailure(source.id, error)
      throw new Error(error)
    }

    const html = await response.text()
    const dom = new JSDOM(html)
    const doc = dom.window.document

    // Try configured selectors first
    let newsElements = trySelectors(doc, config.itemSelectors)

    // Fall back to generic selectors if primary ones fail
    if (!newsElements || newsElements.length === 0) {
      console.warn(`[SCRAPE] Primary selectors failed for ${source.id}, trying generic fallbacks`)
      newsElements = trySelectors(doc, genericFallbackSelectors.itemSelectors)
    }

    if (!newsElements || newsElements.length === 0) {
      const error = "No news items found with any selector"
      recordScrapeFailure(source.id, error)
      console.error(`[SCRAPE_ERROR] ${source.id}: ${error}`)
      return []
    }

    const items: NewNewsItem[] = []
    const allTitleSelectors = [...config.titleSelectors, ...genericFallbackSelectors.titleSelectors]
    const allLinkSelectors = [...config.linkSelectors, ...genericFallbackSelectors.linkSelectors]
    const allDateSelectors = [...config.dateSelectors, ...genericFallbackSelectors.dateSelectors]

    for (const el of Array.from(newsElements).slice(0, 20)) {
      const titleEl = tryElementSelectors(el, allTitleSelectors)
      const linkEl = tryElementSelectors(el, allLinkSelectors) as HTMLAnchorElement | null
      const dateEl = tryElementSelectors(el, allDateSelectors)

      const title = titleEl?.textContent?.trim()
      let link = linkEl?.href || linkEl?.getAttribute("href")

      if (!title || !link) continue

      // Make relative URLs absolute
      if (link.startsWith("/")) {
        const baseUrl = new URL(config.newsUrl)
        link = `${baseUrl.origin}${link}`
      } else if (!link.startsWith("http")) {
        const baseUrl = new URL(config.newsUrl)
        link = `${baseUrl.origin}/${link}`
      }

      // Parse date
      let publishedAt = new Date()
      const dateText = dateEl?.textContent?.trim() || dateEl?.getAttribute("datetime")
      if (dateText) {
        const parsed = parseDate(dateText)
        if (parsed) {
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

    // Track success/failure for monitoring
    if (items.length === 0) {
      recordScrapeFailure(source.id, "Parsed 0 valid items from page")
      console.warn(`[SCRAPE_WARNING] ${source.id}: Found elements but extracted 0 valid items`)
    } else {
      recordScrapeSuccess(source.id, items.length)
      console.log(`[SCRAPE_SUCCESS] ${source.id}: Extracted ${items.length} items`)
    }

    return items
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    recordScrapeFailure(source.id, errorMsg)
    console.error(`[SCRAPE_ERROR] ${source.id}:`, error)
    return []
  }
}

// ============================================================================
// Source Dispatch
// ============================================================================

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

// ============================================================================
// Database Operations
// ============================================================================

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
      const existing = await drizzleDb
        .select()
        .from(newsItems)
        .where(eq(newsItems.sourceUrl, item.sourceUrl))
        .limit(1)

      if (existing.length > 0) {
        skipped++
        continue
      }

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

// ============================================================================
// AI Processing
// ============================================================================

/**
 * Process unprocessed news items with AI summarization
 */
export async function processUnprocessedNews(
  limit: number = 10
): Promise<{ processed: number; failed: number }> {
  const unprocessed = await drizzleDb
    .select()
    .from(newsItems)
    .where(eq(newsItems.status, "pending"))
    .limit(limit)

  let processed = 0
  let failed = 0

  for (const item of unprocessed) {
    try {
      const summary = await summarizeNews(item.originalContent || "", item.originalTitle)

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

// ============================================================================
// Main Orchestrator
// ============================================================================

/**
 * Main orchestrator function to fetch all news from active sources
 */
export async function fetchAllNews(): Promise<{
  totalFetched: number
  totalInserted: number
  totalSkipped: number
  errors: string[]
  scrapeHealth: Record<string, ScrapeHealth>
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
        `[OK] ${source.name}: Fetched ${items.length}, Inserted ${inserted}, Skipped ${skipped}`
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
    scrapeHealth: getScrapeHealthStatus(),
  }
}
