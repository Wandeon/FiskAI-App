// src/lib/regulatory-truth/utils/deterministic-validators.ts

import {
  normalizeForComparison,
  normalizeCroatianDiacritics,
  fuzzyContainsCroatian,
  dateAppearsInText,
  calculateNormalizedSimilarity,
} from "./croatian-text"

export interface ValidationResult {
  valid: boolean
  error?: string
}

export interface ExtractionValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

// Percentage must be 0-100 by default, or 0-max if specified
export function validatePercentage(value: number, max: number = 100): ValidationResult {
  if (typeof value !== "number" || isNaN(value)) {
    return { valid: false, error: "Percentage must be a number" }
  }
  if (value < 0) {
    return { valid: false, error: "Percentage cannot be negative" }
  }
  if (value > max) {
    return { valid: false, error: `Percentage cannot exceed ${max}` }
  }
  return { valid: true }
}

// Currency must be positive and reasonable
export function validateCurrency(
  value: number,
  currency: "eur" | "hrk",
  maxAmount?: number
): ValidationResult {
  if (typeof value !== "number" || isNaN(value)) {
    return { valid: false, error: "Currency amount must be a number" }
  }
  if (value < 0) {
    return { valid: false, error: "Currency amount cannot be negative" }
  }
  // Max reasonable regulatory amount: 100 billion EUR (or domain-specific max)
  const defaultMax = currency === "eur" ? 100_000_000_000 : 750_000_000_000
  const max = maxAmount !== undefined ? maxAmount : defaultMax
  if (value > max) {
    return { valid: false, error: `Currency amount ${value} is unrealistic` }
  }
  return { valid: true }
}

// Date must be valid ISO format and within reasonable range
export function validateDate(value: string): ValidationResult {
  // Must match YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { valid: false, error: "Date must be ISO format YYYY-MM-DD" }
  }

  const date = new Date(value)
  if (isNaN(date.getTime())) {
    return { valid: false, error: "Invalid date" }
  }

  // Check month/day validity (JS Date accepts 2025-13-01 as 2026-01-01)
  const [year, month, day] = value.split("-").map(Number)
  if (month < 1 || month > 12) {
    return { valid: false, error: "Invalid month" }
  }
  const daysInMonth = new Date(year, month, 0).getDate()
  if (day < 1 || day > daysInMonth) {
    return { valid: false, error: "Invalid day for month" }
  }

  // Reasonable range: 1990 to 2050
  if (year < 1990) {
    return { valid: false, error: "Date too far in the past (before 1990)" }
  }
  if (year > 2050) {
    return { valid: false, error: "Date too far in the future (after 2050)" }
  }

  return { valid: true }
}

// Validate numeric is within expected range for type
export function validateNumericRange(value: number, min: number, max: number): ValidationResult {
  if (typeof value !== "number" || isNaN(value)) {
    return { valid: false, error: "Value must be a number" }
  }
  if (value < min) {
    return { valid: false, error: `Value ${value} below minimum ${min}` }
  }
  if (value > max) {
    return { valid: false, error: `Value ${value} above maximum ${max}` }
  }
  return { valid: true }
}

// Validate interest rate (percentage with domain-specific max)
export function validateInterestRate(value: number, max: number = 20): ValidationResult {
  if (typeof value !== "number" || isNaN(value)) {
    return { valid: false, error: "Interest rate must be a number" }
  }
  if (value < 0) {
    return { valid: false, error: "Interest rate cannot be negative" }
  }
  if (value > max) {
    return { valid: false, error: `Interest rate cannot exceed ${max}%` }
  }
  return { valid: true }
}

// Validate exchange rate (reasonable currency pair range)
export function validateExchangeRate(
  value: number,
  min: number = 0.0001,
  max: number = 10000
): ValidationResult {
  if (typeof value !== "number" || isNaN(value)) {
    return { valid: false, error: "Exchange rate must be a number" }
  }
  if (value <= 0) {
    return { valid: false, error: "Exchange rate must be positive" }
  }
  if (value < min) {
    return { valid: false, error: `Exchange rate ${value} is unrealistically low (min: ${min})` }
  }
  if (value > max) {
    return { valid: false, error: `Exchange rate ${value} is unrealistically high (max: ${max})` }
  }
  return { valid: true }
}

