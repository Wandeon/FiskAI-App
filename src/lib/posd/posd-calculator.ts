/**
 * PO-SD Calculator for Paušalni Obrtnici
 *
 * PO-SD = Pregled primitaka i izdataka (za paušalno oporezivanje)
 *
 * For lump-sum taxation (paušalni obrt), only INCOME matters.
 * Tax is calculated on gross income based on thresholds.
 */

import {
  ADDITIONAL_DEADLINES,
  CONTRIBUTIONS,
  TAX_RATES,
  THRESHOLDS,
  formatCurrency as formatFiscalCurrency,
  getAveragePrirezRate,
  searchByCityName,
} from "@/lib/fiscal-data"
import { BankTransaction, calculateQuarterlyTotals } from "./bank-xml-parser"

const VAT_THRESHOLD = THRESHOLDS.pdv.value
const NORMATIVE_EXPENSE_RATE = TAX_RATES.pausal.normativeExpenseRate
const PAUSAL_TAX_RATE = TAX_RATES.pausal.rate
const DEFAULT_PRIREZ_RATE = getAveragePrirezRate()

const CITY_RATE_LOOKUP: Record<string, string> = {
  zagreb: "Zagreb",
  split: "Split",
  rijeka: "Rijeka",
  osijek: "Osijek",
  zadar: "Zadar",
}

function resolvePrirezRate(cityKey: string) {
  const cityName = CITY_RATE_LOOKUP[cityKey]
  if (!cityName) return DEFAULT_PRIREZ_RATE
  const match = searchByCityName(cityName)[0]
  return match?.prirezRate ?? DEFAULT_PRIREZ_RATE
}

export interface POSDInput {
  year: number
  incomeTransactions: BankTransaction[]
  businessType: "pausalni" | "slobodna-djelatnost"
  hasSecondPensionPillar: boolean
  municipalityRate?: number // Prirez rate (e.g., 0.18 for Zagreb)
}

export interface QuarterlyBreakdown {
  quarter: "Q1" | "Q2" | "Q3" | "Q4"
  income: number
  transactionCount: number
  monthlyAverage: number
}

export interface POSDResult {
  // Basic info
  year: number
  totalIncome: number
  quarterlyBreakdown: QuarterlyBreakdown[]

  // Tax calculation
  normativeExpenses: number // 30% of income
  taxBase: number // income - normative expenses
  incomeTax: number // 12% of tax base
  surtax: number // prirez (varies by municipality)
  totalTax: number

  // Contributions
  monthlyContributions: number
  yearlyContributions: number
  healthInsurance: number
  pension: number

  // Totals
  totalObligations: number // tax + contributions
  netAfterTax: number // income - total obligations

  // Warnings
  warnings: string[]

  // VAT status
  isNearVATThreshold: boolean
  vatThresholdPercentage: number
}

/**
 * Calculate PO-SD for paušalni obrt
 */
