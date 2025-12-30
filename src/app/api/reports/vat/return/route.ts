import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { createControlSum } from "@/lib/exports/control-sum"
import {
  getPeriodDescription,
  preparePdvFormData,
  validatePdvFormData,
} from "@/lib/reports/pdv-xml-generator"

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

    if (isNaN(dateFrom.getTime()) || isNaN(dateTo.getTime())) {
      return NextResponse.json({ error: "Nevaljani datumi" }, { status: 400 })
    }

    if (dateFrom > dateTo) {
      return NextResponse.json(
        { error: "Datum 'from' mora biti prije datuma 'to'" },
        { status: 400 }
      )
    }

    const data = await preparePdvFormData(company.id, dateFrom, dateTo)
    const validation = validatePdvFormData(data)

    const payload = {
      data,
      periodDescription: getPeriodDescription(data),
      validation,
    }

    const json = JSON.stringify(payload, null, 2)
    const controlSum = createControlSum(json)

    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-Export-Control-Sum": controlSum,
      },
    })
  } catch (error) {
    console.error("PDV return generation error:", error)
    return NextResponse.json({ error: "Neuspješna PDV prijava" }, { status: 500 })
  }
}
