import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { drizzleDb } from "@/lib/db/drizzle"
import { paymentObligation, OBLIGATION_STATUS } from "@/lib/db/schema/pausalni"
import { eq, and, gte, lte, desc } from "drizzle-orm"
import { generateObligations, updateObligationStatuses } from "@/lib/pausalni/obligation-generator"
import { withApiLogging } from "@/lib/api-logging"
import { setTenantContext } from "@/lib/prisma-extensions"
import {
  parseQuery,
  parseBody,
  isValidationError,
  formatValidationError,
} from "@/lib/api/validation"
import { obligationsQuerySchema, obligationsGenerateBodySchema } from "@/app/api/pausalni/_schemas"

export const GET = withApiLogging(async (request: NextRequest) => {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    setTenantContext({
      companyId: company.id,
      userId: user.id!,
    })

    // Parse and validate query params
    const { status, year, month } = parseQuery(request.nextUrl.searchParams, obligationsQuerySchema)

    // Update statuses first
    await updateObligationStatuses(company.id)

    // Build query conditions
    const conditions = [eq(paymentObligation.companyId, company.id)]

    if (status) {
      conditions.push(eq(paymentObligation.status, status))
    }

    if (year) {
      const startDate = new Date(year, month ? month - 1 : 0, 1)
      const endDate = new Date(year, month ? month : 12, 0)
      conditions.push(gte(paymentObligation.dueDate, startDate.toISOString().split("T")[0]))
      conditions.push(lte(paymentObligation.dueDate, endDate.toISOString().split("T")[0]))
    }

    const obligations = await drizzleDb
      .select()
      .from(paymentObligation)
      .where(and(...conditions))
      .orderBy(desc(paymentObligation.dueDate))

    // Calculate summary
    const summary = {
      totalPending: 0,
      totalDueSoon: 0,
      totalOverdue: 0,
      totalPaid: 0,
      amountPending: 0,
      amountDueSoon: 0,
      amountOverdue: 0,
      amountPaid: 0,
    }

    for (const ob of obligations) {
      const amount = parseFloat(ob.amount)
      switch (ob.status) {
        case OBLIGATION_STATUS.PENDING:
          summary.totalPending++
          summary.amountPending += amount
          break
        case OBLIGATION_STATUS.DUE_SOON:
          summary.totalDueSoon++
          summary.amountDueSoon += amount
          break
        case OBLIGATION_STATUS.OVERDUE:
          summary.totalOverdue++
          summary.amountOverdue += amount
          break
        case OBLIGATION_STATUS.PAID:
          summary.totalPaid++
          summary.amountPaid += amount
          break
      }
    }

    return NextResponse.json({ obligations, summary })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Error fetching obligations:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})

export const POST = withApiLogging(async (request: NextRequest) => {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    setTenantContext({
      companyId: company.id,
      userId: user.id!,
    })

    // Parse and validate body
    const { year, month } = await parseBody(request, obligationsGenerateBodySchema)

    // Generate obligations
    const obligations = await generateObligations({
      companyId: company.id,
      year,
      month,
    })

    return NextResponse.json({
      message: `Generated ${obligations.length} obligations`,
      count: obligations.length,
    })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Error generating obligations:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})
