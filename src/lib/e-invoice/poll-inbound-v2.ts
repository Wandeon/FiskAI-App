/**
 * V2 Inbound Polling with IntegrationAccount Support
 *
 * Polls inbound e-invoices using IntegrationAccount credentials instead of env vars.
 * Enforces tenant isolation with hard assertions.
 *
 * @module e-invoice/poll-inbound-v2
 * @since Phase 3 - Multi-Tenant Integration Migration
 */

import { db } from "@/lib/db"
import { Prisma, type IntegrationKind } from "@prisma/client"
import {
  findIntegrationAccountById,
  findIntegrationAccount,
  touchIntegrationAccount,
} from "@/lib/integration"
import { parseEInvoiceSecrets } from "@/lib/integration/types"
import {
  TenantViolationError,
  IntegrationNotFoundError,
  IntegrationDisabledError,
} from "./provider-v2"
import { EposlovanjeEInvoiceProvider } from "./providers/eposlovanje-einvoice"
import { logger } from "@/lib/logger"

const Decimal = Prisma.Decimal

const MAX_WINDOW_DAYS = 7
const PROVIDER_NAME = "eposlovanje"
const DIRECTION = "INBOUND" as const

export interface PollInboundResult {
  integrationAccountId: string
  companyId: string
  success: boolean
  fetched: number
  inserted: number
  skipped: number
  errors: number
  errorMessages: string[]
}

/**
 * Get or create sync state for a company/provider/direction combo.
 * Links to IntegrationAccount if provided.
 */
async function getOrCreateSyncState(
  companyId: string,
  providerName: string,
  integrationAccountId: string
): Promise<{ id: string; lastSuccessfulPollAt: Date }> {
  const existing = await db.providerSyncState.findUnique({
    where: {
      companyId_provider_direction: {
        companyId,
        provider: providerName,
        direction: DIRECTION,
      },
    },
    select: { id: true, lastSuccessfulPollAt: true, integrationAccountId: true },
  })

  if (existing) {
    // Update integrationAccountId if not set
    if (!existing.integrationAccountId) {
      await db.providerSyncState.update({
        where: { id: existing.id },
        data: { integrationAccountId },
      })
    }
    return { id: existing.id, lastSuccessfulPollAt: existing.lastSuccessfulPollAt }
  }

  // Create new sync state with lookback
  const defaultFrom = new Date()
  defaultFrom.setDate(defaultFrom.getDate() - MAX_WINDOW_DAYS)

  const created = await db.providerSyncState.create({
    data: {
      companyId,
      provider: providerName,
      direction: DIRECTION,
      lastSuccessfulPollAt: defaultFrom,
      integrationAccountId,
    },
    select: { id: true, lastSuccessfulPollAt: true },
  })

  logger.info(
    {
      companyId,
      provider: providerName,
      direction: DIRECTION,
      from: defaultFrom,
      integrationAccountId,
    },
    "Created new ProviderSyncState with IntegrationAccount link"
  )

  return created
}

/**
 * Polls inbound e-invoices using a specific IntegrationAccount.
 * Enforces tenant isolation with hard assertions.
 *
 * @throws TenantViolationError if companyId doesn't match
 * @throws IntegrationNotFoundError if account not found
 * @throws IntegrationDisabledError if account not active
 */
