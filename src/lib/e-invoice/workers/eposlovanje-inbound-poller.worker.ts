// src/lib/e-invoice/workers/eposlovanje-inbound-poller.worker.ts
/**
 * ePoslovanje Inbound Invoice Poller Worker
 *
 * Multi-tenant worker that polls ePoslovanje for incoming invoices.
 *
 * Operating Modes:
 * 1. SINGLE-TENANT: If COMPANY_ID is set, only polls for that company (backwards compatible)
 * 2. MULTI-TENANT: If COMPANY_ID is not set, discovers and polls ALL companies with
 *    IntegrationAccount configured for EINVOICE_EPOSLOVANJE
 *
 * Uses dual-path orchestrator that routes between:
 * - V1 path: Uses EPOSLOVANJE_API_BASE/KEY env vars (legacy, single-tenant only)
 * - V2 path: Uses IntegrationAccount credentials (multi-tenant)
 *
 * Environment:
 *   - COMPANY_ID (optional) - If set, single-tenant mode for this company only
 *   - DATABASE_URL (required) - PostgreSQL connection string
 *   - POLL_INTERVAL_MS (optional, default: 300000 = 5 minutes)
 *   - TENANT_DELAY_MS (optional, default: 5000 = 5 seconds between tenants)
 *   - USE_INTEGRATION_ACCOUNT_INBOUND (optional) - Enable V2 path for single-tenant mode
 */

import { db } from "@/lib/db"
import { pollInbound, isV2Result } from "../poll-inbound"
import { findAllActiveIntegrationAccounts } from "@/lib/integration"
import { logger } from "@/lib/logger"

// =============================================================================
// Configuration
// =============================================================================

const COMPANY_ID = process.env.COMPANY_ID
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || "300000", 10) // 5 min
const TENANT_DELAY_MS = parseInt(process.env.TENANT_DELAY_MS || "5000", 10) // 5 seconds between tenants

// =============================================================================
// Worker State
// =============================================================================

interface WorkerState {
  isRunning: boolean
  shutdownRequested: boolean
  lastPollAt: Date | null
  mode: "single-tenant" | "multi-tenant"
  stats: {
    totalCycles: number
    totalTenants: number
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
  mode: COMPANY_ID ? "single-tenant" : "multi-tenant",
  stats: {
    totalCycles: 0,
    totalTenants: 0,
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
  console.log(`║ Mode:            ${state.mode.padEnd(42)} ║`)
  if (COMPANY_ID) {
    console.log(`║ Company ID:      ${COMPANY_ID.substring(0, 40).padEnd(42)} ║`)
  } else {
    console.log(`║ Company ID:      (auto-discover all tenants)                 ║`)
  }
  console.log(`║ Poll Interval:   ${(POLL_INTERVAL_MS / 1000 + "s").padEnd(42)} ║`)
  console.log(`║ Tenant Delay:    ${(TENANT_DELAY_MS / 1000 + "s").padEnd(42)} ║`)
  console.log(`║ Commit SHA:      ${commitSha.substring(0, 40).padEnd(42)} ║`)
  console.log(`║ Node Env:        ${nodeEnv.padEnd(42)} ║`)
  console.log(`║ Started At:      ${new Date().toISOString().padEnd(42)} ║`)
  console.log("╚══════════════════════════════════════════════════════════════╝")
}

// =============================================================================
// Single-Tenant Poll (backwards compatible)
// =============================================================================

async function runSingleTenantPoll(companyId: string): Promise<void> {
  // Verify company exists
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  })

  if (!company) {
    logger.error({ companyId }, "Company not found")
    console.error(`[eposlovanje-inbound-poller] ERROR: Company ${companyId} not found`)
    return
  }

  const pollStart = Date.now()

