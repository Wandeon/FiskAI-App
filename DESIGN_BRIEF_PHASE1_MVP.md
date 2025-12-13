# FiskAI Phase 1 MVP - Design Brief for Design Team

## Overview
FiskAI is launching as a **modular e-invoicing platform for Croatian micro-businesses** (paušalni obrtnici & d.o.o.). Phase 1 focuses on **client-side invoice creation & management**, with 3 critical missing features blocking customer onboarding.

**Target Launch:** January 2026
**First Customers:** Paušalni obrtnici (self-employed & small corps under 40k € annual revenue)
**Current Status:** 60% complete - core invoicing works, 3 major features incomplete

---

## Current Implementation ✅

### What's Already Built (DO NOT MODIFY)
1. **Invoice Creation** - Multi-step form with buyer, line items, fiscal validation
2. **Invoice Management** - List view, detail view, mark as paid, PDF export
3. **Contact & Product Management** - Full CRUD, OIB lookup integration
4. **E-Fiscalization** - Mock provider (production: FINA integration pending credentials)
5. **Payment Status Tracking** - `paidAt` field, marks as "Plaćeno" on detail page
6. **Bank Statement Module** - Upload, import, accounts management (structure exists)
7. **Expenses Module** - Full feature set (expenses form, categorization, list)

### Database Schema (Relevant Models)
```prisma
model EInvoice {
  id              String
  companyId       String
  type            InvoiceType      @default(E_INVOICE)     // E_INVOICE | QUOTE | CREDIT_NOTE
  invoiceNumber   String
  issueDate       DateTime
  dueDate         DateTime?
  status          InvoiceStatus                            // DRAFT | FISCALIZED | SENT | DELIVERED | OVERDUE | CANCELLED
  paidAt          DateTime?                                // NEW: marks payment date

  // Parties
  buyerId         String?
  sellerId        String?

  // Amounts
  netAmount       Decimal
  vatAmount       Decimal
  grossAmount     Decimal
  currency        String           @default("EUR")

  // Payment & Compliance
  paymentMethod   String?          // NEW: for barcode generation
  bankAccount     String?          // NEW: for barcode & payment reference

  // Fiscal
  fiscalReference String?          // FINA reference when fiscalized

  lines           EInvoiceLine[]
}

model EInvoiceLine {
  // ... existing fields
}

model Contact {
  id          String
  companyId   String
  oib         String
  name        String
  // ... other fields
}
```

---

## Phase 1 Missing Features (PRIORITY ORDER)

### 1️⃣ 2D BARCODE PAYMENT (ISO 20022 + Croatian Standard)
**Status:** ❌ NOT IMPLEMENTED
**Business Impact:** BLOCKING for accountant reconciliation & payment tracking
**User Story:** "As a business owner, I want to generate a 2D barcode on printed invoices so customers can scan & pay in their banking app"

#### Technical Requirements
- **Standard:** ISO 20022 + Croatian banking standard (HRB - Hrvatske Raiffeisen Banke convention)
- **Format:** QR Code containing:
  - Creditor (seller) IBAN & name
  - Debtor (buyer) reference
  - Amount (net or gross - define with PO team)
  - Invoice number & date
  - Payment deadline
- **Display:** Invoice PDF footer (after invoice total, before seller signature block)
- **Library:** `qrcode.react` (already in dependencies) or `zxing-js`

#### Implementation Scope
1. **Database:** Add optional fields to `EInvoice`:
   ```prisma
   bankAccount     String?  // IBAN for barcode generation
   includeBarcode  Boolean  @default(true)
   ```

2. **Backend:** Create utility function `generateISO20022Barcode()` in `src/lib/barcode.ts`
   - Input: EInvoice record + Company IBAN
   - Output: QR code SVG/PNG string
   - Spec: ISO 20022 XML format → encoded as QR
   - Test: Validate with banking app (mBanking, Erste, etc.)

3. **Invoice Form:** Add optional IBAN input with:
   - Validation: Croatian IBAN format check (`^HR\d{2}\d{17}$`)
   - Default to company bank account from settings
   - Optional toggle: "Include barcode on invoice?"

4. **PDF Template:** Inject barcode image into invoice PDF footer
   - Location: Bottom-right, 40x40mm QR box
   - Include human-readable text: "Plaćanje QR kodom"
   - Fallback message if IBAN missing

