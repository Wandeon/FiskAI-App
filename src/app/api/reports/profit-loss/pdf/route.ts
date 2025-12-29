import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import { ProfitLossPdfDocument } from "@/lib/reports/profit-loss-pdf"
import { renderToBuffer } from "@react-pdf/renderer"

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    setTenantContext({ companyId: company.id, userId: user.id! })

    const { searchParams } = new URL(request.url)
    const fromParam = searchParams.get("from")
    const toParam = searchParams.get("to")

    const now = new Date()
    const defaultFrom = new Date(now.getFullYear(), 0, 1) // Start of year
    const defaultTo = now

    const dateFrom = fromParam ? new Date(fromParam) : defaultFrom
    const dateTo = toParam ? new Date(toParam) : defaultTo

    const [invoices, expenses] = await Promise.all([
      db.eInvoice.findMany({
        where: {
          companyId: company.id,
          issueDate: { gte: dateFrom, lte: dateTo },
          status: { not: "DRAFT" },
        },
        select: { netAmount: true },
      }),
      db.expense.findMany({
        where: {
          companyId: company.id,
          date: { gte: dateFrom, lte: dateTo },
          status: { in: ["PAID", "PENDING"] },
        },
        select: { netAmount: true },
      }),
    ])

    const revenue = invoices.reduce((sum, i) => sum + Number(i.netAmount), 0)
    const costs = expenses.reduce((sum, e) => sum + Number(e.netAmount), 0)
    const profit = revenue - costs

    // Generate PDF
    const pdfBuffer = await renderToBuffer(
      ProfitLossPdfDocument({
        companyName: company.name,
        companyOib: company.oib,
        dateFrom,
        dateTo,
        revenue,
        costs,
        profit,
        invoiceCount: invoices.length,
        expenseCount: expenses.length,
      })
    )

    const fileName = `dobit-gubitak-${company.oib}-${dateFrom.toISOString().slice(0, 10)}-${dateTo.toISOString().slice(0, 10)}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    console.error("Profit/Loss PDF export error:", error)
    return NextResponse.json({ error: "Neuspješan izvoz dobit/gubitak PDF-a" }, { status: 500 })
  }
}
