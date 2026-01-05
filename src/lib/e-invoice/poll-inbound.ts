/**
 * Dual-Path Inbound Polling Orchestrator
 *
 * Routes inbound polling between V1 (env vars) and V2 (IntegrationAccount)
 * based on feature flags and account availability.
 *
 * Migration strategy:
 * 1. Check feature flag USE_INTEGRATION_ACCOUNT_INBOUND
 * 2. If enabled, try to find IntegrationAccount for company
 * 3. If found, use V2 path with IntegrationAccount credentials
 * 4. If not found or flag disabled, fall back to V1 (env vars)
 *
 * @module e-invoice/poll-inbound
 * @since Phase 3 - Multi-Tenant Integration Migration
 */

import { db } from "@/lib/db"
import { Prisma } from "@prisma/client"
import { findIntegrationAccount, assertLegacyPathAllowed } from "@/lib/integration"
import { pollInboundForAccount, type PollInboundResult } from "./poll-inbound-v2"
import { EposlovanjeEInvoiceProvider } from "./providers/eposlovanje-einvoice"
import { logger } from "@/lib/logger"

const Decimal = Prisma.Decimal

const MAX_WINDOW_DAYS = 7
const PROVIDER_NAME = "eposlovanje"
const DIRECTION = "INBOUND" as const

/**
 * Feature flag for IntegrationAccount-based inbound polling.
 * Set USE_INTEGRATION_ACCOUNT_INBOUND=true to enable V2 path.
 */
function isIntegrationAccountEnabled(): boolean {
  return process.env.USE_INTEGRATION_ACCOUNT_INBOUND === "true"
}

/**
 * V1 Inbound Result (legacy format without integrationAccountId)
 */
export interface PollInboundResultV1 {
  companyId: string
  success: boolean
  fetched: number
  inserted: number
  skipped: number
  errors: number
  errorMessages: string[]
}

/**
 * Unified result type that works for both V1 and V2
 */
export type UnifiedPollResult = PollInboundResult | PollInboundResultV1

/**
 * Get or create sync state for V1 path (no IntegrationAccount link)
 */
async function getOrCreateSyncStateV1(
  companyId: string
): Promise<{ id: string; lastSuccessfulPollAt: Date }> {
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
    "Created new ProviderSyncState (V1 path)"
  )

  return created
}

/**
 * V1 inbound polling using environment variables.
 * Used when IntegrationAccount is not available or feature flag is disabled.
 *
 * @deprecated Use V2 path with IntegrationAccount instead.
 * This path will be blocked when FF_ENFORCE_INTEGRATION_ACCOUNT=true.
 */
