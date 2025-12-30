import { NextResponse } from "next/server"
import { z } from "zod"
import { AssetCategory } from "@prisma/client"

import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { setTenantContext } from "@/lib/prisma-extensions"
import { upsertProcurementAssetCandidate } from "@/lib/assets/procurement"

const procurementAssetCandidateSchema = z.object({
  sourceReference: z.string().min(1),
  name: z.string().min(1),
  category: z.nativeEnum(AssetCategory),
  acquisitionDate: z.coerce.date(),
  acquisitionCost: z.union([z.number(), z.string()]),
  usefulLifeMonths: z.number().int().positive().optional(),
  metadata: z.unknown().optional(),
})

export async function POST(request: Request) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  const body = await request.json().catch(() => null)
  const parsed = procurementAssetCandidateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid procurement asset candidate payload", issues: parsed.error.format() },
      { status: 400 }
    )
  }

  const candidate = await upsertProcurementAssetCandidate({
    companyId: company.id,
    sourceReference: parsed.data.sourceReference,
    name: parsed.data.name,
    category: parsed.data.category,
    acquisitionDate: parsed.data.acquisitionDate,
    acquisitionCost: parsed.data.acquisitionCost,
    usefulLifeMonths: parsed.data.usefulLifeMonths,
    metadata: parsed.data.metadata,
  })

  return NextResponse.json({ candidate })
}
