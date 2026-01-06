import { EInvoiceWithRelations } from "./types"
import { Company, Contact, EInvoiceLine, Prisma } from "@prisma/client"

const UBL_NAMESPACES = {
  invoice: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
  cac: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  cbc: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
}

// Croatian CIUS-2025 profile (required by ePoslovanje)
// See: https://eracun.mfin.hr/
const CUSTOMIZATION_ID_HR =
  "urn:cen.eu:en16931:2017#compliant#urn:mfin.gov.hr:cius-2025:1.0#conformant#urn:mfin.gov.hr:ext-2025:1.0"

// Process ID P1 = B2B e-invoice (most common)
// P1-P12 are defined by Croatian CIUS, P99 = custom buyer reference
const PROFILE_ID_HR = "P1"

// Default operator designation (required for Croatian e-invoices)
// CIUS-2025 spec page 23: HR-BT-4 (Oznaka operatera) and HR-BT-5 (OIB operatera)
// These go in SellerContact element inside AccountingSupplierParty
const DEFAULT_OPERATOR_NAME = "Operator-1" // Default operator designation
const DEFAULT_OPERATOR_OIB = "00000000000" // Placeholder - should be real operator OIB

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0]
}

function formatTime(date: Date): string {
  // Croatian CIUS requires time in hh:mm:ss format
  return date.toISOString().split("T")[1].split(".")[0]
}

function formatDecimal(value: number | string | Prisma.Decimal, decimals: number = 2): string {
  return Number(value).toFixed(decimals)
}

function generatePaymentTermsNote(issueDate: Date, dueDate: Date): string {
  const daysDiff = Math.round((dueDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24))

  if (daysDiff === 0) {
    return "Rok plaćanja: odmah po primitku računa"
  } else if (daysDiff === 1) {
    return "Rok plaćanja: 1 dan od datuma računa"
  } else if (daysDiff > 1) {
    return `Rok plaćanja: ${daysDiff} dana od datuma računa`
  } else {
    // Negative days means due date is before issue date
    return `Rok plaćanja: ${formatDate(dueDate)}`
  }
}

/**
 * Generate AccountingSupplierParty or AccountingCustomerParty XML
 *
 * For suppliers (isSupplier=true), includes SellerContact element with:
 * - HR-BT-4 (Oznaka operatera): cac:SellerContact/cbc:Name
 * - HR-BT-5 (OIB operatera): cac:SellerContact/cbc:ID
 *
 * Per CIUS-2025 spec page 23-24, SellerContact is inside AccountingSupplierParty
 * but OUTSIDE of Party element.
 */
function generatePartyXml(
  party: Contact | Company,
  isSupplier: boolean,
  operatorName?: string,
  operatorOib?: string
): string {
  const oib = "oib" in party ? party.oib : null
  const vatNumber = "vatNumber" in party ? party.vatNumber : null

  // Build SellerContact for suppliers (Croatian CIUS-2025 HR-BT-4 and HR-BT-5)
  // Per spec: SellerContact is inside AccountingSupplierParty but OUTSIDE Party
  const sellerContactXml = isSupplier
    ? `
      <cac:SellerContact>
        <cbc:ID>${escapeXml(operatorOib || DEFAULT_OPERATOR_OIB)}</cbc:ID>
        <cbc:Name>${escapeXml(operatorName || DEFAULT_OPERATOR_NAME)}</cbc:Name>
      </cac:SellerContact>`
    : ""

  // Croatian CIUS-2025 spec page 25-26:
  // - EndpointID: schemeID="9934" (HR:VAT in CEF EAS code list) with OIB as value
  // - PartyIdentification/ID: format "9934:{OIB}" as value (no schemeID attribute)
  return `
    <cac:${isSupplier ? "AccountingSupplierParty" : "AccountingCustomerParty"}>
      <cac:Party>
        ${oib ? `<cbc:EndpointID schemeID="9934">${escapeXml(oib)}</cbc:EndpointID>` : ""}
        <cac:PartyIdentification>
          <cbc:ID>${oib ? `9934:${escapeXml(oib)}` : ""}</cbc:ID>
        </cac:PartyIdentification>
        <cac:PartyName>
          <cbc:Name>${escapeXml(party.name)}</cbc:Name>
        </cac:PartyName>
        <cac:PostalAddress>
          <cbc:StreetName>${escapeXml(party.address || "")}</cbc:StreetName>
          <cbc:CityName>${escapeXml(party.city || "")}</cbc:CityName>
          <cbc:PostalZone>${escapeXml(party.postalCode || "")}</cbc:PostalZone>
          <cac:Country>
            <cbc:IdentificationCode>${escapeXml(party.country || "HR")}</cbc:IdentificationCode>
          </cac:Country>
        </cac:PostalAddress>
        ${
          vatNumber
            ? `
        <cac:PartyTaxScheme>
          <cbc:CompanyID>${escapeXml(vatNumber)}</cbc:CompanyID>
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:PartyTaxScheme>`
            : ""
        }
        <cac:PartyLegalEntity>
          <cbc:RegistrationName>${escapeXml(party.name)}</cbc:RegistrationName>
          ${oib ? `<cbc:CompanyID>${escapeXml(oib)}</cbc:CompanyID>` : ""}
        </cac:PartyLegalEntity>
      </cac:Party>${sellerContactXml}
    </cac:${isSupplier ? "AccountingSupplierParty" : "AccountingCustomerParty"}>`
}