#### Acceptance Criteria
- [ ] QR barcode renders on invoice PDF
- [ ] Barcode contains valid ISO 20022 data
- [ ] Tested with: mBanking, Erste banka, Raiffeisenbank mobile apps
- [ ] IBAN validation prevents invalid codes
- [ ] Can disable barcode per invoice

---

### 2️⃣ REAL FISCALIZATION INTEGRATION (FINA e-Račun)
**Status:** ⏳ PARTIAL (mock working, real pending)
**Business Impact:** REGULATORY - e-invoicing mandatory B2B Jan 2026
**User Story:** "As a business owner, I want invoices automatically submitted to FINA so I'm compliant with Croatian e-invoicing law"

#### Technical Requirements
- **Provider:** FINA Servis eRačun za državu (government e-invoicing service)
- **Integration Method:** PEPPOL BIS 3.0 + AS4 protocol (via certified service provider)
- **Current Code:** Mock provider in `src/lib/e-invoice/providers/mock-fiscal.ts`
- **Production Provider:** TBD - waiting on credentials (OAuth token from FINA)

#### Implementation Scope
1. **Credentials:** Obtain from FINA
   - Service provider API key
   - Company digital certificate or OAuth token
   - Test environment credentials first
   - Add to `.env.local`:
     ```
     FINA_API_KEY=...
     FINA_API_URL=https://test.servis-eracun.mfin.hr
     FINA_PROVIDER_ID=...
     ```

2. **Replace Mock Provider:** Update `src/lib/e-invoice/providers/index.ts`
   ```typescript
   // FROM:
   import { MockFiscalProvider } from "./mock-fiscal"
   // TO:
   import { FINAFiscalProvider } from "./fina-fiscal"

   export const FISCAL_PROVIDER = new FINAFiscalProvider()
   ```

3. **Create FINA Provider:** `src/lib/e-invoice/providers/fina-fiscal.ts` (~200-300 lines)
   ```typescript
   interface FINAFiscalProvider extends FiscalProvider {
     fiscalize(invoice: EInvoice): Promise<FiscalizeResult>
     // Returns: { success: true, fiscalRef: "..." }
   }
   ```
   - Convert EInvoice → UBL 2.1 XML (EN 16931 format)
   - Submit via AS4 protocol to FINA test environment
   - Parse response, extract fiscal reference
   - Log audit trail in `AuditLog` table
   - Handle errors: network, validation, duplicate submission

4. **Testing:**
   - Test environment: Use test credentials, submit dummy invoices
   - Validation: Verify response includes fiscal reference in format `FINA-XXXXXXXXX`
   - Error scenarios: Retry logic, timeout handling (30s max)

#### Acceptance Criteria
- [ ] Invoices submit successfully to FINA test environment
- [ ] Fiscal reference stored in `EInvoice.fiscalReference`
- [ ] Status updates to "FISCALIZED" after successful submission
- [ ] Error handling + retry logic (3 retries, 5s exponential backoff)
- [ ] Audit log records all submissions & responses
- [ ] Manual "Retry Fiscalization" button for failed invoices

---

### 3️⃣ BANK STATEMENT UPLOAD & RECONCILIATION
**Status:** ⏳ PARTIAL (structure exists, reconciliation missing)
**Business Impact:** COMPLIANCE - enables cash-basis tax accounting
**User Story:** "As an accountant, I want to upload monthly bank statements so I can reconcile payments against invoices for tax reporting"

#### Technical Requirements
- **File Format:** CSV (preferred) or PDF (via OCR to CSV)
- **Purpose:** Match `paidAt` dates with actual bank transfers for tax compliance
- **Current Code:** `src/app/(dashboard)/banking/import/` structure exists
- **Missing:** Transaction→Invoice matching logic, reconciliation UI

#### Implementation Scope

1. **CSV Parser:** `src/lib/banking/csv-parser.ts` (~100-150 lines)
   ```typescript
   interface ParsedTransaction {
     date: Date              // Transaction date
     reference: string       // Payment reference (invoice #)
     amount: Decimal        // Amount in HRK/EUR
     description: string    // Counterparty name
     type: "debit" | "credit"
   }

   export function parseCSV(content: string): ParsedTransaction[]
   ```
   - Support multiple bank formats (Erste, Raiffeisenbank, moja banka)
   - Extract: date, reference, amount, counterparty
   - Validate: date format, numeric amounts
   - Handle: Multiple currencies, transaction fees

