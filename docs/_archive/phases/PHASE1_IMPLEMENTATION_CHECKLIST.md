# Phase 1 MVP Implementation Checklist

## Quick Reference for Design Team

### 📋 Feature Status Overview

```
2D Barcode Payment:      ❌ 0% → ✅ 100% (Week 1-3)
FINA Fiscalization:       ⏳ 5% → ✅ 100% (Week 1-4) [blocked on credentials]
Bank Reconciliation:      ⏳ 10% → ✅ 100% (Week 1-4)
```

---

## 🎯 Feature 1: 2D Barcode Payment (ISO 20022)

### Database Changes

- [ ] Add `bankAccount VARCHAR(34)` to `EInvoice` table
- [ ] Add `includeBarcode BOOLEAN DEFAULT true` to `EInvoice` table
- [ ] Migration: `npx prisma migrate dev --name add_barcode_fields`

### Backend Implementation

- [ ] Create `src/lib/barcode.ts` (~80-120 lines)
  - [ ] Function: `generateISO20022Barcode(invoice: EInvoice, iban: string): string`
  - [ ] IBAN validation: Regex pattern `^HR\d{2}\d{17}$`
  - [ ] ISO 20022 XML structure (format reference: ISO 20022 spec)
  - [ ] QR encoding library: Use `qrcode.react`
  - [ ] Error handling: InvalidIBANError, InvalidInvoiceError
  - [ ] Unit tests: 10+ test cases (valid IBAN, invalid format, special chars)
  - [ ] Integration test: Verify QR decodes correctly

### Frontend Implementation

- [ ] Update `src/app/(dashboard)/e-invoices/new/invoice-form.tsx`
  - [ ] Add IBAN input field to "Seller Info" step
  - [ ] Default value from company settings (bank account)
  - [ ] Optional field (allow blank for businesses without IBAN)
  - [ ] Real-time IBAN validation feedback
  - [ ] Toggle: "Include barcode on invoice?" checkbox

- [ ] Update `src/lib/pdf/invoice-template.tsx`
  - [ ] Add barcode component to PDF footer
  - [ ] Position: Bottom-right, 40x40mm
  - [ ] Display logic: Only if IBAN provided & includeBarcode = true
  - [ ] Fallback text if no IBAN: "Nema QR koda - plaćanje po uputama"
  - [ ] Label above barcode: "Plaćanje QR kodom"
  - [ ] Responsive sizing for different paper sizes

### Testing Checklist

- [ ] ✅ QR code renders in browser (test with online QR decoder)
- [ ] ✅ QR code contains valid ISO 20022 structure
- [ ] ✅ QR code decodes in: mBanking, Erste, Raiffeisenbank, OTP, Splitska banka mobile apps
- [ ] ✅ PDF includes barcode (generate test PDF, open in Adobe Reader)
- [ ] ✅ IBAN validation: Accept `HR6321000001234567890` format
- [ ] ✅ IBAN validation: Reject invalid formats with clear error
- [ ] ✅ Barcode toggles off (when unchecked, PDF shows fallback text)
- [ ] ✅ Mobile responsiveness: Form works on 375px width

### Deployment Checklist

- [ ] Code review passed (no linting errors)
- [ ] Build succeeds: `npm run build`
- [ ] All tests pass: `npm run test`
- [ ] Database migration applied on VPS: `DATABASE_URL=... npx prisma migrate deploy`
- [ ] Manual test: Create invoice with IBAN, generate PDF, verify barcode in reader app
- [ ] Merged to main branch
- [ ] Deployed via Coolify (manual trigger from git.metrica.hr)

---

## 🔐 Feature 2: FINA Fiscalization Integration

### Prerequisites (PRODUCT TEAM)

- [ ] ⏳ FINA test credentials obtained
- [ ] ⏳ FINA production credentials obtained (after testing)
- [ ] Environment variables configured:
  ```
  FINA_API_KEY=...
  FINA_API_URL=https://test.servis-eracun.mfin.hr  (test) or https://servis-eracun.mfin.hr (prod)
  FINA_PROVIDER_ID=...
  FINA_CERT_PATH=/path/to/cert.pem (if using mTLS)
  ```

