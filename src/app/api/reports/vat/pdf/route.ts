import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import { VatPdfDocument } from "@/lib/reports/vat-pdf"
import { renderToBuffer } from "@react-pdf/renderer"

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    setTenantContext({ companyId: company.id, userId: user.id! })

    const { searchParams } = new URL(request.url)
    const fromParam = searchParams.get("from")
    const toParam = searchParams.get("to")

    // Default to current quarter
    const now = new Date()
    const quarter = Math.floor(now.getMonth() / 3)
    const defaultFrom = new Date(now.getFullYear(), quarter * 3, 1)
    const defaultTo = new Date(now.getFullYear(), quarter * 3 + 3, 0)

    const dateFrom = fromParam ? new Date(fromParam) : defaultFrom
    const dateTo = toParam ? new Date(toParam) : defaultTo

    // Get invoices (output VAT)
    const invoices = await db.eInvoice.findMany({
      where: {
        companyId: company.id,
        issueDate: { gte: dateFrom, lte: dateTo },
        status: { not: "DRAFT" },
      },
      select: { netAmount: true, vatAmount: true, totalAmount: true },
    })

    // Get expenses (input VAT)
    const expenses = await db.expense.findMany({
      where: {
        companyId: company.id,
        date: { gte: dateFrom, lte: dateTo },
        status: { in: ["PAID", "PENDING"] },
      },
      select: { netAmount: true, vatAmount: true, totalAmount: true, vatDeductible: true },
    })

    // Calculate totals
    const outputVat = {
      net: invoices.reduce((sum, i) => sum + Number(i.netAmount), 0),
      vat: invoices.reduce((sum, i) => sum + Number(i.vatAmount), 0),
      total: invoices.reduce((sum, i) => sum + Number(i.totalAmount), 0),
    }

    const inputVat = {
      deductible: expenses
        .filter((e) => e.vatDeductible)
        .reduce((sum, e) => sum + Number(e.vatAmount), 0),
      nonDeductible: expenses
        .filter((e) => !e.vatDeductible)
        .reduce((sum, e) => sum + Number(e.vatAmount), 0),
      total: expenses.reduce((sum, e) => sum + Number(e.vatAmount), 0),
    }

    const vatPayable = outputVat.vat - inputVat.deductible

    // Generate PDF
    const pdfBuffer = await renderToBuffer(
      VatPdfDocument({
        companyName: company.name,
        companyOib: company.oib,
        dateFrom,
        dateTo,
        outputVat,
        inputVat,
        vatPayable,
      })
    )

    const fileName = `pdv-obrazac-${company.oib}-${dateFrom.toISOString().slice(0, 10)}-${dateTo.toISOString().slice(0, 10)}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    console.error("VAT PDF export error:", error)
    return NextResponse.json({ error: "Neuspješan PDV PDF izvoz" }, { status: 500 })
  }
}
