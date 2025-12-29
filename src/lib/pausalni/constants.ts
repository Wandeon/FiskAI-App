import { CONTRIBUTIONS } from "@/lib/fiscal-data"

// 2025 Contribution amounts for paušalni obrt
// Imported from centralized fiscal-data to avoid duplication
export const DOPRINOSI_2025 = {
  MIO_I: {
    amount: CONTRIBUTIONS.monthly.mioI,
    amountCents: Math.round(CONTRIBUTIONS.monthly.mioI * 100),
    recipientName: "Državni proračun RH",
    iban: CONTRIBUTIONS.rates.MIO_I.iban,
    model: CONTRIBUTIONS.rates.MIO_I.model,
    referencePrefix: "8214",
    description: CONTRIBUTIONS.rates.MIO_I.name,
  },
  MIO_II: {
    amount: CONTRIBUTIONS.monthly.mioII,
    amountCents: Math.round(CONTRIBUTIONS.monthly.mioII * 100),
    recipientName: "Državni proračun RH",
    iban: CONTRIBUTIONS.rates.MIO_II.iban,
    model: CONTRIBUTIONS.rates.MIO_II.model,
    referencePrefix: "2046",
    description: CONTRIBUTIONS.rates.MIO_II.name,
  },
  ZDRAVSTVENO: {
    amount: CONTRIBUTIONS.monthly.hzzo,
    amountCents: Math.round(CONTRIBUTIONS.monthly.hzzo * 100),
    recipientName: "Državni proračun RH",
    iban: CONTRIBUTIONS.rates.HZZO.iban,
    model: CONTRIBUTIONS.rates.HZZO.model,
    referencePrefix: "8478",
    description: CONTRIBUTIONS.rates.HZZO.name,
  },
  TOTAL: CONTRIBUTIONS.monthly.total,
} as const

// PDV payment configuration
export const PDV_CONFIG = {
  recipientName: "Državni proračun RH",
  iban: "HR1210010051863000160",
  model: "HR68",
  referencePrefix: "1201",
  rate: 25, // 25% Croatian VAT
} as const

// HOK (Croatian Chamber of Trades) configuration
export const HOK_CONFIG = {
  quarterlyAmount: 34.2,
  recipientName: "Hrvatska obrtnička komora",
  iban: "HR4723400091510533498",
  model: "HR68",
  exemptYears: 2, // First 2 years exempt
} as const

// Deadlines configuration
export const DEADLINES = {
  DOPRINOSI: 15, // 15th of month for previous month
  PDV_FORMS: 20, // 20th of following month
  PDV_PAYMENT: -1, // Last day of following month (use -1 as marker)
  POREZ_Q1: { month: 3, day: 31 },
  POREZ_Q2: { month: 6, day: 30 },
  POREZ_Q3: { month: 9, day: 30 },
  POREZ_Q4: { month: 12, day: 31 },
  PO_SD: { month: 1, day: 15 }, // January 15 for previous year
  DOH: { month: 2, day: 28 }, // February 28 if exceeded threshold
} as const

// VAT threshold for paušalni obrt
export const VAT_THRESHOLD_2025 = 60000 // EUR

// EU country codes for IBAN detection
export const EU_COUNTRY_CODES = [
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
] as const

// EU country names in Croatian
export const EU_COUNTRY_NAMES: Record<string, string> = {
  AT: "Austrija",
  BE: "Belgija",
  BG: "Bugarska",
  HR: "Hrvatska",
  CY: "Cipar",
  CZ: "Češka",
  DK: "Danska",
  EE: "Estonija",
  FI: "Finska",
  FR: "Francuska",
  DE: "Njemačka",
  GR: "Grčka",
  HU: "Mađarska",
  IE: "Irska",
  IT: "Italija",
  LV: "Latvija",
  LT: "Litva",
  LU: "Luksemburg",
  MT: "Malta",
  NL: "Nizozemska",
  PL: "Poljska",
  PT: "Portugal",
  RO: "Rumunjska",
  SK: "Slovačka",
  SI: "Slovenija",
  ES: "Španjolska",
  SE: "Švedska",
}

// Obligation type labels in Croatian
export const OBLIGATION_LABELS: Record<string, string> = {
  DOPRINOSI_MIO_I: "Doprinosi MIO I. stup",
  DOPRINOSI_MIO_II: "Doprinosi MIO II. stup",
  DOPRINOSI_ZDRAVSTVENO: "Doprinosi zdravstveno",
  POREZ_DOHODAK: "Porez na dohodak",
  PDV: "PDV",
  HOK: "HOK članarina",
  PO_SD: "PO-SD obrazac",
}

// Month names in Croatian
export const CROATIAN_MONTHS = [
  "siječanj",
  "veljača",
  "ožujak",
  "travanj",
  "svibanj",
  "lipanj",
  "srpanj",
  "kolovoz",
  "rujan",
  "listopad",
  "studeni",
  "prosinac",
] as const

// Get month name in Croatian (genitive case for "za")
export const CROATIAN_MONTHS_GENITIVE = [
  "siječnja",
  "veljače",
  "ožujka",
  "travnja",
  "svibnja",
  "lipnja",
  "srpnja",
  "kolovoza",
  "rujna",
  "listopada",
  "studenog",
  "prosinca",
] as const