### Backend Implementation

- [ ] Create `src/lib/e-invoice/providers/fina-fiscal.ts` (~250-350 lines)
  - [ ] Class: `FINAFiscalProvider implements FiscalProvider`
  - [ ] Method: `async fiscalize(invoice: EInvoice): Promise<FiscalizeResult>`
  - [ ] UBL 2.1 XML generation from EInvoice
    - [ ] Map EInvoice fields → EN 16931 compliant XML
    - [ ] Include seller (Company), buyer (Contact), lines (EInvoiceLine)
    - [ ] Validate: Required fields, amount precision (2 decimals)
    - [ ] Test XML structure against EN 16931 Schematron rules
  - [ ] AS4 submission to FINA
    - [ ] HTTP POST with XML payload
    - [ ] Handle mTLS if required
    - [ ] 30s timeout
  - [ ] Response parsing
    - [ ] Extract fiscal reference (format: `FINA-XXXXXXXXX`)
    - [ ] Detect success/error states
  - [ ] Error scenarios:
    - [ ] Network timeout → Retry (exponential backoff: 5s, 10s, 20s)
    - [ ] Validation error → Log details, mark as failed
    - [ ] Duplicate submission → Handle gracefully (check if already fiscalized)
    - [ ] Rate limiting → Queue and retry later
  - [ ] Logging: All requests/responses to `AuditLog` table
  - [ ] Unit tests: Mock FINA responses, test XML generation, error cases

- [ ] Update `src/lib/e-invoice/providers/index.ts`
  - [ ] Replace mock provider with FINA provider (when credentials available)
  - [ ] Feature flag (optional): `FINA_ENABLED` env var to toggle mock/real

- [ ] Update `src/app/actions/fiscalize.ts` (if needed)
  - [ ] Ensure retry logic in place
  - [ ] Handle "already fiscalized" case (idempotent)
  - [ ] Log to AuditLog with full response

### Frontend Implementation

- [ ] Create admin UI: `src/app/admin/fiscalization/page.tsx` (or extend `/admin`)
  - [ ] Table: List of failed fiscalizations
  - [ ] Columns: Invoice #, Error message, Last attempt, Actions
  - [ ] Button: "Retry Fiscalization" → calls action to resubmit
  - [ ] Feedback: Success toast "Fiscalized! Ref: FINA-..."
  - [ ] Feedback: Error toast with reason

- [ ] Update invoice detail page: `src/app/(dashboard)/e-invoices/[id]/page.tsx`
  - [ ] Show fiscal reference when available
  - [ ] Show status: "FISCALIZED ✓" or "Failed - Retry" button if error
  - [ ] Timeline entry: "Submitted to FINA: [date]"

### Testing Checklist

- [ ] ✅ Submit 10 test invoices to FINA test environment
- [ ] ✅ Fiscal references generated correctly (matches expected format)
- [ ] ✅ Fiscal references stored in database
- [ ] ✅ Invoice status updates to "FISCALIZED" after successful submission
- [ ] ✅ Failed submission: Error message logged, status stays "DRAFT"
- [ ] ✅ Retry button: Re-submits failed invoice, succeeds on second attempt
- [ ] ✅ Duplicate check: Resubmitting same invoice doesn't create duplicate in FINA
- [ ] ✅ Network timeout: Retries with exponential backoff, succeeds after timeout recovery
- [ ] ✅ Validation error: Clear error message shown to user
- [ ] ✅ AuditLog: All submissions recorded with request/response

### Deployment Checklist

- [ ] Test with FINA test environment (nonprod credentials)
- [ ] Code review passed
- [ ] Build succeeds: `npm run build`
- [ ] All tests pass: `npm run test`
- [ ] Environment vars configured on VPS: `.env.local` + restart Coolify deploy
- [ ] Manual test: Create invoice, click "Fiscalize", verify FINA submission succeeds
- [ ] Monitor first 50 production submissions for errors
- [ ] If any failures: Debug & retry before switching to production credentials
- [ ] Update env vars to production FINA endpoint
- [ ] Merged to main branch
- [ ] Deployed via Coolify

---

