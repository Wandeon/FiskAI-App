// src/lib/regulatory-truth/agents/sitemap-scanner.ts
// Recursive sitemap scanner for baseline backfill and continuous discovery

import { db } from "@/lib/db"
import { fetchWithRateLimit } from "../utils/rate-limiter"
import {
  parseSitemap,
  parseSitemapIndex,
  isSitemapIndex,
  filterNNSitemaps,
  SitemapEntry,
} from "../parsers/sitemap-parser"

export interface SitemapScanOptions {
  maxDepth?: number
  currentDepth?: number
  types?: number[] // For NN-specific filtering
  deduplicateUrls?: boolean
  batchSize?: number
  delayMs?: number
}

export interface SitemapScanResult {
  success: boolean
  sitemapsScanned: number
  urlsDiscovered: number
  urlsRegistered: number
  urlsSkipped: number
  errors: string[]
}

const DEFAULT_OPTIONS: Required<SitemapScanOptions> = {
  maxDepth: 3,
  currentDepth: 0,
  types: [1, 2, 3], // NN: Include all types (Službeni, Međunarodni, Oglasni)
  deduplicateUrls: true,
  batchSize: 100,
  delayMs: 1000,
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Register a discovered URL in the database
 */
async function registerDiscoveredUrl(
  endpointId: string,
  url: string,
  title: string | null,
  publishedAt: Date | null,
  deduplicate: boolean
): Promise<boolean> {
  try {
    if (deduplicate) {
      // Check if already exists
      const existing = await db.discoveredItem.findFirst({
        where: { endpointId, url },
      })

      if (existing) {
        return false // Already exists, skip
      }
    }

    // Create new discovered item
    await db.discoveredItem.create({
      data: {
        endpointId,
        url,
        title,
        publishedAt,
        status: "PENDING",
      },
    })

    return true // Successfully registered
  } catch (error) {
    // Likely duplicate from race condition or unique constraint violation
    return false
  }
}

/**
 * Process a batch of sitemap entries and register them as discovered items
 */
async function processSitemapEntries(
  endpointId: string,
  entries: SitemapEntry[],
  deduplicate: boolean
): Promise<{ registered: number; skipped: number }> {
  let registered = 0
  let skipped = 0

  for (const entry of entries) {
    const publishedAt = entry.lastmod ? new Date(entry.lastmod) : null
    const wasRegistered = await registerDiscoveredUrl(
      endpointId,
      entry.url,
      null,
      publishedAt,
      deduplicate
    )

    if (wasRegistered) {
      registered++
    } else {
      skipped++
    }
  }

  return { registered, skipped }
}

/**
 * Recursively scan a sitemap URL and register all discovered URLs
 */
export async function scanSitemapRecursive(
  domain: string,
  sitemapUrl: string,
  endpointId: string,
  options: SitemapScanOptions = {}
): Promise<SitemapScanResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const result: SitemapScanResult = {
    success: true,
    sitemapsScanned: 0,
    urlsDiscovered: 0,
    urlsRegistered: 0,
    urlsSkipped: 0,
    errors: [],
  }

  // Check max depth
  if (opts.currentDepth >= opts.maxDepth) {
    console.log(`[sitemap-scanner] Max depth ${opts.maxDepth} reached for ${sitemapUrl}`)
    return result
  }

  console.log(`[sitemap-scanner] Scanning: ${sitemapUrl} (depth ${opts.currentDepth})`)

  try {
    // Fetch sitemap content
    const response = await fetchWithRateLimit(sitemapUrl)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const content = await response.text()
    result.sitemapsScanned++

    // Check if this is a sitemap index
    if (isSitemapIndex(content)) {
      const childSitemaps = parseSitemapIndex(content)
      console.log(
        `[sitemap-scanner] Found sitemap index with ${childSitemaps.length} child sitemaps`
      )

      // Recursively scan each child sitemap
      for (const childUrl of childSitemaps) {
        await sleep(opts.delayMs)

        const childResult = await scanSitemapRecursive(domain, childUrl, endpointId, {
          ...opts,
          currentDepth: opts.currentDepth + 1,
        })

        // Merge results
        result.sitemapsScanned += childResult.sitemapsScanned
        result.urlsDiscovered += childResult.urlsDiscovered
        result.urlsRegistered += childResult.urlsRegistered
        result.urlsSkipped += childResult.urlsSkipped
        result.errors.push(...childResult.errors)

        if (!childResult.success) {
          result.success = false
        }
      }
    } else {
      // Regular sitemap - parse entries
      let entries = parseSitemap(content)

      // Apply NN-specific filtering if needed
      if (domain === "narodne-novine.nn.hr" && opts.types.length > 0) {
        entries = filterNNSitemaps(entries, opts.types)
      }

      console.log(`[sitemap-scanner] Found ${entries.length} URLs in ${sitemapUrl}`)
      result.urlsDiscovered += entries.length

      // Process entries and register them
      const { registered, skipped } = await processSitemapEntries(
        endpointId,
        entries,
        opts.deduplicateUrls
      )

      result.urlsRegistered += registered
      result.urlsSkipped += skipped

      console.log(
        `[sitemap-scanner] Registered ${registered} new URLs, skipped ${skipped} duplicates`
      )
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    const msg = `Failed to scan ${sitemapUrl}: ${errorMsg}`
    result.errors.push(msg)
    result.success = false
    console.error(`[sitemap-scanner] ${msg}`)
  }

  return result
}

/**
 * Scan a sitemap entrypoint and create/update the endpoint in the database
 */
export async function scanSitemapEntrypoint(
  domain: string,
  sitemapUrl: string,
  options?: {
    name?: string
    types?: number[]
    maxDepth?: number
  }
): Promise<SitemapScanResult> {
  console.log(`[sitemap-scanner] Processing entrypoint: ${domain}`)

  // Find or create endpoint
  let endpoint = await db.discoveryEndpoint.findFirst({
    where: { domain, path: "/sitemap.xml" },
  })

  if (!endpoint) {
    endpoint = await db.discoveryEndpoint.create({
      data: {
        domain,
        path: "/sitemap.xml",
        name: options?.name || `${domain} Sitemap`,
        endpointType: "SITEMAP_INDEX",
        priority: "HIGH",
        scrapeFrequency: "DAILY",
        listingStrategy: "SITEMAP_XML",
        isActive: true,
      },
    })
    console.log(`[sitemap-scanner] Created endpoint: ${endpoint.id}`)
  }

  // Scan the sitemap recursively
  const result = await scanSitemapRecursive(domain, sitemapUrl, endpoint.id, {
    types: options?.types,
    maxDepth: options?.maxDepth,
  })

  // Update endpoint's last scraped timestamp
  await db.discoveryEndpoint.update({
    where: { id: endpoint.id },
    data: {
      lastScrapedAt: new Date(),
      consecutiveErrors: result.success ? 0 : { increment: 1 },
      lastError: result.errors.length > 0 ? result.errors[0] : null,
    },
  })

  return result
}
