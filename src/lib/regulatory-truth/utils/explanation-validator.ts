// src/lib/regulatory-truth/utils/explanation-validator.ts
// Validate explanations against source evidence to prevent hallucination

import { normalizeQuotes } from "./quote-normalizer"

export type EvidenceStrength = "SINGLE_SOURCE" | "MULTI_SOURCE"

export interface ValidationResult {
  valid: boolean
  warnings: string[]
  errors: string[]
  evidenceStrength: EvidenceStrength
  modalVerbViolations: string[]
  valueViolations: string[]
}

// Modal verbs that indicate obligation/requirement
// These MUST appear in source quote if used in explanation
const MODAL_VERBS_HR = [
  "mora",
  "moraju",
  "morati",
  "morate",
  "uvijek",
  "nikad",
  "nikada",
  "obavezno",
  "obvezan",
  "obvezna",
  "obvezni",
  "obvezatno",
  "zabranjeno",
  "nužno",
  "neophodno",
  "isključivo",
  "jedino",
] as const

const MODAL_VERBS_EN = [
  "must",
  "shall",
  "always",
  "never",
  "required",
  "mandatory",
  "prohibited",
  "forbidden",
  "only",
  "exclusively",
] as const

// Number patterns to extract values from text
// Note: Decimal patterns use (?:[\.,]\d+)? to require digits after separator
const NUMBER_PATTERNS = [
  /(\d+[\.,]\d+)/g, // Decimal numbers (requires digits on both sides)
  /(\d+)%/g, // Percentages
  /(\d{4}-\d{2}-\d{2})/g, // ISO dates
  /(\d{1,2}\.\d{1,2}\.\d{4})/g, // HR date format
  /€\s*(\d+(?:[\.,]\d+)?)/g, // Currency with € prefix
  /(\d+(?:[\.,]\d+)?)\s*€/g, // Currency with € suffix
  /HRK\s*(\d+(?:[\.,]\d+)?)/g, // HRK currency
]

/**
 * Extract all modal verbs from text
 */
export function extractModalVerbs(text: string, language: "hr" | "en" = "hr"): string[] {
  const verbs = language === "hr" ? MODAL_VERBS_HR : MODAL_VERBS_EN
  const textLower = text.toLowerCase()
  return verbs.filter((verb) => textLower.includes(verb.toLowerCase()))
}

/**
 * Extract numeric values from text
 */
export function extractNumericValues(text: string): string[] {
  const values = new Set<string>()

  for (const pattern of NUMBER_PATTERNS) {
    const matches = text.matchAll(pattern)
    for (const match of matches) {
      if (match[1]) {
        values.add(match[1])
      }
    }
  }

  return Array.from(values)
}

/**
 * Check if a value appears in source quotes.
 * Normalizes both value and quotes to handle smart quote variants.
 */
function valueInSources(value: string, sourceQuotes: string[]): boolean {
  const normalizedValue = value.replace(",", ".").replace(/\s/g, "")

  for (const quote of sourceQuotes) {
    // Normalize quote to handle smart quotes that may have been auto-corrected
    const normalizedQuote = normalizeQuotes(quote)

    // Check exact match
    if (normalizedQuote.includes(value)) return true

    // Check normalized match (comma vs period for decimals)
    if (normalizedQuote.replace(",", ".").replace(/\s/g, "").includes(normalizedValue)) {
      return true
    }
  }

  return false
}

/**
 * Check if modal verb appears in source quotes.
 * Normalizes quotes to handle smart quote variants.
 */
function modalVerbInSources(verb: string, sourceQuotes: string[]): boolean {
  const verbLower = verb.toLowerCase()

  for (const quote of sourceQuotes) {
    // Normalize quote to handle smart quotes that may have been auto-corrected
    const normalizedQuote = normalizeQuotes(quote)
    if (normalizedQuote.toLowerCase().includes(verbLower)) {
      return true
    }
  }

  return false
}

