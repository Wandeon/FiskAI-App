import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { createCashIn, createCashOut } from "@/lib/cash/cash-service"
import { parseBody, isValidationError, formatValidationError } from "@/lib/api/validation"

const createCashEntrySchema = z.object({
  type: z.enum(["in", "out"]),
  businessDate: z.string().transform((s) => new Date(s)),
  amount: z.number().positive(),
  note: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const companyId = company.id

  const { searchParams } = new URL(request.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  const dateFilter = {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to ? { lte: new Date(to) } : {}),
  }

  const [cashIn, cashOut] = await Promise.all([
    db.cashIn.findMany({
      where: { companyId, ...(Object.keys(dateFilter).length ? { businessDate: dateFilter } : {}) },
      orderBy: { businessDate: "desc" },
    }),
    db.cashOut.findMany({
      where: { companyId, ...(Object.keys(dateFilter).length ? { businessDate: dateFilter } : {}) },
      orderBy: { businessDate: "desc" },
    }),
  ])

  const entries = [
    ...cashIn.map((e) => ({ ...e, type: "in" as const })),
    ...cashOut.map((e) => ({ ...e, type: "out" as const })),
  ].sort((a, b) => b.businessDate.getTime() - a.businessDate.getTime())

  return NextResponse.json({ entries })
}

export async function POST(request: NextRequest) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const companyId = company.id

  try {
    const input = await parseBody(request, createCashEntrySchema)

    const entry =
      input.type === "in"
        ? await createCashIn({
            companyId,
            businessDate: input.businessDate,
            amount: input.amount,
            note: input.note,
          })
        : await createCashOut({
            companyId,
            businessDate: input.businessDate,
            amount: input.amount,
            note: input.note,
          })

    return NextResponse.json({ success: true, entry, type: input.type })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Failed to create cash entry:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create cash entry" },
      { status: 500 }
    )
  }
}
