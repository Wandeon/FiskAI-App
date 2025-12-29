// src/lib/regulatory-truth/parsers/rss-parser.ts
// RSS/Atom feed parser for discovery endpoints

import { parseStringPromise } from "xml2js"

export interface RSSItem {
  url: string
  title: string | null
  date: string | null
  description?: string | null
}

/**
 * Parse an RSS 2.0 feed
 */
function parseRSS2(data: any): RSSItem[] {
  const items: RSSItem[] = []

  if (!data.rss?.channel?.[0]?.item) {
    return items
  }

  for (const item of data.rss.channel[0].item) {
    const title = item.title?.[0] || null
    const link = item.link?.[0] || null
    const pubDate = item.pubDate?.[0] || null
    const description = item.description?.[0] || null

    if (link) {
      items.push({
        url: link,
        title,
        date: pubDate,
        description,
      })
    }
  }

  return items
}

/**
 * Parse an Atom feed
 */
function parseAtom(data: any): RSSItem[] {
  const items: RSSItem[] = []

  if (!data.feed?.entry) {
    return items
  }

  for (const entry of data.feed.entry) {
    const title = entry.title?.[0]?._ || entry.title?.[0] || null
    const link = entry.link?.[0]?.$?.href || entry.link?.[0] || null
    const updated = entry.updated?.[0] || entry.published?.[0] || null
    const summary = entry.summary?.[0]?._ || entry.summary?.[0] || null

    if (link) {
      items.push({
        url: link,
        title,
        date: updated,
        description: summary,
      })
    }
  }

  return items
}

/**
 * Parse RSS/Atom feed content into structured items.
 * Supports both RSS 2.0 and Atom 1.0 formats.
 */
export async function parseRSSFeed(content: string): Promise<RSSItem[]> {
  try {
    const data = await parseStringPromise(content, {
      trim: true,
      explicitArray: true,
    })

    // Detect feed type and parse accordingly
    if (data.rss) {
      return parseRSS2(data)
    } else if (data.feed) {
      return parseAtom(data)
    } else {
      console.warn("[rss-parser] Unknown feed format")
      return []
    }
  } catch (error) {
    console.error("[rss-parser] Parse error:", error)
    return []
  }
}

/**
 * Filter RSS items by date range
 */
export function filterRSSByDate(items: RSSItem[], startDate?: Date, endDate?: Date): RSSItem[] {
  return items.filter((item) => {
    if (!item.date) return true // Include items without dates

    const itemDate = new Date(item.date)

    if (startDate && itemDate < startDate) return false
    if (endDate && itemDate > endDate) return false

    return true
  })
}

/**
 * Filter RSS items by URL pattern (regex)
 */
export function filterRSSByPattern(items: RSSItem[], pattern: RegExp): RSSItem[] {
  return items.filter((item) => pattern.test(item.url))
}
