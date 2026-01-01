import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { logStaffAccess, getRequestMetadata } from "@/lib/staff-audit"
import { parseQuery, isValidationError, formatValidationError } from "@/lib/api/validation"
import { multiClientReportQuerySchema } from "../_schemas"

function parseDate(value?: string) {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.systemRole !== "STAFF" && user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden - Staff access required" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const parsed = parseQuery(searchParams, multiClientReportQuerySchema)

    const fromDate = parseDate(parsed.from)
    const toDate = parseDate(parsed.to)

    // Get all assigned clients
    const assignments = await db.staffAssignment.findMany({
      where: { staffId: user.id },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            oib: true,
            entitlements: true,
          },
        },
      },
    })

    const companyIds = assignments.map((a) => a.company.id)

    if (companyIds.length === 0) {
      return NextResponse.json({
        reportType: parsed.reportType,
        totalClients: 0,
        clients: [],
      })
    }

    // Log staff access for all accessed companies
    const { ipAddress, userAgent } = getRequestMetadata(request.headers)
    for (const companyId of companyIds) {
      await logStaffAccess({
        staffUserId: user.id,
        clientCompanyId: companyId,
        action: "STAFF_VIEW_REPORTS",
        resourceType: "MultiClientReport",
        metadata: { reportType: parsed.reportType },
        ipAddress,
        userAgent,
      })
    }

    // Build report based on type
    switch (parsed.reportType) {
      case "overview":
        return await generateOverviewReport(companyIds, assignments, fromDate, toDate)

      case "kpr":
        return await generateKprReport(companyIds, assignments, fromDate, toDate)

      case "pending-review":
        return await generatePendingReviewReport(companyIds, assignments)

      case "deadlines":
        return await generateDeadlinesReport(companyIds, assignments)

      default:
        return NextResponse.json({ error: "Invalid report type" }, { status: 400 })
    }
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Multi-client report error:", error)
    return NextResponse.json(
      {
        error: "Report generation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

async function generateOverviewReport(
  companyIds: string[],
  assignments: Array<{ company: { id: string; name: string; oib: string; entitlements: unknown } }>,
  fromDate?: Date,
  toDate?: Date
) {
  const toDateInclusive = toDate
    ? (() => {
        const d = new Date(toDate)
        d.setHours(23, 59, 59, 999)
        return d
      })()
    : undefined

  const dateFilter =
    fromDate || toDateInclusive
      ? {
          gte: fromDate,
          lte: toDateInclusive,
        }
      : undefined

  const clientReports = await Promise.all(
    assignments.map(async (assignment) => {
      const [invoiceStats, expenseStats, ticketStats, pendingReview] = await Promise.all([
        // Invoice statistics
        db.eInvoice.aggregate({
          where: {
            companyId: assignment.company.id,
            ...(dateFilter ? { issueDate: dateFilter } : {}),
          },
          _sum: {
            netAmount: true,
            vatAmount: true,
            totalAmount: true,
          },
          _count: {
            id: true,
          },
        }),
        // Expense statistics
        db.expense.aggregate({
          where: {
            companyId: assignment.company.id,
            ...(dateFilter ? { date: dateFilter } : {}),
          },
          _sum: {
            netAmount: true,
            vatAmount: true,
            totalAmount: true,
          },
          _count: {
            id: true,
          },
        }),
        // Open tickets
        db.supportTicket.count({
          where: {
            companyId: assignment.company.id,
            status: { not: "CLOSED" },
          },
        }),
        // Pending review count
        (async () => {
          const [invoiceCount, expenseCount, reviewedCount] = await Promise.all([
            db.eInvoice.count({ where: { companyId: assignment.company.id } }),
            db.expense.count({ where: { companyId: assignment.company.id } }),
            db.staffReview.count({ where: { companyId: assignment.company.id } }),
          ])
          return invoiceCount + expenseCount - reviewedCount
        })(),
      ])

      return {
        id: assignment.company.id,
        name: assignment.company.name,
        oib: assignment.company.oib,
        invoices: {
          count: invoiceStats._count.id,
          totalNet: Number(invoiceStats._sum.netAmount || 0),
          totalVat: Number(invoiceStats._sum.vatAmount || 0),
          totalGross: Number(invoiceStats._sum.totalAmount || 0),
        },
        expenses: {
          count: expenseStats._count.id,
          totalNet: Number(expenseStats._sum.netAmount || 0),
          totalVat: Number(expenseStats._sum.vatAmount || 0),
          totalGross: Number(expenseStats._sum.totalAmount || 0),
        },
        openTickets: ticketStats,
        pendingReview,
        netProfit:
          Number(invoiceStats._sum.totalAmount || 0) - Number(expenseStats._sum.totalAmount || 0),
      }
    })
  )

  // Calculate totals
  const totals = clientReports.reduce(
    (acc, client) => ({
      invoiceCount: acc.invoiceCount + client.invoices.count,
      invoiceTotal: acc.invoiceTotal + client.invoices.totalGross,
      expenseCount: acc.expenseCount + client.expenses.count,
      expenseTotal: acc.expenseTotal + client.expenses.totalGross,
      netProfit: acc.netProfit + client.netProfit,
      openTickets: acc.openTickets + client.openTickets,
      pendingReview: acc.pendingReview + client.pendingReview,
    }),
    {
      invoiceCount: 0,
      invoiceTotal: 0,
      expenseCount: 0,
      expenseTotal: 0,
      netProfit: 0,
      openTickets: 0,
      pendingReview: 0,
    }
  )

  return NextResponse.json({
    reportType: "overview",
    totalClients: companyIds.length,
    period: {
      from: fromDate?.toISOString(),
      to: toDate?.toISOString(),
    },
    totals,
    clients: clientReports,
  })
}

async function generateKprReport(
  companyIds: string[],
  assignments: Array<{ company: { id: string; name: string; oib: string } }>,
  fromDate?: Date,
  toDate?: Date
) {
  const kprDateFilter =
    fromDate || toDate
      ? {
          gte: fromDate,
          lte: toDate
            ? (() => {
                const d = new Date(toDate)
                d.setHours(23, 59, 59, 999)
                return d
              })()
            : undefined,
        }
      : undefined

  const clientKprData = await Promise.all(
    assignments.map(async (assignment) => {
      const kprInvoices = await db.eInvoice.findMany({
        where: {
          companyId: assignment.company.id,
          paidAt: { not: null, ...(kprDateFilter || {}) },
        },
        include: {
          buyer: { select: { name: true } },
        },
        orderBy: { paidAt: "asc" },
      })

      const totalNet = kprInvoices.reduce((sum, inv) => sum + Number(inv.netAmount), 0)
      const totalVat = kprInvoices.reduce((sum, inv) => sum + Number(inv.vatAmount), 0)
      const totalGross = kprInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0)

      return {
        id: assignment.company.id,
        name: assignment.company.name,
        oib: assignment.company.oib,
        invoiceCount: kprInvoices.length,
        totalNet,
        totalVat,
        totalGross,
        invoices: kprInvoices.map((inv) => ({
          paidAt: inv.paidAt,
          issueDate: inv.issueDate,
          invoiceNumber: inv.invoiceNumber,
          buyerName: inv.buyer?.name || null,
          netAmount: Number(inv.netAmount),
          vatAmount: Number(inv.vatAmount),
          totalAmount: Number(inv.totalAmount),
        })),
      }
    })
  )

  const totals = clientKprData.reduce(
    (acc, client) => ({
      invoiceCount: acc.invoiceCount + client.invoiceCount,
      totalNet: acc.totalNet + client.totalNet,
      totalVat: acc.totalVat + client.totalVat,
      totalGross: acc.totalGross + client.totalGross,
    }),
    {
      invoiceCount: 0,
      totalNet: 0,
      totalVat: 0,
      totalGross: 0,
    }
  )

  return NextResponse.json({
    reportType: "kpr",
    totalClients: companyIds.length,
    period: {
      from: fromDate?.toISOString(),
      to: toDate?.toISOString(),
    },
    totals,
    clients: clientKprData,
  })
}

async function generatePendingReviewReport(
  companyIds: string[],
  assignments: Array<{ company: { id: string; name: string; oib: string } }>
) {
  const clientPendingData = await Promise.all(
    assignments.map(async (assignment) => {
      const [invoices, expenses, reviews] = await Promise.all([
        db.eInvoice.findMany({
          where: { companyId: assignment.company.id },
          select: {
            id: true,
            invoiceNumber: true,
            issueDate: true,
            totalAmount: true,
            status: true,
          },
          orderBy: { issueDate: "desc" },
        }),
        db.expense.findMany({
          where: { companyId: assignment.company.id },
          select: {
            id: true,
            description: true,
            date: true,
            totalAmount: true,
            status: true,
          },
          orderBy: { date: "desc" },
        }),
        db.staffReview.findMany({
          where: { companyId: assignment.company.id },
          select: {
            entityType: true,
            entityId: true,
          },
        }),
      ])

      const reviewedIds = new Set(reviews.map((r) => r.entityId))

      const pendingInvoices = invoices.filter((inv) => !reviewedIds.has(inv.id))
      const pendingExpenses = expenses.filter((exp) => !reviewedIds.has(exp.id))

      return {
        id: assignment.company.id,
        name: assignment.company.name,
        oib: assignment.company.oib,
        pendingCount: pendingInvoices.length + pendingExpenses.length,
        pendingInvoices: pendingInvoices.map((inv) => ({
          id: inv.id,
          type: "invoice" as const,
          number: inv.invoiceNumber,
          date: inv.issueDate,
          amount: Number(inv.totalAmount),
          status: inv.status,
        })),
        pendingExpenses: pendingExpenses.map((exp) => ({
          id: exp.id,
          type: "expense" as const,
          description: exp.description,
          date: exp.date,
          amount: Number(exp.totalAmount),
          status: exp.status,
        })),
      }
    })
  )

  const totalPending = clientPendingData.reduce((sum, client) => sum + client.pendingCount, 0)

  return NextResponse.json({
    reportType: "pending-review",
    totalClients: companyIds.length,
    totalPending,
    clients: clientPendingData,
  })
}

async function generateDeadlinesReport(
  companyIds: string[],
  assignments: Array<{ company: { id: string; name: string; oib: string } }>
) {
  const now = new Date()
  const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const clientDeadlineData = await Promise.all(
    assignments.map(async (assignment) => {
      const [upcomingInvoices, overdueInvoices] = await Promise.all([
        // Upcoming due invoices
        db.eInvoice.findMany({
          where: {
            companyId: assignment.company.id,
            dueDate: {
              gte: now,
              lte: next30Days,
            },
            paidAt: null,
          },
          select: {
            id: true,
            invoiceNumber: true,
            dueDate: true,
            totalAmount: true,
            status: true,
          },
          orderBy: { dueDate: "asc" },
        }),
        // Overdue invoices
        db.eInvoice.findMany({
          where: {
            companyId: assignment.company.id,
            dueDate: {
              lt: now,
            },
            paidAt: null,
          },
          select: {
            id: true,
            invoiceNumber: true,
            dueDate: true,
            totalAmount: true,
            status: true,
          },
          orderBy: { dueDate: "asc" },
        }),
      ])

      return {
        id: assignment.company.id,
        name: assignment.company.name,
        oib: assignment.company.oib,
        upcomingCount: upcomingInvoices.length,
        overdueCount: overdueInvoices.length,
        upcoming: upcomingInvoices.map((inv) => ({
          id: inv.id,
          number: inv.invoiceNumber,
          dueDate: inv.dueDate,
          amount: Number(inv.totalAmount),
          status: inv.status,
          daysUntilDue: inv.dueDate
            ? Math.floor((inv.dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
            : null,
        })),
        overdue: overdueInvoices.map((inv) => ({
          id: inv.id,
          number: inv.invoiceNumber,
          dueDate: inv.dueDate,
          amount: Number(inv.totalAmount),
          status: inv.status,
          daysOverdue: inv.dueDate
            ? Math.floor((now.getTime() - inv.dueDate.getTime()) / (24 * 60 * 60 * 1000))
            : null,
        })),
      }
    })
  )

  const totals = clientDeadlineData.reduce(
    (acc, client) => ({
      upcomingCount: acc.upcomingCount + client.upcomingCount,
      overdueCount: acc.overdueCount + client.overdueCount,
    }),
    {
      upcomingCount: 0,
      overdueCount: 0,
    }
  )

  return NextResponse.json({
    reportType: "deadlines",
    totalClients: companyIds.length,
    totals,
    clients: clientDeadlineData,
  })
}
