// src/lib/fiscal-data/validator/data-point-descriptions.ts

/**
 * Maps internal data point paths to Croatian fiscal terminology
 * with descriptions, expected values, and extraction hints.
 *
 * This helps the LLM understand what to look for on Croatian government pages.
 */

export interface DataPointDescription {
  /** Croatian name/term as it appears in official documents */
  croatianTerm: string
  /** What this value represents */
  description: string
  /** Expected format (percentage, currency, etc.) */
  format: "percentage" | "currency_eur" | "number" | "iban"
  /** Example of what the value might look like in text */
  examples: string[]
  /** Keywords to search for in the text */
  keywords: string[]
  /** Expected value range for validation */
  expectedRange?: { min: number; max: number }
}

export const DATA_POINT_DESCRIPTIONS: Record<string, DataPointDescription> = {
  // ===========================================================================
  // CONTRIBUTION RATES (Doprinosi)
  // ===========================================================================
  "CONTRIBUTIONS.rates.MIO_I.rate": {
    croatianTerm: "MIO I. stup - stopa doprinosa",
    description:
      "Stopa doprinosa za mirovinsko osiguranje na temelju generacijske solidarnosti (I. stup)",
    format: "percentage",
    examples: ["15%", "15 posto", "0,15"],
    keywords: ["MIO", "I. stup", "mirovinsko", "generacijska solidarnost", "15%"],
    expectedRange: { min: 0.1, max: 0.2 },
  },
  "CONTRIBUTIONS.rates.MIO_II.rate": {
    croatianTerm: "MIO II. stup - stopa doprinosa",
    description:
      "Stopa doprinosa za mirovinsko osiguranje na temelju individualne kapitalizirane štednje (II. stup)",
    format: "percentage",
    examples: ["5%", "5 posto", "0,05"],
    keywords: ["MIO", "II. stup", "kapitalizirana štednja", "5%"],
    expectedRange: { min: 0.03, max: 0.1 },
  },
  "CONTRIBUTIONS.rates.HZZO.rate": {
    croatianTerm: "Zdravstveno osiguranje - stopa doprinosa",
    description: "Stopa doprinosa za obvezno zdravstveno osiguranje (HZZO)",
    format: "percentage",
    examples: ["16,5%", "16.5%", "16,5 posto"],
    keywords: ["zdravstveno", "HZZO", "16,5%", "zdravstvo"],
    expectedRange: { min: 0.1, max: 0.2 },
  },
  "CONTRIBUTIONS.base.minimum": {
    croatianTerm: "Najniža mjesečna osnovica",
    description: "Najniža mjesečna osnovica za obračun doprinosa",
    format: "currency_eur",
    examples: ["719,20 EUR", "719.20 EUR", "719,20 €"],
    keywords: ["najniža", "minimalna", "osnovica", "EUR"],
    expectedRange: { min: 500, max: 1000 },
  },
  "CONTRIBUTIONS.base.maximum": {
    croatianTerm: "Najviša mjesečna osnovica",
    description: "Najviša mjesečna osnovica za obračun doprinosa",
    format: "currency_eur",
    examples: ["9.360 EUR", "9360 EUR", "9.360,00 €"],
    keywords: ["najviša", "maksimalna", "osnovica", "EUR"],
    expectedRange: { min: 8000, max: 12000 },
  },

  // ===========================================================================
  // INCOME TAX (Porez na dohodak)
  // ===========================================================================
  "TAX_RATES.income.brackets.0.rate": {
    croatianTerm: "Porez na dohodak - niža stopa",
    description: "Niža stopa poreza na dohodak (do 50.400 EUR godišnje)",
    format: "percentage",
    examples: ["20%", "20 posto"],
    keywords: ["porez na dohodak", "20%", "niža stopa", "porezna stopa"],
    expectedRange: { min: 0.15, max: 0.25 },
  },
  "TAX_RATES.income.brackets.1.rate": {
    croatianTerm: "Porez na dohodak - viša stopa",
    description: "Viša stopa poreza na dohodak (iznad 50.400 EUR godišnje)",
    format: "percentage",
    examples: ["30%", "30 posto"],
    keywords: ["porez na dohodak", "30%", "viša stopa"],
    expectedRange: { min: 0.25, max: 0.4 },
  },
  "TAX_RATES.income.personalAllowance": {
    croatianTerm: "Osnovni osobni odbitak",
    description: "Mjesečni osnovni osobni odbitak (neoporezivi dio dohotka)",
    format: "currency_eur",
    examples: ["560 EUR", "560,00 EUR", "560 €"],
    keywords: ["osobni odbitak", "neoporezivi", "560"],
    expectedRange: { min: 400, max: 700 },
  },

  // ===========================================================================
  // CORPORATE TAX (Porez na dobit)
  // ===========================================================================
  "TAX_RATES.corporate.small.rate": {
    croatianTerm: "Porez na dobit - mala poduzeća",
    description: "Stopa poreza na dobit za poduzetnike s prihodima do 1.000.000 EUR",
    format: "percentage",
    examples: ["10%", "10 posto"],
    keywords: ["porez na dobit", "10%", "mali poduzetnici"],
    expectedRange: { min: 0.08, max: 0.15 },
  },
  "TAX_RATES.corporate.large.rate": {
    croatianTerm: "Porez na dobit - standardna stopa",
    description: "Standardna stopa poreza na dobit (prihodi iznad 1.000.000 EUR)",
    format: "percentage",
    examples: ["18%", "18 posto"],
    keywords: ["porez na dobit", "18%", "standardna stopa"],
    expectedRange: { min: 0.15, max: 0.25 },
  },
  "TAX_RATES.corporate.small.maxRevenue": {
    croatianTerm: "Prag za malu stopu poreza na dobit",
    description: "Gornja granica prihoda za primjenu niže stope poreza na dobit",
    format: "currency_eur",
    examples: ["1.000.000 EUR", "1 milijun EUR"],
    keywords: ["1.000.000", "milijun", "prag", "granica"],
    expectedRange: { min: 500000, max: 2000000 },
  },

  // ===========================================================================
  // PAUŠALNI OBRT (Flat-rate taxation)
  // ===========================================================================
  "TAX_RATES.pausal.rate": {
    croatianTerm: "Paušalni porez - stopa",
    description: "Stopa poreza za paušalno oporezivanje obrta",
    format: "percentage",
    examples: ["12%", "12 posto"],
    keywords: ["paušal", "paušalno", "12%"],
    expectedRange: { min: 0.08, max: 0.15 },
  },
  "TAX_RATES.pausal.maxRevenue": {
    croatianTerm: "Limit za paušalno oporezivanje",
    description: "Maksimalni godišnji prihod za paušalno oporezivanje",
    format: "currency_eur",
    examples: ["60.000 EUR", "60000 EUR"],
    keywords: ["paušal", "limit", "60.000", "granica prihoda"],
    expectedRange: { min: 40000, max: 100000 },
  },
  "TAX_RATES.pausal.brackets": {
    croatianTerm: "Paušalni porez - razredi",
    description: "Razredi paušalnog oporezivanja prema visini prihoda",
    format: "number",
    examples: ["do 12.750 EUR", "12.750-25.500 EUR"],
    keywords: ["razred", "prihod", "porez", "paušal"],
  },

  // ===========================================================================
  // THRESHOLDS (Pragovi)
  // ===========================================================================
  "THRESHOLDS.pdv.value": {
    croatianTerm: "PDV prag",
    description: "Prag za ulazak u sustav PDV-a",
    format: "currency_eur",
    examples: ["60.000 EUR", "60000 EUR"],
    keywords: ["PDV", "prag", "60.000", "ulazak u sustav"],
    expectedRange: { min: 30000, max: 100000 },
  },
  "THRESHOLDS.pausalni.value": {
    croatianTerm: "Paušalni prag",
    description: "Maksimalni prihod za paušalno oporezivanje",
    format: "currency_eur",
    examples: ["60.000 EUR", "60000 EUR"],
    keywords: ["paušal", "limit", "60.000"],
    expectedRange: { min: 40000, max: 100000 },
  },

  // ===========================================================================
  // CHAMBER FEES (Članarine komora)
  // ===========================================================================
  "CHAMBER_FEES.hok.monthly": {
    croatianTerm: "HOK članarina - mjesečno",
    description: "Mjesečna članarina Hrvatskoj obrtničkoj komori",
    format: "currency_eur",
    examples: ["11,40 EUR", "11.40 EUR"],
    keywords: ["HOK", "članarina", "mjesečno", "obrtnička komora"],
    expectedRange: { min: 5, max: 20 },
  },
  "CHAMBER_FEES.hok.quarterly": {
    croatianTerm: "HOK članarina - kvartalno",
    description: "Kvartalna članarina Hrvatskoj obrtničkoj komori",
    format: "currency_eur",
    examples: ["34,20 EUR", "34.20 EUR"],
    keywords: ["HOK", "članarina", "kvartalno", "tromjesečno"],
    expectedRange: { min: 20, max: 60 },
  },
  "CHAMBER_FEES.hok.annual": {
    croatianTerm: "HOK članarina - godišnje",
    description: "Godišnja članarina Hrvatskoj obrtničkoj komori",
    format: "currency_eur",
    examples: ["136,80 EUR", "136.80 EUR"],
    keywords: ["HOK", "članarina", "godišnje"],
    expectedRange: { min: 80, max: 200 },
  },
}

