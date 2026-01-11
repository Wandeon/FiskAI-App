/**
 * Backfill Discover Worker
 *
 * Discovers historical URLs from configured sources and queues them for fetching.
 * Runs as a separate lane from daily Sentinel, producing the same DiscoveredItem
 * records that the existing fetcher understands.
 *
 * Key invariants:
 * - Uses stable jobId for deduplication
 * - Per-domain rate limiting with jitter
 * - Never overwrites Evidence immutable fields
 * - Hard caps per run and per source
 */

// eslint-disable-next-line no-restricted-imports -- BackfillRun/DiscoveredItem are in main schema, not regulatory
import { db } from "@/lib/db"
import { BackfillMode, DiscoveryMethod } from "@prisma/client"
import type {
  BackfillRunConfig,
  BackfillRunState,
  BackfillError,
  BackfillDiscoveryResult,
  BackfillDiscoveredUrl,
} from "./types"
import { getBackfillConfig, calculateDelay, validateSourceSlugs } from "./source-backfill-config"
import { fetchAllSitemapUrls, filterEntriesByDate } from "./sitemap-parser"
import { fetchPaginatedListing } from "./pagination-parser"
import { canonicalizeUrl } from "./url-canonicalizer"

/**
 * Kill switch check
 */
export function isBackfillEnabled(): boolean {
  return process.env.BACKFILL_ENABLED === "true"
}

/**
 * Run a backfill discovery session
 *
 * @param config - Backfill run configuration
 * @returns Discovery result with statistics
 */
export async function runBackfillDiscovery(
  config: BackfillRunConfig
): Promise<BackfillDiscoveryResult> {
  const startTime = Date.now()

  // Kill switch check
  if (!isBackfillEnabled()) {
    throw new Error("Backfill disabled. Set BACKFILL_ENABLED=true to enable.")
  }

  // Validate sources
  const { valid: validSources, invalid: invalidSources } = validateSourceSlugs(config.sources)
  if (invalidSources.length > 0) {
    throw new Error(`Unknown sources: ${invalidSources.join(", ")}`)
  }
  if (validSources.length === 0) {
    throw new Error("No valid sources specified")
  }

  // Create BackfillRun record
  const backfillRun = await db.backfillRun.create({
    data: {
      sources: validSources,
      mode: config.mode,
      dateFrom: config.dateFrom,
      dateTo: config.dateTo,
      maxUrls: config.maxUrls,
      concurrency: config.concurrency,
      delayMs: config.delayMs,
      dryRun: config.dryRun,
      runBy: config.runBy,
      notes: config.notes,
      status: "RUNNING",
      startedAt: new Date(),
    },
  })

  const state: BackfillRunState = {
    runId: backfillRun.id,
    discoveredCount: 0,
    queuedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    errors: [],
  }

  console.log(`[backfill] Starting run ${backfillRun.id}`)
  console.log(`[backfill] Sources: ${validSources.join(", ")}`)
  console.log(`[backfill] Mode: ${config.mode}`)
  console.log(`[backfill] Max URLs: ${config.maxUrls}`)
  console.log(`[backfill] Dry run: ${config.dryRun}`)

  try {
    // Process each source
    for (const sourceSlug of validSources) {
      // Check global cap
      if (state.discoveredCount >= config.maxUrls) {
        console.log(`[backfill] Global cap reached: ${state.discoveredCount}`)
        break
      }

      await processSource(sourceSlug, config, state)

      // Update progress
      state.lastProcessedSource = sourceSlug
      await updateBackfillRunProgress(backfillRun.id, state)
    }

    // Mark as completed
    await db.backfillRun.update({
      where: { id: backfillRun.id },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        discoveredCount: state.discoveredCount,
        queuedCount: state.queuedCount,
        skippedCount: state.skippedCount,
        errorCount: state.errorCount,
        errorLog: state.errors.length > 0 ? state.errors : undefined,
      },
    })

    console.log(`[backfill] Run ${backfillRun.id} completed`)
    console.log(`[backfill]   Discovered: ${state.discoveredCount}`)
    console.log(`[backfill]   Queued: ${state.queuedCount}`)
    console.log(`[backfill]   Skipped: ${state.skippedCount}`)
    console.log(`[backfill]   Errors: ${state.errorCount}`)

    return {
      success: true,
      runId: backfillRun.id,
      discoveredCount: state.discoveredCount,
      queuedCount: state.queuedCount,
      skippedCount: state.skippedCount,
      errorCount: state.errorCount,
      durationMs: Date.now() - startTime,
      errors: state.errors,
    }
  } catch (error) {
    // Mark as failed
    const errorMessage = error instanceof Error ? error.message : String(error)
    state.errors.push({
      timestamp: new Date().toISOString(),
      source: "backfill",
      message: errorMessage,
    })

    await db.backfillRun.update({
      where: { id: backfillRun.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        discoveredCount: state.discoveredCount,
        queuedCount: state.queuedCount,
        skippedCount: state.skippedCount,
        errorCount: state.errorCount + 1,
        errorLog: state.errors,
      },
    })

    console.error(`[backfill] Run ${backfillRun.id} failed:`, errorMessage)

    return {
      success: false,
      runId: backfillRun.id,
      discoveredCount: state.discoveredCount,
      queuedCount: state.queuedCount,
      skippedCount: state.skippedCount,
      errorCount: state.errorCount + 1,
      durationMs: Date.now() - startTime,
      errors: state.errors,
    }
  }
}

