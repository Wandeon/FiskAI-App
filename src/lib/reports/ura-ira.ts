import { db } from "@/lib/db"
import { Prisma } from "@prisma/client"

export type IraRow = {
  issueDate: Date
  invoiceNumber: string
  buyerName: string | null
  buyerOib: string | null
  netAmount: number
  vatAmount: number
  totalAmount: number
  paidAt: Date | null
  // Tax breakdown
  base25: number
  vat25: number
  base13: number
  vat13: number
  base5: number
  vat5: number
  base0: number
}

export type UraRow = {
  date: Date
  documentRef: string
  vendorName: string | null
  vendorOib: string | null
  netAmount: number
  vatAmount: number
  totalAmount: number
  vatDeductible: boolean
  // Tax breakdown
  base25: number
  vat25: number
  base13: number
  vat13: number
  base5: number
  vat5: number
  base0: number
}

export async function fetchIraRows(companyId: string, from?: Date, to?: Date): Promise<IraRow[]> {
  const toDateInclusive = to
    ? (() => {
        const d = new Date(to)
        d.setHours(23, 59, 59, 999)
        return d
      })()
    : undefined

  const dateFilter =
    from || toDateInclusive
      ? {
          gte: from,
          lte: toDateInclusive,
        }
      : undefined

  const invoices = await db.eInvoice.findMany({
    where: {
      companyId,
      direction: "OUTBOUND",
      status: { not: "DRAFT" },
      ...(dateFilter ? { issueDate: dateFilter } : {}),
    },
    include: {
      buyer: { select: { name: true, oib: true } },
      lines: { select: { netAmount: true, vatAmount: true, vatRate: true } },
    },
    orderBy: { issueDate: "asc" },
  })

  return invoices.map((inv) => {
    // Initialize buckets
    let base25 = 0,
      vat25 = 0
    let base13 = 0,
      vat13 = 0
    let base5 = 0,
      vat5 = 0
    let base0 = 0

    // Aggregate lines
    for (const line of inv.lines) {
      const rate = Number(line.vatRate)
      const net = Number(line.netAmount)
      const vat = Number(line.vatAmount)

      if (Math.abs(rate - 25) < 0.1) {
        base25 += net
        vat25 += vat
      } else if (Math.abs(rate - 13) < 0.1) {
        base13 += net
        vat13 += vat
      } else if (Math.abs(rate - 5) < 0.1) {
        base5 += net
        vat5 += vat
      } else {
        base0 += net
      }
    }

    return {
      issueDate: inv.issueDate,
      invoiceNumber: inv.invoiceNumber,
      buyerName: inv.buyer?.name ?? null,
      buyerOib: inv.buyer?.oib ?? null,
      netAmount: Number(inv.netAmount),
      vatAmount: Number(inv.vatAmount),
      totalAmount: Number(inv.totalAmount),
      paidAt: inv.paidAt,
      base25,
      vat25,
      base13,
      vat13,
      base5,
      vat5,
      base0,
    }
  })
}

export async function fetchUraRows(companyId: string, from?: Date, to?: Date): Promise<UraRow[]> {
  const toDateInclusive = to
    ? (() => {
        const d = new Date(to)
        d.setHours(23, 59, 59, 999)
        return d
      })()
    : undefined

  const dateFilter =
    from || toDateInclusive
      ? {
          gte: from,
          lte: toDateInclusive,
        }
      : undefined

  const expenses = await db.expense.findMany({
    where: {
      companyId,
      status: { not: "DRAFT" },
      ...(dateFilter ? { date: dateFilter } : {}),
    },
    include: {
      vendor: { select: { name: true, oib: true } },
    },
    orderBy: { date: "asc" },
  })

  return expenses.map((exp) => {
    const rate = Number(exp.vatRate)
    const net = Number(exp.netAmount)
    const vat = Number(exp.vatAmount)

    let base25 = 0,
      vat25 = 0
    let base13 = 0,
      vat13 = 0
    let base5 = 0,
      vat5 = 0
    let base0 = 0

    if (Math.abs(rate - 25) < 0.1) {
      base25 = net
      vat25 = vat
    } else if (Math.abs(rate - 13) < 0.1) {
      base13 = net
      vat13 = vat
    } else if (Math.abs(rate - 5) < 0.1) {
      base5 = net
      vat5 = vat
    } else {
      base0 = net
    }

    return {
      date: exp.date,
      documentRef: exp.description,
      vendorName: exp.vendor?.name ?? null,
      vendorOib: exp.vendor?.oib ?? null,
      netAmount: Number(exp.netAmount),
      vatAmount: Number(exp.vatAmount),
      totalAmount: Number(exp.totalAmount),
      vatDeductible: exp.vatDeductible,
      base25,
      vat25,
      base13,
      vat13,
      base5,
      vat5,
      base0,
    }
  })
}

function formatDate(value?: Date | null) {
  if (!value) return ""
  return value.toISOString().slice(0, 10)
}

function escapeCsv(value: string | number | null | undefined) {
  const str = value === undefined || value === null ? "" : String(value)
  if (str.includes(";") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function iraToCsv(rows: IraRow[]): string {
  const header = [
    "Datum izdavanja",
    "Broj računa",
    "Kupac",
    "OIB kupca",
    "Osnovica (EUR)",
    "PDV (EUR)",
    "Ukupno (EUR)",
    "Osnovica 25%",
    "PDV 25%",
    "Osnovica 13%",
    "PDV 13%",
    "Osnovica 5%",
    "PDV 5%",
    "Oslobođeno/0%",
    "Plaćeno",
    "Datum plaćanja",
  ].join(";")

  const dataRows = rows.map((row) =>
    [
      formatDate(row.issueDate),
      row.invoiceNumber,
      row.buyerName ?? "",
      row.buyerOib ?? "",
      row.netAmount.toFixed(2),
      row.vatAmount.toFixed(2),
      row.totalAmount.toFixed(2),
      row.base25.toFixed(2),
      row.vat25.toFixed(2),
      row.base13.toFixed(2),
      row.vat13.toFixed(2),
      row.base5.toFixed(2),
      row.vat5.toFixed(2),
      row.base0.toFixed(2),
      row.paidAt ? "DA" : "NE",
      formatDate(row.paidAt),
    ]
      .map(escapeCsv)
      .join(";")
  )

  return "\uFEFF" + [header, ...dataRows].join("\n")
}

export function uraToCsv(rows: UraRow[]): string {
  const header = [
    "Datum",
    "Opis",
    "Dobavljač",
    "OIB dobavljača",
    "Osnovica (EUR)",
    "PDV (EUR)",
    "Ukupno (EUR)",
    "Osnovica 25%",
    "PDV 25%",
    "Osnovica 13%",
    "PDV 13%",
    "Osnovica 5%",
    "PDV 5%",
    "Oslobođeno/0%",
    "Pretporez",
  ].join(";")

  const dataRows = rows.map((row) =>
    [
      formatDate(row.date),
      row.documentRef,
      row.vendorName ?? "",
      row.vendorOib ?? "",
      row.netAmount.toFixed(2),
      row.vatAmount.toFixed(2),
      row.totalAmount.toFixed(2),
      row.base25.toFixed(2),
      row.vat25.toFixed(2),
      row.base13.toFixed(2),
      row.vat13.toFixed(2),
      row.base5.toFixed(2),
      row.vat5.toFixed(2),
      row.base0.toFixed(2),
      row.vatDeductible ? "DA" : "NE",
    ]
      .map(escapeCsv)
      .join(";")
  )

  return "\uFEFF" + [header, ...dataRows].join("\n")
}