## 🏦 Feature 3: Bank Statement Reconciliation

### Database Changes

- [ ] Create `BankTransaction` table
  ```sql
  CREATE TABLE "BankTransaction" (
    "id" TEXT PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "date" TIMESTAMP NOT NULL,
    "reference" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "currency" VARCHAR(3) DEFAULT 'HRK',
    "matchedInvoiceId" TEXT,
    "matchStatus" VARCHAR(20) DEFAULT 'UNMATCHED',
    "confidenceScore" INTEGER,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  ```
- [ ] Create `BankImport` table
  ```sql
  CREATE TABLE "BankImport" (
    "id" TEXT PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "bankName" VARCHAR(50),
    "uploadedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  ```
- [ ] Add foreign keys to `EInvoice`
  - [ ] `EInvoice.reconciledTransactionId` (optional, for tracking which bank transaction paid the invoice)
- [ ] Migration: `npx prisma migrate dev --name add_bank_tables`

### Backend Implementation

#### CSV Parser: `src/lib/banking/csv-parser.ts` (~150-200 lines)

- [ ] Function: `parseCSV(content: string, bankName: string): ParsedTransaction[]`
- [ ] Support banks:
  - [ ] Erste banka (format: `Date,Description,Debit,Credit`)
  - [ ] Raiffeisenbank (format: similar)
  - [ ] moja banka (format: `Date,Reference,Amount,Balance`)
  - [ ] Splitska banka
  - [ ] OTP banka
  - [ ] Generic fallback (4-column CSV)
- [ ] Data cleaning:
  - [ ] Date parsing (handle DD.MM.YYYY, YYYY-MM-DD, etc.)
  - [ ] Amount parsing (handle commas, decimals)
  - [ ] Reference extraction (invoice number from description)
- [ ] Validation:
  - [ ] Reject rows with invalid dates
  - [ ] Reject rows with non-numeric amounts
  - [ ] Warn on missing reference (show row, let user decide)
- [ ] Unit tests: 10+ CSV samples from different banks

#### Reconciliation Engine: `src/lib/banking/reconciliation.ts` (~200-250 lines)

- [ ] Function: `matchTransactionsToInvoices(transactions: ParsedTransaction[], invoices: EInvoice[]): ReconciliationResult[]`
- [ ] Matching algorithm:
  - [ ] **Exact match:** Invoice number found in transaction reference (confidence: 100)
  - [ ] **Amount + Date match:** Amount matches invoice gross, date within 3 days (confidence: 85)
  - [ ] **Partial amount:** Amount within ±5% of gross, date within 5 days (confidence: 70)
  - [ ] **No match:** (confidence: 0)
- [ ] Special cases:
  - [ ] Multiple invoices same amount, same day → list as potential matches (confidence: 50 each)
  - [ ] Rounding differences (e.g., 1,234.56 vs 1,234.57) → still match
  - [ ] Currency conversion (if invoice in EUR, transaction in HRK) → apply conversion rate
- [ ] Return structure:
  ```typescript
  interface ReconciliationResult {
    transactionId: string
    matchedInvoiceId: string | null
    matchStatus: "matched" | "partial" | "unmatched"
    confidenceScore: number // 0-100
    reason: string // "Exact reference match" | "Amount within 3 days" | "No match found"
  }
  ```
- [ ] Unit tests: 30+ scenarios (exact match, partial, ambiguous, no match)

#### Upload API: `src/app/(dashboard)/banking/import/actions.ts`

