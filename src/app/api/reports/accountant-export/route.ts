import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import {
  fetchAccountantExportData,
  invoicesToCsv,
  expensesToCsv,
  kprToCsv,
  summaryToCsv,
} from "@/lib/reports/accountant-export"
import { lockAccountingPeriodsForRange } from "@/lib/period-locking/service"

const querySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  format: z.enum(["csv", "summary", "kpr"]).optional().default("csv"),
})

function parseDate(value?: string) {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    const { searchParams } = new URL(request.url)
    const parsed = querySchema.safeParse({
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
      format: searchParams.get("format") || "csv",
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Neispravan upit", details: parsed.error.format() },
        { status: 400 }
      )
    }

    const fromDate = parseDate(parsed.data.from)
    const toDate = parseDate(parsed.data.to)

    if (parsed.data.from && !fromDate) {
      return NextResponse.json({ error: "Neispravan datum 'from'" }, { status: 400 })
    }
    if (parsed.data.to && !toDate) {
      return NextResponse.json({ error: "Neispravan datum 'to'" }, { status: 400 })
    }

    // Fetch all data
    const exportData = await fetchAccountantExportData(company.id, fromDate, toDate)

    if (fromDate && toDate) {
      await lockAccountingPeriodsForRange(
        company.id,
        fromDate,
        toDate,
        user.id!,
        "export_accountant"
      )
    }

    // Determine filename range label
    const rangeLabel =
      parsed.data.from && parsed.data.to ? `${parsed.data.from}-${parsed.data.to}` : "all"

    // Generate response based on format
    switch (parsed.data.format) {
      case "kpr": {
        const csv = kprToCsv(exportData.kprRows)
        return new NextResponse(csv, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="kpr-${rangeLabel}.csv"`,
          },
        })
      }

      case "summary": {
        const csv = summaryToCsv(exportData)
        return new NextResponse(csv, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="sazetak-${rangeLabel}.csv"`,
          },
        })
      }

      case "csv":
      default: {
        // For CSV format, return invoices by default
        // (Users can call separate endpoints for expenses)
        const csv = invoicesToCsv(exportData.invoices)
        return new NextResponse(csv, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="racuni-${rangeLabel}.csv"`,
          },
        })
      }
    }
  } catch (error) {
    console.error("Accountant export error:", error)
    return NextResponse.json({ error: "Neuspješan izvoz za knjigovođu" }, { status: 500 })
  }
}
