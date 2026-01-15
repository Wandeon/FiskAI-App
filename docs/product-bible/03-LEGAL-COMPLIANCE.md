# Legal & Compliance

[← Back to Index](./00-INDEX.md)

---

> **Last Audit:** 2026-01-14 | **Auditor:** Claude Sonnet 4.5
> **Version:** 3.1.0
> **Status:** Active - Production Implementation
> **Audit Trail:** See [docs/07_AUDITS/](../07_AUDITS/) for compliance audit reports
> **Changes in v3.1.0:** Updated 2025 tax thresholds, clarified fiscalization implementation, added GDPR/AZOP compliance, expanded RTL coverage details

## Overview

This chapter documents Croatian legal requirements for business compliance, fiscalization, tax reporting, and e-invoicing. It serves as the authoritative reference for regulatory requirements implemented in FiskAI.

### Regulatory Sources

FiskAI maintains automated regulatory monitoring via the **Regulatory Truth Layer**:

- 60+ Croatian regulatory sources monitored (Porezna uprava, Narodne novine, FINA, HZMO, HZZO)
- Daily sentinel scans with content change detection
- Automated fact extraction with evidence-backed citations
- Human-in-the-loop review for ambiguous content

See `/src/lib/regulatory-truth/data/sources.ts` for complete source registry.

### 2024-2025 Regulatory Changes

**Key Changes Effective January 1, 2025:**

1. **VAT Registration Threshold:** Increased from 40,000 EUR to **60,000 EUR**
   - Previous: 300,000 HRK (approx. 39,816.84 EUR at conversion rate 7.53450)
   - Current: 60,000 EUR
   - Source: Porezna uprava notice, effective 2025-01-01

2. **Paušalni Obrt Limit:** Increased to **60,000 EUR**
   - Previous: 300,000 HRK (approx. 39,816.84 EUR)
   - Current: 60,000 EUR
   - Exceeding this limit requires transition to real income basis (obrt na dohodak)

3. **Income Tax Brackets:** Adjusted for 2025
   - Lower bracket: 0 - 50,400 EUR (20% + surtax)
   - Upper bracket: 50,400.01+ EUR (30% + surtax)
   - Previous bracket threshold: 60,000 EUR

4. **Asset Capitalization:** Maintained HRK conversion
   - Threshold: 464.53 EUR (3,500 HRK at fixed rate 7.53450)
   - Note: Some sources cite 665 EUR or 1,000 EUR; system uses official HRK conversion for legal continuity

5. **Contribution Rates:** Unchanged for 2025
   - MIO I: 15% (minimum 107.88 EUR/month)
   - MIO II: 5% (minimum 35.96 EUR/month)
   - HZZO: 16.5% (minimum 118.67 EUR/month)
   - Minimum base: 719.2 EUR/month

**Verification Status:**

- Last verified: 2025-01-15
- Sources: Porezna uprava, HZZO, HZMO official websites
- Code status: Implemented in `/src/lib/fiscal-data/data/thresholds.ts` and `tax-rates.ts`

---

## 4. Legal Forms & Compliance Requirements

### 4.1 Croatian Business Types

| Legal Form     | Code          | Min Capital | Tax Regime    | Accounting   | VAT      |
| -------------- | ------------- | ----------- | ------------- | ------------ | -------- |
| Paušalni Obrt  | `OBRT_PAUSAL` | 0 EUR       | Flat-rate 12% | Single-entry | NO       |
| Obrt (Dohodak) | `OBRT_REAL`   | 0 EUR       | Income tax    | Single-entry | Optional |
| Obrt (PDV)     | `OBRT_VAT`    | 0 EUR       | Income + VAT  | Single-entry | YES      |
| j.d.o.o.       | `JDOO`        | 1 EUR       | Corporate     | Double-entry | YES      |
| d.o.o.         | `DOO`         | 2,500 EUR   | Corporate     | Double-entry | YES      |

> **Double-entry Accounting:** JDOO and DOO require a General Ledger with Chart of Accounts based on the RRiF kontni plan.
> See [GL Engine Spec](../plans/2025-01-GL-ENGINE-SPEC.md) for implementation plan including Prisma schema, posting service, and migration strategy.

### 4.2 Module Requirements by Legal Form

