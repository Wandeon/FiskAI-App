// src/lib/fiscal-data/utils/format.ts

import type { FormatType } from "../types"

/**
 * Format a fiscal value based on its type
 *
 * @example
 * formatFiscalValue(60000, 'currency') // "60.000,00 EUR"
 * formatFiscalValue(0.15, 'percentage') // "15%"
 * formatFiscalValue(719.20, 'number') // "719,20"
 */
export function formatFiscalValue(
  value: number | string,
  format: FormatType = "number",
  options?: {
    locale?: string
    decimals?: number
    showUnit?: boolean
  }
): string {
  const { locale = "hr-HR", decimals, showUnit = true } = options || {}

  if (typeof value === "string") {
    return value
  }

  switch (format) {
    case "currency":
      return formatCurrency(value, { locale, decimals, showUnit })

    case "percentage":
      return formatPercentage(value, { locale, decimals, showUnit })

    case "date":
      return new Date(value).toLocaleDateString(locale)

    case "number":
    default:
      return formatNumber(value, { locale, decimals })
  }
}

/**
 * Format a number as Croatian currency (EUR)
 *
 * @example
 * formatCurrency(60000) // "60.000,00 EUR"
 * formatCurrency(719.20, { decimals: 2 }) // "719,20 EUR"
 */
export function formatCurrency(
  value: number,
  options?: {
    locale?: string
    decimals?: number
    showUnit?: boolean
    currency?: string
  }
): string {
  const { locale = "hr-HR", decimals = 2, showUnit = true, currency = "EUR" } = options || {}

  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)

  return showUnit ? `${formatted} ${currency}` : formatted
}

/**
 * Format a decimal as percentage
 *
 * @example
 * formatPercentage(0.15) // "15%"
 * formatPercentage(0.165, { decimals: 1 }) // "16,5%"
 */
export function formatPercentage(
  value: number,
  options?: {
    locale?: string
    decimals?: number
    showUnit?: boolean
    asDecimal?: boolean // If true, value is already in percentage form (15 instead of 0.15)
  }
): string {
  const { locale = "hr-HR", decimals = 0, showUnit = true, asDecimal = false } = options || {}

  const percentValue = asDecimal ? value : value * 100

  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(percentValue)

  return showUnit ? `${formatted}%` : formatted
}

/**
 * Format a number with Croatian locale
 *
 * @example
 * formatNumber(1234.56) // "1.234,56"
 */
export function formatNumber(
  value: number,
  options?: {
    locale?: string
    decimals?: number
  }
): string {
  const { locale = "hr-HR", decimals = 2 } = options || {}

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value)
}

/**
 * Format IBAN with spaces for readability
 *
 * @example
 * formatIBANDisplay("HR1210010051863000160") // "HR12 1001 0051 8630 0016 0"
 */
export function formatIBANDisplay(iban: string): string {
  const clean = iban.replace(/\s/g, "")
  return clean.match(/.{1,4}/g)?.join(" ") || clean
}

/**
 * Format a date in Croatian format
 *
 * @example
 * formatDateCroatian(new Date('2025-01-15')) // "15. siječnja 2025."
 */
export function formatDateCroatian(
  date: Date,
  options?: {
    showYear?: boolean
    shortMonth?: boolean
  }
): string {
  const { showYear = true, shortMonth = false } = options || {}

  return date.toLocaleDateString("hr-HR", {
    day: "numeric",
    month: shortMonth ? "short" : "long",
    year: showYear ? "numeric" : undefined,
  })
}

/**
 * Format a deadline string
 *
 * @example
 * formatDeadline("15") // "15. u mjesecu"
 * formatDeadline("31.01") // "31. siječnja"
 */
export function formatDeadline(deadline: string): string {
  if (!deadline.includes(".")) {
    // Monthly deadline (just day)
    return `${deadline}. u mjesecu`
  }

  const [day, month] = deadline.split(".")
  const date = new Date(2025, parseInt(month) - 1, parseInt(day))

  return date.toLocaleDateString("hr-HR", {
    day: "numeric",
    month: "long",
  })
}

/**
 * Parse a Croatian formatted number back to a number
 *
 * @example
 * parseCroatianNumber("1.234,56") // 1234.56
 */
export function parseCroatianNumber(value: string): number {
  // Remove thousand separators (.) and replace decimal comma with dot
  const normalized = value
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "")

  return parseFloat(normalized)
}

/**
 * Format a value for display in MDX/content
 * Automatically detects format based on value characteristics
 */
export function autoFormatValue(value: number, path?: string): string {
  // Check path for hints
  if (path) {
    if (path.includes("rate") || path.includes("Rate")) {
      return formatPercentage(value)
    }
    if (path.includes("iban") || path.includes("IBAN")) {
      return formatIBANDisplay(String(value))
    }
  }

  // Infer from value
  if (value > 0 && value < 1) {
    // Likely a rate/percentage
    return formatPercentage(value)
  }

  if (value >= 100) {
    // Likely currency
    return formatCurrency(value)
  }

  return formatNumber(value)
}
