import { addMonths, subDays } from "date-fns"
import {
  DepreciationMethod,
  DepreciationScheduleStatus,
  Prisma,
  type FixedAsset,
} from "@prisma/client"

import { postJournalEntry } from "@/lib/gl/posting-service"
import { prisma } from "@/lib/prisma"

const Decimal = Prisma.Decimal

type DepreciationEntryDraft = {
  periodStart: Date
  periodEnd: Date
  sequence: number
  amount: Prisma.Decimal
  accumulatedAmount: Prisma.Decimal
}

export type DepreciationScheduleOptions = {
  periodMonths?: number
}

export type DepreciationEntriesInput = {
  acquisitionDate: Date
  acquisitionCost: Prisma.Decimal | number | string
  salvageValue?: Prisma.Decimal | number | string
  usefulLifeMonths: number
  depreciationMethod: DepreciationMethod
  periodMonths?: number
}

export type DepreciationPostingInput = {
  companyId: string
  periodStart: Date
  periodEnd: Date
  debitAccountId: string
  creditAccountId: string
  createdById?: string
  status?: "DRAFT" | "POSTED"
  descriptionTemplate?: (params: { assetName: string; entrySequence: number }) => string
}

export type DepreciationPostingResult = {
  depreciationEntryId: string
  journalEntryId: string
}

const toDecimal = (value: Prisma.Decimal | number | string) =>
  value instanceof Decimal ? value : new Decimal(value)

const toPeriodEnd = (startDate: Date, months: number) => subDays(addMonths(startDate, months), 1)

export const buildDepreciationEntries = (
  input: DepreciationEntriesInput
): DepreciationEntryDraft[] => {
  const periodMonths = input.periodMonths ?? 1

  if (input.usefulLifeMonths <= 0) {
    throw new Error("Useful life months must be greater than zero.")
  }

  if (periodMonths <= 0) {
    throw new Error("Period months must be greater than zero.")
  }

  if (input.depreciationMethod !== DepreciationMethod.STRAIGHT_LINE) {
    throw new Error(`Unsupported depreciation method: ${input.depreciationMethod}.`)
  }

  const acquisitionCost = toDecimal(input.acquisitionCost)
  const salvageValue = input.salvageValue ? toDecimal(input.salvageValue) : new Decimal(0)
  const depreciableBase = acquisitionCost.minus(salvageValue)
  const totalMonths = input.usefulLifeMonths
  const periodCount = Math.ceil(totalMonths / periodMonths)
  const entries: DepreciationEntryDraft[] = []
  let accumulated = new Decimal(0)
  let remaining = depreciableBase

  for (let index = 0; index < periodCount; index += 1) {
    const monthsInPeriod =
      index === periodCount - 1 ? totalMonths - periodMonths * (periodCount - 1) : periodMonths
    const rawAmount = depreciableBase.mul(monthsInPeriod).div(totalMonths)
    const amount =
      index === periodCount - 1 ? remaining : rawAmount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    accumulated = accumulated.plus(amount)
    remaining = remaining.minus(amount)

    const periodStart = addMonths(input.acquisitionDate, index * periodMonths)
    const periodEnd = toPeriodEnd(periodStart, monthsInPeriod)

    entries.push({
      periodStart,
      periodEnd,
      sequence: index + 1,
      amount,
      accumulatedAmount: accumulated,
    })
  }

  return entries
}

export const persistDepreciationSchedule = async (
  asset: FixedAsset,
  options: DepreciationScheduleOptions = {},
  client: Prisma.TransactionClient = prisma
) => {
  const entries = buildDepreciationEntries({
    acquisitionDate: asset.acquisitionDate,
    acquisitionCost: asset.acquisitionCost,
    salvageValue: asset.salvageValue,
    usefulLifeMonths: asset.usefulLifeMonths,
    depreciationMethod: asset.depreciationMethod,
    periodMonths: options.periodMonths,
  })

  const startDate = entries[0]?.periodStart ?? asset.acquisitionDate
  const endDate = entries.at(-1)?.periodEnd ?? asset.acquisitionDate
  const totalDepreciation = entries.at(-1)?.accumulatedAmount ?? new Decimal(0)

  return client.depreciationSchedule.create({
    data: {
      assetId: asset.id,
      method: asset.depreciationMethod,
      periodMonths: options.periodMonths ?? 1,
      startDate,
      endDate,
      totalDepreciation,
      status: DepreciationScheduleStatus.LOCKED,
      lockedAt: new Date(),
      entries: {
        create: entries.map((entry) => ({
          assetId: asset.id,
          periodStart: entry.periodStart,
          periodEnd: entry.periodEnd,
          sequence: entry.sequence,
          amount: entry.amount,
          accumulatedAmount: entry.accumulatedAmount,
        })),
      },
    },
  })
}

export const createDepreciationScheduleForAsset = async (
  assetId: string,
  options: DepreciationScheduleOptions = {}
) => {
  const asset = await prisma.fixedAsset.findUnique({
    where: { id: assetId },
    include: { depreciationSchedule: true },
  })

  if (!asset) {
    throw new Error(`Fixed asset ${assetId} was not found.`)
  }

  if (asset.depreciationSchedule) {
    throw new Error(`Fixed asset ${assetId} already has a schedule.`)
  }

  return persistDepreciationSchedule(asset, options, prisma)
}

export const listDepreciationEntriesByPeriod = async (params: {
  companyId: string
  periodStart: Date
  periodEnd: Date
}) => {
  return prisma.depreciationEntry.findMany({
    where: {
      asset: { companyId: params.companyId },
      periodStart: { gte: params.periodStart },
      periodEnd: { lte: params.periodEnd },
    },
    include: {
      asset: true,
      schedule: true,
    },
    orderBy: [{ periodStart: "asc" }, { sequence: "asc" }],
  })
}

export const postDepreciationEntriesForPeriod = async (
  input: DepreciationPostingInput
): Promise<DepreciationPostingResult[]> => {
  const entries = await prisma.depreciationEntry.findMany({
    where: {
      asset: { companyId: input.companyId },
      periodStart: { gte: input.periodStart },
      periodEnd: { lte: input.periodEnd },
      journalEntryId: null,
    },
    include: {
      asset: true,
    },
    orderBy: [{ periodStart: "asc" }, { sequence: "asc" }],
  })

  if (entries.length === 0) {
    return []
  }

  const results: DepreciationPostingResult[] = []

  for (const entry of entries) {
    const amount = toDecimal(entry.amount)
    const description =
      input.descriptionTemplate?.({ assetName: entry.asset.name, entrySequence: entry.sequence }) ??
      `Depreciation ${entry.asset.name} #${entry.sequence}`

    const journalEntry = await postJournalEntry({
      companyId: input.companyId,
      entryDate: entry.periodEnd,
      description,
      reference: `DEPR-${entry.id}`,
      createdById: input.createdById,
      status: input.status,
      lines: [
        {
          accountId: input.debitAccountId,
          debit: amount,
          credit: 0,
          lineNumber: 1,
          description,
        },
        {
          accountId: input.creditAccountId,
          debit: 0,
          credit: amount,
          lineNumber: 2,
          description,
        },
      ],
    })

    await prisma.depreciationEntry.update({
      where: { id: entry.id },
      data: { journalEntryId: journalEntry.journalEntry.id },
    })

    results.push({
      depreciationEntryId: entry.id,
      journalEntryId: journalEntry.journalEntry.id,
    })
  }

  return results
}
