import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { createCashIn, createCashOut } from "@/lib/cash/cash-service"
import { getCompanyId } from "@/lib/auth/company"

const createCashEntrySchema = z.object({
  type: z.enum(["in", "out"]),
  businessDate: z.string().transform((s) => new Date(s)),
  amount: z.number().positive(),
  note: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const companyId = await getCompanyId()
  if (!companyId) {
    return NextResponse.json({ error: "No company selected" }, { status: 400 })
  }

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
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const companyId = await getCompanyId()
  if (!companyId) {
    return NextResponse.json({ error: "No company selected" }, { status: 400 })
  }

  try {
    const body = await request.json()
    const input = createCashEntrySchema.parse(body)

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
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 })
    }
    console.error("Failed to create cash entry:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create cash entry" },
      { status: 500 }
    )
  }
}