/**
 * Validate an explanation against its source evidence.
 *
 * INVARIANTS:
 * 1. Modal verbs (must, always, never) must appear in source quotes
 * 2. Numeric values must match values in source quotes
 * 3. Dates must match dates in source quotes
 */
export function validateExplanation(
  explanationHr: string,
  explanationEn: string | null,
  sourceQuotes: string[],
  extractedValue?: string | null
): ValidationResult {
  const warnings: string[] = []
  const errors: string[] = []
  const modalVerbViolations: string[] = []
  const valueViolations: string[] = []

  // Determine evidence strength
  const evidenceStrength: EvidenceStrength =
    sourceQuotes.length >= 2 ? "MULTI_SOURCE" : "SINGLE_SOURCE"

  // Check 1: Modal verbs in Croatian explanation
  const hrModalVerbs = extractModalVerbs(explanationHr, "hr")
  for (const verb of hrModalVerbs) {
    if (!modalVerbInSources(verb, sourceQuotes)) {
      modalVerbViolations.push(verb)
      errors.push(
        `Modal verb "${verb}" in explanation but not found in source quotes. ` +
          "Remove or cite the specific source."
      )
    }
  }

  // Check 2: Modal verbs in English explanation (if present)
  if (explanationEn) {
    const enModalVerbs = extractModalVerbs(explanationEn, "en")
    for (const verb of enModalVerbs) {
      if (!modalVerbInSources(verb, sourceQuotes)) {
        modalVerbViolations.push(verb)
        warnings.push(`Modal verb "${verb}" in English explanation but not found in sources.`)
      }
    }
  }

  // Check 3: Numeric values in explanation
  const explanationValues = extractNumericValues(explanationHr)
  for (const value of explanationValues) {
    // Skip if it matches the extracted value
    if (extractedValue && value === extractedValue.replace(",", ".")) {
      continue
    }

    if (!valueInSources(value, sourceQuotes)) {
      valueViolations.push(value)
      warnings.push(
        `Numeric value "${value}" in explanation not found in source quotes. Verify accuracy.`
      )
    }
  }

  // Check 4: If extracted value exists, verify it appears in explanation
  if (extractedValue) {
    const normalizedExtracted = extractedValue.replace(",", ".")
    const normalizedExplanation = explanationHr.replace(",", ".")

    if (!normalizedExplanation.includes(normalizedExtracted)) {
      warnings.push(
        `Extracted value "${extractedValue}" not mentioned in explanation. ` +
          "Consider including the exact value."
      )
    }
  }

  // Validation passes if no errors (warnings are acceptable)
  const valid = errors.length === 0

  return {
    valid,
    warnings,
    errors,
    evidenceStrength,
    modalVerbViolations,
    valueViolations,
  }
}

/**
 * Create a quote-only fallback explanation when validation fails.
 * This is the fail-closed behavior.
 */
export function createQuoteOnlyExplanation(
  sourceQuotes: string[],
  extractedValue?: string | null
): string {
  if (sourceQuotes.length === 0) {
    return extractedValue
      ? `Vrijednost: ${extractedValue}`
      : "Nema dostupnog objašnjenja iz izvora."
  }

  // Use the first source quote as the explanation
  const primaryQuote = sourceQuotes[0].slice(0, 300)

  if (extractedValue) {
    return `Vrijednost: ${extractedValue}. Iz izvora: "${primaryQuote}..."`
  }

  return `Iz izvora: "${primaryQuote}..."`
}

/**
 * Get evidence strength badge text for UI
 */
export function getEvidenceStrengthBadge(
  strength: EvidenceStrength,
  language: "hr" | "en" = "hr"
): { text: string; level: "high" | "medium" } {
  if (language === "hr") {
    return strength === "MULTI_SOURCE"
      ? { text: "Višestruki izvori", level: "high" }
      : { text: "Jedan izvor", level: "medium" }
  }

  return strength === "MULTI_SOURCE"
    ? { text: "Multiple sources", level: "high" }
    : { text: "Single source", level: "medium" }
}
