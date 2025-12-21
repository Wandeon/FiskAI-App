// src/lib/fiscal-data/data/thresholds.ts

import type { ThresholdsData } from "../types"

/**
 * Key Fiscal Thresholds for Croatia 2025
 *
 * Sources:
 * - Porezna uprava: https://www.porezna-uprava.hr/
 * - Narodne novine: https://narodne-novine.nn.hr/
 */
export const THRESHOLDS: ThresholdsData = {
  year: 2025,
  lastVerified: "2025-01-15",
  source: "https://www.porezna-uprava.hr/",

  // ===========================================================================
  // PDV (VAT) THRESHOLD
  // ===========================================================================
  pdv: {
    value: 60000, // EUR
    unit: "EUR",
    description: "Prag za obvezan ulazak u sustav PDV-a",
    source:
      "https://www.porezna-uprava.hr/HR_porezni_sustav/Stranice/porez_na_dodanu_vrijednost.aspx",
    effectiveFrom: "2025-01-01",
    previousValue: 40000,
    previousEffectiveUntil: "2024-12-31",
  },

  // ===========================================================================
  // PAUŠALNI OBRT LIMIT
  // ===========================================================================
  pausalni: {
    value: 60000, // EUR
    unit: "EUR",
    description: "Maksimalni godišnji primitak za paušalno oporezivanje obrta",
    source: "https://www.porezna-uprava.hr/HR_porezni_sustav/Stranice/pausalno_oporezivanje.aspx",
    effectiveFrom: "2025-01-01",
    previousValue: 39816.84,
    previousEffectiveUntil: "2024-12-31",
  },

  // ===========================================================================
  // CASH B2B LIMIT
  // ===========================================================================
  cashB2B: {
    value: 700, // EUR
    unit: "EUR",
    description: "Maksimalni iznos za gotovinska plaćanja između poslovnih subjekata",
    source: "https://www.porezna-uprava.hr/",
    effectiveFrom: "2023-01-01",
  },

  // ===========================================================================
  // ASSET CAPITALIZATION THRESHOLD
  // ===========================================================================
  assetCapitalization: {
    value: 464.53, // EUR (3500 HRK converted)
    unit: "EUR",
    description: "Prag za kapitalizaciju dugotrajne imovine (pojedinačna vrijednost)",
    source: "https://www.porezna-uprava.hr/",
    effectiveFrom: "2023-01-01",
  },
} as const

// =============================================================================
// ADDITIONAL THRESHOLDS (not in main object for cleaner structure)
// =============================================================================

export const ADDITIONAL_THRESHOLDS = {
  // Granica za mali poduzetnik (porez na dobit)
  smallBusinessRevenue: {
    value: 1000000, // EUR
    description: "Prag prihoda za primjenu niže stope poreza na dobit (10%)",
  },

  // Granica za mikro poduzetnike
  microBusinessAssets: {
    value: 350000, // EUR
    description: "Maksimalna vrijednost imovine za mikro poduzetnika",
  },

  microBusinessRevenue: {
    value: 700000, // EUR
    description: "Maksimalni prihod za mikro poduzetnika",
  },

  microBusinessEmployees: {
    value: 10,
    description: "Maksimalni broj zaposlenih za mikro poduzetnika",
  },

  // Temeljni kapital
  jdooCapital: {
    value: 1, // EUR
    description: "Minimalni temeljni kapital za j.d.o.o.",
  },

  dooCapital: {
    value: 2500, // EUR
    description: "Minimalni temeljni kapital za d.o.o.",
  },

  ddCapital: {
    value: 25000, // EUR
    description: "Minimalni temeljni kapital za d.d.",
  },

  jdooRevenueLimit: {
    value: 1000000, // EUR
    description: "Godišnji prihod iznad kojeg j.d.o.o. prelazi u d.o.o.",
  },

  // R-1 vs R-2 račun
  r1InvoiceThreshold: {
    value: 700, // EUR - B2B gotovina
    description: "Iznad ovog iznosa B2B mora biti bezgotovinsko plaćanje",
  },

  // Fiskalizacija
  fiscalizationRequired: {
    value: 0, // Uvijek obavezna za gotovinu
    description: "Fiskalizacija je obvezna za sve gotovinske transakcije",
  },
} as const

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if revenue requires VAT registration
 */
export function requiresVATRegistration(annualRevenue: number): boolean {
  return annualRevenue > THRESHOLDS.pdv.value
}

/**
 * Check if revenue exceeds paušalni limit
 */
export function exceedsPausalniLimit(annualRevenue: number): boolean {
  return annualRevenue > THRESHOLDS.pausalni.value
}

/**
 * Check if cash payment is allowed for B2B
 */
export function isCashB2BAllowed(amount: number): boolean {
  return amount <= THRESHOLDS.cashB2B.value
}

/**
 * Check if asset should be capitalized (depreciated) or expensed
 */
export function shouldCapitalizeAsset(value: number): boolean {
  return value > THRESHOLDS.assetCapitalization.value
}

/**
 * Get the effective threshold value (handles date-based transitions)
 */
export function getEffectiveThreshold(
  threshold: typeof THRESHOLDS.pdv,
  date: Date = new Date()
): number {
  if (threshold.effectiveFrom) {
    const effectiveDate = new Date(threshold.effectiveFrom)
    if (date < effectiveDate && threshold.previousValue !== undefined) {
      return threshold.previousValue
    }
  }
  return threshold.value
}
