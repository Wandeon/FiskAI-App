import { DepreciationMethod, Prisma, type FixedAssetCandidateStatus } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { persistDepreciationSchedule } from "@/lib/assets/depreciation"

const Decimal = Prisma.Decimal

export async function convertFixedAssetCandidateToAsset(params: {
  companyId: string
  candidateId: string
  assetName?: string
  category?: "EQUIPMENT" | "FURNITURE" | "VEHICLE" | "BUILDING" | "INTANGIBLE" | "OTHER"
  usefulLifeMonths: number
  depreciationMethod?: DepreciationMethod
  markCandidateStatus?: FixedAssetCandidateStatus
}) {
  const depreciationMethod = params.depreciationMethod ?? DepreciationMethod.STRAIGHT_LINE
  const candidateStatus = params.markCandidateStatus ?? "ACCEPTED"

  return prisma.$transaction(async (tx) => {
    const candidate = await tx.fixedAssetCandidate.findFirst({
      where: { id: params.candidateId, companyId: params.companyId },
      include: {
        expense: true,
        expenseLine: true,
      },
    })

    if (!candidate) {
      throw new Error("FixedAssetCandidate not found")
    }

    if (candidate.fixedAssetId) {
      const existing = await tx.fixedAsset.findUnique({ where: { id: candidate.fixedAssetId } })
      return { asset: existing, schedule: null, candidate }
    }

    const acquisitionCost = new Decimal(candidate.expenseLine.netAmount)

    const asset = await tx.fixedAsset.create({
      data: {
        companyId: params.companyId,
        name: params.assetName ?? candidate.description,
        category: params.category ?? "EQUIPMENT",
        acquisitionDate: candidate.expense.date,
        acquisitionCost,
        salvageValue: new Decimal("0.00"),
        usefulLifeMonths: params.usefulLifeMonths,
        depreciationMethod,
        status: "ACTIVE",
      },
    })

    const schedule = await persistDepreciationSchedule(asset, { periodMonths: 1 }, tx)

    const updatedCandidate = await tx.fixedAssetCandidate.update({
      where: { id: candidate.id },
      data: {
        status: candidateStatus,
        reviewedAt: new Date(),
        fixedAssetId: asset.id,
      },
    })

    return { asset, schedule, candidate: updatedCandidate }
  })
}