| Module               | OBRT_PAUSAL | OBRT_REAL  | OBRT_VAT   | JDOO       | DOO        |
| -------------------- | ----------- | ---------- | ---------- | ---------- | ---------- |
| Invoicing            | ✅          | ✅         | ✅         | ✅         | ✅         |
| KPR (Sales Log)      | ✅          | ❌         | ❌         | ❌         | ❌         |
| KPI (Income/Expense) | ❌          | ✅         | ✅         | ❌         | ❌         |
| PO-SD (Annual Form)  | ✅          | ❌         | ❌         | ❌         | ❌         |
| DOH (Income Tax)     | ❌          | ✅         | ✅         | ❌         | ❌         |
| URA/IRA              | ❌          | ✅         | ✅         | ✅         | ✅         |
| PDV Forms            | ❌          | ⚠️ IF VAT  | ✅         | ✅         | ✅         |
| Assets (DI)          | ❌          | ✅         | ✅         | ✅         | ✅         |
| Corporate Tax        | ❌          | ❌         | ❌         | ✅         | ✅         |
| JOPPD                | ❌          | ⚠️ IF EMP  | ⚠️ IF EMP  | ⚠️ IF EMP  | ⚠️ IF EMP  |
| Fiscalization        | ⚠️ IF CASH  | ⚠️ IF CASH | ⚠️ IF CASH | ⚠️ IF CASH | ⚠️ IF CASH |

### 4.3 The 20 Scenarios Matrix

Every possible combination of legal form × VAT × cash × employees:

| #   | Legal Form | VAT   | Cash | Employees | Required Modules                |
| --- | ---------- | ----- | ---- | --------- | ------------------------------- |
| 1   | Paušalni   | No    | No   | No        | Invoicing, KPR, PO-SD           |
| 2   | Paušalni   | No    | Yes  | No        | + **Fiscalization**             |
| 3   | Paušalni   | Yes\* | No   | No        | + **PDV**                       |
| 4   | Paušalni   | Yes\* | Yes  | No        | + **PDV, Fiscalization**        |
| 5   | Obrt Real  | No    | No   | No        | Invoicing, KPI, URA/IRA, Assets |
| 6   | Obrt Real  | No    | Yes  | No        | + **Fiscalization**             |
| 7   | Obrt Real  | No    | No   | Yes       | + **JOPPD**                     |
| 8   | Obrt Real  | No    | Yes  | Yes       | + **Fiscalization, JOPPD**      |
| 9   | Obrt Real  | Yes   | No   | No        | + **PDV**                       |
| 10  | Obrt Real  | Yes   | Yes  | No        | + **PDV, Fiscalization**        |
| 11  | Obrt Real  | Yes   | No   | Yes       | + **PDV, JOPPD**                |
| 12  | Obrt Real  | Yes   | Yes  | Yes       | + **PDV, Fiscalization, JOPPD** |
| 13  | j.d.o.o.   | Yes   | No   | No        | Invoicing, URA/IRA, Assets, PDV |
| 14  | j.d.o.o.   | Yes   | Yes  | No        | + **Fiscalization**             |
| 15  | j.d.o.o.   | Yes   | No   | Yes       | + **JOPPD**                     |
| 16  | j.d.o.o.   | Yes   | Yes  | Yes       | + **Fiscalization, JOPPD**      |
| 17  | d.o.o.     | Yes   | No   | No        | Invoicing, URA/IRA, Assets, PDV |
| 18  | d.o.o.     | Yes   | Yes  | No        | + **Fiscalization**             |
| 19  | d.o.o.     | Yes   | No   | Yes       | + **JOPPD**                     |
| 20  | d.o.o.     | Yes   | Yes  | Yes       | + **Fiscalization, JOPPD**      |

\*Paušalni with VAT = exceeded 60k threshold

### 4.4 Invoice Requirements by VAT Status

**NOT in VAT system (Paušalni < 60k):**

```
MUST include:
"Porezni obveznik nije u sustavu PDV-a prema čl. 90. st. 2. Zakona o PDV-u"

CANNOT show:
- VAT breakdown
- VAT registration number (HR + OIB)
```

**IN VAT system:**

```
MUST include:
- Seller VAT ID: HR + OIB
- Buyer VAT ID (if B2B)
- VAT breakdown by rate (25%, 13%, 5%, 0%)
- Tax point date
- Sequential invoice number
```

### 4.5 Fiscalization Requirements

**Legal Framework:**

