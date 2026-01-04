# FiskAI - Remaining Modules Design

**Version:** 1.0
**Date:** December 11, 2025
**Status:** Approved

## Overview

This document covers the design for 9 remaining major feature areas to bring FiskAI to full production readiness. Phases 1-7 (audit fixes) have been completed. This covers Phases 8-16.

## Phase Summary

| Phase | Module                         | Priority   | Dependencies  |
| ----- | ------------------------------ | ---------- | ------------- |
| 8     | Audit Logging                  | Foundation | None          |
| 9     | Invoice Numbering & Compliance | High       | None          |
| 10    | General Invoicing              | High       | Phase 9       |
| 11    | Expenses Module                | High       | Phase 8       |
| 12    | Financial Reporting            | Medium     | Phases 10, 11 |
| 13    | Bank Integration               | Medium     | Phases 10, 11 |
| 14    | Mobile Responsiveness          | Medium     | None          |
| 15    | Real E-Invoice Provider        | High       | Phases 8, 9   |
| 16    | AI/OCR Features                | Low        | Phase 11      |

---

## Phase 8: Audit Logging

### Purpose

Track every significant action in the system - who did what, when, and what changed. Critical for Croatian compliance (Fiskalizacija requires audit trails) and debugging.

### Database Schema

```prisma
model AuditLog {
  id          String   @id @default(cuid())
  companyId   String
  userId      String?
  action      AuditAction
  entity      String   // "EInvoice", "Contact", "Product", etc.
  entityId    String
  changes     Json?    // { before: {...}, after: {...} }
  ipAddress   String?
  userAgent   String?
  timestamp   DateTime @default(now())

  company     Company  @relation(fields: [companyId], references: [id])

  @@index([companyId])
  @@index([entity, entityId])
  @@index([timestamp])
}

enum AuditAction {
  CREATE
  UPDATE
  DELETE
  VIEW
  EXPORT
  LOGIN
  LOGOUT
}
```

### Implementation

- Prisma middleware intercepts all write operations automatically
- Server actions call `logAudit()` explicitly for important reads
- Append-only table (no updates/deletes allowed)
- UI: Audit log viewer in Settings for admins

### Key Files

- `prisma/schema.prisma` - Add AuditLog model
- `src/lib/audit.ts` - Logging helper functions
- `src/lib/prisma-audit-middleware.ts` - Auto-capture writes
- `src/app/(dashboard)/settings/audit-log/page.tsx` - View logs

---

## Phase 9: Invoice Numbering & Compliance

### Purpose

Implement automatic invoice numbering per Croatian legal requirements (Fiskalizacija).

### Legal Format (Croatia)

The invoice number must have exactly **3 parts** separated by `-`:

```
{broj}-{poslovni_prostor}-{naplatni_uređaj}
Example: 43-1-1
```

| Part             | Description                                |
| ---------------- | ------------------------------------------ |
| broj             | Sequential number (resets yearly, no gaps) |
| poslovni_prostor | Business premises code (number)            |
| naplatni_uređaj  | Payment device code (number)               |

### Display Format

```
Broj računa: 43-1-1
Interna oznaka: 2025/43-1-1
```

- Legal 3-part number used for fiscalization and ZKI calculation
- Internal reference includes year for accounting purposes

### Database Schema

```prisma
model BusinessPremises {
  id          String   @id @default(cuid())
  companyId   String
  code        Int      // 1, 2, 3...
  name        String   // "Glavni ured"
  address     String?
  isDefault   Boolean  @default(false)
  isActive    Boolean  @default(true)

  company     Company  @relation(fields: [companyId], references: [id])
  devices     PaymentDevice[]
  sequences   InvoiceSequence[]

  @@unique([companyId, code])
  @@index([companyId])
}

model PaymentDevice {
  id                  String   @id @default(cuid())
  companyId           String
  businessPremisesId  String
  code                Int      // 1, 2, 3...
  name                String   // "Blagajna 1"
  isDefault           Boolean  @default(false)
  isActive            Boolean  @default(true)

  company             Company  @relation(fields: [companyId], references: [id])
  businessPremises    BusinessPremises @relation(fields: [businessPremisesId], references: [id])

  @@unique([businessPremisesId, code])
  @@index([companyId])
}

model InvoiceSequence {
  id                  String   @id @default(cuid())
  companyId           String
  businessPremisesId  String
  year                Int      // 2025
  lastNumber          Int      @default(0)

  company             Company  @relation(fields: [companyId], references: [id])
  businessPremises    BusinessPremises @relation(fields: [businessPremisesId], references: [id])

  @@unique([businessPremisesId, year])
  @@index([companyId])
}
```

