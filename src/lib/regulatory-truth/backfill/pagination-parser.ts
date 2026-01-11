/**
 * Pagination Parser
 *
 * Parses paginated archive/listing pages to discover URLs.
 * Supports various pagination patterns commonly used by government sites.
 */

import type { PaginationPageResult } from "./types"
import { canonicalizeUrl } from "./url-canonicalizer"

/**
 * Common pagination patterns for Croatian government sites
 */
export const PAGINATION_PATTERNS = {
  // ?page=N (most common)
  QUERY_PAGE: "?page={N}",
  // ?stranica=N (Croatian)
  QUERY_STRANICA: "?stranica={N}",
  // /page/N/
  PATH_PAGE: "/page/{N}/",
  // /stranica/N/
  PATH_STRANICA: "/stranica/{N}/",
  // ?offset=N (N = page * pageSize)
  QUERY_OFFSET: "?offset={N}",
} as const

/**
 * Build paginated URL from pattern
 *
 * @param baseUrl - Base URL (without pagination)
 * @param pattern - Pagination pattern with {N} placeholder
 * @param page - Page number (1-based)
 * @param pageSize - Items per page (for offset patterns)
 * @returns Paginated URL
 */
export function buildPaginatedUrl(
  baseUrl: string,
  pattern: string,
  page: number,
  pageSize: number = 20
): string {
  // Handle offset patterns
  const value = pattern.includes("offset") ? (page - 1) * pageSize : page

  // Build URL based on pattern type
  if (pattern.startsWith("?")) {
    // Query parameter pattern
    const url = new URL(baseUrl)
    const paramPart = pattern.slice(1).replace("{N}", String(value))
    const [key, val] = paramPart.split("=")
    url.searchParams.set(key, val)
    return url.toString()
  } else if (pattern.startsWith("/")) {
    // Path pattern
    const pathPart = pattern.replace("{N}", String(value))
    const url = new URL(baseUrl)
    url.pathname = url.pathname.replace(/\/$/, "") + pathPart
    return url.toString()
  }

  // Fallback: append pattern
  return baseUrl + pattern.replace("{N}", String(value))
}

/**
 * Extract links from HTML content
 *
 * @param html - HTML content
 * @param baseUrl - Base URL for resolving relative links
 * @param urlPattern - Optional regex to filter URLs
 * @returns Array of absolute URLs
 */
export function extractLinksFromHtml(html: string, baseUrl: string, urlPattern?: RegExp): string[] {
  const links: string[] = []
  const seen = new Set<string>()

  // Match all href attributes
  const hrefRegex = /href=["']([^"']+)["']/gi
  let match: RegExpExecArray | null

  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1].trim()

    // Skip empty, javascript, mailto, tel links
    if (
      !href ||
      href.startsWith("#") ||
      href.startsWith("javascript:") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:")
    ) {
      continue
    }

    try {
      // Resolve relative URLs
      const absoluteUrl = new URL(href, baseUrl).toString()
      const canonicalUrl = canonicalizeUrl(absoluteUrl)

      // Skip if already seen
      if (seen.has(canonicalUrl)) continue
      seen.add(canonicalUrl)

      // Apply URL pattern filter if provided
      if (urlPattern && !urlPattern.test(canonicalUrl)) continue

      links.push(canonicalUrl)
    } catch {
      // Skip invalid URLs
    }
  }

  return links
}

/**
 * Detect if page has a "next page" link
 *
 * @param html - HTML content
 * @param currentPage - Current page number
 * @returns Whether there's likely a next page
 */
