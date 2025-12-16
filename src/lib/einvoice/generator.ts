/**
 * UBL 2.1 XML Generator
 *
 * This module generates UBL 2.1 compliant XML documents for Croatian e-invoicing.
 * UBL (Universal Business Language) is an international standard for electronic
 * business documents.
 */

import type {
  EInvoice,
  Party,
  Address,
  InvoiceLine,
  TaxTotal,
  TaxSubtotal,
  MonetaryTotal,
} from "./types"

/**
 * Generator options
 */
export interface GeneratorOptions {
  /** Whether to format XML with indentation (default: true) */
  prettyPrint?: boolean

  /** Customization ID for UBL profile (default: urn:cen.eu:en16931:2017#compliant#urn:fina.hr:2.0) */
  customizationID?: string

  /** Profile ID for UBL profile (default: urn:fina.hr:profiles:core:ver2.0) */
  profileID?: string
}

/**
 * Default generator options
 */
const DEFAULT_OPTIONS: Required<GeneratorOptions> = {
  prettyPrint: true,
  customizationID: "urn:cen.eu:en16931:2017#compliant#urn:fina.hr:2.0",
  profileID: "urn:fina.hr:profiles:core:ver2.0",
}

/**
 * Escapes special XML characters
 *
 * @param text - The text to escape
 * @returns Escaped text safe for XML
 */
