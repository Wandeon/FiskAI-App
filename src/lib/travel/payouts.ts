import {
  applyTravelRule,
  type TravelRuleApplication,
  type TravelRuleReference,
} from "./rules-engine"

export type MileageLogInput = {
  distanceKm: number
}

export type TravelCalculationInput = {
  travelOrderId: string
  companyId: string
  travelerUserId?: string | null
  currency: string
  perDiemDays?: number | null
  distanceKm?: number | null
  mileageLogs?: MileageLogInput[]
  perDiemRule?: TravelRuleReference | null
  mileageRule?: TravelRuleReference | null
}

export type TravelPayoutInput = {
  travelOrderId: string
  companyId: string
  travelerUserId?: string | null
  amount: number
  currency: string
  payoutType: "PER_DIEM" | "MILEAGE"
  ruleVersionId?: string
}

export type JoppdEntryDraft = {
  travelOrderId: string
  companyId: string
  travelerUserId?: string | null
  amount: number
  currency: string
  incomeType: "PER_DIEM" | "MILEAGE"
  ruleVersionId?: string
  lineData: {
    receiptType: string // P6.2 (17, 18)
    recipientType: string // P6.1 (0001)
  }
}

export type TravelCalculationResult = {
  perDiem?: TravelRuleApplication
  mileage?: TravelRuleApplication
  totalAmount: number
  payoutInputs: TravelPayoutInput[]
  joppdDrafts: JoppdEntryDraft[]
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

function sumMileageDistance(logs?: MileageLogInput[]): number {
  if (!logs?.length) return 0
  return roundCurrency(logs.reduce((sum, log) => sum + log.distanceKm, 0))
}

export function calculateTravelPayouts(input: TravelCalculationInput): TravelCalculationResult {
  const mileageDistance = input.distanceKm ?? sumMileageDistance(input.mileageLogs)
  const perDiemDays = input.perDiemDays ?? 0

  const perDiem =
    input.perDiemRule && perDiemDays > 0
      ? applyTravelRule({ quantity: perDiemDays, rule: input.perDiemRule })
      : undefined
  const mileage =
    input.mileageRule && mileageDistance > 0
      ? applyTravelRule({ quantity: mileageDistance, rule: input.mileageRule })
      : undefined

  const perDiemAmount = perDiem?.cappedAmount ?? 0
  const mileageAmount = mileage?.cappedAmount ?? 0
  const totalAmount = roundCurrency(perDiemAmount + mileageAmount)

  const payoutInputs: TravelPayoutInput[] = []
  const joppdDrafts: JoppdEntryDraft[] = []

  if (perDiem && perDiemAmount > 0) {
    payoutInputs.push({
      travelOrderId: input.travelOrderId,
      companyId: input.companyId,
      travelerUserId: input.travelerUserId ?? null,
      amount: perDiemAmount,
      currency: input.currency,
      payoutType: "PER_DIEM",
      ruleVersionId: perDiem.ruleVersionId,
    })

    // Code 17: Dnevnice za službena putovanja u tuzemstvu i inozemstvu
    joppdDrafts.push({
      travelOrderId: input.travelOrderId,
      companyId: input.companyId,
      travelerUserId: input.travelerUserId ?? null,
      amount: perDiemAmount,
      currency: input.currency,
      incomeType: "PER_DIEM",
      ruleVersionId: perDiem.ruleVersionId,
      lineData: {
        receiptType: "17",
        recipientType: "0001",
      },
    })
  }

  if (mileage && mileageAmount > 0) {
    payoutInputs.push({
      travelOrderId: input.travelOrderId,
      companyId: input.companyId,
      travelerUserId: input.travelerUserId ?? null,
      amount: mileageAmount,
      currency: input.currency,
      payoutType: "MILEAGE",
      ruleVersionId: mileage.ruleVersionId,
    })

    // Code 18: Naknade za korištenje privatnog automobila u službene svrhe
    joppdDrafts.push({
      travelOrderId: input.travelOrderId,
      companyId: input.companyId,
      travelerUserId: input.travelerUserId ?? null,
      amount: mileageAmount,
      currency: input.currency,
      incomeType: "MILEAGE",
      ruleVersionId: mileage.ruleVersionId,
      lineData: {
        receiptType: "18",
        recipientType: "0001",
      },
    })
  }

  return {
    perDiem,
    mileage,
    totalAmount,
    payoutInputs,
    joppdDrafts,
  }
}
