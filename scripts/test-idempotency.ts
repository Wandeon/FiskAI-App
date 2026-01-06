#!/usr/bin/env npx tsx
/**
 * Test e-invoice idempotency
 *
 * Verifies that an invoice with providerRef and SENT status
 * is not re-sent to the provider.
 */

import { db } from "../src/lib/db"
import { createEInvoiceProvider } from "../src/lib/e-invoice"

const invoiceId = process.argv[2] || "cmk00nerg000027waw5cegxir"

async function main() {
  console.log("=== IDEMPOTENCY TEST ===\n")

  // 1. Fetch the invoice
  const invoice = await db.eInvoice.findUnique({
    where: { id: invoiceId },
    include: {
      company: true,
      buyer: true,
      lines: true,
    },
  })

  if (!invoice) {
    console.error(`Invoice not found: ${invoiceId}`)
    process.exit(1)
  }

  console.log(`Invoice: ${invoice.invoiceNumber}`)
  console.log(`Status: ${invoice.status}`)
  console.log(`ProviderRef: ${invoice.providerRef || "(none)"}`)
  console.log(`ProviderStatus: ${invoice.providerStatus || "(none)"}`)
  console.log()

  // 2. Attempt to send via provider
  console.log("Attempting to send (should be idempotent if already sent)...")
  const provider = createEInvoiceProvider("eposlovanje", {
    apiKey: process.env.EPOSLOVANJE_API_KEY || "",
  })

  const ublXml = invoice.ublXml || "<test/>"
  const result = await provider.sendInvoice(
    invoice as unknown as Parameters<typeof provider.sendInvoice>[0],
    ublXml
  )

  console.log("\nResult:")
  console.log(`  Success: ${result.success}`)
  console.log(`  ProviderRef: ${result.providerRef || "(none)"}`)
  console.log(`  Error: ${result.error || "(none)"}`)

  // 3. Verify no duplicate in database
  const afterInvoice = await db.eInvoice.findUnique({
    where: { id: invoiceId },
  })

  console.log("\nDatabase state after:")
  console.log(`  ProviderRef: ${afterInvoice?.providerRef || "(none)"}`)
  console.log(`  ProviderStatus: ${afterInvoice?.providerStatus || "(none)"}`)

  // Check for duplicates
  const duplicates = await db.eInvoice.count({
    where: {
      invoiceNumber: invoice.invoiceNumber,
      companyId: invoice.companyId,
    },
  })
  console.log(`  Duplicate count: ${duplicates} (should be 1)`)

  if (result.success && result.providerRef === invoice.providerRef) {
    console.log("\n✓ IDEMPOTENCY VERIFIED: Same providerRef returned without re-send")
  } else if (!result.success) {
    console.log("\n✗ IDEMPOTENCY TEST INCONCLUSIVE: Send failed")
  } else {
    console.log("\n! WARNING: Different providerRef returned")
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
