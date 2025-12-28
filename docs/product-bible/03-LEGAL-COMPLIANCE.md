# Legal & Compliance

[← Back to Index](./00-INDEX.md)

---

> **Last Updated:** 2025-12-28
> **Status:** Active - Production Implementation
> **Audit Trail:** See [docs/07_AUDITS/](../07_AUDITS/) for compliance audit reports

## Overview

This chapter documents Croatian legal requirements for business compliance, fiscalization, tax reporting, and e-invoicing. It serves as the authoritative reference for regulatory requirements implemented in FiskAI.

### Regulatory Sources

FiskAI maintains automated regulatory monitoring via the **Regulatory Truth Layer**:

- 60+ Croatian regulatory sources monitored (Porezna uprava, Narodne novine, FINA, HZMO, HZZO)
- Daily sentinel scans with content change detection
- Automated fact extraction with evidence-backed citations
- Human-in-the-loop review for ambiguous content

See `/src/lib/regulatory-truth/data/sources.ts` for complete source registry.

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

**Implementation Status:**
| Component | Status | Evidence |
|-----------|--------|----------|
| ZKI Calculation | IMPLEMENTED | `/src/lib/e-invoice/zki.ts` - RSA-SHA256 + MD5 per spec |
| JIR Receipt | IMPLEMENTED | `/src/lib/fiscal/fiscal-pipeline.ts` |
| XML Builder | IMPLEMENTED | `/src/lib/fiscal/xml-builder.ts` |
| XML Signing | IMPLEMENTED | `/src/lib/fiscal/xml-signer.ts` |
| Porezna Client | IMPLEMENTED | `/src/lib/fiscal/porezna-client.ts` |
| Certificate Storage | IMPLEMENTED | AES-256-GCM envelope encryption |
| Retry Queue | IMPLEMENTED | Exponential backoff with SKIP LOCKED |
| QR Code Generation | IMPLEMENTED | `/src/lib/fiscal/qr-generator.ts` |

**Audit Findings (INV-006, INV-007):**

- ZKI/JIR pipeline fully traced from invoice to fiscal response
- Immutability guards prevent re-fiscalization after JIR receipt
- **Gap:** No database-level immutability trigger (application-layer only)
- See: [compliance-fiscalization-ZKI-JIR-INV-006-007.md](../07_AUDITS/runs/compliance-fiscalization-ZKI-JIR-INV-006-007.md)

---

## 5. E-Invoicing Compliance

### 5.1 EN 16931 European Standard

**Implementation:** `/src/lib/compliance/en16931-validator.ts`

| Requirement                 | Status      | Notes                                 |
| --------------------------- | ----------- | ------------------------------------- |
| UBL 2.1 XML Generation      | IMPLEMENTED | `/src/lib/e-invoice/ubl-generator.ts` |
| PEPPOL BIS Billing 3.0      | IMPLEMENTED | CustomizationID + ProfileID set       |
| Required Fields Validation  | PARTIAL     | Basic checks only, no XSD/Schematron  |
| Croatian OIB/VAT Validation | IMPLEMENTED | 11-digit OIB, HR prefix               |
| Invoice Totals Math Check   | IMPLEMENTED | net + VAT = total validation          |

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

- Sentinel scans regulatory endpoints
- Creates Evidence records with immutable source content
- Classifies PDFs: PDF_TEXT or PDF_SCANNED (needs OCR)

**Layer B: 24/7 Processing (Continuous)**

- OCR Worker: Tesseract + Vision fallback
- Extractor: LLM-based fact extraction
- Composer: Aggregates facts into rules
- Reviewer: Automated quality checks
- Arbiter: Conflict resolution
- Releaser: Publication to production

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

| Data Type       | Legal Requirement | Implementation Status                     |
| --------------- | ----------------- | ----------------------------------------- |
| Invoices        | 11 years          | **Gap:** No automated enforcement         |
| Fiscal Requests | 11 years          | **Gap:** No automated enforcement         |
| Audit Logs      | 7 years           | **Gap:** Conflicting docs (3 vs 7 years)  |
| Certificates    | 11 years          | **Gap:** Hard delete, no tombstones       |
| Backups         | 30 days           | **Gap:** No automated scheduling verified |

---

## 11. Tax & Regulatory Data

> **Data Source:** All values in this section are derived from `/src/lib/fiscal-data/`. Changes to tax rates, thresholds, or deadlines should be made in code, then this document updated to match.
>
> **Action Required:** Code update needed - `/src/lib/fiscal-data/data/thresholds.ts` still shows 665.00 EUR for asset capitalization; legal value for 2025 is 1,000.00 EUR.
>
> **Last Verified:** 2025-01-15
> **Verification Schedule:** Monthly review against official sources

### 11.1 Key Thresholds (2025)

| Threshold            | Amount        | Consequence                                   |
| -------------------- | ------------- | --------------------------------------------- |
| VAT Registration     | 60,000 EUR    | Must register for VAT within 8 days           |
| Paušalni Limit       | 60,000 EUR    | Must switch to real income basis              |
| Cash B2B Limit       | 700 EUR       | Fines for both parties if exceeded            |
| Asset Capitalization | 1,000.00 EUR  | Must depreciate over useful life (2025 value) |
| Small Business       | 1,000,000 EUR | Corporate tax 10% vs 18%                      |

_Source: `/src/lib/fiscal-data/data/thresholds.ts`, verified against Porezna Uprava_

### 11.2 Tax Rates

**Income Tax (Porez na dohodak):**

| Bracket        | Rate | With Surtax (~18%) |
| -------------- | ---- | ------------------ |
| 0 - 60,000 EUR | 20%  | ~23.6%             |
| 60,000+ EUR    | 30%  | ~35.4%             |

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

| Date       | Version | Changes                                                                                                                                  |
| ---------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 2025-12-28 | 2.0     | Major update: Added sections 5-10, 12-13. Incorporated all audit findings. Documented implementation status for all compliance features. |
| 2025-01-15 | 1.1     | Updated tax thresholds verification                                                                                                      |
| 2024-12-XX | 1.0     | Initial legal forms and tax data                                                                                                         |
