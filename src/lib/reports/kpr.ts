import { db } from "@/lib/db"
import { Prisma } from "@prisma/client"
type Decimal = Prisma.Decimal

export type KprRow = {
  date: Date | null
  documentNumber: string | null
  description: string | null
  income: number
  expense: number
  balance: number
  type: "INCOME" | "EXPENSE"
  // Legacy fields for backwards compatibility
  paidAt?: Date | null
  issueDate?: Date | null
  invoiceNumber?: string | null
  buyerName?: string | null
  netAmount?: number
  vatAmount?: number
  totalAmount?: number
}

export type KprSummary = {
  rows: KprRow[]
  totalIncome: number
  totalExpense: number
  netIncome: number
  byMonth: Record<string, MonthlyKprSummary>
  byQuarter?: Record<string, QuarterlyKprSummary>
  // Legacy fields for backwards compatibility
  totalNet?: number
  totalVat?: number
  totalGross?: number
}

export type MonthlyKprSummary = {
  rows: KprRow[]
  totalIncome: number
  totalExpense: number
  netIncome: number
  period: string
}

export type QuarterlyKprSummary = {
  months: Record<string, MonthlyKprSummary>
  totalIncome: number
  totalExpense: number
  netIncome: number
  period: string
}

export async function fetchKpr(companyId: string, from?: Date, to?: Date): Promise<KprSummary> {
  // Fetch paid invoices (income)
  const invoices = await db.eInvoice.findMany({
    where: {
      companyId,
      direction: "OUTBOUND",
      paidAt: { not: null, ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) },
    },
    orderBy: [{ paidAt: "asc" }],
    select: {
      paidAt: true,
      issueDate: true,
      invoiceNumber: true,
      buyer: { select: { name: true } },
      totalAmount: true,
      netAmount: true,
      vatAmount: true,
    },
  })

  // Fetch paid expenses
  const expenses = await db.expense.findMany({
    where: {
      companyId,
      status: "PAID",
      paymentDate: { not: null, ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) },
    },
    orderBy: [{ paymentDate: "asc" }],
    select: {
      paymentDate: true,
      date: true,
      description: true,
      vendor: { select: { name: true } },
      totalAmount: true,
      netAmount: true,
      vatAmount: true,
    },
  })

  // Convert to unified KPR rows
  const incomeRows: KprRow[] = invoices.map((inv) => ({
    date: inv.paidAt,
    documentNumber: inv.invoiceNumber,
    description: `Račun za ${inv.buyer?.name || "nepoznati kupac"}`,
    income: numberFromDecimal(inv.totalAmount),
    expense: 0,
    balance: 0, // Will be calculated later
    type: "INCOME" as const,
    // Legacy compatibility
    paidAt: inv.paidAt,
    issueDate: inv.issueDate,
    invoiceNumber: inv.invoiceNumber,
    buyerName: inv.buyer?.name || null,
    netAmount: numberFromDecimal(inv.netAmount),
    vatAmount: numberFromDecimal(inv.vatAmount),
    totalAmount: numberFromDecimal(inv.totalAmount),
  }))

  const expenseRows: KprRow[] = expenses.map((exp) => ({
    date: exp.paymentDate,
    documentNumber: `EXP-${exp.date.toISOString().slice(0, 10)}`,
    description: `${exp.description} (${exp.vendor?.name || "nepoznati dobavljač"})`,
    income: 0,
    expense: numberFromDecimal(exp.totalAmount),
    balance: 0, // Will be calculated later
    type: "EXPENSE" as const,
  }))

  // Combine and sort all rows by date
  const allRows = [...incomeRows, ...expenseRows].sort((a, b) => {
    const dateA = a.date?.getTime() || 0
    const dateB = b.date?.getTime() || 0
    return dateA - dateB
  })

  // Calculate running balance
  let runningBalance = 0
  allRows.forEach((row) => {
    runningBalance += row.income - row.expense
    row.balance = runningBalance
  })

  // Calculate totals
  const totalIncome = allRows.reduce((sum, r) => sum + r.income, 0)
  const totalExpense = allRows.reduce((sum, r) => sum + r.expense, 0)
  const netIncome = totalIncome - totalExpense

  // Group by month
  const byMonth = allRows.reduce<Record<string, MonthlyKprSummary>>((acc, row) => {
    const key = row.date
      ? `${row.date.getFullYear()}-${String(row.date.getMonth() + 1).padStart(2, "0")}`
      : "unknown"

    if (!acc[key]) {
      acc[key] = {
        rows: [],
        totalIncome: 0,
        totalExpense: 0,
        netIncome: 0,
        period: key,
      }
    }

    acc[key].rows.push(row)
    acc[key].totalIncome += row.income
    acc[key].totalExpense += row.expense
    acc[key].netIncome += row.income - row.expense

    return acc
  }, {})

  // Group by quarter
  const byQuarter = Object.entries(byMonth).reduce<Record<string, QuarterlyKprSummary>>(
    (acc, [monthKey, monthData]) => {
      if (monthKey === "unknown") return acc

      const [year, month] = monthKey.split("-")
      const quarter = Math.ceil(parseInt(month) / 3)
      const quarterKey = `${year}-Q${quarter}`

      if (!acc[quarterKey]) {
        acc[quarterKey] = {
          months: {},
          totalIncome: 0,
          totalExpense: 0,
          netIncome: 0,
          period: quarterKey,
        }
      }

      acc[quarterKey].months[monthKey] = monthData
      acc[quarterKey].totalIncome += monthData.totalIncome
      acc[quarterKey].totalExpense += monthData.totalExpense
      acc[quarterKey].netIncome += monthData.netIncome

      return acc
    },
    {}
  )

  // Legacy compatibility
  const totalNet = incomeRows.reduce((sum, r) => sum + (r.netAmount || 0), 0)
  const totalVat = incomeRows.reduce((sum, r) => sum + (r.vatAmount || 0), 0)
  const totalGross = incomeRows.reduce((sum, r) => sum + (r.totalAmount || 0), 0)

  return {
    rows: allRows,
    totalIncome,
    totalExpense,
    netIncome,
    byMonth,
    byQuarter,
    // Legacy compatibility
    totalNet,
    totalVat,
    totalGross,
  }
}

