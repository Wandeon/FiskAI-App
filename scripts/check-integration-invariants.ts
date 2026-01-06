#!/usr/bin/env npx tsx
/**
 * Phase 5: Integration Account Invariants Check
 *
 * This script verifies database invariants for IntegrationAccount usage:
 * - No SENT/DELIVERED EInvoice without integrationAccountId
 * - No SUCCESS FiscalRequest without integrationAccountId
 * - No ProviderSyncState without integrationAccountId (when enforcement is active)
 *
 * Run: npx tsx scripts/check-integration-invariants.ts
 * Exit code: 0 = pass, 1 = violations found
 *
 * Options:
 *   --enforce    Exit 1 on any violation (use in CI when enforcement is active)
 *   --fix        Attempt to backfill missing integrationAccountIds
 *
 * @module scripts/check-integration-invariants
 * @since Phase 5 - Enforcement & Cleanup
 */

import { db } from "@/lib/db"
import { FiscalStatus } from "@prisma/client"

interface InvariantViolation {
  model: string
  field: string
  condition: string
  count: number
  sample?: Array<{ id: string; companyId: string; createdAt: Date }>
}

async function checkInvariants(): Promise<InvariantViolation[]> {
  const violations: InvariantViolation[] = []

  // Check 1: EInvoice SENT/DELIVERED without integrationAccountId
  const einvoiceNoIntegration = await db.eInvoice.findMany({
    where: {
      status: { in: ["SENT", "DELIVERED"] },
      integrationAccountId: null,
    },
    select: { id: true, companyId: true, createdAt: true },
    take: 5,
  })

  const einvoiceCount = await db.eInvoice.count({
    where: {
      status: { in: ["SENT", "DELIVERED"] },
      integrationAccountId: null,
    },
  })

  if (einvoiceCount > 0) {
    violations.push({
      model: "EInvoice",
      field: "integrationAccountId",
      condition: "status IN (SENT, DELIVERED) AND integrationAccountId IS NULL",
      count: einvoiceCount,
      sample: einvoiceNoIntegration,
    })
  }

  // Check 2: FiscalRequest COMPLETED without integrationAccountId
  const fiscalNoIntegration = await db.fiscalRequest.findMany({
    where: {
      status: FiscalStatus.COMPLETED,
      integrationAccountId: null,
    },
    select: { id: true, companyId: true, createdAt: true },
    take: 5,
  })

  const fiscalCount = await db.fiscalRequest.count({
    where: {
      status: FiscalStatus.COMPLETED,
      integrationAccountId: null,
    },
  })

  if (fiscalCount > 0) {
    violations.push({
      model: "FiscalRequest",
      field: "integrationAccountId",
      condition: "status = COMPLETED AND integrationAccountId IS NULL",
      count: fiscalCount,
      sample: fiscalNoIntegration,
    })
  }

  // Check 3: ProviderSyncState without integrationAccountId
  const syncNoIntegration = await db.providerSyncState.findMany({
    where: {
      integrationAccountId: null,
    },
    select: { id: true, companyId: true, updatedAt: true },
    take: 5,
  })

  const syncCount = await db.providerSyncState.count({
    where: {
      integrationAccountId: null,
    },
  })

  if (syncCount > 0) {
    violations.push({
      model: "ProviderSyncState",
      field: "integrationAccountId",
      condition: "integrationAccountId IS NULL",
      count: syncCount,
      sample: syncNoIntegration.map((s) => ({
        id: s.id,
        companyId: s.companyId,
        createdAt: s.updatedAt,
      })),
    })
  }

  // Check 4: IntegrationAccount without valid foreign keys (orphaned)
  const orphanedAccounts = await db.$queryRaw<Array<{ id: string; companyId: string }>>`
    SELECT ia.id, ia."companyId"
    FROM integration_account ia
    LEFT JOIN "Company" c ON ia."companyId" = c.id
    WHERE c.id IS NULL
    LIMIT 5
  `

  const orphanedCount = await db.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count
    FROM integration_account ia
    LEFT JOIN "Company" c ON ia."companyId" = c.id
    WHERE c.id IS NULL
  `

  const orphanCount = Number(orphanedCount[0]?.count ?? 0)
  if (orphanCount > 0) {
    violations.push({
      model: "IntegrationAccount",
      field: "companyId",
      condition: "companyId references non-existent Company",
      count: orphanCount,
      sample: orphanedAccounts.map((a) => ({
        id: a.id,
        companyId: a.companyId,
        createdAt: new Date(),
      })),
    })
  }

  // Check 5: Company with fiscalization enabled but no FISCALIZATION_CIS account
  const companiesWithFiscalNoAccount = await db.$queryRaw<Array<{ id: string; name: string }>>`
    SELECT c.id, c.name
    FROM "Company" c
    WHERE 'fiscalization' = ANY(c.entitlements)
    AND NOT EXISTS (
      SELECT 1 FROM integration_account ia
      WHERE ia."companyId" = c.id
      AND ia.kind = 'FISCALIZATION_CIS'
      AND ia.status = 'ACTIVE'
    )
    LIMIT 5
  `

  const companiesWithFiscalNoAccountCount = await db.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count
    FROM "Company" c
    WHERE 'fiscalization' = ANY(c.entitlements)
    AND NOT EXISTS (
      SELECT 1 FROM integration_account ia
      WHERE ia."companyId" = c.id
      AND ia.kind = 'FISCALIZATION_CIS'
      AND ia.status = 'ACTIVE'
    )
  `

  const fiscalNoAccountCount = Number(companiesWithFiscalNoAccountCount[0]?.count ?? 0)
  if (fiscalNoAccountCount > 0) {
    violations.push({
      model: "Company",
      field: "IntegrationAccount(FISCALIZATION_CIS)",
      condition: "fiscalization enabled but no active FISCALIZATION_CIS account",
      count: fiscalNoAccountCount,
      sample: companiesWithFiscalNoAccount.map((c) => ({
        id: c.id,
        companyId: c.id,
        createdAt: new Date(),
      })),
    })
  }

  return violations
}

