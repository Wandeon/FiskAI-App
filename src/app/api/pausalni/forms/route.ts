import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { drizzleDb } from "@/lib/db/drizzle"
import { generatedForm, pausalniProfile } from "@/lib/db/schema/pausalni"
import { eq, and, desc } from "drizzle-orm"
import { withApiLogging } from "@/lib/api-logging"
import { setTenantContext } from "@/lib/prisma-extensions"
import {
  parseQuery,
  parseBody,
  isValidationError,
  formatValidationError,
} from "@/lib/api/validation"
import { formsQuerySchema, formGenerateBodySchema } from "@/app/api/pausalni/_schemas"
import { generatePdvFormForPeriod, validatePdvFormData } from "@/lib/pausalni/forms/pdv-generator"
import {
  generatePdvSFormForPeriod,
  validatePdvSFormData,
} from "@/lib/pausalni/forms/pdv-s-generator"
import {
  generateZpXml,
  validateZpFormData,
  type ZpFormData,
} from "@/lib/pausalni/forms/zp-generator"
import { createHash } from "crypto"

/**
 * GET /api/pausalni/forms
 * List generated forms history for company
 *
 * Query params:
 * - formType: PDV | PDV_S | ZP (optional)
 * - year: number (optional)
 * - limit: number (default 50)
 */
export const GET = withApiLogging(async (request: NextRequest) => {
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

    // Parse and validate query params
    const { formType, year, limit } = parseQuery(request.nextUrl.searchParams, formsQuerySchema)

    // Build query conditions
    const conditions = [eq(generatedForm.companyId, company.id)]

    if (formType) {
      conditions.push(eq(generatedForm.formType, formType))
    }

    if (year) {
      conditions.push(eq(generatedForm.periodYear, year))
    }

    const forms = await drizzleDb
      .select()
      .from(generatedForm)
      .where(and(...conditions))
      .orderBy(desc(generatedForm.createdAt))
      .limit(limit)

    return NextResponse.json({ forms })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Error fetching forms:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
})

/**
 * POST /api/pausalni/forms
 * Generate a new form (PDV, PDV-S, or ZP) for a period
 *
 * Body:
 * {
 *   formType: "PDV" | "PDV_S" | "ZP"
 *   periodMonth: number (1-12, required for PDV and PDV_S)
 *   periodYear: number (required)
 *   zpFormData?: ZpFormData (required only for ZP forms)
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
    const { formType, periodMonth, periodYear, zpFormData } = await parseBody(
      request,
      formGenerateBodySchema
    )

    // Check if company has PDV-ID registered (required for all forms)
    const [profile] = await drizzleDb
      .select()
      .from(pausalniProfile)
      .where(eq(pausalniProfile.companyId, company.id))
      .limit(1)

    if (!profile?.hasPdvId || !profile.pdvId) {
      return NextResponse.json(
        {
          error:
            "Company does not have PDV-ID registered. Please update your pausalni profile first.",
        },
        { status: 400 }
      )
    }

    let xml: string
    let formData: any
    let validationErrors: string[] = []

    // Generate form based on type
    switch (formType) {
      case "PDV": {
        const result = await generatePdvFormForPeriod(
          company.id,
          company.oib,
          company.name,
          periodMonth!,
          periodYear
        )
        xml = result.xml
        formData = result.data

        // Validate
        const validation = validatePdvFormData(formData)
        if (!validation.valid) {
          validationErrors = validation.errors
        }
        break
      }

      case "PDV_S": {
        const result = await generatePdvSFormForPeriod(
          company.id,
          company.oib,
          company.name,
          periodMonth!,
          periodYear
        )
        xml = result.xml
        formData = result.data

        // Validate
        const validation = validatePdvSFormData(formData)
        if (!validation.valid) {
          validationErrors = validation.errors
        }
        break
      }

      case "ZP": {
        if (!zpFormData) {
          return NextResponse.json(
            { error: "zpFormData is required for ZP forms" },
            { status: 400 }
          )
        }

        // Validate ZP form data
        const zpData = zpFormData as unknown as ZpFormData
        validationErrors = validateZpFormData(zpData)
        if (validationErrors.length > 0) {
          return NextResponse.json(
            { error: "Validation failed", errors: validationErrors },
            { status: 400 }
          )
        }

        xml = generateZpXml(zpData)
        formData = zpFormData
        break
      }

      default:
        return NextResponse.json({ error: "Invalid formType" }, { status: 400 })
    }

    // Return validation errors if any
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: "Validation failed", errors: validationErrors },
        { status: 400 }
      )
    }

    // Calculate file hash
    const fileHash = createHash("sha256").update(xml).digest("hex")

    // Store generated form in database
    const [savedForm] = await drizzleDb
      .insert(generatedForm)
      .values({
        companyId: company.id,
        formType,
        periodMonth: periodMonth || null,
        periodYear,
        format: "XML",
        fileHash,
        formData: formData as any,
        submittedToPorezna: false,
      })
      .returning()

    return NextResponse.json({
      success: true,
      form: savedForm,
      message: `${formType} form generated successfully`,
    })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Error generating form:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
})