/**
 * Domain-aware validator that applies appropriate validation based on domain and value type.
 * This is a convenience function that wraps the type-specific validators with domain configuration.
 */
export function validateByDomain(
  domain: string,
  valueType: string,
  value: number | string
): ValidationResult {
  const domainConfig = DOMAIN_RANGES[domain] || {}
  const numValue = typeof value === "number" ? value : parseFloat(String(value))

  switch (valueType) {
    case "percentage": {
      const maxPct = domainConfig.percentageMax || 100
      return validatePercentage(numValue, maxPct)
    }
    case "currency_eur":
    case "currency": {
      const maxCurrency = domainConfig.currencyMax
      return validateCurrency(numValue, "eur", maxCurrency)
    }
    case "currency_hrk": {
      const maxCurrency = domainConfig.currencyMax
      return validateCurrency(numValue, "hrk", maxCurrency)
    }
    case "date": {
      return validateDate(String(value))
    }
    case "count": {
      return validateNumericRange(numValue, 0, 1_000_000_000)
    }
    case "interest_rate": {
      const maxRate = domainConfig.interestRateMax || 20
      return validateInterestRate(numValue, maxRate)
    }
    case "exchange_rate": {
      const minRate = domainConfig.exchangeRateMin || 0.0001
      const maxRate = domainConfig.exchangeRateMax || 10000
      return validateExchangeRate(numValue, minRate, maxRate)
    }
    default:
      return { valid: false, error: `Unknown value type: ${valueType}` }
  }
}

// Known domains for validation
const VALID_DOMAINS = [
  "pausalni",
  "pdv",
  "porez_dohodak",
  "doprinosi",
  "fiskalizacija",
  "rokovi",
  "obrasci",
  "interest_rates",
  "exchange_rates",
]

// Domain-specific validation ranges
interface DomainRanges {
  percentageMax?: number
  currencyMax?: number
  interestRateMax?: number
  exchangeRateMin?: number
  exchangeRateMax?: number
}

const DOMAIN_RANGES: Record<string, DomainRanges> = {
  pdv: { percentageMax: 30 }, // VAT max 30% (Croatia's highest is 25%, allow margin)
  doprinosi: { percentageMax: 50 }, // Health insurance, pension contributions max 50%
  porez_dohodak: { percentageMax: 60 }, // Income tax max 60% (including surtax)
  pausalni: { currencyMax: 1_000_000 }, // Pausalni threshold max 1M EUR
  interest_rates: { percentageMax: 20 }, // Interest rates max 20%
  exchange_rates: { exchangeRateMin: 0.0001, exchangeRateMax: 10000 }, // Currency pair range
}

// Known value types
const VALID_VALUE_TYPES = [
  "currency",
  "percentage",
  "date",
  "threshold",
  "text",
  "currency_hrk",
  "currency_eur",
  "count",
  "interest_rate",
  "exchange_rate",
]

/**
 * Normalize a number for matching: remove formatting like "40.000" → "40000"
 */
function normalizeNumber(value: string): string[] {
  // Check if it's a decimal number (has exactly one separator followed by digits)
  const hasDecimal = /^\d+[.,]\d+$/.test(value)

  if (hasDecimal) {
    // For decimals, provide both comma and period variants
    const withComma = value.replace(".", ",")
    const withPeriod = value.replace(",", ".")
    return [value, withComma, withPeriod]
  } else {
    // For integers, remove thousand separators
    const cleaned = value.replace(/[.,\s]/g, "")
    return [value, cleaned]
  }
}

/**
 * Convert ISO date to Croatian format patterns for matching.
 * Includes both proper diacritic versions and normalized ASCII versions
 * to handle OCR errors.
 */
function dateToPatterns(isoDate: string): string[] {
  // Month names with proper Croatian diacritics
  const months = [
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
    "studenoga",
    "prosinca",
  ]

  // Month names normalized (without diacritics) for OCR tolerance
  const monthsNormalized = [
    "sijecnja",
    "veljace",
    "ozujka",
    "travnja",
    "svibnja",
    "lipnja",
    "srpnja",
    "kolovoza",
    "rujna",
    "listopada",
    "studenoga",
    "prosinca",
  ]

  const [year, month, day] = isoDate.split("-")
  const monthNum = parseInt(month)
  const dayNum = parseInt(day)

  return [
    isoDate,
    // With proper diacritics
    `${dayNum}. ${months[monthNum - 1]} ${year}`,
    // With normalized (ASCII) month names for OCR tolerance
    `${dayNum}. ${monthsNormalized[monthNum - 1]} ${year}`,
    // Numeric formats
    `${dayNum}.${month}.${year}`,
    `${dayNum}.${monthNum}.${year}`,
    `${day}.${month}.${year}`,
    `${dayNum}/${month}/${year}`,
  ]
}