export function calculatePOSD(input: POSDInput): POSDResult {
  const { incomeTransactions, year, hasSecondPensionPillar, municipalityRate = 0 } = input

  const warnings: string[] = []

  // Calculate quarterly totals
  const quarterlyTotals = calculateQuarterlyTotals(incomeTransactions)

  const quarterlyBreakdown: QuarterlyBreakdown[] = [
    {
      quarter: "Q1",
      income: quarterlyTotals.Q1,
      transactionCount: incomeTransactions.filter((tx) => tx.date.getMonth() < 3).length,
      monthlyAverage: quarterlyTotals.Q1 / 3,
    },
    {
      quarter: "Q2",
      income: quarterlyTotals.Q2,
      transactionCount: incomeTransactions.filter(
        (tx) => tx.date.getMonth() >= 3 && tx.date.getMonth() < 6
      ).length,
      monthlyAverage: quarterlyTotals.Q2 / 3,
    },
    {
      quarter: "Q3",
      income: quarterlyTotals.Q3,
      transactionCount: incomeTransactions.filter(
        (tx) => tx.date.getMonth() >= 6 && tx.date.getMonth() < 9
      ).length,
      monthlyAverage: quarterlyTotals.Q3 / 3,
    },
    {
      quarter: "Q4",
      income: quarterlyTotals.Q4,
      transactionCount: incomeTransactions.filter((tx) => tx.date.getMonth() >= 9).length,
      monthlyAverage: quarterlyTotals.Q4 / 3,
    },
  ]

  // Total income
  const totalIncome = Object.values(quarterlyTotals).reduce((a, b) => a + b, 0)

  // VAT threshold check
  const vatThresholdPercentage = (totalIncome / VAT_THRESHOLD) * 100
  const isNearVATThreshold = totalIncome > VAT_THRESHOLD * 0.8

  if (totalIncome > VAT_THRESHOLD) {
    warnings.push(
      `⚠️ Prešli ste PDV prag od ${formatFiscalCurrency(VAT_THRESHOLD)}! Morate se registrirati za PDV.`
    )
  } else if (isNearVATThreshold) {
    warnings.push(
      `⚠️ Blizu ste PDV praga (${vatThresholdPercentage.toFixed(1)}%). Pratite prihode pažljivo.`
    )
  }

  // Normative expenses (30% for most activities)
  const normativeExpenses = totalIncome * NORMATIVE_EXPENSE_RATE

  // Tax base
  const taxBase = totalIncome - normativeExpenses

  // Income tax (12%)
  const incomeTax = taxBase * PAUSAL_TAX_RATE

  // Surtax (prirez) - applied on income tax
  const surtax = incomeTax * municipalityRate

  // Total tax
  const totalTax = incomeTax + surtax

  // Contributions (monthly, multiply by 12 for yearly)
  const monthlyContributions = hasSecondPensionPillar
    ? CONTRIBUTIONS.monthly.total
    : CONTRIBUTIONS.monthly.hzzo + CONTRIBUTIONS.monthly.mioI

  const yearlyContributions = monthlyContributions * 12

  // Health insurance (yearly)
  const healthInsurance = CONTRIBUTIONS.monthly.hzzo * 12

  // Pension (yearly)
  const pension = hasSecondPensionPillar
    ? (CONTRIBUTIONS.monthly.mioI + CONTRIBUTIONS.monthly.mioII) * 12
    : CONTRIBUTIONS.monthly.mioI * 12

  // Total obligations
  const totalObligations = totalTax + yearlyContributions

  // Net after tax
  const netAfterTax = totalIncome - totalObligations

  // Check if contributions are higher than income
  if (yearlyContributions > totalIncome * 0.5) {
    warnings.push(
      "ℹ️ Doprinosi čine više od 50% prihoda. Razmislite o drugim opcijama ako je ovo vaš jedini posao."
    )
  }

  return {
    year,
    totalIncome,
    quarterlyBreakdown,
    normativeExpenses,
    taxBase,
    incomeTax,
    surtax,
    totalTax,
    monthlyContributions,
    yearlyContributions,
    healthInsurance,
    pension,
    totalObligations,
    netAfterTax,
    warnings,
    isNearVATThreshold,
    vatThresholdPercentage,
  }
}

export const formatCurrency = formatFiscalCurrency

/**
 * Get municipality surtax rate
 */
export const MUNICIPALITY_RATES: Record<string, number> = {
  zagreb: resolvePrirezRate("zagreb"),
  split: resolvePrirezRate("split"),
  rijeka: resolvePrirezRate("rijeka"),
  osijek: resolvePrirezRate("osijek"),
  zadar: resolvePrirezRate("zadar"),
  other: DEFAULT_PRIREZ_RATE,
  none: 0,
}

/**
 * Get deadline for PO-SD submission
 */
export function getPOSDDeadline(year: number, quarter: 1 | 2 | 3 | 4): Date {
  const dates = ADDITIONAL_DEADLINES.posdQuarterly.dates
  const quarterIndexMap: Record<1 | 2 | 3 | 4, number> = { 1: 1, 2: 2, 3: 3, 4: 0 }
  const dateString = dates[quarterIndexMap[quarter]] ?? dates[0]
  const [day, month] = dateString.split(".").map(Number)
  const deadlineYear = quarter === 4 ? year + 1 : year

  return new Date(deadlineYear, month - 1, day)
}

/**
 * Calculate days until next PO-SD deadline
 */
export function getDaysUntilDeadline(): { quarter: number; deadline: Date; daysLeft: number } {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  // Determine current quarter and next deadline
  let targetQuarter: 1 | 2 | 3 | 4
  if (currentMonth < 3) {
    targetQuarter = 4 // Previous year's Q4
  } else if (currentMonth < 6) {
    targetQuarter = 1
  } else if (currentMonth < 9) {
    targetQuarter = 2
  } else {
    targetQuarter = 3
  }

  // Check if we're past the deadline for current quarter
  const deadline = getPOSDDeadline(
    targetQuarter === 4 ? currentYear - 1 : currentYear,
    targetQuarter
  )

  if (deadline < now) {
    // Move to next quarter
    targetQuarter = ((targetQuarter % 4) + 1) as 1 | 2 | 3 | 4
    const nextDeadline = getPOSDDeadline(currentYear, targetQuarter)
    const daysLeft = Math.ceil((nextDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return { quarter: targetQuarter, deadline: nextDeadline, daysLeft }
  }

  const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  return { quarter: targetQuarter, deadline, daysLeft }
}
