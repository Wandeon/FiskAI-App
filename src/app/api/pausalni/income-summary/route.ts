import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser, getCurrentCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { parseQuery, isValidationError, formatValidationError } from "@/lib/api/validation"
import { incomeSummaryQuerySchema } from "@/app/api/pausalni/_schemas"

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const company = await getCurrentCompany(user.id!)
    if (!company) {
      return NextResponse.json({ error: "No company selected" }, { status: 400 })
    }

    // Parse and validate query params
    const url = new URL(request.url)
    const { year } = parseQuery(url.searchParams, incomeSummaryQuerySchema)

    // Get start and end dates for the year
    const startDate = new Date(year, 0, 1)
    const endDate = new Date(year, 11, 31, 23, 59, 59)

    // Get all invoices for the year (any status - user may not have fiscalized all)
    const invoices = await db.eInvoice.findMany({
      where: {
        companyId: company.id,
        issueDate: {
          gte: startDate,
          lte: endDate,
        },
        direction: "OUTBOUND",
      },
      select: {
        id: true,
        totalAmount: true,
        netAmount: true,
        vatAmount: true,
        issueDate: true,
        status: true,
      },
      orderBy: { issueDate: "asc" },
    })

    // Calculate totals
    const totalIncome = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0)

    // Calculate monthly breakdown
    const monthlyBreakdown: { month: number; income: number; count: number }[] = []
    for (let month = 0; month < 12; month++) {
      const monthInvoices = invoices.filter((inv) => {
        const invDate = new Date(inv.issueDate)
        return invDate.getMonth() === month
      })
      monthlyBreakdown.push({
        month: month + 1,
        income: monthInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0),
        count: monthInvoices.length,
      })
    }

    return NextResponse.json({
      year,
      totalIncome,
      invoiceCount: invoices.length,
      monthlyBreakdown,
      hasData: invoices.length > 0,
    })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Error fetching income summary:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
