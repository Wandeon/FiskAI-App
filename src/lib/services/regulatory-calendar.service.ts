// src/lib/services/regulatory-calendar.service.ts

/**
 * RegulatoryCalendarService
 *
 * Authoritative facade for fiscal limits, rates, and deadlines.
 * Powers token resolution ({{pausal_limit}}, {{vat_rate_standard}}, etc.)
 * and the ComplianceService.
 *
 * This service wraps the existing fiscal-data module - it does NOT duplicate logic.
 *
 * @example
 * import { regulatoryCalendarService } from '@/lib/services/regulatory-calendar.service'
 *
 * const limit = regulatoryCalendarService.getPausalLimit() // 60000
 * const vatRate = regulatoryCalendarService.getVatRate('standard') // 0.25
 * const nextDeadline = regulatoryCalendarService.getNextDeadline('pausalTax')
 */

import {
  THRESHOLDS,
  TAX_RATES,
  CONTRIBUTIONS,
  DEADLINES,
  ADDITIONAL_DEADLINES,
  getNextDeadline as fiscalGetNextDeadline,
  getUpcomingDeadlines as fiscalGetUpcomingDeadlines,
  getPausalTaxBracket as fiscalGetPausalTaxBracket,
  calculateMonthlyContributions as fiscalCalculateMonthlyContributions,
  getEffectiveThreshold,
} from "@/lib/fiscal-data"
import type {
  PausalTaxBracket,
  ContributionRate,
  MonthlyContributions,
  Deadline,
} from "@/lib/fiscal-data"

// =============================================================================
// TYPES
// =============================================================================

/**
 * Contribution types supported by the service
 */
export type ContributionType = "MIO" | "MIO_I" | "MIO_II" | "HZZO"

/**
 * Deadline types supported by the service
 */
export type DeadlineType = "pausalTax" | "contributions" | "hok" | "dohodak" | "dobit"

/**
 * VAT rate types
 */
export type VatRateType = "standard" | "reduced" | "reduced2"

/**
 * Extended contribution info returned by getContribution
 */
export interface ContributionInfo extends ContributionRate {
  /** Combined MIO rate (MIO_I + MIO_II) when type is 'MIO' */
  combinedRate?: number
}

/**
 * Extended monthly contributions with base included
 */
export interface MonthlyContributionsResult extends MonthlyContributions {
  base: number
}

/**
 * Deadline result with calculated date
 */
export interface DeadlineResult {
  name: string
  description: string
  date: Date
  type: DeadlineType
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

/**
 * RegulatoryCalendarService
 *
 * Facade over fiscal-data module providing a clean API for:
 * - Thresholds (pausal limit, VAT threshold)
 * - Tax rates (VAT, pausal, income, corporate)
 * - Contributions (MIO I, MIO II, HZZO)
 * - Deadlines (quarterly tax, monthly contributions, annual filings)
 * - Date/year helpers
 */
export class RegulatoryCalendarService {
  // ===========================================================================
  // THRESHOLDS
  // ===========================================================================

  /**
   * Get the pausal (lump-sum) taxation limit
   *
   * @param year - Optional year (for future year-specific values)
   * @returns The maximum annual revenue allowed for pausal taxation (EUR)
   *
   * @example
   * getPausalLimit() // 60000
   */
  getPausalLimit(year?: number): number {
    // For now, return current value. Year parameter reserved for future use
    // when historical/future values are needed
    if (year && year < this.getCurrentYear()) {
      // Use effective threshold for historical dates
      const historicalDate = new Date(year, 11, 31) // End of that year
      return getEffectiveThreshold(THRESHOLDS.pausalni, historicalDate)
    }
    return THRESHOLDS.pausalni.value
  }

  /**
   * Get the VAT registration threshold
   *
   * @param year - Optional year (for future year-specific values)
   * @returns The revenue threshold above which VAT registration is mandatory (EUR)
   *
   * @example
   * getVatThreshold() // 60000
   */
  getVatThreshold(year?: number): number {
    if (year && year < this.getCurrentYear()) {
      const historicalDate = new Date(year, 11, 31)
      return getEffectiveThreshold(THRESHOLDS.pdv, historicalDate)
    }
    return THRESHOLDS.pdv.value
  }

  // ===========================================================================
  // TAX RATES
  // ===========================================================================

  /**
   * Get VAT rate by type
   *
   * @param type - 'standard' (25%), 'reduced' (13%), or 'reduced2' (5%)
   * @returns The VAT rate as a decimal (e.g., 0.25 for 25%)
   *
   * @example
   * getVatRate('standard') // 0.25
   * getVatRate('reduced')  // 0.13
   * getVatRate('reduced2') // 0.05
   */
  getVatRate(type: VatRateType): number {
    switch (type) {
      case "standard":
        return TAX_RATES.vat.standard.rate
      case "reduced":
        return TAX_RATES.vat.reduced[0].rate
      case "reduced2":
        return TAX_RATES.vat.reduced[1].rate
      default:
        throw new Error(`Unknown VAT rate type: ${type}`)
    }
  }

