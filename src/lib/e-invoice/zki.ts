import * as crypto from "crypto"
import { validateOib } from "../validations/oib"

/**
 * ZKI (Zaštitni Kod Izdavatelja) - Protective Code of the Issuer
 * Used for Croatian fiscalization system
 */

export interface ZKIInput {
  oib: string // Company OIB (11 digits)
  dateTime: Date // Invoice date/time
  invoiceNumber: string // Invoice number
  premisesCode: string // Business premises code
  deviceCode: string // Payment device code
  totalAmount: number // Total with VAT in cents (or smallest currency unit)
}

/**
 * Calculate ZKI code for fiscalization
 *
 * @param input - The invoice data required for ZKI calculation
 * @param privateKey - Optional RSA private key (PEM format) for production fiscalization
 * @returns 32-character ZKI code
 *
 * In production mode (with privateKey):
 * 1. Create data string from input fields
 * 2. Sign with RSA-SHA256
 * 3. Hash signature with MD5
 *
 * In demo mode (without privateKey):
 * 1. Create data string from input fields
 * 2. Hash with SHA256
 */
export function calculateZKI(input: ZKIInput, privateKey?: string): string {
  // Format: OIB + DateTime(dd.MM.yyyyHH:mm:ss) + InvoiceNumber + PremisesCode + DeviceCode + TotalAmount
  const dateStr = formatDateTime(input.dateTime)
  const amountStr = formatAmount(input.totalAmount)

  const data = `${input.oib}${dateStr}${input.invoiceNumber}${input.premisesCode}${input.deviceCode}${amountStr}`

  if (privateKey) {
    try {
      // Real ZKI: RSA-SHA256 signature, then MD5 of result
      const sign = crypto.createSign("RSA-SHA256")
      sign.update(data, "utf8")
      const signature = sign.sign(privateKey)
      return crypto.createHash("md5").update(signature).digest("hex")
    } catch (error) {
      console.error("Error calculating ZKI with private key:", error)
      throw new Error("Failed to calculate ZKI with private key")
    }
  }

  // Demo ZKI: Just SHA256 hash (for testing without certificates)
  return crypto.createHash("sha256").update(data, "utf8").digest("hex").substring(0, 32)
}

/**
 * Format date/time for ZKI calculation
 * Format: dd.MM.yyyyHH:mm:ss (Croatian fiscalization format)
 */
function formatDateTime(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0")

  const day = pad(date.getDate())
  const month = pad(date.getMonth() + 1)
  const year = date.getFullYear()
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  const seconds = pad(date.getSeconds())

  return `${day}.${month}.${year}${hours}:${minutes}:${seconds}`
}

/**
 * Format amount for ZKI calculation
 * Format: 0.00 with comma as decimal separator (Croatian format)
 */
function formatAmount(amount: number): string {
  // Amount should be in smallest currency unit (cents for EUR)
  // Convert to decimal with 2 places
  const decimalAmount = amount / 100
  return decimalAmount.toFixed(2).replace(".", ",")
}

/**
 * Validate ZKI input data
 */
export function validateZKIInput(input: ZKIInput): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Validate OIB (11 digits with checksum)
  if (!validateOib(input.oib)) {
    errors.push("Invalid OIB format or checksum")
  }

  // Validate invoice number
  if (!input.invoiceNumber || input.invoiceNumber.trim().length === 0) {
    errors.push("Invoice number is required")
  }

  // Validate premises code
  if (!input.premisesCode || input.premisesCode.trim().length === 0) {
    errors.push("Premises code is required")
  }

  // Validate device code
  if (!input.deviceCode || input.deviceCode.trim().length === 0) {
    errors.push("Device code is required")
  }

  // Validate amount (must be positive)
  if (input.totalAmount <= 0) {
    errors.push("Total amount must be positive")
  }

  // Validate date
  if (!(input.dateTime instanceof Date) || isNaN(input.dateTime.getTime())) {
    errors.push("Invalid date/time")
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
