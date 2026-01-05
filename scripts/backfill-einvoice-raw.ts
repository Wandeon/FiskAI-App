#!/usr/bin/env npx tsx
/**
 * Phase 5 Remediation: Backfill EInvoice.integrationAccountId (Raw SQL)
 *
 * Uses raw SQL to bypass Prisma immutability extensions.
 * This is specifically for backfilling operational metadata that didn't exist
 * when the records were created.
 */

import { db } from "@/lib/db"
import { Prisma } from "@prisma/client"

async function backfillRaw(apply: boolean) {
  console.log("=".repeat(60))
  console.log("PHASE 5: EINVOICE BACKFILL (RAW SQL)")
  console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}`)
  console.log("Timestamp:", new Date().toISOString())
  console.log("=".repeat(60))

  // Get IntegrationAccounts for mapping
  const integrationAccounts = await db.integrationAccount.findMany({
    select: {
      id: true,
      companyId: true,
      kind: true,
      environment: true,
      company: { select: { name: true } },
    },
  })

  console.log(`\nFound ${integrationAccounts.length} IntegrationAccounts:`)
  for (const ia of integrationAccounts) {
    console.log(`  ${ia.id} | ${ia.company.name} (${ia.companyId}) | ${ia.kind} ${ia.environment}`)
  }

  // Get EInvoices without integrationAccountId
  const einvoices = await db.eInvoice.findMany({
    where: { integrationAccountId: null },
    select: {
      id: true,
      companyId: true,
      status: true,
    },
  })

  console.log(`\nFound ${einvoices.length} EInvoices without integrationAccountId`)

  // Build mapping
  const accountByCompany = new Map(integrationAccounts.map((ia) => [ia.companyId, ia]))

  const mappings: Array<{ einvoiceId: string; integrationAccountId: string; companyId: string }> =
    []
  const unmappable: Array<{ einvoiceId: string; companyId: string; reason: string }> = []

  for (const einv of einvoices) {
    const account = accountByCompany.get(einv.companyId)
    if (account) {
      mappings.push({
        einvoiceId: einv.id,
        integrationAccountId: account.id,
        companyId: einv.companyId,
      })
    } else {
      unmappable.push({
        einvoiceId: einv.id,
        companyId: einv.companyId,
        reason: "No IntegrationAccount for company",
      })
    }
  }

  if (unmappable.length > 0) {
    console.log(`\n⚠️  UNMAPPABLE: ${unmappable.length}`)
    for (const u of unmappable) {
      console.log(`  ${u.einvoiceId} | ${u.companyId} | ${u.reason}`)
    }
  }

  console.log(`\nMappings ready: ${mappings.length}`)

  // Group by integrationAccountId for efficient batch updates
  const byAccount = new Map<string, string[]>()
  for (const m of mappings) {
    const existing = byAccount.get(m.integrationAccountId) || []
    existing.push(m.einvoiceId)
    byAccount.set(m.integrationAccountId, existing)
  }

  console.log("\nBackfill plan:")
  for (const [accountId, invoiceIds] of byAccount) {
    const account = integrationAccounts.find((a) => a.id === accountId)
    console.log(`  ${account?.company.name}: ${invoiceIds.length} invoices → ${accountId}`)
  }

  if (!apply) {
    console.log("\n[DRY-RUN] No changes made. Run with --apply to backfill.")
    await db.$disconnect()
    return
  }

  // Apply using raw SQL to bypass immutability
  console.log("\n=== APPLYING BACKFILL (RAW SQL) ===")
  let totalUpdated = 0

  for (const [accountId, invoiceIds] of byAccount) {
    try {
      // Use raw SQL update with explicit public schema
      const result = await db.$executeRaw`
        UPDATE public."EInvoice"
        SET "integrationAccountId" = ${accountId}::text,
            "updatedAt" = NOW()
        WHERE id = ANY(${invoiceIds}::text[])
        AND "integrationAccountId" IS NULL
      `

      console.log(`  Updated ${result} invoices for account ${accountId}`)
      totalUpdated += result
    } catch (error) {
      console.error(`  ✗ Failed for account ${accountId}:`, error)
    }
  }

  console.log(`\n=== BACKFILL SUMMARY ===`)
  console.log(`Total updated: ${totalUpdated}`)
  console.log(`Unmappable: ${unmappable.length}`)

  // Verify
  console.log("\n=== POST-BACKFILL VERIFICATION ===")
  const remaining = await db.eInvoice.count({
    where: { integrationAccountId: null },
  })
  console.log(`EInvoices still without integrationAccountId: ${remaining}`)

  if (remaining === 0) {
    console.log("✅ All EInvoices now have integrationAccountId")
  } else if (remaining === unmappable.length) {
    console.log("⚠️  Remaining invoices are from companies without IntegrationAccount (expected)")
  } else {
    console.log("❌ Unexpected remaining invoices")
  }

  // List updated invoice IDs
  console.log("\n=== BACKFILLED INVOICE IDS ===")
  for (const m of mappings) {
    console.log(m.einvoiceId)
  }

  await db.$disconnect()
}

// Parse args
const args = process.argv.slice(2)
const apply = args.includes("--apply")

backfillRaw(apply).catch(async (error) => {
  console.error("Backfill failed:", error)
  await db.$disconnect()
  process.exit(1)
})
