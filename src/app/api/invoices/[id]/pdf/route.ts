import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser, getCurrentCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { updateContext, runWithContext } from "@/lib/context"
import { setTenantContext } from "@/lib/prisma-extensions"
import { renderToBuffer } from "@react-pdf/renderer"
import { InvoicePDFDocument } from "@/lib/pdf/invoice-template"
import { logger } from "@/lib/logger"
import { generateInvoiceBarcodeDataUrl } from "@/lib/barcode"
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

        // Fetch invoice with all related data
        const invoice = await db.eInvoice.findFirst({
          where: {
            id,
            companyId: company.id, // Validate ownership
          },
          include: {
            buyer: true,
            seller: true,
            lines: {
              orderBy: { lineNumber: "asc" },
            },
          },
        })

        if (!invoice) {
          return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
        }

        // Use company as seller if seller contact is not set
        const sellerData = invoice.seller || {
          name: company.name,
          oib: company.oib,
          address: company.address,
          city: company.city,
          postalCode: company.postalCode,
          country: company.country,
          email: company.email,
          phone: company.phone,
        }

        const bankAccount = invoice.bankAccount || company.iban || undefined

        // Prepare data for PDF template
        const pdfData = {
          invoice: {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            issueDate: invoice.issueDate,
            dueDate: invoice.dueDate,
            currency: invoice.currency,
            netAmount: Number(invoice.netAmount),
            vatAmount: Number(invoice.vatAmount),
            totalAmount: Number(invoice.totalAmount),
            notes: invoice.notes,
            jir: invoice.jir,
            zki: invoice.zki,
            type: invoice.type,
            status: invoice.status,
            includeBarcode: invoice.includeBarcode ?? true,
          },
          seller: {
            name: sellerData.name,
            oib: sellerData.oib || company.oib,
            address: sellerData.address || company.address,
            city: sellerData.city || company.city,
            postalCode: sellerData.postalCode || company.postalCode,
            country: sellerData.country || company.country,
            email: sellerData.email || company.email,
            phone: sellerData.phone || company.phone,
            iban: company.iban, // Always use company IBAN
          },
          buyer: invoice.buyer
            ? {
                name: invoice.buyer.name,
                oib: invoice.buyer.oib,
                address: invoice.buyer.address,
                city: invoice.buyer.city,
                postalCode: invoice.buyer.postalCode,
                country: invoice.buyer.country,
              }
            : null,
          lines: invoice.lines.map((line) => ({
            lineNumber: line.lineNumber,
            description: line.description,
            quantity: Number(line.quantity),
            unit: line.unit,
            unitPrice: Number(line.unitPrice),
            netAmount: Number(line.netAmount),
            vatRate: Number(line.vatRate),
            vatAmount: Number(line.vatAmount),
          })),
          bankAccount,
        }

        let barcodeDataUrl: string | null = null
        if (pdfData.invoice.includeBarcode && bankAccount) {
          barcodeDataUrl = await generateInvoiceBarcodeDataUrl({
            creditorName: pdfData.seller.name,
            creditorIban: bankAccount,
            amount: pdfData.invoice.totalAmount,
            currency: pdfData.invoice.currency,
            invoiceNumber: pdfData.invoice.invoiceNumber,
            dueDate: pdfData.invoice.dueDate || undefined,
            reference: pdfData.invoice.invoiceNumber,
          })
        }

        // Generate PDF
        const doc = InvoicePDFDocument({ ...pdfData, barcodeDataUrl })
        const pdfBuffer = await renderToBuffer(doc)

        const durationMs = Date.now() - startedAt
        logger.info({ status: 200, durationMs, invoiceId: id }, "PDF generated successfully")

        // Return PDF with proper headers
        const response = new NextResponse(Buffer.from(pdfBuffer), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="racun-${invoice.invoiceNumber.replace(/\//g, "-")}.pdf"`,
            "x-request-id": requestId,
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
