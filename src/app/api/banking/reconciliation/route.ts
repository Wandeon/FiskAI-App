import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { matchTransactionsToBoth, getAllCandidates } from "@/lib/banking/reconciliation"
import { ParsedTransaction } from "@/lib/banking/csv-parser"
import { AUTO_MATCH_THRESHOLD } from "@/lib/banking/reconciliation-config"
import { MatchStatus, Prisma } from "@prisma/client"

const matchStatusOptions = [
  "UNMATCHED",
  "AUTO_MATCHED",
  "MANUAL_MATCHED",
  "IGNORED",
  "ALL",
] as const

const querySchema = z.object({
  bankAccountId: z.string().optional(),
  matchStatus: z.enum(matchStatusOptions).default("UNMATCHED"),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(25),
})

export async function GET(request: Request) {
  const user = await requireAuth()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const company = await requireCompany(user.id!)
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 })
  }

  const url = new URL(request.url)
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: "Neispravan upit" }, { status: 400 })
  }

  const { bankAccountId, matchStatus, page, limit } = parsed.data
  const skip = (page - 1) * limit

  const baseWhere: Prisma.BankTransactionWhereInput = {
    companyId: company.id,
  }
  if (bankAccountId) {
    baseWhere.bankAccountId = bankAccountId
  }

  const statusFilter = matchStatus === "ALL" ? undefined : (matchStatus as MatchStatus)
  if (statusFilter) {
    baseWhere.matchStatus = statusFilter
  }

  const [total, transactions, groupedCounts] = await Promise.all([
    db.bankTransaction.count({ where: baseWhere }),
    db.bankTransaction.findMany({
      where: baseWhere,
      include: {
        bankAccount: {
          select: { name: true, currency: true },
        },
      },
      orderBy: { date: "desc" },
      take: limit,
      skip,
    }),
    db.bankTransaction.groupBy({
      by: ["matchStatus"],
      where: {
        companyId: company.id,
        ...(bankAccountId ? { bankAccountId } : {}),
      },
      _count: { matchStatus: true },
    }),
  ])

  const [invoices, expenses] = await Promise.all([
    db.eInvoice.findMany({
      where: {
        companyId: company.id,
        direction: "OUTBOUND",
        paidAt: null,
      },
      include: {
        lines: true,
      },
      orderBy: { issueDate: "desc" },
    }),
    db.expense.findMany({
      where: {
        companyId: company.id,
        status: { in: ["DRAFT", "PENDING"] },
      },
      orderBy: { date: "desc" },
    }),
  ])

  const parsedTransactions: (ParsedTransaction & { id: string })[] = transactions.map((txn) => ({
    id: txn.id,
    date: txn.date,
    amount: Number(txn.amount),
    description: txn.description,
    reference: txn.reference || "",
    type: Number(txn.amount) >= 0 ? "credit" : "debit",
    currency: txn.bankAccount?.currency || "EUR",
  }))

  const matchResults = matchTransactionsToBoth(parsedTransactions, invoices, expenses)
  const matchMap = new Map(matchResults.map((match) => [match.transactionId, match]))
  const parsedMap = new Map(parsedTransactions.map((t) => [t.id, t]))

  const summary = {
    unmatched: 0,
    autoMatched: 0,
    manualMatched: 0,
    ignored: 0,
  }
  for (const group of groupedCounts) {
    if (group.matchStatus === "UNMATCHED") summary.unmatched = group._count.matchStatus
    if (group.matchStatus === "AUTO_MATCHED") summary.autoMatched = group._count.matchStatus
    if (group.matchStatus === "MANUAL_MATCHED") summary.manualMatched = group._count.matchStatus
    if (group.matchStatus === "IGNORED") summary.ignored = group._count.matchStatus
  }

  const payload = {
    transactions: transactions.map((txn) => {
      const parsed = parsedMap.get(txn.id)
      const allCandidates = parsed ? getAllCandidates(parsed, invoices, expenses) : { invoiceCandidates: [], expenseCandidates: [] }
      const matchInfo = matchMap.get(txn.id)
      return {
        id: txn.id,
        date: txn.date.toISOString(),
        description: txn.description,
        reference: txn.reference,
        counterpartyName: txn.counterpartyName,
        amount: Number(txn.amount),
        currency: txn.bankAccount?.currency || "EUR",
        bankAccount: {
          id: txn.bankAccountId,
          name: txn.bankAccount?.name || "",
        },
        matchStatus: txn.matchStatus,
        confidenceScore: txn.confidenceScore ?? matchInfo?.confidenceScore ?? 0,
        invoiceCandidates: allCandidates.invoiceCandidates.map((candidate) => ({
          ...candidate,
          issueDate: candidate.issueDate.toISOString(),
        })),
        expenseCandidates: allCandidates.expenseCandidates.map((candidate) => ({
          ...candidate,
          date: candidate.date.toISOString(),
        })),
      }
    }),
    pagination: {
      page,
      limit,
      total,
    },
    summary,
    autoMatchThreshold: AUTO_MATCH_THRESHOLD,
  }

  return NextResponse.json(payload)
}