### Key Files

- `prisma/schema.prisma` - Add 3 new models
- `src/lib/invoice-numbering.ts` - `getNextInvoiceNumber()` with DB locking
- `src/app/(dashboard)/settings/premises/page.tsx` - Manage business premises
- `src/app/actions/e-invoice.ts` - Auto-assign number on create

---

## Phase 10: General Invoicing

### Purpose

Extend beyond e-invoices to support regular invoices, quotes, proforma invoices, and credit notes.

### Document Types

| Type        | Croatian  | Use Case                            |
| ----------- | --------- | ----------------------------------- |
| INVOICE     | Račun     | Standard invoice                    |
| E_INVOICE   | E-Račun   | Electronic invoice (existing)       |
| QUOTE       | Ponuda    | Price quote, convertible to invoice |
| PROFORMA    | Predračun | Payment request before delivery     |
| CREDIT_NOTE | Odobrenje | Refund/correction                   |
| DEBIT_NOTE  | Terećenje | Additional charge                   |

### Database Schema

Generalize existing `EInvoice` into `Invoice`:

```prisma
model Invoice {
  id                String   @id @default(cuid())
  companyId         String
  type              InvoiceType

  // Numbering
  invoiceNumber     String   // "43-1-1" (legal format)
  internalReference String   // "2025/43-1-1"

  // Status
  status            InvoiceStatus

  // Parties
  sellerId          String?
  buyerId           String?

  // Dates
  issueDate         DateTime
  dueDate           DateTime?

  // Amounts
  currency          String   @default("EUR")
  netAmount         Decimal  @db.Decimal(10, 2)
  vatAmount         Decimal  @db.Decimal(10, 2)
  totalAmount       Decimal  @db.Decimal(10, 2)

  // Content
  notes             String?

  // E-Invoice specific (nullable)
  ublXml            String?  @db.Text
  jir               String?
  zki               String?
  fiscalizedAt      DateTime?
  providerRef       String?
  providerStatus    String?
  providerError     String?

  // Relations
  company           Company  @relation(fields: [companyId], references: [id])
  seller            Contact? @relation("InvoiceSeller", fields: [sellerId], references: [id])
  buyer             Contact? @relation("InvoiceBuyer", fields: [buyerId], references: [id])
  lines             InvoiceLine[]

  // Conversion tracking
  convertedFromId   String?  // Quote that became this invoice
  convertedFrom     Invoice? @relation("InvoiceConversion", fields: [convertedFromId], references: [id])
  convertedTo       Invoice[] @relation("InvoiceConversion")

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([companyId, invoiceNumber])
  @@index([companyId])
  @@index([type])
  @@index([status])
}

enum InvoiceType {
  INVOICE
  E_INVOICE
  QUOTE
  PROFORMA
  CREDIT_NOTE
  DEBIT_NOTE
}

enum InvoiceStatus {
  DRAFT
  SENT
  VIEWED
  PAID
  PARTIAL
  OVERDUE
  CANCELLED
  // E-Invoice specific
  PENDING_FISCALIZATION
  FISCALIZED
  DELIVERED
  ACCEPTED
  REJECTED
}
```

### Key Features

- Convert Quote → Invoice with one click
- Convert Invoice → E-Invoice when ready to fiscalize
- PDF generation for all document types
- Separate numbering sequences per document type (optional)

