import { EInvoice, EInvoiceLine, Expense } from "@prisma/client"
import { ParsedTransaction } from "./csv-parser"

export interface ReconciliationResult {
  transactionId: string
  matchedInvoiceId: string | null
  matchedExpenseId: string | null
  matchType: "invoice" | "expense" | null
  matchStatus: "matched" | "partial" | "unmatched" | "ambiguous"
  confidenceScore: number
  reason: string
}

export interface InvoiceCandidate {
  invoiceId: string
  invoiceNumber: string | null
  issueDate: Date
  totalAmount: number
  score: number
  reason: string
}

export interface ExpenseCandidate {
  expenseId: string
  description: string
  date: Date
  totalAmount: number
  score: number
  reason: string
}

export function matchTransactionsToInvoices(
  transactions: (ParsedTransaction & { id: string })[],
  invoices: (EInvoice & { lines: EInvoiceLine[] })[]
): ReconciliationResult[] {
  return transactions.map((transaction) => {
    const matches = buildInvoiceMatches(transaction, invoices)
    const topMatch = matches[0]
    const secondMatch = matches[1]

    if (topMatch && secondMatch && topMatch.score > 0 && secondMatch.score === topMatch.score) {
      return {
        transactionId: transaction.id,
        matchedInvoiceId: null,
        matchedExpenseId: null,
        matchType: null,
        matchStatus: "ambiguous",
        confidenceScore: topMatch.score,
        reason: "Multiple invoices match with the same score",
      }
    }

    if (topMatch && topMatch.score >= 70) {
      return {
        transactionId: transaction.id,
        matchedInvoiceId: topMatch.invoice.id,
        matchedExpenseId: null,
        matchType: "invoice",
        matchStatus: topMatch.score >= 85 ? "matched" : "partial",
        confidenceScore: topMatch.score,
        reason: getScoreReason(topMatch.score),
      }
    }

    return {
      transactionId: transaction.id,
      matchedInvoiceId: null,
      matchedExpenseId: null,
      matchType: null,
      matchStatus: "unmatched",
      confidenceScore: 0,
      reason: "No matching invoice found",
    }
  })
}

export function matchTransactionsToExpenses(
  transactions: (ParsedTransaction & { id: string })[],
  expenses: Expense[]
): ReconciliationResult[] {
  return transactions.map((transaction) => {
    const matches = buildExpenseMatches(transaction, expenses)
    const topMatch = matches[0]
    const secondMatch = matches[1]

    if (topMatch && secondMatch && topMatch.score > 0 && secondMatch.score === topMatch.score) {
      return {
        transactionId: transaction.id,
        matchedInvoiceId: null,
        matchedExpenseId: null,
        matchType: null,
        matchStatus: "ambiguous",
        confidenceScore: topMatch.score,
        reason: "Multiple expenses match with the same score",
      }
    }

    if (topMatch && topMatch.score >= 70) {
      return {
        transactionId: transaction.id,
        matchedInvoiceId: null,
        matchedExpenseId: topMatch.expense.id,
        matchType: "expense",
        matchStatus: topMatch.score >= 85 ? "matched" : "partial",
        confidenceScore: topMatch.score,
        reason: getScoreReason(topMatch.score),
      }
    }

    return {
      transactionId: transaction.id,
      matchedInvoiceId: null,
      matchedExpenseId: null,
      matchType: null,
      matchStatus: "unmatched",
      confidenceScore: 0,
      reason: "No matching expense found",
    }
  })
}