- **Regulation:** Croatian Fiscalization System (Fiskalizacija) 1.0
- **Authority:** Porezna uprava (Tax Administration)
- **Implementation Date:** January 1, 2013
- **Legal Basis:** Zakon o fiskalizaciji u prometu gotovinom (Law on Fiscalization of Cash Transactions)

**When Required:**

| Payment Method  | Fiscalization?         |
| --------------- | ---------------------- |
| Cash (Gotovina) | YES                    |
| Card (Kartica)  | YES                    |
| Bank Transfer   | NO                     |
| Mixed           | YES (for cash portion) |

**The Flow:**

```
1. Create Invoice
       ↓
2. Calculate ZKI (32-char hex from RSA signature)
       ↓
3. Send to CIS (Tax Authority)
       ↓
4. Receive JIR (36-char UUID)
       ↓
5. Print Invoice with ZKI + JIR + QR Code
```

**Endpoints:**

- **Test:** `https://cistest.apis-it.hr:8449/FiskalizacijaServiceTest`
- **Production:** `https://cis.porezna-uprava.hr:8449/FiskalizacijaService`

**Implementation Status:**
| Component | Status | Evidence | Notes |
|-----------|--------|----------|-------|
| ZKI Calculation | IMPLEMENTED | `/src/lib/e-invoice/zki.ts` | RSA-SHA256 + MD5 per spec |
| Domain Logic | IMPLEMENTED | `/src/domain/fiscalization/FiscalRequest.ts` | 48-hour deadline enforcement |
| JIR Receipt | IMPLEMENTED | `/src/lib/fiscal/fiscal-pipeline.ts` | Dual-path V1/V2 support |
| XML Builder | IMPLEMENTED | `/src/lib/fiscal/xml-builder.ts` | Fiskalizacija 1.0 schema |
| XML Signing | IMPLEMENTED | `/src/lib/fiscal/xml-signer.ts` | SOAP envelope signing |
| Porezna Client | IMPLEMENTED | `/src/lib/fiscal/porezna-client.ts` | 30s timeout, error parsing |
| Certificate Storage | IMPLEMENTED | AES-256-GCM envelope encryption | V1: FiscalCertificate, V2: IntegrationAccount |
| Retry Queue | IMPLEMENTED | Exponential backoff with SKIP LOCKED | Database-backed queue |
| QR Code Generation | IMPLEMENTED | `/src/lib/fiscal/qr-generator.ts` | Standard QR encoding |

**Certificate Management:**

- **Provider:** FINA (Financial Agency)
- **Format:** P12/PFX with password protection
- **Storage:** Encrypted with envelope encryption (AES-256-GCM)
- **Expiry Monitoring:** 30-day advance notifications via email

**Audit Findings (INV-006, INV-007):**

- ZKI/JIR pipeline fully traced from invoice to fiscal response
- Immutability guards prevent re-fiscalization after JIR receipt
- **Gap:** No database-level immutability trigger (application-layer only)
- See: [compliance-fiscalization-ZKI-JIR-INV-006-007.md](../07_AUDITS/runs/compliance-fiscalization-ZKI-JIR-INV-006-007.md)

---

## 5. E-Invoicing Compliance

### 5.1 EN 16931 European Standard

**Legal Framework:**

- **Standard:** EN 16931 - European Standard on Electronic Invoicing
- **Adoption:** EU Directive 2014/55/EU on electronic invoicing in public procurement
- **Croatian Implementation:** National e-invoice framework via ePoslovanje

**Implementation:** `/src/lib/compliance/en16931-validator.ts`

| Requirement                 | Status      | Notes                                 |
| --------------------------- | ----------- | ------------------------------------- |
| UBL 2.1 XML Generation      | IMPLEMENTED | `/src/lib/e-invoice/ubl-generator.ts` |
| PEPPOL BIS Billing 3.0      | IMPLEMENTED | CustomizationID + ProfileID set       |
| Required Fields Validation  | PARTIAL     | Basic checks only, no XSD/Schematron  |
| Croatian OIB/VAT Validation | IMPLEMENTED | 11-digit OIB, HR prefix               |
| Invoice Totals Math Check   | IMPLEMENTED | net + VAT = total validation          |

**ePoslovanje Integration:**

