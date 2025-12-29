import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import {
  fetchAccountantExportData,
  invoicesToCsv,
  expensesToCsv,
  kprToCsv,
  summaryToCsv,
} from "@/lib/reports/accountant-export"
import JSZip from "jszip"

const querySchema = z.object({
  clientIds: z.string(), // comma-separated list of client IDs
  from: z.string().optional(),
  to: z.string().optional(),
  format: z.enum(["csv", "summary", "kpr", "combined"]).optional().default("combined"),
  exportType: z.enum(["invoices", "expenses", "kpr", "summary", "all"]).optional().default("all"),
})

function parseDate(value?: string) {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.systemRole !== "STAFF" && user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden - Staff access required" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const parsed = querySchema.safeParse({
      clientIds: searchParams.get("clientIds") || "",
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
      format: searchParams.get("format") || "combined",
      exportType: searchParams.get("exportType") || "all",
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.format() },
        { status: 400 }
      )
    }

    const clientIds = parsed.data.clientIds.split(",").filter(Boolean)

    if (clientIds.length === 0) {
      return NextResponse.json({ error: "No client IDs provided" }, { status: 400 })
    }

    // Verify staff has access to all requested clients
    const assignments = await db.staffAssignment.findMany({
      where: {
        staffId: user.id,
        companyId: { in: clientIds },
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            oib: true,
          },
        },
      },
    })

    if (assignments.length !== clientIds.length) {
      return NextResponse.json(
        { error: "Access denied to one or more clients" },
        { status: 403 }
      )
    }

    const fromDate = parseDate(parsed.data.from)
    const toDate = parseDate(parsed.data.to)

    if (parsed.data.from && !fromDate) {
      return NextResponse.json({ error: "Invalid 'from' date" }, { status: 400 })
    }
    if (parsed.data.to && !toDate) {
      return NextResponse.json({ error: "Invalid 'to' date" }, { status: 400 })
    }

    // Determine filename range label
    const rangeLabel =
      parsed.data.from && parsed.data.to ? `${parsed.data.from}-${parsed.data.to}` : "all"

    // For single client, return direct CSV
    if (clientIds.length === 1 && parsed.data.format !== "combined") {
      const companyId = clientIds[0]
      const exportData = await fetchAccountantExportData(companyId, fromDate, toDate)

      let csv: string
      let filename: string

      switch (parsed.data.exportType) {
        case "invoices":
          csv = invoicesToCsv(exportData.invoices)
          filename = `racuni-${exportData.companyName}-${rangeLabel}.csv`
          break
        case "expenses":
          csv = expensesToCsv(exportData.expenses)
          filename = `troskovi-${exportData.companyName}-${rangeLabel}.csv`
          break
        case "kpr":
          csv = kprToCsv(exportData.kprRows)
          filename = `kpr-${exportData.companyName}-${rangeLabel}.csv`
          break
        case "summary":
          csv = summaryToCsv(exportData)
          filename = `sazetak-${exportData.companyName}-${rangeLabel}.csv`
          break
        default:
          csv = summaryToCsv(exportData)
          filename = `izvoz-${exportData.companyName}-${rangeLabel}.csv`
      }

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      })
    }

    // For multiple clients or combined format, create a ZIP archive
    const zip = new JSZip()

    // Create aggregate data structures
    const aggregateData = {
      totalClients: clientIds.length,
      periodFrom: fromDate,
      periodTo: toDate,
      clients: [] as Array<{
        name: string
        oib: string
        totals: {
          totalIncome: number
          totalIncomeVat: number
          totalIncomeGross: number
          totalExpenses: number
          totalExpensesVat: number
          totalExpensesGross: number
          netProfit: number
        }
      }>,
      grandTotals: {
        totalIncome: 0,
        totalIncomeVat: 0,
        totalIncomeGross: 0,
        totalExpenses: 0,
        totalExpensesVat: 0,
        totalExpensesGross: 0,
        netProfit: 0,
      },
    }

    // Process each client
    for (const assignment of assignments) {
      const exportData = await fetchAccountantExportData(
        assignment.company.id,
        fromDate,
        toDate
      )

      const clientFolder = `${assignment.company.name.replace(/[^a-zA-Z0-9-]/g, "_")}_${assignment.company.oib}`

      // Add client data to aggregate
      aggregateData.clients.push({
        name: exportData.companyName,
        oib: exportData.companyOib,
        totals: exportData.totals,
      })

      // Update grand totals
      aggregateData.grandTotals.totalIncome += exportData.totals.totalIncome
      aggregateData.grandTotals.totalIncomeVat += exportData.totals.totalIncomeVat
      aggregateData.grandTotals.totalIncomeGross += exportData.totals.totalIncomeGross
      aggregateData.grandTotals.totalExpenses += exportData.totals.totalExpenses
      aggregateData.grandTotals.totalExpensesVat += exportData.totals.totalExpensesVat
      aggregateData.grandTotals.totalExpensesGross += exportData.totals.totalExpensesGross
      aggregateData.grandTotals.netProfit += exportData.totals.netProfit

      // Add files based on export type
      if (parsed.data.exportType === "all" || parsed.data.exportType === "invoices") {
        zip.file(`${clientFolder}/racuni.csv`, invoicesToCsv(exportData.invoices))
      }
      if (parsed.data.exportType === "all" || parsed.data.exportType === "expenses") {
        zip.file(`${clientFolder}/troskovi.csv`, expensesToCsv(exportData.expenses))
      }
      if (parsed.data.exportType === "all" || parsed.data.exportType === "kpr") {
        zip.file(`${clientFolder}/kpr.csv`, kprToCsv(exportData.kprRows))
      }
      if (parsed.data.exportType === "all" || parsed.data.exportType === "summary") {
        zip.file(`${clientFolder}/sazetak.csv`, summaryToCsv(exportData))
      }
    }

    // Add aggregate summary at root level
    const aggregateSummary = generateAggregateSummary(aggregateData, rangeLabel)
    zip.file("UKUPNI_SAZETAK.csv", aggregateSummary)

    // Generate ZIP file
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" })

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="bulk-export-${clientIds.length}-clients-${rangeLabel}.zip"`,
      },
    })
  } catch (error) {
    console.error("Bulk export error:", error)
    return NextResponse.json(
      { error: "Bulk export failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

function generateAggregateSummary(
  data: {
    totalClients: number
    periodFrom?: Date
    periodTo?: Date
    clients: Array<{
      name: string
      oib: string
      totals: {
        totalIncome: number
        totalIncomeVat: number
        totalIncomeGross: number
        totalExpenses: number
        totalExpensesVat: number
        totalExpensesGross: number
        netProfit: number
      }
    }>
    grandTotals: {
      totalIncome: number
      totalIncomeVat: number
      totalIncomeGross: number
      totalExpenses: number
      totalExpensesVat: number
      totalExpensesGross: number
      netProfit: number
    }
  },
  rangeLabel: string
): string {
  const lines: string[] = []

  lines.push(`\uFEFFZbirni izvještaj - Više klijenata`)
  lines.push(`Broj klijenata;${data.totalClients}`)
  lines.push(`Razdoblje;${rangeLabel}`)
  lines.push(`Datum izvoza;${new Date().toISOString().slice(0, 10)}`)
  lines.push("")

  lines.push("UKUPNO - SVI KLIJENTI")
  lines.push(`Ukupni prihod (osnovica);${data.grandTotals.totalIncome.toFixed(2)} EUR`)
  lines.push(`Ukupan PDV na prihode;${data.grandTotals.totalIncomeVat.toFixed(2)} EUR`)
  lines.push(`Ukupni prihod (bruto);${data.grandTotals.totalIncomeGross.toFixed(2)} EUR`)
  lines.push("")
  lines.push(`Ukupni rashodi (osnovica);${data.grandTotals.totalExpenses.toFixed(2)} EUR`)
  lines.push(`Ukupan PDV na rashode;${data.grandTotals.totalExpensesVat.toFixed(2)} EUR`)
  lines.push(`Ukupni rashodi (bruto);${data.grandTotals.totalExpensesGross.toFixed(2)} EUR`)
  lines.push("")
  lines.push(`NETO DOBIT/GUBITAK;${data.grandTotals.netProfit.toFixed(2)} EUR`)
  lines.push("")
  lines.push("")

  lines.push("PREGLED PO KLIJENTIMA")
  lines.push(
    "Naziv;OIB;Prihodi (EUR);PDV prihodi;Rashodi (EUR);PDV rashodi;Neto dobit/gubitak"
  )

  for (const client of data.clients) {
    lines.push(
      [
        escapeCsv(client.name),
        client.oib,
        client.totals.totalIncomeGross.toFixed(2),
        client.totals.totalIncomeVat.toFixed(2),
        client.totals.totalExpensesGross.toFixed(2),
        client.totals.totalExpensesVat.toFixed(2),
        client.totals.netProfit.toFixed(2),
      ].join(";")
    )
  }

  return lines.join("\n")
}

function escapeCsv(value: string): string {
  if (value.includes(";") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
