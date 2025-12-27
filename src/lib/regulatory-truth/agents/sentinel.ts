// src/lib/regulatory-truth/agents/sentinel.ts
import { DiscoveryPriority, FreshnessRisk, ScrapeFrequency } from "@prisma/client"
import { db } from "@/lib/db"
import { fetchWithRateLimit } from "../utils/rate-limiter"
import { detectContentChange, hashContent } from "../utils/content-hash"
import {
  parseSitemap,
  parseSitemapIndex,
  isSitemapIndex,
  filterNNSitemaps,
  SitemapEntry,
} from "../parsers/sitemap-parser"
import {
  parseHtmlList,
  findPaginationLinks,
  extractDocumentLinks,
} from "../parsers/html-list-parser"
import { logAuditEvent } from "../utils/audit-log"
import { detectBinaryType, parseBinaryContent } from "../utils/binary-parser"
import { ocrQueue, extractQueue } from "../workers/queues"
import { isScannedPdf } from "../utils/ocr-processor"
import { isBlockedDomain } from "../utils/concept-resolver"
import { crawlSite, CrawlOptions } from "./site-crawler"
import {
  classifyUrl,
  applyRiskInheritance,
  updateVelocity,
  calculateNextScan,
} from "../utils/adaptive-sentinel"

interface SentinelConfig {
  maxItemsPerRun: number
  maxPagesPerEndpoint: number
  maxSitemapDepth: number
  sitemapDelayMs: number
  crawlMaxDepth: number
  crawlMaxUrls: number
  crawlDelayMs: number
  // Randomized delay range to avoid detection patterns
  delayMinMs: number
  delayMaxMs: number
}

const DEFAULT_CONFIG: SentinelConfig = {
  maxItemsPerRun: 5000, // Increased from 500
  maxPagesPerEndpoint: 20, // Increased from 5
  maxSitemapDepth: 5, // Increased from 3
  sitemapDelayMs: 2000, // Base delay, will be randomized
  crawlMaxDepth: 4, // Increased from 3
  crawlMaxUrls: 2000, // Increased from 500
  crawlDelayMs: 2000, // Base delay, will be randomized
  delayMinMs: 2000, // Minimum 2 seconds
  delayMaxMs: 5000, // Maximum 5 seconds
}

/**
 * Helper to add randomized delay between requests.
 * Uses random jitter to avoid predictable patterns that could trigger IP bans.
 */
function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = minMs + Math.random() * (maxMs - minMs)
  return new Promise((resolve) => setTimeout(resolve, delay))
}

/**
 * Fetch the "Daily Manifest" - URLs that are due for scanning.
 * Orders by freshnessRisk (CRITICAL first) then by nextScanDue.
 */
async function fetchDueItems(limit: number = 500): Promise<
  Array<{
    id: string
    url: string
    contentHash: string | null
    changeFrequency: number
    scanCount: number
    freshnessRisk: FreshnessRisk
    endpointId: string
    endpoint: { domain: string; id: string }
  }>
> {
  // Note: PENDING items are excluded - they need to go through the full
  // discovery pipeline first (fetch → Evidence creation → extraction).
  // Adaptive scanning only re-checks items that have already been processed.
  const dueItems = await db.discoveredItem.findMany({
    where: {
      nextScanDue: { lte: new Date() },
      status: { in: ["FETCHED", "PROCESSED"] },
    },
    orderBy: [
      { freshnessRisk: "asc" }, // CRITICAL=first in enum order
      { nextScanDue: "asc" },
    ],
    take: limit,
    select: {
      id: true,
      url: true,
      contentHash: true,
      changeFrequency: true,
      scanCount: true,
      freshnessRisk: true,
      endpointId: true,
      endpoint: {
        select: {
          domain: true,
          id: true,
        },
      },
    },
  })

  return dueItems
}

/**
 * Group items by endpoint for rate-limited execution.
 */
function groupByEndpoint<T extends { endpointId: string }>(items: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const existing = groups.get(item.endpointId) || []
    existing.push(item)
    groups.set(item.endpointId, existing)
  }
  return groups
}

/**
 * Scan a single URL and update its velocity/schedule.
 * Returns true if content changed, false otherwise.
 */
