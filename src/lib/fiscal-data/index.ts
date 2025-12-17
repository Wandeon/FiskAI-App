// src/lib/fiscal-data/index.ts

/**
 * Fiscal Data - Central Export
 *
 * Single source of truth for all fiscal values in the FiskAI application.
 * All components, calculators, and content should import from here.
 *
 * @example
 * import { CONTRIBUTIONS, THRESHOLDS, TAX_RATES } from '@/lib/fiscal-data'
 *
 * const mioRate = CONTRIBUTIONS.rates.MIO_I.rate // 0.15
 * const pdvThreshold = THRESHOLDS.pdv.value // 60000
 */

// =============================================================================
// DATA EXPORTS
// =============================================================================

export {
  CONTRIBUTIONS,
  calculateMonthlyContributions,
  calculateAnnualContributions,
  getTotalContributionRate,
} from "./data/contributions"
export type { ContributionKey } from "./data/contributions"

export {
  TAX_RATES,
  getIncomeTaxBracket,
  calculateIncomeTax,
  getPausalTaxBracket,
  getCorporateTaxRate,
  exceedsPausalLimit,
} from "./data/tax-rates"

export {
  THRESHOLDS,
  ADDITIONAL_THRESHOLDS,
  requiresVATRegistration,
  exceedsPausalniLimit,
  isCashB2BAllowed,
  shouldCapitalizeAsset,
  getEffectiveThreshold,
} from "./data/thresholds"

export {
  DEADLINES,
  ADDITIONAL_DEADLINES,
  getNextDeadline,
  getUpcomingDeadlines,
  formatDeadlineDate,
} from "./data/deadlines"

export {
  PAYMENT_DETAILS,
  POZIV_NA_BROJ_CODES,
  generateContributionReference,
  generatePausalTaxReference,
  generateHOKReference,
  isValidIBAN,
  formatIBAN,
  getPaymentSlipData,
} from "./data/payment-details"

export {
  CHAMBER_FEES,
  HGK_FEES,
  calculateAnnualHOKFee,
  calculateQuarterlyHOKFee,
  getTZRate,
  calculateTZContribution,
  getHGKCategory,
  calculateHGKFee,
  getNextHOKDeadline,
  getTZGroupByNKD,
} from "./data/chamber-fees"

// =============================================================================
// UTILITY EXPORTS
// =============================================================================

export { getValueByPath, setValueByPath } from "./utils/get-value"
export { formatFiscalValue, formatCurrency, formatPercentage } from "./utils/format"
export { getEffectiveValue, isValueEffective } from "./utils/effective-date"

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type {
  FiscalMetadata,
  ValueWithMetadata,
  ContributionRate,
  ContributionBase,
  MonthlyContributions,
  ContributionsData,
  TaxBracket,
  PausalTaxBracket,
  IncomeTaxData,
  CorporateTaxData,
  PausalTaxData,
  TaxRatesData,
  ThresholdValue,
  ThresholdsData,
  Deadline,
  DeadlinesData,
  PaymentAccount,
  PaymentDetailsData,
  ChamberFeesData,
  ValidationSource,
  ValidationResult,
  FiscalDataPath,
  FormatType,
} from "./types"

// =============================================================================
// METADATA
// =============================================================================

/**
 * Combined metadata for all fiscal data
 */
export const FISCAL_DATA_METADATA = {
  version: "2025.1",
  lastUpdated: "2025-01-15",
  sources: [
    "https://www.porezna-uprava.hr/",
    "https://www.hzzo.hr/",
    "https://www.hok.hr/",
    "https://narodne-novine.nn.hr/",
  ],
  validationSchedule: "weekly",
  nextValidation: getNextValidationDate(),
}

function getNextValidationDate(): string {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  const nextMonday = new Date(now)
  nextMonday.setDate(now.getDate() + daysUntilMonday)
  nextMonday.setHours(6, 0, 0, 0)
  return nextMonday.toISOString()
}
