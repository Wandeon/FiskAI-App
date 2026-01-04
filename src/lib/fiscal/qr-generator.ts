import * as QRCode from "qrcode"
import { Prisma } from "@prisma/client"

const Decimal = Prisma.Decimal

/**
 * Data required for generating fiscal QR codes
 */
export interface FiscalQRData {
  /** Jedinstveni identifikator računa (Unique Invoice Identifier) */
  jir: string
  /** Zaštitni kod izdavatelja (Issuer Protection Code) */
  zki: string
  /** Invoice number */
  invoiceNumber: string
  /** Issuer's OIB (Personal Identification Number) */
  issuerOib: string
  /** Invoice amount */
  amount: string
  /** Invoice date and time */
  dateTime: Date
}

/**
 * Formats a date as "DD.MM.YYYY HH:MM:SS" for fiscal verification
 * @param date - Date to format
 * @returns Formatted date string
 */
export function formatDateTime(date: Date): string {
  const day = date.getDate().toString().padStart(2, "0")
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const year = date.getFullYear()
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")
  const seconds = date.getSeconds().toString().padStart(2, "0")

  return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`
}

/**
 * Generates the Porezna verification URL for invoice verification
 * @param data - Fiscal QR data
 * @returns Verification URL
 */
export function generateVerificationUrl(data: FiscalQRData): string {
  const formattedDateTime = formatDateTime(data.dateTime)
  const formattedAmount = new Decimal(data.amount)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toFixed(2)

  const params = new URLSearchParams({
    jir: data.jir,
    datumvrijeme: formattedDateTime,
    iznos: formattedAmount,
  })

  return `https://porezna.gov.hr/provjera-racuna?${params.toString()}`
}

/**
 * Generates a QR code as a data URL (base64) for PDF embedding
 * @param data - Fiscal QR data
 * @returns Promise resolving to base64 data URL
 */
export async function generateFiscalQRCode(data: FiscalQRData): Promise<string> {
  const url = generateVerificationUrl(data)

  return await QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    width: 150,
    margin: 1,
  })
}

/**
 * Generates a QR code as an SVG string for web display
 * @param data - Fiscal QR data
 * @returns Promise resolving to SVG string
 */
export async function generateFiscalQRCodeSVG(data: FiscalQRData): Promise<string> {
  const url = generateVerificationUrl(data)

  return await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    width: 150,
    margin: 1,
  })
}
