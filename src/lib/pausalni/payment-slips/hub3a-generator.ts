/**
 * HUB-3A Payment Slip Generator
 * Generates PDF417 barcodes according to Croatian HUB-3A standard
 * Spec: https://www.hub.hr/sites/default/files/inline-files/2dbc_0.pdf
 */

import { DOPRINOSI_2025, PDV_CONFIG, CROATIAN_MONTHS } from "../constants"

export interface PaymentSlipData {
  // Payer info
  payerName: string
  payerAddress: string
  payerCity: string

  // Recipient info
  recipientName: string
  recipientAddress: string
  recipientCity: string
  recipientIban: string

  // Payment details
  amount: number // In EUR (e.g., 107.88)
  currency?: string // Default: EUR
  model: string // e.g., "HR68"
  reference: string // e.g., "8214-12345678901"
  purposeCode?: string // Default: "OTHR"
  description: string
}

/**
 * Result of HUB-3A generation including warnings about truncated fields
 */
export interface HubGenerationResult {
  data: string
  warnings: string[]
}

/**
 * Format data according to HUB-3A specification
 * Each field has specific length limits and must be in correct order
 * Returns data and warnings about truncated fields
 */
export function formatHub3aData(data: PaymentSlipData): HubGenerationResult {
  const currency = data.currency || "EUR"
  const warnings: string[] = []

  // Helper function to truncate with warning
  const truncateWithWarning = (str: string, maxLength: number, fieldName: string): string => {
    if (str && str.length > maxLength) {
      warnings.push(
        \`\${fieldName} skraćeno s \${str.length} na \${maxLength} znakova: "\${str}" -> "\${str.substring(0, maxLength)}"\`
      )
    }
    return truncate(str, maxLength)
  }

  // Validate reference number - this is critical and should not be truncated
  if (data.reference && data.reference.length > 22) {
    throw new Error(
      \`Poziv na broj je predugačak: \${data.reference.length} znakova (maksimum 22). Molimo koristite kraći poziv na broj.\`
    )
  }

  // Amount must be 15 digits with 2 decimal places, no separator
  // e.g., 107.88 EUR -> "000000000010788"
  const amountCents = Math.round(data.amount * 100)
  const amountStr = String(amountCents).padStart(15, "0")

  // Build HUB-3A string according to spec
  const lines = [
    "HRVHUB30", // Header (8 chars)
    currency, // Currency (3 chars)
    amountStr, // Amount (15 chars)
    truncateWithWarning(data.payerName, 30, "Ime platitelja"), // Payer name (max 30)
    truncateWithWarning(data.payerAddress, 27, "Adresa platitelja"), // Payer address (max 27)
    truncateWithWarning(data.payerCity, 27, "Grad platitelja"), // Payer city (max 27)
    truncateWithWarning(data.recipientName, 25, "Ime primatelja"), // Recipient name (max 25)
    truncateWithWarning(data.recipientAddress, 25, "Adresa primatelja"), // Recipient address (max 25)
    truncateWithWarning(data.recipientCity, 27, "Grad primatelja"), // Recipient city (max 27)
    data.recipientIban, // IBAN (21 chars for HR)
    data.model, // Model (4 chars, e.g., "HR68")
    data.reference, // Reference (max 22) - validated above, never truncated
    data.purposeCode || "OTHR", // Purpose code (4 chars)
    truncateWithWarning(data.description, 35, "Opis plaćanja"), // Description (max 35)
  ]

  return {
    data: lines.join("\n"),
    warnings,
  }
}

/**
 * Generate PDF417 barcode as SVG
 */
export async function generateBarcodeSvg(data: PaymentSlipData): Promise<string> {
  // Dynamic import to avoid SSR issues
  const { PDF417 } = await import("pdf417-generator")

  const result = formatHub3aData(data)

  // Generate barcode
  const barcode = PDF417.encode(result.data, {
    columns: 10,
    errorLevel: 5,
  })

  return barcode.toSVG({
    width: 300,
    height: 100,
    color: "#000000",
    backgroundColor: "#ffffff",
  })
}

/**
 * Generate PDF417 barcode as data URL for img src
 */
export async function generateBarcodeDataUrl(data: PaymentSlipData): Promise<string> {
  const svg = await generateBarcodeSvg(data)
  const base64 = Buffer.from(svg).toString("base64")
  return \`data:image/svg+xml;base64,\${base64}\`
}

/**
 * Helper to truncate strings to max length
 */
function truncate(str: string, maxLength: number): string {
  if (!str) return ""
  return str.length <= maxLength ? str : str.substring(0, maxLength)
}

/**
 * Generate payment slip for specific obligation type
 */
export function generateDoprinosiSlip(
  type: "MIO_I" | "MIO_II" | "ZDRAVSTVENO",
  oib: string,
  payer: { name: string; address: string; city: string },
  periodMonth: number,
  periodYear: number
): PaymentSlipData {
  const config = DOPRINOSI_2025[type]

  const monthNames = [
    "siječanj",
    "veljača",
    "ožujak",
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
    reference: \`\${config.referencePrefix}-\${oib}\`,
    purposeCode: "OTHR",
    description: \`\${config.description} \${monthNames[periodMonth - 1]} \${periodYear}\`,
  }
}

/**
 * Generate PDV payment slip
 */
export function generatePdvSlip(
  oib: string,
  amount: number,
  payer: { name: string; address: string; city: string },
  periodMonth: number,
  periodYear: number
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
    reference: \`\${PDV_CONFIG.referencePrefix}-\${oib}\`,
    purposeCode: "TAXS",
    description: \`PDV za \${CROATIAN_MONTHS[periodMonth - 1]} \${periodYear}\`,
  }
}
