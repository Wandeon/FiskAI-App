/**
 * Streaming Sitemap Discovery
 *
 * High-level discovery generator for sitemap-based backfill.
 * Uses streaming parser, supports date prefiltering, checkpointing, and early stop.
 */

import { Readable } from "stream"
import {
  parseSitemapIndexLocs,
  parseUrlsetLocs,
  StreamingParserLimitError,
} from "./streaming-sitemap-parser"
import type { DomainRateLimit } from "./types"

/**
 * Discovery checkpoint for resume capability
 */
export interface SitemapDiscoveryCheckpoint {
  /** Index of the last fully processed child sitemap (-1 if none) */
  lastCompletedChildSitemapIndex: number
  /** URL of the last completed child sitemap */
  lastCompletedChildSitemapUrl: string | null
  /** Total URLs emitted so far */
  urlsEmittedSoFar: number
}

/**
 * Discovery progress for monitoring
 */
export interface SitemapDiscoveryProgress {
  /** Total child sitemaps encountered in index */
  childSitemapsScanned: number
  /** Children skipped by checkpoint or date prefilter */
  childSitemapsSkipped: number
  /** Children actually fetched and parsed */
  childSitemapsFetched: number
  /** Children that failed (network/parse errors) */
  childSitemapsFailed: number
  /** URLs emitted (passed pattern filter) */
  urlsEmitted: number
  /** URLs rejected by urlPattern */
  urlsRejectedByPattern: number
  /** Currently processing child sitemap URL */
  currentChildSitemap?: string
}

/**
 * Options for streaming sitemap discovery
 */
export interface StreamingSitemapDiscoveryOptions {
  /** Root sitemap index URL */
  sitemapUrl: string
  /** URL pattern to filter content URLs */
  urlPattern: RegExp
  /** Pattern to extract date from child sitemap URLs */
  datePattern?: RegExp
  /** Only include content from this date onwards */
  dateFrom?: Date
  /** Only include content up to this date */
  dateTo?: Date
  /** Maximum URLs to discover (early stop) */
  maxUrls: number
  /** Rate limit configuration */
  rateLimit: DomainRateLimit
  /** Include children without date match (default: false for fail-closed) */
  includeUndatedChildren?: boolean
  /** Checkpoint to resume from */
  checkpoint?: SitemapDiscoveryCheckpoint
  /** Called when a child sitemap completes (for checkpoint persistence) */
  onCheckpoint?: (checkpoint: SitemapDiscoveryCheckpoint) => Promise<void> | void
  /** Called periodically with progress */
  onProgress?: (progress: SitemapDiscoveryProgress) => void
  /** External shutdown signal */
  shutdownSignal?: { shouldShutdown: boolean }
  /** Custom fetch function (for testing) */
  fetchFn?: typeof fetch
}

/**
 * Maximum consecutive child sitemap failures before aborting
 */
const MAX_CHILD_FAILURES = 50

/**
 * Rate limiter that enforces delays between requests
 */
class RateLimiter {
  private lastRequestTime = 0

  constructor(private readonly config: DomainRateLimit) {}

  async wait(): Promise<void> {
    const now = Date.now()
    const elapsed = now - this.lastRequestTime
    const minDelay = this.config.minDelayMs
    const maxDelay = this.config.maxDelayMs

    // Calculate delay with jitter
    const jitter = Math.random() * (maxDelay - minDelay)
    const targetDelay = minDelay + jitter

    if (elapsed < targetDelay) {
      const waitTime = targetDelay - elapsed
      await new Promise((resolve) => setTimeout(resolve, waitTime))
    }

    this.lastRequestTime = Date.now()
  }
}

/**
 * Check if a child sitemap URL is in the date range
 *
 * @param childUrl - Child sitemap URL
 * @param datePattern - Regex to extract date from URL
 * @param dateFrom - Start date (inclusive)
 * @param dateTo - End date (inclusive)
 * @returns Object with inRange boolean and whether date was matched
 */
function checkDateRange(
  childUrl: string,
  datePattern: RegExp | undefined,
  dateFrom: Date | undefined,
  dateTo: Date | undefined
): { matched: boolean; inRange: boolean } {
  if (!datePattern) {
    return { matched: false, inRange: true }
  }

  const match = datePattern.exec(childUrl)
  if (!match) {
    return { matched: false, inRange: true }
  }

  // Extract year from first capture group
  const year = parseInt(match[1], 10)
  if (isNaN(year)) {
    return { matched: false, inRange: true }
  }

  const fromYear = dateFrom?.getFullYear() ?? 0
  const toYear = dateTo?.getFullYear() ?? 9999

  return {
    matched: true,
    inRange: year >= fromYear && year <= toYear,
  }
}

/**
 * Fetch a URL as an async iterable stream
 *
 * @param url - URL to fetch
 * @param fetchFn - Fetch function
 * @returns Async iterable of chunks
 */