async function main() {
  const args = process.argv.slice(2)
  const enforce = args.includes("--enforce")
  const fix = args.includes("--fix")

  console.log("🔍 Phase 5: Checking IntegrationAccount database invariants...")
  console.log("")

  if (enforce) {
    console.log("⚠️  Running in ENFORCE mode - will exit 1 on any violation")
    console.log("")
  }

  const violations = await checkInvariants()

  if (violations.length === 0) {
    console.log("✅ All database invariants satisfied.")
    console.log("")
    console.log("VERIFIED:")
    console.log("  - All SENT/DELIVERED EInvoices have integrationAccountId")
    console.log("  - All COMPLETED FiscalRequests have integrationAccountId")
    console.log("  - All ProviderSyncStates have integrationAccountId")
    console.log("  - No orphaned IntegrationAccounts")
    console.log("  - All fiscalization-enabled companies have active FISCALIZATION_CIS account")
    await db.$disconnect()
    process.exit(0)
  }

  console.log("⚠️  DATABASE INVARIANT VIOLATIONS FOUND")
  console.log("")

  for (const v of violations) {
    console.log(`❌ ${v.model}.${v.field}`)
    console.log(`   Condition: ${v.condition}`)
    console.log(`   Violations: ${v.count}`)
    if (v.sample && v.sample.length > 0) {
      console.log(`   Sample IDs:`)
      for (const s of v.sample) {
        console.log(`     - ${s.id} (company: ${s.companyId})`)
      }
    }
    console.log("")
  }

  const totalViolations = violations.reduce((sum, v) => sum + v.count, 0)
  console.log(`Total violations: ${totalViolations}`)
  console.log("")

  if (fix) {
    console.log("🔧 --fix flag provided. Attempting to backfill...")
    console.log("   (Not implemented - manual migration required)")
    console.log("")
  }

  if (enforce) {
    console.log("❌ ENFORCEMENT FAILED - database invariants not satisfied")
    await db.$disconnect()
    process.exit(1)
  }

  console.log("⚠️  Run with --enforce to fail on violations")
  console.log("   Run with --fix to attempt backfill (requires implementation)")

  await db.$disconnect()
  process.exit(0)
}

main().catch(async (error) => {
  console.error("Error:", error)
  await db.$disconnect()
  process.exit(1)
})
