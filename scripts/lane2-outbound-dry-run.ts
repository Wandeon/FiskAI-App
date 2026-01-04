#!/usr/bin/env npx tsx
/**
 * LANE 2 Outbound Dry-Run Script
 *
 * Tests B2B e-invoice pipeline (UBL + send) without real intermediary.
 * Creates test invoice, generates UBL, attempts send, records failure state.
 *
 * Usage:
 *   npx tsx scripts/lane2-outbound-dry-run.ts <companyId> [provider]
 *
 * Examples:
 *   npx tsx scripts/lane2-outbound-dry-run.ts test-doo-lane2
 *   npx tsx scripts/lane2-outbound-dry-run.ts test-doo-lane2 eposlovanje
 *
 * Environment variables:
 *   EPOSLOVANJE_API_KEY - API key for eposlovanje provider
 *   EPOSLOVANJE_API_BASE - API base URL (e.g., https://test.eposlovanje.hr)
 */

import { db } from "../src/lib/db"
import { Prisma } from "@prisma/client"
import { generateUBLInvoice, createEInvoiceProvider } from "../src/lib/e-invoice"
import {
  validateEN16931Compliance,
  validateB2BEInvoicePreflight,
} from "../src/lib/compliance/en16931-validator"

const Decimal = Prisma.Decimal

const companyId = process.argv[2] || "test-doo-lane2"
const providerOverride = process.argv[3] // Optional: override provider for testing