async function scanAndUpdateItem(item: {
  id: string
  url: string
  contentHash: string | null
  changeFrequency: number
  scanCount: number
  freshnessRisk: FreshnessRisk
}): Promise<{ changed: boolean; error?: string }> {
  try {
    console.log(`[sentinel:adaptive] Scanning: ${item.url}`)

    const response = await fetchWithRateLimit(item.url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const content = await response.text()
    const newHash = hashContent(content)
    const contentChanged = item.contentHash !== null && item.contentHash !== newHash

    // Update velocity using EWMA
    const velocityUpdate = updateVelocity(item.changeFrequency, item.scanCount, contentChanged)

    // Calculate next scan time
    const nextScanDue = calculateNextScan(velocityUpdate.newFrequency, item.freshnessRisk)

    // Update the item
    await db.discoveredItem.update({
      where: { id: item.id },
      data: {
        contentHash: newHash,
        changeFrequency: velocityUpdate.newFrequency,
        scanCount: { increment: 1 },
        lastChangedAt: velocityUpdate.lastChangedAt,
        nextScanDue,
        status: "FETCHED",
      },
    })

    if (contentChanged) {
      console.log(
        `[sentinel:adaptive] Content changed for ${item.url}, velocity: ${velocityUpdate.newFrequency.toFixed(2)}`
      )
    }

    return { changed: contentChanged }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[sentinel:adaptive] Error scanning ${item.url}: ${errorMessage}`)

    // On error, push back the next scan by 1 hour
    const nextScanDue = new Date()
    nextScanDue.setHours(nextScanDue.getHours() + 1)

    await db.discoveredItem.update({
      where: { id: item.id },
      data: {
        nextScanDue,
        errorMessage,
      },
    })

    return { changed: false, error: errorMessage }
  }
}

/**
 * Process a batch of items for a single endpoint with rate limiting.
 * Max 2 concurrent requests, 2-5 second delay between.
 */
async function processBatchPolitely(
  items: Array<{
    id: string
    url: string
    contentHash: string | null
    changeFrequency: number
    scanCount: number
    freshnessRisk: FreshnessRisk
  }>,
  config: { delayMinMs: number; delayMaxMs: number }
): Promise<{ scanned: number; changed: number; errors: number }> {
  let scanned = 0
  let changed = 0
  let errors = 0

  for (const item of items) {
    // Add random delay between requests
    if (scanned > 0) {
      await randomDelay(config.delayMinMs, config.delayMaxMs)
    }

    const result = await scanAndUpdateItem(item)
    scanned++

    if (result.error) {
      errors++
    } else if (result.changed) {
      changed++
    }
  }

  return { scanned, changed, errors }
}

/**
 * Recursively scan a sitemap URL and collect all entries.
 * Handles both sitemap indexes (which contain other sitemaps) and regular sitemaps.
 */
async function scanSitemapRecursively(
  sitemapUrl: string,
  domain: string,
  options: {
    maxDepth: number
    currentDepth?: number
    delayMinMs: number
    delayMaxMs: number
    allowedNNTypes?: number[]
  }
): Promise<{ entries: SitemapEntry[]; sitemapsScanned: number; errors: string[] }> {
  const currentDepth = options.currentDepth ?? 0
  const result = {
    entries: [] as SitemapEntry[],
    sitemapsScanned: 0,
    errors: [] as string[],
  }

  // Check max depth
  if (currentDepth >= options.maxDepth) {
    console.log(`[sentinel] Max sitemap depth ${options.maxDepth} reached for ${sitemapUrl}`)
    return result
  }

  console.log(`[sentinel] Scanning sitemap: ${sitemapUrl} (depth ${currentDepth})`)

  try {
    const response = await fetchWithRateLimit(sitemapUrl)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const content = await response.text()
    result.sitemapsScanned++

    // Check if this is a sitemap index
    if (isSitemapIndex(content)) {
      const childSitemapUrls = parseSitemapIndex(content)
      console.log(`[sentinel] Found sitemap index with ${childSitemapUrls.length} child sitemaps`)

      // For NN, filter sitemaps by type before recursing
      let urlsToScan = childSitemapUrls
      if (domain === "narodne-novine.nn.hr" && options.allowedNNTypes) {
        urlsToScan = childSitemapUrls.filter((url) => {
          const filename = url.split("/").pop() || ""
          const match = filename.match(/sitemap_(\d)_/)
          if (!match) return true // Keep non-matching URLs
          const type = parseInt(match[1], 10)
          return options.allowedNNTypes!.includes(type)
        })
        console.log(
          `[sentinel] Filtered to ${urlsToScan.length} NN sitemaps (types ${options.allowedNNTypes.join(", ")})`
        )
      }

      // Recursively scan each child sitemap
      for (const childUrl of urlsToScan) {
        // Randomized delay to avoid IP bans
        await randomDelay(options.delayMinMs, options.delayMaxMs)

        const childResult = await scanSitemapRecursively(childUrl, domain, {
          ...options,
          currentDepth: currentDepth + 1,
        })

        result.entries.push(...childResult.entries)
        result.sitemapsScanned += childResult.sitemapsScanned
        result.errors.push(...childResult.errors)
      }
    } else {
      // Regular sitemap - parse entries
      let entries = parseSitemap(content)

      // For NN content sitemaps, filter by type if applicable
      if (domain === "narodne-novine.nn.hr" && options.allowedNNTypes) {
        entries = filterNNSitemaps(entries, options.allowedNNTypes)
      }

      console.log(`[sentinel] Found ${entries.length} URLs in ${sitemapUrl}`)
      result.entries.push(...entries)
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    result.errors.push(`Failed to scan ${sitemapUrl}: ${errorMsg}`)
    console.error(`[sentinel] Sitemap scan error: ${errorMsg}`)
  }

  return result
}

export interface SentinelResult {
  success: boolean
  endpointsChecked: number
  newItemsDiscovered: number
  errors: string[]
}

/**
 * Find or create a RegulatorySource for the given domain.
 * This prevents items from being SKIPPED just because a source wasn't pre-configured.
 */
async function findOrCreateSource(domain: string): Promise<{ id: string } | null> {
  // First, try to find existing source by domain
  let source = await db.regulatorySource.findFirst({
    where: {
      url: { contains: domain },
    },
  })

  if (source) {
    return source
  }

  // Try without www prefix
  const domainWithoutWww = domain.replace(/^www\./, "")
  source = await db.regulatorySource.findFirst({
    where: {
      url: { contains: domainWithoutWww },
    },
  })

  if (source) {
    return source
  }

  // Auto-create a new source for this domain
  console.log(`[sentinel] Auto-creating RegulatorySource for ${domain}`)
  try {
    source = await db.regulatorySource.create({
      data: {
        slug: domain.replace(/\./g, "-").toLowerCase(),
        name: `Auto: ${domain}`,
        url: `https://${domain}`,
        hierarchy: 5, // Default uputa level
        isActive: true,
      },
    })
    console.log(`[sentinel] Created RegulatorySource: ${source.id} for ${domain}`)
    return source
  } catch (error) {
    console.error(`[sentinel] Failed to create source for ${domain}:`, error)
    return null
  }
}

