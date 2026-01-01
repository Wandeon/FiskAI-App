import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { renderToBuffer } from "@react-pdf/renderer"
import { drizzleDb } from "@/lib/db/drizzle"
import { generatedForm } from "@/lib/db/schema/pausalni"
import { setTenantContext } from "@/lib/prisma-extensions"
import { withApiLogging } from "@/lib/api-logging"
import { createHash } from "crypto"
import { parseBody, isValidationError, formatValidationError } from "@/lib/api/validation"
import { posdGenerateBodySchema } from "@/app/api/pausalni/_schemas"
import {
  generatePosdFormForPeriod,
  validatePosdFormData,
  type ExpenseBracket,
} from "@/lib/pausalni/forms/posd-generator"
import { PosdPDFDocument } from "@/lib/pausalni/forms/posd-pdf-template"

/**
 * POST /api/pausalni/posd/generate
 * Generate PO-SD form (XML + PDF) for a year
 *
 * Body:
 * {
 *   year: number (required)
 *   expenseBracket: 25 | 30 | 34 | 40 | 85 (required)
 *   grossIncome?: number (optional, override calculated income)
 *   format: "pdf" | "xml" | "both" (default: "pdf")
 * }
 */
export const POST = withApiLogging(async (request: NextRequest) => {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    setTenantContext({
      companyId: company.id,
      userId: user.id!,
    })

    // Check if company is pausalni obrt
    if (company.legalForm !== "OBRT_PAUSAL") {
      return NextResponse.json({ error: "Not a pausalni obrt" }, { status: 400 })
    }

    // Parse and validate body
    const { year, expenseBracket, grossIncome, format } = await parseBody(
      request,
      posdGenerateBodySchema
    )

    // Generate form data
    const { xml, data } = await generatePosdFormForPeriod(
      company.id,
      year,
      expenseBracket as ExpenseBracket,
      grossIncome
    )

    // Validate form data
    const validation = validatePosdFormData(data)
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Validation failed", errors: validation.errors },
        { status: 400 }
      )
    }

    // Generate PDF if requested
    let pdfBuffer: Buffer | null = null
    if (format === "pdf" || format === "both") {
      const pdfDoc = PosdPDFDocument({ data })
      pdfBuffer = Buffer.from(await renderToBuffer(pdfDoc))
    }

    // Calculate file hash for storage
    const fileHash = createHash("sha256")
      .update(format === "xml" ? xml : pdfBuffer || xml)
      .digest("hex")

    // Store generated form in database
    const [savedForm] = await drizzleDb
      .insert(generatedForm)
      .values({
        companyId: company.id,
        formType: "PO-SD",
        periodMonth: null, // Annual form
        periodYear: year,
        format: format === "xml" ? "XML" : "PDF",
        fileHash,
        formData: data as any,
        submittedToPorezna: false,
      })
      .returning()

    // Return based on format
    if (format === "pdf") {
      return new NextResponse(pdfBuffer ? new Uint8Array(pdfBuffer) : null, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="PO-SD_${year}.pdf"`,
          "X-Form-Id": savedForm.id,
        },
      })
    }

    if (format === "xml") {
      return new NextResponse(xml, {
        status: 200,
        headers: {
          "Content-Type": "application/xml",
          "Content-Disposition": `attachment; filename="PO-SD_${year}.xml"`,
          "X-Form-Id": savedForm.id,
        },
      })
    }

    // format === "both" - return JSON with both
    return NextResponse.json({
      success: true,
      form: savedForm,
      data: {
        grossIncome: data.grossIncome,
        expenseBracket: data.expenseBracket,
        calculatedExpenses: data.calculatedExpenses,
        netIncome: data.netIncome,
        invoiceCount: data.invoiceCount,
      },
      xml,
      // PDF is base64 encoded for JSON response
      pdf: pdfBuffer?.toString("base64"),
    })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Error generating PO-SD form:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
})
