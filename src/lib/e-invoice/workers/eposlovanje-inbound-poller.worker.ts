// src/lib/e-invoice/workers/eposlovanje-inbound-poller.worker.ts
/**
 * ePoslovanje Inbound Invoice Poller Worker
 *
 * Polls ePoslovanje for incoming invoices on a schedule.
 * Tenant-safe: polls for a specific company via COMPANY_ID env var.
 *
 * Uses dual-path orchestrator that routes between:
 * - V1 path: Uses EPOSLOVANJE_API_BASE/KEY env vars (legacy)
 * - V2 path: Uses IntegrationAccount credentials (when USE_INTEGRATION_ACCOUNT_INBOUND=true)
 *
 * Environment:
 *   - COMPANY_ID (required) - Company to poll for
 *   - DATABASE_URL (required) - PostgreSQL connection string
 *   - POLL_INTERVAL_MS (optional, default: 300000 = 5 minutes)
 *   - MAX_WINDOW_DAYS (optional, default: 7) - Max lookback on first run
 *
 * V1 path (legacy):
 *   - EPOSLOVANJE_API_BASE - API base URL
 *   - EPOSLOVANJE_API_KEY - API key for authorization
 *
 * V2 path (IntegrationAccount):
 *   - USE_INTEGRATION_ACCOUNT_INBOUND=true - Enable V2 path
 *   - Credentials from IntegrationAccount in database
 */

import { db } from "@/lib/db"
import { pollInbound, isV2Result } from "../poll-inbound"
import { logger } from "@/lib/logger"

// =============================================================================
// Configuration
// =============================================================================

const COMPANY_ID = process.env.COMPANY_ID
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || "300000", 10) // 5 min
const MAX_WINDOW_DAYS = parseInt(process.env.MAX_WINDOW_DAYS || "7", 10)

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

// Inline polling removed - now delegated to poll-inbound.ts orchestrator

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
    // Use orchestrator which routes between V1 (env vars) and V2 (IntegrationAccount)
    const result = await pollInbound(COMPANY_ID)

    state.stats.totalFetched += result.fetched
    state.stats.totalInserted += result.inserted
    state.stats.totalSkipped += result.skipped
    state.stats.totalErrors += result.errors
    state.lastPollAt = new Date()

    const duration = Date.now() - pollStart
    const path = isV2Result(result) ? "V2" : "V1"

    // Log structured summary (DO NOT log UBL or secrets)
    logger.info(
      {
        companyId: COMPANY_ID,
        companyName: company.name,
        path,
        integrationAccountId: isV2Result(result) ? result.integrationAccountId : undefined,
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
      `[eposlovanje-inbound-poller] Poll #${state.stats.totalPolls} (${path}): ` +
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

  // With orchestrator, we can use either IntegrationAccount OR env vars
  const hasEnvVars = !!(process.env.EPOSLOVANJE_API_BASE && process.env.EPOSLOVANJE_API_KEY)
  const useIntegrationAccount = process.env.USE_INTEGRATION_ACCOUNT_INBOUND === "true"

  if (!hasEnvVars && !useIntegrationAccount) {
    console.warn("[eposlovanje-inbound-poller] WARNING: No credentials configured")
    console.warn("  - Set EPOSLOVANJE_API_BASE + EPOSLOVANJE_API_KEY for V1 path")
    console.warn("  - Set USE_INTEGRATION_ACCOUNT_INBOUND=true for V2 path")
    console.warn("  - Polling will fail until IntegrationAccount is created or env vars are set")
  }

  setupGracefulShutdown()

  console.log(`[eposlovanje-inbound-poller] Starting poll loop for company ${COMPANY_ID}`)
  console.log(`[eposlovanje-inbound-poller] Poll interval: ${POLL_INTERVAL_MS / 1000}s`)
  console.log(
    `[eposlovanje-inbound-poller] IntegrationAccount mode: ${useIntegrationAccount ? "ENABLED" : "DISABLED"}`
  )

  await mainLoop()
}

main().catch((error) => {
  console.error("[eposlovanje-inbound-poller] Fatal startup error:", error)
  process.exit(1)
})
