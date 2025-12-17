// src/lib/fiscal-data/data/payment-details.ts

import type { PaymentDetailsData } from "../types"

/**
 * Payment Details for Croatian Tax Obligations
 *
 * Sources:
 * - Porezna uprava: https://www.porezna-uprava.hr/
 * - FINA: https://www.fina.hr/
 */
export const PAYMENT_DETAILS: PaymentDetailsData = {
  year: 2025,
  lastVerified: "2025-01-15",
  source: "https://www.porezna-uprava.hr/",

  accounts: {
    // ===========================================================================
    // STATE BUDGET (Državni proračun) - For income tax, VAT, etc.
    // ===========================================================================
    stateBudget: {
      name: "Državni proračun",
      iban: "HR1210010051863000160",
      model: "HR68",
      pozivNaBrojFormat: "OIB-VVVV-SSSS", // OIB-vrsta prihoda-šifra općine
      description: "Za uplatu poreza na dohodak, PDV-a i ostalih poreza",
    },

    // ===========================================================================
    // MIO II (Second Pension Pillar)
    // ===========================================================================
    mioII: {
      name: "MIO II. stup",
      iban: "HR8724070001007120013",
      model: "HR68",
      pozivNaBrojFormat: "OIB-MMGG-XXX", // OIB-mjesec+godina-kontrolni broj
      description: "Za uplatu doprinosa za II. mirovinski stup",
    },

    // ===========================================================================
    // HZZO (Health Insurance)
    // ===========================================================================
    hzzo: {
      name: "HZZO - zdravstveno osiguranje",
      iban: "HR6510010051550100001",
      model: "HR68",
      pozivNaBrojFormat: "OIB-MMGG-XXX",
      description: "Za uplatu doprinosa za obvezno zdravstveno osiguranje",
    },

    // ===========================================================================
    // HOK (Croatian Chamber of Crafts)
    // ===========================================================================
    hok: {
      name: "Hrvatska obrtnička komora",
      iban: "HR1223400091100106237",
      model: "HR68",
      pozivNaBrojFormat: "OBRTNICA-KVGG", // Broj obrtnice-kvartal+godina
      description: "Za uplatu članarine Hrvatskoj obrtničkoj komori",
    },
  },
} as const

// =============================================================================
// POZIV NA BROJ REFERENCE CODES
// =============================================================================

export const POZIV_NA_BROJ_CODES = {
  // Vrste prihoda za porez na dohodak
  incomeTypes: {
    "1812": "Porez na dohodak od samostalne djelatnosti",
    "1820": "Porez na dohodak - mjesečna akontacija",
    "1847": "Porez na dohodak - paušalno oporezivanje",
    "1862": "Prirez porezu na dohodak",
  },

  // PDV šifre
  vatTypes: {
    "1633": "PDV - mjesečna prijava",
    "1641": "PDV - kvartalna prijava",
  },

  // Doprinosi
  contributionTypes: {
    "8486": "MIO I. stup - obvezni doprinos",
    "8494": "MIO II. stup - obvezni doprinos",
    "8508": "Doprinos za zdravstveno osiguranje",
  },
} as const

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate poziv na broj for MIO/HZZO contributions
 */
export function generateContributionReference(oib: string, month: number, year: number): string {
  const monthStr = month.toString().padStart(2, "0")
  const yearStr = year.toString().slice(-2)
  return `${oib}-${monthStr}${yearStr}-000`
}

/**
 * Generate poziv na broj for paušalni tax
 */
export function generatePausalTaxReference(
  oib: string,
  quarter: 1 | 2 | 3 | 4,
  year: number
): string {
  const yearStr = year.toString().slice(-2)
  return `${oib}-${quarter}${yearStr}-1847`
}

/**
 * Generate poziv na broj for HOK membership
 */
export function generateHOKReference(
  obrtnicaNumber: string,
  quarter: 1 | 2 | 3 | 4,
  year: number
): string {
  const yearStr = year.toString().slice(-2)
  return `${obrtnicaNumber}-${quarter}${yearStr}`
}

/**
 * Validate IBAN format (basic check)
 */
export function isValidIBAN(iban: string): boolean {
  const cleanIban = iban.replace(/\s/g, "").toUpperCase()
  // Croatian IBAN: HR + 2 check digits + 17 digits = 21 characters
  return /^HR\d{19}$/.test(cleanIban)
}

/**
 * Format IBAN with spaces for display
 */
export function formatIBAN(iban: string): string {
  const clean = iban.replace(/\s/g, "")
  return clean.match(/.{1,4}/g)?.join(" ") || clean
}

/**
 * Get payment slip data for a specific payment type
 */
export function getPaymentSlipData(
  type: "mioI" | "mioII" | "hzzo" | "hok" | "pausalTax",
  oib: string,
  amount: number,
  period: { month?: number; quarter?: number; year: number }
) {
  const accounts = PAYMENT_DETAILS.accounts

  switch (type) {
    case "mioI":
      return {
        primatelj: "Državni proračun RH",
        iban: accounts.stateBudget.iban,
        model: "HR68",
        pozivNaBroj: generateContributionReference(oib, period.month || 1, period.year),
        iznos: amount,
        opis: `MIO I. stup - ${period.month}/${period.year}`,
      }

    case "mioII":
      return {
        primatelj: "REGOS - MIO II. stup",
        iban: accounts.mioII.iban,
        model: "HR68",
        pozivNaBroj: generateContributionReference(oib, period.month || 1, period.year),
        iznos: amount,
        opis: `MIO II. stup - ${period.month}/${period.year}`,
      }

    case "hzzo":
      return {
        primatelj: "HZZO",
        iban: accounts.hzzo.iban,
        model: "HR68",
        pozivNaBroj: generateContributionReference(oib, period.month || 1, period.year),
        iznos: amount,
        opis: `Zdravstveno osiguranje - ${period.month}/${period.year}`,
      }

    case "hok":
      return {
        primatelj: "Hrvatska obrtnička komora",
        iban: accounts.hok.iban,
        model: "HR68",
        pozivNaBroj: `HOK-${period.quarter}${period.year.toString().slice(-2)}`,
        iznos: amount,
        opis: `HOK članarina - Q${period.quarter}/${period.year}`,
      }

    case "pausalTax":
      return {
        primatelj: "Državni proračun RH",
        iban: accounts.stateBudget.iban,
        model: "HR68",
        pozivNaBroj: generatePausalTaxReference(oib, period.quarter as 1 | 2 | 3 | 4, period.year),
        iznos: amount,
        opis: `Paušalni porez - Q${period.quarter}/${period.year}`,
      }
  }
}
