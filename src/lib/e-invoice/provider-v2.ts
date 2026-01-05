// src/lib/e-invoice/provider-v2.ts
/**
 * V2 Provider Factory - IntegrationAccount-aware provider creation
 *
 * This module provides functions for creating e-invoice providers from
 * IntegrationAccount records with:
 * - Tenant ownership verification (HARD assertion)
 * - Proper error handling for missing/disabled accounts
 * - Correct provider instantiation with decrypted secrets
 *
 * The secrets are already decrypted by the repository layer using the
 * vault encryption module.
 */

import type { IntegrationKind, IntegrationEnv } from "@prisma/client"
import { findIntegrationAccountById, findIntegrationAccount } from "@/lib/integration/repository"
import type { IntegrationAccountWithSecrets, EInvoiceSecrets } from "@/lib/integration"
import { EposlovanjeEInvoiceProvider } from "./providers/eposlovanje-einvoice"
import type { EInvoiceProvider } from "./provider"
import { logger } from "@/lib/logger"

/**
 * Error thrown when a caller attempts to access an IntegrationAccount
 * belonging to a different tenant (company).
 *
 * This is a HARD assertion - it indicates a programming error or
 * potential security breach attempt.
 */
export class TenantViolationError extends Error {
  constructor(
    public readonly requestedCompanyId: string,
    public readonly accountCompanyId: string,
    public readonly integrationAccountId: string
  ) {
    super(
      `Tenant violation: requested companyId ${requestedCompanyId} does not match ` +
        `IntegrationAccount ${integrationAccountId} companyId ${accountCompanyId}`
    )
    this.name = "TenantViolationError"
  }
}

/**
 * Error thrown when an IntegrationAccount is not found.
 */
export class IntegrationNotFoundError extends Error {
  constructor(public readonly identifier: string) {
    super(`IntegrationAccount not found: ${identifier}`)
    this.name = "IntegrationNotFoundError"
  }
}

/**
 * Error thrown when an IntegrationAccount exists but is disabled.
 */
export class IntegrationDisabledError extends Error {
  constructor(
    public readonly integrationAccountId: string,
    public readonly status: string
  ) {
    super(`IntegrationAccount ${integrationAccountId} is disabled (status: ${status})`)
    this.name = "IntegrationDisabledError"
  }
}

/**
 * Provider configuration derived from IntegrationAccount
 */
interface ProviderConfigFromAccount {
  apiKey: string
  apiBase?: string
  timeoutMs?: number
}

/**
 * Extract provider configuration from IntegrationAccount
 */
function extractProviderConfig(account: IntegrationAccountWithSecrets): ProviderConfigFromAccount {
  const secrets = account.secrets as EInvoiceSecrets
  const config = account.providerConfig as Record<string, unknown> | null

  return {
    apiKey: secrets.apiKey,
    apiBase: (config?.baseUrl as string) || (config?.apiBase as string) || undefined,
    timeoutMs: (config?.timeout as number) || (config?.timeoutMs as number) || undefined,
  }
}

/**
 * Create the appropriate provider instance based on IntegrationAccount kind
 */
function createProviderForKind(
  kind: IntegrationKind,
  config: ProviderConfigFromAccount
): EInvoiceProvider {
  switch (kind) {
    case "EINVOICE_EPOSLOVANJE":
    case "EINVOICE_FINA":
    case "EINVOICE_IE_RACUNI":
      // All e-invoice providers use the eposlovanje adapter
      return new EposlovanjeEInvoiceProvider({
        apiKey: config.apiKey,
        apiBase: config.apiBase,
        timeoutMs: config.timeoutMs,
      })

    default:
      throw new Error(`Unsupported IntegrationKind for e-invoice provider: ${kind}`)
  }
}

/**
 * Creates an e-invoice provider from an IntegrationAccount ID.
 *
 * This function:
 * 1. Fetches the IntegrationAccount by ID (returns decrypted secrets)
 * 2. Verifies tenant ownership (HARD assertion)
 * 3. Creates the appropriate provider with decrypted secrets
 *
 * @param integrationAccountId - The ID of the IntegrationAccount
 * @param companyId - The company ID making the request (for tenant verification)
 * @returns The configured e-invoice provider
 * @throws {IntegrationNotFoundError} If account not found or not active
 * @throws {TenantViolationError} If companyId doesn't match account's companyId
 */
export async function createProviderFromIntegrationAccount(
  integrationAccountId: string,
  companyId: string
): Promise<EInvoiceProvider> {
  // Fetch account with decrypted secrets
  const account = await findIntegrationAccountById(integrationAccountId)

  if (!account) {
    logger.warn({ integrationAccountId, companyId }, "IntegrationAccount not found or not active")
    throw new IntegrationNotFoundError(integrationAccountId)
  }

  // HARD tenant verification - this is a security assertion
  if (account.companyId !== companyId) {
    logger.error(
      {
        integrationAccountId,
        requestedCompanyId: companyId,
        accountCompanyId: account.companyId,
      },
      "Tenant violation detected - attempted cross-tenant access"
    )
    throw new TenantViolationError(companyId, account.companyId, integrationAccountId)
  }

  // Extract configuration and create provider
  const config = extractProviderConfig(account)

  logger.info(
    {
      integrationAccountId,
      companyId,
      kind: account.kind,
      environment: account.environment,
    },
    "Creating e-invoice provider from IntegrationAccount"
  )

  return createProviderForKind(account.kind, config)
}

/**
 * Resolves an e-invoice provider for a company by kind and environment.
 *
 * This is a convenience function that:
 * 1. Finds the matching IntegrationAccount
 * 2. Creates the appropriate provider with decrypted secrets
 *
 * @param companyId - The company ID
 * @param kind - The integration kind (e.g., EINVOICE_EPOSLOVANJE)
 * @param environment - The environment (defaults to PROD)
 * @returns The configured e-invoice provider
 * @throws {IntegrationNotFoundError} If no matching account found
 */
export async function resolveProviderForCompany(
  companyId: string,
  kind: IntegrationKind,
  environment: IntegrationEnv = "PROD"
): Promise<EInvoiceProvider> {
  const account = await findIntegrationAccount(companyId, kind, environment)

  if (!account) {
    logger.warn(
      { companyId, kind, environment },
      "No matching IntegrationAccount found for company"
    )
    throw new IntegrationNotFoundError(`${companyId}/${kind}/${environment}`)
  }

  const config = extractProviderConfig(account)

  logger.info(
    {
      integrationAccountId: account.id,
      companyId,
      kind,
      environment,
    },
    "Resolved e-invoice provider for company"
  )

  return createProviderForKind(kind, config)
}
