/**
 * PO-SD Calculator for Paušalni Obrtnici
 *
 * PO-SD = Pregled primitaka i izdataka (za paušalno oporezivanje)
 *
 * For lump-sum taxation (paušalni obrt), only INCOME matters.
 * Tax is calculated on gross income based on thresholds.
 */

import { BankTransaction, calculateQuarterlyTotals } from "./bank-xml-parser"

// 2024/2025 Tax brackets for paušalni obrt
export const TAX_BRACKETS_2024 = [
  { min: 0, max: 12750, rate: 0.12, baseContribution: 262.0 }, // ~1062 EUR/month
  { min: 12750.01, max: 17500, rate: 0.12, baseContribution: 262.0 },
  { min: 17500.01, max: 25000, rate: 0.12, baseContribution: 262.0 },
  { min: 25000.01, max: 40000, rate: 0.12, baseContribution: 262.0 },
  { min: 40000.01, max: 60000, rate: 0.12, baseContribution: 262.0 },
] as const

// Monthly contribution rates for 2024
export const MONTHLY_CONTRIBUTIONS = {
  healthInsurance: 132.73, // Zdravstveno
  pensionPillar1: 92.68, // MIO I stup
  pensionPillar2: 36.59, // MIO II stup (if enrolled)
  total: 262.0, // Total without pillar 2: 225.41 EUR
}

// VAT threshold
export const VAT_THRESHOLD = 60000 // EUR

// Normative expense rates
export const NORMATIVE_EXPENSE_RATE = 0.3 // 30% for most activities

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
      `⚠️ Prešli ste PDV prag od ${VAT_THRESHOLD.toLocaleString("hr-HR")} EUR! Morate se registrirati za PDV.`
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
  const incomeTax = taxBase * 0.12

  // Surtax (prirez) - applied on income tax
  const surtax = incomeTax * municipalityRate

  // Total tax
  const totalTax = incomeTax + surtax

  // Contributions (monthly, multiply by 12 for yearly)
  const monthlyContributions = hasSecondPensionPillar
    ? MONTHLY_CONTRIBUTIONS.total
    : MONTHLY_CONTRIBUTIONS.healthInsurance + MONTHLY_CONTRIBUTIONS.pensionPillar1

  const yearlyContributions = monthlyContributions * 12

  // Health insurance (yearly)
  const healthInsurance = MONTHLY_CONTRIBUTIONS.healthInsurance * 12

  // Pension (yearly)
  const pension = hasSecondPensionPillar
    ? (MONTHLY_CONTRIBUTIONS.pensionPillar1 + MONTHLY_CONTRIBUTIONS.pensionPillar2) * 12
    : MONTHLY_CONTRIBUTIONS.pensionPillar1 * 12

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

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("hr-HR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Get municipality surtax rate
 */
export const MUNICIPALITY_RATES: Record<string, number> = {
  zagreb: 0.18,
  split: 0.15,
  rijeka: 0.15,
  osijek: 0.13,
  zadar: 0.12,
  slavonskibrod: 0.12,
  pula: 0.12,
  karlovac: 0.12,
  sisak: 0.1,
  varazdin: 0.1,
  sesvete: 0.18, // Part of Zagreb
  other: 0.1, // Default for smaller municipalities
  none: 0, // No surtax
}

/**
 * Get deadline for PO-SD submission
 */
export function getPOSDDeadline(year: number, quarter: 1 | 2 | 3 | 4): Date {
  // PO-SD is submitted quarterly by the 20th of the month following the quarter
  const deadlines: Record<number, [number, number]> = {
    1: [3, 20], // Q1 -> April 20
    2: [6, 20], // Q2 -> July 20
    3: [9, 20], // Q3 -> October 20
    4: [0, 20], // Q4 -> January 20 of NEXT year
  }

  const [month, day] = deadlines[quarter]
  const deadlineYear = quarter === 4 ? year + 1 : year

  return new Date(deadlineYear, month, day)
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
