# Technical Standards - EN 16931, UBL 2.1, PEPPOL BIS 3.0

## Overview

Croatian e-invoicing requires compliance with European standards. This document covers the technical specifications FiskAI must implement.

## Standards Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                     EN 16931                                 │
│         (European Semantic Standard)                         │
│     Defines WHAT data an e-invoice must contain             │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ Implemented as
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              PEPPOL BIS Billing 3.0                         │
│           (Core Invoice Usage Specification)                 │
│     Adds business rules and constraints                      │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ Expressed in
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    UBL 2.1 XML                               │
│            (Syntax / File Format)                            │
│     The actual XML structure                                 │
└─────────────────────────────────────────────────────────────┘
```

## EN 16931 - European Standard

**Full Title**: "Electronic invoicing - Semantic data model of the core elements of an electronic invoice"

### Core Data Elements

EN 16931 defines these mandatory and optional business groups:

| Group | Description          | Mandatory |
| ----- | -------------------- | --------- |
| BG-1  | Invoice note         | No        |
| BG-2  | Process control      | Yes       |
| BG-4  | Seller               | Yes       |
| BG-7  | Buyer                | Yes       |
| BG-13 | Delivery information | No        |
| BG-16 | Payment instructions | Yes       |
| BG-22 | Document totals      | Yes       |
| BG-23 | VAT breakdown        | Yes       |
| BG-25 | Invoice line         | Yes       |

### Croatian Extensions

Croatia may require additional fields:

- OIB (Personal Identification Number) for seller and buyer
- JIR (Unique Invoice Identifier) for fiscalization
- ZKI (Security Code of Invoice Issuer)

## PEPPOL BIS Billing 3.0

**Current Version**: 3.0.19 (May 2025 release)

### Document Identifiers

```xml
<!-- CustomizationID - Required -->
<cbc:CustomizationID>
  urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0
</cbc:CustomizationID>

<!-- ProfileID - Required -->
<cbc:ProfileID>
  urn:fdc:peppol.eu:2017:poacc:billing:01:1.0
</cbc:ProfileID>
```

### Document Type Identifier (for routing)

```
urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1
```

### Key Business Rules

| Rule                | Description                                 |
| ------------------- | ------------------------------------------- |
| PEPPOL-EN16931-R001 | Business process must be specified          |
| PEPPOL-EN16931-R003 | Buyer reference or order reference required |
| PEPPOL-EN16931-R010 | Buyer electronic address required           |
| PEPPOL-EN16931-R020 | Seller electronic address required          |

## UBL 2.1 XML Structure

### XML Namespaces

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
```

### Minimal Invoice Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">

  <!-- Process Control -->
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>

  <!-- Invoice Number -->
  <cbc:ID>INV-2026-001</cbc:ID>

  <!-- Issue Date -->
  <cbc:IssueDate>2026-01-15</cbc:IssueDate>

  <!-- Due Date -->
  <cbc:DueDate>2026-02-15</cbc:DueDate>

  <!-- Invoice Type Code -->
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>

  <!-- Currency -->
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>

  <!-- Buyer Reference -->
  <cbc:BuyerReference>PO-12345</cbc:BuyerReference>

  <!-- Seller (Supplier) -->
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cbc:EndpointID schemeID="0191">12345678901</cbc:EndpointID> <!-- OIB -->
      <cac:PartyIdentification>
        <cbc:ID schemeID="0191">12345678901</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>Tvrtka d.o.o.</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>Ilica 1</cbc:StreetName>
        <cbc:CityName>Zagreb</cbc:CityName>
        <cbc:PostalZone>10000</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>HR</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>HR12345678901</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>Tvrtka d.o.o.</cbc:RegistrationName>
        <cbc:CompanyID schemeID="0191">12345678901</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>

  <!-- Buyer (Customer) -->
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cbc:EndpointID schemeID="0191">98765432109</cbc:EndpointID>
      <cac:PartyName>
        <cbc:Name>Kupac j.d.o.o.</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>Vukovarska 2</cbc:StreetName>
        <cbc:CityName>Split</cbc:CityName>
        <cbc:PostalZone>21000</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>HR</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>Kupac j.d.o.o.</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>

  <!-- Payment Means -->
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode> <!-- Bank transfer -->
    <cac:PayeeFinancialAccount>
      <cbc:ID>HR1234567890123456789</cbc:ID>
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>

  <!-- Tax Total -->
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">25.00</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">100.00</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">25.00</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>25</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>

  <!-- Document Totals -->
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">100.00</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">100.00</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">125.00</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">125.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>

  <!-- Invoice Lines -->
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">100.00</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>Consulting services</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>25</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="EUR">100.00</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>