- **Provider:** ePoslovanje.hr B2B e-invoice intermediary
- **API Version:** v2 (v1 end-of-support 2026-01-01)
- **Implementation:** `/src/lib/e-invoice/providers/eposlovanje-einvoice.ts`
- **Endpoints:**
  - Test: `https://test.eposlovanje.hr`
  - Production: `https://eracun.eposlovanje.hr`
- **Features:** UBL XML send, status polling, idempotency via hash-based deduplication

**Audit Findings (EN 16931 Validator Audit):**

- UBL XML builder produces valid structure but lacks schema validation
- `schemaValidation: true` reported without actual XSD check
- **Gap:** No Schematron rules for PEPPOL compliance
- **Gap:** Send flow bypasses compliance validation
- See: [compliance-en16931-xml-validator.md](../07_AUDITS/runs/compliance-en16931-xml-validator.md)

### 5.2 Croatian Invoice Requirements

**For Non-VAT Invoices (Pausalni < 60k):**

```
MUST include: "Porezni obveznik nije u sustavu PDV-a prema čl. 90. st. 2. Zakona o PDV-u"
CANNOT show: VAT breakdown, VAT registration number (HR + OIB)
```

**For VAT Invoices:**

```
MUST include: Seller VAT ID (HR + OIB), Buyer VAT ID (B2B), VAT breakdown by rate,
              Tax point date, Sequential invoice number
```

---

## 6. Certificate Management

### 6.1 FINA Fiscal Certificate Handling

**Implementation:** `/src/lib/fiscal/envelope-encryption.ts`

| Requirement            | Status      | Evidence                                     |
| ---------------------- | ----------- | -------------------------------------------- |
| P12/PFX Import         | IMPLEMENTED | Base64 + password parsing                    |
| Encrypted Storage      | IMPLEMENTED | AES-256-GCM envelope encryption              |
| Master Key Protection  | IMPLEMENTED | `FISCAL_CERT_KEY` (64 hex chars)             |
| Certificate Validation | IMPLEMENTED | OIB extraction, validity dates               |
| Expiry Monitoring      | IMPLEMENTED | `/src/lib/compliance/certificate-monitor.ts` |
| Email Notifications    | IMPLEMENTED | 30-day warning emails via Resend             |

**Audit Findings (INV-008, INV-015, INV-019):**

- Envelope encryption with per-certificate data keys
- Certificate lifecycle controls (deletion blocked when requests pending)
- **Gap:** No automated retention enforcement (11-year legal requirement)
- **Gap:** Certificate deletion is hard delete, not soft delete
- See: [security-certificates-INV-008-015.md](../07_AUDITS/runs/security-certificates-INV-008-015.md)
- See: [compliance-retention-certificates-INV-019.md](../07_AUDITS/runs/compliance-retention-certificates-INV-019.md)

---

## 7. Multi-Tenant Compliance

### 7.1 Tenant Isolation

**Implementation:** `/src/lib/prisma-extensions.ts`

| Control                       | Status      | Evidence                           |
| ----------------------------- | ----------- | ---------------------------------- |
| Automatic companyId Injection | IMPLEMENTED | Prisma extension middleware        |
| Permission Checks             | IMPLEMENTED | `requireCompanyWithPermission`     |
| Audit Logging                 | IMPLEMENTED | AuditLog table with tenant context |
| Cross-Tenant Prevention       | PARTIAL     | See gaps below                     |

**Audit Findings (INV-001, INV-002):**

- 17/20 sampled routes confirmed isolated
- **Gap:** `fiscalizeInvoice` updates by ID only after scoped read
- **Gap:** E-invoice inbox status update lacks companyId constraint
- See: [security-multitenant-INV-001-002.md](../07_AUDITS/runs/security-multitenant-INV-001-002.md)

---

## 8. Pausalni Obrt Compliance

### 8.1 Contribution Obligations

**Implementation:** `/src/lib/pausalni/`

| Feature                      | Status      | Evidence                      |
| ---------------------------- | ----------- | ----------------------------- |
| Monthly Doprinosi Generation | IMPLEMENTED | `obligation-generator.ts`     |
| MIO I/II + HZZO Amounts      | IMPLEMENTED | 2025 values in `constants.ts` |
| Quarterly Tax Calculation    | IMPLEMENTED | Tier-based brackets           |
| HOK Membership Fees          | IMPLEMENTED | 2-year exemption logic        |
| Payment Slip Generation      | IMPLEMENTED | `hub3a-generator.ts`          |

