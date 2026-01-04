#!/usr/bin/env npx tsx
/**
 * LANE 2 Inbound Poll-Once Script
 *
 * One-shot polling of ePoslovanje for incoming invoices.
 * Used for verification and manual testing of inbound flow.
 *
 * Usage:
 *   npx tsx scripts/lane2-inbound-poll-once.ts <companyId> [daysBack]
 *
 * Environment:
 *   EPOSLOVANJE_API_BASE - API base URL (test or prod)
 *   EPOSLOVANJE_API_KEY - API key for authorization
 *   DATABASE_URL - PostgreSQL connection string
 *
 * Exit codes:
 *   0 - Success (even if no documents)
 *   1 - Fatal error (config, connection, etc.)
 */

import { db } from "../src/lib/db"
import { Prisma } from "@prisma/client"
import { EposlovanjeEInvoiceProvider } from "../src/lib/e-invoice/providers/eposlovanje-einvoice"

const Decimal = Prisma.Decimal

interface PollResult {
  success: boolean
  fetchedCount: number
  insertedCount: number
  skippedDuplicateCount: number
  errorCount: number
  errors: string[]
  invoiceIds: string[]
}

async function pollIncoming(companyId: string, daysBack: number = 7): Promise<PollResult> {
  const result: PollResult = {
    success: false,
    fetchedCount: 0,
    insertedCount: 0,
    skippedDuplicateCount: 0,
    errorCount: 0,
    errors: [],
    invoiceIds: [],
  }

  // Calculate date range
  const toDate = new Date()
  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - daysBack)

  console.log(
    `\nDate range: ${fromDate.toISOString().split("T")[0]} to ${toDate.toISOString().split("T")[0]}`
  )

  // Create provider instance
  const apiBase = process.env.EPOSLOVANJE_API_BASE
  const apiKey = process.env.EPOSLOVANJE_API_KEY

  if (!apiBase || !apiKey) {
    result.errors.push("EPOSLOVANJE_API_BASE and EPOSLOVANJE_API_KEY required")
    return result
  }

  const provider = new EposlovanjeEInvoiceProvider({
    apiKey,
    apiUrl: apiBase,
  })

  // Verify connectivity first
  console.log("\nTesting connectivity...")
  const isConnected = await provider.testConnection()
  if (!isConnected) {
    result.errors.push("Provider connectivity test failed")
    return result
  }
  console.log("[OK] Connected to ePoslovanje")

  // Fetch incoming invoices
  console.log("\nFetching incoming invoices...")
  const invoices = await provider.fetchIncomingInvoices({
    fromDate,
    toDate,
  })

  result.fetchedCount = invoices.length
  console.log(`Fetched ${invoices.length} invoices from provider`)

  if (invoices.length === 0) {
    console.log("[INFO] No incoming invoices in date range")
    result.success = true
    return result
  }

  // Process each invoice
  for (const invoice of invoices) {
    console.log(`\nProcessing: ${invoice.invoiceNumber} (ref: ${invoice.providerRef})`)

    try {
      // Check for duplicate using providerRef
      const existing = await db.eInvoice.findFirst({
        where: {
          companyId,
          providerRef: invoice.providerRef,
        },
        select: { id: true },
      })

      if (existing) {
        console.log(`  [SKIP] Already exists: ${existing.id}`)
        result.skippedDuplicateCount++
        continue
      }

      // Find or create seller contact
      let sellerId: string | null = null
      if (invoice.sellerOib) {
        const sellerContact = await db.contact.findFirst({
          where: {
            companyId,
            oib: invoice.sellerOib,
          },
          select: { id: true },
        })

        if (sellerContact) {
          sellerId = sellerContact.id
        } else {
          // Create new contact for seller
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
          console.log(`  [NEW] Created seller contact: ${sellerId}`)
        }
      }

      // Insert invoice - unique constraint handles race conditions
      const newInvoice = await db.eInvoice.create({
        data: {
          companyId,
          direction: "INBOUND",
          type: "E_INVOICE",
          invoiceNumber: invoice.invoiceNumber,
          issueDate: invoice.issueDate,
          currency: invoice.currency,
          netAmount: new Decimal(0), // Will be parsed from UBL
          vatAmount: new Decimal(0),
          totalAmount: new Decimal(invoice.totalAmount.toString()),
          status: "DELIVERED",
          providerRef: invoice.providerRef,
          providerStatus: "RECEIVED",
          ublXml: invoice.ublXml || null,
          sellerId,
          notes: `Received via ePoslovanje poll at ${new Date().toISOString()}`,
        },
        select: { id: true, invoiceNumber: true },
      })

      console.log(`  [OK] Created: ${newInvoice.id}`)
      result.insertedCount++
      result.invoiceIds.push(newInvoice.id)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        // Unique constraint violation = duplicate
        console.log(`  [SKIP] Duplicate detected by constraint`)
        result.skippedDuplicateCount++
      } else {
        const msg = error instanceof Error ? error.message : "Unknown error"
        console.log(`  [ERROR] ${msg}`)
        result.errorCount++
        result.errors.push(`${invoice.providerRef}: ${msg}`)
      }
    }
  }

  result.success = result.errorCount === 0
  return result
}

