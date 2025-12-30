import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { createControlSum } from "@/lib/exports/control-sum"
import { fetchIraRows, iraToCsv } from "@/lib/reports/ura-ira"

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    const { searchParams } = new URL(request.url)
    const fromParam = searchParams.get("from")
    const toParam = searchParams.get("to")

    const from = fromParam ? new Date(fromParam) : undefined
    const to = toParam ? new Date(toParam) : undefined

    if (fromParam && isNaN(from?.getTime() ?? NaN)) {
      return NextResponse.json({ error: "Neispravan datum 'from'" }, { status: 400 })
    }

    if (toParam && isNaN(to?.getTime() ?? NaN)) {
      return NextResponse.json({ error: "Neispravan datum 'to'" }, { status: 400 })
    }

    const rows = await fetchIraRows(company.id, from, to)
    const csv = iraToCsv(rows)
    const controlSum = createControlSum(csv)

    const rangeLabel = from && to ? `${fromParam}-${toParam}` : "all"
    const filename = `ira-${company.oib}-${rangeLabel}.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Export-Control-Sum": controlSum,
      },
    })
  } catch (error) {
    console.error("IRA export error:", error)
    return NextResponse.json({ error: "Neuspješan IRA izvoz" }, { status: 500 })
  }
}