### Key Files

- `prisma/schema.prisma` - Generalized Invoice model
- `src/app/(dashboard)/invoices/page.tsx` - List all invoices
- `src/app/(dashboard)/invoices/new/page.tsx` - Create any document type
- `src/app/(dashboard)/invoices/[id]/page.tsx` - View with actions
- `src/lib/pdf/invoice-generator.ts` - PDF generation
- `src/app/actions/invoice.ts` - CRUD + convert actions

---

## Phase 11: Expenses Module

### Purpose

Track business expenses, categorize for tax purposes, prepare for VAT deductions.

### Database Schema

```prisma
model Expense {
  id              String   @id @default(cuid())
  companyId       String
  vendorId        String?  // FK to Contact
  categoryId      String

  description     String
  date            DateTime
  dueDate         DateTime?

  netAmount       Decimal  @db.Decimal(10, 2)
  vatAmount       Decimal  @db.Decimal(10, 2)
  totalAmount     Decimal  @db.Decimal(10, 2)
  vatDeductible   Boolean  @default(true)
  currency        String   @default("EUR")

  status          ExpenseStatus
  paymentMethod   PaymentMethod?
  paymentDate     DateTime?

  receiptUrl      String?
  notes           String?

  company         Company  @relation(fields: [companyId], references: [id])
  vendor          Contact? @relation(fields: [vendorId], references: [id])
  category        ExpenseCategory @relation(fields: [categoryId], references: [id])

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([companyId])
  @@index([date])
  @@index([status])
}

model ExpenseCategory {
  id                  String   @id @default(cuid())
  companyId           String?  // null = system default
  name                String   // "Uredski materijal"
  code                String   // "OFFICE"
  vatDeductibleDefault Boolean @default(true)
  isActive            Boolean  @default(true)

  company             Company? @relation(fields: [companyId], references: [id])
  expenses            Expense[]

  @@index([companyId])
}

model RecurringExpense {
  id              String   @id @default(cuid())
  companyId       String

  // Template data
  vendorId        String?
  categoryId      String
  description     String
  netAmount       Decimal  @db.Decimal(10, 2)
  vatAmount       Decimal  @db.Decimal(10, 2)
  totalAmount     Decimal  @db.Decimal(10, 2)

  frequency       Frequency
  nextDate        DateTime
  endDate         DateTime?
  isActive        Boolean  @default(true)

  company         Company  @relation(fields: [companyId], references: [id])

  @@index([companyId])
  @@index([nextDate])
}

enum ExpenseStatus {
  DRAFT
  PENDING
  PAID
  CANCELLED
}

enum PaymentMethod {
  CASH
  CARD
  TRANSFER
  OTHER
}

enum Frequency {
  WEEKLY
  MONTHLY
  QUARTERLY
  YEARLY
}
```

### Default Categories (Croatian)

| Code      | Name              | VAT Deductible |
| --------- | ----------------- | -------------- |
| OFFICE    | Uredski materijal | Yes            |
| TRAVEL    | Putni troškovi    | Partial        |
| FUEL      | Gorivo            | 50%            |
| TELECOM   | Telekomunikacije  | Yes            |
| RENT      | Najam             | Yes            |
| UTILITIES | Režije            | Yes            |
| SERVICES  | Usluge            | Yes            |
| OTHER     | Ostalo            | No             |

### Key Files

- `prisma/schema.prisma` - Expense models
- `src/app/(dashboard)/expenses/page.tsx` - List with filters
- `src/app/(dashboard)/expenses/new/page.tsx` - Create with receipt upload
- `src/app/(dashboard)/expenses/categories/page.tsx` - Manage categories
- `src/app/actions/expense.ts` - CRUD actions
- `src/lib/file-upload.ts` - Receipt upload handling

---

## Phase 12: Financial Reporting

### Purpose

Provide actionable financial insights - revenue, expenses, VAT obligations, cash flow.

### Core Reports

