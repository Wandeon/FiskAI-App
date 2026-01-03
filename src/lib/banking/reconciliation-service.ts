import { db } from "@/lib/db"
import { AUTO_MATCH_THRESHOLD } from "./reconciliation-config"
import { InvoicePaymentStatus, MatchKind, MatchSource, MatchStatus } from "@prisma/client"
import { safeRevalidatePath } from "@/lib/next/safe-revalidate"
import { Prisma } from "@prisma/client"
import { moneyToMinorUnits } from "@/lib/money"

/**
 * Explicit mapping from computed payment status string to Prisma enum.
 * Fails fast on unknown values - no silent defaults in regulated logic.
 */
function toInvoicePaymentStatus(status: "UNPAID" | "PARTIAL" | "PAID"): InvoicePaymentStatus {
  switch (status) {
    case "UNPAID":
      return InvoicePaymentStatus.UNPAID
    case "PARTIAL":
      return InvoicePaymentStatus.PARTIAL
    case "PAID":
      return InvoicePaymentStatus.PAID
  }
}

interface AutoMatchParams {
  companyId: string
  bankAccountId?: string
  userId: string
  threshold?: number
}

const Decimal = Prisma.Decimal

function isBankFeeTransaction(params: { amount: Prisma.Decimal; description: string }): boolean {
  if (params.amount.greaterThanOrEqualTo(0)) return false
  const abs = params.amount.abs()
  if (abs.greaterThan(new Decimal("25.00"))) return false
  const normalized = params.description.toLowerCase()
  return (
    normalized.includes("naknada") ||
    normalized.includes("fee") ||
    normalized.includes("proviz") ||
    (normalized.includes("bank") && normalized.includes("nakn"))
  )
}

function resolveAllocation(params: {
  transactionAmount: Prisma.Decimal
  invoiceTotal: Prisma.Decimal
  invoicePaid: Prisma.Decimal
}) {
  const remaining = params.invoiceTotal.sub(params.invoicePaid)
  const alloc = params.transactionAmount.lessThan(remaining) ? params.transactionAmount : remaining
  const overpayment = params.transactionAmount.sub(remaining)
  return {
    remaining,
    allocated: alloc,
    overpayment: overpayment.greaterThan(0) ? overpayment : new Decimal(0),
  }
}