async function fetchAsStream(
  url: string,
  fetchFn: typeof fetch
): Promise<AsyncIterable<Uint8Array>> {
  const response = await fetchFn(url, {
    headers: {
      "User-Agent": "FiskAI-Backfill/1.0 (+https://fiskai.hr)",
      Accept: "application/xml, text/xml, */*",
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  // Try streaming body first
  if (response.body) {
    // Convert web stream to async iterable
    // Node 18+ supports Readable.fromWeb
    if (typeof Readable.fromWeb === "function") {
      return Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0])
    }
  }

  // Fallback: read as array buffer and yield as single chunk
  // This handles both missing body (test mocks) and environments without Readable.fromWeb
  const buffer = await response.arrayBuffer()
  return (async function* () {
    yield new Uint8Array(buffer)
  })()
}

/**
 * Stream discover URLs from a sitemap index.
 *
 * Yields URLs as discovered, respects maxUrls, supports checkpoint resume.
 *
 * @param options - Discovery options
 * @yields Content URLs matching the pattern
 * @returns Final checkpoint on completion or early stop
 */
export async function* discoverFromSitemapIndex(
  options: StreamingSitemapDiscoveryOptions
): AsyncGenerator<string, SitemapDiscoveryCheckpoint> {
  const {
    sitemapUrl,
    urlPattern,
    datePattern,
    dateFrom,
    dateTo,
    maxUrls,
    rateLimit,
    includeUndatedChildren = false,
    checkpoint,
    onCheckpoint,
    onProgress,
    shutdownSignal,
    fetchFn = fetch,
  } = options

  const rateLimiter = new RateLimiter(rateLimit)

  const progress: SitemapDiscoveryProgress = {
    childSitemapsScanned: 0,
    childSitemapsSkipped: 0,
    childSitemapsFetched: 0,
    childSitemapsFailed: 0,
    urlsEmitted: 0,
    urlsRejectedByPattern: 0,
  }

  let currentCheckpoint: SitemapDiscoveryCheckpoint = {
    lastCompletedChildSitemapIndex: checkpoint?.lastCompletedChildSitemapIndex ?? -1,
    lastCompletedChildSitemapUrl: checkpoint?.lastCompletedChildSitemapUrl ?? null,
    urlsEmittedSoFar: checkpoint?.urlsEmittedSoFar ?? 0,
  }

  // Track total URLs emitted (cumulative across runs)
  // This starts from checkpoint's value and increments with each yield
  let totalUrlsEmitted = checkpoint?.urlsEmittedSoFar ?? 0

  // Track previous child URL for checkpoint
  let previousChildUrl: string | null = null

  // Rate limit before fetching index
  await rateLimiter.wait()

  // Fetch sitemap index
  const indexStream = await fetchAsStream(sitemapUrl, fetchFn)

  let childIndex = -1

  for await (const childUrl of parseSitemapIndexLocs(indexStream)) {
    childIndex++
    progress.childSitemapsScanned++

    // Resume skip: skip children we've already processed
    if (childIndex <= currentCheckpoint.lastCompletedChildSitemapIndex) {
      progress.childSitemapsSkipped++
      previousChildUrl = childUrl
      continue
    }

    // Date prefilter - only applies when datePattern is provided
    if (datePattern) {
      const dateCheck = checkDateRange(childUrl, datePattern, dateFrom, dateTo)
      if (!dateCheck.matched && !includeUndatedChildren) {
        // No date match and fail-closed mode - skip undated children
        progress.childSitemapsSkipped++
        previousChildUrl = childUrl
        continue
      }
      if (dateCheck.matched && !dateCheck.inRange) {
        // Date matched but outside range
        progress.childSitemapsSkipped++
        previousChildUrl = childUrl
        continue
      }
    }

    progress.currentChildSitemap = childUrl

    try {
      // Rate limit before each child fetch
      await rateLimiter.wait()

      // Fetch and parse child sitemap
      const childStream = await fetchAsStream(childUrl, fetchFn)

      for await (const url of parseUrlsetLocs(childStream)) {
        // Apply URL pattern filter
        if (!urlPattern.test(url)) {
          progress.urlsRejectedByPattern++
          continue
        }

        // Yield the URL
        yield url
        progress.urlsEmitted++
        totalUrlsEmitted++

        // Check maxUrls limit (cumulative across runs)
        if (totalUrlsEmitted >= maxUrls) {
          // Early stop: current child NOT fully processed
          // Return checkpoint with previous child (last COMPLETED)
          return {
            lastCompletedChildSitemapIndex: childIndex - 1,
            lastCompletedChildSitemapUrl: previousChildUrl,
            urlsEmittedSoFar: totalUrlsEmitted,
          }
        }
      }

      // Child fully processed successfully
      progress.childSitemapsFetched++

      // Update checkpoint
      currentCheckpoint = {
        lastCompletedChildSitemapIndex: childIndex,
        lastCompletedChildSitemapUrl: childUrl,
        urlsEmittedSoFar: totalUrlsEmitted,
      }

      // Persist checkpoint
      await onCheckpoint?.(currentCheckpoint)

      // Report progress
      onProgress?.(progress)

      // Check graceful shutdown
      if (shutdownSignal?.shouldShutdown) {
        return currentCheckpoint
      }
    } catch (error) {
      // Fail-closed on parser limit errors
      if (error instanceof StreamingParserLimitError) {
        throw error
      }

      // Tolerate transient network/parse errors
      progress.childSitemapsFailed++
      console.error(`[streaming-sitemap-discovery] Child ${childUrl} failed:`, error)

      // Check failure threshold
      if (progress.childSitemapsFailed > MAX_CHILD_FAILURES) {
        throw new Error(
          `Too many child sitemap failures (${progress.childSitemapsFailed} > ${MAX_CHILD_FAILURES})`
        )
      }

      // Continue to next child
    }

    previousChildUrl = childUrl
  }

  // All children processed
  return currentCheckpoint
}

/**
 * Check if a source requires streaming sitemap discovery
 *
 * @param slug - Source slug
 * @returns True if source has massive sitemap index
 */
export function isMassiveSitemapSource(slug: string): boolean {
  // Sources with thousands of child sitemaps that need streaming
  return slug === "narodne-novine"
}
