// src/lib/regulatory-truth/utils/deterministic-validators.ts

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
 * Convert ISO date to Croatian format patterns for matching
 */
function dateToPatterns(isoDate: string): string[] {
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

  const [year, month, day] = isoDate.split("-")
  const monthNum = parseInt(month)
  const dayNum = parseInt(day)

  return [
    isoDate,
    `${dayNum}. ${months[monthNum - 1]} ${year}`,
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
 */
export function validateValueInQuote(
  extractedValue: string | number,
  exactQuote: string
): ValidationResult {
  const value = String(extractedValue)
  const quote = exactQuote.toLowerCase()

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

  let patterns: string[] = []

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    patterns = dateToPatterns(value)
  } else if (/^[\d.,]+$/.test(value)) {
    patterns = normalizeNumber(value)
  } else {
    patterns = [value]
  }

  const quoteLower = quote.toLowerCase()
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
    return quoteLower.includes(patternLower)
  })

  if (!found) {
    return {
      valid: false,
      error: `Value "${value}" not found in quote. Possible inference detected.`,
    }
  }

  return { valid: true }
}

// Validate a complete extraction before it goes to AI review
export function validateExtraction(extraction: {
  domain: string
  value_type: string
  extracted_value: string | number
  exact_quote: string
  confidence: number
}): ExtractionValidationResult {
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