/**
 * Check if an endpoint should be scraped based on its frequency.
 */
function shouldScrapeEndpoint(
  frequency: ScrapeFrequency,
  lastScrapedAt: Date | null,
  now: Date
): boolean {
  if (!lastScrapedAt) return true

  const hoursSinceScrape = (now.getTime() - lastScrapedAt.getTime()) / (1000 * 60 * 60)

  switch (frequency) {
    case "EVERY_RUN":
      return true
    case "DAILY":
      return hoursSinceScrape >= 24
    case "TWICE_WEEKLY":
      return hoursSinceScrape >= 84 // ~3.5 days
    case "WEEKLY":
      return hoursSinceScrape >= 168
    case "MONTHLY":
      return hoursSinceScrape >= 720
    default:
      return true
  }
}

/**
 * Process a single discovery endpoint.
 */
async function processEndpoint(
  endpoint: {
    id: string
    domain: string
    path: string
    name: string
    listingStrategy: string
    urlPattern: string | null
    paginationPattern: string | null
    lastContentHash: string | null
    metadata: unknown
  },
  config: SentinelConfig
): Promise<{ newItems: number; error?: string }> {
  const baseUrl = `https://${endpoint.domain}${endpoint.path}`
  console.log(`[sentinel] Checking: ${baseUrl}`)

  try {
    const response = await fetchWithRateLimit(baseUrl)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const content = await response.text()
    const { hasChanged, newHash } = detectContentChange(content, endpoint.lastContentHash)

    // Update endpoint with new hash
    await db.discoveryEndpoint.update({
      where: { id: endpoint.id },
      data: {
        lastScrapedAt: new Date(),
        lastContentHash: newHash,
        consecutiveErrors: 0,
        lastError: null,
      },
    })

    if (!hasChanged && endpoint.lastContentHash) {
      console.log(`[sentinel] No changes detected for ${endpoint.name}`)
      return { newItems: 0 }
    }

    // Parse content based on strategy
    let discoveredUrls: { url: string; title: string | null; date: string | null }[] = []

    if (endpoint.listingStrategy === "SITEMAP_XML") {
      // Get allowed NN types from metadata (if this is an NN endpoint)
      const allowedNNTypes =
        endpoint.domain === "narodne-novine.nn.hr"
          ? (endpoint.metadata as { types?: number[] })?.types || [1, 2]
          : undefined

      // Check if this is a sitemap index that needs recursive scanning
      if (isSitemapIndex(content)) {
        console.log(`[sentinel] Detected sitemap index, starting recursive scan...`)

        const scanResult = await scanSitemapRecursively(baseUrl, endpoint.domain, {
          maxDepth: config.maxSitemapDepth,
          delayMinMs: config.delayMinMs,
          delayMaxMs: config.delayMaxMs,
          allowedNNTypes,
        })

        console.log(
          `[sentinel] Recursive scan complete: ${scanResult.sitemapsScanned} sitemaps, ${scanResult.entries.length} URLs`
        )

        if (scanResult.errors.length > 0) {
          console.warn(`[sentinel] Sitemap scan had ${scanResult.errors.length} errors`)
        }

        discoveredUrls = scanResult.entries.map((e) => ({
          url: e.url,
          title: null,
          date: e.lastmod || null,
        }))
      } else {
        // Regular sitemap - just parse directly
        let entries = parseSitemap(content)

        // Apply NN filtering if applicable
        if (allowedNNTypes) {
          entries = filterNNSitemaps(entries, allowedNNTypes)
        }

        console.log(`[sentinel] Parsed ${entries.length} URLs from sitemap`)
        discoveredUrls = entries.map((e) => ({
          url: e.url,
          title: null,
          date: e.lastmod || null,
        }))
      }
    } else if (endpoint.listingStrategy === "CRAWL") {
      // Recursive site crawling to build custom sitemap
      console.log(`[sentinel] Starting site crawl for ${endpoint.domain}`)

      // Get crawl options from metadata
      const crawlMeta = endpoint.metadata as {
        maxDepth?: number
        maxUrls?: number
        includePatterns?: string[]
        excludePatterns?: string[]
      } | null

      const crawlOptions: Partial<CrawlOptions> = {
        maxDepth: crawlMeta?.maxDepth ?? config.crawlMaxDepth,
        maxUrls: crawlMeta?.maxUrls ?? config.crawlMaxUrls,
        delayMs: config.crawlDelayMs,
        includePatterns: crawlMeta?.includePatterns?.map((p) => new RegExp(p)),
        excludePatterns: crawlMeta?.excludePatterns?.map((p) => new RegExp(p)),
      }

      const crawlResult = await crawlSite(baseUrl, crawlOptions)

      console.log(
        `[sentinel] Crawl complete: ${crawlResult.urlsCrawled} pages, ${crawlResult.urlsDiscovered} URLs`
      )

      if (crawlResult.errors.length > 0) {
        console.warn(`[sentinel] Crawl had ${crawlResult.errors.length} errors`)
      }

      discoveredUrls = crawlResult.urls.map((u) => ({
        url: u.url,
        title: u.title,
        date: null,
      }))
    } else {
      // HTML-based parsing
      const items = parseHtmlList(content, {
        baseUrl,
        itemSelector: "article, .news-item, .views-row",
      })
      discoveredUrls = items

      // Also extract document links (PDFs, DOCs, etc.) from anywhere on the page
      const documentLinks = extractDocumentLinks(content, baseUrl)
      if (documentLinks.length > 0) {
        console.log(`[sentinel] Found ${documentLinks.length} document links on ${baseUrl}`)
        discoveredUrls.push(...documentLinks)
      }

      // Handle pagination
      if (endpoint.listingStrategy === "PAGINATION") {
        const paginationLinks = findPaginationLinks(content, baseUrl, config.maxPagesPerEndpoint)

        for (const pageUrl of paginationLinks) {
          try {
            // Randomized delay between pagination requests to avoid IP bans
            await randomDelay(config.delayMinMs, config.delayMaxMs)

            const pageResponse = await fetchWithRateLimit(pageUrl)
            if (pageResponse.ok) {
              const pageContent = await pageResponse.text()
              const pageItems = parseHtmlList(pageContent, {
                baseUrl: pageUrl,
                itemSelector: "article, .news-item, .views-row",
              })
              discoveredUrls.push(...pageItems)

              // Also extract documents from paginated pages
              const pageDocuments = extractDocumentLinks(pageContent, pageUrl)
              discoveredUrls.push(...pageDocuments)
            }
          } catch (_error) {
            console.log(`[sentinel] Failed to fetch page: ${pageUrl}`)
          }
        }
      }
    }

    // Deduplicate discovered URLs before creating items
    const seenUrls = new Set<string>()
    const uniqueUrls = discoveredUrls.filter((item) => {
      if (seenUrls.has(item.url)) {
        return false
      }
      seenUrls.add(item.url)
      return true
    })

    if (uniqueUrls.length < discoveredUrls.length) {
      console.log(
        `[sentinel] Deduplicated ${discoveredUrls.length - uniqueUrls.length} duplicate URLs`
      )
    }

    // Create DiscoveredItem records for new URLs
    let newItemCount = 0
    for (const item of uniqueUrls) {
      try {
        // Check for existing item with same URL from this endpoint
        const existingItem = await db.discoveredItem.findFirst({
          where: {
            endpointId: endpoint.id,
            url: item.url,
          },
          orderBy: { createdAt: "desc" },
        })

        if (existingItem) {
          // If item was previously processed, re-queue it for re-fetch to check for content changes
          if (existingItem.status === "FETCHED" || existingItem.status === "PROCESSED") {
            await db.discoveredItem.update({
              where: { id: existingItem.id },
              data: {
                status: "PENDING",
                retryCount: 0,
                errorMessage: null,
              },
            })
            console.log(`[sentinel] Re-queued ${item.url} for content change check`)
            newItemCount++
          } else {
            console.log(`[sentinel] Item already pending for ${item.url}`)
          }
        } else {
          // Create new discovered item (first time)
          const classification = classifyUrl(item.url)
          await db.discoveredItem.create({
            data: {
              endpointId: endpoint.id,
              url: item.url,
              title: item.title,
              publishedAt: item.date ? new Date(item.date) : null,
              status: "PENDING",
              // New adaptive fields
              nodeType: classification.nodeType,
              nodeRole: classification.nodeRole,
              freshnessRisk: classification.freshnessRisk,
              changeFrequency: 0.5, // Start neutral
              scanCount: 0,
              nextScanDue: new Date(), // Due immediately
            },
          })
          newItemCount++
        }
      } catch (_error) {
        // Likely duplicate (unique constraint violation from race condition)
        // This is expected and fine
      }
    }

    console.log(`[sentinel] Discovered ${newItemCount} new items from ${endpoint.name}`)
    return { newItems: newItemCount }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    await db.discoveryEndpoint.update({
      where: { id: endpoint.id },
      data: {
        consecutiveErrors: { increment: 1 },
        lastError: errorMessage,
      },
    })

    return { newItems: 0, error: errorMessage }
  }
}

