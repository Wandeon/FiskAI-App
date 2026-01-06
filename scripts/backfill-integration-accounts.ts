#!/usr/bin/env npx tsx
/**
 * Backfill IntegrationAccounts from existing Company and FiscalCertificate data.
 *
 * This script:
 * 1. Creates EINVOICE_* accounts from Company.eInvoiceProvider + eInvoiceApiKeyEncrypted
 * 2. Creates FISCALIZATION_CIS accounts from FiscalCertificate records
 *
 * Safe to run multiple times (uses check-before-create pattern to avoid re-encrypting).
 *
 * Usage:
 *   npx tsx scripts/backfill-integration-accounts.ts [--dry-run]
 */

import { db } from "../src/lib/db/core"
import { decryptSecret } from "../src/lib/secrets"
import { decryptWithEnvelope } from "../src/lib/fiscal/envelope-encryption"
import { encryptSecretEnvelope } from "../src/lib/integration/vault"
import { IntegrationKind, IntegrationEnv } from "@prisma/client"

const isDryRun = process.argv.includes("--dry-run")

interface BackfillStats {
  companiesProcessed: number
  eInvoiceAccountsCreated: number
  eInvoiceAccountsSkipped: number
  eInvoiceAccountsAlreadyExist: number
  fiscalAccountsCreated: number
  fiscalAccountsSkipped: number
  fiscalAccountsAlreadyExist: number
  errors: string[]
}

/**
 * Maps e-invoice provider name to IntegrationKind enum.
 * Returns null for unknown providers.
 */
function mapProviderToKind(provider: string): IntegrationKind | null {
  const mapping: Record<string, IntegrationKind> = {
    eposlovanje: "EINVOICE_EPOSLOVANJE",
    fina: "EINVOICE_FINA",
    "ie-racuni": "EINVOICE_IE_RACUNI",
  }
  return mapping[provider.toLowerCase()] ?? null
}

/**
 * Determines the e-invoice environment based on EPOSLOVANJE_API_BASE URL.
 * - If URL contains 'test.' -> TEST
 * - Otherwise -> PROD (default)
 */
function getEInvoiceEnvironment(): IntegrationEnv {
  const apiBase = process.env.EPOSLOVANJE_API_BASE || ""
  if (apiBase.includes("test.")) {
    return "TEST"
  }
  return "PROD"
}

/**
 * Backfill e-invoice accounts from Company.eInvoiceProvider + eInvoiceApiKeyEncrypted
 */
async function backfillEInvoiceAccounts(stats: BackfillStats): Promise<void> {
  console.log("\n=== Backfilling E-Invoice Accounts ===")

  const companies = await db.company.findMany({
    where: {
      eInvoiceProvider: { not: null },
      eInvoiceApiKeyEncrypted: { not: null },
    },
    select: {
      id: true,
      name: true,
      eInvoiceProvider: true,
      eInvoiceApiKeyEncrypted: true,
    },
  })

  console.log(`Found ${companies.length} companies with e-invoice configuration`)

  const environment = getEInvoiceEnvironment()
  console.log(`E-Invoice environment detected: ${environment}`)

  for (const company of companies) {
    stats.companiesProcessed++

    try {
      // Map provider name to IntegrationKind
      const kind = mapProviderToKind(company.eInvoiceProvider!)
      if (!kind) {
        console.log(`  [SKIP] ${company.name}: Unknown provider "${company.eInvoiceProvider}"`)
        stats.eInvoiceAccountsSkipped++
        continue
      }

      // Check if account already exists (idempotency check)
      const existing = await db.integrationAccount.findUnique({
        where: {
          companyId_kind_environment: {
            companyId: company.id,
            kind,
            environment,
          },
        },
      })

      if (existing) {
        console.log(`  [EXISTS] ${company.name}: ${kind} (${environment}) account already exists`)
        stats.eInvoiceAccountsAlreadyExist++
        continue
      }

      // Decrypt existing key from old encryption
      let apiKey: string
      try {
        apiKey = decryptSecret(company.eInvoiceApiKeyEncrypted!)
      } catch (decryptError) {
        const msg = `Failed to decrypt API key for ${company.name}: ${decryptError instanceof Error ? decryptError.message : decryptError}`
        console.error(`  [ERROR] ${msg}`)
        stats.errors.push(msg)
        stats.eInvoiceAccountsSkipped++
        continue
      }

      // Re-encrypt with new vault
      const { envelope, keyVersion } = encryptSecretEnvelope({ apiKey })

      if (isDryRun) {
        console.log(`  [DRY-RUN] Would create ${kind} (${environment}) for ${company.name}`)
        stats.eInvoiceAccountsCreated++
        continue
      }

      await db.integrationAccount.create({
        data: {
          companyId: company.id,
          kind,
          environment,
          status: "ACTIVE",
          secretEnvelope: envelope,
          secretKeyVersion: keyVersion,
          providerConfig: {
            migratedFrom: "Company.eInvoiceApiKeyEncrypted",
            migratedAt: new Date().toISOString(),
            originalProvider: company.eInvoiceProvider,
          },
        },
      })

      console.log(`  [OK] Created ${kind} (${environment}) for ${company.name}`)
      stats.eInvoiceAccountsCreated++
    } catch (error) {
      const msg = `Error processing ${company.name}: ${error instanceof Error ? error.message : error}`
      console.error(`  [ERROR] ${msg}`)
      stats.errors.push(msg)
    }
  }
}

