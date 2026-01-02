// src/app/api/sandbox/e-invoice/route.ts
// Sandbox testing endpoint for e-invoicing

import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import type { Company } from "@prisma/client"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { getFiscalProvider, testFiscalProvider } from "@/lib/e-invoice/fiscal-provider"
import { FiscalConfig } from "@/lib/e-invoice/fiscal-types"
import { validateCroatianCompliance, type EN16931Invoice } from "@/lib/compliance/en16931-validator"
import { logger } from "@/lib/logger"
import { oibSchema } from "@/lib/validations/oib"

interface InvoiceData {
  invoiceNumber: string
  netAmount: number
  vatAmount: number
  totalAmount: number
  issueDate: string
  buyerName: string
  buyerOib: string
  sellerOib: string
}

const sandboxTestSchema = z.object({
  type: z.enum(["connection", "invoice", "status", "cancel"]),
  invoiceData: z
    .object({
      invoiceNumber: z.string().min(1).max(50),
      netAmount: z.number().positive(),
      vatAmount: z.number().nonnegative(),
      totalAmount: z.number().positive(),
      issueDate: z.string().datetime(),
      buyerName: z.string().min(1).max(200),
      buyerOib: oibSchema,
      sellerOib: oibSchema,
    })
    .optional(),
  jir: z.string().optional(), // For status/cancel tests
})

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    const body = await request.json()
    const parsed = sandboxTestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { type, invoiceData, jir } = parsed.data

    logger.info(
      {
        userId: user.id,
        companyId: company.id,
        testType: type,
        operation: "sandbox_test_started",
      },
      `Sandbox test started: ${type}`
    )

    switch (type) {
      case "connection":
        return await testConnection(company)

      case "invoice":
        if (!invoiceData) {
          return NextResponse.json(
            { error: "Invoice data is required for invoice test" },
            { status: 400 }
          )
        }
        return await testInvoice(company, invoiceData)

      case "status":
        if (!jir) {
          return NextResponse.json({ error: "JIR is required for status test" }, { status: 400 })
        }
        return await testStatus(company, jir)

      case "cancel":
        if (!jir) {
          return NextResponse.json({ error: "JIR is required for cancel test" }, { status: 400 })
        }
        return await testCancel(company, jir)

      default:
        return NextResponse.json({ error: "Invalid test type" }, { status: 400 })
    }
  } catch (error) {
    logger.error({ error }, "Sandbox test failed")

    return NextResponse.json({ error: "Sandbox test failed" }, { status: 500 })
  }
}