export function kprToCsv(summary: KprSummary): string {
  // New Croatian-compliant KPR format
  const header = [
    "Redni broj",
    "Datum",
    "Broj računa/dokumenta",
    "Opis",
    "Primitak (Prihod)",
    "Izdatak (Trošak)",
    "Saldo",
  ].join(",")

  const lines = summary.rows.map((r, idx) =>
    [
      idx + 1,
      formatDate(r.date),
      escapeCsv(r.documentNumber || ""),
      escapeCsv(r.description || ""),
      r.income.toFixed(2),
      r.expense.toFixed(2),
      r.balance.toFixed(2),
    ].join(",")
  )

  const totals = [
    "",
    "",
    "",
    "UKUPNO",
    summary.totalIncome.toFixed(2),
    summary.totalExpense.toFixed(2),
    summary.netIncome.toFixed(2),
  ].join(",")

  return [header, ...lines, totals].join("\n")
}

// Legacy CSV export for backwards compatibility
export function kprToCsvLegacy(summary: KprSummary): string {
  const header = [
    "Datum plaćanja",
    "Datum izdavanja",
    "Broj računa",
    "Kupac",
    "Osnovica",
    "PDV",
    "Ukupno",
  ].join(",")
  const lines = summary.rows
    .filter((r) => r.type === "INCOME")
    .map((r) =>
      [
        formatDate(r.paidAt ?? null),
        formatDate(r.issueDate ?? null),
        r.invoiceNumber || "",
        escapeCsv(r.buyerName || ""),
        (r.netAmount || 0).toFixed(2),
        (r.vatAmount || 0).toFixed(2),
        (r.totalAmount || 0).toFixed(2),
      ].join(",")
    )
  const totals = [
    "",
    "",
    "",
    "UKUPNO",
    (summary.totalNet || 0).toFixed(2),
    (summary.totalVat || 0).toFixed(2),
    (summary.totalGross || 0).toFixed(2),
  ].join(",")
  return [header, ...lines, totals].join("\n")
}

export function posdXml(summary: KprSummary, from?: Date, to?: Date): string {
  const periodFrom = from ? formatDate(from) : ""
  const periodTo = to ? formatDate(to) : ""
  const totalInvoices = summary.rows.length
  const paidGross = (summary.totalGross ?? 0).toFixed(2)

  return `<?xml version="1.0" encoding="UTF-8"?>
<POSDReport>
  <Period>
    <From>${periodFrom}</From>
    <To>${periodTo}</To>
  </Period>
  <Totals>
    <InvoiceCount>${totalInvoices}</InvoiceCount>
    <TotalNet>${(summary.totalNet ?? 0).toFixed(2)}</TotalNet>
    <TotalVAT>${(summary.totalVat ?? 0).toFixed(2)}</TotalVAT>
    <TotalGross>${paidGross}</TotalGross>
  </Totals>
</POSDReport>`
}

function numberFromDecimal(value: Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  if (typeof value === "number") return value
  return Number(value.toString())
}

function formatDate(date: Date | null): string {
  if (!date) return ""
  return date.toISOString().slice(0, 10)
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
