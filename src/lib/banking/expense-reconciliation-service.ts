// src/lib/banking/expense-reconciliation-service.ts
// Service for matching expenses to bank transactions

import { db } from "@/lib/db"
import { ParsedTransaction } from "./csv-parser"
import {
  matchTransactionsToExpenses,
  getExpenseCandidates,
  ExpenseCandidate,
} from "./expense-reconciliation"
import { MatchStatus, Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { logger } from "@/lib/logger"

const AUTO_MATCH_THRESHOLD = 85 // Only auto-match with high confidence

interface AutoMatchParams {
  companyId: string
  bankAccountId?: string
  userId: string
  threshold?: number
}

export async function runAutoMatchExpenses(params: AutoMatchParams) {
  const { companyId, bankAccountId, userId, threshold = AUTO_MATCH_THRESHOLD } = params

  // Find unmatched debit transactions (outgoing payments = expenses)
  const where: Record<string, unknown> = {
    companyId,
    matchStatus: MatchStatus.UNMATCHED,
    amount: { lt: 0 }, // Negative = debit = expense payment
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

  // Find unpaid expenses (no linked bank transaction)
  const expenses = await db.expense.findMany({
    where: {
      companyId,
      status: { in: ["DRAFT", "PENDING"] }, // Not yet marked as paid
      bankTransactions: { none: {} }, // No linked transactions
    },
    include: {
      vendor: true,
      category: true,
    },
  })

  if (expenses.length === 0) {
    return { matchedCount: 0, evaluated: 0 }
  }

  const parsedTransactions: (ParsedTransaction & { id: string })[] = transactions.map((txn) => ({
    id: txn.id,
    date: txn.date,
    amount: Math.abs(Number(txn.amount)), // Make positive for matching
    description: txn.description,
    reference: txn.reference || "",
    type: "debit",
    currency: txn.bankAccount?.currency || "EUR",
  }))

  const results = matchTransactionsToExpenses(parsedTransactions, expenses)
  const txMap = new Map(transactions.map((txn) => [txn.id, txn]))
  const updates: Promise<unknown>[] = []
  let matchedCount = 0

  for (const result of results) {
    const txn = txMap.get(result.transactionId)
    if (!txn) continue

    const shouldAutoMatch =
      result.matchStatus === "matched" &&
      result.confidenceScore >= threshold &&
      !!result.matchedExpenseId

    if (shouldAutoMatch) {
      matchedCount++

      // Get current expense to preserve its status
      const expense = expenses.find((e) => e.id === result.matchedExpenseId)
      if (!expense) continue

      // Link transaction to expense
      updates.push(
        db.bankTransaction.update({
          where: { id: txn.id },
          data: {
            matchStatus: MatchStatus.AUTO_MATCHED,
            confidenceScore: result.confidenceScore,
            matchedAt: new Date(),
            matchedBy: userId,
            matchedExpenseId: result.matchedExpenseId!,
          },
        })
      )

      // Mark expense as paid, preserving original status
      updates.push(
        db.expense.update({
          where: { id: result.matchedExpenseId! },
          data: {
            statusBeforeMatch: expense.status,
            status: "PAID",
            paymentDate: txn.date,
          },
        })
      )

      logger.info(
        {
          transactionId: txn.id,
          expenseId: result.matchedExpenseId,
          score: result.confidenceScore,
        },
        "Auto-matched expense to transaction"
      )
    }
  }

  await Promise.all(updates)

  revalidatePath("/banking")
  revalidatePath("/banking/transactions")
  revalidatePath("/banking/reconciliation")
  revalidatePath("/expenses")
  if (bankAccountId) {
    revalidatePath(`/banking/${bankAccountId}`)
  }

  return {
    matchedCount,
    evaluated: transactions.length,
  }
}

/**
 * Get suggested expense matches for a specific transaction
 */
export async function getSuggestedExpenses(
  transactionId: string,
  companyId: string
): Promise<ExpenseCandidate[]> {
  const transaction = await db.bankTransaction.findFirst({
    where: { id: transactionId, companyId },
    include: {
      bankAccount: {
        select: { currency: true },
      },
    },
  })

  if (!transaction) {
    return []
  }

  const expenses = await db.expense.findMany({
    where: {
      companyId,
      status: { in: ["DRAFT", "PENDING"] },
      bankTransactions: { none: {} },
    },
    include: {
      vendor: true,
      category: true,
    },
  })

  const parsed: ParsedTransaction & { id: string } = {
    id: transaction.id,
    date: transaction.date,
    amount: Math.abs(Number(transaction.amount)),
    description: transaction.description,
    reference: transaction.reference || "",
    type: "debit",
    currency: transaction.bankAccount?.currency || "EUR",
  }

  return getExpenseCandidates(parsed, expenses)
}

/**
 * Manually link a transaction to an expense
 */
export async function linkTransactionToExpense(
  transactionId: string,
  expenseId: string,
  companyId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify both belong to the company
    const [transaction, expense] = await Promise.all([
      db.bankTransaction.findFirst({
        where: { id: transactionId, companyId },
      }),
      db.expense.findFirst({
        where: { id: expenseId, companyId },
      }),
    ])

    if (!transaction) {
      return { success: false, error: "Transakcija nije pronađena" }
    }
    if (!expense) {
      return { success: false, error: "Trošak nije pronađen" }
    }

    // Link transaction to expense
    await db.bankTransaction.update({
      where: { id: transactionId },
      data: {
        matchStatus: MatchStatus.MANUAL_MATCHED,
        matchedAt: new Date(),
        matchedBy: userId,
        confidenceScore: 100, // Manual = certain
        matchedExpenseId: expenseId,
      },
    })

    // Mark expense as paid, preserving original status
    await db.expense.update({
      where: { id: expenseId },
      data: {
        statusBeforeMatch: expense.status,
        status: "PAID",
        paymentDate: transaction.date,
      },
    })

    logger.info({ transactionId, expenseId, userId }, "Manually linked expense to transaction")

    revalidatePath("/banking")
    revalidatePath("/banking/transactions")
    revalidatePath("/expenses")

    return { success: true }
  } catch (error) {
    logger.error({ error }, "Failed to link transaction to expense")
    return { success: false, error: "Greška pri povezivanju" }
  }
}

/**
 * Unlink a transaction from its expense
 */
export async function unlinkTransactionFromExpense(
  transactionId: string,
  companyId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const transaction = await db.bankTransaction.findFirst({
      where: { id: transactionId, companyId },
      include: { matchedExpense: true },
    })

    if (!transaction) {
      return { success: false, error: "Transakcija nije pronađena" }
    }

    const expenseId = transaction.matchedExpenseId

    // Disconnect the expense
    await db.bankTransaction.update({
      where: { id: transactionId },
      data: {
        matchStatus: MatchStatus.UNMATCHED,
        matchedAt: null,
        matchedBy: null,
        confidenceScore: null,
        matchedExpenseId: null,
      },
    })

    // Restore expense to its original status if there was one
    if (expenseId) {
      const expense = transaction.matchedExpense
      const restoredStatus = expense?.statusBeforeMatch || "PENDING"

      await db.expense.update({
        where: { id: expenseId },
        data: {
          status: restoredStatus,
          statusBeforeMatch: null, // Clear the saved status
          paymentDate: null,
        },
      })
    }

    logger.info({ transactionId, expenseId }, "Unlinked transaction from expense")

    revalidatePath("/banking")
    revalidatePath("/banking/transactions")
    revalidatePath("/expenses")

    return { success: true }
  } catch (error) {
    logger.error({ error }, "Failed to unlink transaction from expense")
    return { success: false, error: "Greška pri odspajanju" }
  }
}
