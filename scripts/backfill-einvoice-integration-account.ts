#!/usr/bin/env npx tsx
/**
 * Phase 5 Remediation: Backfill EInvoice.integrationAccountId
 *
 * Maps existing EInvoice records to their IntegrationAccount.
 * Supports --dry-run (default) and --apply modes.
 */

import { db } from "@/lib/db"
import { IntegrationKind, IntegrationEnv } from "@prisma/client"

interface BackfillMapping {
  einvoiceId: string
  companyId: string
  companyName: string
  integrationAccountId: string
  kind: IntegrationKind
  environment: IntegrationEnv
}

interface UnmappableInvoice {
  einvoiceId: string
  companyId: string
  reason: string
}

async function identifyBackfillTargets(): Promise<{
  mappings: BackfillMapping[]
  unmappable: UnmappableInvoice[]
}> {
  const mappings: BackfillMapping[] = []
  const unmappable: UnmappableInvoice[] = []

  // Get all EInvoices without integrationAccountId
  const einvoices = await db.eInvoice.findMany({
    where: {
      integrationAccountId: null,
    },
    select: {
      id: true,
      companyId: true,
      status: true,
      direction: true,
    },
  })

  console.log(`Found ${einvoices.length} EInvoices without integrationAccountId`)

  // Get all IntegrationAccounts for lookup
  const integrationAccounts = await db.integrationAccount.findMany({
    where: {
      kind: {
        in: [
          IntegrationKind.EINVOICE_EPOSLOVANJE,
          IntegrationKind.EINVOICE_FINA,
          IntegrationKind.EINVOICE_IE_RACUNI,
        ],
      },
    },
    include: {
      company: { select: { name: true } },
    },
  })

  // Build lookup map: companyId -> IntegrationAccount[]
  const accountsByCompany = new Map<string, typeof integrationAccounts>()
  for (const account of integrationAccounts) {
    const existing = accountsByCompany.get(account.companyId) || []
    existing.push(account)
    accountsByCompany.set(account.companyId, existing)
  }

  // Map each EInvoice to its IntegrationAccount
  for (const einvoice of einvoices) {
    const companyAccounts = accountsByCompany.get(einvoice.companyId)

    if (!companyAccounts || companyAccounts.length === 0) {
      unmappable.push({
        einvoiceId: einvoice.id,
        companyId: einvoice.companyId,
        reason: "No IntegrationAccount exists for this company",
      })
      continue
    }

    // If multiple accounts exist for the company, we need to determine which one
    // For now, prefer PROD environment, then TEST
    let targetAccount = companyAccounts.find((a) => a.environment === IntegrationEnv.PROD)
    if (!targetAccount) {
      targetAccount = companyAccounts.find((a) => a.environment === IntegrationEnv.TEST)
    }
    if (!targetAccount) {
      targetAccount = companyAccounts[0]
    }

    if (companyAccounts.length > 1) {
      console.log(
        `  Multiple accounts for ${einvoice.companyId}, selected ${targetAccount.id} (${targetAccount.environment})`
      )
    }

    mappings.push({
      einvoiceId: einvoice.id,
      companyId: einvoice.companyId,
      companyName: targetAccount.company.name,
      integrationAccountId: targetAccount.id,
      kind: targetAccount.kind,
      environment: targetAccount.environment,
    })
  }

  return { mappings, unmappable }
}

async function backfill(apply: boolean) {
  console.log("=".repeat(60))
  console.log("PHASE 5: EINVOICE INTEGRATION ACCOUNT BACKFILL")
  console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}`)
  console.log("Timestamp:", new Date().toISOString())
  console.log("=".repeat(60))

  // Identify targets
  console.log("\n=== IDENTIFYING BACKFILL TARGETS ===")
  const { mappings, unmappable } = await identifyBackfillTargets()

  // Report unmappable
  if (unmappable.length > 0) {
    console.log(`\n⚠️  UNMAPPABLE INVOICES: ${unmappable.length}`)
    for (const u of unmappable) {
      console.log(`  ${u.einvoiceId} | company: ${u.companyId} | reason: ${u.reason}`)
    }
    console.log("\n❌ STOPPING: Cannot proceed with unmappable invoices.")
    console.log("Create IntegrationAccounts for these companies first.")
    await db.$disconnect()
    process.exit(1)
  }

  console.log(`\nMappings identified: ${mappings.length}`)

  // Group by company for reporting
  const byCompany = new Map<string, BackfillMapping[]>()
  for (const m of mappings) {
    const existing = byCompany.get(m.companyId) || []
    existing.push(m)
    byCompany.set(m.companyId, existing)
  }

  console.log("\nBackfill plan by company:")
  for (const [companyId, maps] of byCompany) {
    console.log(
      `  ${maps[0].companyName} (${companyId}): ${maps.length} invoices → ${maps[0].integrationAccountId}`
    )
  }

  if (!apply) {
    console.log("\n[DRY-RUN] No changes made. Run with --apply to backfill.")
    await db.$disconnect()
    return
  }

  // Apply backfill
  console.log("\n=== APPLYING BACKFILL ===")
  let updated = 0
  let skipped = 0

  for (const mapping of mappings) {
    try {
      const result = await db.eInvoice.updateMany({
        where: {
          id: mapping.einvoiceId,
          integrationAccountId: null, // Only update if still null (idempotent)
        },
        data: {
          integrationAccountId: mapping.integrationAccountId,
        },
      })

      if (result.count === 1) {
        updated++
      } else {
        skipped++ // Already had integrationAccountId
      }
    } catch (error) {
      console.error(`  ✗ Failed to update ${mapping.einvoiceId}:`, error)
    }
  }

  console.log(`\n=== BACKFILL SUMMARY ===`)
  console.log(`Updated: ${updated}`)
  console.log(`Skipped (already set): ${skipped}`)
  console.log(`Total processed: ${mappings.length}`)

  // Verify
  console.log("\n=== POST-BACKFILL VERIFICATION ===")
  const remaining = await db.eInvoice.count({
    where: { integrationAccountId: null },
  })
  console.log(`EInvoices still without integrationAccountId: ${remaining}`)

  if (remaining === 0) {
    console.log("✅ All EInvoices now have integrationAccountId")
  } else {
    console.log("⚠️  Some EInvoices still missing integrationAccountId")
  }

  // Output updated invoice IDs
  console.log("\n=== BACKFILLED INVOICE IDS ===")
  for (const m of mappings) {
    console.log(m.einvoiceId)
  }

  await db.$disconnect()
}

// Parse args
const args = process.argv.slice(2)
const apply = args.includes("--apply")

backfill(apply).catch(async (error) => {
  console.error("Backfill failed:", error)
  await db.$disconnect()
  process.exit(1)
})