export function matchTransactionsToBoth(
  transactions: (ParsedTransaction & { id: string })[],
  invoices: (EInvoice & { lines: EInvoiceLine[] })[],
  expenses: Expense[]
): ReconciliationResult[] {
  return transactions.map((transaction) => {
    // For positive amounts (credits), match against invoices
    // For negative amounts (debits), match against expenses
    const isCredit = transaction.amount >= 0

    if (isCredit) {
      const invoiceMatches = buildInvoiceMatches(transaction, invoices)
      const topInvoiceMatch = invoiceMatches[0]
      const secondInvoiceMatch = invoiceMatches[1]

      if (
        topInvoiceMatch &&
        secondInvoiceMatch &&
        topInvoiceMatch.score > 0 &&
        secondInvoiceMatch.score === topInvoiceMatch.score
      ) {
        return {
          transactionId: transaction.id,
          matchedInvoiceId: null,
          matchedExpenseId: null,
          matchType: null,
          matchStatus: "ambiguous",
          confidenceScore: topInvoiceMatch.score,
          reason: "Multiple invoices match with the same score",
        }
      }

      if (topInvoiceMatch && topInvoiceMatch.score >= 70) {
        return {
          transactionId: transaction.id,
          matchedInvoiceId: topInvoiceMatch.invoice.id,
          matchedExpenseId: null,
          matchType: "invoice",
          matchStatus: topInvoiceMatch.score >= 85 ? "matched" : "partial",
          confidenceScore: topInvoiceMatch.score,
          reason: getScoreReason(topInvoiceMatch.score),
        }
      }
    } else {
      const expenseMatches = buildExpenseMatches(transaction, expenses)
      const topExpenseMatch = expenseMatches[0]
      const secondExpenseMatch = expenseMatches[1]

      if (
        topExpenseMatch &&
        secondExpenseMatch &&
        topExpenseMatch.score > 0 &&
        secondExpenseMatch.score === topExpenseMatch.score
      ) {
        return {
          transactionId: transaction.id,
          matchedInvoiceId: null,
          matchedExpenseId: null,
          matchType: null,
          matchStatus: "ambiguous",
          confidenceScore: topExpenseMatch.score,
          reason: "Multiple expenses match with the same score",
        }
      }

      if (topExpenseMatch && topExpenseMatch.score >= 70) {
        return {
          transactionId: transaction.id,
          matchedInvoiceId: null,
          matchedExpenseId: topExpenseMatch.expense.id,
          matchType: "expense",
          matchStatus: topExpenseMatch.score >= 85 ? "matched" : "partial",
          confidenceScore: topExpenseMatch.score,
          reason: getScoreReason(topExpenseMatch.score),
        }
      }
    }

    return {
      transactionId: transaction.id,
      matchedInvoiceId: null,
      matchedExpenseId: null,
      matchType: null,
      matchStatus: "unmatched",
      confidenceScore: 0,
      reason: isCredit ? "No matching invoice found" : "No matching expense found",
    }
  })
}

export function getInvoiceCandidates(
  transaction: ParsedTransaction & { id: string },
  invoices: (EInvoice & { lines: EInvoiceLine[] })[],
  limit = 3
): InvoiceCandidate[] {
  const matches = buildInvoiceMatches(transaction, invoices)
  return matches
    .filter((match) => match.score > 0)
    .slice(0, limit)
    .map((match) => ({
      invoiceId: match.invoice.id,
      invoiceNumber: match.invoice.invoiceNumber || null,
      issueDate: match.invoice.issueDate,
      totalAmount: Number(match.invoice.totalAmount || match.invoice.netAmount || 0),
      score: match.score,
      reason: getScoreReason(match.score),
    }))
}

export function getExpenseCandidates(
  transaction: ParsedTransaction & { id: string },
  expenses: Expense[],
  limit = 3
): ExpenseCandidate[] {
  const matches = buildExpenseMatches(transaction, expenses)
  return matches
    .filter((match) => match.score > 0)
    .slice(0, limit)
    .map((match) => ({
      expenseId: match.expense.id,
      description: match.expense.description,
      date: match.expense.date,
      totalAmount: Number(match.expense.totalAmount),
      score: match.score,
      reason: getScoreReason(match.score),
    }))
}

export function getAllCandidates(
  transaction: ParsedTransaction & { id: string },
  invoices: (EInvoice & { lines: EInvoiceLine[] })[],
  expenses: Expense[],
  limit = 3
): { invoiceCandidates: InvoiceCandidate[]; expenseCandidates: ExpenseCandidate[] } {
  return {
    invoiceCandidates: getInvoiceCandidates(transaction, invoices, limit),
    expenseCandidates: getExpenseCandidates(transaction, expenses, limit),
  }
}

