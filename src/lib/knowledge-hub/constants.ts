// src/lib/knowledge-hub/constants.ts

// ============================================================================
// PAUŠALNI OBRT TAX BRACKETS 2025
// Source: https://fiskalopedija.hr/pausalni-obrt/
// ============================================================================

export interface TaxBracket {
  min: number
  max: number
  base: number
  annualTax: number
  quarterlyTax: number
}

export const PAUSAL_TAX_BRACKETS: TaxBracket[] = [
  { min: 0, max: 11300, base: 1695, annualTax: 203.4, quarterlyTax: 50.85 },
  { min: 11300.01, max: 15300, base: 2295, annualTax: 275.4, quarterlyTax: 68.85 },
  { min: 15300.01, max: 19900, base: 2985, annualTax: 358.2, quarterlyTax: 89.55 },
  { min: 19900.01, max: 30600, base: 4590, annualTax: 550.8, quarterlyTax: 137.7 },
  { min: 30600.01, max: 40000, base: 6000, annualTax: 720.0, quarterlyTax: 180.0 },
  { min: 40000.01, max: 50000, base: 7500, annualTax: 900.0, quarterlyTax: 225.0 },
  { min: 50000.01, max: 60000, base: 9000, annualTax: 1080.0, quarterlyTax: 270.0 },
]

export const PAUSAL_TAX_RATE = 0.12 // 12% without local surtax

export function getPausalTaxBracket(annualRevenue: number): TaxBracket {
  const bracket = PAUSAL_TAX_BRACKETS.find((b) => annualRevenue >= b.min && annualRevenue <= b.max)
  return bracket || PAUSAL_TAX_BRACKETS[PAUSAL_TAX_BRACKETS.length - 1]
}

// ============================================================================
// MONTHLY CONTRIBUTIONS 2025
// Source: https://www.hok.hr/
// ============================================================================

export const CONTRIBUTION_BASE_2025 = 719.2 // EUR - minimalna osnovica

export const MONTHLY_CONTRIBUTIONS = {
  MIO_I: { rate: 0.15, amount: 107.88, name: "MIO I. stup" },
  MIO_II: { rate: 0.05, amount: 35.96, name: "MIO II. stup" },
  HZZO: { rate: 0.165, amount: 118.67, name: "HZZO" },
  TOTAL: 262.51,
  BASE: CONTRIBUTION_BASE_2025,
} as const

// ============================================================================
// KEY THRESHOLDS 2025
// ============================================================================

export const THRESHOLDS = {
  VAT_REGISTRATION: 60000, // EUR - increased from 40000 in 2025
  PAUSAL_MAX: 60000, // EUR - same as VAT threshold
  CASH_B2B_LIMIT: 700, // EUR - per transaction
  ASSET_CAPITALIZATION: 464.53, // EUR - per item
  CORPORATE_TAX_SMALL: 1000000, // EUR - 10% rate threshold
} as const

// ============================================================================
// HOK (HRVATSKA OBRTNIČKA KOMORA) 2025
// Source: https://www.hok.hr/
// ============================================================================

export const HOK = {
  MONTHLY: 11.4,
  QUARTERLY: 34.2,
  ANNUAL: 136.8,
  DEADLINES: ["27.2.", "31.5.", "31.8.", "30.11."],
} as const

// ============================================================================
// TURISTIČKA ZAJEDNICA RATES 2025
// Rates are percentage of total annual revenue
// ============================================================================

export const TZ_RATES = {
  GROUP_1: { rate: 0.0014212, description: "Turizam, ugostiteljstvo" },
  GROUP_2: { rate: 0.0011367, description: "Trgovina, prijevoz" },
  GROUP_3: { rate: 0.0008527, description: "Usluge" },
  GROUP_4: { rate: 0.0002842, description: "Proizvodnja" },
  GROUP_5: { rate: 0.0001705, description: "Poljoprivreda, ribarstvo" },
} as const

// ============================================================================
// INCOME TAX RATES 2025 (for obrt na dohodak)
// Includes average local surtax (~10%)
// ============================================================================

export const INCOME_TAX_BRACKETS = [
  { min: 0, max: 50400, rate: 0.236 }, // 23.6%
  { min: 50400.01, max: Infinity, rate: 0.354 }, // 35.4%
] as const

// ============================================================================
// CORPORATE TAX 2025 (for d.o.o.)
// ============================================================================

export const CORPORATE_TAX = {
  SMALL: { maxRevenue: 1000000, rate: 0.1 }, // 10%
  LARGE: { minRevenue: 1000000, rate: 0.18 }, // 18%
} as const

// ============================================================================
// PAYMENT IBANs
// Model: HR68
// ============================================================================

export const PAYMENT_IBANS = {
  STATE_BUDGET: "HR1210010051863000160", // Državni proračun (porezi)
  MIO_II: "HR8724070001007120013", // II. mirovinski stup
  HZZO: "HR6510010051550100001", // Zdravstveno osiguranje
  HOK: "HR1223400091100106237", // Obrtnička komora
} as const

export const PAYMENT_MODEL = "HR68"

// ============================================================================
// CONTRIBUTION PAYMENT DEADLINES
// ============================================================================

export const CONTRIBUTION_DEADLINES = {
  MONTHLY: "Do 15. u mjesecu za prethodni mjesec",
  MIO_II_DEADLINE: "Do 15. u mjesecu",
  HOK_QUARTERLY: ["27.2.", "31.5.", "31.8.", "30.11."],
  PAUSAL_TAX_QUARTERLY: ["31.1.", "30.4.", "31.7.", "31.10."],
} as const
