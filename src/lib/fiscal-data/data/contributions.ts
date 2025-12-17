// src/lib/fiscal-data/data/contributions.ts

import type { ContributionsData } from "../types"

/**
 * Contribution Rates for Self-Employed (Obrtnici) 2025
 *
 * Sources:
 * - HZZO: https://www.hzzo.hr/obveznici-placanja-doprinosa/
 * - Porezna uprava: https://www.porezna-uprava.hr/
 * - HOK: https://www.hok.hr/
 */
export const CONTRIBUTIONS: ContributionsData = {
  year: 2025,
  lastVerified: "2025-01-15",
  source: "https://www.hzzo.hr/obveznici-placanja-doprinosa/",

  rates: {
    MIO_I: {
      rate: 0.15, // 15%
      name: "MIO I. stup",
      nameLong: "Mirovinsko osiguranje - I. stup (generacijska solidarnost)",
      iban: "HR1210010051863000160",
      model: "HR68",
      pozivNaBroj: "OIB-0000-000", // Format: OIB-mjesec-godina
    },
    MIO_II: {
      rate: 0.05, // 5%
      name: "MIO II. stup",
      nameLong: "Mirovinsko osiguranje - II. stup (individualna kapitalizirana štednja)",
      iban: "HR8724070001007120013",
      model: "HR68",
      pozivNaBroj: "OIB-0000-000",
    },
    HZZO: {
      rate: 0.165, // 16.5%
      name: "HZZO",
      nameLong: "Zdravstveno osiguranje",
      iban: "HR6510010051550100001",
      model: "HR68",
      pozivNaBroj: "OIB-0000-000",
    },
  },

  base: {
    minimum: 719.2, // EUR - minimalna mjesečna osnovica za 2025
    maximum: 9360.0, // EUR - maksimalna mjesečna osnovica za 2025
    description: "Osnovica za obračun doprinosa obrtnika",
  },

  monthly: {
    mioI: 107.88, // 719.20 * 0.15
    mioII: 35.96, // 719.20 * 0.05
    hzzo: 118.67, // 719.20 * 0.165
    total: 262.51, // Ukupno mjesečno
  },
} as const

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate monthly contributions for a given base
 */
export function calculateMonthlyContributions(base: number = CONTRIBUTIONS.base.minimum) {
  const clampedBase = Math.max(
    CONTRIBUTIONS.base.minimum,
    Math.min(base, CONTRIBUTIONS.base.maximum)
  )

  return {
    mioI: Math.round(clampedBase * CONTRIBUTIONS.rates.MIO_I.rate * 100) / 100,
    mioII: Math.round(clampedBase * CONTRIBUTIONS.rates.MIO_II.rate * 100) / 100,
    hzzo: Math.round(clampedBase * CONTRIBUTIONS.rates.HZZO.rate * 100) / 100,
    total:
      Math.round(
        clampedBase *
          (CONTRIBUTIONS.rates.MIO_I.rate +
            CONTRIBUTIONS.rates.MIO_II.rate +
            CONTRIBUTIONS.rates.HZZO.rate) *
          100
      ) / 100,
    base: clampedBase,
  }
}

/**
 * Calculate annual contributions
 */
export function calculateAnnualContributions(monthlyBase: number = CONTRIBUTIONS.base.minimum) {
  const monthly = calculateMonthlyContributions(monthlyBase)
  return {
    mioI: monthly.mioI * 12,
    mioII: monthly.mioII * 12,
    hzzo: monthly.hzzo * 12,
    total: monthly.total * 12,
    base: monthly.base * 12,
  }
}

/**
 * Get total contribution rate
 */
export function getTotalContributionRate(): number {
  return (
    CONTRIBUTIONS.rates.MIO_I.rate + CONTRIBUTIONS.rates.MIO_II.rate + CONTRIBUTIONS.rates.HZZO.rate
  )
}

export type ContributionKey = keyof typeof CONTRIBUTIONS.rates
