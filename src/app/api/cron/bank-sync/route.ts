// src/app/api/cron/bank-sync/route.ts

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getProvider } from "@/lib/bank-sync/providers"
import { processTransactionsWithDedup } from "@/lib/bank-sync/dedup"
import { recordCronError } from "@/lib/cron-dlq"
import { createCronLogger } from "@/lib/logging/cron-logger"
import type { BankAccount, BankConnection } from "@prisma/client"
import { isValidationError, formatValidationError } from "@/lib/api/validation"

// Process accounts in batches to prevent connection pool exhaustion
const BATCH_SIZE = 10
// Transaction timeout for database operations (30 seconds)
const TRANSACTION_TIMEOUT_MS = 30000

type AccountWithConnection = BankAccount & { connection: BankConnection | null }

interface SyncResult {
  accountId: string
  status: string
  inserted?: number
  error?: string
}

/**
 * Shared handler for bank sync operations
 * Supports both GET (Vercel cron default) and POST (manual triggers)
 */
async function handleBankSync(request: Request) {
  const log = createCronLogger("bank-sync")
  const startTime = Date.now()

  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  // SECURITY: Require CRON_SECRET to be configured
  if (!cronSecret) {
    console.error("[cron] CRON_SECRET not configured")
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const results: SyncResult[] = []

  try {
    log.start()

    // Find all connected accounts
    const accounts = await db.bankAccount.findMany({
      where: { connectionStatus: "CONNECTED" },
      include: { connection: true },
    })

    log.info("Found accounts to sync", { count: accounts.length })

    // Process accounts in batches to allow connection pool recycling
    for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
      const batch = accounts.slice(i, i + BATCH_SIZE)
      const batchIndex = Math.floor(i / BATCH_SIZE) + 1
      log.info("Processing batch", { batchIndex, batchSize: batch.length })

      // Process batch in parallel with Promise.allSettled to handle individual failures
      const batchResults = await Promise.allSettled(
        batch.map((account) => processAccount(account, log))
      )

      // Collect results from batch
      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j]
        const account = batch[j]

        if (result.status === "fulfilled") {
          results.push(result.value)
        } else {
          log.error(result.reason, { accountId: account.id })

          // Record to dead letter queue for visibility
          await recordCronError({
            jobName: "bank-sync",
            entityId: account.id,
            entityType: "BankAccount",
            error:
              result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
            metadata: {
              companyId: account.companyId,
              syncProvider: account.syncProvider,
              lastSyncAt: account.lastSyncAt?.toISOString(),
              batchIndex,
            },
          })

          results.push({
            accountId: account.id,
            status: "error",
            error: result.reason instanceof Error ? result.reason.message : "Unknown error",
          })
        }
      }
    }

    const durationMs = Date.now() - startTime
    const summary = {
      processed: accounts.length,
      synced: results.filter((r) => r.status === "synced").length,
      expired: results.filter((r) => r.status === "expired").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      errors: results.filter((r) => r.status === "error").length,
    }

    log.complete(summary, durationMs)

    return NextResponse.json({
      processed: accounts.length,
      results,
    })
  } catch (error) {
    const durationMs = Date.now() - startTime
    log.fail(error instanceof Error ? error : new Error(String(error)), undefined, durationMs)

    // Record global cron error to DLQ
    await recordCronError({
      jobName: "bank-sync",
      error: error instanceof Error ? error : new Error(String(error)),
      errorCode: "CRON_GLOBAL_ERROR",
    })

    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    return NextResponse.json({ error: "Sync failed" }, { status: 500 })
  }
}

// GET is used by Vercel cron jobs by default
export const GET = handleBankSync

// POST is supported for manual triggers and testing
export const POST = handleBankSync

/**
 * Process a single account with proper transaction management
 */
async function processAccount(
  account: AccountWithConnection,
  log: ReturnType<typeof createCronLogger>
): Promise<SyncResult> {
  const now = new Date()
  const warningThreshold = new Date()
  warningThreshold.setDate(warningThreshold.getDate() + 7)

  try {
    // Check expiration - use transaction with timeout for database updates
    if (account.connectionExpiresAt) {
      if (account.connectionExpiresAt < now) {
        // Expired - mark and skip within a transaction with timeout
        await db.$transaction(
          async (tx) => {
            await tx.bankAccount.update({
              where: { id: account.id },
              data: { connectionStatus: "EXPIRED" },
            })
          },
          { timeout: TRANSACTION_TIMEOUT_MS }
        )
        log.info("Account marked as expired", { accountId: account.id })
        return { accountId: account.id, status: "expired" }
      }

      if (account.connectionExpiresAt < warningThreshold) {
        log.warn("Account expires soon", {
          accountId: account.id,
          expiresAt: account.connectionExpiresAt.toISOString(),
        })
      }
    }

    if (!account.syncProviderAccountId || !account.connection) {
      return {
        accountId: account.id,
        status: "skipped",
        error: "No provider account",
      }
    }

    // Fetch transactions from external provider (outside transaction)
    const provider = getProvider(account.syncProvider)
    const since = account.lastSyncAt || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

    const transactions = await provider.fetchTransactions(account.syncProviderAccountId, since)

    // Process with dedup (has its own database operations)
    const dedupResult = await processTransactionsWithDedup(
      account.id,
      account.companyId,
      transactions
    )

    // Fetch balance from external provider (outside transaction)
    const balance = await provider.fetchBalance(account.syncProviderAccountId)

    // Update account within a transaction with timeout for proper connection cleanup
    await db.$transaction(
      async (tx) => {
        await tx.bankAccount.update({
          where: { id: account.id },
          data: {
            lastSyncAt: new Date(),
            currentBalance: balance?.amount ?? account.currentBalance,
          },
        })
      },
      { timeout: TRANSACTION_TIMEOUT_MS }
    )

    log.info("Account synced successfully", {
      accountId: account.id,
      inserted: dedupResult.inserted,
      skippedDuplicates: dedupResult.skippedDuplicates,
    })

    return {
      accountId: account.id,
      status: "synced",
      inserted: dedupResult.inserted,
    }
  } catch (error) {
    log.error(error instanceof Error ? error : new Error(String(error)), {
      accountId: account.id,
    })

    // Record to dead letter queue for visibility
    await recordCronError({
      jobName: "bank-sync",
      entityId: account.id,
      entityType: "BankAccount",
      error: error instanceof Error ? error : new Error(String(error)),
      metadata: {
        companyId: account.companyId,
        syncProvider: account.syncProvider,
        lastSyncAt: account.lastSyncAt?.toISOString(),
      },
    })

    return {
      accountId: account.id,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
