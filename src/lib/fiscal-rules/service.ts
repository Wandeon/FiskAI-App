import { createHash } from "crypto"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type {
  CalculationRequest,
  CalculationResponse,
  ContributionsRuleData,
  JoppdCodebookData,
  MileageRuleData,
  MunicipalityIncomeTaxData,
  PerDiemRuleData,
  RuleDataByTableKey,
  RuleTableKey,
  VatRuleData,
} from "./types"

const RULE_TABLE_KEYS: RuleTableKey[] = [
  "VAT",
  "MUNICIPALITY_INCOME_TAX",
  "CONTRIBUTIONS",
  "PER_DIEM",
  "MILEAGE",
  "JOPPD_CODEBOOK",
]

function assertValidRuleTableKey(key: string): asserts key is RuleTableKey {
  if (!RULE_TABLE_KEYS.includes(key as RuleTableKey)) {
    throw new Error(`Unsupported rule table key: ${key}`)
  }
}

function hashRuleData(data: RuleDataByTableKey): string {
  return createHash("sha256").update(JSON.stringify(data)).digest("hex")
}

export async function getEffectiveRuleVersion(tableKey: RuleTableKey, referenceDate: Date) {
  const ruleVersion = await prisma.ruleVersion.findFirst({
    where: {
      table: { key: tableKey },
      effectiveFrom: { lte: referenceDate },
      OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: referenceDate } }],
    },
    orderBy: { effectiveFrom: "desc" },
  })

  if (!ruleVersion) {
    throw new Error(`No effective rule version found for ${tableKey}`)
  }

  return ruleVersion
}

export async function createRuleVersion(params: {
  tableKey: RuleTableKey
  version: string
  effectiveFrom: Date
  effectiveUntil?: Date | null
  data: RuleDataByTableKey
}) {
  const table = await prisma.ruleTable.findUnique({
    where: { key: params.tableKey },
  })

  if (!table) {
    throw new Error(`Rule table not found: ${params.tableKey}`)
  }

  const dataHash = hashRuleData(params.data)

  return prisma.$transaction(async (tx) => {
    const ruleVersion = await tx.ruleVersion.create({
      data: {
        tableId: table.id,
        version: params.version,
        effectiveFrom: params.effectiveFrom,
        data: params.data as unknown as Prisma.InputJsonValue,
        dataHash,
      },
    })

    await tx.ruleSnapshot.create({
      data: {
        ruleVersionId: ruleVersion.id,
        data: params.data as unknown as Prisma.InputJsonValue,
        dataHash,
      },
    })

    return ruleVersion
  })
}

function calculateVat(
  data: VatRuleData,
  input: { netAmount?: number; rate?: number; rateLabel?: string }
) {
  const availableRates = [
    { ...data.standard, type: "standard" },
    ...data.reduced.map((rate) => ({ ...rate, type: "reduced" })),
  ]

  const selectedRate =
    input.rate !== undefined
      ? availableRates.find((rate) => rate.rate === input.rate)
      : input.rateLabel
        ? availableRates.find((rate) => rate.label.toLowerCase() === input.rateLabel?.toLowerCase())
        : data.standard

  if (!selectedRate) {
    throw new Error("Requested VAT rate not found")
  }

  if (input.netAmount === undefined) {
    return {
      rate: selectedRate.rate,
      label: selectedRate.label,
      type: "type" in selectedRate ? selectedRate.type : "standard",
      availableRates,
    }
  }

  const vatAmount = Number((input.netAmount * selectedRate.rate).toFixed(2))
  const grossAmount = Number((input.netAmount + vatAmount).toFixed(2))

  return {
    rate: selectedRate.rate,
    label: selectedRate.label,
    netAmount: input.netAmount,
    vatAmount,
    grossAmount,
    availableRates,
  }
}

function calculateMunicipalityIncomeTax(
  data: MunicipalityIncomeTaxData,
  input: { baseTax: number; postalCode?: string; municipality?: string }
) {
  let entry = null as MunicipalityIncomeTaxData["entries"][number] | null

  if (input.postalCode) {
    entry = data.entries.find((item) => item.postalCode === input.postalCode) || null
  }

  if (!entry && input.municipality) {
    const normalized = input.municipality.toLowerCase()
    entry = data.entries.find((item) => item.municipality.toLowerCase() === normalized) || null
  }

  if (!entry) {
    throw new Error("Municipality not found for income tax calculation")
  }

  const surtaxAmount = Number((input.baseTax * entry.prirezRate).toFixed(2))
  const totalTax = Number((input.baseTax + surtaxAmount).toFixed(2))

  return {
    municipality: entry.municipality,
    postalCode: entry.postalCode,
    prirezRate: entry.prirezRate,
    baseTax: input.baseTax,
    surtaxAmount,
    totalTax,
  }
}