2. **Reconciliation Engine:** `src/lib/banking/reconciliation.ts` (~200 lines)
   ```typescript
   export function matchTransactionsToInvoices(
     transactions: ParsedTransaction[],
     invoices: EInvoice[]
   ): ReconciliationResult[]

   interface ReconciliationResult {
     invoiceId: string
     transactionId: string
     status: "matched" | "partial" | "unmatched"
     confidenceScore: 0-100  // Based on amount & date proximity
   }
   ```
   - Match logic: Invoice # in reference → exact match
   - Fallback: Amount + date within 3 days → probable match
   - Handle: Multiple invoices same day, rounding differences

3. **Upload UI:** Update `src/app/(dashboard)/banking/import/import-form.tsx`
   - CSV file picker
   - Preview table: date, reference, amount, description (first 10 rows)
   - Bank selector dropdown (Erste, Raiffeisenbank, moja banka, other)
   - Submit → parse & match

4. **Reconciliation Dashboard:** New page `src/app/(dashboard)/banking/reconciliation/page.tsx`
   - Table: Invoice # | Customer | Amount | Status (Matched/Pending/Unmatched)
   - Filters: Date range, status, customer
   - Action: Manual override for unmatched transactions
   - Button: "Mark as Reconciled" → updates `invoices.paidAt`

5. **Database Updates:**
   ```prisma
   model BankTransaction {
     id          String        @id @default(cuid())
     companyId   String
     date        DateTime
     reference   String        // Invoice reference
     amount      Decimal
     description String
     currency    String        @default("HRK")

     // Reconciliation
     matchedInvoiceId String?   // Foreign key to EInvoice
     matchStatus      String    @default("UNMATCHED")  // MATCHED | PARTIAL | UNMATCHED
     confidenceScore  Int       // 0-100

     createdAt   DateTime      @default(now())
   }

   model BankImport {
     id        String        @id @default(cuid())
     companyId String
     fileName  String
     bankName  String
     uploadedAt DateTime     @default(now())

     transactions BankTransaction[]
   }
   ```

#### Acceptance Criteria
- [ ] CSV upload parses correctly (10+ test files)
- [ ] Transactions matched to invoices with 80%+ accuracy
- [ ] Unmatched transactions identified for manual review
- [ ] User can confirm/override matches
- [ ] `paidAt` updates when marked as reconciled
- [ ] Dashboard shows reconciliation summary (matched %, unmatched count)

---

## Implementation Plan (Design Team Responsibilities)

### Deliverables by Feature

#### 1. 2D Barcode Payment
| Task | Assignee | Timeline | Notes |
|------|----------|----------|-------|
| Design barcode placement on invoice PDF | Designer | Week 1 | 40x40mm QR, footerposition, labeling |
| Create `src/lib/barcode.ts` utility | Backend | Week 1 | ISO 20022 encoding, test with banking apps |
| Add IBAN input to invoice form | Frontend | Week 2 | Validation, optional field, default from company settings |
| Integrate barcode into PDF template | Frontend | Week 2 | Inject SVG/PNG into invoice PDF, fallback if IBAN missing |
| Test with banking apps | QA | Week 2-3 | mBanking, Erste, Raiffeisenbank mobile |
| **Deadline** | **All** | **End of Week 3** | Feature complete & tested |

#### 2. FINA Fiscalization
| Task | Assignee | Timeline | Notes |
|------|----------|----------|-------|
| Obtain FINA test credentials | Product | Week 1 | Contact FINA, setup test account |
| Design UBL 2.1 invoice conversion | Architect | Week 1 | Map EInvoice → EN 16931 XML structure |
| Create `src/lib/e-invoice/providers/fina-fiscal.ts` | Backend | Week 2-3 | XML generation, AS4 submission, response parsing |
| Add error handling & retry logic | Backend | Week 3 | 3 retries, exponential backoff, audit logging |
| Create "Retry Fiscalization" admin UI | Frontend | Week 3 | Manual resubmission for failed invoices |
| Test with FINA test environment | QA | Week 3-4 | Verify fiscal references, error scenarios |
| Switch to production credentials | DevOps | Week 4 | Update env vars, monitor first submissions |
| **Deadline** | **All** | **End of Week 4** | Live with FINA, credentials obtained |