### 8.2 Tax Forms

| Form                 | Status      | Evidence                   |
| -------------------- | ----------- | -------------------------- |
| PDV XML for ePorezna | IMPLEMENTED | `forms/pdv-generator.ts`   |
| PDV-S Summary        | IMPLEMENTED | `forms/pdv-s-generator.ts` |
| ZP (Quarterly)       | IMPLEMENTED | `forms/zp-generator.ts`    |
| PO-SD (Annual)       | PARTIAL     | Deadline tracking only     |
| KPR (Sales Log)      | IMPLEMENTED | `/src/lib/reports/kpr.ts`  |

### 8.3 EU Transaction Handling

| Feature                      | Status      | Evidence                |
| ---------------------------- | ----------- | ----------------------- |
| EU Vendor Detection          | IMPLEMENTED | `eu-detection.ts`       |
| IBAN Country Analysis        | IMPLEMENTED | 27 EU country codes     |
| Reverse Charge PDV           | IMPLEMENTED | Auto-calculation at 25% |
| PDV-ID Registration Tracking | IMPLEMENTED | `pausalniProfile` table |

---

## 9. Regulatory Truth Layer

### 9.1 Architecture

Two-layer execution model for processing Croatian regulatory content:

**Layer A: Daily Discovery (Scheduled)**

- Sentinel scans 60+ regulatory endpoints (Porezna uprava, Narodne novine, FINA, HZMO, HZZO, HOK)
- Creates Evidence records with immutable source content
- Classifies PDFs: PDF_TEXT or PDF_SCANNED (needs OCR)
- Daily content change detection with hashing

**Layer B: 24/7 Processing (Continuous)**

- OCR Worker: Tesseract + Vision fallback for scanned PDFs
- Extractor: LLM-based fact extraction with evidence-backed citations
- Composer: Aggregates facts into regulatory rules
- Reviewer: Automated quality checks with confidence scoring
- Arbiter: Conflict resolution with hierarchy awareness
- Releaser: Publication to production with fail-closed validation

**Source Coverage:** 60+ Croatian regulatory sources across domains:

- Paušalni obrt (critical priority)
- VAT/PDV (high priority)
- Contributions (doprinosi - critical)
- Fiscalization (high priority)
- Income & Corporate Tax (medium/low priority)
- Deadlines & Chamber Fees

See `/src/lib/regulatory-truth/data/sources.ts` for complete source registry with 692 lines of source definitions.

### 9.2 Audit Status

**Audit Date:** 2025-12-22 | **Status:** NOT PRODUCTION READY

| Finding                                | Severity | Status |
| -------------------------------------- | -------- | ------ |
| Composer SOURCE_CONFLICT FK violation  | CRITICAL | Open   |
| Rate limiter not enforcing caps        | MEDIUM   | Open   |
| Authority derivation ignores hierarchy | MEDIUM   | Open   |
| Audit log gaps for conflicts           | MEDIUM   | Open   |

See: [2025-12-22-regulatory-truth-layer-audit.md](../07_AUDITS/2025-12-22-regulatory-truth-layer-audit.md)

---

## 10. Security & Compliance Posture

### 10.1 OWASP Top 10 Status

| Category                   | Status  | Key Gaps                              |
| -------------------------- | ------- | ------------------------------------- |
| A01 Broken Access Control  | PARTIAL | createMany/updateMany gaps            |
| A02 Cryptographic Failures | PARTIAL | Hard-coded Sudski Registar defaults   |
| A03 Injection              | PARTIAL | Report filters lack schema validation |
| A06 Vulnerable Components  | UNKNOWN | No SCA/audit workflow                 |
| A09 Logging & Monitoring   | PARTIAL | No alerting pipeline                  |

See: [security-owasp-A01-A10.md](../07_AUDITS/runs/security-owasp-A01-A10.md)

### 10.2 Data Retention Requirements

**Legal Framework:**

- **Primary Regulation:** Croatian Accounting Act (Zakon o računovodstvu)
- **Tax Authority:** Porezna uprava retention guidelines
- **GDPR Compliance:** EU Regulation 2016/679 (General Data Protection Regulation)
- **Croatian DPA:** AZOP (Agencija za zaštitu osobnih podataka)

