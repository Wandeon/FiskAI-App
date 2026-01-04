/**
 * Admin-only endpoint for pre-certificate fiscal dry-run verification.
 *
 * Purpose: Verify entire pipeline works up to external call boundaries
 * WITHOUT requiring actual FINA certificate or e-invoice intermediary.
 *
 * What it does:
 * 1. Creates a test invoice for specified company
 * 2. Attempts fiscalization - records FAILED_CERT_MISSING if no cert
 * 3. Generates UBL XML and stores it
 * 4. Generates PDF artifact
 * 5. Creates AppliedRuleSnapshot for audit trail
 *
 * Auth: Requires ADMIN systemRole
 * Rate limit: 1 request per minute per company
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { Prisma } from "@prisma/client"
import { generateUBLInvoice } from "@/lib/e-invoice/ubl-generator"
import { shouldFiscalizeInvoice } from "@/lib/fiscal/should-fiscalize"
import { generateInvoicePDF } from "@/lib/pdf/generate-invoice-pdf"
import { getOrCreateAppliedRuleSnapshot } from "@/lib/rules/applied-rule-snapshot-service"

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

  const results: Record<string, unknown> = {
    companyId,
    companyName: company.name,
    timestamp: new Date().toISOString(),
    steps: {},
  }

  try {
    // 5. Create test invoice
    const testInvoiceNumber = `DRY-RUN-${Date.now()}`
    const buyer = company.contacts[0]

    const invoice = await db.eInvoice.create({
      data: {
        companyId,
        direction: "OUTBOUND",
        invoiceNumber: testInvoiceNumber,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        currency: "EUR",
        netAmount: new Decimal("100.00"),
        vatAmount: new Decimal("25.00"),
        totalAmount: new Decimal("125.00"),
        status: "DRAFT",
        type: "E_INVOICE",
        paymentMethod: "CASH", // Requires fiscalization
        buyerId: buyer?.id,
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
      },
    }

    // 6. Attempt fiscalization check
    // Mode A: Normal check (respects fiscalEnabled)
    // Mode B: simulateEnabled=true (bypasses fiscalEnabled, tests cert-missing path)

    let fiscalRequestId: string | null = null
    let fiscalStatus: string

    if (!simulateEnabled) {
      // Mode A: Use normal fiscalization decision
      const fiscalDecision = await shouldFiscalizeInvoice({
        ...invoice,
        company,
      })

      if (!fiscalDecision.shouldFiscalize) {
        fiscalStatus = "SKIPPED_DISABLED"
        results.steps = {
          ...(results.steps as object),
          fiscalizationCheck: {
            mode: "A",
            success: true,
            shouldFiscalize: false,
            reason: fiscalDecision.reason,
            status: fiscalStatus,
          },
        }
        await db.eInvoice.update({
          where: { id: invoice.id },
          data: { fiscalStatus },
        })
      } else {
        fiscalStatus = "WOULD_FISCALIZE"
        results.steps = {
          ...(results.steps as object),
          fiscalizationCheck: {
            mode: "A",
            success: true,
            shouldFiscalize: true,
            reason: fiscalDecision.reason,
            certificateId: fiscalDecision.certificateId,
            environment: fiscalDecision.environment,
            status: fiscalStatus,
          },
        }
      }
    } else {
      // Mode B: Bypass fiscalEnabled, test cert-missing path
      // Look for active certificate regardless of fiscalEnabled
      const environment = company.fiscalEnvironment || "PROD"
      const certificate = await db.fiscalCertificate.findFirst({
        where: {
          companyId,
          environment,
          status: "ACTIVE",
          certNotAfter: { gt: new Date() },
        },
      })

      if (certificate) {
        // Certificate exists - would fiscalize
        fiscalStatus = "WOULD_FISCALIZE"
        results.steps = {
          ...(results.steps as object),
          fiscalizationCheck: {
            mode: "B",
            success: true,
            shouldFiscalize: true,
            certificateId: certificate.id,
            environment,
            status: fiscalStatus,
            note: "simulateEnabled=true, valid certificate found",
          },
        }
      } else {
        // No certificate - create FiscalRequest with FAILED status
        fiscalStatus = "FAILED_CERT_MISSING"

        // Create FiscalRequest record (now possible with optional certificateId)
        const fiscalRequest = await db.fiscalRequest.create({
          data: {
            companyId,
            certificateId: null, // No certificate available
            invoiceId: invoice.id,
            messageType: "RACUN",
            status: "FAILED",
            attemptCount: 1,
            maxAttempts: 1, // No retry - cert must be uploaded first
            nextRetryAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Far future - no retry
            errorCode: "CERT_MISSING",
            errorMessage: "No active certificate configured for fiscal environment: " + environment,
          },
        })
        fiscalRequestId = fiscalRequest.id

        // Update invoice with fiscal status
        await db.eInvoice.update({
          where: { id: invoice.id },
          data: { fiscalStatus },
        })

        results.steps = {
          ...(results.steps as object),
          fiscalizationCheck: {
            mode: "B",
            success: false,
            shouldFiscalize: true,
            certificateFound: false,
            environment,
            status: fiscalStatus,
            fiscalRequestId,
            errorCode: "CERT_MISSING",
            note: "simulateEnabled=true, FiscalRequest created with FAILED status",
          },
        }
      }
    }

    // 7. Generate UBL XML
    let ublXml: string | null = null
    try {
      // Refetch with relations for UBL generation
      const invoiceForUbl = await db.eInvoice.findUnique({
        where: { id: invoice.id },
        include: {
          company: true,
          buyer: true,
          seller: true,
          lines: { orderBy: { lineNumber: "asc" } },
        },
      })

      if (invoiceForUbl && invoiceForUbl.buyer) {
        ublXml = generateUBLInvoice(invoiceForUbl)

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
          },
        }
      } else {
        results.steps = {
          ...(results.steps as object),
          ublGeneration: {
            success: false,
            error: "Buyer required for UBL generation",
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

    // 8. Generate PDF
    let pdfGenerated = false
    try {
      const pdfResult = await generateInvoicePDF({
        invoiceId: invoice.id,
        companyId,
      })
      pdfGenerated = pdfResult.buffer.length > 0

      results.steps = {
        ...(results.steps as object),
        pdfGeneration: {
          success: true,
          pdfSize: pdfResult.buffer.length,
          invoiceNumber: pdfResult.invoiceNumber,
        },
      }
    } catch (pdfError) {
      results.steps = {
        ...(results.steps as object),
        pdfGeneration: {
          success: false,
          error: pdfError instanceof Error ? pdfError.message : "Unknown error",
        },
      }
    }

    // 9. Create AppliedRuleSnapshot (for testing the table works)
    let snapshotId: string | null = null
    try {
      const snapshotResult = await getOrCreateAppliedRuleSnapshot({
        companyId,
        ruleVersionId: "dry-run-test-rule-v1",
        ruleTableKey: "fiscal-dry-run-test",
        version: "v1.0.0",
        effectiveFrom: new Date(),
        snapshotData: {
          testType: "fiscal-dry-run",
          invoiceId: invoice.id,
          timestamp: new Date().toISOString(),
        },
      })
      snapshotId = snapshotResult.id

      results.steps = {
        ...(results.steps as object),
        appliedRuleSnapshot: {
          success: true,
          snapshotId,
          created: snapshotResult.created,
        },
      }
    } catch (snapshotError) {
      results.steps = {
        ...(results.steps as object),
        appliedRuleSnapshot: {
          success: false,
          error: snapshotError instanceof Error ? snapshotError.message : "Unknown error",
        },
      }
    }

    // 10. Summary
    const allSteps = results.steps as Record<string, { success: boolean }>
    const stepResults = Object.values(allSteps)
    const successCount = stepResults.filter((s) => s.success).length
    const totalSteps = stepResults.length

    results.summary = {
      success: successCount === totalSteps,
      stepsCompleted: `${successCount}/${totalSteps}`,
      invoiceId: invoice.id,
      fiscalRequestId,
      snapshotId,
      fiscalStatus,
      ublStored: !!ublXml,
      pdfGenerated,
      mode: simulateEnabled ? "B" : "A",
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
    endpoint: "/api/admin/fiscal-dry-run",
    method: "POST",
    auth: "ADMIN role required",
    rateLimit: "1 request per minute per company",
    purpose: "Verify fiscal pipeline without certificate",
    body: {
      companyId: "string (required)",
      simulateEnabled:
        "boolean (optional, default false) - Mode B: bypass fiscalEnabled, test cert-missing path",
    },
    modes: {
      A: "Normal mode (simulateEnabled=false): Respects fiscalEnabled flag. Returns SKIPPED_DISABLED if fiscal disabled.",
      B: "Simulate mode (simulateEnabled=true): Bypasses fiscalEnabled. Creates FiscalRequest with FAILED status if no cert.",
    },
  })
}
