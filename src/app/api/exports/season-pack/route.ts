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
import { createControlSum } from "@/lib/exports/control-sum"
import archiver from "archiver"

const querySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
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

    // Determine filename range label
    const rangeLabel =
      parsed.data.from && parsed.data.to ? `${parsed.data.from}-${parsed.data.to}` : "all"

    // Create ZIP archive
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Maximum compression
    })

    // Create a readable stream from the archive
    const chunks: Buffer[] = []

    archive.on("data", (chunk: Buffer) => {
      chunks.push(chunk)
    })

    archive.on("error", (err) => {
      throw err
    })

    const files = {
      "00-SAZETAK.csv": summaryToCsv(exportData),
      "01-RACUNI.csv": invoicesToCsv(exportData.invoices),
      "02-TROSKOVI.csv": expensesToCsv(exportData.expenses),
      "03-KPR.csv": kprToCsv(exportData.kprRows),
      "PROCITAJ-ME.txt": createReadme(exportData, parsed.data.from, parsed.data.to),
    }

    const controlManifest = {
      generatedAt: new Date().toISOString(),
      files: Object.entries(files).map(([name, content]) => ({
        name,
        bytes: Buffer.byteLength(content),
        controlSum: createControlSum(content),
      })),
    }

    // Add CSV files and README to the archive
    Object.entries(files).forEach(([name, content]) => {
      archive.append(content, { name })
    })

    archive.append(JSON.stringify(controlManifest, null, 2), { name: "CONTROL_SUMS.json" })

    // Finalize the archive
    await archive.finalize()

    // Wait for all chunks to be collected
    await new Promise((resolve) => {
      archive.on("end", resolve)
    })

    // Combine all chunks into a single buffer
    const zipBuffer = Buffer.concat(chunks)
    const controlSum = createControlSum(zipBuffer)

    // Return the ZIP file
    const filename = `fiskai-tax-season-pack-${rangeLabel}.zip`

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": zipBuffer.length.toString(),
        "X-Export-Control-Sum": controlSum,
      },
    })
  } catch (error) {
    console.error("Season pack export error:", error)
    return NextResponse.json({ error: "Neuspješan izvoz tax season paketa" }, { status: 500 })
  }
}

function createReadme(
  exportData: Awaited<ReturnType<typeof fetchAccountantExportData>>,
  from?: string,
  to?: string
): string {
  const lines: string[] = []

  lines.push("=".repeat(70))
  lines.push("FISKAI - TAX SEASON PACK")
  lines.push("Izvoz podataka za knjigovođu")
  lines.push("=".repeat(70))
  lines.push("")

  lines.push(`Tvrtka: ${exportData.companyName}`)
  lines.push(`OIB: ${exportData.companyOib}`)
  if (exportData.companyVatNumber) {
    lines.push(`PDV broj: ${exportData.companyVatNumber}`)
  }
  lines.push(`Razdoblje: ${from || "početak"} - ${to || "kraj"}`)
  lines.push(`Datum izvoza: ${new Date().toISOString().slice(0, 10)}`)
  lines.push("")

  lines.push("SADRŽAJ PAKETA")
  lines.push("-".repeat(70))
  lines.push("")

  lines.push("1. 00-SAZETAK.csv")
  lines.push("   Sažetak prihoda, rashoda i rezultata za razdoblje.")
  lines.push("")

  lines.push("2. 01-RACUNI.csv")
  lines.push("   Popis svih računa (izdanih i primljenih).")
  lines.push(`   Ukupno: ${exportData.invoices.length} računa`)
  lines.push(`   Ukupan prihod: ${exportData.totals.totalIncomeGross.toFixed(2)} EUR`)
  lines.push("")

  lines.push("3. 02-TROSKOVI.csv")
  lines.push("   Popis svih troškova s detaljima.")
  lines.push(`   Ukupno: ${exportData.expenses.length} troškova`)
  lines.push(`   Ukupan trošak: ${exportData.totals.totalExpensesGross.toFixed(2)} EUR`)
  lines.push("")

  lines.push("4. 03-KPR.csv")
  lines.push("   Knjiga Primitaka i Izdataka (KPR) - samo plaćeni računi.")
  lines.push(`   Ukupno: ${exportData.kprRows.length} plaćenih računa`)
  lines.push("")

  lines.push("NAPOMENE ZA KNJIGOVOĐU")
  lines.push("-".repeat(70))
  lines.push("")

  lines.push("• CSV datoteke koriste UTF-8 BOM encoding (podržano u Excel-u).")
  lines.push("• Separator polja je točka-zarez (;).")
  lines.push("• Svi iznosi su u eurima (EUR) s točno 2 decimale.")
  lines.push("• Datumi su u ISO formatu (YYYY-MM-DD).")
  lines.push("")

  lines.push("• Za troškove je uključen 'Link na račun' - direktan URL do")
  lines.push("  skeniranog računa u sustavu.")
  lines.push("")

  lines.push("• KPR datoteka sadrži samo plaćene račune (potrebno za paušalni obrt).")
  lines.push("")

  lines.push("REZULTAT RAZDOBLJA")
  lines.push("-".repeat(70))
  lines.push("")

  lines.push(
    `Prihodi (bruto):    ${exportData.totals.totalIncomeGross.toFixed(2).padStart(12)} EUR`
  )
  lines.push(
    `Rashodi (bruto):    ${exportData.totals.totalExpensesGross.toFixed(2).padStart(12)} EUR`
  )
  lines.push(`                    ${"-".repeat(18)}`)
  lines.push(`Neto rezultat:      ${exportData.totals.netProfit.toFixed(2).padStart(12)} EUR`)
  lines.push("")

  lines.push("=".repeat(70))
  lines.push("Generirao: FiskAI - AI računovodstvo za paušalni obrt")
  lines.push("Web: https://fiskai.hr")
  lines.push("=".repeat(70))

  return lines.join("\n")
}
