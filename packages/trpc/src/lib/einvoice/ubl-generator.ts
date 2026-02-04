/**
 * UBL 2.1 Invoice Generator for Croatian E-Invoicing
 * Compliant with Croatian CIUS-2025 specification
 */

import type { Invoice, InvoiceLine, Company, Contact } from "@fiskai/db"

interface InvoiceWithRelations extends Invoice {
  company: Company
  contact: Contact | null
  lines: InvoiceLine[]
}

const UBL_NAMESPACES = {
  invoice: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
  cac: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  cbc: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
}

const CUSTOMIZATION_ID =
  "urn:cen.eu:en16931:2017#compliant#urn:mfin.gov.hr:cius-2025:1.0#conformant#urn:mfin.gov.hr:ext-2025:1.0"
const PROFILE_ID = "P1"

function escapeXml(str: string | null | undefined): string {
  if (!str) return ""
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0] || ""
}

function formatTime(date: Date): string {
  return date.toTimeString().split(" ")[0] || ""
}

function formatDecimal(cents: number, decimals: number = 2): string {
  return (cents / 100).toFixed(decimals)
}

function formatQuantity(quantityTimes100: number): string {
  return (quantityTimes100 / 100).toFixed(3)
}

function generateSupplierPartyXml(company: Company): string {
  return `
    <cac:AccountingSupplierParty>
      <cac:Party>
        ${company.oib ? `<cbc:EndpointID schemeID="9934">${escapeXml(company.oib)}</cbc:EndpointID>` : ""}
        <cac:PartyIdentification>
          <cbc:ID>${company.oib ? `9934:${escapeXml(company.oib)}` : ""}</cbc:ID>
        </cac:PartyIdentification>
        <cac:PartyName>
          <cbc:Name>${escapeXml(company.name)}</cbc:Name>
        </cac:PartyName>
        <cac:PostalAddress>
          <cbc:StreetName>${escapeXml(company.address)}</cbc:StreetName>
          <cbc:CityName>${escapeXml(company.city)}</cbc:CityName>
          <cbc:PostalZone>${escapeXml(company.zipCode)}</cbc:PostalZone>
          <cac:Country>
            <cbc:IdentificationCode>${escapeXml(company.country)}</cbc:IdentificationCode>
          </cac:Country>
        </cac:PostalAddress>
        ${
          company.vatNumber
            ? `
        <cac:PartyTaxScheme>
          <cbc:CompanyID>${escapeXml(company.vatNumber)}</cbc:CompanyID>
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:PartyTaxScheme>`
            : ""
        }
        <cac:PartyLegalEntity>
          <cbc:RegistrationName>${escapeXml(company.name)}</cbc:RegistrationName>
          ${company.oib ? `<cbc:CompanyID>${escapeXml(company.oib)}</cbc:CompanyID>` : ""}
        </cac:PartyLegalEntity>
      </cac:Party>
      ${
        company.oib
          ? `
      <cac:SellerContact>
        <cbc:ID>${escapeXml(company.oib)}</cbc:ID>
        <cbc:Name>Operator-1</cbc:Name>
      </cac:SellerContact>`
          : ""
      }
    </cac:AccountingSupplierParty>`
}

function generateCustomerPartyXml(contact: Contact): string {
  return `
    <cac:AccountingCustomerParty>
      <cac:Party>
        ${contact.oib ? `<cbc:EndpointID schemeID="9934">${escapeXml(contact.oib)}</cbc:EndpointID>` : ""}
        <cac:PartyIdentification>
          <cbc:ID>${contact.oib ? `9934:${escapeXml(contact.oib)}` : ""}</cbc:ID>
        </cac:PartyIdentification>
        <cac:PartyName>
          <cbc:Name>${escapeXml(contact.name)}</cbc:Name>
        </cac:PartyName>
        <cac:PostalAddress>
          <cbc:StreetName>${escapeXml(contact.address)}</cbc:StreetName>
          <cbc:CityName>${escapeXml(contact.city)}</cbc:CityName>
          <cbc:PostalZone>${escapeXml(contact.zipCode)}</cbc:PostalZone>
          <cac:Country>
            <cbc:IdentificationCode>${escapeXml(contact.country)}</cbc:IdentificationCode>
          </cac:Country>
        </cac:PostalAddress>
        <cac:PartyLegalEntity>
          <cbc:RegistrationName>${escapeXml(contact.name)}</cbc:RegistrationName>
          ${contact.oib ? `<cbc:CompanyID>${escapeXml(contact.oib)}</cbc:CompanyID>` : ""}
        </cac:PartyLegalEntity>
      </cac:Party>
    </cac:AccountingCustomerParty>`
}

