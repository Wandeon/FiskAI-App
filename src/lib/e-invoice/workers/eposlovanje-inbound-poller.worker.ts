// src/lib/e-invoice/workers/eposlovanje-inbound-poller.worker.ts
/**
 * ePoslovanje Inbound Invoice Poller Worker
 *
 * Polls ePoslovanje for incoming invoices on a schedule.
 * Tenant-safe: polls for a specific company via COMPANY_ID env var.
 *
 * Environment:
 *   - COMPANY_ID (required) - Company to poll for
 *   - EPOSLOVANJE_API_BASE (required) - API base URL
 *   - EPOSLOVANJE_API_KEY (required) - API key for authorization
 *   - DATABASE_URL (required) - PostgreSQL connection string
 *   - POLL_INTERVAL_MS (optional, default: 300000 = 5 minutes)
 *   - MAX_WINDOW_DAYS (optional, default: 7) - Max lookback on first run
 */

import { db } from "@/lib/db"
import { Prisma } from "@prisma/client"
import { EposlovanjeEInvoiceProvider } from "../providers/eposlovanje-einvoice"
import { logger } from "@/lib/logger"

const Decimal = Prisma.Decimal

// =============================================================================
// Configuration
// =============================================================================

const COMPANY_ID = process.env.COMPANY_ID
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || "300000", 10) // 5 min
const MAX_WINDOW_DAYS = parseInt(process.env.MAX_WINDOW_DAYS || "7", 10)
const PROVIDER_NAME = "eposlovanje"
const DIRECTION = "INBOUND" as const

// =============================================================================
// Worker State
// =============================================================================

interface WorkerState {
  isRunning: boolean
  shutdownRequested: boolean
  lastPollAt: Date | null
  stats: {
    totalPolls: number
    totalFetched: number
    totalInserted: number
    totalSkipped: number
    totalErrors: number
  }
}

const state: WorkerState = {
  isRunning: false,
  shutdownRequested: false,
  lastPollAt: null,
  stats: {
    totalPolls: 0,
    totalFetched: 0,
    totalInserted: 0,
    totalSkipped: 0,
    totalErrors: 0,
  },
}

// =============================================================================
// Startup Logging
// =============================================================================

function logStartup(): void {
  const commitSha = process.env.COMMIT_SHA || "unknown"
  const nodeEnv = process.env.NODE_ENV || "development"

  console.log("╔══════════════════════════════════════════════════════════════╗")
  console.log("║ WORKER STARTUP: eposlovanje-inbound-poller                   ║")
  console.log("╠══════════════════════════════════════════════════════════════╣")
  console.log(`║ Company ID:      ${(COMPANY_ID || "NOT SET").substring(0, 40).padEnd(42)} ║`)
  console.log(`║ Poll Interval:   ${(POLL_INTERVAL_MS / 1000 + "s").padEnd(42)} ║`)
  console.log(`║ Max Window:      ${(MAX_WINDOW_DAYS + " days").padEnd(42)} ║`)
  console.log(`║ Commit SHA:      ${commitSha.substring(0, 40).padEnd(42)} ║`)
  console.log(`║ Node Env:        ${nodeEnv.padEnd(42)} ║`)
  console.log(`║ Started At:      ${new Date().toISOString().padEnd(42)} ║`)
  console.log("╚══════════════════════════════════════════════════════════════╝")
}

// =============================================================================
// Cursor Management
// =============================================================================

interface SyncState {
  id: string
  lastSuccessfulPollAt: Date
}

async function getOrCreateSyncState(companyId: string): Promise<SyncState> {
  // Try to find existing sync state
  const existing = await db.providerSyncState.findUnique({
    where: {
      companyId_provider_direction: {
        companyId,
        provider: PROVIDER_NAME,
        direction: DIRECTION,
      },
    },
    select: { id: true, lastSuccessfulPollAt: true },
  })

  if (existing) {
    return existing
  }

  // Create new sync state with lookback
  const defaultFrom = new Date()
  defaultFrom.setDate(defaultFrom.getDate() - MAX_WINDOW_DAYS)

  const created = await db.providerSyncState.create({
    data: {
      companyId,
      provider: PROVIDER_NAME,
      direction: DIRECTION,
      lastSuccessfulPollAt: defaultFrom,
    },
    select: { id: true, lastSuccessfulPollAt: true },
  })

  logger.info(
    { companyId, provider: PROVIDER_NAME, direction: DIRECTION, from: defaultFrom },
    "Created new ProviderSyncState with default lookback"
  )

  return created
}

async function advanceCursor(syncStateId: string, newPollAt: Date): Promise<void> {
  await db.providerSyncState.update({
    where: { id: syncStateId },
    data: { lastSuccessfulPollAt: newPollAt },
  })

  logger.info({ syncStateId, newPollAt }, "Advanced cursor to new poll time")
}

