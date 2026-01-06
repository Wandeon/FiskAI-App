/**
 * V2 Fiscal Signer with IntegrationAccount
 *
 * This module provides fiscalization signing capabilities using credentials
 * stored in IntegrationAccount unified vault. It enforces tenant isolation
 * with hard assertions.
 *
 * @module fiscal/signer-v2
 * @since Phase 4 - Fiscalization Migration
 */

import { findIntegrationAccountById, touchIntegrationAccount } from "@/lib/integration/repository"
import { parseFiscalizationSecrets, extractP12FromSecrets } from "@/lib/integration/types"
import {
  TenantViolationError,
  IntegrationNotFoundError,
  IntegrationDisabledError,
} from "@/lib/e-invoice/provider-v2"
import { parseP12Certificate, forgeToPem, type ParsedCertificate } from "./certificate-parser"
import { logger } from "@/lib/logger"

/**
 * Signing credentials ready for use with xml-signer
 */
export interface SigningCredentials {
  privateKeyPem: string
  certificatePem: string
}

/**
 * V2 Fiscal Signer interface
 */
export interface FiscalSignerV2 {
  /** IntegrationAccount ID used for signing */
  integrationAccountId: string

  /** Company ID this signer belongs to */
  companyId: string

  /** OIB extracted from certificate */
  oib: string

  /** Certificate subject (CN) */
  certSubject: string

  /** Certificate serial number */
  certSerial: string

  /** Certificate expiry date */
  certNotAfter: Date

  /** Signing credentials (PEM format) */
  credentials: SigningCredentials

  /** Parsed certificate for additional metadata */
  parsedCert: ParsedCertificate
}

interface FiscalProviderConfig {
  certSubject?: string
  certSerial?: string
  certNotBefore?: string
  certNotAfter?: string
  oibExtracted?: string
  migratedFrom?: string
  migratedAt?: string
}

/**
 * Creates a fiscal signer from an IntegrationAccount.
 *
 * This is the V2 path that:
 * 1. Enforces tenant isolation with hard assertions
 * 2. Decrypts P12 from unified vault
 * 3. Parses certificate and extracts credentials
 *
 * @param integrationAccountId - The IntegrationAccount ID to use
 * @param companyId - The company ID (for tenant assertion)
 * @returns FiscalSignerV2 ready for signing operations
 *
 * @throws TenantViolationError if companyId doesn't match account
 * @throws IntegrationNotFoundError if account not found
 * @throws IntegrationDisabledError if account is not ACTIVE
 */
export async function createSignerFromIntegrationAccount(
  integrationAccountId: string,
  companyId: string
): Promise<FiscalSignerV2> {
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

  if (account.kind !== "FISCALIZATION_CIS") {
    throw new Error(`Invalid integration kind for fiscal signer: ${account.kind}`)
  }

  logger.info(
    {
      companyId,
      integrationAccountId,
      environment: account.environment,
    },
    "Creating V2 fiscal signer from IntegrationAccount"
  )

  // Parse and validate secrets
  const secrets = parseFiscalizationSecrets(account.secrets)
  const { p12Buffer, password } = extractP12FromSecrets(secrets)

  // Parse P12 certificate
  const parsedCert = await parseP12Certificate(p12Buffer, password)
  const credentials = forgeToPem(parsedCert.privateKey, parsedCert.certificate)

  // Get config for metadata (fallback to parsed cert)
  const config = account.providerConfig as FiscalProviderConfig | null

  // Update lastUsedAt asynchronously
  void touchIntegrationAccount(integrationAccountId)

  logger.debug(
    {
      integrationAccountId,
      oib: parsedCert.oib,
      certSerial: parsedCert.serial,
      certNotAfter: parsedCert.notAfter.toISOString(),
    },
    "V2 fiscal signer created successfully"
  )

  return {
    integrationAccountId,
    companyId,
    oib: config?.oibExtracted ?? parsedCert.oib,
    certSubject: config?.certSubject ?? parsedCert.subject,
    certSerial: config?.certSerial ?? parsedCert.serial,
    certNotAfter: parsedCert.notAfter,
    credentials,
    parsedCert,
  }
}

/**
 * Resolves IntegrationAccount for a company and creates signer.
 * Used when integrationAccountId is not yet known.
 *
 * @param companyId - Company to resolve signer for
 * @param environment - TEST or PROD
 * @returns FiscalSignerV2 for the company
 *
 * @throws IntegrationNotFoundError if no FISCALIZATION_CIS account found
 */
export async function resolveSignerForCompany(
  companyId: string,
  environment: "TEST" | "PROD"
): Promise<FiscalSignerV2> {
  const { findIntegrationAccount } = await import("@/lib/integration/repository")

  const account = await findIntegrationAccount(companyId, "FISCALIZATION_CIS", environment)

  if (!account) {
    throw new IntegrationNotFoundError(`FISCALIZATION_CIS/${environment} for company ${companyId}`)
  }

  return createSignerFromIntegrationAccount(account.id, companyId)
}