| Data Type       | Legal Requirement | Implementation Status                     | Legal Basis               |
| --------------- | ----------------- | ----------------------------------------- | ------------------------- |
| Invoices        | 11 years          | **Gap:** No automated enforcement         | Accounting Act Art. 15    |
| Fiscal Requests | 11 years          | **Gap:** No automated enforcement         | Fiscalization Law         |
| Audit Logs      | 7 years           | **Gap:** Conflicting docs (3 vs 7 years)  | Tax Code                  |
| Certificates    | 11 years          | **Gap:** Hard delete, no tombstones       | Fiscalization Law         |
| Backups         | 30 days           | **Gap:** No automated scheduling verified | Internal policy           |
| Personal Data   | As needed + max   | Implemented per GDPR Art. 5(1)(e)         | GDPR "storage limitation" |

**GDPR Compliance Measures:**

- **Legal Basis:** Legitimate interest (Art. 6(1)(f)) for business operations
- **Data Minimization:** Only collect necessary data for compliance (Art. 5(1)(c))
- **Right to Erasure:** Balanced against legal retention requirements (Art. 17(3)(b))
- **Data Portability:** Export functionality via `/src/lib/backup/export.ts`
- **Breach Notification:** 72-hour reporting obligation to AZOP

**AZOP Requirements:**

- **Registration:** Required for businesses processing personal data
- **Data Processing Records:** Article 30 GDPR record-keeping
- **DPO Designation:** Not required for most small businesses
- **Cross-Border:** Standard Contractual Clauses for non-EU data transfers

**Archive Implementation:**

- **Module:** `/src/lib/archive/archive-manager.ts`
- **Retention Logic:** 11-year default with configurable periods
- **Status:** Partially implemented (archiving logic exists, enforcement incomplete)

---

## 11. Tax & Regulatory Data

> **Data Source:** All values in this section are derived from `/src/lib/fiscal-data/`. Changes to tax rates, thresholds, or deadlines should be made in code first, then this document updated to match.
>
> **Source of Truth:** Code is authoritative. Documentation reflects implementation.
>
> **Update Process:**
>
> 1. Verify change with official Croatian government sources (Porezna uprava, HZZO, HZMO)
> 2. Update `/src/lib/fiscal-data/data/*.ts` files
> 3. Run validation: `npx tsx src/lib/fiscal-data/validator/run.ts`
> 4. Update this documentation
> 5. Update RTL source monitoring if needed
>
> **Last Verified:** 2026-01-14
> **Verification Schedule:** Monthly review against official sources
>
> **Current Status (2026-01-14):**
>
> - ✅ VAT threshold: 60,000 EUR (verified and implemented)
> - ✅ Paušalni limit: 60,000 EUR (verified and implemented)
> - ✅ Income tax brackets: 50,400 EUR threshold (verified and implemented)
> - ✅ Asset capitalization: 464.53 EUR (HRK conversion - verified and implemented)
> - ✅ Contribution rates: 2025 values confirmed (verified and implemented)
> - ⚠️ Asset capitalization: Conflicting sources cite 665 EUR or 1,000 EUR; code uses official 464.53 EUR (3,500 HRK conversion) pending regulatory clarification

### 11.1 Key Thresholds (2025)

| Threshold            | Amount        | Consequence                                                   | Notes                   |
| -------------------- | ------------- | ------------------------------------------------------------- | ----------------------- |
| VAT Registration     | 60,000 EUR    | Must register for VAT within 8 days                           | Increased from 40k 2024 |
| Paušalni Limit       | 60,000 EUR    | Must switch to real income basis                              | Increased from ~39.8k   |
| Cash B2B Limit       | 700 EUR       | Fines for both parties if exceeded                            | Per transaction         |
| Asset Capitalization | 464.53 EUR    | Must depreciate over useful life (3,500 HRK fixed conversion) | HRK→EUR at 7.53450      |
| Small Business       | 1,000,000 EUR | Corporate tax 10% vs 18%                                      | -                       |

_Source: `/src/lib/fiscal-data/data/thresholds.ts`, verified against Porezna Uprava_

**Note on Asset Capitalization:** The 464.53 EUR threshold is derived from the fixed HRK→EUR conversion rate of 7.53450 applied to the 3,500 HRK threshold established under the previous Kuna currency system. While various sources cite 665 EUR or 1,000 EUR, the system uses the official HRK conversion value for legal continuity.

### 11.2 Tax Rates