| Report                    | Description                      |
| ------------------------- | -------------------------------- |
| Profit & Loss             | Revenue vs Expenses by period    |
| VAT Summary               | PDV obveza - input vs output VAT |
| Revenue by Customer       | Top customers, trends            |
| Expenses by Category      | Spending breakdown               |
| Accounts Receivable Aging | Overdue invoices (30/60/90 days) |
| Accounts Payable Aging    | Unpaid expenses by age           |
| Cash Flow                 | Money in vs out over time        |

### Database Schema

```prisma
model SavedReport {
  id          String   @id @default(cuid())
  companyId   String
  userId      String

  name        String   // "Q4 2025 VAT"
  type        ReportType
  filters     Json     // { dateFrom, dateTo, categories, ... }

  schedule    ReportSchedule @default(NONE)
  emailTo     String[] // Recipients for scheduled reports

  createdAt   DateTime @default(now())
  lastRunAt   DateTime?

  company     Company  @relation(fields: [companyId], references: [id])

  @@index([companyId])
}

enum ReportType {
  VAT_SUMMARY
  PROFIT_LOSS
  REVENUE_BY_CUSTOMER
  EXPENSES_BY_CATEGORY
  RECEIVABLES_AGING
  PAYABLES_AGING
  CASH_FLOW
}

enum ReportSchedule {
  NONE
  WEEKLY
  MONTHLY
  QUARTERLY
}
```

### VAT Summary Structure (PDV Obrazac)

```
Razdoblje: 01.10.2025 - 31.12.2025

IZLAZNI PDV (Output VAT - from invoices)
├── Osnovica 25%:  10,000.00 EUR
├── PDV 25%:        2,500.00 EUR
├── Osnovica 13%:   1,000.00 EUR
├── PDV 13%:          130.00 EUR
└── Ukupno:         2,630.00 EUR

ULAZNI PDV (Input VAT - from expenses)
├── Priznati PDV:   1,200.00 EUR
└── Nepriznati:       150.00 EUR

OBVEZA PDV:         1,430.00 EUR
```

### Key Files

- `src/app/(dashboard)/reports/page.tsx` - Report dashboard
- `src/app/(dashboard)/reports/vat/page.tsx` - VAT summary
- `src/app/(dashboard)/reports/profit-loss/page.tsx` - P&L statement
- `src/app/(dashboard)/reports/aging/page.tsx` - Aging reports
- `src/lib/reports/vat.ts` - VAT calculation logic
- `src/lib/reports/aging.ts` - Aging calculation logic
- `src/lib/reports/export.ts` - Excel/PDF export

---

## Phase 13: Bank Integration

### Purpose

Import bank statements, match transactions to invoices/expenses, reconcile accounts.

### Approach

**Hybrid:** Start with manual CSV/XML import, design for future PSD2 API integration.

### Database Schema

```prisma
model BankAccount {
  id              String   @id @default(cuid())
  companyId       String

  name            String   // "PBZ Poslovni"
  iban            String
  bankName        String   // "Privredna banka Zagreb"
  currency        String   @default("EUR")
  currentBalance  Decimal  @db.Decimal(12, 2)
  lastSyncAt      DateTime?
  isDefault       Boolean  @default(false)

  company         Company  @relation(fields: [companyId], references: [id])
  transactions    BankTransaction[]
  imports         BankImport[]

  @@unique([companyId, iban])
  @@index([companyId])
}

model BankTransaction {
  id                String   @id @default(cuid())
  companyId         String
  bankAccountId     String

  date              DateTime
  description       String
  amount            Decimal  @db.Decimal(12, 2)  // Positive = in, Negative = out
  balance           Decimal  @db.Decimal(12, 2)  // Running balance
  reference         String?  // Bank reference
  counterpartyName  String?
  counterpartyIban  String?

  // Matching
  matchedInvoiceId  String?
  matchedExpenseId  String?
  matchStatus       MatchStatus @default(UNMATCHED)
  matchedAt         DateTime?
  matchedBy         String?

  bankAccount       BankAccount @relation(fields: [bankAccountId], references: [id])
  matchedInvoice    Invoice? @relation(fields: [matchedInvoiceId], references: [id])
  matchedExpense    Expense? @relation(fields: [matchedExpenseId], references: [id])

  @@index([companyId])
  @@index([bankAccountId])
  @@index([matchStatus])
  @@index([date])
}

model BankImport {
  id                String   @id @default(cuid())
  companyId         String
  bankAccountId     String

  fileName          String
  format            ImportFormat
  transactionCount  Int
  importedAt        DateTime @default(now())
  importedBy        String

  bankAccount       BankAccount @relation(fields: [bankAccountId], references: [id])

  @@index([companyId])
}

enum MatchStatus {
  UNMATCHED
  AUTO_MATCHED
  MANUAL_MATCHED
  IGNORED
}

enum ImportFormat {
  CSV
  XML_CAMT053
  MT940
}
```

