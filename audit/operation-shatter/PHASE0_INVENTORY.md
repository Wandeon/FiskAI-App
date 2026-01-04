# Operation Shatter — Phase 0 Baseline Inventory

This inventory lists the concrete surfaces (internal entrypoints and/or HTTP routes) that the automated runner will exercise for OPERATION SHATTER, plus the main persisted entities involved.

## Correlation IDs

The runner will execute each scenario under a single correlationId:

- `SHATTER-S1`
- `SHATTER-S2`
- `SHATTER-S3`
- `SHATTER-S4`

AuditLog correlationId is stored in `AuditLog.changes.correlationId` via the Prisma extension (`src/lib/prisma-extensions.ts`).

---

## Invoice Create / Issue / Fiscalize

**Runner entrypoints**

- Create invoice record + deterministic VAT totals:
  - `buildVatLineTotals(...)` in `src/lib/vat/output-calculator.ts`
  - `getNextInvoiceNumber(...)` in `src/lib/invoice-numbering.ts`
  - `db.eInvoice.create(...)` in the runner (Prisma client, same codepath as server actions)
- Fiscalize (mock success allowed via demo mode):
  - `fiscalizePosSale(...)` in `src/lib/fiscal/pos-fiscalize.ts`
  - (Underlying execution for real cert flow) `executeFiscalRequest(...)` in `src/lib/fiscal/fiscal-pipeline.ts`
- Generate deterministic invoice PDF artifact (checksum + metadata):
  - `generateInvoicePdfArtifact(...)` in `src/lib/pdf/generate-invoice-pdf-artifact.ts`
  - Route (optional): `GET /api/invoices/[id]/pdf` in `src/app/api/invoices/[id]/pdf/route.ts`

**Main DB tables (Prisma models)**

- `EInvoice`, `EInvoiceLineItem` (invoice + lines)
- `Contact`, `Organization` (buyer + buyerOrganization)
- `InvoiceNumberSequence` / numbering tables (via `getNextInvoiceNumber`)
- Fiscalization: `FiscalRequest`, `FiscalResponse`, `FiscalCertificate`, `BusinessPremises`, `PaymentDevice`
- Artifacts: `Artifact` (invoice PDF)
- Audit: `AuditLog`

**Required inputs**

- Company: `companyId`, `oib`, fiscal setup (`premisesCode`, `deviceCode`) for POS fiscalization
- Buyer contact: `buyerId` (+ buyer VAT id for reverse-charge scenario)
- Invoice fields: `type`, `issueDate`, `currency`
- Lines: `{ description, quantity, unit, unitPrice, vatCategory/vatRate }`

---

## Credit Note (Storno)

**Runner entrypoints**

- Create credit note record (new outbound `EInvoice` with negative totals, linked to original):
  - `db.eInvoice.create(...)` (runner)
  - Line totals reuse: `buildVatLineTotals(...)` in `src/lib/vat/output-calculator.ts`

**Main DB tables**

- `EInvoice` (new credit note row)
- `EInvoiceLineItem` (negative line rows)
- Linkage: `EInvoice.correctsInvoiceId`
- Audit: `AuditLog`

**Required inputs**

- Original invoice id (must exist)
- Reason / note

---

## Expense Ingest + Asset Candidate Emit

**Runner entrypoints**

- Create expense record + URA VAT input rows:
  - `db.expense.create(...)` + `db.expenseLine.create(...)` (runner)
  - VAT input evaluation (if used): `evaluateVatInputRules(...)` in `src/lib/vat/input-rules.ts`
- Emit fixed asset candidates from expense lines:
  - `emitAssetCandidates(...)` in `src/lib/fixed-assets/asset-candidates.ts`

**Main DB tables**

- `Expense`, `ExpenseLine`
- `Contact` (vendor), `ExpenseCategory`
- VAT inputs: `UraInput`
- Asset pipeline: `FixedAssetCandidate`
- Attachments: `Attachment` (optional receipt)
- Audit: `AuditLog`

**Required inputs**

- Vendor name (and optionally VAT/OIB)
- Expense date, currency
- Amounts: net/vat/total (stored as Decimal)
- Category (or leave uncategorized for runner-created category)

---

## Asset Convert (Expense → Fixed Asset)

**Runner entrypoints**

- Convert candidate to fixed asset + depreciation schedule:
  - `convertFixedAssetCandidateToAsset(...)` in `src/lib/fixed-assets/conversion.ts`
  - `persistDepreciationSchedule(...)` in `src/lib/assets/depreciation.ts`

**Main DB tables**

- `FixedAssetCandidate` (status update + link)
- `FixedAsset` (created)
- `DepreciationSchedule` (created)
- Audit: `AuditLog`

**Required inputs**