async function pollInboundV1(companyId: string): Promise<PollInboundResultV1> {
  // Phase 5: Enforcement gate - blocks this path when enforcement is active
  assertLegacyPathAllowed("EINVOICE_RECEIVE", companyId, {
    path: "pollInboundV1",
    provider: PROVIDER_NAME,
  })

  const result: PollInboundResultV1 = {
    companyId,
    success: false,
    fetched: 0,
    inserted: 0,
    skipped: 0,
    errors: 0,
    errorMessages: [],
  }

  const apiBase = process.env.EPOSLOVANJE_API_BASE
  const apiKey = process.env.EPOSLOVANJE_API_KEY

  if (!apiBase || !apiKey) {
    result.errorMessages.push("V1: EPOSLOVANJE_API_BASE and EPOSLOVANJE_API_KEY required")
    logger.error({ companyId }, "V1 provider not configured")
    return result
  }

  try {
    const provider = new EposlovanjeEInvoiceProvider({
      apiKey,
      apiUrl: apiBase,
    })

    const isConnected = await provider.testConnection()
    if (!isConnected) {
      result.errorMessages.push("V1: Provider connectivity test failed")
      logger.error({ companyId }, "V1 provider connectivity test failed")
      return result
    }

    const syncState = await getOrCreateSyncStateV1(companyId)
    const fromDate = syncState.lastSuccessfulPollAt
    const toDate = new Date()

    const maxFrom = new Date()
    maxFrom.setDate(maxFrom.getDate() - MAX_WINDOW_DAYS)
    const effectiveFrom = fromDate < maxFrom ? maxFrom : fromDate

    logger.info(
      { companyId, from: effectiveFrom.toISOString(), to: toDate.toISOString(), path: "V1" },
      "Starting inbound poll (V1)"
    )

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

      for (const invoice of invoices) {
        try {
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

          await db.eInvoice.create({
            data: {
              companyId,
              direction: DIRECTION,
              type: "E_INVOICE",
              invoiceNumber: invoice.invoiceNumber,
              issueDate: invoice.issueDate,
              currency: invoice.currency,
              netAmount: new Decimal(0),
              vatAmount: new Decimal(0),
              totalAmount: new Decimal(invoice.totalAmount.toString()),
              status: "DELIVERED",
              providerRef: invoice.providerRef,
              providerStatus: "RECEIVED",
              ublXml: invoice.ublXml || null,
              sellerId,
              notes: `Received via ePoslovanje poll (V1) at ${new Date().toISOString()}`,
            },
          })

          result.inserted++
          logger.info(
            { companyId, providerRef: invoice.providerRef },
            "Inserted inbound invoice (V1)"
          )
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            result.skipped++
            logger.debug(
              { companyId, providerRef: invoice.providerRef },
              "Skipped duplicate invoice"
            )
          } else {
            result.errors++
            const msg = error instanceof Error ? error.message : "Unknown error"
            result.errorMessages.push(`${invoice.providerRef}: ${msg}`)
            logger.error(
              { companyId, providerRef: invoice.providerRef, error: msg },
              "Failed to insert inbound invoice (V1)"
            )
          }
        }
      }

      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    if (result.errors === 0 || result.inserted > 0 || result.skipped > 0) {
      await db.providerSyncState.update({
        where: { id: syncState.id },
        data: { lastSuccessfulPollAt: toDate },
      })
      result.success = true
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    result.errorMessages.push(msg)
    logger.error({ companyId, error: msg }, "Fatal error during V1 inbound poll")
  }

  logger.info(
    {
      companyId,
      path: "V1",
      success: result.success,
      fetched: result.fetched,
      inserted: result.inserted,
      skipped: result.skipped,
      errors: result.errors,
    },
    "V1 inbound poll completed"
  )

  return result
}

/**
 * Main orchestrator for inbound polling.
 *
 * Routing logic:
 * 1. If USE_INTEGRATION_ACCOUNT_INBOUND=true
 *    a. Try to find IntegrationAccount for company
 *    b. If found, use V2 path
 *    c. If not found, fall back to V1
 * 2. If feature flag disabled, use V1 directly
 *
 * @param companyId - The company to poll for
 * @returns Poll result from whichever path was used
 */
export async function pollInbound(companyId: string): Promise<UnifiedPollResult> {
  const useIntegrationAccount = isIntegrationAccountEnabled()

  logger.info({ companyId, useIntegrationAccount }, "Starting inbound poll orchestration")

  if (!useIntegrationAccount) {
    logger.debug({ companyId }, "Feature flag disabled, using V1 path")
    return pollInboundV1(companyId)
  }

  // Try to find an IntegrationAccount for e-invoicing
  const account = await findIntegrationAccount(companyId, "EINVOICE_EPOSLOVANJE", "PROD")

  if (account) {
    logger.info(
      { companyId, integrationAccountId: account.id },
      "Found IntegrationAccount, using V2 path"
    )
    return pollInboundForAccount(account.id, companyId)
  }

  // No IntegrationAccount found, fall back to V1
  logger.info({ companyId }, "No IntegrationAccount found, falling back to V1 path")
  return pollInboundV1(companyId)
}

/**
 * Check which path would be used for a company without actually polling.
 * Useful for diagnostics and testing.
 */
export async function getPollPath(companyId: string): Promise<"v1" | "v2"> {
  if (!isIntegrationAccountEnabled()) {
    return "v1"
  }

  const account = await findIntegrationAccount(companyId, "EINVOICE_EPOSLOVANJE", "PROD")
  return account ? "v2" : "v1"
}

/**
 * Type guard to check if result is from V2 path
 */
export function isV2Result(result: UnifiedPollResult): result is PollInboundResult {
  return "integrationAccountId" in result
}