/**
 * Backfill fiscalization accounts from FiscalCertificate records.
 * Note: FiscalCertificate stores { p12: <base64>, password: <string> } as encrypted JSON.
 */
async function backfillFiscalAccounts(stats: BackfillStats): Promise<void> {
  console.log("\n=== Backfilling Fiscalization Accounts ===")

  const certificates = await db.fiscalCertificate.findMany({
    where: {
      status: "ACTIVE",
    },
    include: {
      company: { select: { id: true, name: true } },
    },
  })

  console.log(`Found ${certificates.length} active fiscal certificates`)

  for (const cert of certificates) {
    try {
      // FiscalCertificate.environment is already TEST/PROD, use as-is
      const environment: IntegrationEnv = cert.environment === "TEST" ? "TEST" : "PROD"

      // Check if account already exists (idempotency check)
      const existing = await db.integrationAccount.findUnique({
        where: {
          companyId_kind_environment: {
            companyId: cert.companyId,
            kind: "FISCALIZATION_CIS",
            environment,
          },
        },
      })

      if (existing) {
        console.log(
          `  [EXISTS] ${cert.company.name} (${environment}): FISCALIZATION_CIS account already exists`
        )
        stats.fiscalAccountsAlreadyExist++
        continue
      }

      // Decrypt existing P12 data using envelope encryption
      let p12Payload: { p12: string; password: string }
      try {
        const decryptedPayload = decryptWithEnvelope(cert.encryptedP12, cert.encryptedDataKey)
        p12Payload = JSON.parse(decryptedPayload)
      } catch (decryptError) {
        const msg = `Failed to decrypt certificate for ${cert.company.name}: ${decryptError instanceof Error ? decryptError.message : decryptError}`
        console.error(`  [ERROR] ${msg}`)
        stats.errors.push(msg)
        stats.fiscalAccountsSkipped++
        continue
      }

      // Re-encrypt with new vault
      // Note: The new vault expects p12Base64 and p12Password field names
      const { envelope, keyVersion } = encryptSecretEnvelope({
        p12Base64: p12Payload.p12,
        p12Password: p12Payload.password,
      })

      if (isDryRun) {
        console.log(
          `  [DRY-RUN] Would create FISCALIZATION_CIS (${environment}) for ${cert.company.name}`
        )
        stats.fiscalAccountsCreated++
        continue
      }

      await db.integrationAccount.create({
        data: {
          companyId: cert.companyId,
          kind: "FISCALIZATION_CIS",
          environment,
          status: "ACTIVE",
          secretEnvelope: envelope,
          secretKeyVersion: keyVersion,
          providerConfig: {
            certSubject: cert.certSubject,
            certSerial: cert.certSerial,
            certNotBefore: cert.certNotBefore.toISOString(),
            certNotAfter: cert.certNotAfter.toISOString(),
            oibExtracted: cert.oibExtracted,
            certSha256: cert.certSha256,
            migratedFrom: `FiscalCertificate.${cert.id}`,
            migratedAt: new Date().toISOString(),
          },
        },
      })

      console.log(`  [OK] Created FISCALIZATION_CIS (${environment}) for ${cert.company.name}`)
      stats.fiscalAccountsCreated++
    } catch (error) {
      const msg = `Error processing cert ${cert.id} (${cert.company.name}): ${error instanceof Error ? error.message : error}`
      console.error(`  [ERROR] ${msg}`)
      stats.errors.push(msg)
    }
  }
}

async function main() {
  console.log("=== IntegrationAccount Backfill ===")
  console.log(`Mode: ${isDryRun ? "DRY-RUN (no changes will be made)" : "LIVE"}`)
  console.log(`Timestamp: ${new Date().toISOString()}`)

  const stats: BackfillStats = {
    companiesProcessed: 0,
    eInvoiceAccountsCreated: 0,
    eInvoiceAccountsSkipped: 0,
    eInvoiceAccountsAlreadyExist: 0,
    fiscalAccountsCreated: 0,
    fiscalAccountsSkipped: 0,
    fiscalAccountsAlreadyExist: 0,
    errors: [],
  }

  try {
    await backfillEInvoiceAccounts(stats)
    await backfillFiscalAccounts(stats)

    console.log("\n=== Summary ===")
    console.log(`Mode:                           ${isDryRun ? "DRY-RUN" : "LIVE"}`)
    console.log(`Companies processed:            ${stats.companiesProcessed}`)
    console.log(`E-Invoice accounts created:     ${stats.eInvoiceAccountsCreated}`)
    console.log(`E-Invoice accounts skipped:     ${stats.eInvoiceAccountsSkipped}`)
    console.log(`E-Invoice accounts pre-exist:   ${stats.eInvoiceAccountsAlreadyExist}`)
    console.log(`Fiscal accounts created:        ${stats.fiscalAccountsCreated}`)
    console.log(`Fiscal accounts skipped:        ${stats.fiscalAccountsSkipped}`)
    console.log(`Fiscal accounts pre-exist:      ${stats.fiscalAccountsAlreadyExist}`)
    console.log(`Errors:                         ${stats.errors.length}`)

    if (stats.errors.length > 0) {
      console.log("\nErrors encountered:")
      stats.errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`))
    }

    if (isDryRun) {
      console.log("\n[DRY-RUN] No changes were made. Run without --dry-run to apply changes.")
    }
  } finally {
    await db.$disconnect()
  }
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})

export {}