export function detectNextPage(html: string, currentPage: number): boolean {
  const nextPage = currentPage + 1

  // Check for common "next" patterns
  const nextPatterns = [
    // Page number links
    new RegExp(`[?&]page=${nextPage}\\b`, "i"),
    new RegExp(`[?&]stranica=${nextPage}\\b`, "i"),
    new RegExp(`/page/${nextPage}/?`, "i"),
    new RegExp(`/stranica/${nextPage}/?`, "i"),
    // "Next" text links
    /rel=["']next["']/i,
    />(?:next|dalje|sljedeća|→|»)</i,
    /class=["'][^"']*next[^"']*["']/i,
  ]

  return nextPatterns.some((pattern) => pattern.test(html))
}

/**
 * Parse a pagination page and extract links
 *
 * @param html - HTML content
 * @param baseUrl - Base URL
 * @param currentPage - Current page number
 * @param urlPattern - URL pattern to filter
 * @returns Pagination page result
 */
export function parsePaginationPage(
  html: string,
  baseUrl: string,
  currentPage: number,
  urlPattern?: RegExp
): PaginationPageResult {
  const urls = extractLinksFromHtml(html, baseUrl, urlPattern)
  const hasNextPage = detectNextPage(html, currentPage)

  return {
    urls,
    hasNextPage,
  }
}

/**
 * Fetch and parse a paginated listing
 *
 * @param baseUrl - Base listing URL
 * @param pattern - Pagination pattern
 * @param urlPattern - URL filter pattern
 * @param options - Fetch options
 * @returns All discovered URLs from all pages
 */
export async function fetchPaginatedListing(
  baseUrl: string,
  pattern: string,
  urlPattern: RegExp,
  options: {
    maxPages?: number
    delayMs?: number
    fetchFn?: typeof fetch
  } = {}
): Promise<string[]> {
  const { maxPages = 100, delayMs = 1000, fetchFn = fetch } = options

  const allUrls: string[] = []
  const seen = new Set<string>()
  let page = 1
  let hasMore = true

  while (hasMore && page <= maxPages) {
    const pageUrl = page === 1 ? baseUrl : buildPaginatedUrl(baseUrl, pattern, page)

    try {
      const response = await fetchFn(pageUrl, {
        headers: {
          "User-Agent": "FiskAI-Backfill/1.0 (+https://fiskai.hr)",
          Accept: "text/html,application/xhtml+xml",
        },
      })

      if (!response.ok) {
        console.log(`[pagination-parser] Page ${page} returned ${response.status}, stopping`)
        break
      }

      const html = await response.text()
      const result = parsePaginationPage(html, pageUrl, page, urlPattern)

      // Add new URLs
      for (const url of result.urls) {
        if (!seen.has(url)) {
          seen.add(url)
          allUrls.push(url)
        }
      }

      console.log(`[pagination-parser] Page ${page}: found ${result.urls.length} URLs`)

      // Check for more pages
      hasMore = result.hasNextPage && result.urls.length > 0
      page++

      // Delay before next request
      if (hasMore && delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    } catch (error) {
      console.error(`[pagination-parser] Error fetching page ${page}:`, error)
      break
    }
  }

  return allUrls
}

/**
 * Extract dates from URLs using common patterns
 *
 * @param url - URL to parse
 * @returns Extracted date or undefined
 */
export function extractDateFromUrl(url: string): Date | undefined {
  // Common date patterns in URLs
  const patterns = [
    // /2024/01/15/
    /\/(\d{4})\/(\d{2})\/(\d{2})\//,
    // /2024-01-15/
    /\/(\d{4})-(\d{2})-(\d{2})\//,
    // ?date=2024-01-15
    /[?&]date=(\d{4})-(\d{2})-(\d{2})/,
    // /NN-123-2024 (Narodne novine pattern)
    /\/NN-\d+-(\d{4})/,
    // /2024/ (year only)
    /\/(\d{4})\//,
  ]

  for (const pattern of patterns) {
    const match = pattern.exec(url)
    if (match) {
      try {
        if (match.length >= 4) {
          // Full date: year, month, day
          return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]))
        } else if (match.length >= 2) {
          // Year only
          return new Date(parseInt(match[1]), 0, 1)
        }
      } catch {
        continue
      }
    }
  }

  return undefined
}