function calculateContributions(data: ContributionsRuleData, input: { base?: number }) {
  const base = input.base ?? data.base.minimum
  const clampedBase = Math.min(Math.max(base, data.base.minimum), data.base.maximum)

  const mioI = Number((clampedBase * data.rates.MIO_I.rate).toFixed(2))
  const mioII = Number((clampedBase * data.rates.MIO_II.rate).toFixed(2))
  const hzzo = Number((clampedBase * data.rates.HZZO.rate).toFixed(2))
  const total = Number((mioI + mioII + hzzo).toFixed(2))

  return {
    base: clampedBase,
    rates: {
      mioI: data.rates.MIO_I.rate,
      mioII: data.rates.MIO_II.rate,
      hzzo: data.rates.HZZO.rate,
    },
    amounts: {
      mioI,
      mioII,
      hzzo,
      total,
    },
  }
}

function calculatePerDiem(
  data: PerDiemRuleData,
  input: { days: number; type?: "domestic" | "foreign" }
) {
  const type = input.type ?? "domestic"
  const rate = type === "domestic" ? data.domestic.rate : data.foreign.rate

  if (rate === null) {
    return {
      type,
      rate: null,
      amount: null,
      note: data.foreign.note ?? "Rate depends on destination",
    }
  }

  const amount = Number((input.days * rate).toFixed(2))

  return {
    type,
    rate,
    days: input.days,
    amount,
  }
}

function calculateMileage(data: MileageRuleData, input: { kilometers: number }) {
  const amount = Number((input.kilometers * data.rate).toFixed(2))

  return {
    kilometers: input.kilometers,
    rate: data.rate,
    amount,
  }
}

function calculateJoppdCodebook(data: JoppdCodebookData, input: { code?: string }) {
  if (!input.code) {
    return { entries: data.entries }
  }

  const entry = data.entries.find((item) => item.code === input.code)

  if (!entry) {
    throw new Error("JOPPD code not found")
  }

  return { entry }
}

export async function calculateDeterministicRule(
  input: CalculationRequest
): Promise<CalculationResponse<unknown>> {
  assertValidRuleTableKey(input.tableKey)

  const referenceDate =
    input.referenceDate instanceof Date
      ? input.referenceDate
      : input.referenceDate
        ? new Date(input.referenceDate)
        : new Date()

  const ruleVersion = input.ruleVersionId
    ? await prisma.ruleVersion.findUnique({
        where: { id: input.ruleVersionId },
        include: { table: true },
      })
    : await getEffectiveRuleVersion(input.tableKey, referenceDate)

  if (!ruleVersion) {
    throw new Error(`Rule version not found for ${input.tableKey}`)
  }

  if ("table" in ruleVersion) {
    const table = ruleVersion.table as { key: string } | null
    if (table && table.key !== input.tableKey) {
      throw new Error(`Rule version ${ruleVersion.id} does not match table ${input.tableKey}`)
    }
  }
  const data = ruleVersion.data as unknown as RuleDataByTableKey

  let result: unknown

  switch (input.tableKey) {
    case "VAT":
      result = calculateVat(data as VatRuleData, input)
      break
    case "MUNICIPALITY_INCOME_TAX":
      result = calculateMunicipalityIncomeTax(data as MunicipalityIncomeTaxData, input)
      break
    case "CONTRIBUTIONS":
      result = calculateContributions(data as ContributionsRuleData, input)
      break
    case "PER_DIEM":
      result = calculatePerDiem(data as PerDiemRuleData, input)
      break
    case "MILEAGE":
      result = calculateMileage(data as MileageRuleData, input)
      break
    case "JOPPD_CODEBOOK":
      result = calculateJoppdCodebook(data as JoppdCodebookData, input)
      break
    default: {
      const _exhaustiveCheck: never = input
      throw new Error(
        `Unsupported rule table key: ${(_exhaustiveCheck as { tableKey: string }).tableKey}`
      )
    }
  }

  await prisma.ruleCalculation.create({
    data: {
      ruleVersionId: ruleVersion.id,
      tableKey: input.tableKey,
      input: input as unknown as Prisma.InputJsonValue,
      result: result as unknown as Prisma.InputJsonValue,
      referenceDate,
    },
  })

  return {
    ruleVersionId: ruleVersion.id,
    ruleTableKey: input.tableKey,
    ruleVersion: {
      id: ruleVersion.id,
      version: ruleVersion.version,
      effectiveFrom: ruleVersion.effectiveFrom.toISOString(),
      effectiveUntil: ruleVersion.effectiveUntil ? ruleVersion.effectiveUntil.toISOString() : null,
      dataHash: ruleVersion.dataHash,
    },
    result,
  }
}
