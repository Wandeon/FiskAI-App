#!/usr/bin/env npx tsx
/**
 * Phase 5 Remediation: Baseline Evidence Collection
 *
 * Collects database state before provisioning/backfill.
 */

import { db } from "@/lib/db"

async function collectBaseline() {
  console.log("=".repeat(60))
  console.log("PHASE 5 BASELINE EVIDENCE")
  console.log("Timestamp:", new Date().toISOString())
  console.log("=".repeat(60))

  // A) IntegrationAccounts count
  console.log("\n=== A) INTEGRATION ACCOUNTS COUNT ===")
  const iaCount = await db.integrationAccount.count()
  console.log(`Total IntegrationAccounts: ${iaCount}`)

  if (iaCount > 0) {
    const accounts = await db.integrationAccount.findMany({
      select: {
        id: true,
        companyId: true,
        kind: true,
        environment: true,
        status: true,
        createdAt: true,
      },
    })
    console.log("\nExisting accounts:")
    for (const a of accounts) {
      console.log(`  ${a.id} | ${a.companyId} | ${a.kind} | ${a.environment} | ${a.status}`)
    }
  }

  // B) Companies with e-invoice config
  console.log("\n=== B) COMPANIES WITH E-INVOICE CONFIG ===")
  const companies = await db.company.findMany({
    select: {
      id: true,
      name: true,
      oib: true,
      isVatPayer: true,
      entitlements: true,
      eInvoiceProvider: true,
      eInvoiceApiKeyEncrypted: true,
      fiscalEnabled: true,
    },
  })

  for (const c of companies) {
    const entitlements = c.entitlements as string[] | null
    const hasEinvoice =
      entitlements?.includes("e-invoicing") || entitlements?.includes("eInvoicing")
    const hasApiKey = Boolean(c.eInvoiceApiKeyEncrypted)
    console.log(`\n${c.name} (${c.id})`)
    console.log(`  OIB: ${c.oib || "null"}, VAT: ${c.isVatPayer}`)
    console.log(`  Entitlements: ${entitlements?.join(", ") || "none"}`)
    console.log(`  Has e-invoice entitlement: ${hasEinvoice}`)
    console.log(`  E-Invoice Provider: ${c.eInvoiceProvider || "not set"}`)
    console.log(`  Has API key configured: ${hasApiKey}`)
    console.log(`  Fiscal enabled: ${c.fiscalEnabled}`)
  }

  // C) EInvoices missing integrationAccountId
  console.log("\n=== C) EINVOICES MISSING integrationAccountId ===")
  const missingIA = await db.eInvoice.findMany({
    where: {
      integrationAccountId: null,
      status: { in: ["SENT", "DELIVERED", "ERROR", "ACCEPTED", "REJECTED"] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      companyId: true,
      status: true,
      direction: true,
      providerStatus: true,
      createdAt: true,
    },
  })

  console.log(`Total operational EInvoices missing integrationAccountId: ${missingIA.length}`)
  for (const inv of missingIA) {
    console.log(
      `  ${inv.id} | company: ${inv.companyId} | status: ${inv.status} | direction: ${inv.direction} | created: ${inv.createdAt.toISOString()}`
    )
  }

  // Grouped counts
  console.log("\n=== C2) ALL EINVOICE COUNTS BY STATUS (NULL integrationAccountId) ===")
  const grouped = await db.eInvoice.groupBy({
    by: ["status"],
    where: { integrationAccountId: null },
    _count: true,
  })
  for (const g of grouped) {
    console.log(`  ${g.status}: ${g._count}`)
  }

  // Total EInvoice count
  const totalEinvoice = await db.eInvoice.count()
  const totalWithIA = await db.eInvoice.count({ where: { integrationAccountId: { not: null } } })
  console.log(`\nTotal EInvoice records: ${totalEinvoice}`)
  console.log(`With integrationAccountId: ${totalWithIA}`)
  console.log(`Without integrationAccountId: ${totalEinvoice - totalWithIA}`)

  // D) FiscalRequest summary
  console.log("\n=== D) FISCAL REQUESTS ===")
  const fiscalCount = await db.fiscalRequest.count()
  const fiscalWithIA = await db.fiscalRequest.count({
    where: { integrationAccountId: { not: null } },
  })
  console.log(`Total FiscalRequests: ${fiscalCount}`)
  console.log(`With integrationAccountId: ${fiscalWithIA}`)
  console.log(`Without integrationAccountId: ${fiscalCount - fiscalWithIA}`)

  console.log("\n" + "=".repeat(60))
  console.log("BASELINE COLLECTION COMPLETE")
  console.log("=".repeat(60))

  await db.$disconnect()
}

collectBaseline().catch(async (error) => {
  console.error("Baseline collection failed:", error)
  await db.$disconnect()
  process.exit(1)
})