function escapeXML(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

/**
 * Formats a date to YYYY-MM-DD format
 *
 * @param date - The date string or Date object
 * @returns Formatted date string
 */
function formatDate(date: string | Date): string {
  if (typeof date === "string") {
    // Assume it's already in ISO format
    return date.split("T")[0]
  }
  return date.toISOString().split("T")[0]
}

/**
 * Formats an amount to 2 decimal places
 *
 * @param amount - The amount to format
 * @returns Formatted amount string
 */
function formatAmount(amount: number): string {
  return amount.toFixed(2)
}

/**
 * Formats a percentage to 2 decimal places
 *
 * @param percent - The percentage to format
 * @returns Formatted percentage string
 */
function formatPercent(percent: number): string {
  return percent.toFixed(2)
}

/**
 * Generates XML for an address
 *
 * @param address - The address to generate XML for
 * @param indent - Indentation level
 * @returns XML string
 */
function generateAddressXML(address: Address, indent: string): string {
  return `${indent}<cac:PostalAddress>
${indent}  <cbc:StreetName>${escapeXML(address.streetName)}</cbc:StreetName>
${indent}  <cbc:CityName>${escapeXML(address.city)}</cbc:CityName>
${indent}  <cbc:PostalZone>${escapeXML(address.postalCode)}</cbc:PostalZone>
${indent}  <cac:Country>
${indent}    <cbc:IdentificationCode>${escapeXML(address.country)}</cbc:IdentificationCode>
${indent}  </cac:Country>
${indent}</cac:PostalAddress>`
}

/**
 * Generates XML for a party (seller/buyer)
 *
 * @param party - The party to generate XML for
 * @param role - The role ('supplier' or 'customer')
 * @param indent - Indentation level
 * @returns XML string
 */
function generatePartyXML(party: Party, role: "supplier" | "customer", indent: string): string {
  const tagName = role === "supplier" ? "AccountingSupplierParty" : "AccountingCustomerParty"

  let xml = `${indent}<cac:${tagName}>
${indent}  <cac:Party>
${indent}    <cbc:EndpointID schemeID="HR:OIB">${escapeXML(party.oib)}</cbc:EndpointID>
${indent}    <cac:PartyName>
${indent}      <cbc:Name>${escapeXML(party.name)}</cbc:Name>
${indent}    </cac:PartyName>
${generateAddressXML(party.address, indent + "    ")}`

  if (party.vatNumber) {
    xml += `
${indent}    <cac:PartyTaxScheme>
${indent}      <cbc:CompanyID>${escapeXML(party.vatNumber)}</cbc:CompanyID>
${indent}      <cac:TaxScheme>
${indent}        <cbc:ID>VAT</cbc:ID>
${indent}      </cac:TaxScheme>
${indent}    </cac:PartyTaxScheme>`
  }

  xml += `
${indent}    <cac:PartyLegalEntity>
${indent}      <cbc:RegistrationName>${escapeXML(party.name)}</cbc:RegistrationName>
${indent}      <cbc:CompanyID schemeID="HR:OIB">${escapeXML(party.oib)}</cbc:CompanyID>
${indent}    </cac:PartyLegalEntity>
${indent}  </cac:Party>
${indent}</cac:${tagName}>`

  return xml
}

/**
 * Generates XML for an invoice line
 *
 * @param line - The invoice line to generate XML for
 * @param currencyCode - The currency code
 * @param indent - Indentation level
 * @returns XML string
 */
function generateInvoiceLineXML(line: InvoiceLine, currencyCode: string, indent: string): string {
  return `${indent}<cac:InvoiceLine>
${indent}  <cbc:ID>${escapeXML(line.id)}</cbc:ID>
${indent}  <cbc:InvoicedQuantity unitCode="${escapeXML(line.unitCode)}">${formatAmount(line.quantity)}</cbc:InvoicedQuantity>
${indent}  <cbc:LineExtensionAmount currencyID="${escapeXML(currencyCode)}">${formatAmount(line.lineTotal)}</cbc:LineExtensionAmount>
${indent}  <cac:Item>
${indent}    <cbc:Description>${escapeXML(line.description)}</cbc:Description>
${indent}    <cbc:Name>${escapeXML(line.description)}</cbc:Name>
${indent}    <cac:ClassifiedTaxCategory>
${indent}      <cbc:ID>${escapeXML(line.taxCategory.code)}</cbc:ID>
${indent}      <cbc:Percent>${formatPercent(line.taxCategory.percent)}</cbc:Percent>
${indent}      <cac:TaxScheme>
${indent}        <cbc:ID>${escapeXML(line.taxCategory.taxScheme || "VAT")}</cbc:ID>
${indent}      </cac:TaxScheme>
${indent}    </cac:ClassifiedTaxCategory>
${indent}  </cac:Item>
${indent}  <cac:Price>
${indent}    <cbc:PriceAmount currencyID="${escapeXML(currencyCode)}">${formatAmount(line.unitPrice)}</cbc:PriceAmount>
${indent}  </cac:Price>
${indent}</cac:InvoiceLine>`
}

/**
 * Generates XML for a tax subtotal
 *
 * @param subtotal - The tax subtotal to generate XML for
 * @param currencyCode - The currency code
 * @param indent - Indentation level
 * @returns XML string
 */
function generateTaxSubtotalXML(
  subtotal: TaxSubtotal,
  currencyCode: string,
  indent: string
): string {
  return `${indent}<cac:TaxSubtotal>
${indent}  <cbc:TaxableAmount currencyID="${escapeXML(currencyCode)}">${formatAmount(subtotal.taxableAmount)}</cbc:TaxableAmount>
${indent}  <cbc:TaxAmount currencyID="${escapeXML(currencyCode)}">${formatAmount(subtotal.taxAmount)}</cbc:TaxAmount>
${indent}  <cac:TaxCategory>
${indent}    <cbc:ID>${escapeXML(subtotal.taxCategory.code)}</cbc:ID>
${indent}    <cbc:Percent>${formatPercent(subtotal.taxCategory.percent)}</cbc:Percent>
${indent}    <cac:TaxScheme>
${indent}      <cbc:ID>${escapeXML(subtotal.taxCategory.taxScheme || "VAT")}</cbc:ID>
${indent}    </cac:TaxScheme>
${indent}  </cac:TaxCategory>
${indent}</cac:TaxSubtotal>`
}

/**
 * Generates XML for tax total
 *
 * @param taxTotal - The tax total to generate XML for
 * @param currencyCode - The currency code
 * @param indent - Indentation level
 * @returns XML string
 */
function generateTaxTotalXML(taxTotal: TaxTotal, currencyCode: string, indent: string): string {
  let xml = `${indent}<cac:TaxTotal>
${indent}  <cbc:TaxAmount currencyID="${escapeXML(currencyCode)}">${formatAmount(taxTotal.taxAmount)}</cbc:TaxAmount>`

  for (const subtotal of taxTotal.taxSubtotals) {
    xml += "\n" + generateTaxSubtotalXML(subtotal, currencyCode, indent + "  ")
  }

  xml += `\n${indent}</cac:TaxTotal>`
  return xml
}

/**
 * Generates XML for legal monetary total
 *
 * @param total - The monetary total to generate XML for
 * @param currencyCode - The currency code
 * @param indent - Indentation level
 * @returns XML string
 */
function generateLegalMonetaryTotalXML(
  total: MonetaryTotal,
  currencyCode: string,
  indent: string
): string {
  let xml = `${indent}<cac:LegalMonetaryTotal>
${indent}  <cbc:LineExtensionAmount currencyID="${escapeXML(currencyCode)}">${formatAmount(total.lineExtensionAmount)}</cbc:LineExtensionAmount>
${indent}  <cbc:TaxExclusiveAmount currencyID="${escapeXML(currencyCode)}">${formatAmount(total.taxExclusiveAmount)}</cbc:TaxExclusiveAmount>
${indent}  <cbc:TaxInclusiveAmount currencyID="${escapeXML(currencyCode)}">${formatAmount(total.taxInclusiveAmount)}</cbc:TaxInclusiveAmount>`

  if (total.allowanceTotalAmount !== undefined && total.allowanceTotalAmount !== null) {
    xml += `\n${indent}  <cbc:AllowanceTotalAmount currencyID="${escapeXML(currencyCode)}">${formatAmount(total.allowanceTotalAmount)}</cbc:AllowanceTotalAmount>`
  }

  if (total.chargeTotalAmount !== undefined && total.chargeTotalAmount !== null) {
    xml += `\n${indent}  <cbc:ChargeTotalAmount currencyID="${escapeXML(currencyCode)}">${formatAmount(total.chargeTotalAmount)}</cbc:ChargeTotalAmount>`
  }

  if (total.prepaidAmount !== undefined && total.prepaidAmount !== null) {
    xml += `\n${indent}  <cbc:PrepaidAmount currencyID="${escapeXML(currencyCode)}">${formatAmount(total.prepaidAmount)}</cbc:PrepaidAmount>`
  }

  xml += `\n${indent}  <cbc:PayableAmount currencyID="${escapeXML(currencyCode)}">${formatAmount(total.payableAmount)}</cbc:PayableAmount>
${indent}</cac:LegalMonetaryTotal>`

  return xml
}

/**
 * Generates a UBL 2.1 compliant XML invoice
 *
 * @param invoice - The invoice to generate XML for
 * @param options - Generator options
 * @returns UBL 2.1 XML string
 */
export function generateUBLInvoice(invoice: EInvoice, options: GeneratorOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const indent = opts.prettyPrint ? "  " : ""
  const newline = opts.prettyPrint ? "\n" : ""

  // XML declaration and root element with namespaces
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
${indent}<cbc:CustomizationID>${escapeXML(opts.customizationID)}</cbc:CustomizationID>
${indent}<cbc:ProfileID>${escapeXML(opts.profileID)}</cbc:ProfileID>
${indent}<cbc:ID>${escapeXML(invoice.invoiceNumber)}</cbc:ID>
${indent}<cbc:IssueDate>${formatDate(invoice.issueDate)}</cbc:IssueDate>
${indent}<cbc:DueDate>${formatDate(invoice.dueDate)}</cbc:DueDate>
${indent}<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
${indent}<cbc:DocumentCurrencyCode>${escapeXML(invoice.currencyCode)}</cbc:DocumentCurrencyCode>`

  // Add JIR if present (fiscalization identifier)
  if (invoice.jir) {
    xml += `\n${indent}<cbc:UUID>${escapeXML(invoice.jir)}</cbc:UUID>`
  }

  // Add supplier (seller) party
  xml += "\n" + generatePartyXML(invoice.seller, "supplier", indent)

  // Add customer (buyer) party
  xml += "\n" + generatePartyXML(invoice.buyer, "customer", indent)

  // Add tax total
  xml += "\n" + generateTaxTotalXML(invoice.taxTotal, invoice.currencyCode, indent)

  // Add legal monetary total
  xml +=
    "\n" + generateLegalMonetaryTotalXML(invoice.legalMonetaryTotal, invoice.currencyCode, indent)

  // Add invoice lines
  for (const line of invoice.lines) {
    xml += "\n" + generateInvoiceLineXML(line, invoice.currencyCode, indent)
  }

  // Close root element
  xml += "\n</Invoice>"

  return xml
}

/**
 * Helper function to create a minimal valid UBL invoice for testing
 *
 * @param invoiceNumber - Invoice number
 * @returns Minimal UBL XML string
 */
export function generateMinimalUBLInvoice(invoiceNumber: string): string {
  const today = new Date().toISOString().split("T")[0]

  return generateUBLInvoice({
    invoiceNumber,
    issueDate: today,
    dueDate: today,
    currencyCode: "EUR",
    seller: {
      name: "Test Seller",
      oib: "12345678901",
      address: {
        streetName: "Test Street 1",
        city: "Zagreb",
        postalCode: "10000",
        country: "HR",
      },
    },
    buyer: {
      name: "Test Buyer",
      oib: "98765432109",
      address: {
        streetName: "Buyer Street 1",
        city: "Split",
        postalCode: "21000",
        country: "HR",
      },
    },
    lines: [
      {
        id: "1",
        description: "Test Item",
        quantity: 1,
        unitCode: "C62",
        unitPrice: 100.0,
        taxCategory: {
          code: "S",
          percent: 25,
          taxScheme: "VAT",
        },
        lineTotal: 100.0,
      },
    ],
    taxTotal: {
      taxAmount: 25.0,
      taxSubtotals: [
        {
          taxableAmount: 100.0,
          taxAmount: 25.0,
          taxCategory: {
            code: "S",
            percent: 25,
            taxScheme: "VAT",
          },
        },
      ],
    },
    legalMonetaryTotal: {
      lineExtensionAmount: 100.0,
      taxExclusiveAmount: 100.0,
      taxInclusiveAmount: 125.0,
      payableAmount: 125.0,
    },
  })
}
