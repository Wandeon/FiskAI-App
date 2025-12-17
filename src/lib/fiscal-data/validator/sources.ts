// src/lib/fiscal-data/validator/sources.ts

import type { ValidationSource } from "../types"

/**
 * Official sources to monitor for fiscal data changes
 *
 * Each source maps to specific data points in our fiscal-data config.
 * The validator will check these URLs weekly and extract relevant values.
 */
export const VALIDATION_SOURCES: Record<string, ValidationSource[]> = {
  // ===========================================================================
  // CONTRIBUTION RATES
  // ===========================================================================
  contributions: [
    {
      id: "porezna-doprinosi",
      url: "https://www.porezna-uprava.hr/HR_porezni_sustav/Stranice/doprinosi.aspx",
      dataPoints: [
        "CONTRIBUTIONS.rates.MIO_I.rate",
        "CONTRIBUTIONS.rates.MIO_II.rate",
        "CONTRIBUTIONS.rates.HZZO.rate",
        "CONTRIBUTIONS.base.minimum",
        "CONTRIBUTIONS.base.maximum",
      ],
      priority: 1,
    },
    {
      id: "regos-mio",
      url: "https://www.regos.hr/default.aspx?id=679",
      dataPoints: ["CONTRIBUTIONS.rates.MIO_I.rate", "CONTRIBUTIONS.rates.MIO_II.rate"],
      priority: 2,
    },
  ],

  // ===========================================================================
  // TAX RATES
  // ===========================================================================
  taxRates: [
    {
      id: "porezna-porez-dohodak",
      url: "https://www.porezna-uprava.hr/HR_porezni_sustav/Stranice/porez_na_dohodak.aspx",
      dataPoints: [
        "TAX_RATES.income.brackets.0.rate",
        "TAX_RATES.income.brackets.1.rate",
        "TAX_RATES.income.personalAllowance",
      ],
      priority: 1,
    },
    {
      id: "porezna-porez-dobit",
      url: "https://www.porezna-uprava.hr/HR_porezni_sustav/Stranice/porez_na_dobit.aspx",
      dataPoints: [
        "TAX_RATES.corporate.small.rate",
        "TAX_RATES.corporate.large.rate",
        "TAX_RATES.corporate.small.maxRevenue",
      ],
      priority: 1,
    },
    {
      id: "porezna-pausalno",
      url: "https://www.porezna-uprava.hr/HR_porezni_sustav/Stranice/pausalno_oporezivanje.aspx",
      dataPoints: [
        "TAX_RATES.pausal.rate",
        "TAX_RATES.pausal.maxRevenue",
        "TAX_RATES.pausal.brackets",
      ],
      priority: 1,
    },
  ],

  // ===========================================================================
  // THRESHOLDS
  // ===========================================================================
  thresholds: [
    {
      id: "porezna-pdv-prag",
      url: "https://www.porezna-uprava.hr/HR_porezni_sustav/Stranice/porez_na_dodanu_vrijednost.aspx",
      dataPoints: ["THRESHOLDS.pdv.value"],
      priority: 1,
    },
    {
      id: "porezna-pausalni-limit",
      url: "https://www.porezna-uprava.hr/HR_porezni_sustav/Stranice/pausalno_oporezivanje.aspx",
      dataPoints: ["THRESHOLDS.pausalni.value"],
      priority: 1,
    },
  ],

  // ===========================================================================
  // CHAMBER FEES
  // Note: HOK and HGK sites have restructured, direct fee pages not available
  // Chamber fees change infrequently and are verified manually
  // ===========================================================================
  chamberFees: [
    {
      id: "hok-obveze",
      url: "https://www.hok.hr/gospodarstvo-i-savjetovanje/poslovne-knjige-i-obveze-obrtnika",
      dataPoints: [
        "CHAMBER_FEES.hok.monthly",
        "CHAMBER_FEES.hok.quarterly",
        "CHAMBER_FEES.hok.annual",
      ],
      priority: 3, // Lower priority - fee info may not be on this page
    },
  ],

  // ===========================================================================
  // PAYMENT DETAILS
  // ===========================================================================
  paymentDetails: [
    {
      id: "fina-ibans",
      url: "https://www.fina.hr/platni-promet",
      dataPoints: [
        "PAYMENT_DETAILS.accounts.stateBudget.iban",
        "PAYMENT_DETAILS.accounts.mioII.iban",
        "PAYMENT_DETAILS.accounts.hzzo.iban",
      ],
      priority: 2,
    },
  ],

  // ===========================================================================
  // LEGAL CHANGES (Narodne novine)
  // ===========================================================================
  legalChanges: [
    {
      id: "nn-porezna-reforma",
      url: "https://narodne-novine.nn.hr/search.aspx?sortiraj=datum&currentPage=1&upit=porez",
      dataPoints: ["TAX_RATES.*", "THRESHOLDS.*", "CONTRIBUTIONS.*"],
      priority: 3, // Lower priority, checked for major changes
    },
  ],
}

/**
 * Get all sources for a specific category
 */
export function getSourcesForCategory(category: string): ValidationSource[] {
  return VALIDATION_SOURCES[category] || []
}

/**
 * Get all sources sorted by priority
 */
export function getAllSources(): ValidationSource[] {
  return Object.values(VALIDATION_SOURCES)
    .flat()
    .sort((a, b) => a.priority - b.priority)
}

/**
 * Get sources for specific data points
 */
export function getSourcesForDataPoint(dataPoint: string): ValidationSource[] {
  return getAllSources().filter((source) =>
    source.dataPoints.some(
      (dp) => dp === dataPoint || (dp.endsWith(".*") && dataPoint.startsWith(dp.replace(".*", "")))
    )
  )
}

/**
 * Get priority 1 (primary) sources only
 */
export function getPrimarySources(): ValidationSource[] {
  return getAllSources().filter((source) => source.priority === 1)
}
