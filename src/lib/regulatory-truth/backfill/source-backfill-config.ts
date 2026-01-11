/**
 * Source Backfill Configuration
 *
 * Defines backfill-specific settings for each regulatory source.
 * These configs are used by the backfill discovery worker to find historical content.
 *
 * IMPORTANT: Start with sources that are:
 * - Not JavaScript-heavy (static HTML or XML)
 * - Have sitemaps or predictable pagination
 * - Rate-limit friendly
 */

import type { SourceBackfillConfig, DomainRateLimit } from "./types"
import { BackfillMode } from "@prisma/client"

/**
 * Source-specific backfill configurations
 *
 * Each source defines:
 * - Discovery mode (sitemap, pagination, archive)
 * - URL patterns for filtering
 * - Rate limits
 * - Site-specific settings
 */
export const SOURCE_BACKFILL_CONFIGS: Record<string, SourceBackfillConfig> = {
  /**
   * Narodne Novine (Official Gazette)
   *
   * Croatia's official legal gazette. Contains all laws, regulations, and official acts.
   * Has a sitemap at /sitemap.xml and structured issue URLs.
   *
   * URL patterns:
   * - /clanci/sluzbeni/YYYY_NN_NNN.html (individual articles)
   * - /clanci/sluzbeni/YYYY_NN_NNN_NNN.html (sub-articles)
   */
  "narodne-novine": {
    slug: "narodne-novine",
    domain: "narodne-novine.nn.hr",
    mode: BackfillMode.SITEMAP,
    sitemapUrl: "https://narodne-novine.nn.hr/sitemap.xml",
    urlPattern: /\/clanci\/sluzbeni\/\d{4}_\d+_\d+/,
    datePattern: /\/(\d{4})_(\d+)_/,
    rateLimit: {
      domain: "narodne-novine.nn.hr",
      minDelayMs: 8000, // 8 seconds (be respectful)
      maxDelayMs: 15000, // 15 seconds with jitter
      maxConcurrent: 1,
    },
  },

  /**
   * Porezna Uprava (Tax Administration)
   *
   * Croatian tax authority. Contains tax regulations, guides, and announcements.
   * Site was restructured - old /HR/Stranice/Arhiva.aspx redirects to homepage.
   *
   * Archive URL: https://porezna-uprava.gov.hr/hr/vijesti/8
   * Pagination: ?Page=N (50 pages with ~2600 total news items)
   *
   * URL patterns:
   * - /hr/[slug]/[id] (e.g., /hr/pdv-3938/3938, /hr/vijesti/8)
   */
  "porezna-uprava": {
    slug: "porezna-uprava",
    domain: "porezna-uprava.gov.hr",
    mode: BackfillMode.PAGINATION,
    archiveUrl: "https://porezna-uprava.gov.hr/hr/vijesti/8",
    paginationPattern: "?Page={N}",
    urlPattern: /porezna-uprava\.gov\.hr\/hr\/[^/]+\/\d+$/,
    maxPages: 50,
    rateLimit: {
      domain: "porezna-uprava.gov.hr",
      minDelayMs: 10000, // 10 seconds
      maxDelayMs: 20000, // 20 seconds with jitter
      maxConcurrent: 1,
    },
  },

  /**
   * HZZO (Croatian Health Insurance Fund)
   *
   * Healthcare and insurance regulations. Has RSS feeds and archive pages.
   *
   * Note: Some content is in Excel/Word format (will need OCR)
   */
  hzzo: {
    slug: "hzzo",
    domain: "hzzo.hr",
    mode: BackfillMode.PAGINATION,
    archiveUrl: "https://hzzo.hr/novosti",
    paginationPattern: "?page={N}",
    urlPattern: /hzzo\.hr\/(?:novosti|propisi|obrasci)\//,
    maxPages: 30,
    rateLimit: {
      domain: "hzzo.hr",
      minDelayMs: 5000,
      maxDelayMs: 10000,
      maxConcurrent: 1,
    },
  },

  /**
   * FINA (Financial Agency)
   *
   * Business registration and financial regulations.
   * Has structured news archive.
   */
  fina: {
    slug: "fina",
    domain: "fina.hr",
    mode: BackfillMode.PAGINATION,
    archiveUrl: "https://www.fina.hr/novosti",
    paginationPattern: "?page={N}",
    urlPattern: /fina\.hr\/novosti\//,
    maxPages: 30,
    rateLimit: {
      domain: "fina.hr",
      minDelayMs: 5000,
      maxDelayMs: 10000,
      maxConcurrent: 1,
    },
  },
}

/**
 * Get backfill config for a source by slug
 *
 * @param slug - Source slug
 * @returns Config or undefined if not configured
 */
export function getBackfillConfig(slug: string): SourceBackfillConfig | undefined {
  return SOURCE_BACKFILL_CONFIGS[slug]
}

/**
 * Get all configured source slugs
 */
export function getConfiguredSourceSlugs(): string[] {
  return Object.keys(SOURCE_BACKFILL_CONFIGS)
}

/**
 * Validate source slugs against configured sources
 *
 * @param slugs - Source slugs to validate
 * @returns Object with valid and invalid slugs
 */
export function validateSourceSlugs(slugs: string[]): {
  valid: string[]
  invalid: string[]
} {
  const configured = new Set(getConfiguredSourceSlugs())
  const valid: string[] = []
  const invalid: string[] = []

  for (const slug of slugs) {
    if (configured.has(slug)) {
      valid.push(slug)
    } else {
      invalid.push(slug)
    }
  }

  return { valid, invalid }
}

/**
 * Calculate delay with jitter
 *
 * @param rateLimit - Rate limit config
 * @returns Delay in milliseconds
 */
export function calculateDelay(rateLimit: DomainRateLimit): number {
  const jitter = Math.random() * (rateLimit.maxDelayMs - rateLimit.minDelayMs)
  return rateLimit.minDelayMs + jitter
}