// =============================================================================
// Inbound Invoice Processing
// =============================================================================

interface PollResult {
  success: boolean
  fetched: number
  inserted: number
  skipped: number
  errors: number
  errorMessages: string[]
}

async function pollIncomingInvoices(companyId: string): Promise<PollResult> {
  const result: PollResult = {
    success: false,
    fetched: 0,
    inserted: 0,
    skipped: 0,
    errors: 0,
    errorMessages: [],
  }

  // Get sync state and determine window
  const syncState = await getOrCreateSyncState(companyId)
  const fromDate = syncState.lastSuccessfulPollAt
  const toDate = new Date()

  // Safety: cap window to MAX_WINDOW_DAYS
  const maxFrom = new Date()
  maxFrom.setDate(maxFrom.getDate() - MAX_WINDOW_DAYS)
  const effectiveFrom = fromDate < maxFrom ? maxFrom : fromDate

  logger.info(
    { companyId, from: effectiveFrom.toISOString(), to: toDate.toISOString() },
    "Starting inbound poll"
  )

  // Create provider instance
  const apiBase = process.env.EPOSLOVANJE_API_BASE
  const apiKey = process.env.EPOSLOVANJE_API_KEY

  if (!apiBase || !apiKey) {
    result.errorMessages.push("EPOSLOVANJE_API_BASE and EPOSLOVANJE_API_KEY required")
    logger.error({ companyId }, "Provider not configured")
    return result
  }

  const provider = new EposlovanjeEInvoiceProvider({
    apiKey,
    apiUrl: apiBase,
  })

  // Test connectivity
  const isConnected = await provider.testConnection()
  if (!isConnected) {
    result.errorMessages.push("Provider connectivity test failed")
    logger.error({ companyId }, "Provider connectivity test failed")
    return result
  }

  // Fetch all pages of incoming invoices
  let page = 1
  const pageSize = 100
  let hasMore = true

  while (hasMore) {
    const invoices = await provider.fetchIncomingInvoices({
      fromDate: effectiveFrom,
      toDate,
      page,
      pageSize,
    })

    result.fetched += invoices.length
    hasMore = invoices.length >= pageSize
    page++

    // Process each invoice
    for (const invoice of invoices) {
      try {
        // Find or create seller contact
        let sellerId: string | null = null
        if (invoice.sellerOib) {
          const sellerContact = await db.contact.findFirst({
            where: { companyId, oib: invoice.sellerOib },
            select: { id: true },
          })

          if (sellerContact) {
            sellerId = sellerContact.id
          } else {
            const newContact = await db.contact.create({
              data: {
                companyId,
                type: "SUPPLIER",
                name: invoice.sellerName || `Supplier ${invoice.sellerOib}`,
                oib: invoice.sellerOib,
              },
              select: { id: true },
            })
            sellerId = newContact.id
          }
        }

        // Insert invoice - unique constraint handles race conditions
        await db.eInvoice.create({
          data: {
            companyId,
            direction: DIRECTION,
            type: "E_INVOICE",
            invoiceNumber: invoice.invoiceNumber,
            issueDate: invoice.issueDate,
            currency: invoice.currency,
            netAmount: new Decimal(0), // Will be parsed from UBL
            vatAmount: new Decimal(0),
            totalAmount: new Decimal(invoice.totalAmount.toString()),
            status: "DELIVERED",
            providerRef: invoice.providerRef,
            providerStatus: "RECEIVED",
            ublXml: invoice.ublXml || null,
            sellerId,
            notes: `Received via ePoslovanje poll at ${new Date().toISOString()}`,
          },
        })

        result.inserted++
        logger.info(
          { companyId, providerRef: invoice.providerRef, invoiceNumber: invoice.invoiceNumber },
          "Inserted inbound invoice"
        )
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          // Unique constraint violation = duplicate
          result.skipped++
          logger.debug({ companyId, providerRef: invoice.providerRef }, "Skipped duplicate invoice")
        } else {
          result.errors++
          const msg = error instanceof Error ? error.message : "Unknown error"
          result.errorMessages.push(`${invoice.providerRef}: ${msg}`)
          logger.error(
            { companyId, providerRef: invoice.providerRef, error: msg },
            "Failed to insert inbound invoice"
          )
        }
      }
    }

    // Rate limit protection
    if (hasMore) {
      await sleep(1000) // 1 second between pages
    }
  }

  // Only advance cursor if ALL pages were fetched successfully (no fatal errors)
  if (result.errors === 0 || result.inserted > 0 || result.skipped > 0) {
    // If we got here, the provider call succeeded even if some inserts failed
    // We advance cursor to prevent re-fetching the same invoices
    await advanceCursor(syncState.id, toDate)
    result.success = true
  }

  return result
}

