// src/lib/fiscal-data/types.ts

/**
 * Fiscal Data Types
 * Central type definitions for all fiscal values in the system
 */

// =============================================================================
// METADATA TYPES
// =============================================================================

export interface FiscalMetadata {
  year: number
  lastVerified: string // ISO date string
  source?: string
}

export interface ValueWithMetadata<T> {
  value: T
  unit?: "EUR" | "percentage" | "days"
  description: string
  source: string
  effectiveFrom?: string // ISO date string
  effectiveUntil?: string // ISO date string
}

// =============================================================================
// CONTRIBUTION TYPES
// =============================================================================

export interface ContributionRate {
  rate: number
  name: string
  nameLong?: string
  iban: string
  model: string
  pozivNaBroj: string
}

export interface ContributionBase {
  minimum: number
  maximum: number
  description?: string
}

export interface MonthlyContributions {
  mioI: number
  mioII: number
  hzzo: number
  total: number
}

export interface ContributionsData extends FiscalMetadata {
  rates: {
    MIO_I: ContributionRate
    MIO_II: ContributionRate
    HZZO: ContributionRate
  }
  base: ContributionBase
  monthly: MonthlyContributions
}

// =============================================================================
// TAX RATE TYPES
// =============================================================================

export interface TaxBracket {
  min: number
  max: number
  rate: number
  rateWithSurtax?: number // Rate including average prirez
  description?: string
}

export interface PausalTaxBracket {
  min: number
  max: number
  base: number // Porezna osnovica
  annualTax: number
  quarterlyTax: number
}

export interface IncomeTaxData extends FiscalMetadata {
  brackets: TaxBracket[]
  personalAllowance: number // Osobni odbitak
  averageSurtax: number // Prosječni prirez
}

export interface CorporateTaxData extends FiscalMetadata {
  small: {
    maxRevenue: number
    rate: number
  }
  large: {
    minRevenue: number
    rate: number
  }
}

export interface PausalTaxData extends FiscalMetadata {
  rate: number
  brackets: PausalTaxBracket[]
  maxRevenue: number
  normativeExpenseRate: number
}

export interface VatRate {
  rate: number
  label: string
  description?: string
}

export interface VatRatesData extends FiscalMetadata {
  standard: VatRate
  reduced: VatRate[]
}

export interface TaxRatesData {
  income: IncomeTaxData
  corporate: CorporateTaxData
  pausal: PausalTaxData
  vat: VatRatesData
}

// =============================================================================
// THRESHOLD TYPES
// =============================================================================

export interface ThresholdValue extends ValueWithMetadata<number> {
  previousValue?: number
  previousEffectiveUntil?: string
}

export interface ThresholdsData extends FiscalMetadata {
  pdv: ThresholdValue
  pausalni: ThresholdValue
  cashB2B: ThresholdValue
  assetCapitalization: ThresholdValue
}

// =============================================================================
// DEADLINE TYPES
// =============================================================================

export interface Deadline {
  name: string
  description: string
  dates: string[] // For recurring deadlines (e.g., quarterly)
  frequency: "monthly" | "quarterly" | "annual" | "one-time"
}

export interface DeadlinesData extends FiscalMetadata {
  contributions: {
    monthly: Deadline
    mioII: Deadline
  }
  pausalTax: Deadline
  hok: Deadline
  annualFiling: {
    dohodak: Deadline
    dobit: Deadline
  }
}

// =============================================================================
// PAYMENT DETAILS TYPES
// =============================================================================

export interface PaymentAccount {
  name: string
  iban: string
  model: string
  pozivNaBrojFormat: string
  description?: string
}

export interface PaymentDetailsData extends FiscalMetadata {
  accounts: {
    stateBudget: PaymentAccount // Državni proračun
    mioII: PaymentAccount
    hzzo: PaymentAccount
    hok: PaymentAccount
  }
}

// =============================================================================
// CHAMBER FEES TYPES
// =============================================================================

export interface ChamberFeesData extends FiscalMetadata {
  hok: {
    monthly: number
    quarterly: number
    annual: number
    deadlines: string[]
  }
  tz: {
    groups: {
      id: string
      rate: number
      description: string
      activities: string[]
    }[]
  }
}

// =============================================================================
// VALIDATION TYPES
// =============================================================================

export interface ValidationSource {
  id: string
  url: string
  dataPoints: string[]
  priority: number
  lastChecked?: string
  lastStatus?: "success" | "error" | "timeout"
}

export interface ValidationResult {
  dataPoint: string
  currentValue: number | string
  foundValue: number | string | null
  status: "match" | "mismatch" | "uncertain" | "error"
  confidence: number
  sourceUrl: string
  extractedText?: string
  checkedAt: string
}

// =============================================================================
// RTL INTEGRATION TYPES
// =============================================================================

/**
 * Audit trail entry for tracking fiscal data changes
 */
export interface FiscalDataAuditEntry {
  /** Unique ID for this audit entry */
  id: string
  /** Timestamp of the change detection */
  timestamp: string
  /** Data point that changed */
  dataPoint: string
  /** Previous value */
  previousValue: string | number | null
  /** New value detected */
  newValue: string | number | null
  /** Confidence level (0-1) */
  confidence: number
  /** Source URL where change was detected */
  sourceUrl: string
  /** RTL source pointer IDs backing this change */
  sourcePointerIds: string[]
  /** RTL evidence IDs */
  evidenceIds: string[]
  /** Who/what initiated the change */
  changedBy: "rtl-automated" | "manual-review" | "api-update"
  /** Status of the change */
  status: "pending" | "approved" | "rejected" | "applied"
  /** Notes or rejection reason */
  notes?: string
}

/**
 * Version history entry for fiscal data
 */
export interface FiscalDataVersionEntry {
  /** Version identifier (e.g., "2025.1") */
  version: string
  /** ISO timestamp when this version was applied */
  appliedAt: string
  /** Data points changed in this version */
  changes: Array<{
    dataPoint: string
    previousValue: string | number | null
    newValue: string | number
    auditEntryId: string
  }>
  /** Who approved this version */
  approvedBy: string
  /** RTL evidence backing this version */
  evidenceIds: string[]
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type FiscalDataPath =
  | `CONTRIBUTIONS.${string}`
  | `TAX_RATES.${string}`
  | `THRESHOLDS.${string}`
  | `ADDITIONAL_THRESHOLDS.${string}`
  | `DEADLINES.${string}`
  | `ADDITIONAL_DEADLINES.${string}`
  | `PAYMENT_DETAILS.${string}`
  | `CHAMBER_FEES.${string}`

export type FormatType = "currency" | "percentage" | "number" | "date"
