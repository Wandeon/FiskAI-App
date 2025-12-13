import { db } from "@/lib/db"
import { ParsedTransaction } from "./csv-parser"
import { matchTransactionsToInvoices } from "./reconciliation"
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

  const invoices = await db.eInvoice.findMany({
    where: {
      companyId,
      direction: "OUTBOUND",
      paidAt: null,
    },
    include: { lines: true },
  })

  if (invoices.length === 0) {
    return { matchedCount: 0, evaluated: 0 }
  }

  const positiveTxns = transactions.filter((txn) => Number(txn.amount) > 0)
  if (positiveTxns.length === 0) {
    return { matchedCount: 0, evaluated: 0 }
  }

  const parsedTransactions: (ParsedTransaction & { id: string })[] = positiveTxns.map(
    (txn) => ({
      id: txn.id,
      date: txn.date,
      amount: Number(txn.amount),
      description: txn.description,
      reference: txn.reference || "",
      type: txn.amount >= 0 ? "credit" : "debit",
      currency: txn.bankAccount?.currency || "EUR",
    })
  )

  const results = matchTransactionsToInvoices(parsedTransactions, invoices)
  const txMap = new Map(parsedTransactions.map((txn) => [txn.id, txn]))
  const updates: Promise<unknown>[] = []
  let matchedCount = 0

  for (const result of results) {
    const txn = txMap.get(result.transactionId)
    if (!txn) continue

    const shouldAutoMatch =
      result.matchStatus === "matched" &&
      result.confidenceScore >= threshold &&
      !!result.matchedInvoiceId

    const updateData: Prisma.BankTransactionUpdateInput = {
      confidenceScore: result.confidenceScore,
      matchStatus: shouldAutoMatch ? MatchStatus.AUTO_MATCHED : MatchStatus.UNMATCHED,
      matchedInvoiceId: shouldAutoMatch ? result.matchedInvoiceId : null,
      matchedAt: shouldAutoMatch ? new Date() : null,
      matchedBy: shouldAutoMatch ? userId : null,
    }

    if (shouldAutoMatch) {
      matchedCount++

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
    } else {
      updateData.matchStatus = MatchStatus.UNMATCHED
      updateData.matchedInvoiceId = null
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
  if (bankAccountId) {
    revalidatePath(`/banking/${bankAccountId}`)
  }

  return {
    matchedCount,
    evaluated: positiveTxns.length,
  }
}