### Matching Logic

1. Auto-match by invoice number in description
2. Auto-match by exact amount + date range
3. Suggest matches for review
4. Manual matching for remainder

### Key Files

- `src/app/(dashboard)/banking/page.tsx` - Account overview
- `src/app/(dashboard)/banking/accounts/page.tsx` - Manage accounts
- `src/app/(dashboard)/banking/import/page.tsx` - Upload statement
- `src/app/(dashboard)/banking/transactions/page.tsx` - Transaction list
- `src/app/(dashboard)/banking/reconcile/page.tsx` - Match transactions
- `src/lib/banking/import-csv.ts` - CSV parser
- `src/lib/banking/import-xml.ts` - XML parser
- `src/lib/banking/matcher.ts` - Auto-matching logic

---

## Phase 14: Mobile Responsiveness

### Purpose

Make the entire UI work well on phones and tablets.

### Responsive Breakpoints

```
sm:  640px  - Large phones
md:  768px  - Tablets
lg: 1024px  - Small laptops
xl: 1280px  - Desktops
```

### Component Adaptations

| Component | Desktop                    | Mobile                           |
| --------- | -------------------------- | -------------------------------- |
| Sidebar   | Always visible             | Hamburger menu, slide-out        |
| Header    | Full with company switcher | Compact, icons only              |
| Tables    | Full columns               | Card layout or horizontal scroll |
| Forms     | Multi-column               | Single column, stacked           |
| Actions   | Buttons in row             | FAB or bottom sheet              |
| Modals    | Centered dialog            | Full-screen sheet                |

### New Components

| Component         | Description                                |
| ----------------- | ------------------------------------------ |
| `MobileNav`       | Hamburger + slide-out sidebar              |
| `ResponsiveTable` | Table on desktop, cards on mobile          |
| `BottomSheet`     | Mobile-friendly modal alternative          |
| `FAB`             | Floating action button for primary actions |
| `SwipeActions`    | Swipe to delete/edit on list items         |

### Priority Pages

1. Dashboard - Quick stats, recent items
2. Expenses - Quick capture with camera
3. Invoices - View and send
4. Contacts - Lookup on the go
5. Reports - View key metrics

### Key Files

- `src/components/layout/mobile-nav.tsx`
- `src/components/ui/responsive-table.tsx`
- `src/components/ui/bottom-sheet.tsx`
- `src/components/ui/fab.tsx`
- `src/hooks/use-media-query.ts`
- Update all existing pages with responsive classes

---

## Phase 15: Real E-Invoice Provider (IE-Računi)

### Purpose

Replace mock provider with real integration to Croatia's fiscalization system.

### Provider Interface (Existing)

```typescript
interface EInvoiceProvider {
  send(invoice: Invoice): Promise<ProviderResponse>
  getStatus(ref: string): Promise<StatusResponse>
  cancel(ref: string): Promise<CancelResponse>
}
```

### IE-Računi Implementation