// =============================================================================
// Main Loop
// =============================================================================

async function runPollCycle(): Promise<void> {
  if (!COMPANY_ID) {
    logger.error({}, "COMPANY_ID environment variable is required")
    process.exit(1)
  }

  // Verify company exists
  const company = await db.company.findUnique({
    where: { id: COMPANY_ID },
    select: { id: true, name: true },
  })

  if (!company) {
    logger.error({ companyId: COMPANY_ID }, "Company not found")
    process.exit(1)
  }

  state.stats.totalPolls++
  const pollStart = Date.now()

  try {
    const result = await pollIncomingInvoices(COMPANY_ID)

    state.stats.totalFetched += result.fetched
    state.stats.totalInserted += result.inserted
    state.stats.totalSkipped += result.skipped
    state.stats.totalErrors += result.errors
    state.lastPollAt = new Date()

    const duration = Date.now() - pollStart

    // Log structured summary (DO NOT log UBL or secrets)
    logger.info(
      {
        companyId: COMPANY_ID,
        companyName: company.name,
        success: result.success,
        fetched: result.fetched,
        inserted: result.inserted,
        skipped: result.skipped,
        errors: result.errors,
        durationMs: duration,
        totalPolls: state.stats.totalPolls,
      },
      "Inbound poll cycle completed"
    )

    // Console output for container logs
    console.log(
      `[eposlovanje-inbound-poller] Poll #${state.stats.totalPolls}: ` +
        `fetched=${result.fetched} inserted=${result.inserted} ` +
        `skipped=${result.skipped} errors=${result.errors} ` +
        `duration=${duration}ms`
    )

    if (!result.success && result.errors > 0) {
      logger.warn(
        { companyId: COMPANY_ID, errors: result.errorMessages },
        "Some errors occurred during poll"
      )
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    logger.error({ companyId: COMPANY_ID, error: msg }, "Fatal error during poll cycle")
    console.error(`[eposlovanje-inbound-poller] Fatal error: ${msg}`)
    // Don't exit - let the loop continue after the interval
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function mainLoop(): Promise<void> {
  state.isRunning = true

  while (!state.shutdownRequested) {
    await runPollCycle()

    // Sleep until next poll
    if (!state.shutdownRequested) {
      await sleep(POLL_INTERVAL_MS)
    }
  }

  state.isRunning = false
  console.log("[eposlovanje-inbound-poller] Shutdown complete")
}

// =============================================================================
// Graceful Shutdown
// =============================================================================

function setupGracefulShutdown(): void {
  const shutdown = async (signal: string) => {
    console.log(`\n[eposlovanje-inbound-poller] Received ${signal}, shutting down...`)
    state.shutdownRequested = true

    // Wait for current poll to complete (max 30 seconds)
    const maxWait = 30000
    const startWait = Date.now()
    while (state.isRunning && Date.now() - startWait < maxWait) {
      await sleep(500)
    }

    await db.$disconnect()
    process.exit(0)
  }

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM").catch((err) => {
      console.error("[eposlovanje-inbound-poller] Shutdown error:", err)
      process.exit(1)
    })
  })
  process.on("SIGINT", () => {
    void shutdown("SIGINT").catch((err) => {
      console.error("[eposlovanje-inbound-poller] Shutdown error:", err)
      process.exit(1)
    })
  })

  process.on("uncaughtException", (error) => {
    console.error("[eposlovanje-inbound-poller] Uncaught exception:", error)
    process.exit(1)
  })

  process.on("unhandledRejection", (reason) => {
    console.error("[eposlovanje-inbound-poller] Unhandled rejection:", reason)
    process.exit(1)
  })
}

// =============================================================================
// Entry Point
// =============================================================================

async function main(): Promise<void> {
  logStartup()

  if (!COMPANY_ID) {
    console.error("[eposlovanje-inbound-poller] FATAL: COMPANY_ID not set")
    process.exit(1)
  }

  if (!process.env.EPOSLOVANJE_API_BASE || !process.env.EPOSLOVANJE_API_KEY) {
    console.error("[eposlovanje-inbound-poller] FATAL: ePoslovanje credentials not set")
    process.exit(1)
  }

  setupGracefulShutdown()

  console.log(`[eposlovanje-inbound-poller] Starting poll loop for company ${COMPANY_ID}`)
  console.log(`[eposlovanje-inbound-poller] Poll interval: ${POLL_INTERVAL_MS / 1000}s`)

  await mainLoop()
}

main().catch((error) => {
  console.error("[eposlovanje-inbound-poller] Fatal startup error:", error)
  process.exit(1)
})
