import { Money } from "@/domain/shared"
import { FiscalError } from "./FiscalError"

export interface ZkiInput {
  oib: string // Company OIB (11 digits)
  invoiceNumber: string // Format: broj-prostor-uredaj (e.g., "43-1-1")
  totalAmount: Money // Gross amount
  issueDateTime: Date // Issue timestamp
}

/**
 * Builds the ZKI input string per Croatian fiscalization spec.
 * Actual signing (SHA256 + RSA + MD5) happens in infrastructure.
 */
export function buildZkiString(input: ZkiInput): string {
  validateOib(input.oib)

  const dateStr = formatZkiDateTime(input.issueDateTime)
  const amountStr = formatZkiAmount(input.totalAmount)

  // Croatian fiscalization spec: OIB + DateTime + InvoiceNumber + Amount
  return `${input.oib}${dateStr}${input.invoiceNumber}${amountStr}`
}

function validateOib(oib: string): void {
  if (!/^\d{11}$/.test(oib)) {
    throw new FiscalError("OIB must be exactly 11 digits")
  }
}

function formatZkiDateTime(date: Date): string {
  const day = date.getDate().toString().padStart(2, "0")
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const year = date.getFullYear()
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")
  const seconds = date.getSeconds().toString().padStart(2, "0")
  return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`
}

function formatZkiAmount(amount: Money): string {
  // Croatian format: no thousands separator, comma for decimals
  const decimal = amount.toDecimal()
  // Use Decimal.toDecimalPlaces() instead of toFixed() per domain rules
  const rounded = decimal.toDecimalPlaces(2)
  const str = rounded.toString()
  // Handle cases like "123" (no decimal point) vs "123.45"
  const [intPart, decPart] = str.includes(".") ? str.split(".") : [str, ""]
  // Pad decimal part to ensure 2 digits
  const paddedDecPart = (decPart || "").padEnd(2, "0")
  return `${intPart},${paddedDecPart}`
}

// Export helpers for testing
export { validateOib, formatZkiDateTime, formatZkiAmount }