function generateInvoiceLineXml(line: InvoiceLine, index: number): string {
  return `
    <cac:InvoiceLine>
      <cbc:ID>${index + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="${escapeXml(line.unit)}">${formatQuantity(line.quantity)}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="EUR">${formatDecimal(line.lineTotalCents)}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Name>${escapeXml(line.description)}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>${escapeXml(line.vatCategory)}</cbc:ID>
          <cbc:Percent>${line.vatRate}</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="EUR">${formatDecimal(line.unitPrice)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`
}

export function generateUBLInvoice(invoice: InvoiceWithRelations): string {
  if (!invoice.contact) {
    throw new Error("Invoice must have a contact (buyer)")
  }

  const { company, contact, lines } = invoice

  // Group lines by VAT rate for tax subtotals
  const taxSubtotals = lines.reduce(
    (acc, line) => {
      const key = `${line.vatCategory}-${line.vatRate}`
      if (!acc[key]) {
        acc[key] = {
          category: line.vatCategory,
          rate: line.vatRate,
          taxableAmountCents: 0,
          taxAmountCents: 0,
        }
      }
      acc[key].taxableAmountCents += line.lineTotalCents
      acc[key].taxAmountCents += line.vatAmountCents
      return acc
    },
    {} as Record<
      string,
      {
        category: string
        rate: number
        taxableAmountCents: number
        taxAmountCents: number
      }
    >
  )

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="${UBL_NAMESPACES.invoice}"
         xmlns:cac="${UBL_NAMESPACES.cac}"
         xmlns:cbc="${UBL_NAMESPACES.cbc}">
  <cbc:CustomizationID>${CUSTOMIZATION_ID}</cbc:CustomizationID>
  <cbc:ProfileID>${PROFILE_ID}</cbc:ProfileID>
  <cbc:ID>${escapeXml(invoice.invoiceNumberFull)}</cbc:ID>
  <cbc:IssueDate>${formatDate(invoice.issueDate)}</cbc:IssueDate>
  <cbc:IssueTime>${formatTime(invoice.issueDate)}</cbc:IssueTime>
  ${invoice.dueDate ? `<cbc:DueDate>${formatDate(invoice.dueDate)}</cbc:DueDate>` : ""}
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${escapeXml(invoice.currency)}</cbc:DocumentCurrencyCode>
  ${invoice.buyerReference ? `<cbc:BuyerReference>${escapeXml(invoice.buyerReference)}</cbc:BuyerReference>` : ""}

  ${generateSupplierPartyXml(company)}
  ${generateCustomerPartyXml(contact)}

  ${
    company.iban
      ? `
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>
    <cac:PayeeFinancialAccount>
      <cbc:ID>${escapeXml(company.iban)}</cbc:ID>
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>`
      : ""
  }

  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">${formatDecimal(invoice.vatAmountCents)}</cbc:TaxAmount>
    ${Object.values(taxSubtotals)
      .map(
        (subtotal) => `
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">${formatDecimal(subtotal.taxableAmountCents)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">${formatDecimal(subtotal.taxAmountCents)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>${escapeXml(subtotal.category)}</cbc:ID>
        <cbc:Percent>${subtotal.rate}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`
      )
      .join("")}
  </cac:TaxTotal>

  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">${formatDecimal(invoice.subtotalCents)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">${formatDecimal(invoice.subtotalCents)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">${formatDecimal(invoice.totalCents)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">${formatDecimal(invoice.totalCents)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>

  ${lines.map((line, index) => generateInvoiceLineXml(line, index)).join("")}
</Invoice>`

  return xml.trim()
}
