import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import { AgingPdfDocument } from "@/lib/reports/aging-pdf"
import { renderToBuffer } from "@react-pdf/renderer"

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    setTenantContext({ companyId: company.id, userId: user.id! })

    const now = new Date()
    const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const day60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
    const day90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

    // Get unpaid invoices
    const unpaidInvoices = await db.eInvoice.findMany({
      where: {
        companyId: company.id,
        status: { in: ["SENT", "DELIVERED"] },
        dueDate: { not: null },
      },
      include: { buyer: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
    })

    const aging = {
      current: unpaidInvoices.filter((i) => i.dueDate && i.dueDate >= now),
      days30: unpaidInvoices.filter((i) => i.dueDate && i.dueDate < now && i.dueDate >= day30),
      days60: unpaidInvoices.filter((i) => i.dueDate && i.dueDate < day30 && i.dueDate >= day60),
      days90: unpaidInvoices.filter((i) => i.dueDate && i.dueDate < day60 && i.dueDate >= day90),
      over90: unpaidInvoices.filter((i) => i.dueDate && i.dueDate < day90),
    }

    const totals = {
      current: aging.current.reduce((sum, i) => sum + Number(i.totalAmount), 0),
      days30: aging.days30.reduce((sum, i) => sum + Number(i.totalAmount), 0),
      days60: aging.days60.reduce((sum, i) => sum + Number(i.totalAmount), 0),
      days90: aging.days90.reduce((sum, i) => sum + Number(i.totalAmount), 0),
      over90: aging.over90.reduce((sum, i) => sum + Number(i.totalAmount), 0),
    }

    // Generate PDF
    const pdfBuffer = await renderToBuffer(
      AgingPdfDocument({
        companyName: company.name,
        companyOib: company.oib,
        aging,
        totals,
      })
    )

    const fileName = `starost-potrazivanja-${company.oib}-${now.toISOString().slice(0, 10)}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    console.error("Aging PDF export error:", error)
    return NextResponse.json(
      { error: "Neuspješan izvoz starost potraživanja PDF-a" },
      { status: 500 }
    )
  }
}
