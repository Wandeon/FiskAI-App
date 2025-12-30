import { getEffectiveRuleVersion } from "@/lib/fiscal-rules/service"
import type { JoppdCodebookData, MileageRuleData, PerDiemRuleData } from "@/lib/fiscal-rules/types"
import type { TravelRuleReference } from "./rules-engine"

export type PerDiemType = "domestic" | "foreign"

type RuleReferenceInput = {
  referenceDate?: Date
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

async function getJoppdEntry(code: string, referenceDate: Date) {
  const joppdVersion = await getEffectiveRuleVersion("JOPPD_CODEBOOK", referenceDate)
  const data = joppdVersion.data as JoppdCodebookData
  const entry = data.entries.find((item) => item.code === code)

  if (!entry) {
    throw new Error(`JOPPD code not found for travel rules: ${code}`)
  }

  return { entry, ruleVersionId: joppdVersion.id }
}

export async function buildPerDiemRuleReference(
  input: RuleReferenceInput & { days: number; type?: PerDiemType }
): Promise<TravelRuleReference | null> {
  if (!input.days || input.days <= 0) return null

  const referenceDate = input.referenceDate ?? new Date()
  const perDiemVersion = await getEffectiveRuleVersion("PER_DIEM", referenceDate)
  const data = perDiemVersion.data as PerDiemRuleData
  const type = input.type ?? "domestic"
  const rate = type === "foreign" ? data.foreign.rate : data.domestic.rate

  if (rate === null) {
    return null
  }

  const capCode = type === "foreign" ? "PER_DIEM_FOREIGN" : "PER_DIEM_DOMESTIC"
  const { entry } = await getJoppdEntry(capCode, referenceDate)
  const capPerUnit = entry.maxAmount ?? rate
  const capAmount = roundCurrency(capPerUnit * input.days)

  return {
    ruleVersionId: perDiemVersion.id,
    rateAmount: rate,
    capAmount,
    currency: "EUR",
  }
}

export async function buildMileageRuleReference(
  input: RuleReferenceInput & { kilometers: number }
): Promise<TravelRuleReference | null> {
  if (!input.kilometers || input.kilometers <= 0) return null

  const referenceDate = input.referenceDate ?? new Date()
  const mileageVersion = await getEffectiveRuleVersion("MILEAGE", referenceDate)
  const data = mileageVersion.data as MileageRuleData
  const { entry } = await getJoppdEntry("MILEAGE_PRIVATE_CAR", referenceDate)
  const capPerUnit = entry.maxAmount ?? data.rate
  const capAmount = roundCurrency(capPerUnit * input.kilometers)

  return {
    ruleVersionId: mileageVersion.id,
    rateAmount: data.rate,
    capAmount,
    currency: "EUR",
  }
}
