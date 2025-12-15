// src/lib/knowledge-hub/calculations.ts
import {
  getPausalTaxBracket,
  MONTHLY_CONTRIBUTIONS,
  HOK,
  TZ_RATES,
  CONTRIBUTION_BASE_2025,
} from "./constants"

export interface MonthlyCostBreakdown {
  contributions: number
  hok: number
  tax: number
  total: number
}

export interface AnnualCostBreakdown {
  contributions: number
  hok: number
  tax: number
  tz?: number
  total: number
}

export interface ContributionBreakdown {
  mioI: number
  mioII: number
  hzzo: number
  total: number
  base: number
}

/**
 * Calculate monthly costs for paušalni obrt
 */
export function calculatePausalMonthlyCosts(annualRevenue: number): MonthlyCostBreakdown {
  const bracket = getPausalTaxBracket(annualRevenue)
  const monthlyTax = Number((bracket.quarterlyTax / 3).toFixed(2))

  const contributions = MONTHLY_CONTRIBUTIONS.TOTAL
  const hok = HOK.MONTHLY

  return {
    contributions,
    hok,
    tax: monthlyTax,
    total: Number((contributions + hok + monthlyTax).toFixed(2)),
  }
}

/**
 * Calculate annual costs for paušalni obrt
 */
export function calculatePausalAnnualCosts(
  annualRevenue: number,
  tzGroup?: keyof typeof TZ_RATES
): AnnualCostBreakdown {
  const bracket = getPausalTaxBracket(annualRevenue)

  const contributions = Number((MONTHLY_CONTRIBUTIONS.TOTAL * 12).toFixed(2))
  const hok = Number((HOK.QUARTERLY * 4).toFixed(2))
  const tax = bracket.annualTax

  let tz: number | undefined
  if (tzGroup) {
    tz = Number((annualRevenue * TZ_RATES[tzGroup].rate).toFixed(2))
  }

  const total = Number((contributions + hok + tax + (tz || 0)).toFixed(2))

  return {
    contributions,
    hok,
    tax,
    tz,
    total,
  }
}

/**
 * Get monthly contribution breakdown
 */
export function calculateContributions(): ContributionBreakdown {
  return {
    mioI: MONTHLY_CONTRIBUTIONS.MIO_I.amount,
    mioII: MONTHLY_CONTRIBUTIONS.MIO_II.amount,
    hzzo: MONTHLY_CONTRIBUTIONS.HZZO.amount,
    total: MONTHLY_CONTRIBUTIONS.TOTAL,
    base: CONTRIBUTION_BASE_2025,
  }
}

/**
 * Calculate Turistička Zajednica contribution
 */
export function calculateTZContribution(
  annualRevenue: number,
  group: keyof typeof TZ_RATES
): number {
  return Number((annualRevenue * TZ_RATES[group].rate).toFixed(2))
}

/**
 * Format EUR amount for display
 */
export function formatEUR(amount: number): string {
  return new Intl.NumberFormat("hr-HR", {
    style: "currency",
    currency: "EUR",
  }).format(amount)
}

export interface JdooCosts {
  monthlyDirectorSalary: number
  yearlyContributions: number
  yearlyTax: number // profit tax
  effectiveTaxRate: number
}

export function calculateJdooCosts(
  annualRevenue: number,
  hasOtherEmployment: boolean = false
): JdooCosts {
  // If director has other employment, no mandatory salary
  // Otherwise, minimum salary contributions apply
  const monthlyDirectorSalary = hasOtherEmployment ? 0 : 700 // minimum base
  const yearlyContributions = hasOtherEmployment ? 0 : monthlyDirectorSalary * 12 * 0.365 // ~36.5% contributions

  // Simplified profit calculation (revenue - costs - salary)
  const estimatedCosts = annualRevenue * 0.2 // assume 20% business costs
  const directorSalaryCost = monthlyDirectorSalary * 12 * 1.365 // gross cost
  const taxableProfit = Math.max(0, annualRevenue - estimatedCosts - directorSalaryCost)

  // Profit tax: 10% up to 1M EUR, 18% above
  const yearlyTax =
    taxableProfit <= 1000000
      ? taxableProfit * 0.1
      : 1000000 * 0.1 + (taxableProfit - 1000000) * 0.18

  return {
    monthlyDirectorSalary,
    yearlyContributions: Math.round(yearlyContributions),
    yearlyTax: Math.round(yearlyTax),
    effectiveTaxRate: annualRevenue > 0 ? (yearlyTax / annualRevenue) * 100 : 0,
  }
}