**Income Tax (Porez na dohodak):**

| Bracket        | Rate | With Surtax (~18%) |
| -------------- | ---- | ------------------ |
| 0 - 50,400 EUR | 20%  | ~23.6%             |
| 50,400.01+ EUR | 30%  | ~35.4%             |

_Updated 2025: Bracket threshold is 50,400 EUR annually (4,200 EUR monthly)_

**Corporate Tax (Porez na dobit):**

| Revenue         | Rate |
| --------------- | ---- |
| ≤ 1,000,000 EUR | 10%  |
| > 1,000,000 EUR | 18%  |

**VAT Rates:**

| Rate | Applies To                    |
| ---- | ----------------------------- |
| 25%  | Most goods and services       |
| 13%  | Hospitality, newspapers       |
| 5%   | Bread, milk, books, medicines |
| 0%   | Exports, financial services   |

**Paušalni Tax Brackets (2025):**

Base rate: 12% (excluding municipal surtax)

| Tier | Annual Revenue (EUR)  | Tax Base (EUR) | Quarterly Tax (EUR) |
| ---- | --------------------- | -------------- | ------------------- |
| 1    | 0.00 - 11,300.00      | 1,695.00       | 50.85               |
| 2    | 11,300.01 - 15,300.00 | 2,295.00       | 68.85               |
| 3    | 15,300.01 - 19,900.00 | 2,985.00       | 89.55               |
| 4    | 19,900.01 - 30,600.00 | 4,590.00       | 137.70              |
| 5    | 30,600.01 - 40,000.00 | 6,000.00       | 180.00              |
| 6    | 40,000.01 - 50,000.00 | 7,500.00       | 225.00              |
| 7    | 50,000.01 - 60,000.00 | 9,000.00       | 270.00              |

_Source: `/src/lib/fiscal-data/data/tax-rates.ts`, verified against Porezna Uprava_

### 11.3 Contribution Rates (2025)

| Contribution        | Rate      | Minimum Monthly |
| ------------------- | --------- | --------------- |
| MIO I (Pension I)   | 15%       | 107.88 EUR      |
| MIO II (Pension II) | 5%        | 35.96 EUR       |
| HZZO (Health)       | 16.5%     | 118.67 EUR      |
| **Total**           | **36.5%** | **262.51 EUR**  |

Minimum base: 719.2 EUR/month

_Source: `/src/lib/fiscal-data/data/contributions.ts`, verified against Porezna Uprava_

### 11.4 Payment IBANs

| Payment Type | IBAN                  | Model |
| ------------ | --------------------- | ----- |
| State Budget | HR1210010051863000160 | HR68  |
| MIO II       | HR8724070001007120013 | HR68  |
| HZZO         | HR6510010051550100001 | HR68  |
| HOK          | HR1223400091100106237 | HR68  |

_Source: `/src/lib/fiscal-data/data/payment-details.ts`, verified against Porezna Uprava_

### 11.5 Deadlines Calendar

**Monthly:**

| Day  | What                      | Who        |
| ---- | ------------------------- | ---------- |
| 15th | Contributions (MIO, HZZO) | All        |
| 15th | JOPPD                     | Employers  |
| 20th | PDV (monthly filers)      | VAT > 800k |

**Quarterly:**

| When                    | What            | Who              |
| ----------------------- | --------------- | ---------------- |
| 20.01/04/07/10          | PDV (quarterly) | Small VAT payers |
| 31.01/04/07/10          | Paušalni tax    | Paušalni obrt    |
| 27.02/31.05/31.08/30.11 | HOK             | All obrts        |

**Annual:**

| When  | What  | Who          |
| ----- | ----- | ------------ |
| 15.01 | PO-SD | Paušalni     |
| 28.02 | DOH   | Obrt dohodak |
| 30.04 | PDO   | D.O.O.       |

_Source: `/src/lib/fiscal-data/data/deadlines.ts`, verified against Porezna Uprava_

---

## 12. Compliance Gap Summary

### 12.1 Critical Gaps (Must Fix Before Production)

| Gap                                           | Category    | Impact                              | Remediation                                |
| --------------------------------------------- | ----------- | ----------------------------------- | ------------------------------------------ |
| Regulatory Truth SOURCE_CONFLICT FK violation | Regulatory  | Conflict resolution pipeline broken | Fix Composer to use proper itemAId/itemBId |
| EN 16931 schema validation missing            | E-Invoicing | Invalid XML may be sent             | Add XSD/Schematron validation before send  |
| No data retention enforcement                 | Legal       | Violation of 11-year requirements   | Implement automated archival jobs          |

