/**
 * Dual-Path E-Invoice Send Function
 *
 * This module provides a unified interface for sending e-invoices that supports
 * both the legacy Company.eInvoiceApiKeyEncrypted path and the new
 * IntegrationAccount-based path.
 *
 * The path is selected based on the USE_INTEGRATION_ACCOUNT_OUTBOUND feature flag.
 *
 * @module e-invoice/send-invoice
 * @since Phase 2 - Multi-Tenant Integration Migration
 */

import { db } from "@/lib/db"
import type { Company, EInvoice, EInvoiceLine, Contact } from "@prisma/client"
import { isFeatureEnabled } from "@/lib/integration-feature-flags"
import { createEInvoiceProvider } from "./provider"
import { createProviderFromIntegrationAccount, resolveProviderForCompany } from "./provider-v2"
import { generateUBLInvoice } from "./ubl-generator"
import { decryptOptionalSecret } from "@/lib/secrets"
import { touchIntegrationAccount, findIntegrationAccount } from "@/lib/integration"
import { logger } from "@/lib/logger"
import type { SendInvoiceResult, EInvoiceWithRelations } from "./types"

export interface SendEInvoiceInput {
  invoice: EInvoice & {
    lines: EInvoiceLine[]
    buyer: Contact | null
    seller: Contact | null
    company: Company
  }
  /** Optional: specify which IntegrationAccount to use (new path only) */
  integrationAccountId?: string
}

export interface SendEInvoiceOutput extends SendInvoiceResult {
  /** The path used: 'legacy' or 'integration-account' */
  path: "legacy" | "integration-account"
  /** The IntegrationAccount ID if new path was used */
  integrationAccountId?: string
}

/**
 * Sends an e-invoice through either the legacy or IntegrationAccount path.
 *
 * Path selection:
 * - If USE_INTEGRATION_ACCOUNT_OUTBOUND flag is OFF: uses legacy path
 * - If flag is ON and integrationAccountId provided: uses that specific account
 * - If flag is ON without integrationAccountId: resolves account by company/kind/env
 *
 * @param input - The invoice and optional integration account ID
 * @returns The send result including which path was used
 */
export async function sendEInvoice(input: SendEInvoiceInput): Promise<SendEInvoiceOutput> {
  const { invoice, integrationAccountId } = input
  const companyId = invoice.companyId

  // Check feature flag
  const useNewPath = isFeatureEnabled("USE_INTEGRATION_ACCOUNT_OUTBOUND")

  logger.info(
    {
      invoiceId: invoice.id,
      companyId,
      useNewPath,
      integrationAccountId,
    },
    `E-Invoice send: using ${useNewPath ? "integration-account" : "legacy"} path`
  )

  if (useNewPath) {
    return sendViaIntegrationAccount(input)
  } else {
    return sendViaLegacyPath(input)
  }
}

/**
 * Sends invoice via the legacy Company.eInvoiceApiKeyEncrypted path.
 */
async function sendViaLegacyPath(input: SendEInvoiceInput): Promise<SendEInvoiceOutput> {
  const { invoice } = input
  const company = invoice.company

  logger.debug(
    {
      invoiceId: invoice.id,
      companyId: company.id,
      provider: company.eInvoiceProvider,
    },
    "Sending e-invoice via legacy path"
  )

  // Get provider configuration from Company
  const providerName = company.eInvoiceProvider || "mock"

  // Decrypt API key
  let apiKey = ""
  try {
    apiKey = decryptOptionalSecret(company.eInvoiceApiKeyEncrypted) || ""
  } catch (error) {
    logger.error({ invoiceId: invoice.id, error }, "Failed to decrypt legacy API key")
    return {
      success: false,
      error: "Failed to decrypt API key. Please reconfigure your e-invoice settings.",
      path: "legacy",
    }
  }

  // Create provider
  const provider = createEInvoiceProvider(providerName, { apiKey })

  // Generate UBL XML
  const ublXml = generateUBLInvoice(invoice as EInvoiceWithRelations)

  // Send via provider
  const result = await provider.sendInvoice(invoice as EInvoiceWithRelations, ublXml)

  logger.info(
    {
      invoiceId: invoice.id,
      success: result.success,
      providerRef: result.providerRef,
      jir: result.jir,
    },
    "Legacy path send completed"
  )

  return {
    ...result,
    path: "legacy",
  }
}

/**
 * Sends invoice via the IntegrationAccount path.
 */
async function sendViaIntegrationAccount(input: SendEInvoiceInput): Promise<SendEInvoiceOutput> {
  const { invoice, integrationAccountId } = input
  const companyId = invoice.companyId

  try {
    let provider
    let resolvedAccountId: string

    if (integrationAccountId) {
      // Use specific IntegrationAccount
      logger.debug(
        {
          invoiceId: invoice.id,
          integrationAccountId,
        },
        "Using specified IntegrationAccount"
      )

      provider = await createProviderFromIntegrationAccount(integrationAccountId, companyId)
      resolvedAccountId = integrationAccountId
    } else {
      // Resolve IntegrationAccount by company - try to find active e-invoice account
      // Prefer EINVOICE_EPOSLOVANJE, fall back to others
      const kinds = ["EINVOICE_EPOSLOVANJE", "EINVOICE_FINA", "EINVOICE_IE_RACUNI"] as const

      let account = null
      for (const kind of kinds) {
        account = await findIntegrationAccount(companyId, kind, "PROD")
        if (account) break
      }

      if (!account) {
        // Try test environment as fallback
        for (const kind of kinds) {
          account = await findIntegrationAccount(companyId, kind, "TEST")
          if (account) break
        }
      }

      if (!account) {
        logger.warn(
          { invoiceId: invoice.id, companyId },
          "No active IntegrationAccount found for e-invoice sending"
        )
        return {
          success: false,
          error: "No active e-invoice integration configured. Please set up an e-invoice provider.",
          path: "integration-account",
        }
      }

      provider = await resolveProviderForCompany(companyId, account.kind, account.environment)
      resolvedAccountId = account.id
    }

    // Generate UBL XML
    const ublXml = generateUBLInvoice(invoice as EInvoiceWithRelations)

    // Send via provider
    const result = await provider.sendInvoice(invoice as EInvoiceWithRelations, ublXml)

    if (result.success) {
      // Update lastUsedAt on the IntegrationAccount
      await touchIntegrationAccount(resolvedAccountId)

      // Store the integrationAccountId on the invoice for audit trail
      await db.eInvoice.update({
        where: { id: invoice.id },
        data: { integrationAccountId: resolvedAccountId },
      })

      logger.info(
        {
          invoiceId: invoice.id,
          integrationAccountId: resolvedAccountId,
          providerRef: result.providerRef,
          jir: result.jir,
        },
        "IntegrationAccount path send completed successfully"
      )
    } else {
      logger.warn(
        {
          invoiceId: invoice.id,
          integrationAccountId: resolvedAccountId,
          error: result.error,
        },
        "IntegrationAccount path send failed"
      )
    }

    return {
      ...result,
      path: "integration-account",
      integrationAccountId: resolvedAccountId,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    logger.error(
      {
        invoiceId: invoice.id,
        integrationAccountId,
        error: errorMessage,
      },
      "Failed to send via IntegrationAccount path"
    )

    return {
      success: false,
      error: errorMessage,
      path: "integration-account",
      integrationAccountId,
    }
  }
}