/**
 * Get description for a data point
 */
export function getDataPointDescription(dataPoint: string): DataPointDescription | undefined {
  return DATA_POINT_DESCRIPTIONS[dataPoint]
}

/**
 * Format data points for prompt with explicit IDs
 */
export function formatDataPointsForPrompt(dataPoints: string[]): string {
  return dataPoints
    .map((dp, index) => {
      const desc = DATA_POINT_DESCRIPTIONS[dp]
      if (desc) {
        return `[${index + 1}] ID: "${dp}"
    Hrvatski naziv: ${desc.croatianTerm}
    Opis: ${desc.description}
    Format: ${desc.format === "percentage" ? "postotak → vrati decimalni broj (npr. 15% → 0.15)" : desc.format === "currency_eur" ? "EUR → vrati samo broj (npr. 60.000 EUR → 60000)" : "broj"}
    Traži u tekstu: ${desc.keywords.join(", ")}
    Primjeri: ${desc.examples.join(", ")}`
      }
      return `[${index + 1}] ID: "${dp}"`
    })
    .join("\n\n")
}

/**
 * Get list of data point IDs for validation
 */
export function getDataPointIds(dataPoints: string[]): string {
  return dataPoints.map((dp, i) => `${i + 1}. "${dp}"`).join("\n")
}
