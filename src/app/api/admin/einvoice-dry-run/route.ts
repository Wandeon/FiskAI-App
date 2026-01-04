/**
 * Admin-only endpoint for B2B e-invoice LANE 2 dry-run verification.
 *
 * Purpose: Verify entire UBL generation + send pipeline works
 * WITHOUT requiring actual intermediary API key.
 *
 * What it does:
 * 1. Creates a test B2B invoice for specified d.o.o. company
 * 2. Generates UBL XML (PEPPOL BIS 3.0) and stores it
 * 3. Validates UBL
 * 4. Attempts to send via provider
 * 5. If no provider/API key configured, persists PROVIDER_NOT_CONFIGURED state
 *
 * Modes:
 *   simulateEnabled=false: Normal mode - uses company.eInvoiceProvider
 *   simulateEnabled=true: Force attempt to use "ie-racuni" provider
 *
 * Auth: Requires ADMIN systemRole
 * Rate limit: 1 request per minute per company
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { Prisma } from "@prisma/client"
import { generateUBLInvoice, createEInvoiceProvider } from "@/lib/e-invoice"
import { validateEN16931Compliance } from "@/lib/compliance/en16931-validator"

const Decimal = Prisma.Decimal

const requestSchema = z.object({
  companyId: z.string().min(1),
  simulateEnabled: z.boolean().optional().default(false),
})

// Simple in-memory rate limit (1 per minute per company)
const rateLimitMap = new Map<string, number>()
const RATE_LIMIT_MS = 60_000

export async function POST(request: NextRequest) {
  // 1. Auth check - require ADMIN
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { systemRole: true },
  })

  if (user?.systemRole !== "ADMIN") {
    return NextResponse.json({ error: "Requires ADMIN role" }, { status: 403 })
  }

  // 2. Parse and validate request
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  }

  const { companyId, simulateEnabled } = parsed.data

  // 3. Rate limit check
  const lastRun = rateLimitMap.get(companyId) || 0
  if (Date.now() - lastRun < RATE_LIMIT_MS) {
    return NextResponse.json(
      { error: "Rate limited. Wait 1 minute between dry-runs." },
      { status: 429 }
    )
  }
  rateLimitMap.set(companyId, Date.now())

  // 4. Fetch company with contact for buyer
  const company = await db.company.findUnique({
    where: { id: companyId },
    include: {
      contacts: { take: 1 },
    },
  })

  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 })
  }

  // Verify it's a d.o.o. (B2B capable)
  const isDoO = company.legalForm === "DOO" || company.name?.toLowerCase().includes("d.o.o")

  const results: Record<string, unknown> = {
    companyId,
    companyName: company.name,
    isDoO,
    timestamp: new Date().toISOString(),
    mode: simulateEnabled ? "B (simulateEnabled)" : "A (normal)",
    steps: {},
  }

  try {
    // 5. Create test B2B invoice
    const testInvoiceNumber = `E-DRY-RUN-${Date.now()}`
    const buyer = company.contacts[0]

    // For B2B, payment method should be TRANSFER (bank transfer)
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
        buyerId: buyer?.id,
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

    // 6. Generate UBL XML
    let ublXml: string | null = null
    let ublValid = false

    try {
      if (!invoice.buyer) {
        throw new Error("Buyer required for UBL generation")
      }

      ublXml = generateUBLInvoice({ ...invoice, seller: null })

      // Store UBL in invoice
      await db.eInvoice.update({
        where: { id: invoice.id },
        data: { ublXml },
      })

      results.steps = {
        ...(results.steps as object),
        ublGeneration: {
          success: true,
          ublLength: ublXml.length,
          stored: true,
          ublPreview: ublXml.substring(0, 500) + "...",
        },
      }

      // 7. Validate EN16931 compliance
      try {
        const complianceResult = validateEN16931Compliance({
          ...invoice,
          company,
          buyer: invoice.buyer,
          lines: invoice.lines,
        })

        ublValid = complianceResult.compliant

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
        results.steps = {
          ...(results.steps as object),
          ublValidation: {
            success: false,
            error: validationError instanceof Error ? validationError.message : "Validation failed",
          },
        }
      }
    } catch (ublError) {
      results.steps = {
        ...(results.steps as object),
        ublGeneration: {
          success: false,
          error: ublError instanceof Error ? ublError.message : "Unknown error",
        },
      }
    }

    // 8. Attempt to send via provider
    let sendResult: {
      success: boolean
      status: string
      errorCode?: string
      errorMessage?: string
      providerRef?: string
    }

    const providerName = simulateEnabled ? "ie-racuni" : company.eInvoiceProvider || "mock"

    try {
      // Check if API key is configured
      const apiKey = company.eInvoiceApiKeyEncrypted || ""

      if (!apiKey && providerName !== "mock") {
        // No API key configured - this is expected in dry-run
        sendResult = {
          success: false,
          status: "PROVIDER_NOT_CONFIGURED",
          errorCode: "NO_API_KEY",
          errorMessage: `No API key configured for provider: ${providerName}. Set eInvoiceApiKeyEncrypted on Company.`,
        }
      } else {
        // Try to create provider (this may throw for unimplemented providers)
        try {
          const provider = createEInvoiceProvider(providerName, { apiKey })

          if (ublXml) {
            const result = await provider.sendInvoice({ ...invoice, seller: null }, ublXml)

            if (result.success) {
              sendResult = {
                success: true,
                status: "SENT",
                providerRef: result.providerRef,
              }
            } else {
              sendResult = {
                success: false,
                status: "SEND_FAILED",
                errorCode: "PROVIDER_ERROR",
                errorMessage: result.error,
              }
            }
          } else {
            sendResult = {
              success: false,
              status: "UBL_NOT_GENERATED",
              errorCode: "NO_UBL",
              errorMessage: "Cannot send without UBL XML",
            }
          }
        } catch (providerError) {
          // Provider creation failed (e.g., "IE Računi provider not yet implemented")
          sendResult = {
            success: false,
            status: "PROVIDER_NOT_IMPLEMENTED",
            errorCode: "PROVIDER_ERROR",
            errorMessage: providerError instanceof Error ? providerError.message : "Provider error",
          }
        }
      }
    } catch (sendError) {
      sendResult = {
        success: false,
        status: "SEND_EXCEPTION",
        errorCode: "EXCEPTION",
        errorMessage: sendError instanceof Error ? sendError.message : "Unknown error",
      }
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

    // 9. Summary
    const allSteps = results.steps as Record<string, { success: boolean }>
    const stepResults = Object.values(allSteps)
    const successCount = stepResults.filter((s) => s.success).length
    const totalSteps = stepResults.length

    results.summary = {
      success: successCount === totalSteps,
      stepsCompleted: `${successCount}/${totalSteps}`,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      ublStored: !!ublXml,
      ublValid,
      providerConfigured: providerName === "mock" || !!company.eInvoiceApiKeyEncrypted,
      sendStatus: sendResult.status,
      finalInvoiceStatus: finalStatus,
      mode: simulateEnabled ? "B" : "A",
    }

    // 10. Verification SQL commands
    results.verificationQueries = {
      lastInvoice: `SELECT id, "invoiceNumber", status, "providerStatus", "providerError", "providerRef", "ublXml" IS NOT NULL as ubl_stored, "createdAt" FROM "EInvoice" WHERE id = '${invoice.id}';`,
      invoiceCounts: `SELECT status, count(*) FROM "EInvoice" WHERE "companyId" = '${companyId}' GROUP BY status;`,
    }

    return NextResponse.json(results)
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        results,
      },
      { status: 500 }
    )
  }
}

// GET method to check endpoint health
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/admin/einvoice-dry-run",
    method: "POST",
    auth: "ADMIN role required",
    rateLimit: "1 request per minute per company",
    purpose: "Verify B2B e-invoice LANE 2 pipeline (UBL + send)",
    body: {
      companyId: "string (required)",
      simulateEnabled: "boolean (optional, default false) - Force ie-racuni provider test",
    },
    modes: {
      A: "Normal mode (simulateEnabled=false): Uses company.eInvoiceProvider or mock",
      B: "Simulate mode (simulateEnabled=true): Forces ie-racuni provider to test error handling",
    },
  })
}