async function main() {
  const companyId = process.argv[2]
  const daysBack = parseInt(process.argv[3] || "7", 10)

  if (!companyId) {
    console.error("Usage: npx tsx scripts/lane2-inbound-poll-once.ts <companyId> [daysBack]")
    console.error(
      "Example: npx tsx scripts/lane2-inbound-poll-once.ts cmj02op1e000101lmu08z0hps 30"
    )
    process.exit(1)
  }

  console.log("=== LANE 2 INBOUND POLL-ONCE ===")
  console.log(`Company ID: ${companyId}`)
  console.log(`Days back: ${daysBack}`)
  console.log(`Timestamp: ${new Date().toISOString()}`)

  // Environment check (don't log secrets)
  console.log("\nEnvironment check:")
  console.log(`  EPOSLOVANJE_API_BASE: ${process.env.EPOSLOVANJE_API_BASE ? "[SET]" : "[NOT SET]"}`)
  console.log(`  EPOSLOVANJE_API_KEY: ${process.env.EPOSLOVANJE_API_KEY ? "[SET]" : "[NOT SET]"}`)

  // Verify company exists
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  })

  if (!company) {
    console.error(`\n[FATAL] Company not found: ${companyId}`)
    process.exit(1)
  }
  console.log(`\nCompany: ${company.name}`)

  // Get baseline counts
  const baselineCounts = await db.eInvoice.groupBy({
    by: ["direction"],
    where: { companyId },
    _count: { id: true },
  })
  console.log("\nBaseline invoice counts:")
  for (const row of baselineCounts) {
    console.log(`  ${row.direction}: ${row._count.id}`)
  }

  // Run poll
  const result = await pollIncoming(companyId, daysBack)

  // Print results
  console.log("\n=== POLL RESULTS ===")
  console.log(`Fetched from provider: ${result.fetchedCount}`)
  console.log(`Inserted: ${result.insertedCount}`)
  console.log(`Skipped (duplicate): ${result.skippedDuplicateCount}`)
  console.log(`Errors: ${result.errorCount}`)

  if (result.errors.length > 0) {
    console.log("\nErrors:")
    for (const err of result.errors) {
      console.log(`  - ${err}`)
    }
  }

  if (result.invoiceIds.length > 0) {
    console.log("\nCreated invoice IDs:")
    for (const id of result.invoiceIds) {
      console.log(`  - ${id}`)
    }
  }

  // Final counts
  const finalCounts = await db.eInvoice.groupBy({
    by: ["direction"],
    where: { companyId },
    _count: { id: true },
  })
  console.log("\nFinal invoice counts:")
  for (const row of finalCounts) {
    console.log(`  ${row.direction}: ${row._count.id}`)
  }

  // Verification SQL
  console.log("\n=== VERIFICATION SQL ===")
  console.log(
    `SELECT id, "invoiceNumber", direction, status, "providerRef", "providerStatus", "createdAt"`
  )
  console.log(`FROM "EInvoice" WHERE "companyId" = '${companyId}' AND direction = 'INBOUND'`)
  console.log(`ORDER BY "createdAt" DESC LIMIT 10;`)

  // Exit with appropriate code
  if (!result.success && result.errorCount > 0) {
    console.log("\n[FAIL] Some errors occurred")
    process.exit(1)
  }

  console.log("\n[SUCCESS] Poll completed")
}

main()
  .catch((error) => {
    console.error("\n[FATAL]:", error instanceof Error ? error.message : error)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