/**
 * Process a single source for backfill discovery
 */
async function processSource(
  sourceSlug: string,
  config: BackfillRunConfig,
  state: BackfillRunState
): Promise<void> {
  const sourceConfig = getBackfillConfig(sourceSlug)
  if (!sourceConfig) {
    console.error(`[backfill] No config for source: ${sourceSlug}`)
    return
  }

  console.log(`[backfill] Processing source: ${sourceSlug}`)

  // Find the DiscoveryEndpoint for this source
  const endpoint = await db.discoveryEndpoint.findFirst({
    where: {
      domain: sourceConfig.domain,
      isActive: true,
    },
  })

  if (!endpoint) {
    const error: BackfillError = {
      timestamp: new Date().toISOString(),
      source: sourceSlug,
      message: `No active endpoint found for domain: ${sourceConfig.domain}`,
    }
    state.errors.push(error)
    state.errorCount++
    return
  }

  // Discover URLs based on mode
  let discoveredUrls: BackfillDiscoveredUrl[] = []

  try {
    if (config.mode === BackfillMode.SITEMAP && sourceConfig.sitemapUrl) {
      discoveredUrls = await discoverFromSitemap(sourceSlug, sourceConfig, config)
    } else if (
      (config.mode === BackfillMode.PAGINATION || config.mode === BackfillMode.ARCHIVE) &&
      sourceConfig.archiveUrl
    ) {
      discoveredUrls = await discoverFromPagination(sourceSlug, sourceConfig, config)
    } else {
      console.log(`[backfill] No discovery strategy for ${sourceSlug} in mode ${config.mode}`)
      return
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    state.errors.push({
      timestamp: new Date().toISOString(),
      source: sourceSlug,
      message: `Discovery failed: ${errorMessage}`,
    })
    state.errorCount++
    return
  }

  console.log(`[backfill] Found ${discoveredUrls.length} URLs from ${sourceSlug}`)
  state.discoveredCount += discoveredUrls.length

  // Upsert discovered items
  for (const discovered of discoveredUrls) {
    // Check global cap
    if (state.queuedCount + state.skippedCount >= config.maxUrls) {
      break
    }

    try {
      const result = await upsertDiscoveredItem(endpoint.id, discovered, state.runId, config.dryRun)

      if (result === "created") {
        state.queuedCount++
      } else if (result === "skipped") {
        state.skippedCount++
      }

      state.lastProcessedUrl = discovered.url

      // Rate limiting delay
      const delay = calculateDelay(sourceConfig.rateLimit)
      await new Promise((resolve) => setTimeout(resolve, delay / 10)) // Reduced for upsert (no HTTP)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      state.errors.push({
        timestamp: new Date().toISOString(),
        source: sourceSlug,
        url: discovered.url,
        message: errorMessage,
      })
      state.errorCount++
    }
  }
}

/**
 * Discover URLs from sitemap
 */