function generateInvoiceLineXml(line: EInvoiceLine): string {
  // Croatian CIUS requires CPA classification (HR-BR-25)
  // Per CIUS-2025 spec page 113-115: listID="CG" with KPD/CPA code
  // Using exact code from spec example: 62.20.20 (Computer consultancy activities)
  // TODO: Store actual CPA code in line item or product
  const cpaCode = "62.20.20"

  return `
    <cac:InvoiceLine>
      <cbc:ID>${line.lineNumber}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="${escapeXml(line.unit)}">${formatDecimal(line.quantity, 3)}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="EUR">${formatDecimal(line.netAmount)}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Name>${escapeXml(line.description)}</cbc:Name>
        <cac:CommodityClassification>
          <cbc:ItemClassificationCode listID="CG">${escapeXml(cpaCode)}</cbc:ItemClassificationCode>
        </cac:CommodityClassification>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>${escapeXml(line.vatCategory)}</cbc:ID>
          <cbc:Percent>${formatDecimal(line.vatRate)}</cbc:Percent>
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

export function generateUBLInvoice(invoice: EInvoiceWithRelations): string {
  if (!invoice.buyer) {
    throw new Error("Invoice must have a buyer")
  }

  const { company, buyer, lines } = invoice

  // Group lines by VAT rate for tax subtotals
  const taxSubtotals = lines.reduce(
    (acc, line) => {
      const key = `${line.vatCategory}-${line.vatRate}`
      if (!acc[key]) {
        acc[key] = {
          category: line.vatCategory,
          rate: Number(line.vatRate),
          taxableAmount: 0,
          taxAmount: 0,
        }
      }
      acc[key].taxableAmount += Number(line.netAmount)
      acc[key].taxAmount += Number(line.vatAmount)
      return acc
    },
    {} as Record<
      string,
      {
        category: string
        rate: number
        taxableAmount: number
        taxAmount: number
      }
    >
  )

  // Get operator info for Croatian CIUS-2025
  // HR-BT-4 (Oznaka operatera) = operator name/designation
  // HR-BT-5 (OIB operatera) = operator's OIB (11 digits)
  // These are placed in SellerContact element per CIUS-2025 spec page 23-24
  // Note: operatorName field doesn't exist in schema yet, using company name or default
  const operatorName = DEFAULT_OPERATOR_NAME
  const operatorOib = invoice.operatorOib || company.oib || DEFAULT_OPERATOR_OIB

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="${UBL_NAMESPACES.invoice}"
         xmlns:cac="${UBL_NAMESPACES.cac}"
         xmlns:cbc="${UBL_NAMESPACES.cbc}">
  <cbc:CustomizationID>${CUSTOMIZATION_ID_HR}</cbc:CustomizationID>
  <cbc:ProfileID>${PROFILE_ID_HR}</cbc:ProfileID>
  <cbc:ID>${escapeXml(invoice.invoiceNumber)}</cbc:ID>
  <cbc:IssueDate>${formatDate(invoice.issueDate)}</cbc:IssueDate>
  <cbc:IssueTime>${formatTime(invoice.issueDate)}</cbc:IssueTime>
  ${invoice.dueDate ? `<cbc:DueDate>${formatDate(invoice.dueDate)}</cbc:DueDate>` : ""}
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${escapeXml(invoice.currency)}</cbc:DocumentCurrencyCode>
  ${invoice.buyerReference ? `<cbc:BuyerReference>${escapeXml(invoice.buyerReference)}</cbc:BuyerReference>` : ""}

  ${generatePartyXml(company, true, operatorName, operatorOib)}
  ${generatePartyXml(buyer, false)}

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

  ${
    invoice.dueDate
      ? `
  <cac:PaymentTerms>
    <cbc:Note>${escapeXml(generatePaymentTermsNote(invoice.issueDate, invoice.dueDate))}</cbc:Note>
  </cac:PaymentTerms>`
      : ""
  }

  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">${formatDecimal(invoice.vatAmount)}</cbc:TaxAmount>
    ${Object.values(taxSubtotals)
      .map(
        (subtotal) => `
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">${formatDecimal(subtotal.taxableAmount)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">${formatDecimal(subtotal.taxAmount)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>${escapeXml(subtotal.category)}</cbc:ID>
        <cbc:Percent>${formatDecimal(subtotal.rate)}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`
      )
      .join("")}
  </cac:TaxTotal>

  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">${formatDecimal(invoice.netAmount)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">${formatDecimal(invoice.netAmount)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">${formatDecimal(invoice.totalAmount)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">${formatDecimal(invoice.totalAmount)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>

  ${lines.map(generateInvoiceLineXml).join("")}
</Invoice>`

  return xml.trim()
}