#### 3. Bank Statement Reconciliation
| Task | Assignee | Timeline | Notes |
|------|----------|----------|-------|
| Design reconciliation dashboard wireframes | Designer | Week 1 | Matched %, unmatched list, action buttons |
| Create `src/lib/banking/csv-parser.ts` | Backend | Week 2 | Multi-bank format support, validation |
| Create `src/lib/banking/reconciliation.ts` | Backend | Week 2 | Matching algorithm, confidence scoring |
| Build upload UI + preview | Frontend | Week 2 | File picker, bank selector, preview table |
| Build reconciliation dashboard | Frontend | Week 3 | Status filters, manual override, mark reconciled |
| Add `BankTransaction` & `BankImport` DB models | Backend | Week 1 | Schema with relationships to EInvoice |
| Test with real bank CSVs (10+ formats) | QA | Week 3-4 | Erste, Raiffeisenbank, moja banka, etc. |
| **Deadline** | **All** | **End of Week 4** | MVP reconciliation complete |

---

## API Endpoints & Server Actions

### 2D Barcode Payment
```typescript
// src/lib/barcode.ts
export function generateISO20022Barcode(invoice: EInvoice, iban: string): string
// Returns: SVG string of QR code
// Throws: InvalidIBANError, InvalidInvoiceError
```

### FINA Fiscalization
```typescript
// src/app/actions/fiscalize.ts (UPDATE EXISTING)
export async function fiscalizeInvoice(invoiceId: string): Promise<FiscalizeResult>
// Returns: { success: true, fiscalRef: "FINA-..." } or { success: false, error: "..." }
// Side effect: Updates EInvoice.status → "FISCALIZED", stores fiscalRef
```

### Bank Import
```typescript
// src/app/(dashboard)/banking/import/actions.ts (NEW)
export async function importBankStatement(
  file: File,
  bankName: string
): Promise<{ importId: string; matchedCount: number; unmatchedCount: number }>

export async function reconcileTransaction(
  transactionId: string,
  invoiceId: string,
  confirmed: boolean = true
): Promise<void>
// Side effect: Updates BankTransaction.matchedInvoiceId, EInvoice.paidAt
```

---

## Data Model Changes

### EInvoice Table (ADD COLUMNS)
```sql
ALTER TABLE "EInvoice" ADD COLUMN "bankAccount" VARCHAR(34);
ALTER TABLE "EInvoice" ADD COLUMN "includeBarcode" BOOLEAN DEFAULT true;
-- bankAccount: IBAN for barcode generation (optional)
-- includeBarcode: Toggle barcode on/off per invoice
```

### New Tables (CREATE)
```sql
CREATE TABLE "BankTransaction" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "date" TIMESTAMP NOT NULL,
  "reference" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "description" TEXT,
  "currency" VARCHAR(3) DEFAULT 'HRK',
  "matchedInvoiceId" TEXT,
  "matchStatus" VARCHAR(20) DEFAULT 'UNMATCHED',
  "confidenceScore" INTEGER,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("companyId") REFERENCES "Company"(id),
  FOREIGN KEY ("matchedInvoiceId") REFERENCES "EInvoice"(id)
);

CREATE TABLE "BankImport" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "bankName" VARCHAR(50),
  "uploadedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("companyId") REFERENCES "Company"(id)
);
```

---

## Testing & Acceptance Criteria

### 2D Barcode
- [ ] QR decodes correctly in 5+ mobile banking apps
- [ ] Contains valid ISO 20022 XML structure
- [ ] Handles edge cases: special characters in company name, decimal amounts
- [ ] IBAN validation prevents invalid codes
- [ ] PDF rendering matches wireframes (size, position, label)
- [ ] Optional IBAN input works (shows "N/A" if missing)

### FINA Fiscalization
- [ ] Submits 10 test invoices to FINA test environment successfully
- [ ] Fiscal references stored correctly in database
- [ ] Status updates to "FISCALIZED" after submission
- [ ] Error handling: network timeout, duplicate submission, validation error
- [ ] Retry button works (re-submits failed invoice)
- [ ] Audit log records all attempts with timestamps & responses

