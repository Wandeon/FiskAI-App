import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser, getCurrentCompany } from "@/lib/auth-utils"
import { updateContext, runWithContext } from "@/lib/context"
import { setTenantContext } from "@/lib/prisma-extensions"
import { logger } from "@/lib/logger"
import { generateInvoicePdfArtifact } from "@/lib/pdf/generate-invoice-pdf-artifact"
import { parseParams, isValidationError, formatValidationError } from "@/lib/api/validation"

const paramsSchema = z.object({
  id: z.string().min(1, "Invoice ID is required"),
})

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID()
  const startedAt = Date.now()

  return runWithContext(
    {
      requestId,
      path: request.nextUrl.pathname,
      method: request.method,
    },
    async () => {
      try {
        const user = await getCurrentUser()

        if (!user) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        updateContext({ userId: user.id! })

        const company = await getCurrentCompany(user.id!)
        if (!company) {
          return NextResponse.json({ error: "Company not found" }, { status: 404 })
        }

        updateContext({ companyId: company.id })
        setTenantContext({
          companyId: company.id,
          userId: user.id!,
        })

        const rawParams = await context.params
        const { id } = parseParams(rawParams, paramsSchema)

        const { artifact, buffer } = await generateInvoicePdfArtifact({
          companyId: company.id,
          invoiceId: id,
          createdById: user.id,
          reason: "invoice_pdf_api",
        })

        const durationMs = Date.now() - startedAt
        logger.info(
          {
            status: 200,
            durationMs,
            invoiceId: id,
            artifactId: artifact.id,
            checksum: artifact.checksum,
          },
          "PDF generated successfully"
        )

        // Return PDF with proper headers
        const response = new NextResponse(Buffer.from(buffer), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${artifact.fileName}"`,
            "x-request-id": requestId,
            "x-artifact-id": artifact.id,
            "x-artifact-checksum": artifact.checksum,
          },
        })

        return response
      } catch (error) {
        if (isValidationError(error)) {
          return NextResponse.json(formatValidationError(error), { status: 400 })
        }
        const durationMs = Date.now() - startedAt
        logger.error({ error, durationMs }, "PDF generation failed")
        throw error
      }
    }
  )
}