/**
 * Check if the quote is a JSON fragment (key-value pair)
 */
function isJsonQuote(quote: string): boolean {
  const trimmed = quote.trim()
  // Match patterns like: "key": "value" or "key": 123
  return /^"[^"]+"\s*:\s*.+$/.test(trimmed)
}

/**
 * Validate that the extracted value actually appears in the exact quote.
 * This prevents AI "inference" where values are derived but not explicitly stated.
 *
 * Supports Croatian OCR tolerance:
 * - Diacritic normalization (c, s, z, d)
 * - Fuzzy matching for OCR errors
 * - Croatian date format matching with month names
 */
export function validateValueInQuote(
  extractedValue: string | number,
  exactQuote: string,
  options: { fuzzyThreshold?: number } = {}
): ValidationResult {
  const value = String(extractedValue)
  const quote = exactQuote.toLowerCase()
  const { fuzzyThreshold = 0.85 } = options

  // Special handling for JSON quotes (e.g., from HNB API)
  if (isJsonQuote(exactQuote)) {
    try {
      // Extract the value part after the colon
      const match = exactQuote.match(/:\s*(.+)$/)
      if (match) {
        const jsonValue = match[1].trim()
        // Try to parse as JSON to get the actual value
        let parsedValue: any
        try {
          parsedValue = JSON.parse(jsonValue)
        } catch {
          // If it's not valid JSON, use as-is (might be unquoted)
          parsedValue = jsonValue
        }

        const parsedStr = String(parsedValue)
        const normalizedValue = value.replace(/[.,\s]/g, "")
        const normalizedParsed = parsedStr.replace(/[.,\s]/g, "")

        if (normalizedValue === normalizedParsed || value === parsedStr) {
          return { valid: true }
        }
      }
    } catch (error) {
      // Fall through to standard validation
    }
  }

  // Special handling for dates with Croatian month names
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    // First try exact pattern matching
    const patterns = dateToPatterns(value)
    const quoteLower = quote.toLowerCase()
    const quoteNormalized = normalizeForComparison(quote)

    for (const pattern of patterns) {
      const patternLower = pattern.toLowerCase()
      const patternNormalized = normalizeForComparison(pattern)

      // Check exact match (with or without diacritics)
      if (quoteLower.includes(patternLower) || quoteNormalized.includes(patternNormalized)) {
        return { valid: true }
      }
    }

    // Try fuzzy matching for OCR errors in date text
    const dateResult = dateAppearsInText(value, exactQuote, fuzzyThreshold)
    if (dateResult.found) {
      return { valid: true }
    }

    return {
      valid: false,
      error: `Date "${value}" not found in quote. Possible inference detected.`,
    }
  }

  // For numeric values
  if (/^[\d.,]+$/.test(value)) {
    const patterns = normalizeNumber(value)
    const found = patterns.some((pattern) => {
      const patternLower = pattern.toLowerCase()
      if (/^\d+$/.test(patternLower)) {
        // For numbers with 4+ digits, allow optional thousand separators
        // For shorter numbers, match exactly without separators
        let regexPattern: string
        if (patternLower.length >= 4) {
          // Add optional separators between digits for formatted numbers like 40000 -> 40.000
          regexPattern = patternLower.split("").join("[.,\\s]?")
        } else {
          // Short numbers must match exactly (no separators between digits)
          regexPattern = patternLower
        }
        // Require non-digit before and after to prevent substring matches
        // Also prevent matching if followed by separator + digits (e.g., "40" should not match "40.000")
        const numRegex = new RegExp(`(?:^|[^\\d])${regexPattern}(?![.,\\s]?\\d)`, "i")
        return numRegex.test(quote)
      }
      return quote.includes(patternLower)
    })

    if (found) {
      return { valid: true }
    }

    return {
      valid: false,
      error: `Value "${value}" not found in quote. Possible inference detected.`,
    }
  }

  // For text values, use Croatian-aware fuzzy matching
  const quoteLower = quote.toLowerCase()
  const valueLower = value.toLowerCase()

  // Try exact match first
  if (quoteLower.includes(valueLower)) {
    return { valid: true }
  }

  // Try normalized match (handles diacritics)
  const quoteNormalized = normalizeForComparison(quote)
  const valueNormalized = normalizeForComparison(value)
  if (quoteNormalized.includes(valueNormalized)) {
    return { valid: true }
  }

  // Try fuzzy match for OCR errors
  const fuzzyResult = fuzzyContainsCroatian(exactQuote, value, fuzzyThreshold)
  if (fuzzyResult.found) {
    return { valid: true }
  }

  return {
    valid: false,
    error: `Value "${value}" not found in quote (similarity: ${(fuzzyResult.similarity * 100).toFixed(0)}%). Possible inference detected.`,
  }
}

