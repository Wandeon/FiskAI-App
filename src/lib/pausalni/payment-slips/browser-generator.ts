/**
 * Browser-Only HUB-3A Payment Slip Generator
 *
 * Generates PDF417 barcodes entirely in the browser using bwip-js Canvas API.
 * No server dependencies - works offline on static hosting.
 *
 * Unlike hub3a-generator.ts which uses Buffer.from() for base64 encoding,
 * this version uses canvas.toDataURL() which is browser-native.
 */

"use client"

import { DOPRINOSI_2025, PDV_CONFIG, CROATIAN_MONTHS } from "../constants"

export interface PaymentSlipData {
  payerName: string
  payerAddress: string
  payerCity: string
  recipientName: string
  recipientAddress: string
  recipientCity: string
  recipientIban: string
  amount: number
  currency?: string
  model: string
  reference: string
  purposeCode?: string
  description: string
}

/**
 * Helper to truncate strings to max length
 */
function truncate(str: string, maxLength: number): string {
  if (!str) return ""
  return str.length <= maxLength ? str : str.substring(0, maxLength)
}

/**
 * Format data according to HUB-3A specification
 * Each field has specific length limits and must be in correct order
 */
export function formatHub3aData(data: PaymentSlipData): string {
  const currency = data.currency || "EUR"

  // Validate reference number - this is critical and should not be truncated
  if (data.reference && data.reference.length > 22) {
    throw new Error(`Poziv na broj predugacak: ${data.reference.length} (max 22)`)
  }

  // Amount must be 15 digits with 2 decimal places, no separator
  // e.g., 107.88 EUR -> "000000000010788"
  const amountCents = Math.round(data.amount * 100)
  const amountStr = String(amountCents).padStart(15, "0")

  return [
    "HRVHUB30", // Header (8 chars)
    currency, // Currency (3 chars)
    amountStr, // Amount (15 chars)
    truncate(data.payerName, 30), // Payer name (max 30)
    truncate(data.payerAddress, 27), // Payer address (max 27)
    truncate(data.payerCity, 27), // Payer city (max 27)
    truncate(data.recipientName, 25), // Recipient name (max 25)
    truncate(data.recipientAddress, 25), // Recipient address (max 25)
    truncate(data.recipientCity, 27), // Recipient city (max 27)
    data.recipientIban, // IBAN (21 chars for HR)
    data.model, // Model (4 chars, e.g., "HR68")
    data.reference, // Reference (max 22) - validated above
    data.purposeCode || "OTHR", // Purpose code (4 chars)
    truncate(data.description, 35), // Description (max 35)
  ].join("\n")
}

// Type for bwip-js browser module (toCanvas is exported but types are in namespace)
interface BwipJsBrowserModule {
  toCanvas: (
    canvas: HTMLCanvasElement,
    opts: {
      bcid: string
      text: string
      scale?: number
      height?: number
      includetext?: boolean
      padding?: number
    }
  ) => HTMLCanvasElement
}

/**
 * Generate PDF417 barcode as data URL using bwip-js in browser
 * Returns a Promise that resolves to a data:image/png;base64 URL
 *
 * Uses canvas.toDataURL() instead of Node.js Buffer for browser compatibility.
 */
export async function generateBarcodeDataUrl(data: PaymentSlipData): Promise<string> {
  // Dynamic import bwip-js for browser
  // Cast to browser-specific interface since types are namespaced for Node.js
  const bwipjs = (await import("bwip-js")) as unknown as BwipJsBrowserModule
  const hub3aText = formatHub3aData(data)

  // Create canvas element (browser only)
  const canvas = document.createElement("canvas")

  // Generate barcode onto canvas using bwip-js
  // toCanvas mutates the canvas element in-place and returns the canvas
  bwipjs.toCanvas(canvas, {
    bcid: "pdf417", // PDF417 barcode type
    text: hub3aText,
    scale: 2, // 2x scaling for crisp display
    height: 15, // Height in millimeters
    includetext: false, // Don't include human-readable text
    padding: 5, // Quiet zone around barcode
  })

  // Convert canvas to data URL (browser-native, no Buffer needed)
  return canvas.toDataURL("image/png")
}

/**
 * Generate doprinosi payment slip data for a specific contribution type
 */
export function generateDoprinosiSlip(
  type: "MIO_I" | "MIO_II" | "ZDRAVSTVENO",
  oib: string,
  payer: { name: string; address: string; city: string },
  month: number,
  year: number
): PaymentSlipData {
  const config = DOPRINOSI_2025[type]
  const months = [
    "sijecanj",
    "veljaca",
    "ozujak",
    "travanj",
    "svibanj",
    "lipanj",
    "srpanj",
    "kolovoz",
    "rujan",
    "listopad",
    "studeni",
    "prosinac",
  ]

  return {
    payerName: payer.name,
    payerAddress: payer.address,
    payerCity: payer.city,
    recipientName: config.recipientName,
    recipientAddress: "Zagreb",
    recipientCity: "10000 Zagreb",
    recipientIban: config.iban,
    amount: config.amount,
    model: config.model,
    reference: `${config.referencePrefix}-${oib}`,
    purposeCode: "OTHR",
    description: `${config.description} ${months[month - 1]} ${year}`,
  }
}

/**
 * Generate PDV payment slip data
 */
export function generatePdvSlip(
  oib: string,
  amount: number,
  payer: { name: string; address: string; city: string },
  month: number,
  year: number
): PaymentSlipData {
  return {
    payerName: payer.name,
    payerAddress: payer.address,
    payerCity: payer.city,
    recipientName: PDV_CONFIG.recipientName,
    recipientAddress: "Zagreb",
    recipientCity: "10000 Zagreb",
    recipientIban: PDV_CONFIG.iban,
    amount,
    model: PDV_CONFIG.model,
    reference: `${PDV_CONFIG.referencePrefix}-${oib}`,
    purposeCode: "TAXS",
    description: `PDV za ${CROATIAN_MONTHS[month - 1]} ${year}`,
  }
}

// Re-export constants for convenience
export { DOPRINOSI_2025, PDV_CONFIG, CROATIAN_MONTHS }
