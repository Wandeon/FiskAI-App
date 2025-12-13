import { db } from "@/lib/db"
import { Decimal } from "@prisma/client/runtime/library"

export type KprRow = {
  paidAt: Date | null
  issueDate: Date | null
  invoiceNumber: string | null
  buyerName: string | null
  netAmount: number
  vatAmount: number
  totalAmount: number
}

export type KprSummary = {
  rows: KprRow[]
  totalNet: number
  totalVat: number
  totalGross: number
  byMonth: Record<string, KprSummary>
}

export async function fetchKpr(companyId: string, from?: Date, to?: Date): Promise<KprSummary> {
  const invoices = await db.eInvoice.findMany({
    where: {
      companyId,
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

  const rows: KprRow[] = invoices.map((inv) => ({
    paidAt: inv.paidAt,
    issueDate: inv.issueDate,
    invoiceNumber: inv.invoiceNumber,
    buyerName: inv.buyer?.name || null,
    netAmount: numberFromDecimal(inv.netAmount),
    vatAmount: numberFromDecimal(inv.vatAmount),
    totalAmount: numberFromDecimal(inv.totalAmount),
  }))

  const totalNet = rows.reduce((sum, r) => sum + (r.netAmount || 0), 0)
  const totalVat = rows.reduce((sum, r) => sum + (r.vatAmount || 0), 0)
  const totalGross = rows.reduce((sum, r) => sum + (r.totalAmount || 0), 0)

  const byMonth = rows.reduce<Record<string, KprSummary>>((acc, row) => {
    const key = row.paidAt ? `${row.paidAt.getFullYear()}-${String(row.paidAt.getMonth() + 1).padStart(2, "0")}` : "unknown"
    if (!acc[key]) {
      acc[key] = { rows: [], totalNet: 0, totalVat: 0, totalGross: 0, byMonth: {} }
    }
    acc[key].rows.push(row)
    acc[key].totalNet += row.netAmount
    acc[key].totalVat += row.vatAmount
    acc[key].totalGross += row.totalAmount
    return acc
  }, {})

  return { rows, totalNet, totalVat, totalGross, byMonth }
}

export function kprToCsv(summary: KprSummary): string {
  const header = ["Datum plaćanja", "Datum izdavanja", "Broj računa", "Kupac", "Osnovica", "PDV", "Ukupno"].join(",")
  const lines = summary.rows.map((r) =>
    [
      formatDate(r.paidAt),
      formatDate(r.issueDate),
      r.invoiceNumber || "",
      escapeCsv(r.buyerName || ""),
      r.netAmount.toFixed(2),
      r.vatAmount.toFixed(2),
      r.totalAmount.toFixed(2),
    ].join(",")
  )
  const totals = ["", "", "", "UKUPNO", summary.totalNet.toFixed(2), summary.totalVat.toFixed(2), summary.totalGross.toFixed(2)].join(",")
  return [header, ...lines, totals].join("\n")
}

export function posdXml(summary: KprSummary, from?: Date, to?: Date): string {
  const periodFrom = from ? formatDate(from) : ""
  const periodTo = to ? formatDate(to) : ""
  const totalInvoices = summary.rows.length
  const paidGross = summary.totalGross.toFixed(2)

  return `<?xml version="1.0" encoding="UTF-8"?>
<POSDReport>
  <Period>
    <From>${periodFrom}</From>
    <To>${periodTo}</To>
  </Period>
  <Totals>
    <InvoiceCount>${totalInvoices}</InvoiceCount>
    <TotalNet>${summary.totalNet.toFixed(2)}</TotalNet>
    <TotalVAT>${summary.totalVat.toFixed(2)}</TotalVAT>
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
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
