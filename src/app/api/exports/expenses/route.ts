import { NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser, getCurrentCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"

const querySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  format: z.enum(["csv", "json", "xml"]).optional().default("csv"),
})

function parseDate(value?: string) {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function formatDate(value?: Date | null) {
  if (!value) return ""
  return value.toISOString().slice(0, 10)
}

function money(value: any) {
  const num = Number(value || 0)
  return Number.isFinite(num) ? num.toFixed(2) : ""
}

function csvEscape(value: string | number | null | undefined) {
  const str = value === undefined || value === null ? "" : String(value)
  if (str.includes(";") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function buildCsv(rows: Array<Array<string | number | null | undefined>>) {
  return rows.map((row) => row.map(csvEscape).join(";")).join("\n")
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function buildExpensesXml(expenses: any[]): string {
  const lines = expenses
    .map(
      (exp) => `
    <Expense>
      <Date>${formatDate(exp.date)}</Date>
      <Description>${escapeXml(exp.description || "")}</Description>
      <Vendor>
        <Name>${escapeXml(exp.vendor?.name || "")}</Name>
        <OIB>${escapeXml(exp.vendor?.oib || "")}</OIB>
      </Vendor>
      <Category>${escapeXml(exp.category?.name || exp.category?.code || "")}</Category>
      <Status>${escapeXml(exp.status || "")}</Status>
      <NetAmount>${money(exp.netAmount)}</NetAmount>
      <VATAmount>${money(exp.vatAmount)}</VATAmount>
      <TotalAmount>${money(exp.totalAmount)}</TotalAmount>
      <Paid>${exp.status === "PAID" || exp.paymentDate ? "true" : "false"}</Paid>
      <PaymentDate>${formatDate(exp.paymentDate)}</PaymentDate>
      <PaymentMethod>${escapeXml(exp.paymentMethod || "")}</PaymentMethod>
      <ReceiptUrl>${escapeXml(exp.receiptUrl || "")}</ReceiptUrl>
      <Notes>${escapeXml(exp.notes || "")}</Notes>
    </Expense>`
    )
    .join("")

  return `<?xml version="1.0" encoding="UTF-8"?>
<Expenses xmlns="urn:fiskai:exports:expenses:1.0">
  <ExportDate>${new Date().toISOString()}</ExportDate>
  <Count>${expenses.length}</Count>${lines}
</Expenses>`
}

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const company = await getCurrentCompany(user.id!)
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 })
  }

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: "Neispravan upit" }, { status: 400 })
  }

  const fromDate = parseDate(parsed.data.from)
  const toDate = parseDate(parsed.data.to)

  if (parsed.data.from && !fromDate) {
    return NextResponse.json({ error: "Neispravan datum 'from'" }, { status: 400 })
  }
  if (parsed.data.to && !toDate) {
    return NextResponse.json({ error: "Neispravan datum 'to'" }, { status: 400 })
  }

  const toDateInclusive = toDate
    ? (() => {
        const d = new Date(toDate)
        d.setHours(23, 59, 59, 999)
        return d
      })()
    : undefined

  const dateFilter =
    fromDate || toDateInclusive
      ? {
          gte: fromDate,
          lte: toDateInclusive,
        }
      : undefined

  const expenses = await db.expense.findMany({
    where: {
      companyId: company.id,
      ...(dateFilter ? { date: dateFilter } : {}),
    },
    include: {
      vendor: { select: { name: true, oib: true } },
      category: { select: { name: true, code: true } },
    },
    orderBy: { date: "asc" },
  })

  const header = [
    "Datum",
    "Opis",
    "Dobavljač",
    "OIB dobavljača",
    "Kategorija",
    "Status",
    "Osnovica",
    "PDV",
    "Ukupno",
    "Plaćeno",
    "Datum plaćanja",
    "Način plaćanja",
    "Link na račun/sliku",
    "Napomena",
  ]

  const rows = expenses.map((expense) => [
    formatDate(expense.date),
    expense.description,
    expense.vendor?.name ?? "",
    expense.vendor?.oib ?? "",
    expense.category?.name ?? expense.category?.code ?? "",
    expense.status,
    money(expense.netAmount),
    money(expense.vatAmount),
    money(expense.totalAmount),
    expense.status === "PAID" || expense.paymentDate ? "DA" : "NE",
    formatDate(expense.paymentDate),
    expense.paymentMethod ?? "",
    expense.receiptUrl ?? "",
    expense.notes ?? "",
  ])

  const rangeLabel =
    parsed.data.from && parsed.data.to ? `${parsed.data.from}-${parsed.data.to}` : "svi"
  const format = parsed.data.format

  if (format === "json") {
    const jsonData = {
      exportDate: new Date().toISOString(),
      dateRange: { from: parsed.data.from, to: parsed.data.to },
      count: expenses.length,
      expenses: expenses.map((exp) => ({
        date: formatDate(exp.date),
        description: exp.description,
        vendor: exp.vendor ? { name: exp.vendor.name, oib: exp.vendor.oib } : null,
        category: exp.category?.name || exp.category?.code || null,
        status: exp.status,
        netAmount: money(exp.netAmount),
        vatAmount: money(exp.vatAmount),
        totalAmount: money(exp.totalAmount),
        paid: exp.status === "PAID" || !!exp.paymentDate,
        paymentDate: formatDate(exp.paymentDate),
        paymentMethod: exp.paymentMethod || null,
        receiptUrl: exp.receiptUrl || null,
        notes: exp.notes || null,
      })),
    }
    const filename = `fiskai-troskovi-${rangeLabel}.json`
    return new NextResponse(JSON.stringify(jsonData, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  }

  if (format === "xml") {
    const xml = buildExpensesXml(expenses)
    const filename = `fiskai-troskovi-${rangeLabel}.xml`
    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  }

  // Default: CSV format
  const csv = "\uFEFF" + buildCsv([header, ...rows])
  const filename = `fiskai-troskovi-${rangeLabel}.csv`

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
