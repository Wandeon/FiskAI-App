/**
 * CSV Formula Injection Protection
 *
 * Prevents CSV injection attacks by escaping cell values that start with
 * formula trigger characters. When such values are opened in spreadsheet
 * applications like Excel, they could potentially execute malicious formulas.
 *
 * Characters that trigger formula interpretation:
 * - = (equals sign - standard formula prefix)
 * - + (plus sign - can start formulas)
 * - - (minus sign - can start formulas)
 * - @ (at sign - Excel-specific formula trigger)
 * - \t (tab character - can be used in formula injection)
 * - \r (carriage return - can be used in formula injection)
 *
 * @see https://owasp.org/www-community/attacks/CSV_Injection
 */

/**
 * Regex pattern to detect formula trigger characters at the start of a string
 */
const FORMULA_TRIGGER_REGEX = /^[=+\-@\t\r]/

/**
 * Sanitizes a single CSV cell value by prefixing with a single quote
 * if it starts with a formula trigger character.
 *
 * The single quote prefix prevents spreadsheet applications from
 * interpreting the value as a formula while still displaying correctly.
 *
 * @param value - The cell value to sanitize
 * @returns The sanitized cell value
 *
 * @example
 * sanitizeCsvValue("=cmd|'/C calc'!A1") // Returns "'=cmd|'/C calc'!A1"
 * sanitizeCsvValue("Normal text") // Returns "Normal text"
 * sanitizeCsvValue("+1234567890") // Returns "'+1234567890"
 */
export function sanitizeCsvValue(value: string): string {
  if (!value || typeof value !== "string") {
    return value
  }

  if (FORMULA_TRIGGER_REGEX.test(value)) {
    return "'" + value
  }

  return value
}

/**
 * Checks if a value contains a potential formula injection attempt.
 *
 * @param value - The value to check
 * @returns True if the value starts with a formula trigger character
 *
 * @example
 * isFormulaInjection("=SUM(A1)") // Returns true
 * isFormulaInjection("Normal text") // Returns false
 */
export function isFormulaInjection(value: string): boolean {
  if (!value || typeof value !== "string") {
    return false
  }

  return FORMULA_TRIGGER_REGEX.test(value)
}

/**
 * Sanitizes all string values in an object by applying formula injection protection.
 * This is useful for sanitizing parsed CSV row objects.
 *
 * @param obj - The object with string values to sanitize
 * @returns A new object with all string values sanitized
 *
 * @example
 * sanitizeCsvRow({ name: "=HYPERLINK(...)", sku: "SKU-001" })
 * // Returns { name: "'=HYPERLINK(...)", sku: "SKU-001" }
 */
export function sanitizeCsvRow<T extends Record<string, unknown>>(obj: T): T {
  const result = {} as T

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      const sanitized = sanitizeCsvValue(value)
      ;(result as Record<string, unknown>)[key] = sanitized
    } else {
      ;(result as Record<string, unknown>)[key] = value
    }
  }

  return result
}
