import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { drizzleDb } from "@/lib/db/drizzle"
import { generatedForm } from "@/lib/db/schema/pausalni"
import { eq, and } from "drizzle-orm"
import { withApiLogging } from "@/lib/api-logging"
import { setTenantContext } from "@/lib/prisma-extensions"
import { parseParams, isValidationError, formatValidationError } from "@/lib/api/validation"
import { idParamSchema } from "@/app/api/pausalni/_schemas"
import { generatePdvXml, type PdvFormData } from "@/lib/pausalni/forms/pdv-generator"
import { generatePdvSXml, type PdvSFormData } from "@/lib/pausalni/forms/pdv-s-generator"
import { generateZpXml, type ZpFormData } from "@/lib/pausalni/forms/zp-generator"

/**
 * GET /api/pausalni/forms/[id]/download
 * Download a generated form as XML file
 *
 * Returns the XML file with proper content-type headers for download
 */
export const GET = withApiLogging(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const user = await requireAuth()
      const company = await requireCompany(user.id!)

      // Parse and validate params
      const { id } = parseParams(await params, idParamSchema)

      setTenantContext({
        companyId: company.id,
        userId: user.id!,
      })

      // Check if company is pausalni obrt
      if (company.legalForm !== "OBRT_PAUSAL") {
        return NextResponse.json({ error: "Not a pausalni obrt" }, { status: 400 })
      }

      // Fetch the form from database
      const [form] = await drizzleDb
        .select()
        .from(generatedForm)
        .where(and(eq(generatedForm.id, id), eq(generatedForm.companyId, company.id)))
        .limit(1)

      if (!form) {
        return NextResponse.json({ error: "Form not found" }, { status: 404 })
      }

      // Regenerate XML from stored formData
      let xml: string
      let filename: string

      switch (form.formType) {
        case "PDV": {
          const formData = form.formData as PdvFormData
          xml = generatePdvXml(formData, {
            includeDeclaration: true,
            formattedOutput: true,
          })
          filename = `PDV_${formData.periodYear}_${String(formData.periodMonth).padStart(2, "0")}_${company.oib}.xml`
          break
        }

        case "PDV_S": {
          const formData = form.formData as PdvSFormData
          xml = generatePdvSXml(formData, {
            includeDeclaration: true,
            formattedOutput: true,
          })
          filename = `PDV-S_${formData.periodYear}_${String(formData.periodMonth).padStart(2, "0")}_${company.oib}.xml`
          break
        }

        case "ZP": {
          const formData = form.formData as ZpFormData
          xml = generateZpXml(formData)
          filename = `ZP_${formData.periodYear}_${formData.periodMonth ? String(formData.periodMonth).padStart(2, "0") : "XX"}_${company.oib}.xml`
          break
        }

        default:
          return NextResponse.json({ error: "Invalid form type" }, { status: 400 })
      }

      // Return XML with proper content-type headers
      return new NextResponse(xml, {
        status: 200,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      })
    } catch (error) {
      if (isValidationError(error)) {
        return NextResponse.json(formatValidationError(error), { status: 400 })
      }
      console.error("Error downloading form:", error)
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Internal server error" },
        { status: 500 }
      )
    }
  }
)
