import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser, getCurrentCompany } from "@/lib/auth-utils"
import { drizzleDb } from "@/lib/db/drizzle"
import { euTransaction } from "@/lib/db/schema/pausalni"
import { eq, and, desc } from "drizzle-orm"
import { processTransactionsForEu } from "@/lib/pausalni/eu-detection"
import { db } from "@/lib/db"
import {
  parseQuery,
  parseBody,
  isValidationError,
  formatValidationError,
} from "@/lib/api/validation"
import {
  euTransactionsQuerySchema,
  euTransactionsProcessBodySchema,
} from "@/app/api/pausalni/_schemas"

/**
 * GET /api/pausalni/eu-transactions
 * List EU transactions for a company (filtered by year/month/status)
 */
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

    // Check if company is pausalni obrt
    if (company.legalForm !== "OBRT_PAUSAL") {
      return NextResponse.json({ error: "Not a pausalni obrt" }, { status: 400 })
    }

    // Parse and validate query params
    const { year, month, status } = parseQuery(
      request.nextUrl.searchParams,
      euTransactionsQuerySchema
    )

    // Build query conditions
    const conditions = [eq(euTransaction.companyId, company.id)]

    if (year) {
      conditions.push(eq(euTransaction.reportingYear, year))
    }

    if (month) {
      conditions.push(eq(euTransaction.reportingMonth, month))
    }

    if (status === "confirmed") {
      conditions.push(eq(euTransaction.userConfirmed, true))
    } else if (status === "pending") {
      conditions.push(eq(euTransaction.userConfirmed, false))
    }

    const transactions = await drizzleDb
      .select()
      .from(euTransaction)
      .where(and(...conditions))
      .orderBy(desc(euTransaction.transactionDate))

    // Calculate summary
    const summary = {
      total: transactions.length,
      confirmed: transactions.filter((t) => t.userConfirmed).length,
      pending: transactions.filter((t) => !t.userConfirmed).length,
      totalAmount: transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0),
      totalPdvAmount: transactions.reduce((sum, t) => sum + parseFloat(t.pdvAmount || "0"), 0),
    }

    return NextResponse.json({ transactions, summary })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Error fetching EU transactions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/pausalni/eu-transactions
 * Process bank transactions for EU detection (calls eu-detection service)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const company = await getCurrentCompany(user.id!)
    if (!company) {
      return NextResponse.json({ error: "No company selected" }, { status: 400 })
    }

    // Check if company is pausalni obrt
    if (company.legalForm !== "OBRT_PAUSAL") {
      return NextResponse.json({ error: "Not a pausalni obrt" }, { status: 400 })
    }

    // Parse and validate body
    const { year, month, bankAccountId } = await parseBody(request, euTransactionsProcessBodySchema)

    // Fetch bank transactions for the specified period
    const startDate = new Date(year, month ? month - 1 : 0, 1)
    const endDate = new Date(year, month ? month : 12, 0)

    const whereClause: any = {
      companyId: company.id,
      date: {
        gte: startDate,
        lte: endDate,
      },
    }

    if (bankAccountId) {
      whereClause.bankAccountId = bankAccountId
    }

    const bankTransactions = await db.bankTransaction.findMany({
      where: whereClause,
      orderBy: {
        date: "desc",
      },
    })

    // Map to the format expected by processTransactionsForEu
    const transactions = bankTransactions.map((tx) => ({
      id: tx.id,
      counterpartyName: tx.counterpartyName,
      counterpartyIban: tx.counterpartyIban,
      amount: parseFloat(tx.amount.toString()),
      transactionDate: tx.date,
    }))

    // Process transactions for EU detection
    const result = await processTransactionsForEu(company.id, transactions)

    return NextResponse.json({
      message: "Bank transactions processed for EU detection",
      detected: result.detected,
      needsConfirmation: result.needsConfirmation,
      skipped: result.skipped,
      total: transactions.length,
    })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Error processing EU transactions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
