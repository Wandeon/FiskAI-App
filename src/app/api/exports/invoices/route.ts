import { NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser, getCurrentCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { createControlSum } from "@/lib/exports/control-sum"

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

function buildInvoicesXml(invoices: any[]): string {
  const lines = invoices
    .map(
      (inv) => `
    <Invoice>
      <InvoiceNumber>${escapeXml(inv.invoiceNumber || "")}</InvoiceNumber>
      <IssueDate>${formatDate(inv.issueDate)}</IssueDate>
      <DueDate>${formatDate(inv.dueDate)}</DueDate>
      <Buyer>
        <Name>${escapeXml(inv.buyer?.name || "")}</Name>
        <OIB>${escapeXml(inv.buyer?.oib || "")}</OIB>
        <Email>${escapeXml(inv.buyer?.email || "")}</Email>
      </Buyer>
      <Direction>${escapeXml(inv.direction || "")}</Direction>
      <Type>${escapeXml(inv.type || "")}</Type>
      <Status>${escapeXml(inv.status || "")}</Status>
      <NetAmount>${money(inv.netAmount)}</NetAmount>
      <VATAmount>${money(inv.vatAmount)}</VATAmount>
      <TotalAmount>${money(inv.totalAmount)}</TotalAmount>
      <Paid>${inv.paidAt ? "true" : "false"}</Paid>
      <PaidDate>${formatDate(inv.paidAt)}</PaidDate>
      <Reference>${escapeXml(inv.providerRef || inv.internalReference || "")}</Reference>
    </Invoice>`
    )
    .join("")

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoices xmlns="urn:fiskai:exports:invoices:1.0">
  <ExportDate>${new Date().toISOString()}</ExportDate>
  <Count>${invoices.length}</Count>${lines}
</Invoices>`
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

  const invoices = await db.eInvoice.findMany({
    where: {
      companyId: company.id,
      ...(dateFilter ? { issueDate: dateFilter } : {}),
    },
    include: {
      buyer: {
        select: { name: true, oib: true, vatNumber: true, email: true },
      },
      seller: {
        select: { name: true, oib: true, vatNumber: true, email: true },
      },
    },
    orderBy: { issueDate: "asc" },
  })

  const header = [
    "Broj računa",
    "Datum izdavanja",
    "Dospiće",
    "Kupac",
    "OIB kupca",
    "Email kupca",
    "Smjer",
    "Vrsta",
    "Status",
    "Osnovica",
    "PDV",
    "Ukupno",
    "Plaćeno",
    "Datum plaćanja",
    "Referenca",
  ]

  const rows = invoices.map((invoice) => [
    invoice.invoiceNumber,
    formatDate(invoice.issueDate),
    formatDate(invoice.dueDate),
    invoice.buyer?.name ?? "",
    invoice.buyer?.oib ?? "",
    invoice.buyer?.email ?? "",
    invoice.direction,
    invoice.type,
    invoice.status,
    money(invoice.netAmount),
    money(invoice.vatAmount),
    money(invoice.totalAmount),
    invoice.paidAt ? "DA" : "NE",
    formatDate(invoice.paidAt),
    invoice.providerRef || invoice.internalReference || "",
  ])

  const rangeLabel =
    parsed.data.from && parsed.data.to ? `${parsed.data.from}-${parsed.data.to}` : "svi"
  const format = parsed.data.format

  if (format === "json") {
    const jsonData = {
      exportDate: new Date().toISOString(),
      dateRange: { from: parsed.data.from, to: parsed.data.to },
      count: invoices.length,
      invoices: invoices.map((inv) => ({
        invoiceNumber: inv.invoiceNumber,
        issueDate: formatDate(inv.issueDate),
        dueDate: formatDate(inv.dueDate),
        buyer: inv.buyer
          ? { name: inv.buyer.name, oib: inv.buyer.oib, email: inv.buyer.email }
          : null,
        direction: inv.direction,
        type: inv.type,
        status: inv.status,
        netAmount: money(inv.netAmount),
        vatAmount: money(inv.vatAmount),
        totalAmount: money(inv.totalAmount),
        paid: !!inv.paidAt,
        paidDate: formatDate(inv.paidAt),
        reference: inv.providerRef || inv.internalReference || null,
      })),
    }
    const filename = `fiskai-racuni-${rangeLabel}.json`
    const body = JSON.stringify(jsonData, null, 2)
    const controlSum = createControlSum(body)
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Export-Control-Sum": controlSum,
      },
    })
  }

  if (format === "xml") {
    const xml = buildInvoicesXml(invoices)
    const controlSum = createControlSum(xml)
    const filename = `fiskai-racuni-${rangeLabel}.xml`
    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Export-Control-Sum": controlSum,
      },
    })
  }

  // Default: CSV format
  const csv = "\uFEFF" + buildCsv([header, ...rows])
  const controlSum = createControlSum(csv)
  const filename = `fiskai-racuni-${rangeLabel}.csv`

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Export-Control-Sum": controlSum,
    },
  })
}