- `fixedAssetCandidateId`
- Depreciation method + useful life months

---

## Month Close / Depreciation Post + Period Lock

**Runner entrypoints**

- Close month and post depreciation, then lock the period:
  - `runMonthClose(...)` in `src/lib/month-close/service.ts`
  - `createAccountingPeriod(...)`, `lockAccountingPeriod(...)` in `src/lib/period-locking/service.ts`
  - `postDepreciationEntriesForPeriod(...)` in `src/lib/assets/depreciation.ts`

**Main DB tables**

- `AccountingPeriod` (created/locked)
- `DepreciationEntry` (posted)
- GL (if enabled): `JournalEntry`, `JournalLine` (via GL posting paths)
- Audit: `AuditLog`

**Required inputs**

- `companyId`, `forMonth`
- `actorId`, `reason`
- Depreciation debit/credit account ids

---

## Bank Import + Matcher

**Runner entrypoints**

- Import layer (parser may be mocked, but transactions must be created by import code):
  - `processNextImportJob(...)` in `src/lib/banking/import/processor.ts` (XML/PDF paths)
  - Runner will use a parsed-transaction import helper in `src/lib/banking/import/...` (added in Phase 1 if missing)
- Matching:
  - `runAutoMatchTransactions(...)` in `src/lib/banking/reconciliation-service.ts`

**Main DB tables**

- Bank import: `ImportJob`, `StatementImport`, `Statement`, `StatementPage`
- Transactions: `BankTransaction`
- Matching: `MatchRecord`
- Overpayment: `UnappliedPayment`
- Invoice payment fields: `EInvoice.paidAmount`, `EInvoice.paymentStatus`
- Bank fee expense (auto-created): `Expense`, `ExpenseLine`
- Audit: `AuditLog`

**Required inputs**

- Bank account id + company id
- Parsed transactions: `{ date, description, amount, reference? }` (amount as Decimal/string)
- Matching configuration (thresholds via reconciliation service defaults)

---

## Payroll Payout Create / Lock / Report

**Runner entrypoints**

- Create payout + line(s):
  - `createPayout(...)` in `src/lib/payroll/payout-create.ts`
- Lock/report:
  - `lockPayout(...)` and `reportPayout(...)` in `src/lib/payroll/payout-service.ts`
- Calculations snapshot (rule versions + computed components) will be written by a runner helper added in Phase 1 if needed.

**Main DB tables**

- `Payout`, `PayoutLine`
- `CalculationSnapshot`
- Audit: `AuditLog`

**Required inputs**

- Period (`periodYear`, `periodMonth`, `periodFrom`, `periodTo`)
- Recipient: name + OIB
- Amounts (Decimal) and `joppdData` fields used by generator (`mio1`, `mio2`, `hzzo`)

---

## JOPPD Generate / Sign / Submit

**Runner entrypoints**

- Generate + sign + persist submission:
  - `prepareJoppdSubmission(...)` in `src/lib/joppd/joppd-service.ts`
  - `generateJoppdXml(...)` in `src/lib/joppd/joppd-generator.ts`
  - `signJoppdXml(...)` in `src/lib/joppd/joppd-signer.ts` (mock FINA signing allowed)
  - Submit status transitions:
    - `markJoppdSubmitted(...)`, `markJoppdAccepted(...)`, `markJoppdRejected(...)` in `src/lib/joppd/joppd-service.ts`
- Artifact hardening (checksum + generator metadata) will be added in Phase 1 if missing.

**Main DB tables**

- `JoppdSubmission`, `JoppdSubmissionLine`, `JoppdSubmissionEvent`
- Storage: `JoppdSubmission.signedXmlStorageKey`, `JoppdSubmission.signedXmlHash`
- Rule pinning: `RuleVersion` via `getEffectiveRuleVersion(...)` in `src/lib/fiscal-rules/service.ts`
- Artifacts: `Artifact` (added in Phase 1 for audit-grade evidence)
- Audit: `AuditLog`

**Required inputs**

- `companyId`, `payoutId`
- Signing credentials (mocked)
- Retention years

---

## VAT (PDV) Report Generation

**Runner entrypoints**

- Build PDV form data + XML:
  - `generatePdvFormForPeriod(...)` and `generatePdvXml(...)` in `src/lib/reports/pdv-xml-generator.ts`
- Artifact persistence (checksum + generator metadata) will be added in Phase 1 if missing.

**Main DB tables**

- Input VAT register: `UraInput`
- Output VAT evidence: `EInvoice` / `EInvoiceLineItem` (IRA rows are derived, not persisted)
- Artifact: `Artifact` (PDV XML)
- Audit: `AuditLog`

**Required inputs**

- `companyId`
- Period start/end dates