// Test fiscal provider connection
async function testConnection(company: Company) {
  try {
    const config = {
      provider: "mock", // Always use mock for sandbox
    } as Partial<FiscalConfig>

    const result = await testFiscalProvider(config)

    logger.info(
      {
        companyId: company.id,
        provider: result.provider,
        connected: result.success,
        operation: "connection_test",
      },
      `Connection test completed: ${result.success ? "PASSED" : "FAILED"}`
    )

    return NextResponse.json({
      success: true,
      testType: "connection",
      result,
      message: result.success ? "Connection test passed" : "Connection test failed",
    })
  } catch (error) {
    logger.error({ error }, "Connection test failed")
    return NextResponse.json({
      success: false,
      testType: "connection",
      result: { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      message: "Connection test failed",
    })
  }
}

// Test invoice creation and fiscalization
async function testInvoice(company: Company, invoiceData: InvoiceData) {
  try {
    // Validate using Croatian compliance rules
    // We'll create a temporary invoice object for validation
    const tempInvoice = {
      id: "temp_id",
      invoiceNumber: invoiceData.invoiceNumber,
      issueDate: new Date(invoiceData.issueDate),
      netAmount: invoiceData.netAmount,
      vatAmount: invoiceData.vatAmount,
      totalAmount: invoiceData.totalAmount,
      direction: "OUTBOUND",
      status: "PENDING_FISCALIZATION",
      company: {
        oib: invoiceData.sellerOib,
        name: company.name,
        address: company.address,
        city: company.city,
        postalCode: company.postalCode,
        country: company.country,
      },
      lines: [
        {
          description: "Test item",
          quantity: 1,
          unitPrice: invoiceData.netAmount,
          netAmount: invoiceData.netAmount,
          vatRate: (invoiceData.vatAmount / invoiceData.netAmount) * 100,
          vatAmount: invoiceData.vatAmount,
        },
      ],
      buyer: {
        name: invoiceData.buyerName,
        oib: invoiceData.buyerOib,
      },
      // Add other required fields with default values
    } as unknown as EN16931Invoice

    // Validate compliance
    const complianceResult = validateCroatianCompliance(tempInvoice)

    if (!complianceResult.compliant) {
      logger.warn(
        {
          companyId: company.id,
          invoiceNumber: invoiceData.invoiceNumber,
          complianceErrors: complianceResult.errors,
          operation: "compliance_validation",
        },
        "Invoice doesn't meet compliance requirements"
      )

      return NextResponse.json({
        success: false,
        testType: "invoice",
        result: {
          compliant: false,
          errors: complianceResult.errors,
          warnings: complianceResult.warnings,
        },
        message: `Invoice validation failed with ${complianceResult.errors.length} errors`,
      })
    }

    // Test fiscalization with mock provider
    const fiscalProvider = getFiscalProvider({ provider: "mock" })

    // Create a fiscal invoice that matches the interface
    const fiscalInvoice = {
      invoiceNumber: invoiceData.invoiceNumber,
      zki: "TESTZKI1234567890123456789012", // Mock ZKI
      dateTime: new Date(invoiceData.issueDate),
      company: {
        oib: invoiceData.sellerOib,
        name: company.name,
        address: company.address || "",
        city: company.city || "",
        postalCode: company.postalCode || "",
        country: company.country || "HR",
      },
      premisesCode: "1", // Default test premises
      deviceCode: "1", // Default test device
      items: [
        {
          description: "Test item",
          quantity: 1,
          unitPrice: Number(invoiceData.netAmount),
          vatRate: Number((invoiceData.vatAmount / invoiceData.netAmount) * 100),
          total: Number(invoiceData.totalAmount),
        },
      ],
      totals: {
        net: Number(invoiceData.netAmount),
        vat25: Number(invoiceData.vatAmount), // Assuming 25% VAT for test
        vat13: 0,
        vat5: 0,
        vat0: 0,
        total: Number(invoiceData.totalAmount),
      },
      paymentMethod: "T" as const, // Bank transfer
    }

    const result = await fiscalProvider.send(fiscalInvoice)

    logger.info(
      {
        companyId: company.id,
        invoiceNumber: invoiceData.invoiceNumber,
        fiscalizationSuccess: result.success,
        jir: result.success ? result.jir : undefined,
        operation: "invoice_test",
      },
      `Invoice test completed: ${result.success ? "SUCCESS" : "FAILED"}`
    )

    return NextResponse.json({
      success: true,
      testType: "invoice",
      result: {
        compliant: true,
        fiscalization: result,
      },
      message: result.success ? "Invoice test passed" : "Invoice test failed",
    })
  } catch (error) {
    logger.error({ error }, "Invoice test failed")
    return NextResponse.json({
      success: false,
      testType: "invoice",
      result: { compliant: false, error: error instanceof Error ? error.message : "Unknown error" },
      message: "Invoice test failed",
    })
  }
}

// Test status check
async function testStatus(company: Company, jir: string) {
  try {
    const fiscalProvider = getFiscalProvider({ provider: "mock" })
    const result = await fiscalProvider.getStatus(jir)

    logger.info(
      {
        companyId: company.id,
        jir,
        status: result.status,
        operation: "status_test",
      },
      `Status test completed for JIR: ${jir}`
    )

    return NextResponse.json({
      success: true,
      testType: "status",
      result,
      message: `Status check completed for JIR: ${jir}`,
    })
  } catch (error) {
    logger.error({ error, jir }, "Status test failed")
    return NextResponse.json({
      success: false,
      testType: "status",
      result: { status: "ERROR", error: error instanceof Error ? error.message : "Unknown error" },
      message: `Status test failed for JIR: ${jir}`,
    })
  }
}

// Test cancellation
async function testCancel(company: Company, jir: string) {
  try {
    const fiscalProvider = getFiscalProvider({ provider: "mock" })
    const result = await fiscalProvider.cancel(jir)

    logger.info(
      {
        companyId: company.id,
        jir,
        cancelSuccess: result.success,
        operation: "cancel_test",
      },
      `Cancel test completed for JIR: ${jir}`
    )

    return NextResponse.json({
      success: result.success,
      testType: "cancel",
      result,
      message: result.success
        ? `Cancellation test passed for JIR: ${jir}`
        : `Cancellation test failed for JIR: ${jir}`,
    })
  } catch (error) {
    logger.error({ error, jir }, "Cancel test failed")
    return NextResponse.json({
      success: false,
      testType: "cancel",
      result: { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      message: `Cancel test failed for JIR: ${jir}`,
    })
  }
}