export async function runAutoMatchTransactions(params: AutoMatchParams) {
  const { companyId, bankAccountId, userId, threshold = AUTO_MATCH_THRESHOLD } = params

  const transactions = await db.bankTransaction.findMany({
    where: {
      companyId,
      ...(bankAccountId ? { bankAccountId } : {}),
    },
    include: {
      bankAccount: {
        select: { currency: true },
      },
      matchRecords: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { date: "desc" },
  })

  const unmatchedTransactions = transactions.filter((txn) => {
    const latestMatch = txn.matchRecords[0]
    return !latestMatch || latestMatch.matchStatus === MatchStatus.UNMATCHED
  })

  if (unmatchedTransactions.length === 0) {
    return { matchedCount: 0, evaluated: 0 }
  }

  const [invoices, expenses] = await Promise.all([
    db.eInvoice.findMany({
      where: {
        companyId,
        direction: "OUTBOUND",
        paymentStatus: { not: "PAID" },
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

  const txMap = new Map(unmatchedTransactions.map((txn) => [txn.id, txn]))
  const updates: Promise<unknown>[] = []
  let matchedCount = 0

  for (const txn of unmatchedTransactions) {
    const currency = txn.bankAccount?.currency || txn.currency || "EUR"

    // Debit transactions: try to auto-categorize bank fees first (Scenario 3 requirement).
    if (
      txn.amount.lessThan(0) &&
      isBankFeeTransaction({ amount: txn.amount, description: txn.description })
    ) {
      const bankFeeAmount = txn.amount.abs().toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      const category = await db.expenseCategory.findFirst({
        where: {
          OR: [{ companyId }, { companyId: null }],
          name: { contains: "Bankarske", mode: "insensitive" },
        },
      })

      const expense = await db.expense.create({
        data: {
          companyId,
          categoryId:
            category?.id ??
            (
              await db.expenseCategory.create({
                data: {
                  companyId,
                  name: "Bankarske usluge",
                  code: "BANK_FEES",
                  vatDeductibleDefault: true,
                  receiptRequired: false,
                  isActive: true,
                },
              })
            ).id,
          description: "Bankarske usluge",
          date: txn.date,
          dueDate: null,
          netAmount: bankFeeAmount,
          vatAmount: new Decimal("0.00"),
          vatRate: new Decimal("0.00"),
          totalAmount: bankFeeAmount,
          currency,
          status: "PAID",
          paymentDate: txn.date,
          paymentMethod: "TRANSFER",
        },
      })

      matchedCount++
      updates.push(
        db.matchRecord.create({
          data: {
            companyId,
            bankTransactionId: txn.id,
            matchStatus: MatchStatus.AUTO_MATCHED,
            matchKind: MatchKind.EXPENSE,
            matchedExpenseId: expense.id,
            confidenceScore: 100,
            reason: "Bank fee auto-categorization",
            source: MatchSource.AUTO,
            createdBy: userId,
            metadata: {
              kind: "BANK_FEE",
              amount: bankFeeAmount.toFixed(2),
            },
          },
        })
      )

      updates.push(
        db.bankTransaction.update({
          where: { id: txn.id },
          data: {
            matchedExpenseId: expense.id,
            matchStatus: MatchStatus.AUTO_MATCHED,
            matchedAt: new Date(),
            matchedBy: userId,
          },
        })
      )
      continue
    }

    // Credit transactions: match to open invoices (partial/overpay supported).
    if (txn.amount.greaterThan(0) && invoices.length) {
      const txnMinor = moneyToMinorUnits(txn.amount, 2)
      const candidates = invoices
        .filter((inv) => (inv.currency || "EUR") === currency)
        .map((inv) => {
          const invPaid = new Decimal(inv.paidAmount ?? 0)
          const remaining = new Decimal(inv.totalAmount).sub(invPaid)
          const remainingMinor = moneyToMinorUnits(remaining, 2)
          const deltaMinor = Math.abs(remainingMinor - txnMinor)
          const reference = (txn.reference ?? "").toLowerCase()
          const invoiceNumber = (inv.invoiceNumber ?? "").toLowerCase()
          const referenceHit =
            reference && (invoiceNumber.includes(reference) || reference.includes(invoiceNumber))
          return {
            invoice: inv,
            deltaMinor,
            referenceHit,
            dateDiffDays: Math.abs(
              Math.floor((txn.date.getTime() - inv.issueDate.getTime()) / (1000 * 60 * 60 * 24))
            ),
          }
        })
        .sort((a, b) => {
          if (a.referenceHit !== b.referenceHit) return a.referenceHit ? -1 : 1
          if (a.deltaMinor !== b.deltaMinor) return a.deltaMinor - b.deltaMinor
          return a.dateDiffDays - b.dateDiffDays
        })

      const top = candidates[0]
      if (top) {
        const score = top.referenceHit
          ? 100
          : top.deltaMinor === 0
            ? 95
            : top.deltaMinor <= 500
              ? 85
              : 0
        if (score >= threshold) {
          const invoice = top.invoice
          const invoicePaidBefore = new Decimal(invoice.paidAmount ?? 0)
          const invoiceTotal = new Decimal(invoice.totalAmount)
          const allocation = resolveAllocation({
            transactionAmount: new Decimal(txn.amount),
            invoiceTotal,
            invoicePaid: invoicePaidBefore,
          })
          const paidAfterRaw = invoicePaidBefore.add(allocation.allocated)
          const paidAfter = paidAfterRaw.greaterThan(invoiceTotal) ? invoiceTotal : paidAfterRaw

          const paymentStatus: "UNPAID" | "PARTIAL" | "PAID" = paidAfter.equals(0)
            ? "UNPAID"
            : paidAfter.lessThan(invoiceTotal)
              ? "PARTIAL"
              : "PAID"

          matchedCount++

          updates.push(
            db.matchRecord.create({
              data: {
                companyId,
                bankTransactionId: txn.id,
                matchStatus: MatchStatus.AUTO_MATCHED,
                matchKind: MatchKind.INVOICE,
                matchedInvoiceId: invoice.id,
                confidenceScore: score,
                reason: top.referenceHit ? "Reference match" : "Amount match (allocation)",
                source: MatchSource.AUTO,
                createdBy: userId,
                metadata: {
                  kind: paymentStatus === "PAID" ? "INVOICE_PAID" : "INVOICE_PARTIAL",
                  currency,
                  transactionAmount: txn.amount
                    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
                    .toFixed(2),
                  invoiceTotal: invoiceTotal.toFixed(2),
                  invoicePaidBefore: invoicePaidBefore.toFixed(2),
                  invoicePaidAfter: paidAfter.toFixed(2),
                  allocatedAmount: allocation.allocated.toFixed(2),
                  overpaymentAmount: allocation.overpayment.toFixed(2),
                  remainingAfter: invoiceTotal.sub(paidAfter).toFixed(2),
                },
              },
            })
          )

          updates.push(
            db.eInvoice.update({
              where: { id: invoice.id },
              data: {
                paidAmount: paidAfter,
                paymentStatus: toInvoicePaymentStatus(paymentStatus),
                paidAt: paymentStatus === "PAID" ? txn.date : null,
              },
            })
          )

          if (allocation.overpayment.greaterThan(0)) {
            updates.push(
              db.unappliedPayment.upsert({
                where: { bankTransactionId: txn.id },
                create: {
                  companyId,
                  bankTransactionId: txn.id,
                  amount: allocation.overpayment,
                  currency,
                  reason: `Overpayment for invoice ${invoice.invoiceNumber}`,
                },
                update: {
                  amount: allocation.overpayment,
                  currency,
                  reason: `Overpayment for invoice ${invoice.invoiceNumber}`,
                },
              })
            )
          }

          updates.push(
            db.bankTransaction.update({
              where: { id: txn.id },
              data: {
                matchedInvoiceId: invoice.id,
                matchStatus: MatchStatus.AUTO_MATCHED,
                matchedAt: new Date(),
                matchedBy: userId,
              },
            })
          )
        }
      }
    }
  }

  await Promise.all(updates)

  safeRevalidatePath("/banking")
  safeRevalidatePath("/banking/transactions")
  safeRevalidatePath("/banking/reconciliation")
  safeRevalidatePath("/e-invoices")
  safeRevalidatePath("/expenses")
  if (bankAccountId) {
    safeRevalidatePath(`/banking/${bankAccountId}`)
  }

  return {
    matchedCount,
    evaluated: unmatchedTransactions.length,
  }
}
