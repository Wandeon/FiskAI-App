/**
 * Backfill Types and Interfaces
 *
 * Type definitions for the RTL historical backfill system.
 */

import type { BackfillMode } from "@prisma/client"

/**
 * Per-domain rate limit configuration
 */
export interface DomainRateLimit {
  domain: string
  minDelayMs: number // Minimum delay between requests
  maxDelayMs: number // Maximum delay (for jitter)
  maxConcurrent: number // Max parallel requests to domain
}

/**
 * Source backfill configuration
 */
export interface SourceBackfillConfig {
  slug: string // Source identifier (e.g., "narodne-novine")
  domain: string // Domain for rate limiting
  mode: BackfillMode // Discovery mode
  sitemapUrl?: string // For SITEMAP mode
  archiveUrl?: string // For ARCHIVE mode
  paginationPattern?: string // For PAGINATION mode (e.g., "?page={N}")
  urlPattern?: RegExp // URL matching pattern
  datePattern?: RegExp // Date extraction pattern from content URL
  childSitemapDatePattern?: RegExp // Date extraction pattern from child sitemap URL (for streaming)
  maxPages?: number // Maximum pagination pages to crawl
  rateLimit: DomainRateLimit
}

/**
 * Discovered URL from backfill
 */
export interface BackfillDiscoveredUrl {
  url: string
  title?: string
  publishedAt?: Date
  sourceSlug: string
}

/**
 * Backfill run configuration (from CLI or API)
 */
export interface BackfillRunConfig {
  sources: string[] // Source slugs to process
  mode: BackfillMode
  dateFrom?: Date
  dateTo?: Date
  maxUrls: number
  concurrency: number
  delayMs: number
  dryRun: boolean
  runBy?: string
  notes?: string
}

/**
 * Backfill run state (mutable during execution)
 */
export interface BackfillRunState {
  runId: string
  discoveredCount: number
  queuedCount: number
  skippedCount: number
  errorCount: number
  errors: BackfillError[]
  lastProcessedSource?: string
  lastProcessedPage?: number
  lastProcessedUrl?: string
}

/**
 * Backfill error record
 */
export interface BackfillError {
  timestamp: string
  source: string
  url?: string
  message: string
  code?: string
}

/**
 * Sitemap entry from parsed XML
 */
export interface SitemapEntry {
  loc: string // URL
  lastmod?: string // Last modification date
  changefreq?: string // Change frequency
  priority?: string // Priority (0.0-1.0)
}

/**
 * Sitemap index entry
 */
export interface SitemapIndexEntry {
  loc: string // Sitemap URL
  lastmod?: string // Last modification date
}

/**
 * Pagination page result
 */
export interface PaginationPageResult {
  urls: string[]
  hasNextPage: boolean
  nextPageUrl?: string
}

/**
 * Result of a backfill discovery run
 */
export interface BackfillDiscoveryResult {
  success: boolean
  runId: string
  discoveredCount: number
  queuedCount: number
  skippedCount: number
  errorCount: number
  durationMs: number
  errors: BackfillError[]
}

/**
 * Kill switch check result
 */
export interface KillSwitchStatus {
  enabled: boolean
  reason?: string
}
