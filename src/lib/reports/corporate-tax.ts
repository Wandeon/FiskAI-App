import { db } from "@/lib/db"

export type CorporateTaxBaseInputs = {
  periodFrom: Date
  periodTo: Date
  revenue: number
  expenses: number
  nonDeductibleExpenses: number
  accountingProfit: number
  taxBase: number
}

export async function fetchCorporateTaxBaseInputs(
  companyId: string,
  from: Date,
  to: Date
): Promise<CorporateTaxBaseInputs> {
  const [invoices, expenses] = await Promise.all([
    db.eInvoice.findMany({
      where: {
        companyId,
        direction: "OUTBOUND",
        issueDate: { gte: from, lte: to },
        status: { not: "DRAFT" },
      },
      select: { netAmount: true },
    }),
    db.expense.findMany({
      where: {
        companyId,
        date: { gte: from, lte: to },
        status: { in: ["PAID", "PENDING"] },
      },
      select: { netAmount: true, vatDeductible: true },
    }),
  ])

  const revenue = invoices.reduce((sum, inv) => sum + Number(inv.netAmount), 0)
  const expenseTotal = expenses.reduce((sum, exp) => sum + Number(exp.netAmount), 0)
  const nonDeductibleExpenses = expenses
    .filter((exp) => !exp.vatDeductible)
    .reduce((sum, exp) => sum + Number(exp.netAmount), 0)

  const accountingProfit = revenue - expenseTotal
  const taxBase = accountingProfit + nonDeductibleExpenses

  return {
    periodFrom: from,
    periodTo: to,
    revenue,
    expenses: expenseTotal,
    nonDeductibleExpenses,
    accountingProfit,
    taxBase,
  }
}