/**
 * Run the Sentinel agent to discover new content.
 */
export async function runSentinel(
  priority?: DiscoveryPriority,
  config: Partial<SentinelConfig> = {}
): Promise<SentinelResult> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config }
  const now = new Date()
  const result: SentinelResult = {
    success: true,
    endpointsChecked: 0,
    newItemsDiscovered: 0,
    errors: [],
  }

  try {
    // Reset error counts for endpoints that haven't been tried in 24 hours
    // This allows previously failing endpoints to be retried
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const resetResult = await db.discoveryEndpoint.updateMany({
      where: {
        consecutiveErrors: { gte: 5 },
        lastScrapedAt: { lt: twentyFourHoursAgo },
      },
      data: {
        consecutiveErrors: 0,
        lastError: null,
      },
    })
    if (resetResult.count > 0) {
      console.log(`[sentinel] Reset error counts for ${resetResult.count} endpoints`)
    }

    // Get active endpoints, optionally filtered by priority
    const whereClause: Record<string, unknown> = {
      isActive: true,
      consecutiveErrors: { lt: 5 }, // Skip endpoints with too many errors
    }
    if (priority) {
      whereClause.priority = priority
    }

    const endpoints = await db.discoveryEndpoint.findMany({
      where: whereClause,
      orderBy: [
        { priority: "asc" }, // CRITICAL first
        { lastScrapedAt: "asc" }, // Oldest first
      ],
    })

    console.log(`[sentinel] Found ${endpoints.length} active endpoints`)

    for (const endpoint of endpoints) {
      // Check if we should scrape based on frequency
      if (!shouldScrapeEndpoint(endpoint.scrapeFrequency, endpoint.lastScrapedAt, now)) {
        continue
      }

      result.endpointsChecked++
      const { newItems, error } = await processEndpoint(endpoint, mergedConfig)
      result.newItemsDiscovered += newItems

      if (error) {
        result.errors.push(`${endpoint.name}: ${error}`)
      }

      // Safety limit
      if (result.newItemsDiscovered >= mergedConfig.maxItemsPerRun) {
        console.log(`[sentinel] Reached max items limit (${mergedConfig.maxItemsPerRun})`)
        break
      }
    }

    console.log(
      `[sentinel] Complete: ${result.endpointsChecked} endpoints, ${result.newItemsDiscovered} new items`
    )
  } catch (error) {
    result.success = false
    result.errors.push(error instanceof Error ? error.message : String(error))
  }

  return result
}