</Invoice>
```

## Croatian Specific Codes

### OIB Scheme ID

For Croatian entities, use scheme ID `0191` (Croatian OIB):

```xml
<cbc:EndpointID schemeID="0191">12345678901</cbc:EndpointID>
```

### VAT Categories for Croatia

| Code | Description        | Rate |
| ---- | ------------------ | ---- |
| S    | Standard rate      | 25%  |
| AA   | Lower rate         | 13%  |
| AA   | Reduced rate       | 5%   |
| E    | Exempt             | 0%   |
| Z    | Zero rated         | 0%   |
| O    | Not subject to VAT | -    |

### Invoice Type Codes

| Code | Description         |
| ---- | ------------------- |
| 380  | Commercial invoice  |
| 381  | Credit note         |
| 383  | Debit note          |
| 386  | Prepayment invoice  |
| 389  | Self-billed invoice |

## Validation

### Schematron Rules

PEPPOL provides Schematron files for validation:

- [PEPPOL-EN16931-UBL.sch](https://github.com/OpenPEPPOL/peppol-bis-invoice-3/blob/master/rules/sch/PEPPOL-EN16931-UBL.sch)

### Validation Process

1. XML Schema validation (XSD)
2. Schematron business rules (PEPPOL)
3. Croatian specific rules (if any)

## Implementation in FiskAI

### TypeScript Types

```typescript
interface UBLInvoice {
  customizationID: string
  profileID: string
  id: string
  issueDate: Date
  dueDate?: Date
  invoiceTypeCode: "380" | "381" | "383" | "386" | "389"
  documentCurrencyCode: string
  buyerReference?: string
  seller: Party
  buyer: Party
  paymentMeans: PaymentMeans[]
  taxTotal: TaxTotal
  legalMonetaryTotal: MonetaryTotal
  invoiceLines: InvoiceLine[]
}

interface Party {
  endpointID: { schemeID: string; value: string }
  partyName: string
  postalAddress: Address
  partyTaxScheme?: { companyID: string }
  partyLegalEntity: { registrationName: string; companyID?: string }
}
```

### XML Generation Library

Recommended: Use a UBL library or build XML with proper escaping

```typescript
import { create } from "xmlbuilder2"

function generateUBLInvoice(invoice: UBLInvoice): string {
  const doc = create({ version: "1.0", encoding: "UTF-8" }).ele("Invoice", {
    xmlns: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
    "xmlns:cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
    "xmlns:cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
  })

  // Build invoice structure...

  return doc.end({ prettyPrint: true })
}
```

## Resources

- [PEPPOL BIS Billing 3.0 Documentation](https://docs.peppol.eu/poacc/billing/3.0/)
- [UBL Invoice Syntax](https://docs.peppol.eu/poacc/billing/3.0/syntax/ubl-invoice/)
- [OpenPEPPOL GitHub](https://github.com/OpenPEPPOL/peppol-bis-invoice-3)
- [EN 16931 Explanation](https://qvalia.com/help/what-is-en-16931/)
- [Croatian eInvoicing Fact Sheet](https://ec.europa.eu/digital-building-blocks/sites/spaces/einvoicingCFS/pages/881983568/2025+Croatia+2025+eInvoicing+Country+Sheet)
