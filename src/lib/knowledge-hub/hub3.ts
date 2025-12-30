// src/lib/knowledge-hub/hub3.ts
import bwipjs from "bwip-js"

export interface Hub3Data {
  amount: number
  payerName: string
  payerAddress: string
  payerCity: string
  recipientName: string
  recipientAddress: string
  recipientCity: string
  recipientIBAN: string
  model: string
  reference: string
  description: string
  currency?: string
}

/**
 * Validate Croatian OIB (Personal Identification Number)
 * Uses ISO 7064, MOD 11-10 algorithm
 */
export function validateOIB(oib: string): boolean {
  if (!/^\d{11}$/.test(oib)) return false

  let a = 10
  for (let i = 0; i < 10; i++) {
    a = (a + parseInt(oib[i], 10)) % 10
    if (a === 0) a = 10
    a = (a * 2) % 11
  }

  const controlDigit = (11 - a) % 10
  return controlDigit === parseInt(oib[10], 10)
}

/**
 * Format amount for Hub3 (15 digits, no decimal point)
 */
export function formatHub3Amount(amount: number): string {
  const cents = Math.round(amount * 100)
  return cents.toString().padStart(15, "0")
}

/**
 * Pad or trim string to exact length
 */
function padString(str: string, length: number): string {
  return str.slice(0, length).padEnd(length, " ")
}

/**
 * Generate Hub3 barcode data string
 * Format: HRVHUB30 + fixed-length fields
 */
export function generateHub3Data(data: Hub3Data): string {
  const currency = data.currency || "EUR"
  const amount = formatHub3Amount(data.amount)

  // Hub3 format specification
  const lines = [
    "HRVHUB30", // Header
    currency, // Currency (3)
    amount, // Amount (15)
    padString(data.payerName, 30), // Payer name
    padString(data.payerAddress, 27), // Payer address
    padString(data.payerCity, 27), // Payer city
    padString(data.recipientName, 25), // Recipient name
    padString(data.recipientAddress, 25), // Recipient address
    padString(data.recipientCity, 27), // Recipient city
    data.recipientIBAN, // IBAN (21)
    data.model, // Model (4)
    padString(data.reference, 22), // Reference
    "COST", // Purpose code
    padString(data.description, 35), // Description
  ]

  return lines.join("\n")
}

/**
 * Generate Hub3 barcode as PNG buffer
 */
export async function generateHub3Barcode(data: Hub3Data): Promise<Buffer> {
  const hub3String = generateHub3Data(data)

  return bwipjs.toBuffer({
    bcid: "pdf417",
    text: hub3String,
    scale: 2,
    height: 10,
    includetext: false,
  })
}

/**
 * Generate Hub3 barcode as base64 data URL
 */
export async function generateHub3DataUrl(data: Hub3Data): Promise<string> {
  const buffer = await generateHub3Barcode(data)
  return `data:image/png;base64,${buffer.toString("base64")}`
}
