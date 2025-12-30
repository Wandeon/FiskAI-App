import {
  AssetCategory,
  AssetCandidateSource,
  AssetCandidateStatus,
  AssetStatus,
  DepreciationMethod,
  Prisma,
} from "@prisma/client"

import { prisma } from "@/lib/prisma"

import { persistDepreciationSchedule } from "./depreciation"

const Decimal = Prisma.Decimal

export type ProcurementAssetCandidateInput = {
  companyId: string
  sourceReference: string
  name: string
  category: AssetCategory
  acquisitionDate: Date
  acquisitionCost: Prisma.Decimal | number | string
  usefulLifeMonths?: number
  metadata?: Prisma.JsonValue
}

export type ConvertAssetCandidateOptions = {
  periodMonths?: number
  depreciationMethod?: DepreciationMethod
  fallbackUsefulLifeMonths?: number
  salvageValue?: Prisma.Decimal | number | string
}

export const upsertProcurementAssetCandidate = async (input: ProcurementAssetCandidateInput) => {
  return prisma.assetCandidate.upsert({
    where: {
      companyId_source_sourceReference: {
        companyId: input.companyId,
        source: AssetCandidateSource.PROCUREMENT,
        sourceReference: input.sourceReference,
      },
    },
    create: {
      companyId: input.companyId,
      source: AssetCandidateSource.PROCUREMENT,
      sourceReference: input.sourceReference,
      name: input.name,
      category: input.category,
      acquisitionDate: input.acquisitionDate,
      acquisitionCost: input.acquisitionCost,
      usefulLifeMonths: input.usefulLifeMonths,
      metadata: input.metadata,
      status: AssetCandidateStatus.PENDING,
    },
    update: {
      name: input.name,
      category: input.category,
      acquisitionDate: input.acquisitionDate,
      acquisitionCost: input.acquisitionCost,
      usefulLifeMonths: input.usefulLifeMonths,
      metadata: input.metadata,
    },
  })
}

export const convertAssetCandidateToFixedAsset = async (
  candidateId: string,
  options: ConvertAssetCandidateOptions = {}
) => {
  return prisma.$transaction(async (tx) => {
    const candidate = await tx.assetCandidate.findUnique({
      where: { id: candidateId },
    })

    if (!candidate) {
      throw new Error(`Asset candidate ${candidateId} was not found.`)
    }

    if (candidate.status !== AssetCandidateStatus.PENDING) {
      throw new Error(`Asset candidate ${candidateId} is not pending.`)
    }

    const usefulLifeMonths = candidate.usefulLifeMonths ?? options.fallbackUsefulLifeMonths

    if (!usefulLifeMonths) {
      throw new Error(`Asset candidate ${candidateId} is missing useful life months.`)
    }

    const asset = await tx.fixedAsset.create({
      data: {
        companyId: candidate.companyId,
        name: candidate.name,
        category: candidate.category,
        acquisitionDate: candidate.acquisitionDate,
        acquisitionCost: candidate.acquisitionCost,
        salvageValue: options.salvageValue ? new Decimal(options.salvageValue) : undefined,
        usefulLifeMonths,
        depreciationMethod: options.depreciationMethod ?? DepreciationMethod.STRAIGHT_LINE,
        status: AssetStatus.ACTIVE,
      },
    })

    const schedule = await persistDepreciationSchedule(
      asset,
      { periodMonths: options.periodMonths },
      tx
    )

    await tx.assetCandidate.update({
      where: { id: candidateId },
      data: {
        status: AssetCandidateStatus.CONVERTED,
        convertedAssetId: asset.id,
      },
    })

    return { asset, schedule }
  })
}