/**
 * Extended validation result with similarity score for OCR verification
 */
export interface QuoteVerificationResult extends ValidationResult {
  similarity?: number
  matchType?: "exact" | "normalized" | "fuzzy"
}

/**
 * Verify a quote with detailed similarity information.
 * Useful for debugging OCR issues and understanding match quality.
 */
export function verifyQuoteWithDetails(
  extractedValue: string | number,
  exactQuote: string,
  options: { fuzzyThreshold?: number } = {}
): QuoteVerificationResult {
  const value = String(extractedValue)
  const { fuzzyThreshold = 0.85 } = options

  // Check for exact match
  if (exactQuote.toLowerCase().includes(value.toLowerCase())) {
    return { valid: true, similarity: 1, matchType: "exact" }
  }

  // Check for normalized match
  const quoteNormalized = normalizeForComparison(exactQuote)
  const valueNormalized = normalizeForComparison(value)
  if (quoteNormalized.includes(valueNormalized)) {
    return { valid: true, similarity: 1, matchType: "normalized" }
  }

  // Check for fuzzy match
  const fuzzyResult = fuzzyContainsCroatian(exactQuote, value, fuzzyThreshold)
  if (fuzzyResult.found) {
    return {
      valid: true,
      similarity: fuzzyResult.similarity,
      matchType: "fuzzy",
    }
  }

  // Calculate overall similarity for diagnostics
  const similarity = calculateNormalizedSimilarity(value, exactQuote)

  return {
    valid: false,
    similarity: fuzzyResult.similarity,
    error: `Value "${value}" not found in quote (similarity: ${(fuzzyResult.similarity * 100).toFixed(0)}%).`,
  }
}