interface InvoiceMatch {
  invoice: EInvoice & { lines: EInvoiceLine[] }
  score: number
}

interface ExpenseMatch {
  expense: Expense
  score: number
}

function buildInvoiceMatches(
  transaction: ParsedTransaction & { id: string },
  invoices: (EInvoice & { lines: EInvoiceLine[] })[]
): InvoiceMatch[] {
  const matches = invoices.map((invoice) => ({
    invoice,
    score: calculateMatchScore(transaction, invoice),
  }))
  matches.sort((a, b) => b.score - a.score)
  return matches
}

function buildExpenseMatches(
  transaction: ParsedTransaction & { id: string },
  expenses: Expense[]
): ExpenseMatch[] {
  const matches = expenses.map((expense) => ({
    expense,
    score: calculateExpenseMatchScore(transaction, expense),
  }))
  matches.sort((a, b) => b.score - a.score)
  return matches
}

function calculateMatchScore(transaction: ParsedTransaction, invoice: EInvoice): number {
  const transactionCurrency = transaction.currency || "EUR"
  const invoiceCurrency = invoice.currency || "EUR"
  if (transactionCurrency !== invoiceCurrency) return 0

  const invoiceNumber = invoice.invoiceNumber || ""
  const reference = transaction.reference || ""

  if (reference && (invoiceNumber.includes(reference) || reference.includes(invoiceNumber))) {
    return 100
  }

  const invoiceAmount = Number(invoice.totalAmount || invoice.netAmount || 0)
  const delta = Math.abs(invoiceAmount - transaction.amount)
  const dateDiffDays = daysDiff(transaction.date, invoice.issueDate)

  if (delta < 1 && dateDiffDays <= 3) {
    return 85
  }

  if (invoiceAmount > 0) {
    const pct = delta / invoiceAmount
    if (pct <= 0.05 && dateDiffDays <= 5) {
      return 70
    }
  }

  return 0
}

function calculateExpenseMatchScore(transaction: ParsedTransaction, expense: Expense): number {
  const transactionCurrency = transaction.currency || "EUR"
  const expenseCurrency = expense.currency || "EUR"
  if (transactionCurrency !== expenseCurrency) return 0

  const expenseAmount = Number(expense.totalAmount)
  const transactionAmount = Math.abs(transaction.amount) // Use absolute value for debit transactions
  const delta = Math.abs(expenseAmount - transactionAmount)
  const dateDiffDays = daysDiff(transaction.date, expense.date)

  // Check if description or reference contains partial matches
  const description = expense.description.toLowerCase()
  const reference = (transaction.reference || "").toLowerCase()
  const txnDescription = transaction.description.toLowerCase()

  if (reference && description.includes(reference)) {
    return 100
  }

  // Check for description overlap
  const descWords = description.split(/\s+/).filter((w) => w.length > 3)
  const txnWords = txnDescription.split(/\s+/).filter((w) => w.length > 3)
  const commonWords = descWords.filter((word) =>
    txnWords.some((txnWord) => txnWord.includes(word) || word.includes(txnWord))
  )

  if (commonWords.length > 0 && delta < 1 && dateDiffDays <= 3) {
    return 95
  }

  if (delta < 1 && dateDiffDays <= 3) {
    return 85
  }

  if (expenseAmount > 0) {
    const pct = delta / expenseAmount
    if (pct <= 0.05 && dateDiffDays <= 5) {
      return 70
    }
  }

  return 0
}

function daysDiff(a: Date, b: Date) {
  const ms = Math.abs(new Date(a).getTime() - new Date(b).getTime())
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function getScoreReason(score: number) {
  if (score >= 100) return "Reference found in description"
  if (score >= 95) return "Description match with exact amount and close date"
  if (score >= 85) return "Exact amount match and date close"
  if (score >= 70) return "Amount within tolerance and date close"
  return "Low confidence"
}
