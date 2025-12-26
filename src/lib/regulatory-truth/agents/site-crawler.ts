// src/lib/regulatory-truth/agents/site-crawler.ts
// Recursive site crawler for building custom sitemaps on sites without sitemap.xml

import { JSDOM } from "jsdom"
import { fetchWithRateLimit } from "../utils/rate-limiter"

export interface CrawlOptions {
  maxDepth: number // How many link-levels deep to crawl
  maxUrls: number // Maximum URLs to discover
  delayMs: number // Base delay between requests (deprecated, use min/max)
  delayMinMs: number // Minimum delay between requests
  delayMaxMs: number // Maximum delay between requests
  includePatterns?: RegExp[] // Only include URLs matching these patterns
  excludePatterns?: RegExp[] // Exclude URLs matching these patterns
  followExternal?: boolean // Follow links to other domains (default: false)
  respectRobots?: boolean // Respect robots.txt (default: true)
}

export interface CrawledUrl {
  url: string
  title: string | null
  depth: number
  foundOn: string // Parent URL where this was discovered
  lastmod?: string
}

export interface CrawlResult {
  success: boolean
  domain: string
  urlsDiscovered: number
  urlsCrawled: number
  urls: CrawledUrl[]
  errors: string[]
  robotsDisallowed: string[]
}

const DEFAULT_OPTIONS: CrawlOptions = {
  maxDepth: 4, // Increased from 3
  maxUrls: 2000, // Increased from 1000
  delayMs: 2000, // Legacy, not used
  delayMinMs: 2000, // Minimum 2 seconds
  delayMaxMs: 5000, // Maximum 5 seconds
  followExternal: false,
  respectRobots: true,
}

/**
 * Randomized delay to avoid IP bans.
 * Uses random jitter between min and max to avoid predictable patterns.
 */
function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = minMs + Math.random() * (maxMs - minMs)
  console.log(`[site-crawler] Waiting ${Math.round(delay)}ms before next request...`)
  return new Promise((resolve) => setTimeout(resolve, delay))
}

/**
 * Normalize a URL to a canonical form for deduplication
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    // Remove trailing slash, hash, and common tracking params
    parsed.hash = ""
    parsed.searchParams.delete("utm_source")
    parsed.searchParams.delete("utm_medium")
    parsed.searchParams.delete("utm_campaign")
    parsed.searchParams.delete("ref")
    parsed.searchParams.delete("fbclid")

    let path = parsed.pathname
    if (path.endsWith("/") && path !== "/") {
      path = path.slice(0, -1)
    }
    parsed.pathname = path

    return parsed.toString()
  } catch {
    return url
  }
}

/**
 * Extract the domain from a URL
 */
function getDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ""
  }
}

/**
 * Check if a URL points to a document (PDF, DOC, etc.) by extension
 */
function isDocumentUrl(url: string): boolean {
  const documentPatterns = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp|rtf)$/i
  return documentPatterns.test(url)
}

/**
 * Check if a URL should be crawled based on patterns
 */
function shouldCrawlUrl(url: string, options: CrawlOptions): boolean {
  // Check include patterns (if specified, URL must match at least one)
  if (options.includePatterns && options.includePatterns.length > 0) {
    const matches = options.includePatterns.some((pattern) => pattern.test(url))
    if (!matches) return false
  }

  // Check exclude patterns (URL must not match any)
  if (options.excludePatterns && options.excludePatterns.length > 0) {
    const excluded = options.excludePatterns.some((pattern) => pattern.test(url))
    if (excluded) return false
  }

  // Skip non-content URLs (images, scripts, styles, archives)
  // NOTE: Documents (PDF, DOC, etc.) are NOT skipped - they're handled specially
  const skipPatterns = [
    /\.(jpg|jpeg|png|gif|svg|webp|ico|bmp|tiff)$/i, // Images
    /\.(css|js|woff|woff2|ttf|eot|map)$/i, // Web assets
    /\.(zip|rar|tar|gz|7z|bz2)$/i, // Archives
    /\.(mp3|mp4|avi|mov|wmv|flv|wav|ogg|webm)$/i, // Media
    /\/(login|logout|register|signup|signin|auth)\//i,
    /[?&](print|download)=/i,
    /#.+$/,
  ]

  return !skipPatterns.some((pattern) => pattern.test(url))
}

/**
 * Parse robots.txt and return disallowed paths
 */
