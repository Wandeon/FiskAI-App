import { db } from "@/lib/db"
import { ParsedTransaction } from "./csv-parser"
import { matchTransactionsToBoth } from "./reconciliation"
import { AUTO_MATCH_THRESHOLD } from "./reconciliation-config"
import { MatchStatus, Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"

interface AutoMatchParams {
  companyId: string
  bankAccountId?: string
  userId: string
  threshold?: number
}

export async function runAutoMatchTransactions(params: AutoMatchParams) {
  const { companyId, bankAccountId, userId, threshold = AUTO_MATCH_THRESHOLD } = params

  const where: Record<string, unknown> = {
    companyId,
    matchStatus: MatchStatus.UNMATCHED,
  }
  if (bankAccountId) {
    where.bankAccountId = bankAccountId
  }

  const transactions = await db.bankTransaction.findMany({
    where,
    include: {
      bankAccount: {
        select: { currency: true },
      },
    },
    orderBy: { date: "desc" },
  })

  if (transactions.length === 0) {
    return { matchedCount: 0, evaluated: 0 }
  }

  const [invoices, expenses] = await Promise.all([
    db.eInvoice.findMany({
      where: {
        companyId,
        direction: "OUTBOUND",
        paidAt: null,
      },
      include: { lines: true },
    }),
    db.expense.findMany({
      where: {
        companyId,
        status: { in: ["DRAFT", "PENDING"] }, // Only unpaid expenses
      },
    }),
  ])

  if (invoices.length === 0 && expenses.length === 0) {
    return { matchedCount: 0, evaluated: 0 }
  }

  const parsedTransactions: (ParsedTransaction & { id: string })[] = transactions.map((txn) => ({
    id: txn.id,
    date: txn.date,
    amount: Number(txn.amount),
    description: txn.description,
    reference: txn.reference || "",
    type: Number(txn.amount) >= 0 ? "credit" : "debit",
    currency: txn.bankAccount?.currency || "EUR",
  }))

  const results = matchTransactionsToBoth(parsedTransactions, invoices, expenses)
  const txMap = new Map(parsedTransactions.map((txn) => [txn.id, txn]))
  const updates: Promise<unknown>[] = []
  let matchedCount = 0

  for (const result of results) {
    const txn = txMap.get(result.transactionId)
    if (!txn) continue

    const shouldAutoMatch =
      result.matchStatus === "matched" &&
      result.confidenceScore >= threshold &&
      (!!result.matchedInvoiceId || !!result.matchedExpenseId)

    const updateData: Prisma.BankTransactionUpdateInput = {
      confidenceScore: result.confidenceScore,
      matchStatus: shouldAutoMatch ? MatchStatus.AUTO_MATCHED : MatchStatus.UNMATCHED,
      matchedInvoice:
        shouldAutoMatch && result.matchedInvoiceId
          ? { connect: { id: result.matchedInvoiceId } }
          : { disconnect: true },
      matchedExpense:
        shouldAutoMatch && result.matchedExpenseId
          ? { connect: { id: result.matchedExpenseId } }
          : { disconnect: true },
      matchedAt: shouldAutoMatch ? new Date() : null,
      matchedBy: shouldAutoMatch ? userId : null,
    }

    if (shouldAutoMatch) {
      matchedCount++

      if (result.matchedInvoiceId) {
        const invoice = invoices.find((inv) => inv.id === result.matchedInvoiceId)
        if (invoice && !invoice.paidAt) {
          updates.push(
            db.eInvoice.update({
              where: { id: invoice.id },
              data: {
                paidAt: txn.date,
                status: "ACCEPTED",
              },
            })
          )
          invoice.paidAt = txn.date
        }
      }

      if (result.matchedExpenseId) {
        const expense = expenses.find((exp) => exp.id === result.matchedExpenseId)
        if (expense && expense.status !== "PAID") {
          updates.push(
            db.expense.update({
              where: { id: expense.id },
              data: {
                paymentDate: txn.date,
                status: "PAID",
                paymentMethod: "TRANSFER",
              },
            })
          )
        }
      }
    } else {
      updateData.matchStatus = MatchStatus.UNMATCHED
      updateData.matchedInvoice = { disconnect: true }
      updateData.matchedExpense = { disconnect: true }
      updateData.matchedAt = null
      updateData.matchedBy = null
    }

    updates.push(
      db.bankTransaction.update({
        where: { id: txn.id },
        data: updateData,
      })
    )
  }

  await Promise.all(updates)

  revalidatePath("/banking")
  revalidatePath("/banking/transactions")
  revalidatePath("/banking/reconciliation")
  revalidatePath("/e-invoices")
  revalidatePath("/expenses")
  if (bankAccountId) {
    revalidatePath(`/banking/${bankAccountId}`)
  }

  return {
    matchedCount,
    evaluated: parsedTransactions.length,
  }
}