```typescript
class IeRacuniProvider implements EInvoiceProvider {
  // API authentication (OAuth2 or API key)
  // UBL 2.1 XML submission
  // ZKI calculation (RSA-SHA256)
  // JIR retrieval from response
  // Status polling / webhooks
  // Error handling & retry logic
}
```

### Integration Flow

```
1. User clicks "Fiskaliziraj"
2. System calculates ZKI from invoice data
3. Generate UBL 2.1 XML with ZKI
4. Send to IE-Računi API
5. Receive JIR (unique fiscal ID)
6. Store JIR, update status to FISCALIZED
7. Log everything in AuditLog
```

### ZKI Calculation

```
ZKI = SHA256(
  OIB +
  DateTime +
  InvoiceNumber +
  BusinessPremises +
  PaymentDevice +
  TotalAmount
)
```

### Key Files

- `src/lib/e-invoice/providers/ie-racuni.ts` - Provider implementation
- `src/lib/e-invoice/providers/fina.ts` - Alternative provider
- `src/lib/e-invoice/zki.ts` - ZKI calculation
- `src/lib/e-invoice/jir.ts` - JIR handling
- Environment: `IE_RACUNI_API_KEY`, `IE_RACUNI_API_URL`

---

## Phase 16: AI/OCR Features

### Purpose

Reduce manual data entry by automatically extracting data from documents.

### Use Cases

| Feature              | Input                | Output                             |
| -------------------- | -------------------- | ---------------------------------- |
| Receipt Scanner      | Photo of receipt     | Expense with amount, date, vendor  |
| Invoice Reader       | PDF/image of invoice | Expense or payable with line items |
| Bank Statement OCR   | Scanned PDF          | Parsed transactions for import     |
| Smart Categorization | Expense description  | Suggested category                 |

### Architecture

```
1. Upload image/PDF
2. Send to OCR service (extract text)
3. Send to LLM (structure the data)
4. Return structured JSON
5. User confirms/edits
6. Save to database
```

### Service Options

**OCR:**

- Google Cloud Vision (accurate, paid)
- Tesseract (free, self-hosted)

**LLM (structuring):**

- OpenAI GPT-4 (best quality)
- Claude API (alternative)
- Local model (privacy, slower)

### Extraction Schema

```typescript
interface ExtractedReceipt {
  vendor: string
  date: string
  items: Array<{
    description: string
    quantity: number
    unitPrice: number
    total: number
    vatRate?: number
  }>
  subtotal: number
  vatAmount: number
  total: number
  paymentMethod?: string
  confidence: number // 0-1
}
```

### Key Files

- `src/lib/ai/ocr.ts` - OCR service wrapper
- `src/lib/ai/extract-receipt.ts` - Receipt extraction
- `src/lib/ai/extract-invoice.ts` - Invoice extraction
- `src/lib/ai/categorize.ts` - Smart categorization
- `src/app/api/ai/extract/route.ts` - API endpoint
- `src/components/expense/receipt-scanner.tsx` - Upload + preview UI

### UI Flow

1. User taps "Scan Receipt" on mobile
2. Camera opens, user takes photo
3. Loading spinner while processing
4. Pre-filled expense form appears
5. User confirms or edits
6. Save expense

---

## Implementation Order

```
Phase 8:  Audit Logging           ─┐
Phase 9:  Invoice Numbering       ─┼─ Foundation (do first)
                                   │
Phase 10: General Invoicing       ─┤
Phase 11: Expenses Module         ─┼─ Core Features
                                   │
Phase 12: Financial Reporting     ─┤
Phase 13: Bank Integration        ─┼─ Data & Insights
                                   │
Phase 14: Mobile Responsiveness   ─┴─ Polish

Phase 15: Real E-Invoice Provider ─┐
Phase 16: AI/OCR Features         ─┴─ Advanced (last)
```

---

## Next Steps

1. Use `superpowers:writing-plans` to create detailed implementation plans for each phase
2. Use `superpowers:using-git-worktrees` to create isolated workspace
3. Implement phases sequentially using `superpowers:subagent-driven-development`