async function parseRobotsTxt(domain: string): Promise<string[]> {
  const disallowed: string[] = []

  try {
    const robotsUrl = `https://${domain}/robots.txt`
    const response = await fetchWithRateLimit(robotsUrl)

    if (!response.ok) {
      return [] // No robots.txt or error - allow all
    }

    const content = await response.text()
    const lines = content.split("\n")
    let inUserAgentAll = false

    for (const line of lines) {
      const trimmed = line.trim().toLowerCase()

      if (trimmed.startsWith("user-agent:")) {
        const agent = trimmed.slice("user-agent:".length).trim()
        inUserAgentAll = agent === "*" || agent === "googlebot"
      } else if (inUserAgentAll && trimmed.startsWith("disallow:")) {
        const path = line.slice(line.indexOf(":") + 1).trim()
        if (path) {
          disallowed.push(path)
        }
      }
    }
  } catch {
    // Ignore robots.txt errors
  }

  return disallowed
}

/**
 * Check if a URL path is disallowed by robots.txt rules
 */
function isDisallowedByRobots(url: string, disallowedPaths: string[]): boolean {
  try {
    const parsed = new URL(url)
    const path = parsed.pathname

    return disallowedPaths.some((disallowed) => {
      if (disallowed === "/") return true // Disallow all
      return path.startsWith(disallowed)
    })
  } catch {
    return false
  }
}

/**
 * Extract all links from an HTML page
 */
function extractLinks(html: string, baseUrl: string): { url: string; title: string | null }[] {
  const dom = new JSDOM(html)
  const document = dom.window.document
  const links: { url: string; title: string | null }[] = []
  const seen = new Set<string>()

  // Find all anchor tags
  const anchors = document.querySelectorAll("a[href]")

  for (const anchor of anchors) {
    const href = anchor.getAttribute("href")
    if (!href) continue

    try {
      // Resolve relative URLs
      const absoluteUrl = new URL(href, baseUrl).toString()
      const normalized = normalizeUrl(absoluteUrl)

      if (!seen.has(normalized)) {
        seen.add(normalized)
        links.push({
          url: normalized,
          title: anchor.textContent?.trim() || null,
        })
      }
    } catch {
      // Invalid URL - skip
    }
  }

  return links
}

/**
 * Get the page title from HTML
 */
function getPageTitle(html: string): string | null {
  const dom = new JSDOM(html)
  const title = dom.window.document.querySelector("title")
  return title?.textContent?.trim() || null
}

/**
 * Crawl a website starting from a seed URL and build a custom sitemap
 */