async function discoverFromSitemap(
  sourceSlug: string,
  sourceConfig: ReturnType<typeof getBackfillConfig>,
  config: BackfillRunConfig
): Promise<BackfillDiscoveredUrl[]> {
  if (!sourceConfig?.sitemapUrl) {
    throw new Error(`No sitemap URL configured for ${sourceSlug}`)
  }

  console.log(`[backfill] Fetching sitemap: ${sourceConfig.sitemapUrl}`)

  // Fetch all sitemap entries (handles indexes recursively)
  let entries = await fetchAllSitemapUrls(sourceConfig.sitemapUrl)

  // Filter by date range if specified
  if (config.dateFrom || config.dateTo) {
    entries = filterEntriesByDate(entries, config.dateFrom, config.dateTo)
    console.log(`[backfill] After date filter: ${entries.length} entries`)
  }

  // Filter by URL pattern
  if (sourceConfig.urlPattern) {
    entries = entries.filter((e) => sourceConfig.urlPattern!.test(e.loc))
    console.log(`[backfill] After URL pattern filter: ${entries.length} entries`)
  }

  // Convert to BackfillDiscoveredUrl
  return entries.map((entry) => ({
    url: canonicalizeUrl(entry.loc),
    publishedAt: entry.lastmod ? new Date(entry.lastmod) : undefined,
    sourceSlug,
  }))
}

/**
 * Discover URLs from paginated archive
 */
async function discoverFromPagination(
  sourceSlug: string,
  sourceConfig: ReturnType<typeof getBackfillConfig>,
  config: BackfillRunConfig
): Promise<BackfillDiscoveredUrl[]> {
  if (!sourceConfig?.archiveUrl) {
    throw new Error(`No archive URL configured for ${sourceSlug}`)
  }

  console.log(`[backfill] Fetching paginated archive: ${sourceConfig.archiveUrl}`)

  const urls = await fetchPaginatedListing(
    sourceConfig.archiveUrl,
    sourceConfig.paginationPattern ?? "?page={N}",
    sourceConfig.urlPattern ?? /.*/,
    {
      maxPages: sourceConfig.maxPages ?? 50,
      delayMs: config.delayMs,
    }
  )

  console.log(`[backfill] Found ${urls.length} URLs from pagination`)

  return urls.map((url) => ({
    url: canonicalizeUrl(url),
    sourceSlug,
  }))
}

/**
 * Upsert a discovered item into the database
 *
 * @returns "created" if new, "skipped" if already exists
 */
async function upsertDiscoveredItem(
  endpointId: string,
  discovered: BackfillDiscoveredUrl,
  backfillRunId: string,
  dryRun: boolean
): Promise<"created" | "skipped"> {
  // Check if already exists
  const existing = await db.discoveredItem.findUnique({
    where: {
      endpointId_url: {
        endpointId,
        url: discovered.url,
      },
    },
    select: { id: true },
  })

  if (existing) {
    return "skipped"
  }

  if (dryRun) {
    console.log(`[backfill] [DRY RUN] Would create: ${discovered.url}`)
    return "created"
  }

  // Create new discovered item
  await db.discoveredItem.create({
    data: {
      endpointId,
      url: discovered.url,
      title: discovered.title,
      publishedAt: discovered.publishedAt,
      status: "PENDING",
      discoveryMethod: DiscoveryMethod.BACKFILL,
      backfillRunId,
      nodeType: "LEAF",
    },
  })

  return "created"
}

/**
 * Update backfill run progress
 */
async function updateBackfillRunProgress(runId: string, state: BackfillRunState): Promise<void> {
  await db.backfillRun.update({
    where: { id: runId },
    data: {
      discoveredCount: state.discoveredCount,
      queuedCount: state.queuedCount,
      skippedCount: state.skippedCount,
      errorCount: state.errorCount,
      lastProcessedSource: state.lastProcessedSource,
      lastProcessedPage: state.lastProcessedPage,
      lastProcessedUrl: state.lastProcessedUrl,
    },
  })
}

/**
 * Get backfill run status
 */
export async function getBackfillRunStatus(runId: string) {
  return db.backfillRun.findUnique({
    where: { id: runId },
    include: {
      discoveredItems: {
        take: 10,
        orderBy: { createdAt: "desc" },
        select: { id: true, url: true, status: true },
      },
    },
  })
}

/**
 * Cancel a running backfill
 */
export async function cancelBackfillRun(runId: string): Promise<void> {
  await db.backfillRun.update({
    where: { id: runId },
    data: {
      status: "CANCELLED",
      finishedAt: new Date(),
    },
  })
}
