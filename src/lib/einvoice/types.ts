/**
 * Core Types for E-Invoice Library
 *
 * This module defines the core data structures for Croatian e-invoicing,
 * including UBL 2.1 compliant invoice structures, party information,
 * and tax calculations.
 */

/**
 * Tax category codes according to Croatian e-invoicing requirements
 *
 * - S: Standard rate (25%)
 * - Z: Zero rated (0%)
 * - E: Exempt from tax
 * - AE: VAT Reverse Charge
 * - K: Intra-community supply
 * - G: Free export item, tax not charged
 * - O: Services outside scope of tax
 * - L: Canary Islands general indirect tax
 * - M: Tax for production, services and importation in Ceuta and Melilla
 */
export type TaxCategoryCode = "S" | "Z" | "E" | "AE" | "K" | "G" | "O" | "L" | "M"

/**
 * Croatian VAT rates (as percentages)
 */
export const CROATIAN_VAT_RATES = {
  standard: 25,
  reduced: 13,
  superReduced: 5,
  zero: 0,
} as const

/**
 * Address information for parties
 */
export interface Address {
  /** Street name and number */
  streetName: string

  /** City name */
  city: string

  /** Postal code */
  postalCode: string

  /** Country code (ISO 3166-1 alpha-2) */
  country: string
}

/**
 * Party information (seller/buyer)
 */
export interface Party {
  /** Legal name of the party */
  name: string

  /** Croatian Personal Identification Number (OIB) */
  oib: string

  /** Party address */
  address: Address

  /** VAT identification number (optional for buyers) */
  vatNumber?: string
}

/**
 * Tax category information for invoice lines
 */
export interface TaxCategory {
  /** Tax category code */
  code: TaxCategoryCode

  /** Tax percentage (0-100) */
  percent: number

  /** Tax scheme identifier (usually 'VAT') */
  taxScheme?: string
}

/**
 * Tax subtotal for a specific tax category
 */
export interface TaxSubtotal {
  /** Taxable amount (base for tax calculation) */
  taxableAmount: number

  /** Tax amount */
  taxAmount: number

  /** Tax category */
  taxCategory: TaxCategory
}

/**
 * Total tax information for the invoice
 */
export interface TaxTotal {
  /** Total tax amount */
  taxAmount: number

  /** Tax subtotals by category */
  taxSubtotals: TaxSubtotal[]
}

/**
 * Monetary totals for the invoice
 */
export interface MonetaryTotal {
  /** Sum of line totals (before tax) */
  lineExtensionAmount: number

  /** Total amount excluding tax */
  taxExclusiveAmount: number

  /** Total amount including tax */
  taxInclusiveAmount: number

  /** Amount due for payment */
  payableAmount: number

  /** Allowance total amount (discounts) */
  allowanceTotalAmount?: number

  /** Charge total amount (additional charges) */
  chargeTotalAmount?: number

  /** Prepaid amount */
  prepaidAmount?: number
}

/**
 * Individual invoice line item
 */
export interface InvoiceLine {
  /** Line identifier (sequential number) */
  id: string

  /** Item description */
  description: string

  /** Quantity */
  quantity: number

  /** Unit of measure code (e.g., 'C62' for piece, 'KGM' for kilogram) */
  unitCode: string

  /** Price per unit (excluding tax) */
  unitPrice: number

  /** Tax category for this line */
  taxCategory: TaxCategory

  /** Line total amount (quantity × unitPrice, excluding tax) */
  lineTotal: number
}

/**
 * Complete e-invoice structure
 */
export interface EInvoice {
  /** Invoice number (unique identifier) */
  invoiceNumber: string

  /** Invoice issue date (ISO 8601 format) */
  issueDate: string

  /** Payment due date (ISO 8601 format) */
  dueDate: string

  /** Currency code (ISO 4217, e.g., 'EUR', 'HRK') */
  currencyCode: string

  /** Seller information */
  seller: Party

  /** Buyer information */
  buyer: Party

  /** Invoice line items */
  lines: InvoiceLine[]

  /** Tax totals */
  taxTotal: TaxTotal

  /** Monetary totals */
  legalMonetaryTotal: MonetaryTotal

  /** JIR - Unique invoice identifier from fiscal authority (optional, set after fiscalization) */
  jir?: string

  /** ZKI - Security code of the invoice (optional, calculated for Croatian fiscalization) */
  zki?: string
}