export async function crawlSite(
  seedUrl: string,
  options: Partial<CrawlOptions> = {}
): Promise<CrawlResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const domain = getDomain(seedUrl)

  const result: CrawlResult = {
    success: true,
    domain,
    urlsDiscovered: 0,
    urlsCrawled: 0,
    urls: [],
    errors: [],
    robotsDisallowed: [],
  }

  if (!domain) {
    result.success = false
    result.errors.push(`Invalid seed URL: ${seedUrl}`)
    return result
  }

  console.log(`[site-crawler] Starting crawl of ${domain} from ${seedUrl}`)

  // Parse robots.txt if respecting it
  let disallowedPaths: string[] = []
  if (opts.respectRobots) {
    disallowedPaths = await parseRobotsTxt(domain)
    console.log(`[site-crawler] Found ${disallowedPaths.length} disallowed paths in robots.txt`)
  }

  // Track visited URLs and queue
  const visited = new Set<string>()
  const queue: { url: string; depth: number; foundOn: string }[] = [
    { url: normalizeUrl(seedUrl), depth: 0, foundOn: "" },
  ]
  const discoveredUrls = new Map<string, CrawledUrl>()

  while (queue.length > 0 && result.urlsCrawled < opts.maxUrls) {
    const item = queue.shift()!
    const normalizedUrl = normalizeUrl(item.url)

    // Skip if already visited
    if (visited.has(normalizedUrl)) continue
    visited.add(normalizedUrl)

    // Check depth limit
    if (item.depth > opts.maxDepth) continue

    // Check robots.txt
    if (opts.respectRobots && isDisallowedByRobots(normalizedUrl, disallowedPaths)) {
      result.robotsDisallowed.push(normalizedUrl)
      continue
    }

    // Check if URL should be crawled
    if (!shouldCrawlUrl(normalizedUrl, opts)) continue

    // Check domain (if not following external links)
    const urlDomain = getDomain(normalizedUrl)
    if (!opts.followExternal && urlDomain !== domain) continue

    // Handle document URLs (PDFs, DOCs, etc.) without fetching
    // We just record them - the Sentinel's fetchDiscoveredItems will handle the actual download
    if (isDocumentUrl(normalizedUrl)) {
      console.log(`[site-crawler] Found document: ${normalizedUrl}`)
      discoveredUrls.set(normalizedUrl, {
        url: normalizedUrl,
        title: null,
        depth: item.depth,
        foundOn: item.foundOn,
      })
      result.urlsDiscovered++
      continue // Don't try to crawl the document for links
    }

    console.log(`[site-crawler] Crawling (depth ${item.depth}): ${normalizedUrl}`)

    try {
      // Randomized delay to avoid IP bans
      if (result.urlsCrawled > 0) {
        await randomDelay(opts.delayMinMs, opts.delayMaxMs)
      }

      const response = await fetchWithRateLimit(normalizedUrl)

      if (!response.ok) {
        result.errors.push(`HTTP ${response.status} for ${normalizedUrl}`)
        continue
      }

      const contentType = response.headers.get("content-type") || ""

      // Only process HTML pages for link extraction
      if (!contentType.includes("text/html")) {
        // Record non-HTML content URLs that we didn't detect by extension
        // (e.g., URLs without file extensions that return PDF content-type)
        if (
          contentType.includes("pdf") ||
          contentType.includes("document") ||
          contentType.includes("msword") ||
          contentType.includes("spreadsheet") ||
          contentType.includes("presentation")
        ) {
          console.log(`[site-crawler] Found document (by content-type): ${normalizedUrl}`)
          discoveredUrls.set(normalizedUrl, {
            url: normalizedUrl,
            title: null,
            depth: item.depth,
            foundOn: item.foundOn,
          })
          result.urlsDiscovered++
        }
        continue
      }

      const html = await response.text()
      const pageTitle = getPageTitle(html)
      result.urlsCrawled++

      // Record this URL
      discoveredUrls.set(normalizedUrl, {
        url: normalizedUrl,
        title: pageTitle,
        depth: item.depth,
        foundOn: item.foundOn,
      })
      result.urlsDiscovered++

      // Extract links and add to queue
      const links = extractLinks(html, normalizedUrl)

      for (const link of links) {
        const linkNormalized = normalizeUrl(link.url)

        if (!visited.has(linkNormalized)) {
          queue.push({
            url: linkNormalized,
            depth: item.depth + 1,
            foundOn: normalizedUrl,
          })
        }
      }

      // Log progress periodically
      if (result.urlsCrawled % 50 === 0) {
        console.log(
          `[site-crawler] Progress: ${result.urlsCrawled} crawled, ${discoveredUrls.size} discovered, ${queue.length} queued`
        )
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      result.errors.push(`Error crawling ${normalizedUrl}: ${errorMsg}`)
    }
  }

  result.urls = Array.from(discoveredUrls.values())

  console.log(
    `[site-crawler] Complete: ${result.urlsCrawled} pages crawled, ${result.urlsDiscovered} URLs discovered`
  )

  if (result.errors.length > 0) {
    console.warn(`[site-crawler] ${result.errors.length} errors occurred`)
  }

  return result
}

/**
 * Crawl a site and register discovered URLs in the database
 */
export async function crawlAndRegisterUrls(
  endpointId: string,
  seedUrl: string,
  options?: Partial<CrawlOptions>
): Promise<{ registered: number; skipped: number; errors: string[] }> {
  const { db } = await import("@/lib/db")

  const crawlResult = await crawlSite(seedUrl, options)

  let registered = 0
  let skipped = 0

  for (const crawledUrl of crawlResult.urls) {
    try {
      // Check if URL already exists for this endpoint
      const existing = await db.discoveredItem.findFirst({
        where: {
          endpointId,
          url: crawledUrl.url,
        },
      })

      if (existing) {
        skipped++
        continue
      }

      // Create new discovered item
      await db.discoveredItem.create({
        data: {
          endpointId,
          url: crawledUrl.url,
          title: crawledUrl.title,
          status: "PENDING",
        },
      })

      registered++
    } catch {
      // Likely duplicate from race condition
      skipped++
    }
  }

  console.log(`[site-crawler] Registered ${registered} new URLs, skipped ${skipped} duplicates`)

  return {
    registered,
    skipped,
    errors: crawlResult.errors,
  }
}
