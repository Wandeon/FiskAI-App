#!/usr/bin/env npx tsx
/**
 * Phase 5: Integration Account Audit Runner
 *
 * Executes audit queries against the database and provides formatted output.
 * This is the executable wrapper for audit-integration-state.sql
 *
 * Run: npx tsx scripts/run-audit-integration-state.ts
 *
 * @module scripts/run-audit-integration-state
 * @since Phase 5 - Enforcement & Cleanup
 */

import { db } from "@/lib/db"
import { FiscalStatus } from "@prisma/client"

interface ReadinessCheck {
  check_name: string
  violation_count: bigint
  status: string
}

async function runAudit() {
  console.log("=".repeat(80))
  console.log("Phase 5: Integration Account Audit")
  console.log("=".repeat(80))
  console.log("")

  // 1. Companies missing IntegrationAccount for enabled features
  console.log("1. COMPANIES MISSING INTEGRATION ACCOUNTS")
  console.log("-".repeat(40))

  const companiesMissingFiscal = await db.$queryRaw<
    Array<{ company_id: string; name: string; missing_integration: string }>
  >`
    SELECT
      c.id as company_id,
      c.name,
      'FISCALIZATION' as missing_integration
    FROM "Company" c
    WHERE 'fiscalization' = ANY(c.entitlements)
    AND NOT EXISTS (
      SELECT 1 FROM integration_account ia
      WHERE ia."companyId" = c.id
      AND ia.kind = 'FISCALIZATION_CIS'
      AND ia.status = 'ACTIVE'
    )
    ORDER BY c."createdAt" DESC
    LIMIT 10
  `

  const companiesMissingEInvoice = await db.$queryRaw<
    Array<{ company_id: string; name: string; missing_integration: string }>
  >`
    SELECT
      c.id as company_id,
      c.name,
      'EINVOICE' as missing_integration
    FROM "Company" c
    WHERE 'e-invoicing' = ANY(c.entitlements)
    AND NOT EXISTS (
      SELECT 1 FROM integration_account ia
      WHERE ia."companyId" = c.id
      AND ia.kind LIKE 'EINVOICE_%'
      AND ia.status = 'ACTIVE'
    )
    ORDER BY c."createdAt" DESC
    LIMIT 10
  `

  if (companiesMissingFiscal.length === 0 && companiesMissingEInvoice.length === 0) {
    console.log("  ✅ All companies with enabled features have required IntegrationAccounts")
  } else {
    if (companiesMissingFiscal.length > 0) {
      console.log("  ⚠️  Companies with fiscalization but no FISCALIZATION_CIS account:")
      for (const c of companiesMissingFiscal) {
        console.log(`     - ${c.name} (${c.company_id})`)
      }
    }
    if (companiesMissingEInvoice.length > 0) {
      console.log("  ⚠️  Companies with e-invoicing but no EINVOICE_* account:")
      for (const c of companiesMissingEInvoice) {
        console.log(`     - ${c.name} (${c.company_id})`)
      }
    }
  }
  console.log("")

  // 2. Records without integrationAccountId
  console.log("2. RECORDS WITHOUT integrationAccountId")
  console.log("-".repeat(40))

  const einvoiceCount = await db.eInvoice.count({
    where: {
      status: { in: ["SENT", "DELIVERED"] },
      integrationAccountId: null,
    },
  })

  const fiscalCount = await db.fiscalRequest.count({
    where: {
      status: FiscalStatus.COMPLETED,
      integrationAccountId: null,
    },
  })

  const syncCount = await db.providerSyncState.count({
    where: {
      integrationAccountId: null,
    },
  })

  console.log(`  EInvoice (SENT/DELIVERED) without integrationAccountId: ${einvoiceCount}`)
  console.log(`  FiscalRequest (COMPLETED) without integrationAccountId: ${fiscalCount}`)
  console.log(`  ProviderSyncState without integrationAccountId: ${syncCount}`)

  if (einvoiceCount === 0 && fiscalCount === 0 && syncCount === 0) {
    console.log("  ✅ All records have integrationAccountId")
  } else {
    console.log("  ⚠️  Some records need backfill before enforcement")
  }
  console.log("")

  // 3. Legacy secrets
  console.log("3. LEGACY SECRET FIELDS")
  console.log("-".repeat(40))

  const legacySecretCount = await db.company.count({
    where: {
      eInvoiceApiKeyEncrypted: { not: null },
    },
  })

  console.log(`  Companies with legacy eInvoiceApiKeyEncrypted: ${legacySecretCount}`)
  if (legacySecretCount === 0) {
    console.log("  ✅ No legacy secrets remaining")
  } else {
    console.log("  ⚠️  Legacy secrets exist (will be blocked by enforcement)")
  }
  console.log("")

  // 4. IntegrationAccount summary
  console.log("4. INTEGRATION ACCOUNT SUMMARY")
  console.log("-".repeat(40))

  const accountSummary = await db.$queryRaw<
    Array<{ kind: string; status: string; environment: string; count: bigint }>
  >`
    SELECT
      kind,
      status,
      environment,
      COUNT(*) as count
    FROM integration_account
    GROUP BY kind, status, environment
    ORDER BY kind, status, environment
  `

  if (accountSummary.length === 0) {
    console.log("  No IntegrationAccounts found")
  } else {
    console.log("  Kind                      | Status   | Env  | Count")
    console.log("  " + "-".repeat(50))
    for (const row of accountSummary) {
      console.log(
        `  ${row.kind.padEnd(25)} | ${row.status.padEnd(8)} | ${row.environment.padEnd(4)} | ${row.count}`
      )
    }
  }
  console.log("")

  // 5. Readiness summary
  console.log("5. ENFORCEMENT READINESS SUMMARY")
  console.log("-".repeat(40))

  const checks: Array<{ name: string; count: number; ready: boolean }> = [
    {
      name: "EInvoice SENT/DELIVERED without integrationAccountId",
      count: einvoiceCount,
      ready: einvoiceCount === 0,
    },
    {
      name: "FiscalRequest COMPLETED without integrationAccountId",
      count: fiscalCount,
      ready: fiscalCount === 0,
    },
    {
      name: "ProviderSyncState without integrationAccountId",
      count: syncCount,
      ready: syncCount === 0,
    },
    {
      name: "Companies with fiscalization but no FISCALIZATION_CIS",
      count: companiesMissingFiscal.length,
      ready: companiesMissingFiscal.length === 0,
    },
    {
      name: "Companies with e-invoicing but no EINVOICE_*",
      count: companiesMissingEInvoice.length,
      ready: companiesMissingEInvoice.length === 0,
    },
  ]

  let allReady = true
  for (const check of checks) {
    const status = check.ready ? "✅ READY" : "❌ NOT READY"
    console.log(`  ${status} | ${check.name} (${check.count})`)
    if (!check.ready) allReady = false
  }

  console.log("")
  console.log("=".repeat(80))
  if (allReady) {
    console.log("✅ ALL CHECKS PASSED - SAFE TO ENABLE ENFORCEMENT")
  } else {
    console.log("❌ ENFORCEMENT NOT READY - Fix issues above before enabling")
  }
  console.log("=".repeat(80))

  await db.$disconnect()
  process.exit(allReady ? 0 : 1)
}

runAudit().catch(async (error) => {
  console.error("Audit failed:", error)
  await db.$disconnect()
  process.exit(1)
})
