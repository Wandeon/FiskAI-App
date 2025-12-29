// src/lib/regulatory-truth/parsers/sitemap-parser.ts
import { XMLParser } from "fast-xml-parser"

export interface SitemapEntry {
  url: string
  lastmod?: string
  priority?: number
}

export interface NNSitemapMeta {
  type: number // 1=Službeni, 2=Međunarodni, 3=Oglasni
  year: number
  issue: number
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
})

/**
 * Parse a standard sitemap.xml file.
 */
export function parseSitemap(xml: string): SitemapEntry[] {
  const result = parser.parse(xml)

  // Handle sitemapindex (list of sitemaps)
  if (result.sitemapindex?.sitemap) {
    const sitemaps = Array.isArray(result.sitemapindex.sitemap)
      ? result.sitemapindex.sitemap
      : [result.sitemapindex.sitemap]

    return sitemaps.map((s: { loc: string; lastmod?: string }) => ({
      url: s.loc,
      lastmod: s.lastmod,
    }))
  }

  // Handle urlset (list of URLs)
  if (result.urlset?.url) {
    const urls = Array.isArray(result.urlset.url) ? result.urlset.url : [result.urlset.url]

    return urls.map((u: { loc: string; lastmod?: string; priority?: string }) => ({
      url: u.loc,
      lastmod: u.lastmod,
      priority: u.priority ? parseFloat(u.priority) : undefined,
    }))
  }

  return []
}

/**
 * Parse Narodne novine sitemap filename to extract metadata.
 * Format: sitemap_{type}_{year}_{issue}.xml
 * Example: sitemap_1_2025_145.xml
 */
export function parseNNSitemapFilename(filename: string): NNSitemapMeta | null {
  const match = filename.match(/sitemap_(\d)_(\d{4})_(\d+)\.xml/)
  if (!match) return null

  return {
    type: parseInt(match[1], 10),
    year: parseInt(match[2], 10),
    issue: parseInt(match[3], 10),
  }
}

/**
 * Filter NN sitemaps to only include relevant types.
 * By default, includes all types: Službeni (1), Međunarodni (2), and Oglasni (3).
 * Type 3 (Oglasni) may contain relevant business content like tenders, court notices, and bankruptcy announcements.
 */
export function filterNNSitemaps(
  entries: SitemapEntry[],
  allowedTypes: number[] = [1, 2, 3]
): SitemapEntry[] {
  return entries.filter((entry) => {
    const filename = entry.url.split("/").pop() || ""
    const meta = parseNNSitemapFilename(filename)
    return meta && allowedTypes.includes(meta.type)
  })
}

/**
 * Get the latest issue sitemaps from NN main sitemap.
 * Returns sitemaps sorted by issue number (descending).
 */
export function getLatestNNIssueSitemaps(
  entries: SitemapEntry[],
  limit: number = 10
): SitemapEntry[] {
  const withMeta = entries
    .map((entry) => {
      const filename = entry.url.split("/").pop() || ""
      return {
        entry,
        meta: parseNNSitemapFilename(filename),
      }
    })
    .filter((x) => x.meta !== null)
    .sort((a, b) => {
      // Sort by year desc, then issue desc
      if (a.meta!.year !== b.meta!.year) {
        return b.meta!.year - a.meta!.year
      }
      return b.meta!.issue - a.meta!.issue
    })

  return withMeta.slice(0, limit).map((x) => x.entry)
}

/**
 * Parse sitemap index and return all child sitemap URLs
 */
export function parseSitemapIndex(content: string): string[] {
  const result = parser.parse(content)

  // Handle sitemapindex (list of sitemaps)
  if (result.sitemapindex?.sitemap) {
    const sitemaps = Array.isArray(result.sitemapindex.sitemap)
      ? result.sitemapindex.sitemap
      : [result.sitemapindex.sitemap]

    return sitemaps.map((s: { loc: string }) => s.loc)
  }

  return []
}

/**
 * Check if content is a sitemap index (contains <sitemapindex>)
 */
export function isSitemapIndex(content: string): boolean {
  return content.includes("<sitemapindex")
}