### Bank Reconciliation
- [ ] Parses CSV from 5+ Croatian banks (Erste, Raiffeisenbank, moja banka, Splits, OTP)
- [ ] Matches 80%+ of transactions to invoices (test with 50+ transaction file)
- [ ] Unmatched transactions clearly identified with reason
- [ ] User can override matches manually
- [ ] Marked-as-reconciled invoices update `paidAt` date
- [ ] Dashboard summary accurate (matched %, counts)

---

## Design System & Components

### No New Components Required
All features use existing design patterns:
- **Invoice Form**: Extend existing form (add IBAN field)
- **PDF Template**: Use existing template structure (add barcode SVG)
- **Upload UI**: Use existing file input + preview table
- **Dashboard**: Use existing table component with filters

### Styling Standards
- Follow existing Tailwind config (`tailwind.config.ts`)
- Use existing color palette (no new colors)
- Maintain spacing: `gap-4`, `p-4` throughout
- Mobile responsive: All new UIs must work on 375px width

---

## Blockers & Dependencies

### External Dependencies
- **FINA Credentials**: Waiting for OAuth token (Product team owns this)
- **Banking App Testing**: Requires physical devices or emulators (mBanking APK, Erste app)
- **ISO 20022 Spec**: Public standard, reference available

### Technical Dependencies
1. **Barcode** depends on: Nothing (uses `qrcode.react`)
2. **Fiscalization** depends on: FINA credentials (Product)
3. **Reconciliation** depends on: Nothing (standalone feature)

**Recommended parallel tracks:**
- Barcode: Start immediately (no blockers)
- Reconciliation: Start immediately (no blockers)
- Fiscalization: Start with mock, swap credentials when available

---

## Success Metrics

### Launch Readiness
- ✅ 2D barcode on 100% of invoices
- ✅ Real FINA fiscalization (0 manual submissions)
- ✅ 90%+ automatic payment reconciliation
- ✅ <1% reconciliation errors

### User Adoption
- No support tickets about missing payment barcodes
- Accountant time for payment matching <5 min/month
- Zero FINA compliance rejections

---

## Questions for Design Team

Before starting, clarify with Product:

1. **2D Barcode:**
   - Include gross amount in barcode or net amount?
   - Default IBAN source: company primary bank account or input per invoice?
   - Should small businesses (no IBAN) get warning on invoice creation?

2. **Fiscalization:**
   - When will FINA credentials be available?
   - Should failed fiscalization block invoice marking as "sent"?
   - Max retry attempts before escalating to manual review?

3. **Reconciliation:**
   - What confidence score threshold (70%? 80%?) triggers automatic matching?
   - Should partial matches (amount ±5%) require manual approval?
   - Should reconciliation affect invoice status (e.g., mark "PAID_VERIFIED")?

---

## Glossary

| Term | Definition |
|------|-----------|
| **Fiskalizacija** | Croatian e-invoicing law requiring government submission of B2G/B2B invoices |
| **FINA** | Croatian Financial Agency (Financijska agencija) - government body managing e-invoicing |
| **PEPPOL** | Pan-European Public Procurement OnLine - e-invoicing network standard |
| **ISO 20022** | International standard for payment/banking messages (used for QR barcodes) |
| **UBL** | Universal Business Language - XML format for business documents (EN 16931 compliance) |
| **Paušalni** | Lump-sum taxation system for Croatian self-employed (annual threshold ~40k €) |
| **OIB** | Osobni ID broj - Croatian tax ID (9 digits) |
| **2D Barcode** | QR code containing payment instructions for mobile banking apps |

---

## Appendix: Reference Files

- Invoice Form: `src/app/(dashboard)/e-invoices/new/invoice-form.tsx`
- Invoice PDF: `src/lib/pdf/invoice-template.tsx`
- Invoice Model: `prisma/schema.prisma` (EInvoice, EInvoiceLine)
- Mock Fiscal: `src/lib/e-invoice/providers/mock-fiscal.ts`
- Banking Module: `src/app/(dashboard)/banking/` (structure exists)
- Existing Barcode Lib: `qrcode.react` (already installed)

---

**Document Version:** 1.0
**Last Updated:** 2025-12-13
**Owner:** Product Team (Mislav)
**Target Audience:** Frontend, Backend, QA Design Team