// Validate a complete extraction before it goes to AI review
export function validateExtraction(
  extraction: {
    domain: string
    value_type: string
    extracted_value: string | number
    exact_quote: string
    confidence: number
  },
  options?: {
    originalContent?: string
    cleanedContent?: string
    requireBothMatch?: boolean
  }
): ExtractionValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Domain validation
  if (!VALID_DOMAINS.includes(extraction.domain)) {
    errors.push(`Unknown domain: ${extraction.domain}`)
  }

  // Value type validation
  if (!VALID_VALUE_TYPES.includes(extraction.value_type)) {
    errors.push(`Unknown value_type: ${extraction.value_type}`)
  }

  // Get domain-specific configuration
  const domainConfig = DOMAIN_RANGES[extraction.domain] || {}

  // Type-specific validation with domain awareness
  const value = extraction.extracted_value
  const numValue = typeof value === "number" ? value : parseFloat(String(value))

  switch (extraction.value_type) {
    case "percentage": {
      const maxPct = domainConfig.percentageMax || 100
      const result = validatePercentage(numValue, maxPct)
      if (!result.valid) errors.push(result.error!)
      break
    }
    case "currency_eur":
    case "currency": {
      const maxCurrency = domainConfig.currencyMax
      const result = validateCurrency(numValue, "eur", maxCurrency)
      if (!result.valid) errors.push(result.error!)
      break
    }
    case "currency_hrk": {
      const maxCurrency = domainConfig.currencyMax
      const result = validateCurrency(numValue, "hrk", maxCurrency)
      if (!result.valid) errors.push(result.error!)
      break
    }
    case "date": {
      const result = validateDate(String(value))
      if (!result.valid) errors.push(result.error!)
      break
    }
    case "count": {
      const result = validateNumericRange(numValue, 0, 1_000_000_000)
      if (!result.valid) errors.push(result.error!)
      break
    }
    case "interest_rate": {
      const maxRate = domainConfig.interestRateMax || 20
      const result = validateInterestRate(numValue, maxRate)
      if (!result.valid) errors.push(result.error!)
      break
    }
    case "exchange_rate": {
      const minRate = domainConfig.exchangeRateMin || 0.0001
      const maxRate = domainConfig.exchangeRateMax || 10000
      const result = validateExchangeRate(numValue, minRate, maxRate)
      if (!result.valid) errors.push(result.error!)
      break
    }
  }

  // NO-INFERENCE CHECK: Value must appear in quote
  if (extraction.value_type !== "text") {
    const quoteCheck = validateValueInQuote(extraction.extracted_value, extraction.exact_quote)
    if (!quoteCheck.valid) {
      errors.push(quoteCheck.error!)
    }
  }

  // QUOTE VERIFICATION: Ensure quote exists in the content that was sent to LLM
  // This addresses issue #750: validate against cleaned content (what LLM sees)
  if (options?.cleanedContent) {
    const cleanedQuoteCheck = validateQuoteInEvidence(
      extraction.exact_quote,
      options.cleanedContent
    )
    if (!cleanedQuoteCheck.valid) {
      errors.push(
        `Quote not found in cleaned content (sent to LLM): ${cleanedQuoteCheck.error}`
      )
    }

    // If requireBothMatch is true, also verify against original content
    if (options.requireBothMatch && options.originalContent) {
      const originalQuoteCheck = validateQuoteInEvidence(
        extraction.exact_quote,
        options.originalContent
      )
      if (!originalQuoteCheck.valid) {
        warnings.push(
          `Quote found in cleaned content but not in original content. This may indicate content transformation issues.`
        )
      }
    }
  } else if (options?.originalContent) {
    // Fallback: if only original content provided, validate against it
    const originalQuoteCheck = validateQuoteInEvidence(
      extraction.exact_quote,
      options.originalContent
    )
    if (!originalQuoteCheck.valid) {
      errors.push(`Quote not found in original content: ${originalQuoteCheck.error}`)
    }
  }

  // Confidence validation
  if (extraction.confidence < 0 || extraction.confidence > 1) {
    errors.push(`Confidence ${extraction.confidence} must be between 0 and 1`)
  }

  // Exact quote validation
  if (!extraction.exact_quote || extraction.exact_quote.trim().length < 5) {
    errors.push("Exact quote is required and must be at least 5 characters")
  }

  // Warning for low confidence
  if (extraction.confidence < 0.7) {
    warnings.push(`Low confidence extraction: ${extraction.confidence}`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

// =============================================================================
// ATOMIC CLAIM VALIDATION
// =============================================================================

// Known subject types (from schema)
const VALID_SUBJECT_TYPES = ["TAXPAYER", "EMPLOYER", "COMPANY", "INDIVIDUAL", "ALL"]

// Known assertion types (from schema)
const VALID_ASSERTION_TYPES = ["OBLIGATION", "PROHIBITION", "PERMISSION", "DEFINITION"]

// Known claim value types
const VALID_CLAIM_VALUE_TYPES = [
  "percentage",
  "currency",
  "currency_eur",
  "currency_hrk",
  "date",
  "count",
  "threshold",
  "text",
  "boolean",
  "rate",
  "duration",
  "formula",
]

// Known jurisdictions
const VALID_JURISDICTIONS = ["HR", "EU", "GLOBAL"]

export interface ClaimValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  rejectionType?: string // For dead-letter classification
}

export interface AtomicClaimInput {
  subjectType: string
  subjectQualifiers?: string[]
  triggerExpr?: string | null
  temporalExpr?: string | null
  jurisdiction?: string
  assertionType: string
  logicExpr: string
  value?: string | null
  valueType?: string | null
  parameters?: Record<string, unknown> | null
  exactQuote: string
  articleNumber?: string | null
  lawReference?: string | null
  confidence: number
  exceptions?: Array<{
    condition: string
    overridesTo: string
    sourceArticle: string
  }>
}

/**
 * Validate an atomic claim before database insertion.
 * Implements fail-closed behavior - rejects any claim that fails validation.
 */
export function validateAtomicClaim(
  claim: AtomicClaimInput,
  evidenceContent?: string
): ClaimValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // =============================================================================
  // REQUIRED FIELD VALIDATION
  // =============================================================================

  // subjectType is required and must be a known type
  if (!claim.subjectType) {
    errors.push("Missing required field: subjectType")
  } else if (!VALID_SUBJECT_TYPES.includes(claim.subjectType)) {
    errors.push(
      `Invalid subjectType: "${claim.subjectType}". Must be one of: ${VALID_SUBJECT_TYPES.join(", ")}`
    )
  }

  // assertionType is required and must be a known type
  if (!claim.assertionType) {
    errors.push("Missing required field: assertionType")
  } else if (!VALID_ASSERTION_TYPES.includes(claim.assertionType)) {
    errors.push(
      `Invalid assertionType: "${claim.assertionType}". Must be one of: ${VALID_ASSERTION_TYPES.join(", ")}`
    )
  }

  // logicExpr is required and must be meaningful
  if (!claim.logicExpr) {
    errors.push("Missing required field: logicExpr")
  } else if (claim.logicExpr.trim().length < 3) {
    errors.push("logicExpr must be at least 3 characters")
  }

  // exactQuote is required for provenance
  if (!claim.exactQuote) {
    errors.push("Missing required field: exactQuote")
  } else if (claim.exactQuote.trim().length < 10) {
    errors.push("exactQuote must be at least 10 characters for proper attribution")
  }

  // =============================================================================
  // VALUE TYPE VALIDATION
  // =============================================================================

  // If value is provided, valueType should also be provided
  if (claim.value && !claim.valueType) {
    warnings.push(
      "value provided without valueType - consider adding valueType for proper validation"
    )
  }

  // If valueType is provided, validate it
  if (claim.valueType && !VALID_CLAIM_VALUE_TYPES.includes(claim.valueType)) {
    errors.push(
      `Invalid valueType: "${claim.valueType}". Must be one of: ${VALID_CLAIM_VALUE_TYPES.join(", ")}`
    )
  }

  // Type-specific value validation
  if (claim.value && claim.valueType) {
    const valueValidation = validateClaimValue(claim.value, claim.valueType)
    if (!valueValidation.valid) {
      errors.push(valueValidation.error!)
    }
  }

  // =============================================================================
  // JURISDICTION VALIDATION
  // =============================================================================

  if (claim.jurisdiction && !VALID_JURISDICTIONS.includes(claim.jurisdiction)) {
    warnings.push(
      `Unknown jurisdiction: "${claim.jurisdiction}". Expected: ${VALID_JURISDICTIONS.join(", ")}`
    )
  }

  // =============================================================================
  // CONFIDENCE VALIDATION
  // =============================================================================

  if (typeof claim.confidence !== "number" || isNaN(claim.confidence)) {
    errors.push("confidence must be a number")
  } else if (claim.confidence < 0 || claim.confidence > 1) {
    errors.push(`confidence ${claim.confidence} must be between 0 and 1`)
  } else if (claim.confidence < 0.5) {
    warnings.push(`Very low confidence: ${claim.confidence}. Consider rejecting claims below 0.5`)
  }

  // =============================================================================
  // EVIDENCE ANCHORING VALIDATION
  // =============================================================================

  // If evidence content is provided, verify the quote exists in it
  if (evidenceContent && claim.exactQuote) {
    const quoteValidation = validateQuoteInEvidence(claim.exactQuote, evidenceContent)
    if (!quoteValidation.valid) {
      errors.push(quoteValidation.error!)
    }
  }

  // =============================================================================
  // EXCEPTION VALIDATION
  // =============================================================================

  if (claim.exceptions && claim.exceptions.length > 0) {
    for (let i = 0; i < claim.exceptions.length; i++) {
      const exception = claim.exceptions[i]
      if (!exception.condition || exception.condition.trim().length < 3) {
        errors.push(`Exception ${i + 1}: condition is required and must be at least 3 characters`)
      }
      if (!exception.overridesTo || exception.overridesTo.trim().length < 1) {
        errors.push(`Exception ${i + 1}: overridesTo is required`)
      }
      if (!exception.sourceArticle || exception.sourceArticle.trim().length < 1) {
        errors.push(`Exception ${i + 1}: sourceArticle is required`)
      }
    }
  }

  // =============================================================================
  // DETERMINE REJECTION TYPE
  // =============================================================================

  let rejectionType: string | undefined
  if (errors.length > 0) {
    // Classify the primary rejection reason
    // Order matters: check "Missing required" first since those errors also contain field names
    const firstError = errors[0]
    if (firstError.includes("Missing required")) {
      rejectionType = "MISSING_REQUIRED_FIELD"
    } else if (firstError.includes("Invalid subjectType")) {
      rejectionType = "INVALID_SUBJECT_TYPE"
    } else if (firstError.includes("Invalid assertionType")) {
      rejectionType = "INVALID_ASSERTION_TYPE"
    } else if (firstError.includes("Invalid valueType")) {
      rejectionType = "INVALID_VALUE_TYPE"
    } else if (firstError.includes("exactQuote") || firstError.includes("not found in evidence")) {
      rejectionType = "INVALID_QUOTE"
    } else if (firstError.includes("confidence")) {
      rejectionType = "INVALID_CONFIDENCE"
    } else {
      rejectionType = "VALIDATION_FAILED"
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    rejectionType,
  }
}

/**
 * Validate claim value based on its type
 */
function validateClaimValue(value: string, valueType: string): ValidationResult {
  const numValue = parseFloat(value)

  switch (valueType) {
    case "percentage":
    case "rate":
      if (isNaN(numValue)) {
        return { valid: false, error: `${valueType} value must be numeric: "${value}"` }
      }
      return validatePercentage(numValue)

    case "currency":
    case "currency_eur":
      if (isNaN(numValue)) {
        return { valid: false, error: `currency value must be numeric: "${value}"` }
      }
      return validateCurrency(numValue, "eur")

    case "currency_hrk":
      if (isNaN(numValue)) {
        return { valid: false, error: `currency value must be numeric: "${value}"` }
      }
      return validateCurrency(numValue, "hrk")

    case "date":
      return validateDate(value)

    case "count":
    case "threshold":
      if (isNaN(numValue)) {
        return { valid: false, error: `${valueType} value must be numeric: "${value}"` }
      }
      if (numValue < 0) {
        return { valid: false, error: `${valueType} cannot be negative` }
      }
      return { valid: true }

    case "boolean":
      if (!["true", "false", "1", "0", "yes", "no", "da", "ne"].includes(value.toLowerCase())) {
        return { valid: false, error: `boolean value must be true/false: "${value}"` }
      }
      return { valid: true }

    case "text":
    case "formula":
    case "duration":
      // Text-based values just need to be non-empty
      if (!value || value.trim().length === 0) {
        return { valid: false, error: `${valueType} cannot be empty` }
      }
      return { valid: true }

    default:
      return { valid: true } // Unknown types pass through
  }
}

/**
 * Validate that the exact quote appears in the evidence content.
 * Uses fuzzy matching to handle minor OCR/formatting differences.
 */
function validateQuoteInEvidence(quote: string, evidenceContent: string): ValidationResult {
  // Normalize both for comparison
  const normalizedQuote = normalizeForComparison(quote)
  const normalizedContent = normalizeForComparison(evidenceContent)

  // Exact match
  if (normalizedContent.includes(normalizedQuote)) {
    return { valid: true }
  }

  // Try a more lenient match (first 50 chars of quote)
  const shortQuote = normalizedQuote.slice(0, 50)
  if (shortQuote.length > 10 && normalizedContent.includes(shortQuote)) {
    return { valid: true }
  }

  // For very short quotes, require exact match
  if (normalizedQuote.length < 20) {
    return {
      valid: false,
      error: `Exact quote not found in evidence content. Quote: "${quote.slice(0, 50)}..."`,
    }
  }

  // Try word-by-word matching (at least 80% of words must appear)
  const quoteWords = normalizedQuote.split(/\s+/).filter((w) => w.length > 2)
  const contentWords = new Set(normalizedContent.split(/\s+/))
  const matchedWords = quoteWords.filter((w) => contentWords.has(w))
  const matchRatio = matchedWords.length / quoteWords.length

  if (matchRatio >= 0.8) {
    return { valid: true }
  }

  return {
    valid: false,
    error: `Exact quote not found in evidence (${Math.round(matchRatio * 100)}% word match). Quote: "${quote.slice(0, 50)}..."`,
  }
}

// =============================================================================
// DUPLICATE DETECTION
// =============================================================================

export interface DuplicateCheckResult {
  isDuplicate: boolean
  existingClaimId?: string
  reason?: string
}

/**
 * Check if a claim is a duplicate of an existing claim.
 * Duplicates are defined as claims with the same:
 * - subjectType + assertionType + logicExpr + value (semantic identity)
 * - OR same exactQuote + evidenceId (provenance identity)
 */
export async function checkClaimDuplicate(
  claim: AtomicClaimInput,
  evidenceId: string,
  db: any
): Promise<DuplicateCheckResult> {
  // Check for provenance duplicate (same evidence + same quote)
  const provenanceDuplicate = await db.atomicClaim.findFirst({
    where: {
      evidenceId,
      exactQuote: claim.exactQuote,
    },
    select: { id: true },
  })

  if (provenanceDuplicate) {
    return {
      isDuplicate: true,
      existingClaimId: provenanceDuplicate.id,
      reason: "Duplicate: same evidence and exactQuote",
    }
  }

  // Check for semantic duplicate (same meaning from different evidence)
  if (claim.value && claim.valueType) {
    const semanticDuplicate = await db.atomicClaim.findFirst({
      where: {
        subjectType: claim.subjectType,
        assertionType: claim.assertionType,
        logicExpr: claim.logicExpr,
        value: claim.value,
        valueType: claim.valueType,
      },
      select: { id: true },
    })

    if (semanticDuplicate) {
      return {
        isDuplicate: true,
        existingClaimId: semanticDuplicate.id,
        reason: "Duplicate: same semantic content (subject + assertion + logic + value)",
      }
    }
  }

  return { isDuplicate: false }
}

// =============================================================================
// BATCH VALIDATION
// =============================================================================

export interface BatchValidationResult {
  validClaims: AtomicClaimInput[]
  rejectedClaims: Array<{
    claim: AtomicClaimInput
    errors: string[]
    rejectionType: string
  }>
  stats: {
    total: number
    valid: number
    rejected: number
    duplicatesSkipped: number
  }
}

/**
 * Validate a batch of claims, filtering out invalid and duplicate claims.
 * Returns validated claims ready for insertion.
 */
export async function validateClaimBatch(
  claims: AtomicClaimInput[],
  evidenceId: string,
  evidenceContent: string,
  db: any
): Promise<BatchValidationResult> {
  const validClaims: AtomicClaimInput[] = []
  const rejectedClaims: Array<{
    claim: AtomicClaimInput
    errors: string[]
    rejectionType: string
  }> = []
  let duplicatesSkipped = 0

  // Track claims we're about to add to prevent intra-batch duplicates
  const pendingSignatures = new Set<string>()

  for (const claim of claims) {
    // Step 1: Validate the claim
    const validation = validateAtomicClaim(claim, evidenceContent)

    if (!validation.valid) {
      rejectedClaims.push({
        claim,
        errors: validation.errors,
        rejectionType: validation.rejectionType || "VALIDATION_FAILED",
      })
      continue
    }

    // Step 2: Check for duplicates in database
    const duplicateCheck = await checkClaimDuplicate(claim, evidenceId, db)
    if (duplicateCheck.isDuplicate) {
      duplicatesSkipped++
      continue
    }

    // Step 3: Check for intra-batch duplicates
    const signature = `${claim.subjectType}|${claim.assertionType}|${claim.logicExpr}|${claim.value || ""}|${claim.exactQuote}`
    if (pendingSignatures.has(signature)) {
      duplicatesSkipped++
      continue
    }
    pendingSignatures.add(signature)

    // Claim passed all checks
    validClaims.push(claim)

    // Log warnings if any
    if (validation.warnings.length > 0) {
      console.warn(`[claim-validator] Warnings for claim: ${validation.warnings.join(", ")}`)
    }
  }

  return {
    validClaims,
    rejectedClaims,
    stats: {
      total: claims.length,
      valid: validClaims.length,
      rejected: rejectedClaims.length,
      duplicatesSkipped,
    },
  }
}
