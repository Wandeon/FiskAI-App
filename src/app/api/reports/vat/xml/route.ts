import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { generatePdvFormForPeriod, validatePdvFormData } from "@/lib/reports/pdv-xml-generator"

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    const { searchParams } = new URL(request.url)
    const fromParam = searchParams.get("from")
    const toParam = searchParams.get("to")

    if (!fromParam || !toParam) {
      return NextResponse.json({ error: "Datumi 'from' i 'to' su obavezni" }, { status: 400 })
    }

    const dateFrom = new Date(fromParam)
    const dateTo = new Date(toParam)

    // Validate dates
    if (isNaN(dateFrom.getTime()) || isNaN(dateTo.getTime())) {
      return NextResponse.json({ error: "Nevaljani datumi" }, { status: 400 })
    }

    if (dateFrom > dateTo) {
      return NextResponse.json(
        { error: "Datum 'from' mora biti prije datuma 'to'" },
        { status: 400 }
      )
    }

    // Generate PDV form
    const { xml, data } = await generatePdvFormForPeriod(company.id, dateFrom, dateTo)

    // Validate form data
    const validation = validatePdvFormData(data)
    if (!validation.valid) {
      console.warn("PDV form validation warnings:", validation.errors)
    }

    // Generate filename
    const periodStr =
      data.periodType === "MONTHLY"
        ? `${data.periodYear}-${String(data.periodMonth).padStart(2, "0")}`
        : `${data.periodYear}-Q${data.periodQuarter}`
    const fileName = `PDV-${company.oib}-${periodStr}.xml`

    return new NextResponse(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    console.error("PDV XML export error:", error)
    return NextResponse.json({ error: "Neuspjesan PDV XML izvoz" }, { status: 500 })
  }
}