### 12.2 High Priority Gaps

| Gap                                      | Category      | Impact                            | Remediation                     |
| ---------------------------------------- | ------------- | --------------------------------- | ------------------------------- |
| fiscalizeInvoice cross-tenant update     | Security      | Potential invoice tampering       | Add companyId to update filter  |
| No database-level immutability after JIR | Fiscalization | Post-fiscalization edits possible | Add DB trigger blocking updates |
| Hard-coded Sudski Registar credentials   | Security      | Credential exposure               | Require env vars, fail closed   |
| No SCA/dependency scanning               | Security      | Vulnerable components undetected  | Add npm audit to CI             |

### 12.3 Medium Priority Gaps

| Gap                              | Category   | Impact                      | Remediation                           |
| -------------------------------- | ---------- | --------------------------- | ------------------------------------- |
| PO-SD form generation incomplete | Pausalni   | Annual filing not automated | Complete form generator               |
| Rate limiter not enforcing caps  | Regulatory | Sources may be over-polled  | Implement per-minute counters         |
| Audit log retention conflicting  | Operations | Policy confusion            | Align to 7-year standard              |
| Certificate soft-delete missing  | Compliance | Audit trail gaps            | Implement soft delete with tombstones |

---

## 13. Audit Report Index

| Report                                                                                                               | Date       | Category      | Key Findings                                   |
| -------------------------------------------------------------------------------------------------------------------- | ---------- | ------------- | ---------------------------------------------- |
| [compliance-fiscalization-ZKI-JIR-INV-006-007.md](../07_AUDITS/runs/compliance-fiscalization-ZKI-JIR-INV-006-007.md) | 2024       | Fiscalization | ZKI/JIR pipeline complete; DB immutability gap |
| [compliance-en16931-xml-validator.md](../07_AUDITS/runs/compliance-en16931-xml-validator.md)                         | 2024       | E-Invoicing   | No schema validation; send bypasses compliance |
| [compliance-retention-certificates-INV-019.md](../07_AUDITS/runs/compliance-retention-certificates-INV-019.md)       | 2024       | Compliance    | No retention enforcement; conflicting policies |
| [security-owasp-A01-A10.md](../07_AUDITS/runs/security-owasp-A01-A10.md)                                             | 2024       | Security      | Partial OWASP coverage; multiple gaps          |
| [security-multitenant-INV-001-002.md](../07_AUDITS/runs/security-multitenant-INV-001-002.md)                         | 2024       | Security      | 17/20 routes isolated; 3 gaps                  |
| [security-certificates-INV-008-015.md](../07_AUDITS/runs/security-certificates-INV-008-015.md)                       | 2024       | Security      | Encryption strong; secret hygiene issues       |
| [2025-12-22-regulatory-truth-layer-audit.md](../07_AUDITS/2025-12-22-regulatory-truth-layer-audit.md)                | 2025-12-22 | Regulatory    | NOT PRODUCTION READY; critical conflict bug    |

---

## Document History

| Date       | Version | Changes                                                                                                                                                                                                                                                                                                                                                                                                                        | Author            |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| 2026-01-14 | 3.1.0   | Comprehensive 2025 update: Updated tax thresholds (60k VAT/Paušalni, 50.4k income brackets), clarified asset capitalization (464.53 EUR HRK conversion), added fiscalization technical details (Fiskalizacija 1.0, CIS endpoints, dual-path V1/V2), expanded ePoslovanje integration (API v2), added GDPR/AZOP compliance framework, detailed RTL source coverage (60+ sources, 692 lines), updated regulatory changes section | Claude Sonnet 4.5 |
| 2025-12-28 | 2.0     | Major update: Added sections 5-10, 12-13. Incorporated all audit findings. Documented implementation status for all compliance features.                                                                                                                                                                                                                                                                                       | Claude Opus 4.5   |
| 2025-01-15 | 1.1     | Updated tax thresholds verification                                                                                                                                                                                                                                                                                                                                                                                            | -                 |
| 2024-12-XX | 1.0     | Initial legal forms and tax data                                                                                                                                                                                                                                                                                                                                                                                               | -                 |