  /**
   * Get the pausal tax rate
   *
   * @param type - Tax type (currently only 'pausal' supported)
   * @param year - Optional year
   * @returns The tax rate as a decimal
   *
   * @example
   * getTaxRate('pausal') // 0.12
   */
  getTaxRate(type: "pausal", _year?: number): number {
    if (type === "pausal") {
      return TAX_RATES.pausal.rate
    }
    throw new Error(`Unknown tax rate type: ${type}`)
  }

  /**
   * Get pausal tax bracket for a given annual revenue
   *
   * @param annualRevenue - Annual revenue in EUR
   * @returns The applicable tax bracket with base, annual tax, and quarterly tax
   *
   * @example
   * getPausalTaxBracket(25000)
   * // { min: 19900.01, max: 30600, base: 4590, annualTax: 550.8, quarterlyTax: 137.7 }
   */
  getPausalTaxBracket(annualRevenue: number): PausalTaxBracket {
    return fiscalGetPausalTaxBracket(annualRevenue)
  }

  // ===========================================================================
  // CONTRIBUTIONS
  // ===========================================================================

  /**
   * Get contribution information by type
   *
   * @param type - 'MIO' (combined), 'MIO_I', 'MIO_II', or 'HZZO'
   * @param year - Optional year
   * @returns Contribution rate info including rate, name, IBAN, etc.
   *
   * @example
   * getContribution('MIO_I')
   * // { rate: 0.15, name: 'MIO I. stup', iban: '...', ... }
   *
   * getContribution('MIO')
   * // { rate: 0.15, combinedRate: 0.20, name: 'MIO I. stup', ... }
   */
  getContribution(type: ContributionType, _year?: number): ContributionInfo {
    if (type === "MIO") {
      // MIO combines MIO_I and MIO_II
      const mioI = CONTRIBUTIONS.rates.MIO_I
      const mioII = CONTRIBUTIONS.rates.MIO_II
      return {
        ...mioI,
        combinedRate: mioI.rate + mioII.rate,
      }
    }

    const contributionKey = type as keyof typeof CONTRIBUTIONS.rates
    if (!(contributionKey in CONTRIBUTIONS.rates)) {
      throw new Error(`Unknown contribution type: ${type}`)
    }

    return { ...CONTRIBUTIONS.rates[contributionKey] }
  }

  /**
   * Calculate monthly contributions for a given base
   *
   * @param base - Monthly contribution base (defaults to minimum base)
   * @returns Monthly contribution amounts for MIO I, MIO II, HZZO, and total
   *
   * @example
   * getMonthlyContributions()
   * // { mioI: 107.88, mioII: 35.96, hzzo: 118.67, total: 262.51, base: 719.2 }
   */
  getMonthlyContributions(base?: number): MonthlyContributionsResult {
    return fiscalCalculateMonthlyContributions(base)
  }

  /**
   * Get the minimum contribution base
   *
   * @returns Minimum monthly base for contribution calculations
   */
  getMinimumContributionBase(): number {
    return CONTRIBUTIONS.base.minimum
  }

  /**
   * Get the maximum contribution base
   *
   * @returns Maximum monthly base for contribution calculations
   */
  getMaximumContributionBase(): number {
    return CONTRIBUTIONS.base.maximum
  }

  // ===========================================================================
  // DEADLINES
  // ===========================================================================

  /**
   * Get the next deadline for a given type
   *
   * @param type - Deadline type: 'pausalTax', 'contributions', 'hok', 'dohodak', 'dobit'
   * @param fromDate - Calculate from this date (defaults to now)
   * @returns The next deadline date
   *
   * @example
   * getNextDeadline('pausalTax') // Date for next quarterly tax payment
   * getNextDeadline('contributions') // Date for next monthly contribution
   */
  getNextDeadline(type: DeadlineType, fromDate: Date = new Date()): Date {
    const deadline = this.getDeadlineConfig(type)
    return fiscalGetNextDeadline(deadline, fromDate)
  }

  /**
   * Get all upcoming deadlines within a specified number of days
   *
   * @param withinDays - Number of days to look ahead (default: 30)
   * @param fromDate - Start date (defaults to now)
   * @returns Array of upcoming deadlines sorted by date
   *
   * @example
   * getUpcomingDeadlines(60)
   * // [{ name: 'Mjesečni doprinosi', date: Date, description: '...' }, ...]
   */
  getUpcomingDeadlines(
    withinDays: number = 30,
    fromDate: Date = new Date()
  ): Array<{ name: string; date: Date; description: string }> {
    return fiscalGetUpcomingDeadlines(withinDays, fromDate)
  }

