// src/lib/banking/expense-reconciliation.ts
// Matches bank transactions to expenses

import { Expense, Contact, ExpenseCategory, BankTransaction } from "@prisma/client"
import { ParsedTransaction } from "./csv-parser"

export interface ExpenseReconciliationResult {
  transactionId: string
  matchedExpenseId: string | null
  matchStatus: "matched" | "partial" | "unmatched" | "ambiguous"
  confidenceScore: number
  reason: string
}

export interface ExpenseCandidate {
  expenseId: string
  description: string
  vendorName: string | null
  date: Date
  totalAmount: number
  score: number
  reason: string
}

type ExpenseWithRelations = Expense & {
  vendor?: Contact | null
  category: ExpenseCategory
}

export function matchTransactionsToExpenses(
  transactions: (ParsedTransaction & { id: string })[],
  expenses: ExpenseWithRelations[]
): ExpenseReconciliationResult[] {
  return transactions.map((transaction) => {
    const matches = buildExpenseMatches(transaction, expenses)
    const topMatch = matches[0]
    const secondMatch = matches[1]

    // Check for ambiguous matches (two expenses with same score)
    if (topMatch && secondMatch && topMatch.score > 0 && secondMatch.score === topMatch.score) {
      return {
        transactionId: transaction.id,
        matchedExpenseId: null,
        matchStatus: "ambiguous",
        confidenceScore: topMatch.score,
        reason: "Više troškova ima isti rezultat",
      }
    }

    if (topMatch && topMatch.score >= 70) {
      return {
        transactionId: transaction.id,
        matchedExpenseId: topMatch.expense.id,
        matchStatus: topMatch.score >= 85 ? "matched" : "partial",
        confidenceScore: topMatch.score,
        reason: getScoreReason(topMatch.score, topMatch.reason),
      }
    }

    return {
      transactionId: transaction.id,
      matchedExpenseId: null,
      matchStatus: "unmatched",
      confidenceScore: 0,
      reason: "Nije pronađen odgovarajući trošak",
    }
  })
}

export function getExpenseCandidates(
  transaction: ParsedTransaction & { id: string },
  expenses: ExpenseWithRelations[],
  limit = 3
): ExpenseCandidate[] {
  const matches = buildExpenseMatches(transaction, expenses)
  return matches
    .filter((match) => match.score > 0)
    .slice(0, limit)
    .map((match) => ({
      expenseId: match.expense.id,
      description: match.expense.description,
      vendorName: match.expense.vendor?.name || null,
      date: match.expense.date,
      totalAmount: Number(match.expense.totalAmount),
      score: match.score,
      reason: getScoreReason(match.score, match.reason),
    }))
}

interface ExpenseMatch {
  expense: ExpenseWithRelations
  score: number
  reason: "vendor_and_amount" | "amount_and_date" | "amount_tolerance" | "vendor_match" | "none"
}

function buildExpenseMatches(
  transaction: ParsedTransaction & { id: string },
  expenses: ExpenseWithRelations[]
): ExpenseMatch[] {
  const matches = expenses.map((expense) => ({
    expense,
    ...calculateExpenseMatchScore(transaction, expense),
  }))
  matches.sort((a, b) => b.score - a.score)
  return matches
}

function calculateExpenseMatchScore(
  transaction: ParsedTransaction,
  expense: ExpenseWithRelations
): { score: number; reason: ExpenseMatch["reason"] } {
  const expenseAmount = Math.abs(Number(expense.totalAmount))
  const transactionAmount = Math.abs(transaction.amount)
  const delta = Math.abs(expenseAmount - transactionAmount)
  const dateDiffDays = daysDiff(transaction.date, expense.date)

  // Check vendor name in transaction description (strongest signal)
  const vendorMatch = expense.vendor?.name
    ? normalizeString(transaction.description).includes(normalizeString(expense.vendor.name))
    : false

  // Exact amount match + vendor name match = highest confidence
  if (vendorMatch && delta < 1 && dateDiffDays <= 7) {
    return { score: 100, reason: "vendor_and_amount" }
  }

  // Exact amount match + close date
  if (delta < 1 && dateDiffDays <= 3) {
    return { score: 85, reason: "amount_and_date" }
  }

  // Amount within 5% tolerance + close date
  if (expenseAmount > 0) {
    const pct = delta / expenseAmount
    if (pct <= 0.05 && dateDiffDays <= 5) {
      return { score: 70, reason: "amount_tolerance" }
    }
  }

  // Vendor name match only (weak signal)
  if (vendorMatch && dateDiffDays <= 14) {
    return { score: 50, reason: "vendor_match" }
  }

  return { score: 0, reason: "none" }
}

function daysDiff(a: Date, b: Date): number {
  const ms = Math.abs(new Date(a).getTime() - new Date(b).getTime())
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-z0-9]/g, " ")
    .trim()
}

function getScoreReason(score: number, matchType: ExpenseMatch["reason"]): string {
  switch (matchType) {
    case "vendor_and_amount":
      return "Pronađen dobavljač u opisu i točan iznos"
    case "amount_and_date":
      return "Točan iznos i datum blizu datuma troška"
    case "amount_tolerance":
      return "Iznos unutar tolerancije i datum blizu"
    case "vendor_match":
      return "Pronađen dobavljač u opisu transakcije"
    default:
      return "Niska pouzdanost"
  }
}
