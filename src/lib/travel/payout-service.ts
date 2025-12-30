import type { MileageLogInput, TravelCalculationInput, TravelCalculationResult } from "./payouts"
import { calculateTravelPayouts } from "./payouts"
import {
  buildMileageRuleReference,
  buildPerDiemRuleReference,
  type PerDiemType,
} from "./rule-references"

type TravelPayoutRuleContext = {
  referenceDate?: Date
  perDiemType?: PerDiemType
}

function sumMileageDistance(logs?: MileageLogInput[]): number {
  if (!logs?.length) return 0
  return Math.round(logs.reduce((sum, log) => sum + log.distanceKm, 0) * 100) / 100
}

export async function calculateTravelPayoutsWithRules(
  input: Omit<TravelCalculationInput, "perDiemRule" | "mileageRule"> & TravelPayoutRuleContext
): Promise<TravelCalculationResult> {
  const mileageDistance = input.distanceKm ?? sumMileageDistance(input.mileageLogs)
  const perDiemDays = input.perDiemDays ?? 0
  const referenceDate = input.referenceDate ?? new Date()

  const perDiemRule = await buildPerDiemRuleReference({
    days: perDiemDays,
    type: input.perDiemType,
    referenceDate,
  })

  const mileageRule = await buildMileageRuleReference({
    kilometers: mileageDistance,
    referenceDate,
  })

  return calculateTravelPayouts({
    ...input,
    perDiemRule,
    mileageRule,
  })
}
