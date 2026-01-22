/**
 * Travel Rule References
 *
 * Provides travel allowance rule data for per diem and mileage calculations.
 *
 * ARCHITECTURAL NOTE:
 * This simplified version uses static rule data.
 * Dynamic rule resolution via regulatory database has been moved to fiskai-intelligence.
 * For dynamic rates, integrate with Intelligence API: POST https://iapi.fiskai.hr/v1/rules/resolve
 */

import type { TravelRuleReference } from "./rules-engine"

// Croatian travel allowance rates (2025)
// Source: Pravilnik o porezu na dohodak (NN 1/2017)
const STATIC_RULES = {
  // Per diem rates
  perDiem: {
    domestic: {
      ruleVersionId: "TRAVEL_PER_DIEM_HR_2025",
      rateAmount: 26.53, // EUR per day for domestic travel
      capAmount: 265.3, // 10 days max
      currency: "EUR",
    },
    international: {
      ruleVersionId: "TRAVEL_PER_DIEM_INT_2025",
      rateAmount: 35.0, // EUR per day for international travel
      capAmount: 350.0, // 10 days max
      currency: "EUR",
    },
  },
  // Mileage rate
  mileage: {
    ruleVersionId: "TRAVEL_MILEAGE_HR_2025",
    rateAmount: 0.4, // EUR per km
    capAmount: 400.0, // 1000 km max at standard rate
    currency: "EUR",
  },
}

export type PerDiemType = "domestic" | "international"

type BuildPerDiemOptions = {
  days: number
  type?: PerDiemType
  referenceDate?: Date
}

type BuildMileageOptions = {
  kilometers: number
  referenceDate?: Date
}

/**
 * Build per diem rule reference.
 *
 * Returns static rate data for Croatian per diem allowances.
 * For dynamic regulatory rates, integrate with Intelligence API.
 */
export async function buildPerDiemRuleReference(
  options: BuildPerDiemOptions
): Promise<TravelRuleReference | null> {
  if (options.days <= 0) {
    return null
  }

  const perDiemType = options.type ?? "domestic"
  const rule = STATIC_RULES.perDiem[perDiemType]

  // TODO: Integrate with Intelligence API for dynamic rate lookup
  // POST https://iapi.fiskai.hr/v1/rules/resolve
  // { tableKey: "TRAVEL_PER_DIEM", effectiveDate: referenceDate.toISOString() }

  return {
    ruleVersionId: rule.ruleVersionId,
    rateAmount: rule.rateAmount,
    capAmount: rule.capAmount,
    currency: rule.currency,
  }
}

/**
 * Build mileage rule reference.
 *
 * Returns static rate data for Croatian mileage allowances.
 * For dynamic regulatory rates, integrate with Intelligence API.
 */
export async function buildMileageRuleReference(
  options: BuildMileageOptions
): Promise<TravelRuleReference | null> {
  if (options.kilometers <= 0) {
    return null
  }

  const rule = STATIC_RULES.mileage

  // TODO: Integrate with Intelligence API for dynamic rate lookup
  // POST https://iapi.fiskai.hr/v1/rules/resolve
  // { tableKey: "TRAVEL_MILEAGE", effectiveDate: referenceDate.toISOString() }

  return {
    ruleVersionId: rule.ruleVersionId,
    rateAmount: rule.rateAmount,
    capAmount: rule.capAmount,
    currency: rule.currency,
  }
}