  try {
    const result = await pollInbound(companyId)

    state.stats.totalFetched += result.fetched
    state.stats.totalInserted += result.inserted
    state.stats.totalSkipped += result.skipped
    state.stats.totalErrors += result.errors
    state.lastPollAt = new Date()

    const duration = Date.now() - pollStart
    const path = isV2Result(result) ? "V2" : "V1"

    logger.info(
      {
        companyId,
        companyName: company.name,
        path,
        integrationAccountId: isV2Result(result) ? result.integrationAccountId : undefined,
        success: result.success,
        fetched: result.fetched,
        inserted: result.inserted,
        skipped: result.skipped,
        errors: result.errors,
        durationMs: duration,
      },
      "Single-tenant poll completed"
    )

    console.log(
      `[eposlovanje-inbound-poller] Poll (${path}): ` +
        `fetched=${result.fetched} inserted=${result.inserted} ` +
        `skipped=${result.skipped} errors=${result.errors} ` +
        `duration=${duration}ms`
    )

    if (!result.success && result.errors > 0) {
      logger.warn({ companyId, errors: result.errorMessages }, "Some errors occurred during poll")
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    logger.error({ companyId, error: msg }, "Fatal error during single-tenant poll")
    console.error(`[eposlovanje-inbound-poller] Fatal error: ${msg}`)
  }
}

// =============================================================================
// Multi-Tenant Poll
// =============================================================================

async function runMultiTenantPoll(): Promise<void> {
  // Discover all companies with EINVOICE_EPOSLOVANJE IntegrationAccount
  const accounts = await findAllActiveIntegrationAccounts("EINVOICE_EPOSLOVANJE", "PROD")

  if (accounts.length === 0) {
    logger.info({}, "No active e-invoice integration accounts found")
    console.log("[eposlovanje-inbound-poller] No active integration accounts found, skipping cycle")
    return
  }

  console.log(
    `[eposlovanje-inbound-poller] Discovered ${accounts.length} tenants with e-invoice integration`
  )

  const cycleStart = Date.now()
  let tenantsPolled = 0
  let totalFetched = 0
  let totalInserted = 0
  let totalSkipped = 0
  let totalErrors = 0

  for (const account of accounts) {
    if (state.shutdownRequested) {
      console.log("[eposlovanje-inbound-poller] Shutdown requested, stopping mid-cycle")
      break
    }

    const company = await db.company.findUnique({
      where: { id: account.companyId },
      select: { id: true, name: true },
    })

    if (!company) {
      logger.warn(
        { companyId: account.companyId },
        "Company not found for IntegrationAccount, skipping"
      )
      continue
    }

    const pollStart = Date.now()

    try {
      const result = await pollInbound(account.companyId)

      totalFetched += result.fetched
      totalInserted += result.inserted
      totalSkipped += result.skipped
      totalErrors += result.errors
      tenantsPolled++

      const duration = Date.now() - pollStart
      const path = isV2Result(result) ? "V2" : "V1"

      logger.info(
        {
          companyId: account.companyId,
          companyName: company.name,
          path,
          integrationAccountId: isV2Result(result) ? result.integrationAccountId : undefined,
          success: result.success,
          fetched: result.fetched,
          inserted: result.inserted,
          skipped: result.skipped,
          errors: result.errors,
          durationMs: duration,
          tenantIndex: tenantsPolled,
          totalTenants: accounts.length,
        },
        "Tenant poll completed"
      )

      console.log(
        `[eposlovanje-inbound-poller] [${tenantsPolled}/${accounts.length}] ${company.name}: ` +
          `fetched=${result.fetched} inserted=${result.inserted} ` +
          `skipped=${result.skipped} errors=${result.errors} duration=${duration}ms`
      )

      if (!result.success && result.errors > 0) {
        logger.warn(
          { companyId: account.companyId, errors: result.errorMessages },
          "Some errors occurred during tenant poll"
        )
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error"
      logger.error({ companyId: account.companyId, error: msg }, "Fatal error during tenant poll")
      console.error(`[eposlovanje-inbound-poller] ERROR polling ${company.name}: ${msg}`)
      totalErrors++
    }

    // Delay between tenants to avoid overloading the API
    if (tenantsPolled < accounts.length && !state.shutdownRequested) {
      await sleep(TENANT_DELAY_MS)
    }
  }

  const cycleDuration = Date.now() - cycleStart
  state.stats.totalTenants += tenantsPolled
  state.stats.totalFetched += totalFetched
  state.stats.totalInserted += totalInserted
  state.stats.totalSkipped += totalSkipped
  state.stats.totalErrors += totalErrors
  state.lastPollAt = new Date()

  logger.info(
    {
      cycle: state.stats.totalCycles,
      tenantsPolled,
      totalFetched,
      totalInserted,
      totalSkipped,
      totalErrors,
      cycleDurationMs: cycleDuration,
    },
    "Multi-tenant poll cycle completed"
  )

  console.log(
    `[eposlovanje-inbound-poller] Cycle #${state.stats.totalCycles} complete: ` +
      `tenants=${tenantsPolled} fetched=${totalFetched} inserted=${totalInserted} ` +
      `skipped=${totalSkipped} errors=${totalErrors} duration=${Math.round(cycleDuration / 1000)}s`
  )
}

// =============================================================================
// Main Loop
// =============================================================================

async function runPollCycle(): Promise<void> {
  state.stats.totalCycles++

  if (state.mode === "single-tenant") {
    if (!COMPANY_ID) {
      logger.error({}, "Single-tenant mode requires COMPANY_ID")
      return
    }
    await runSingleTenantPoll(COMPANY_ID)
  } else {
    await runMultiTenantPoll()
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

  if (state.mode === "single-tenant") {
    // Single-tenant mode - same validation as before
    if (!COMPANY_ID) {
      console.error("[eposlovanje-inbound-poller] FATAL: Single-tenant mode requires COMPANY_ID")
      process.exit(1)
    }

    // Verify company exists
    const company = await db.company.findUnique({
      where: { id: COMPANY_ID },
      select: { id: true, name: true },
    })

    if (!company) {
      console.error(`[eposlovanje-inbound-poller] FATAL: Company ${COMPANY_ID} not found`)
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

    console.log(`[eposlovanje-inbound-poller] Starting SINGLE-TENANT mode for ${company.name}`)
    console.log(`[eposlovanje-inbound-poller] Poll interval: ${POLL_INTERVAL_MS / 1000}s`)
  } else {
    // Multi-tenant mode - discover tenants with IntegrationAccount
    console.log("[eposlovanje-inbound-poller] Starting MULTI-TENANT mode")
    console.log(
      "[eposlovanje-inbound-poller] Will discover and poll all companies with EINVOICE_EPOSLOVANJE IntegrationAccount"
    )
    console.log(`[eposlovanje-inbound-poller] Poll interval: ${POLL_INTERVAL_MS / 1000}s`)
    console.log(`[eposlovanje-inbound-poller] Delay between tenants: ${TENANT_DELAY_MS / 1000}s`)

    // Initial discovery to report count
    const accounts = await findAllActiveIntegrationAccounts("EINVOICE_EPOSLOVANJE", "PROD")
    console.log(
      `[eposlovanje-inbound-poller] Initial discovery: ${accounts.length} active integration accounts`
    )

    if (accounts.length === 0) {
      console.warn("[eposlovanje-inbound-poller] WARNING: No active integration accounts found")
      console.warn("  - Worker will continue running and check for new accounts each cycle")
      console.warn("  - Configure IntegrationAccount for companies that need e-invoice polling")
    }
  }

  setupGracefulShutdown()
  await mainLoop()
}

main().catch((error) => {
  console.error("[eposlovanje-inbound-poller] Fatal startup error:", error)
  process.exit(1)
})