async function main() {
  console.log("\n=== LANE 2 OUTBOUND DRY-RUN ===")
  console.log(`Company ID: ${companyId}`)
  console.log(`Provider override: ${providerOverride || "(none - use company setting)"}`)
  console.log(`Timestamp: ${new Date().toISOString()}\n`)

  // Check environment
  console.log("Environment check:")
  console.log(`  EPOSLOVANJE_API_KEY: ${process.env.EPOSLOVANJE_API_KEY ? "[SET]" : "[NOT SET]"}`)
  console.log(`  EPOSLOVANJE_API_BASE: ${process.env.EPOSLOVANJE_API_BASE || "[NOT SET]"}`)
  console.log()

  // 1. Fetch company with contact for buyer
  const company = await db.company.findUnique({
    where: { id: companyId },
    include: {
      contacts: { take: 1 },
    },
  })

  if (!company) {
    console.error(`ERROR: Company not found: ${companyId}`)
    process.exit(1)
  }

  const isDoO = company.legalForm === "DOO" || company.name?.toLowerCase().includes("d.o.o")
  console.log(`Company: ${company.name}`)
  console.log(`Legal Form: ${company.legalForm}`)
  console.log(`Is D.O.O.: ${isDoO}`)
  console.log(`E-Invoice Provider: ${company.eInvoiceProvider || "(none)"}`)
  console.log(`Has API Key: ${!!company.eInvoiceApiKeyEncrypted}\n`)

  const results: Record<string, unknown> = {
    steps: {},
  }

  try {
    // 2. Create test B2B invoice
    const testInvoiceNumber = `E-DRY-RUN-${Date.now()}`
    const buyer = company.contacts[0]

    if (!buyer) {
      console.error("ERROR: No buyer contact found for company")
      process.exit(1)
    }

    console.log(`Creating test invoice ${testInvoiceNumber}...`)
    const invoice = await db.eInvoice.create({
      data: {
        companyId,
        direction: "OUTBOUND",
        invoiceNumber: testInvoiceNumber,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        currency: "EUR",
        netAmount: new Decimal("1000.00"),
        vatAmount: new Decimal("250.00"),
        totalAmount: new Decimal("1250.00"),
        status: "DRAFT",
        type: "E_INVOICE",
        paymentMethod: "TRANSFER", // B2B uses bank transfer
        buyerId: buyer.id,
        notes: "E-invoice LANE 2 dry-run test - B2B bank transfer - safe to delete",
        lines: {
          create: [
            {
              lineNumber: 1,
              description: "Konzultantske usluge za razvoj softvera",
              quantity: new Decimal("10"),
              unit: "HUR", // Hours
              unitPrice: new Decimal("100.00"),
              netAmount: new Decimal("1000.00"),
              vatRate: new Decimal("25.00"),
              vatCategory: "S",
              vatAmount: new Decimal("250.00"),
            },
          ],
        },
      },
      include: {
        company: true,
        buyer: true,
        lines: true,
      },
    })

    console.log(`[OK] Invoice created: ${invoice.id}`)
    results.steps = {
      ...(results.steps as object),
      invoiceCreated: {
        success: true,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        paymentMethod: invoice.paymentMethod,
        isB2B: invoice.paymentMethod === "TRANSFER",
      },
    }

    // 3. Generate UBL XML
    let ublXml: string | null = null
    let ublValid = false

    console.log("\nGenerating UBL XML...")
    try {
      ublXml = generateUBLInvoice({ ...invoice, seller: null })

      // Store UBL in invoice
      await db.eInvoice.update({
        where: { id: invoice.id },
        data: { ublXml },
      })

      console.log(`[OK] UBL generated and stored (${ublXml.length} bytes)`)
      results.steps = {
        ...(results.steps as object),
        ublGeneration: {
          success: true,
          ublLength: ublXml.length,
          stored: true,
        },
      }

      // 4. Validate EN16931 compliance
      console.log("\nValidating EN16931 compliance...")
      try {
        const complianceResult = validateEN16931Compliance({
          ...invoice,
          company,
          buyer: invoice.buyer,
          lines: invoice.lines,
        })

        ublValid = complianceResult.compliant

        if (complianceResult.compliant) {
          console.log("[OK] EN16931 compliance valid")
        } else {
          console.log(`[WARN] EN16931 validation errors: ${complianceResult.errors.join(", ")}`)
        }
        if (complianceResult.warnings.length > 0) {
          console.log(`[INFO] Warnings: ${complianceResult.warnings.join(", ")}`)
        }

        results.steps = {
          ...(results.steps as object),
          ublValidation: {
            success: complianceResult.compliant,
            valid: complianceResult.compliant,
            errors: complianceResult.errors,
            warnings: complianceResult.warnings,
          },
        }
      } catch (validationError) {
        console.log(
          `[ERROR] Validation failed: ${validationError instanceof Error ? validationError.message : "Unknown"}`
        )
        results.steps = {
          ...(results.steps as object),
          ublValidation: {
            success: false,
            error: validationError instanceof Error ? validationError.message : "Validation failed",
          },
        }
      }
    } catch (ublError) {
      console.log(
        `[ERROR] UBL generation failed: ${ublError instanceof Error ? ublError.message : "Unknown"}`
      )
      results.steps = {
        ...(results.steps as object),
        ublGeneration: {
          success: false,
          error: ublError instanceof Error ? ublError.message : "Unknown error",
        },
      }
    }

    // 5. B2B E-Invoice Preflight Validation
    console.log("\nRunning B2B e-invoice preflight validation...")
    const preflightResult = validateB2BEInvoicePreflight({
      ...invoice,
      company,
      buyer: invoice.buyer,
      lines: invoice.lines,
    })

    results.steps = {
      ...(results.steps as object),
      preflight: {
        success: preflightResult.valid,
        errors: preflightResult.errors,
        warnings: preflightResult.warnings,
      },
    }

    if (!preflightResult.valid) {
      console.log("[PREFLIGHT FAILED] Cannot send to provider:")
      preflightResult.errors.forEach((e) => {
        console.log(`  - [${e.btCode}] ${e.field}: ${e.message}`)
      })

      // Persist preflight failure to invoice
      await db.eInvoice.update({
        where: { id: invoice.id },
        data: {
          status: "ERROR",
          providerStatus: "PREFLIGHT_FAILED",
          providerError: `Preflight validation failed: ${preflightResult.errors.map((e) => `[${e.btCode}] ${e.message}`).join("; ")}`,
        },
      })

      console.log("\nInvoice status updated to: ERROR (PREFLIGHT_FAILED)")
      console.log("Provider was NOT called - fix master data first.")

      results.steps = {
        ...(results.steps as object),
        sendAttempt: {
          success: false,
          provider: providerOverride || company.eInvoiceProvider || "mock",
          status: "PREFLIGHT_FAILED",
          skipped: true,
          errorMessage: "Preflight validation failed - provider not called",
          invoiceStatusAfter: "ERROR",
        },
      }

      // Skip to summary
      const allSteps = results.steps as Record<string, { success: boolean }>
      const stepResults = Object.values(allSteps)
      const successCount = stepResults.filter((s) => s.success).length
      const totalSteps = stepResults.length

      console.log("\n=== SUMMARY ===")
      console.log(`Steps completed: ${successCount}/${totalSteps}`)
      console.log(`Invoice ID: ${invoice.id}`)
      console.log(`Preflight: FAILED`)
      console.log(`Provider called: NO`)

      console.log("\n=== FULL RESULTS (JSON) ===")
      console.log(
        JSON.stringify(
          {
            companyId,
            companyName: company.name,
            isDoO,
            timestamp: new Date().toISOString(),
            preflightFailed: true,
            ...results,
            summary: {
              success: false,
              stepsCompleted: `${successCount}/${totalSteps}`,
              invoiceId: invoice.id,
              preflightValid: false,
              providerCalled: false,
            },
          },
          null,
          2
        )
      )

      return
    }

    console.log("[OK] Preflight validation passed")
    if (preflightResult.warnings.length > 0) {
      console.log(`[INFO] Warnings: ${preflightResult.warnings.join(", ")}`)
    }

    // 6. Attempt to send via provider
    console.log("\nAttempting send via provider...")
    let sendResult: {
      success: boolean
      status: string
      errorCode?: string
      errorMessage?: string
      providerRef?: string
    }

    const providerName = providerOverride || company.eInvoiceProvider || "mock"
    console.log(`Provider: ${providerName}`)

    try {
      // Determine API key source based on provider
      // For eposlovanje/ie-racuni/fina: use EPOSLOVANJE_API_KEY from environment
      // For others: use company.eInvoiceApiKeyEncrypted
      let apiKey = ""
      if (["eposlovanje", "ie-racuni", "fina"].includes(providerName)) {
        apiKey = process.env.EPOSLOVANJE_API_KEY || ""
        console.log(`Using environment API key: ${apiKey ? "[SET]" : "[NOT SET]"}`)
      } else {
        apiKey = company.eInvoiceApiKeyEncrypted || ""
        console.log(`Using company API key: ${apiKey ? "[SET]" : "[NOT SET]"}`)
      }

      // Create provider - it will handle missing configuration gracefully
      const provider = createEInvoiceProvider(providerName, { apiKey })

      if (ublXml) {
        const result = await provider.sendInvoice({ ...invoice, seller: null }, ublXml)

        if (result.success) {
          sendResult = {
            success: true,
            status: "SENT",
            providerRef: result.providerRef,
          }
          console.log(`[OK] Sent! providerRef: ${result.providerRef}`)
        } else {
          // Parse the error to extract status
          const errorParts = result.error?.split(":") || []
          const status = errorParts[0] || "SEND_FAILED"
          sendResult = {
            success: false,
            status,
            errorCode: "PROVIDER_ERROR",
            errorMessage: result.error,
          }
          console.log(`[${status}] ${result.error}`)
        }
      } else {
        sendResult = {
          success: false,
          status: "UBL_NOT_GENERATED",
          errorCode: "NO_UBL",
          errorMessage: "Cannot send without UBL XML",
        }
        console.log(`[ERROR] ${sendResult.errorMessage}`)
      }
    } catch (sendError) {
      sendResult = {
        success: false,
        status: "SEND_EXCEPTION",
        errorCode: "EXCEPTION",
        errorMessage: sendError instanceof Error ? sendError.message : "Unknown error",
      }
      console.log(`[ERROR] ${sendResult.errorMessage}`)
    }

    // Update invoice with send result
    const finalStatus = sendResult.success ? "SENT" : "ERROR"
    await db.eInvoice.update({
      where: { id: invoice.id },
      data: {
        status: finalStatus,
        providerStatus: sendResult.status,
        providerError: sendResult.errorMessage,
        providerRef: sendResult.providerRef,
        sentAt: sendResult.success ? new Date() : null,
      },
    })

    console.log(`\nInvoice status updated to: ${finalStatus}`)

    results.steps = {
      ...(results.steps as object),
      sendAttempt: {
        success: sendResult.success,
        provider: providerName,
        status: sendResult.status,
        errorCode: sendResult.errorCode,
        errorMessage: sendResult.errorMessage,
        providerRef: sendResult.providerRef,
        invoiceStatusAfter: finalStatus,
      },
    }

    // 6. Summary
    const allSteps = results.steps as Record<string, { success: boolean }>
    const stepResults = Object.values(allSteps)
    const successCount = stepResults.filter((s) => s.success).length
    const totalSteps = stepResults.length

    console.log("\n=== SUMMARY ===")
    console.log(`Steps completed: ${successCount}/${totalSteps}`)
    console.log(`Invoice ID: ${invoice.id}`)
    console.log(`Invoice Number: ${invoice.invoiceNumber}`)
    console.log(`UBL stored: ${!!ublXml}`)
    console.log(`UBL valid: ${ublValid}`)
    console.log(
      `Provider configured: ${providerName === "mock" || !!company.eInvoiceApiKeyEncrypted}`
    )
    console.log(`Send status: ${sendResult.status}`)
    console.log(`Final invoice status: ${finalStatus}`)

    // Output JSON
    console.log("\n=== FULL RESULTS (JSON) ===")
    console.log(
      JSON.stringify(
        {
          companyId,
          companyName: company.name,
          isDoO,
          timestamp: new Date().toISOString(),
          provider: providerName,
          ...results,
          summary: {
            success: successCount === totalSteps,
            stepsCompleted: `${successCount}/${totalSteps}`,
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            ublStored: !!ublXml,
            ublValid,
            providerConfigured: providerName === "mock" || !!company.eInvoiceApiKeyEncrypted,
            sendStatus: sendResult.status,
            finalInvoiceStatus: finalStatus,
            provider: providerName,
          },
          verificationQueries: {
            lastInvoice: `SELECT id, "invoiceNumber", status, "providerStatus", "providerError", "providerRef", "ublXml" IS NOT NULL as ubl_stored, "createdAt" FROM "EInvoice" WHERE id = '${invoice.id}';`,
            invoiceCounts: `SELECT status, count(*) FROM "EInvoice" WHERE "companyId" = '${companyId}' GROUP BY status;`,
          },
        },
        null,
        2
      )
    )
  } catch (error) {
    console.error("\n[FATAL ERROR]:", error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())

// Make this a module to avoid duplicate function name conflicts
export {}
