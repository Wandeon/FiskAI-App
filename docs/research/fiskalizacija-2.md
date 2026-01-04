# Fiskalizacija 2.0 - Research Documentation

## Overview

Fiskalizacija 2.0 is Croatia's comprehensive digital transformation of the invoicing and tax reporting system. It introduces mandatory e-invoicing for all business transactions (B2B, B2G) and extends fiscalization requirements to all payment methods.

## Legal Framework

- **Law**: Zakon o fiskalizaciji (NN 89/25)
- **Published**: June 13, 2025
- **Effective**: September 1, 2025
- **Full Mandate**: January 1, 2026

## Key Dates Timeline

| Date             | Milestone                                                                    |
| ---------------- | ---------------------------------------------------------------------------- |
| **Sep 1, 2025**  | Testing phase begins; businesses can register their information intermediary |
| **Dec 31, 2025** | Deadline to register information intermediary via FiskAplikacija             |
| **Jan 1, 2026**  | Mandatory e-invoicing for VAT-registered businesses (issuance + receipt)     |
| **Jan 1, 2026**  | Non-VAT businesses must receive e-invoices                                   |
| **Jan 1, 2027**  | Non-VAT businesses must also issue e-invoices                                |
| **Jan 1, 2027**  | Paper invoices no longer allowed                                             |
| **Jul 1, 2030**  | ViDA (VAT in the Digital Age) compliance required                            |

## Scope

### Transaction Types Covered

- **B2B** (Business-to-Business): Between VAT-registered entities
- **B2G** (Business-to-Government): Already mandatory since July 2019
- **B2C** (Business-to-Consumer): Fiscalization at POS (existing requirement expanded)

### What's New in 2.0

1. **Extended Payment Methods**: Now includes bank transfers, PayPal, Google Pay, Apple Pay (not just cash/card)
2. **Mandatory E-Invoicing**: XML format required, no more PDF-by-email
3. **Real-time Reporting**: Continuous Transaction Controls (CTC)
4. **11-Year Archive**: E-invoices must be stored in original XML format

## Technical Requirements

### Invoice Format

- **Standard**: EN 16931 (European e-invoice standard)
- **Formats**: UBL 2.1 or CII (Cross-Industry Invoice)
- **Protocol**: AS4 for document exchange
- **Network**: PEPPOL integration for cross-border

### Required Elements

Per EN 16931, invoices must include:

- Seller and buyer identification (OIB for Croatian entities)
- Invoice number and date
- Line items with descriptions
- Tax breakdown (PDV)
- Payment terms
- Electronic address identifiers

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Tax Authority (Porezna)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │FiskAplikacija│  │     AMS      │  │   MIKROeRAČUN    │   │
│  │  (Registry)  │  │ (Directory)  │  │  (Free app)      │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ AS4
                           ▼
┌─────────────────────────────────────────────────────────────┐
│               Information Intermediaries                     │
│         (Fina, IE-Računi, Solo, etc.)                       │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ API
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Business Software                         │
│                    (FiskAI, ERPs, etc.)                      │
└─────────────────────────────────────────────────────────────┘
```

## MIKROeRAČUN - Free Government App

The Tax Authority provides a free application for small businesses:

### Eligibility

- Not VAT-registered (nisu u sustavu PDV-a)
- Not public procurement entities
- Croatian tax residents

### Features

- Free via ePorezna portal
- Issue, receive, and fiscalize e-invoices
- Available from 2026 (receive) and 2027 (issue)

### Limitation

If a business becomes VAT-registered, they must switch to a commercial information intermediary.

## Obligations for FiskAI Users

### For VAT-Registered Businesses (d.o.o., larger obrt)

- Must issue AND receive e-invoices from Jan 1, 2026
- Must use information intermediary
- Real-time fiscalization of all invoices

### For Non-VAT Businesses (paušalni obrt, small j.d.o.o.)

- Must receive e-invoices from Jan 1, 2026
- Must issue e-invoices from Jan 1, 2027
- Can use free MIKROeRAČUN or commercial solution

## Compliance Checklist

- [ ] Register with information intermediary before Dec 31, 2025
- [ ] Implement EN 16931 compliant invoice generation
- [ ] Connect to AS4 network (via intermediary)
- [ ] Implement 11-year archival storage
- [ ] Update all invoicing workflows to XML
- [ ] Test in sandbox environment (Sep-Dec 2025)

## Sources

- [Fiskalizacija 2.0 Official Portal](https://fiskalizacija2.hr/)
- [Zakon o fiskalizaciji (NN 89/25)](https://narodne-novine.nn.hr/clanci/sluzbeni/2025_06_89_1233.html)
- [Porezna Uprava - eRačun](https://porezna.gov.hr/fiskalizacija/bezgotovinski-racuni/eracun)
- [EU eInvoicing Croatia Fact Sheet](https://ec.europa.eu/digital-building-blocks/sites/spaces/einvoicingCFS/pages/881983568/2025+Croatia+2025+eInvoicing+Country+Sheet)
- [MIKROeRAČUN Upute](https://porezna.gov.hr/fiskalizacija/api/dokumenti/122)
