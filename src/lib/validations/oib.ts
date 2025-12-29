/**
 * OIB (Osobni identifikacijski broj) Validation Utilities
 * Croatian Personal Identification Number validation with ISO 7064 MOD 11,10 checksum
 */

import { z } from "zod"

/**
 * Validates OIB format and checksum
 * OIB is 11 digits with ISO 7064, MOD 11-10 checksum
 *
 * @param oib - The OIB string to validate
 * @returns true if OIB is valid (format and checksum), false otherwise
 */
export function validateOib(oib: string): boolean {
  // Must be exactly 11 digits
  if (!/^\d{11}$/.test(oib)) {
    return false
  }

  // Calculate ISO 7064, MOD 11-10 checksum
  let sum = 10
  for (let i = 0; i < 10; i++) {
    sum = (sum + parseInt(oib[i], 10)) % 10
    if (sum === 0) sum = 10
    sum = (sum * 2) % 11
  }

  const checkDigit = (11 - sum) % 10
  return checkDigit === parseInt(oib[10], 10)
}

/**
 * Zod string schema for OIB validation
 * Validates both format (11 digits) and checksum (ISO 7064 MOD 11,10)
 */
export const oibSchema = z
  .string()
  .regex(/^\d{11}$/, "OIB must be exactly 11 digits")
  .refine((oib) => validateOib(oib), {
    message: "Invalid OIB checksum",
  })

/**
 * Optional OIB schema (allows empty string or valid OIB)
 */
export const oibOptionalSchema = z
  .string()
  .optional()
  .or(z.literal(""))
  .refine(
    (oib) => {
      // Allow empty/undefined
      if (!oib || oib === "") return true
      // Validate if provided
      return validateOib(oib)
    },
    {
      message: "Invalid OIB format or checksum",
    }
  )
