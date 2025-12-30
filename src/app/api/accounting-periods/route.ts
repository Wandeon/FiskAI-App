import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { createAccountingPeriod, listAccountingPeriods } from "@/lib/period-locking/service"

export async function GET() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  const periods = await listAccountingPeriods(company.id)
  return NextResponse.json({ periods })
}

export async function POST(req: NextRequest) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const body = await req.json()

  const period = await createAccountingPeriod(
    company.id,
    {
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      periodType: body.periodType,
      fiscalYear: body.fiscalYear,
      periodNumber: body.periodNumber,
    },
    user.id!,
    body.reason ?? "create_accounting_period"
  )

  return NextResponse.json({ period })
}