/**
 * Fetch content for pending discovered items and create Evidence records.
 */
export async function fetchDiscoveredItems(limit: number = 100): Promise<{
  fetched: number
  failed: number
}> {
  const items = await db.discoveredItem.findMany({
    where: {
      status: "PENDING",
      retryCount: { lt: 3 },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: { endpoint: true },
  })

  let fetched = 0
  let failed = 0

  for (const item of items) {
    try {
      // GUARD: Skip test/heartbeat domains - they should not enter the pipeline
      if (isBlockedDomain(item.endpoint.domain)) {
        console.log(`[sentinel] Skipping test domain: ${item.endpoint.domain}`)
        await db.discoveredItem.update({
          where: { id: item.id },
          data: {
            status: "SKIPPED",
            errorMessage: `Blocked test domain: ${item.endpoint.domain}`,
          },
        })
        continue
      }

      console.log(`[sentinel] Fetching: ${item.url}`)
      const response = await fetchWithRateLimit(item.url)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      // Handle binary files (PDF, DOCX, etc.)
      let content: string
      let contentType: string = "html"

      // Check both URL extension AND content-type header for binary detection
      const contentTypeHeader = response.headers.get("content-type") || ""
      const binaryType = detectBinaryType(item.url, contentTypeHeader)

      if (binaryType === "pdf") {
        console.log(`[sentinel] PDF detected, checking if scanned or text-based...`)

        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const parsed = await parseBinaryContent(buffer, binaryType)

        const pageCount = (parsed.metadata?.pages as number) || 1
        const isScanned = isScannedPdf(parsed.text, pageCount)

        // Find or create source (auto-creates if not found)
        const source = await findOrCreateSource(item.endpoint.domain)

        if (!source) {
          console.log(`[sentinel] Could not find or create source for ${item.endpoint.domain}`)
          await db.discoveredItem.update({
            where: { id: item.id },
            data: { status: "SKIPPED", errorMessage: "No RegulatorySource available" },
          })
          continue
        }

        if (isScanned) {
          // Scanned PDF - store as base64, queue for OCR
          console.log(
            `[sentinel] Scanned PDF detected (${pageCount} pages, ${parsed.text.length} chars)`
          )

          const contentHash = hashContent(buffer.toString("base64"))
          const evidence = await db.evidence.create({
            data: {
              sourceId: source.id,
              url: item.url,
              rawContent: buffer.toString("base64"),
              contentHash: contentHash,
              contentType: "pdf",
              contentClass: "PDF_SCANNED",
            },
          })

          await db.discoveredItem.update({
            where: { id: item.id },
            data: {
              status: "FETCHED",
              processedAt: new Date(),
              evidenceId: evidence.id,
              contentHash: evidence.contentHash,
            },
          })

          // Queue for OCR, NOT extract
          const runId = `sentinel-${Date.now()}`
          await ocrQueue.add("ocr", { evidenceId: evidence.id, runId })
          console.log(`[sentinel] Queued ${evidence.id} for OCR`)

          await logAuditEvent({
            action: "EVIDENCE_FETCHED",
            entityType: "EVIDENCE",
            entityId: evidence.id,
            metadata: {
              sourceId: source.id,
              url: item.url,
              contentHash: contentHash,
              contentClass: "PDF_SCANNED",
            },
          })

          fetched++
        } else {
          // PDF with text layer - create artifact and queue for extract
          console.log(
            `[sentinel] Text PDF detected (${pageCount} pages, ${parsed.text.length} chars)`
          )

          const contentHash = hashContent(buffer.toString("base64"))
          const evidence = await db.evidence.create({
            data: {
              sourceId: source.id,
              url: item.url,
              rawContent: buffer.toString("base64"),
              contentHash: contentHash,
              contentType: "pdf",
              contentClass: "PDF_TEXT",
            },
          })

          // Create PDF_TEXT artifact
          const artifact = await db.evidenceArtifact.create({
            data: {
              evidenceId: evidence.id,
              kind: "PDF_TEXT",
              content: parsed.text,
              contentHash: hashContent(parsed.text),
            },
          })

          // Set primary text artifact
          await db.evidence.update({
            where: { id: evidence.id },
            data: { primaryTextArtifactId: artifact.id },
          })

          await db.discoveredItem.update({
            where: { id: item.id },
            data: {
              status: "FETCHED",
              processedAt: new Date(),
              evidenceId: evidence.id,
              contentHash: evidence.contentHash,
            },
          })

          // Queue for extraction
          const runId = `sentinel-${Date.now()}`
          await extractQueue.add("extract", { evidenceId: evidence.id, runId })
          console.log(`[sentinel] Queued ${evidence.id} for extraction`)

          await logAuditEvent({
            action: "EVIDENCE_FETCHED",
            entityType: "EVIDENCE",
            entityId: evidence.id,
            metadata: {
              sourceId: source.id,
              url: item.url,
              contentHash: contentHash,
              contentClass: "PDF_TEXT",
            },
          })

          fetched++
        }

        continue
      } else if (binaryType !== "unknown") {
        console.log(`[sentinel] Binary file detected: ${binaryType}`)

        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const parsed = await parseBinaryContent(buffer, binaryType)

        if (!parsed.text || parsed.text.trim().length === 0) {
          throw new Error(`No text extracted from ${binaryType} file`)
        }

        content = parsed.text
        contentType = binaryType
        console.log(`[sentinel] Extracted ${content.length} chars from ${binaryType}`)
      } else {
        content = await response.text()
      }

      const contentHash = hashContent(content)

      // Check if content unchanged from previous fetch
      if (item.contentHash && item.contentHash === contentHash) {
        console.log(`[sentinel] Content unchanged for ${item.url}`)
        await db.discoveredItem.update({
          where: { id: item.id },
          data: {
            status: "PROCESSED",
            processedAt: new Date(),
          },
        })
        continue
      }

      // Check if we already have this content (from a different URL)
      const existingEvidence = await db.evidence.findFirst({
        where: { contentHash },
      })

      if (existingEvidence) {
        // Link to existing evidence
        await db.discoveredItem.update({
          where: { id: item.id },
          data: {
            status: "PROCESSED",
            processedAt: new Date(),
            evidenceId: existingEvidence.id,
            contentHash,
          },
        })
      } else {
        // Find or create source (auto-creates if not found)
        const source = await findOrCreateSource(item.endpoint.domain)

        if (!source) {
          console.log(`[sentinel] Could not find or create source for ${item.endpoint.domain}`)
          await db.discoveredItem.update({
            where: { id: item.id },
            data: { status: "SKIPPED", errorMessage: "No RegulatorySource available" },
          })
          continue
        }

        // Check if this is a content change (item had previous hash)
        const isContentChange = !!(item.contentHash && item.contentHash !== contentHash)

        // Derive contentClass from contentType
        const contentClassMap: Record<string, string> = {
          html: "HTML",
          pdf: "PDF_TEXT",
          doc: "DOC",
          docx: "DOCX",
          xls: "XLS",
          xlsx: "XLSX",
          json: "JSON",
          "json-ld": "JSON_LD",
          xml: "XML",
        }
        const derivedContentClass = contentClassMap[contentType] || "HTML"

        // Upsert evidence record (prevents duplicates with unique constraint on url+contentHash)
        const evidence = await db.evidence.upsert({
          where: {
            url_contentHash: {
              url: item.url,
              contentHash,
            },
          },
          create: {
            sourceId: source.id,
            url: item.url,
            rawContent: content,
            contentHash,
            contentType: contentType,
            contentClass: derivedContentClass,
            hasChanged: isContentChange,
            changeSummary: isContentChange
              ? `Content updated from previous version (hash: ${item.contentHash?.slice(0, 8)}...)`
              : null,
          },
          update: {
            // If we re-encounter same content, just update fetchedAt timestamp
            fetchedAt: new Date(),
          },
        })

        // Log audit event for evidence creation
        await logAuditEvent({
          action: "EVIDENCE_FETCHED",
          entityType: "EVIDENCE",
          entityId: evidence.id,
          metadata: {
            sourceId: source.id,
            url: item.url,
            contentHash: contentHash,
          },
        })

        await db.discoveredItem.update({
          where: { id: item.id },
          data: {
            status: "FETCHED",
            processedAt: new Date(),
            evidenceId: evidence.id,
            contentHash,
          },
        })

        fetched++
      }
    } catch (error) {
      failed++
      await db.discoveredItem.update({
        where: { id: item.id },
        data: {
          retryCount: { increment: 1 },
          errorMessage: error instanceof Error ? error.message : String(error),
          status: item.retryCount >= 2 ? "FAILED" : "PENDING",
        },
      })
    }
  }

  console.log(`[sentinel] Fetched: ${fetched}, Failed: ${failed}`)
  return { fetched, failed }
}

export interface AdaptiveSentinelResult {
  success: boolean
  itemsScanned: number
  itemsChanged: number
  errors: number
  endpointsProcessed: number
}

/**
 * Run the adaptive sentinel cycle.
 *
 * 1. Fetch "due" items from the manifest
 * 2. Group by endpoint for rate limiting
 * 3. Process each group politely
 * 4. Update velocity and schedule for each item
 */
export async function runAdaptiveSentinel(
  config: Partial<SentinelConfig> = {}
): Promise<AdaptiveSentinelResult> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config }

  const result: AdaptiveSentinelResult = {
    success: true,
    itemsScanned: 0,
    itemsChanged: 0,
    errors: 0,
    endpointsProcessed: 0,
  }

  try {
    console.log("[sentinel:adaptive] Starting adaptive scan cycle...")

    // 1. Fetch due items
    const dueItems = await fetchDueItems(mergedConfig.maxItemsPerRun)
    console.log(`[sentinel:adaptive] Found ${dueItems.length} items due for scanning`)

    if (dueItems.length === 0) {
      console.log("[sentinel:adaptive] No items due, cycle complete")
      return result
    }

    // 2. Group by endpoint
    const batches = groupByEndpoint(dueItems)
    console.log(`[sentinel:adaptive] Grouped into ${batches.size} endpoint batches`)

    // 3. Process each batch
    for (const [, items] of batches) {
      const domain = items[0]?.endpoint.domain || "unknown"
      console.log(`[sentinel:adaptive] Processing ${items.length} items for ${domain}`)

      const batchResult = await processBatchPolitely(items, {
        delayMinMs: mergedConfig.delayMinMs,
        delayMaxMs: mergedConfig.delayMaxMs,
      })

      result.itemsScanned += batchResult.scanned
      result.itemsChanged += batchResult.changed
      result.errors += batchResult.errors
      result.endpointsProcessed++
    }

    console.log(
      `[sentinel:adaptive] Cycle complete: ${result.itemsScanned} scanned, ${result.itemsChanged} changed, ${result.errors} errors`
    )
  } catch (error) {
    result.success = false
    console.error("[sentinel:adaptive] Cycle failed:", error)
  }

  return result
}
