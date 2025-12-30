import { db } from "@/lib/db"

export type CorporateTaxBaseInputs = {
  periodFrom: Date
  periodTo: Date
  revenue: number
  expenses: number
  glExpenses: number
  depreciation: number
  payroll: number
  nonDeductibleExpenses: number
  accountingProfit: number
  taxBase: number
}

export async function fetchCorporateTaxBaseInputs(
  companyId: string,
  from: Date,
  to: Date
): Promise<CorporateTaxBaseInputs> {
  const toDateInclusive = (() => {
    const date = new Date(to)
    date.setHours(23, 59, 59, 999)
    return date
  })()

  const [journalLines, depreciationEntries, payrollLines, nonDeductibleExpenses] =
    await Promise.all([
      db.journalLine.findMany({
        where: {
          journalEntry: {
            companyId,
            status: "POSTED",
            entryDate: { gte: from, lte: toDateInclusive },
          },
          account: { statementType: "PROFIT_LOSS" },
        },
        select: {
          debit: true,
          credit: true,
          account: { select: { normalBalance: true } },
        },
      }),
      db.depreciationEntry.findMany({
        where: {
          asset: { companyId },
          periodStart: { gte: from, lte: toDateInclusive },
        },
        select: { amount: true },
      }),
      db.payoutLine.findMany({
        where: {
          payout: { companyId, payoutDate: { gte: from, lte: toDateInclusive } },
        },
        select: { grossAmount: true, netAmount: true },
      }),
      db.expense
        .findMany({
          where: {
            companyId,
            date: { gte: from, lte: toDateInclusive },
            status: { in: ["PAID", "PENDING"] },
            vatDeductible: false,
          },
          select: { netAmount: true },
        })
        .then((expenses) => expenses.reduce((sum, exp) => sum + Number(exp.netAmount), 0)),
    ])

  let glRevenue = 0
  let glExpenses = 0

  for (const line of journalLines) {
    const debit = Number(line.debit)
    const credit = Number(line.credit)

    if (line.account.normalBalance === "CREDIT") {
      glRevenue += credit - debit
    } else {
      glExpenses += debit - credit
    }
  }

  const depreciation = depreciationEntries.reduce((sum, entry) => sum + Number(entry.amount), 0)
  const payroll = payrollLines.reduce((sum, line) => {
    const amount = line.grossAmount ?? line.netAmount ?? 0
    return sum + Number(amount)
  }, 0)

  const expensesTotal = glExpenses + depreciation + payroll
  const accountingProfit = glRevenue - expensesTotal
  const taxBase = accountingProfit + nonDeductibleExpenses

  return {
    periodFrom: from,
    periodTo: to,
    revenue: glRevenue,
    expenses: expensesTotal,
    glExpenses,
    depreciation,
    payroll,
    nonDeductibleExpenses,
    accountingProfit,
    taxBase,
  }
}
