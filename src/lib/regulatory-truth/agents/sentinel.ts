// src/lib/regulatory-truth/agents/sentinel.ts
import { DiscoveryPriority, ScrapeFrequency } from "@prisma/client"
import { db } from "@/lib/db"
import { fetchWithRateLimit } from "../utils/rate-limiter"
import { detectContentChange, hashContent } from "../utils/content-hash"
import { parseSitemap, filterNNSitemaps, getLatestNNIssueSitemaps } from "../parsers/sitemap-parser"
import { parseHtmlList, findPaginationLinks } from "../parsers/html-list-parser"
import { logAuditEvent } from "../utils/audit-log"

interface SentinelConfig {
  maxItemsPerRun: number
  maxPagesPerEndpoint: number
}

const DEFAULT_CONFIG: SentinelConfig = {
  maxItemsPerRun: 500,
  maxPagesPerEndpoint: 5,
}

export interface SentinelResult {
  success: boolean
  endpointsChecked: number
  newItemsDiscovered: number
  errors: string[]
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
      const entries = parseSitemap(content)

      // For NN, filter to relevant types and get latest issues
      if (endpoint.domain === "narodne-novine.nn.hr") {
        const allowedTypes = (endpoint.metadata as { types?: number[] })?.types || [1, 2]
        const filtered = filterNNSitemaps(entries, allowedTypes)
        const latest = getLatestNNIssueSitemaps(filtered, 20)
        discoveredUrls = latest.map((e) => ({ url: e.url, title: null, date: e.lastmod || null }))
      } else {
        discoveredUrls = entries.map((e) => ({ url: e.url, title: null, date: e.lastmod || null }))
      }
    } else {
      // HTML-based parsing
      const items = parseHtmlList(content, {
        baseUrl,
        itemSelector: "article, .news-item, .views-row",
      })
      discoveredUrls = items

      // Handle pagination
      if (endpoint.listingStrategy === "PAGINATION") {
        const paginationLinks = findPaginationLinks(content, baseUrl, config.maxPagesPerEndpoint)

        for (const pageUrl of paginationLinks) {
          try {
            const pageResponse = await fetchWithRateLimit(pageUrl)
            if (pageResponse.ok) {
              const pageContent = await pageResponse.text()
              const pageItems = parseHtmlList(pageContent, {
                baseUrl: pageUrl,
                itemSelector: "article, .news-item, .views-row",
              })
              discoveredUrls.push(...pageItems)
            }
          } catch (error) {
            console.log(`[sentinel] Failed to fetch page: ${pageUrl}`)
          }
        }
      }
    }

    // Create DiscoveredItem records for new URLs
    let newItemCount = 0
    for (const item of discoveredUrls) {
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
          await db.discoveredItem.create({
            data: {
              endpointId: endpoint.id,
              url: item.url,
              title: item.title,
              publishedAt: item.date ? new Date(item.date) : null,
              status: "PENDING",
            },
          })
          newItemCount++
        }
      } catch (error) {
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
      console.log(`[sentinel] Fetching: ${item.url}`)
      const response = await fetchWithRateLimit(item.url)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const content = await response.text()
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
        // Find or create source
        const source = await db.regulatorySource.findFirst({
          where: {
            url: { contains: item.endpoint.domain },
          },
        })

        if (source) {
          // Create new evidence record
          const evidence = await db.evidence.create({
            data: {
              sourceId: source.id,
              url: item.url,
              rawContent: content,
              contentHash,
              contentType: "html",
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
        } else {
          console.log(`[sentinel] No source found for ${item.endpoint.domain}`)
          await db.discoveredItem.update({
            where: { id: item.id },
            data: { status: "SKIPPED" },
          })
        }
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
