#!/usr/bin/env npx tsx
/**
 * CLI script for fiscal dry-run verification.
 *
 * Runs inside container or locally with DATABASE_URL set.
 * Does NOT require authentication - for admin/ops use only.
 *
 * Usage:
 *   DATABASE_URL="..." npx tsx scripts/fiscal-dry-run.ts <companyId> [--simulate]
 *
 * Modes:
 *   Default (Mode A): Respects fiscalEnabled flag
 *   --simulate (Mode B): Bypasses fiscalEnabled, creates FiscalRequest if no cert
 *
 * Or inside container:
 *   npx tsx scripts/fiscal-dry-run.ts cmjbtptms000001nzepg6azh6 --simulate
 */

import { PrismaClient, Prisma } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const Decimal = Prisma.Decimal

// Cast enum values for Prisma adapter compatibility
const OUTBOUND = "OUTBOUND" as const
const DRAFT = "DRAFT" as const
const E_INVOICE = "E_INVOICE" as const
const CASH = "CASH" as const

// Additional enum values for FiscalRequest
const RACUN = "RACUN" as const // Croatian for "invoice"
const FAILED = "FAILED" as const

async function main() {
  const args = process.argv.slice(2)
  const simulateEnabled = args.includes("--simulate")
  const companyId = args.find((a) => !a.startsWith("--"))

  if (!companyId) {
    console.error("Usage: npx tsx scripts/fiscal-dry-run.ts <companyId> [--simulate]")
    console.log("\nAvailable companies:")
    const companies = await prisma.company.findMany({
      select: { id: true, name: true, oib: true },
      take: 10,
    })
    companies.forEach((c) => console.log(`  ${c.id} - ${c.name} (${c.oib})`))
    process.exit(1)
  }

  console.log(`\n=== FISCAL DRY-RUN VERIFICATION ===`)
  console.log(`Company ID: ${companyId}`)
  console.log(`Mode: ${simulateEnabled ? "B (simulateEnabled)" : "A (normal)"}`)
  console.log(`Timestamp: ${new Date().toISOString()}\n`)

  // 1. Fetch company
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { contacts: { take: 1 } },
  })

  if (!company) {
    console.error(`ERROR: Company not found: ${companyId}`)
    process.exit(1)
  }

  console.log(`Company: ${company.name} (OIB: ${company.oib})`)
  console.log(`Fiscal enabled: ${company.fiscalEnabled}`)
  console.log(`Fiscal environment: ${company.fiscalEnvironment || "PROD"}\n`)

  const results: Record<string, unknown> = {}

  try {
    // 2. Create test invoice
    console.log(`STEP 1: Creating test invoice...`)
    const testInvoiceNumber = `DRY-RUN-${Date.now()}`
    const buyer = company.contacts[0]

    const invoice = await prisma.eInvoice.create({
      data: {
        companyId,
        direction: OUTBOUND,
        invoiceNumber: testInvoiceNumber,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        currency: "EUR",
        netAmount: new Decimal("100.00"),
        vatAmount: new Decimal("25.00"),
        totalAmount: new Decimal("125.00"),
        status: DRAFT,
        type: E_INVOICE,
        paymentMethod: CASH,
        buyerId: buyer?.id || null,
        notes: "Fiscal dry-run test invoice - safe to delete",
        lines: {
          create: [
            {
              lineNumber: 1,
              description: "Test service for fiscal dry-run",
              quantity: new Decimal("1"),
              unit: "PCE",
              unitPrice: new Decimal("100.00"),
              netAmount: new Decimal("100.00"),
              vatRate: new Decimal("25.00"),
              vatCategory: "S",
              vatAmount: new Decimal("25.00"),
            },
          ],
        },
      },
    })

    console.log(`  ✓ Invoice created: ${invoice.id}`)
    console.log(`  ✓ Invoice number: ${invoice.invoiceNumber}`)
    results.invoiceId = invoice.id
    results.invoiceNumber = invoice.invoiceNumber

    // 3. Check fiscalization decision
    console.log(`\nSTEP 2: Checking fiscalization requirements...`)

    const environment = company.fiscalEnvironment || "PROD"
    let fiscalStatus: string
    let fiscalRequestId: string | null = null

    if (!simulateEnabled) {
      // Mode A: Normal check (respects fiscalEnabled)
      const certificate = await prisma.fiscalCertificate.findFirst({
        where: {
          companyId,
          environment,
          status: "ACTIVE",
          certNotAfter: { gt: new Date() },
        },
      })

      if (!company.fiscalEnabled) {
        fiscalStatus = "SKIPPED_DISABLED"
        console.log(`  ⚠ Fiscalization disabled for company`)
      } else if (!certificate) {
        fiscalStatus = "BLOCKED_NO_CERT"
        console.log(`  ⚠ No certificate configured`)
      } else {
        fiscalStatus = "READY_WOULD_FISCALIZE"
        console.log(`  ✓ Would fiscalize with certificate: ${certificate.id}`)
      }
    } else {
      // Mode B: Bypass fiscalEnabled, test cert-missing path
      console.log(`  Mode B: Bypassing fiscalEnabled flag`)

      const certificate = await prisma.fiscalCertificate.findFirst({
        where: {
          companyId,
          environment,
          status: "ACTIVE",
          certNotAfter: { gt: new Date() },
        },
      })

      if (certificate) {
        fiscalStatus = "WOULD_FISCALIZE"
        console.log(`  ✓ Would fiscalize with certificate: ${certificate.id}`)
      } else {
        fiscalStatus = "FAILED_CERT_MISSING"
        console.log(`  ⚠ No active certificate found for environment: ${environment}`)
        console.log(`  Creating FiscalRequest with FAILED status...`)

        // Create FiscalRequest record
        const fiscalRequest = await prisma.fiscalRequest.create({
          data: {
            companyId,
            certificateId: null, // No certificate available
            invoiceId: invoice.id,
            messageType: RACUN,
            status: FAILED,
            attemptCount: 1,
            maxAttempts: 1, // No retry - cert must be uploaded first
            nextRetryAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            errorCode: "CERT_MISSING",
            errorMessage: `No active certificate configured for fiscal environment: ${environment}`,
          },
        })
        fiscalRequestId = fiscalRequest.id
        console.log(`  ✓ FiscalRequest created: ${fiscalRequest.id}`)
      }
    }

    results.fiscalStatus = fiscalStatus
    results.fiscalRequestId = fiscalRequestId

    // Update invoice with fiscal status
    await prisma.eInvoice.update({
      where: { id: invoice.id },
      data: { fiscalStatus },
    })

    // 4. Generate UBL XML (simulated - actual generation requires more context)
    console.log(`\nSTEP 3: UBL XML generation...`)
    const ublXml = `<?xml version="1.0"?><Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"><ID>${invoice.invoiceNumber}</ID><IssueDate>${invoice.issueDate.toISOString().split("T")[0]}</IssueDate><!-- Dry-run test --></Invoice>`

    await prisma.eInvoice.update({
      where: { id: invoice.id },
      data: { ublXml },
    })
    console.log(`  ✓ UBL XML stored (${ublXml.length} chars)`)
    results.ublLength = ublXml.length

    // 5. Create AppliedRuleSnapshot
    console.log(`\nSTEP 4: Creating AppliedRuleSnapshot...`)
    const snapshot = await prisma.appliedRuleSnapshot.create({
      data: {
        companyId,
        ruleVersionId: "dry-run-test-rule-v1",
        ruleTableKey: "fiscal-dry-run-test",
        version: "v1.0.0",
        effectiveFrom: new Date(),
        dataHash: Buffer.from(`${invoice.id}-${Date.now()}`).toString("base64").slice(0, 64),
        snapshotData: {
          testType: "fiscal-dry-run",
          invoiceId: invoice.id,
          timestamp: new Date().toISOString(),
        },
      },
    })
    console.log(`  ✓ Snapshot created: ${snapshot.id}`)
    results.snapshotId = snapshot.id

    // 6. Summary
    console.log(`\n=== DRY-RUN RESULTS ===`)
    console.log(`Mode:             ${simulateEnabled ? "B (simulateEnabled)" : "A (normal)"}`)
    console.log(`Invoice ID:       ${results.invoiceId}`)
    console.log(`Invoice Number:   ${results.invoiceNumber}`)
    console.log(`Fiscal Status:    ${results.fiscalStatus}`)
    console.log(`FiscalRequest ID: ${results.fiscalRequestId || "(none)"}`)
    console.log(`UBL Stored:       ${results.ublLength} chars`)
    console.log(`Snapshot ID:      ${results.snapshotId}`)

    // 7. SQL verification queries
    console.log(`\n=== SQL VERIFICATION ===`)
    console.log(`Run these queries to verify:\n`)
    console.log(`-- Last invoice:`)
    console.log(
      `SELECT id, "invoiceNumber", status, "fiscalStatus", "ublXml" IS NOT NULL as ubl_stored FROM "EInvoice" WHERE id = '${results.invoiceId}';`
    )
    console.log(`\n-- Last AppliedRuleSnapshot:`)
    console.log(
      `SELECT id, company_id, rule_table_key, created_at FROM applied_rule_snapshot WHERE id = '${results.snapshotId}';`
    )
    if (results.fiscalRequestId) {
      console.log(`\n-- FiscalRequest (Mode B created this):`)
      console.log(
        `SELECT id, status, "errorCode", "errorMessage", "certificateId" FROM "FiscalRequest" WHERE id = '${results.fiscalRequestId}';`
      )
    } else {
      console.log(`\n-- FiscalRequest (Mode A - should be empty):`)
      console.log(
        `SELECT id, status, "errorCode", "errorMessage" FROM "FiscalRequest" ORDER BY "createdAt" DESC LIMIT 1;`
      )
    }

    console.log(`\n=== DRY-RUN COMPLETE ===\n`)
  } catch (error) {
    console.error(`\nERROR:`, error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

void main()