export async function pollInboundForAccount(
  integrationAccountId: string,
  companyId: string
): Promise<PollInboundResult> {
  const account = await findIntegrationAccountById(integrationAccountId)

  if (!account) {
    throw new IntegrationNotFoundError(integrationAccountId)
  }

  // HARD TENANT ASSERTION - fails immediately, no retry
  if (account.companyId !== companyId) {
    throw new TenantViolationError(companyId, account.companyId, integrationAccountId)
  }

  if (account.status !== "ACTIVE") {
    throw new IntegrationDisabledError(integrationAccountId, account.status)
  }

  logger.info(
    {
      companyId,
      integrationAccountId,
      kind: account.kind,
    },
    "Starting inbound poll via IntegrationAccount"
  )

  const result: PollInboundResult = {
    integrationAccountId,
    companyId,
    success: false,
    fetched: 0,
    inserted: 0,
    skipped: 0,
    errors: 0,
    errorMessages: [],
  }

  try {
    // Parse secrets from IntegrationAccount
    const secrets = parseEInvoiceSecrets(account.secrets)
    const config = account.providerConfig as { baseUrl?: string; timeout?: number } | null

    // Create provider with IntegrationAccount credentials
    const provider = new EposlovanjeEInvoiceProvider({
      apiKey: secrets.apiKey,
      apiUrl: config?.baseUrl ?? process.env.EPOSLOVANJE_API_BASE,
    })

    // Test connectivity
    const isConnected = await provider.testConnection()
    if (!isConnected) {
      result.errorMessages.push("Provider connectivity test failed")
      logger.error({ companyId, integrationAccountId }, "Provider connectivity test failed")
      return result
    }

    // Get sync state
    const syncState = await getOrCreateSyncState(
      companyId,
      mapKindToProviderName(account.kind),
      integrationAccountId
    )
    const fromDate = syncState.lastSuccessfulPollAt
    const toDate = new Date()

    // Safety: cap window to MAX_WINDOW_DAYS
    const maxFrom = new Date()
    maxFrom.setDate(maxFrom.getDate() - MAX_WINDOW_DAYS)
    const effectiveFrom = fromDate < maxFrom ? maxFrom : fromDate

    logger.info(
      {
        companyId,
        from: effectiveFrom.toISOString(),
        to: toDate.toISOString(),
        integrationAccountId,
      },
      "Inbound poll window"
    )

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

          // Insert invoice with integrationAccountId
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
              integrationAccountId, // Link to IntegrationAccount
              notes: `Received via ePoslovanje (IntegrationAccount) at ${new Date().toISOString()}`,
            },
          })

          result.inserted++
          logger.info(
            { companyId, integrationAccountId, providerRef: invoice.providerRef },
            "Inserted inbound invoice via IntegrationAccount"
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
              { companyId, integrationAccountId, providerRef: invoice.providerRef, error: msg },
              "Failed to insert inbound invoice"
            )
          }
        }
      }

      // Rate limit protection
      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    // Advance cursor if any processing happened
    if (result.errors === 0 || result.inserted > 0 || result.skipped > 0) {
      await db.providerSyncState.update({
        where: { id: syncState.id },
        data: { lastSuccessfulPollAt: toDate },
      })
      result.success = true
    }

    // Update lastUsedAt
    await touchIntegrationAccount(integrationAccountId)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    result.errorMessages.push(msg)
    logger.error({ companyId, integrationAccountId, error: msg }, "Fatal error during inbound poll")
  }

  logger.info(
    {
      companyId,
      integrationAccountId,
      success: result.success,
      fetched: result.fetched,
      inserted: result.inserted,
      skipped: result.skipped,
      errors: result.errors,
    },
    "Inbound poll via IntegrationAccount completed"
  )

  return result
}

/**
 * Resolves IntegrationAccount for a company and polls inbound.
 * Used when integrationAccountId is not known.
 */
export async function pollInboundForCompany(
  companyId: string,
  kind: IntegrationKind,
  environment: "TEST" | "PROD"
): Promise<PollInboundResult> {
  const account = await findIntegrationAccount(companyId, kind, environment)

  if (!account) {
    throw new IntegrationNotFoundError(`${kind}/${environment} for company ${companyId}`)
  }

  return pollInboundForAccount(account.id, companyId)
}

function mapKindToProviderName(kind: IntegrationKind): string {
  const mapping: Record<string, string> = {
    EINVOICE_EPOSLOVANJE: "eposlovanje",
    EINVOICE_FINA: "fina",
    EINVOICE_IE_RACUNI: "ie-racuni",
  }
  return mapping[kind] ?? "unknown"
}