  /**
   * Get deadline configuration for a given type
   * @internal
   */
  private getDeadlineConfig(type: DeadlineType): Deadline {
    switch (type) {
      case "pausalTax":
        return DEADLINES.pausalTax
      case "contributions":
        return DEADLINES.contributions.monthly
      case "hok":
        return DEADLINES.hok
      case "dohodak":
        return DEADLINES.annualFiling.dohodak
      case "dobit":
        return DEADLINES.annualFiling.dobit
      default:
        throw new Error(`Unknown deadline type: ${type}`)
    }
  }

  // ===========================================================================
  // YEAR/DATE HELPERS
  // ===========================================================================

  /**
   * Get the current calendar year
   *
   * @returns Current year number
   *
   * @example
   * getCurrentYear() // 2025
   */
  getCurrentYear(): number {
    return new Date().getFullYear()
  }

  /**
   * Get the effective date for regulatory calculations
   * This is typically the current date, but can be overridden for testing
   *
   * @returns The effective date for calculations
   */
  getEffectiveDate(): Date {
    return new Date()
  }

  /**
   * Get the current quarter (1-4)
   *
   * @returns Current quarter number
   *
   * @example
   * getCurrentQuarter() // 1 (for Jan-Mar)
   */
  getCurrentQuarter(): number {
    const month = new Date().getMonth()
    return Math.floor(month / 3) + 1
  }

  /**
   * Get the current month (1-12)
   *
   * @returns Current month number (1-indexed)
   */
  getCurrentMonth(): number {
    return new Date().getMonth() + 1
  }

  // ===========================================================================
  // TOKEN RESOLUTION HELPERS
  // ===========================================================================

  /**
   * Get all values needed for token resolution
   * Returns a flat object with all common token values
   *
   * @returns Object with all token values
   *
   * @example
   * getTokenValues()
   * // {
   * //   pausal_limit: 60000,
   * //   vat_threshold: 60000,
   * //   vat_rate_standard: 0.25,
   * //   vat_rate_reduced: 0.13,
   * //   vat_rate_reduced2: 0.05,
   * //   current_year: 2025,
   * //   mio_i_rate: 0.15,
   * //   mio_ii_rate: 0.05,
   * //   hzzo_rate: 0.165,
   * //   ...
   * // }
   */
  getTokenValues(): Record<string, string | number> {
    const monthlyContribs = this.getMonthlyContributions()

    return {
      // Thresholds
      pausal_limit: this.getPausalLimit(),
      vat_threshold: this.getVatThreshold(),

      // VAT rates
      vat_rate_standard: this.getVatRate("standard"),
      vat_rate_reduced: this.getVatRate("reduced"),
      vat_rate_reduced2: this.getVatRate("reduced2"),

      // Pausal tax
      pausal_tax_rate: this.getTaxRate("pausal"),

      // Contribution rates
      mio_i_rate: CONTRIBUTIONS.rates.MIO_I.rate,
      mio_ii_rate: CONTRIBUTIONS.rates.MIO_II.rate,
      hzzo_rate: CONTRIBUTIONS.rates.HZZO.rate,
      total_contribution_rate:
        CONTRIBUTIONS.rates.MIO_I.rate +
        CONTRIBUTIONS.rates.MIO_II.rate +
        CONTRIBUTIONS.rates.HZZO.rate,

      // Monthly contribution amounts (at minimum base)
      monthly_mio_i: monthlyContribs.mioI,
      monthly_mio_ii: monthlyContribs.mioII,
      contribution_mio: monthlyContribs.mioI + monthlyContribs.mioII, // Combined MIO total
      monthly_hzzo: monthlyContribs.hzzo,
      monthly_contributions_total: monthlyContribs.total,
      contribution_base_minimum: CONTRIBUTIONS.base.minimum,
      contribution_base_maximum: CONTRIBUTIONS.base.maximum,

      // Date/time
      current_year: this.getCurrentYear(),
      current_quarter: this.getCurrentQuarter(),
      current_month: this.getCurrentMonth(),
    }
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

/**
 * Singleton instance of RegulatoryCalendarService
 *
 * @example
 * import { regulatoryCalendarService } from '@/lib/services/regulatory-calendar.service'
 *
 * const limit = regulatoryCalendarService.getPausalLimit()
 */
export const regulatoryCalendarService = new RegulatoryCalendarService()

// Also export the class for testing
export default RegulatoryCalendarService
