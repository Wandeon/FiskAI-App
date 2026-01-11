/**
 * Sitemap Parser
 *
 * Parses sitemap.xml and sitemap index files to discover URLs.
 * Supports both standard sitemaps and sitemap indexes.
 */

import type { SitemapEntry, SitemapIndexEntry } from "./types"
import { canonicalizeUrl } from "./url-canonicalizer"

/**
 * Parse a sitemap XML string and extract URLs.
 *
 * Handles both:
 * - Standard sitemaps: <urlset><url><loc>...</loc></url></urlset>
 * - Sitemap indexes: <sitemapindex><sitemap><loc>...</loc></sitemap></sitemapindex>
 *
 * @param xml - Raw XML content
 * @returns Object with either urls or sitemapUrls
 */
export function parseSitemap(xml: string): {
  type: "urlset" | "sitemapindex"
  entries: SitemapEntry[] | SitemapIndexEntry[]
} {
  // Check if it's a sitemap index
  if (xml.includes("<sitemapindex")) {
    return {
      type: "sitemapindex",
      entries: parseSitemapIndex(xml),
    }
  }

  return {
    type: "urlset",
    entries: parseUrlset(xml),
  }
}

/**
 * Parse a standard urlset sitemap
 */
function parseUrlset(xml: string): SitemapEntry[] {
  const entries: SitemapEntry[] = []

  // Match all <url> blocks
  const urlBlockRegex = /<url>([\s\S]*?)<\/url>/gi
  let match: RegExpExecArray | null

  while ((match = urlBlockRegex.exec(xml)) !== null) {
    const block = match[1]

    // Extract <loc>
    const locMatch = /<loc>([^<]+)<\/loc>/i.exec(block)
    if (!locMatch) continue

    const loc = decodeXmlEntities(locMatch[1].trim())
    if (!loc || !isValidUrl(loc)) continue

    const entry: SitemapEntry = {
      loc: canonicalizeUrl(loc),
    }

    // Extract optional <lastmod>
    const lastmodMatch = /<lastmod>([^<]+)<\/lastmod>/i.exec(block)
    if (lastmodMatch) {
      entry.lastmod = lastmodMatch[1].trim()
    }

    // Extract optional <changefreq>
    const changefreqMatch = /<changefreq>([^<]+)<\/changefreq>/i.exec(block)
    if (changefreqMatch) {
      entry.changefreq = changefreqMatch[1].trim()
    }

    // Extract optional <priority>
    const priorityMatch = /<priority>([^<]+)<\/priority>/i.exec(block)
    if (priorityMatch) {
      entry.priority = priorityMatch[1].trim()
    }

    entries.push(entry)
  }

  return entries
}

/**
 * Parse a sitemap index file
 */
function parseSitemapIndex(xml: string): SitemapIndexEntry[] {
  const entries: SitemapIndexEntry[] = []

  // Match all <sitemap> blocks
  const sitemapBlockRegex = /<sitemap>([\s\S]*?)<\/sitemap>/gi
  let match: RegExpExecArray | null

  while ((match = sitemapBlockRegex.exec(xml)) !== null) {
    const block = match[1]

    // Extract <loc>
    const locMatch = /<loc>([^<]+)<\/loc>/i.exec(block)
    if (!locMatch) continue

    const loc = decodeXmlEntities(locMatch[1].trim())
    if (!loc || !isValidUrl(loc)) continue

    const entry: SitemapIndexEntry = {
      loc: canonicalizeUrl(loc),
    }

    // Extract optional <lastmod>
    const lastmodMatch = /<lastmod>([^<]+)<\/lastmod>/i.exec(block)
    if (lastmodMatch) {
      entry.lastmod = lastmodMatch[1].trim()
    }

    entries.push(entry)
  }

  return entries
}

/**
 * Decode XML entities in a string
 */
function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

/**
 * Validate URL format
 */
function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

/**
 * Filter sitemap entries by date range
 *
 * @param entries - Sitemap entries to filter
 * @param dateFrom - Optional start date (inclusive)
 * @param dateTo - Optional end date (inclusive)
 * @returns Filtered entries
 */
export function filterEntriesByDate(
  entries: SitemapEntry[],
  dateFrom?: Date,
  dateTo?: Date
): SitemapEntry[] {
  if (!dateFrom && !dateTo) {
    return entries
  }

  return entries.filter((entry) => {
    if (!entry.lastmod) {
      // Keep entries without date if no date filter specified
      return true
    }

    try {
      const entryDate = new Date(entry.lastmod)
      if (isNaN(entryDate.getTime())) {
        return true // Keep entries with invalid dates
      }

      if (dateFrom && entryDate < dateFrom) {
        return false
      }
      if (dateTo && entryDate > dateTo) {
        return false
      }
      return true
    } catch {
      return true
    }
  })
}

/**
 * Fetch and parse a sitemap from URL
 *
 * @param sitemapUrl - URL of the sitemap
 * @param fetchFn - Fetch function (for testing injection)
 * @returns Parsed sitemap result
 */
export async function fetchAndParseSitemap(
  sitemapUrl: string,
  fetchFn: typeof fetch = fetch
): Promise<{
  type: "urlset" | "sitemapindex"
  entries: SitemapEntry[] | SitemapIndexEntry[]
}> {
  const response = await fetchFn(sitemapUrl, {
    headers: {
      "User-Agent": "FiskAI-Backfill/1.0 (+https://fiskai.hr)",
      Accept: "application/xml, text/xml, */*",
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap: ${response.status} ${response.statusText}`)
  }

  const xml = await response.text()
  return parseSitemap(xml)
}

/**
 * Recursively fetch all URLs from a sitemap (handles indexes)
 *
 * @param sitemapUrl - Root sitemap URL
 * @param fetchFn - Fetch function
 * @param maxDepth - Maximum recursion depth (default 2)
 * @returns All discovered URLs
 */
export async function fetchAllSitemapUrls(
  sitemapUrl: string,
  fetchFn: typeof fetch = fetch,
  maxDepth: number = 2
): Promise<SitemapEntry[]> {
  const allEntries: SitemapEntry[] = []
  const visited = new Set<string>()

  async function crawl(url: string, depth: number): Promise<void> {
    if (depth > maxDepth) return
    if (visited.has(url)) return
    visited.add(url)

    try {
      const result = await fetchAndParseSitemap(url, fetchFn)

      if (result.type === "urlset") {
        allEntries.push(...(result.entries as SitemapEntry[]))
      } else {
        // Sitemap index - recursively fetch each sitemap
        const indexEntries = result.entries as SitemapIndexEntry[]
        for (const entry of indexEntries) {
          await crawl(entry.loc, depth + 1)
        }
      }
    } catch (error) {
      console.error(`[sitemap-parser] Error fetching ${url}:`, error)
    }
  }

  await crawl(sitemapUrl, 0)
  return allEntries
}
