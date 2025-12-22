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

// Percentage must be 0-100
export function validatePercentage(value: number): ValidationResult {
  if (typeof value !== "number" || isNaN(value)) {
    return { valid: false, error: "Percentage must be a number" }
  }
  if (value < 0) {
    return { valid: false, error: "Percentage cannot be negative" }
  }
  if (value > 100) {
    return { valid: false, error: "Percentage cannot exceed 100" }
  }
  return { valid: true }
}

// Currency must be positive and reasonable
export function validateCurrency(value: number, currency: "eur" | "hrk"): ValidationResult {
  if (typeof value !== "number" || isNaN(value)) {
    return { valid: false, error: "Currency amount must be a number" }
  }
  if (value < 0) {
    return { valid: false, error: "Currency amount cannot be negative" }
  }
  // Max reasonable regulatory amount: 100 billion EUR
  const maxAmount = currency === "eur" ? 100_000_000_000 : 750_000_000_000
  if (value > maxAmount) {
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

// Known domains for validation
const VALID_DOMAINS = [
  "pausalni",
  "pdv",
  "porez_dohodak",
  "doprinosi",
  "fiskalizacija",
  "rokovi",
  "obrasci",
]

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
 * Validate that the extracted value actually appears in the exact quote.
 * This prevents AI "inference" where values are derived but not explicitly stated.
 */
export function validateValueInQuote(
  extractedValue: string | number,
  exactQuote: string
): ValidationResult {
  const value = String(extractedValue)
  const quote = exactQuote.toLowerCase()

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

  // Type-specific validation
  const value = extraction.extracted_value
  const numValue = typeof value === "number" ? value : parseFloat(String(value))

  switch (extraction.value_type) {
    case "percentage": {
      const result = validatePercentage(numValue)
      if (!result.valid) errors.push(result.error!)
      break
    }
    case "currency_eur":
    case "currency": {
      const result = validateCurrency(numValue, "eur")
      if (!result.valid) errors.push(result.error!)
      break
    }
    case "currency_hrk": {
      const result = validateCurrency(numValue, "hrk")
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