- [ ] Server action: `async importBankStatement(file: File, bankName: string)`
  - [ ] Validate file type (only .csv)
  - [ ] Max file size: 10MB
  - [ ] Read file content
  - [ ] Call CSV parser
  - [ ] Call reconciliation engine (match against company's unpaid invoices)
  - [ ] Save to `BankImport` + `BankTransaction` tables
  - [ ] Return: `{ importId: string, matchedCount: number, unmatchedCount: number, results: ReconciliationResult[] }`
  - [ ] Error handling: File parse error, DB error, duplicate import

- [ ] Server action: `async reconcileTransaction(transactionId: string, invoiceId: string, confirmed: boolean = true)`
  - [ ] Update `BankTransaction.matchedInvoiceId = invoiceId`
  - [ ] Update `BankTransaction.matchStatus = "matched"`
  - [ ] Update `EInvoice.paidAt = BankTransaction.date`
  - [ ] Update `EInvoice.status = "PAID_VERIFIED"` (new status)
  - [ ] Log to `AuditLog`: "Transaction reconciled to Invoice #..."
  - [ ] Error handling: Transaction not found, invoice not found, already reconciled

### Frontend Implementation

#### Upload Form: `src/app/(dashboard)/banking/import/import-form.tsx`

- [ ] File input (drag-drop + click to select)
- [ ] Bank selector dropdown:
  - [ ] Erste banka
  - [ ] Raiffeisenbank
  - [ ] moja banka
  - [ ] Splitska banka
  - [ ] OTP banka
  - [ ] Druga (other - generic CSV)
- [ ] Preview table (first 10 rows):
  - [ ] Columns: Date | Reference | Amount | Description
  - [ ] Styling: Monospace font, alternating row colors
  - [ ] Button: "View all X rows" (if >10 rows)
- [ ] Submit button: "Import Transactions"
- [ ] Loading state: Show spinner, disable form
- [ ] Success state: Toast notification + show matching results
- [ ] Error state: Show file parse error with helpful message

#### Matching Results Display: `src/app/(dashboard)/banking/reconciliation/page.tsx` (NEW PAGE)

- [ ] Header: Summary stats
  - [ ] "X of Y transactions matched" (progress bar)
  - [ ] "Z transactions need review"
- [ ] Filter bar:
  - [ ] Status: All | Matched | Unmatched | Partial
  - [ ] Date range picker
  - [ ] Invoice # search
  - [ ] Amount range slider
- [ ] Results table:
  - [ ] Columns: Date | Reference | Amount | Matched Invoice # | Confidence | Actions
  - [ ] Row styling:
    - [ ] Green background: Matched (confidence 85+)
    - [ ] Yellow background: Partial (confidence 60-85)
    - [ ] Red background: Unmatched (confidence <60)
  - [ ] Actions column:
    - [ ] Matched: "✓ Reconcile" button → confirm & update EInvoice.paidAt
    - [ ] Unmatched: Dropdown to select invoice manually OR "Skip"
    - [ ] Partial: Dropdown to accept match OR select correct invoice OR "Skip"
- [ ] Bulk actions:
  - [ ] "Reconcile all matches (confidence >80%)" button
  - [ ] "Mark all remaining as unmatched" button
- [ ] Pagination: 50 rows per page
- [ ] Sorting: By date (default), amount, status
- [ ] Export: "Export Reconciliation Report" (CSV)

#### Update Banking Dashboard: `src/app/(dashboard)/banking/page.tsx`

- [ ] Add card: "Recent Bank Imports"
  - [ ] List: Last 5 imports with date, bank name, row count
  - [ ] Link: "View detailed reconciliation"
- [ ] Add quick stat: "Outstanding Balance"
  - [ ] Formula: Sum(EInvoice.gross) WHERE status IN ["SENT", "DELIVERED"] AND paidAt IS NULL
  - [ ] Alert if balance > 50k HRK (configurable threshold)

### Testing Checklist

#### CSV Parser

- [ ] ✅ Parse Erste banka CSV (10 rows)
- [ ] ✅ Parse Raiffeisenbank CSV (10 rows)
- [ ] ✅ Parse moja banka CSV (10 rows)
- [ ] ✅ Parse Splitska banka CSV (10 rows)
- [ ] ✅ Parse OTP banka CSV (10 rows)
- [ ] ✅ Handle date formats: DD.MM.YYYY, YYYY-MM-DD, D.M.YYYY
- [ ] ✅ Handle currency symbols: HRK, EUR, $ (strip to numeric)
- [ ] ✅ Reject invalid rows (non-numeric amounts)
- [ ] ✅ Handle empty reference (optional field)

#### Matching Algorithm

- [ ] ✅ Exact match: Invoice # in reference (100 confidence)
- [ ] ✅ Amount + date match: Within 3 days (85 confidence)
- [ ] ✅ Partial match: Within ±5% amount, 5 days (70 confidence)
- [ ] ✅ No match: (0 confidence)
- [ ] ✅ Ambiguous: Multiple invoices same amount → list all (50 confidence each)
- [ ] ✅ Rounding: 1,234.56 matches 1,234.57
- [ ] ✅ Currency: EUR invoice matched to HRK transaction (with conversion rate)
- [ ] ✅ Test with 50+ real transactions (5+ bank formats)

#### Upload Flow

- [ ] ✅ Upload CSV, see preview table
- [ ] ✅ Preview shows first 10 rows correctly
- [ ] ✅ Click "View all X rows" expands to full list
- [ ] ✅ After submit, matching results appear
- [ ] ✅ Progress bar shows matched/unmatched counts
- [ ] ✅ Error: File too large → show error message
- [ ] ✅ Error: Invalid bank format → show helpful error

#### Reconciliation UI

- [ ] ✅ Click "Reconcile" button on matched transaction
- [ ] ✅ Confirm dialog appears
- [ ] ✅ After confirm, EInvoice.paidAt updates (verified in DB)
- [ ] ✅ Invoice detail page shows "Plaćeno" status with date
- [ ] ✅ Manual selection: Click on unmatched row, choose invoice from dropdown
- [ ] ✅ Bulk action: "Reconcile all >80% confidence" → 5+ transactions updated
- [ ] ✅ Filter by status: "Unmatched" filter shows only unmatched rows
- [ ] ✅ Search: Type invoice # → shows matching rows
- [ ] ✅ Sorting: Click "Date" header → sorts ascending/descending

#### Database

- [ ] ✅ BankTransaction rows created correctly
- [ ] ✅ BankImport record created (fileName, bankName stored)
- [ ] ✅ AuditLog entries for each reconciliation action
- [ ] ✅ EInvoice.paidAt updated correctly
- [ ] ✅ Foreign key constraints (matchedInvoiceId → EInvoice.id)

### Deployment Checklist

- [ ] Code review passed (no linting errors)
- [ ] Build succeeds: `npm run build`
- [ ] All tests pass: `npm run test`
- [ ] Database migration applied on VPS: `DATABASE_URL=... npx prisma migrate deploy`
- [ ] Manual test: Upload test CSV (10 rows), verify matching accuracy
- [ ] Manual test: Reconcile matched transaction, verify EInvoice.paidAt updates
- [ ] Manual test: Try all 5+ bank CSV formats
- [ ] Manual test: Filter, search, sort on reconciliation page
- [ ] Merged to main branch
- [ ] Deployed via Coolify

---

## 📊 Integration Testing (All Features Together)

- [ ] Create invoice with IBAN → barcode appears in PDF
- [ ] Create invoice → auto-fiscalize to FINA → fiscal reference stored
- [ ] Invoice marked as "SENT" → upload bank statement → auto-match transaction → mark as reconciled
- [ ] End-to-end flow (A-Z): New invoice → barcode → fiscalize → customer pays → bank upload → reconcile

---

## 🔄 Rollback Procedure (If Deployment Fails)

### Barcode Rollback

1. `git revert [barcode-commit-hash]`
2. `npm run build` (verify)
3. `git push origin main`
4. Trigger Coolify redeploy

### Fiscalization Rollback

1. Disable in code: Comment out FINA provider import, revert to mock
2. Or: Set `FINA_ENABLED=false` env var (if using feature flag)
3. `git revert [fina-commit-hash]`
4. Trigger Coolify redeploy

### Reconciliation Rollback

1. `DROP TABLE BankTransaction, BankImport;`
2. Remove import routes from routing
3. `git revert [reconciliation-commit-hash]`
4. Trigger Coolify redeploy

---

## 📝 Sign-Off

- [ ] Frontend Lead: Code review complete, QA passed
- [ ] Backend Lead: API endpoints tested, DB migrations applied
- [ ] QA Lead: All acceptance criteria met, no critical bugs
- [ ] Product: Features meet requirements, ready for customer use

**Release Date:** \***\*\_\_\*\***
**Released By:** \***\*\_\_\*\***
**Verified By:** \***\*\_\_\*\***
