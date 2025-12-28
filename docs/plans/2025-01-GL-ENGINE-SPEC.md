# General Ledger Engine Specification v1.0

> Status: DRAFT
> Author: Architecture Review
> Date: 2025-01-XX
> Scope: DOO/JDOO Double-Entry Accounting Support

## 1. Executive Summary

FiskAI's current architecture is document-centric (EInvoice, Expense, BankTransaction) with cash-basis reporting. This works for Paušalni obrt but **cannot support DOO/JDOO** which legally require:

- Balance Sheet (Bilanca)
- Income Statement (RDG)
- Trial Balance (Bruto bilanca)
- General Ledger audit trail

This specification defines a General Ledger (GL) engine that integrates with the existing architecture using the Strangler Fig pattern.

---

## 2. Non-Negotiable Invariants

These constraints are **absolute** and must never be violated:

| #   | Invariant                          | Enforcement                                                                                        |
| --- | ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | **Posted GL is immutable**         | Corrections via reversing entries + new entries only. No UPDATE/DELETE on posted journal lines.    |
| 2   | **Idempotent posting**             | Same business event cannot post twice. Enforced via `PostingBatch` unique constraint.              |
| 3   | **Every posted entry is balanced** | `SUM(debit) = SUM(credit)` validated before commit. Posting service rejects unbalanced batches.    |
| 4   | **Period-valid entries only**      | Cannot post to closed periods. `AccountingPeriod.status = OPEN` required.                          |
| 5   | **Statutory reports read from GL** | Bilanca, RDG, Bruto bilanca for DOO/JDOO must source from `JournalLine`, never from raw documents. |
| 6   | **Full traceability**              | Every `JournalEntry` links to source document + source state hash. Audit trail unbroken.           |

---

## 3. Data Model (Prisma Schema)

### 3.1 Chart of Accounts

```prisma
model GLAccount {
  id            String   @id @default(cuid())
  companyId     String
  company       Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  // Account identification
  code          String   // e.g., "1200" for receivables
  name          String   // e.g., "Potraživanja od kupaca"
  description   String?

  // Classification (RRiF kontni plan)
  rriFClass     Int      // 0-9 (Croatian standard classes)
  rriFGroup     String?  // Optional subgroup within class

  // Accounting behavior
  normalBalance AccountBalance  // DEBIT or CREDIT
  statementType StatementType   // BALANCE_SHEET or PROFIT_LOSS

  // Control
  lockLevel     LockLevel @default(USER)  // SYSTEM, TEMPLATE, USER
  isActive      Boolean   @default(true)

  // Tax integration (future)
  taxMapping    Json?     // Reserved for tax form field mappings

  // Relations
  journalLines  JournalLine[]

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([companyId, code])
  @@index([companyId, rriFClass])
  @@index([companyId, statementType])
}

enum AccountBalance {
  DEBIT
  CREDIT
}

enum StatementType {
  BALANCE_SHEET
  PROFIT_LOSS
}

enum LockLevel {
  SYSTEM    // Cannot be modified (core accounts)
  TEMPLATE  // Can modify name/description only
  USER      // Fully customizable
}
```

### 3.2 Posting Control (Idempotency Anchor)

```prisma
model PostingBatch {
  id                String   @id @default(cuid())
  companyId         String
  company           Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  // Source identification
  sourceType        SourceType    // INVOICE, EXPENSE, BANK_TX, MANUAL, ADJUSTMENT
  sourceId          String        // FK to source document
  sourceVersionHash String        // SHA-256 of posting-relevant fields
  eventType         PostingEvent  // ISSUED, BOOKED, PAID, CANCELED, CREDIT_NOTE, etc.

  // Status
  status            BatchStatus   @default(PENDING)

  // Result
  journalEntryId    String?       @unique
  journalEntry      JournalEntry? @relation(fields: [journalEntryId], references: [id])

  // Audit
  createdAt         DateTime @default(now())
  processedAt       DateTime?
  errorMessage      String?

  // CRITICAL: Idempotency constraint
  @@unique([companyId, sourceType, sourceId, sourceVersionHash, eventType])
  @@index([companyId, status])
  @@index([sourceType, sourceId])
}

enum SourceType {
  INVOICE
  EXPENSE
  BANK_TX
  MANUAL
  ADJUSTMENT
  OPENING_BALANCE
}

enum PostingEvent {
  // Invoice lifecycle
  ISSUED            // Invoice created/sent
  BOOKED            // Accrual recognized
  PAID              // Payment received/made
  PARTIALLY_PAID    // Partial settlement
  CANCELED          // Void before posting
  CREDIT_NOTE       // Reversal document

  // Expense lifecycle
  APPROVED
  EXPENSE_PAID

  // Bank transactions
  BANK_FEE
  FX_DIFFERENCE
  INTEREST

  // Period events
  WRITE_OFF         // Bad debt
  RECLASSIFICATION
  PERIOD_CLOSE
}

enum BatchStatus {
  PENDING   // Awaiting processing
  APPLIED   // Successfully posted
  SKIPPED   // Duplicate detected, no action
  FAILED    // Validation failed
}
```

### 3.3 Journal Entries

```prisma
model JournalEntry {
  id              String   @id @default(cuid())
  companyId       String
  company         Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  // Entry identification
  entryNumber     Int      // Sequential per company + fiscal year
  fiscalYear      Int      // e.g., 2025

  // Timing
  entryDate       DateTime // Accounting date (may differ from createdAt)
  periodId        String
  period          AccountingPeriod @relation(fields: [periodId], references: [id])

  // Status (immutable once POSTED)
  status          EntryStatus @default(DRAFT)

  // Reversal chain
  reversesEntryId String?  // Points to entry being reversed
  reversesEntry   JournalEntry? @relation("ReversalChain", fields: [reversesEntryId], references: [id])
  reversedBy      JournalEntry[] @relation("ReversalChain")

  // Source linkage
  postingBatch    PostingBatch?

  // Integrity
  contentHash           String   // SHA-256 of canonical entry content
  hashAlgoVersion       Int      @default(1)
  canonicalFormatVersion Int     @default(1)

  // Metadata
  description     String
  reference       String?  // External reference (invoice number, etc.)
  createdById     String?
  createdBy       User?    @relation(fields: [createdById], references: [id])

  // Lines
  lines           JournalLine[]

  createdAt       DateTime @default(now())
  postedAt        DateTime?

  @@unique([companyId, fiscalYear, entryNumber])
  @@index([companyId, entryDate])
  @@index([companyId, status])
  @@index([periodId])
}

enum EntryStatus {
  DRAFT     // Can be edited
  POSTED    // Immutable, affects GL
}
```

### 3.4 Journal Lines

```prisma
model JournalLine {
  id            String   @id @default(cuid())
  journalEntryId String
  journalEntry  JournalEntry @relation(fields: [journalEntryId], references: [id], onDelete: Cascade)

  // Account
  accountId     String
  account       GLAccount @relation(fields: [accountId], references: [id])

  // Amount (EXACTLY ONE must be > 0, other must be 0)
  debit         Decimal  @db.Decimal(14, 2)
  credit        Decimal  @db.Decimal(14, 2)

  // Line metadata
  lineNumber    Int      // Order within entry
  description   String?  // Line-level description

  // Dimensions (analytics)
  dimensions    Json?    // { costCenter, project, department, etc. }

  // Subledger reference
  openItemId    String?
  openItem      OpenItem? @relation(fields: [openItemId], references: [id])

  @@index([journalEntryId])
  @@index([accountId])
}
```

### 3.5 Accounting Periods

```prisma
model AccountingPeriod {
  id            String   @id @default(cuid())
  companyId     String
  company       Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  // Period identification
  fiscalYear    Int
  periodNumber  Int      // 1-12 for monthly, 1-4 for quarterly
  periodType    PeriodType @default(MONTHLY)

  // Date range
  startDate     DateTime
  endDate       DateTime

  // Status
  status        PeriodStatus @default(OPEN)

  // Close metadata
  closedAt      DateTime?
  closedById    String?
  closedBy      User?    @relation(fields: [closedById], references: [id])
  closePolicy   Json?    // { requireReconciliation, requireApproval, etc. }

  // Relations
  journalEntries JournalEntry[]

  @@unique([companyId, fiscalYear, periodNumber])
  @@index([companyId, status])
}

enum PeriodType {
  MONTHLY
  QUARTERLY
  ANNUAL
}

enum PeriodStatus {
  FUTURE    // Not yet started
  OPEN      // Accepting entries
  SOFT_CLOSE // Warnings on entry, requires override
  CLOSED    // No entries allowed
  LOCKED    // Archived, audit-sealed
}
```

### 3.6 Subledger: Open Items (AR/AP)

```prisma
model OpenItem {
  id            String   @id @default(cuid())
  companyId     String
  company       Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  // Type
  itemType      OpenItemType  // RECEIVABLE or PAYABLE

  // Source document
  sourceType    SourceType
  sourceId      String

  // Counterparty
  contactId     String
  contact       Contact  @relation(fields: [contactId], references: [id])

  // Amounts
  originalAmount    Decimal  @db.Decimal(14, 2)
  remainingAmount   Decimal  @db.Decimal(14, 2)
  currency          String   @default("EUR")

  // Dates
  documentDate  DateTime
  dueDate       DateTime

  // Status
  status        OpenItemStatus @default(OPEN)

  // Settlement tracking
  settlements   Settlement[]
  journalLines  JournalLine[]

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([companyId, sourceType, sourceId])  // Prevent duplicate open items
  @@index([companyId, itemType, status])
  @@index([contactId])
  @@index([dueDate])
}

model Settlement {
  id            String   @id @default(cuid())

  // What's being settled
  openItemId    String
  openItem      OpenItem @relation(fields: [openItemId], references: [id])

  // Settlement source (usually bank transaction)
  sourceType    SourceType
  sourceId      String

  // Amount
  amount        Decimal  @db.Decimal(14, 2)
  settlementDate DateTime

  // Link to posting
  postingBatchId String?
  postingBatch   PostingBatch? @relation(fields: [postingBatchId], references: [id])

  createdAt     DateTime @default(now())

  @@index([openItemId])
  @@index([postingBatchId])
}

enum OpenItemType {
  RECEIVABLE  // Customer owes us (AR)
  PAYABLE     // We owe supplier (AP)
}

enum OpenItemStatus {
  OPEN
  PARTIALLY_SETTLED
  SETTLED
  WRITTEN_OFF
}
```

### 3.7 Company Model Extensions

```prisma
model Company {
  // ... existing fields ...

  // NEW: Accounting mode
  accountingMode    AccountingMode @default(CASH)

  // NEW: GL relations
  glAccounts        GLAccount[]
  postingBatches    PostingBatch[]
  journalEntries    JournalEntry[]
  accountingPeriods AccountingPeriod[]
  openItems         OpenItem[]
}

enum AccountingMode {
  CASH      // Paušalni, simple obrt
  ACCRUAL   // DOO, JDOO, VAT-registered
}
```

---

## 4. Posting Service Contract

### 4.1 Core Interface

```typescript
// src/lib/gl/posting-service.ts

interface PostingRequest {
  companyId: string
  sourceType: SourceType
  sourceId: string
  eventType: PostingEvent
  entryDate: Date
  description: string
  lines: PostingLine[]
  reference?: string
  dimensions?: Record<string, string>
  reversesEntryId?: string // For reversal entries
}

interface PostingLine {
  accountCode: string
  debit: Decimal
  credit: Decimal
  description?: string
  openItemId?: string
}

interface PostingResult {
  status: "APPLIED" | "SKIPPED" | "FAILED"
  batchId: string
  journalEntryId?: string
  entryNumber?: number
  error?: string
}

async function post(request: PostingRequest): Promise<PostingResult>
```

### 4.2 Posting Algorithm (Deterministic)

```typescript
async function post(request: PostingRequest): Promise<PostingResult> {
  // 1. Compute source version hash
  const sourceVersionHash = computeSourceHash(request)

  // 2. Check idempotency (UPSERT pattern)
  const existingBatch = await db.postingBatch.findUnique({
    where: {
      companyId_sourceType_sourceId_sourceVersionHash_eventType: {
        companyId: request.companyId,
        sourceType: request.sourceType,
        sourceId: request.sourceId,
        sourceVersionHash,
        eventType: request.eventType,
      },
    },
  })

  if (existingBatch) {
    // Already processed - return existing result
    return {
      status: "SKIPPED",
      batchId: existingBatch.id,
      journalEntryId: existingBatch.journalEntryId ?? undefined,
    }
  }

  // 3. Validate period is open
  const period = await findOpenPeriod(request.companyId, request.entryDate)
  if (!period || period.status === "CLOSED" || period.status === "LOCKED") {
    return createFailedBatch(request, "Period is closed")
  }

  // 4. Validate balanced
  const totalDebit = request.lines.reduce((sum, l) => sum.add(l.debit), new Decimal(0))
  const totalCredit = request.lines.reduce((sum, l) => sum.add(l.credit), new Decimal(0))

  if (!totalDebit.equals(totalCredit)) {
    return createFailedBatch(request, `Unbalanced: debit=${totalDebit}, credit=${totalCredit}`)
  }

  // 5. Validate line constraints (exactly one of debit/credit > 0)
  for (const line of request.lines) {
    if ((line.debit.gt(0) && line.credit.gt(0)) || (line.debit.lte(0) && line.credit.lte(0))) {
      return createFailedBatch(request, "Each line must have exactly one of debit or credit > 0")
    }
  }

  // 6. Resolve account codes to IDs
  const accountMap = await resolveAccounts(request.companyId, request.lines)

  // 7. Get next entry number
  const entryNumber = await getNextEntryNumber(request.companyId, period.fiscalYear)

  // 8. Create journal entry + lines + batch in transaction
  const result = await db.$transaction(async (tx) => {
    const journalEntry = await tx.journalEntry.create({
      data: {
        companyId: request.companyId,
        entryNumber,
        fiscalYear: period.fiscalYear,
        entryDate: request.entryDate,
        periodId: period.id,
        status: "POSTED",
        description: request.description,
        reference: request.reference,
        contentHash: computeEntryHash(request),
        postedAt: new Date(),
        lines: {
          create: request.lines.map((line, idx) => ({
            accountId: accountMap[line.accountCode],
            debit: line.debit,
            credit: line.credit,
            lineNumber: idx + 1,
            description: line.description,
            dimensions: request.dimensions,
            openItemId: line.openItemId,
          })),
        },
      },
    })

    const batch = await tx.postingBatch.create({
      data: {
        companyId: request.companyId,
        sourceType: request.sourceType,
        sourceId: request.sourceId,
        sourceVersionHash,
        eventType: request.eventType,
        status: "APPLIED",
        journalEntryId: journalEntry.id,
        processedAt: new Date(),
      },
    })

    return { journalEntry, batch }
  })

  return {
    status: "APPLIED",
    batchId: result.batch.id,
    journalEntryId: result.journalEntry.id,
    entryNumber: result.journalEntry.entryNumber,
  }
}
```

### 4.3 Hash Computation Contract

```typescript
// Canonical format for source document hashing
// Version 1: SHA-256 of JSON-serialized posting-relevant fields

interface HashableInvoice {
  id: string
  invoiceNumber: string
  netAmount: string // Decimal as string
  vatAmount: string
  totalAmount: string
  buyerId: string
  issueDate: string // ISO 8601
  // Note: excludes non-posting fields like notes, attachments
}

function computeSourceHash(request: PostingRequest): string {
  const canonical = {
    sourceType: request.sourceType,
    sourceId: request.sourceId,
    eventType: request.eventType,
    // Stable sort: by accountCode, then by normalized amounts
    // Use toFixed(2) for deterministic decimal formatting
    lines: request.lines
      .map((l, idx) => ({
        accountCode: l.accountCode,
        debit: new Decimal(l.debit).toFixed(2), // Normalize to 2 decimal places
        credit: new Decimal(l.credit).toFixed(2), // Normalize to 2 decimal places
        _sortKey: idx, // Preserve original order for same-account lines
      }))
      .sort((a, b) => {
        const codeCompare = a.accountCode.localeCompare(b.accountCode)
        if (codeCompare !== 0) return codeCompare
        // Same account: sort by debit desc, then credit desc, then original index
        const debitCompare = b.debit.localeCompare(a.debit)
        if (debitCompare !== 0) return debitCompare
        const creditCompare = b.credit.localeCompare(a.credit)
        if (creditCompare !== 0) return creditCompare
        return a._sortKey - b._sortKey
      })
      .map(({ accountCode, debit, credit }) => ({ accountCode, debit, credit })), // Remove _sortKey
  }

  return crypto.createHash("sha256").update(JSON.stringify(canonical)).digest("hex")
}
```

---

## 5. Event-Driven Posting Map

### 5.1 Invoice Lifecycle

| Event            | Trigger              | Debit Account         | Credit Account   | Notes               |
| ---------------- | -------------------- | --------------------- | ---------------- | ------------------- |
| `ISSUED`         | Invoice created      | 1200 Receivables      | 7500 Revenue     | Accrual recognition |
| `ISSUED` (VAT)   | Invoice w/ VAT       | 1200 Receivables      | 2400 VAT Payable | VAT portion         |
| `PAID`           | Bank match confirmed | 1000 Bank             | 1200 Receivables | Clears open item    |
| `PARTIALLY_PAID` | Partial bank match   | 1000 Bank             | 1200 Receivables | Partial settlement  |
| `CREDIT_NOTE`    | Credit note issued   | 7500 Revenue          | 1200 Receivables | Reverses original   |
| `WRITE_OFF`      | Bad debt recognized  | 4890 Bad Debt Expense | 1200 Receivables | Requires approval   |

### 5.2 Expense Lifecycle

| Event            | Trigger                   | Debit Account         | Credit Account | Notes              |
| ---------------- | ------------------------- | --------------------- | -------------- | ------------------ |
| `BOOKED`         | Expense approved          | 4xxx Expense Category | 2200 Payables  | Accrual            |
| `BOOKED` (VAT)   | Expense w/ deductible VAT | 1400 Input VAT        | 2200 Payables  | VAT recovery       |
| `EXPENSE_PAID`   | Bank match confirmed      | 2200 Payables         | 1000 Bank      | Clears open item   |
| `PARTIALLY_PAID` | Partial payment           | 2200 Payables         | 1000 Bank      | Partial settlement |

### 5.3 Bank Transaction Events

| Event                  | Trigger               | Debit Account         | Credit Account       | Notes                       |
| ---------------------- | --------------------- | --------------------- | -------------------- | --------------------------- |
| `BANK_FEE`             | Fee line in statement | 4920 Bank Fees        | 1000 Bank            | Auto-post                   |
| `INTEREST` (received)  | Interest credit       | 1000 Bank             | 7600 Interest Income |                             |
| `INTEREST` (paid)      | Interest debit        | 4910 Interest Expense | 1000 Bank            |                             |
| `FX_DIFFERENCE` (gain) | Currency revaluation  | 1000 Bank             | 7700 FX Gains        | EUR-only now, hook reserved |
| `FX_DIFFERENCE` (loss) | Currency revaluation  | 4930 FX Losses        | 1000 Bank            |                             |

### 5.4 Period Events

| Event              | Trigger           | Debit Account        | Credit Account         | Notes                  |
| ------------------ | ----------------- | -------------------- | ---------------------- | ---------------------- |
| `PERIOD_CLOSE`     | Year-end close    | 8xxx Expense Summary | 3xxx Retained Earnings | P&L accounts to equity |
| `RECLASSIFICATION` | Manual adjustment | Various              | Various                | Audit trail required   |

---

## 6. Default Chart of Accounts (RRiF Template)

Based on Croatian RRiF kontni plan:

```typescript
const RRiF_TEMPLATE: GLAccountTemplate[] = [
  // Class 0: Long-term assets
  {
    code: "0200",
    name: "Nematerijalna imovina",
    rriFClass: 0,
    normalBalance: "DEBIT",
    statementType: "BALANCE_SHEET",
    lockLevel: "TEMPLATE",
  },
  {
    code: "0300",
    name: "Materijalna imovina",
    rriFClass: 0,
    normalBalance: "DEBIT",
    statementType: "BALANCE_SHEET",
    lockLevel: "TEMPLATE",
  },

  // Class 1: Current assets
  {
    code: "1000",
    name: "Žiro račun",
    rriFClass: 1,
    normalBalance: "DEBIT",
    statementType: "BALANCE_SHEET",
    lockLevel: "SYSTEM",
  },
  {
    code: "1100",
    name: "Blagajna",
    rriFClass: 1,
    normalBalance: "DEBIT",
    statementType: "BALANCE_SHEET",
    lockLevel: "TEMPLATE",
  },
  {
    code: "1200",
    name: "Potraživanja od kupaca",
    rriFClass: 1,
    normalBalance: "DEBIT",
    statementType: "BALANCE_SHEET",
    lockLevel: "SYSTEM",
  },
  {
    code: "1400",
    name: "Ulazni PDV",
    rriFClass: 1,
    normalBalance: "DEBIT",
    statementType: "BALANCE_SHEET",
    lockLevel: "SYSTEM",
  },

  // Class 2: Short-term liabilities
  {
    code: "2200",
    name: "Obveze prema dobavljačima",
    rriFClass: 2,
    normalBalance: "CREDIT",
    statementType: "BALANCE_SHEET",
    lockLevel: "SYSTEM",
  },
  {
    code: "2400",
    name: "Obveze za PDV",
    rriFClass: 2,
    normalBalance: "CREDIT",
    statementType: "BALANCE_SHEET",
    lockLevel: "SYSTEM",
  },
  {
    code: "2500",
    name: "Obveze za porez na dobit",
    rriFClass: 2,
    normalBalance: "CREDIT",
    statementType: "BALANCE_SHEET",
    lockLevel: "TEMPLATE",
  },

  // Class 3: Equity
  {
    code: "3000",
    name: "Temeljni kapital",
    rriFClass: 3,
    normalBalance: "CREDIT",
    statementType: "BALANCE_SHEET",
    lockLevel: "SYSTEM",
  },
  {
    code: "3100",
    name: "Zadržana dobit",
    rriFClass: 3,
    normalBalance: "CREDIT",
    statementType: "BALANCE_SHEET",
    lockLevel: "SYSTEM",
  },
  {
    code: "3200",
    name: "Dobit tekuće godine",
    rriFClass: 3,
    normalBalance: "CREDIT",
    statementType: "BALANCE_SHEET",
    lockLevel: "SYSTEM",
  },

  // Class 4: Expenses
  {
    code: "4000",
    name: "Materijalni troškovi",
    rriFClass: 4,
    normalBalance: "DEBIT",
    statementType: "PROFIT_LOSS",
    lockLevel: "TEMPLATE",
  },
  {
    code: "4100",
    name: "Troškovi usluga",
    rriFClass: 4,
    normalBalance: "DEBIT",
    statementType: "PROFIT_LOSS",
    lockLevel: "TEMPLATE",
  },
  {
    code: "4200",
    name: "Troškovi osoblja",
    rriFClass: 4,
    normalBalance: "DEBIT",
    statementType: "PROFIT_LOSS",
    lockLevel: "TEMPLATE",
  },
  {
    code: "4300",
    name: "Amortizacija",
    rriFClass: 4,
    normalBalance: "DEBIT",
    statementType: "PROFIT_LOSS",
    lockLevel: "TEMPLATE",
  },
  {
    code: "4900",
    name: "Ostali troškovi poslovanja",
    rriFClass: 4,
    normalBalance: "DEBIT",
    statementType: "PROFIT_LOSS",
    lockLevel: "TEMPLATE",
  },
  {
    code: "4910",
    name: "Kamate",
    rriFClass: 4,
    normalBalance: "DEBIT",
    statementType: "PROFIT_LOSS",
    lockLevel: "TEMPLATE",
  },
  {
    code: "4920",
    name: "Bankarske naknade",
    rriFClass: 4,
    normalBalance: "DEBIT",
    statementType: "PROFIT_LOSS",
    lockLevel: "TEMPLATE",
  },
  {
    code: "4930",
    name: "Tečajne razlike - rashod",
    rriFClass: 4,
    normalBalance: "DEBIT",
    statementType: "PROFIT_LOSS",
    lockLevel: "TEMPLATE",
  },
  {
    code: "4890",
    name: "Otpis potraživanja",
    rriFClass: 4,
    normalBalance: "DEBIT",
    statementType: "PROFIT_LOSS",
    lockLevel: "TEMPLATE",
  },

  // Class 7: Revenue
  {
    code: "7500",
    name: "Prihodi od prodaje",
    rriFClass: 7,
    normalBalance: "CREDIT",
    statementType: "PROFIT_LOSS",
    lockLevel: "SYSTEM",
  },
  {
    code: "7600",
    name: "Prihodi od kamata",
    rriFClass: 7,
    normalBalance: "CREDIT",
    statementType: "PROFIT_LOSS",
    lockLevel: "TEMPLATE",
  },
  {
    code: "7700",
    name: "Tečajne razlike - prihod",
    rriFClass: 7,
    normalBalance: "CREDIT",
    statementType: "PROFIT_LOSS",
    lockLevel: "TEMPLATE",
  },
  // Class 8: P&L Summary (year-end)
  {
    code: "8000",
    name: "Rashodi - sažetak",
    rriFClass: 8,
    normalBalance: "DEBIT",
    statementType: "PROFIT_LOSS",
    lockLevel: "SYSTEM",
  },
  {
    code: "8100",
    name: "Prihodi - sažetak",
    rriFClass: 8,
    normalBalance: "CREDIT",
    statementType: "PROFIT_LOSS",
    lockLevel: "SYSTEM",
  },

  // Class 9: Suspense / Clearing
  {
    code: "9999",
    name: "Suspenzni račun",
    rriFClass: 9,
    normalBalance: "DEBIT",
    statementType: "BALANCE_SHEET",
    lockLevel: "SYSTEM",
  },
]
```

---

## 7. Migration Strategy (Strangler Fig)

### Phase 1: Shadow Ledger (DRAFT Mode)

**Duration:** 2-4 weeks
**Risk:** Low (no production impact)

**Actions:**

1. Deploy GL schema (all new tables)
2. Create RRiF chart of accounts for existing DOO/JDOO companies
3. Hook posting service to document events (invoice created, expense approved)
4. Generate `PostingBatch` with `status: PENDING` (shadow mode)
5. Do NOT create actual `JournalEntry` records yet

**Validation:**

- Run nightly reconciliation: `SUM(invoices.netAmount)` vs `SUM(pending revenue postings)`
- Surface discrepancies in staff portal only
- Accountant role reviews shadow postings for accuracy

**Exit Criteria:**

- 95%+ match rate for 2 consecutive weeks
- No critical mapping errors

### Phase 2: Dual Reporting for DOO/JDOO

**Duration:** 4-6 weeks
**Risk:** Medium (user-visible, but parallel)

**Actions:**

1. Enable posting service to create `JournalEntry` records (status: POSTED)
2. Build GL-based reports (Trial Balance, Balance Sheet, Income Statement)
3. Show **both** legacy P&L and GL-based P&L to DOO/JDOO users
4. Display discrepancy banner if they differ

**UI Treatment:**

```
┌─────────────────────────────────────────────────────────┐
│  ⚠️ BETA: Nove financijske izvještaje uspoređujemo      │
│     s prethodnim sustavom. Razlike: 1,234.56 EUR        │
│     [Prikaži detalje]                                   │
└─────────────────────────────────────────────────────────┘
```

**Validation:**

- Weekly discrepancy review by staff accountants
- Track discrepancy trends (should decrease)
- User feedback collection

**Exit Criteria:**

- Discrepancy < 0.1% for 4 consecutive weeks
- Staff accountant sign-off

### Phase 3: Historical Backfill

**Duration:** 2-4 weeks
**Risk:** Medium-High (data quality dependent)

**Actions:**

1. Create backfill script for historical documents
2. For each document, attempt posting:
   - Success → Normal `JournalEntry`
   - Mapping failure → Post to `9999 Suspense` account
   - Create `AccountingIssue` ticket for staff review

**AccountingIssue Model:**

```prisma
model AccountingIssue {
  id            String   @id @default(cuid())
  companyId     String

  issueType     IssueType  // MAPPING_FAILURE, BALANCE_MISMATCH, MISSING_ACCOUNT
  sourceType    SourceType
  sourceId      String

  description   String
  suspenseAmount Decimal?

  status        IssueStatus @default(OPEN)
  resolvedById  String?
  resolvedAt    DateTime?
  resolution    String?

  createdAt     DateTime @default(now())
}
```

**Validation:**

- 100% of historical documents processed (success or suspense)
- All suspense postings have corresponding tickets
- Staff resolution queue visible in portal

**Exit Criteria:**

- < 5% of documents in suspense
- All high-value suspense items resolved

### Phase 4: Lock Edits & Deprecate Legacy

**Duration:** 2 weeks
**Risk:** Low (policy change)

**Actions:**

1. For DOO/JDOO companies, disable direct invoice/expense editing after posting
2. Edits require:
   - Credit note + replacement invoice, OR
   - Adjustment entry (accountant role only)
3. Remove legacy P&L page for DOO/JDOO
4. GL reports become the single source of truth

**Visibility Rules:**

```typescript
function getReportVisibility(company: Company): ReportVisibility {
  if (company.accountingMode === "ACCRUAL") {
    return {
      showLegacyPL: false,
      showGLReports: true,
      showKPR: false, // KPR is cash-basis only
    }
  }
  return {
    showLegacyPL: true,
    showGLReports: false,
    showKPR: true,
  }
}
```

---

## 8. Report Definitions

### 8.1 Trial Balance (Bruto Bilanca)

**Query:**

```sql
SELECT
  a.code,
  a.name,
  a."rriFClass",
  SUM(jl.debit) as total_debit,
  SUM(jl.credit) as total_credit,
  SUM(jl.debit) - SUM(jl.credit) as balance
FROM "JournalLine" jl
JOIN "JournalEntry" je ON jl."journalEntryId" = je.id
JOIN "GLAccount" a ON jl."accountId" = a.id
WHERE je."companyId" = $1
  AND je.status = 'POSTED'
  AND je."entryDate" BETWEEN $2 AND $3
GROUP BY a.id, a.code, a.name, a."rriFClass"
ORDER BY a.code
```

**Validation:**

- `SUM(total_debit) = SUM(total_credit)` (must always balance)

### 8.2 Balance Sheet (Bilanca)

**Structure:**

```
AKTIVA (Assets)
├── A. Dugotrajna imovina (Class 0)
│   └── [accounts grouped by rriFClass = 0]
├── B. Kratkotrajna imovina (Class 1)
│   └── [accounts grouped by rriFClass = 1]
└── UKUPNO AKTIVA

PASIVA (Liabilities + Equity)
├── A. Kapital i rezerve (Class 3)
│   └── [accounts grouped by rriFClass = 3]
├── B. Dugoročne obveze (Class 2, subset)
├── C. Kratkoročne obveze (Class 2, subset)
└── UKUPNO PASIVA

AKTIVA = PASIVA (must balance)
```

### 8.3 Income Statement (RDG)

**Structure:**

```
PRIHODI (Revenue)
├── 1. Prihodi od prodaje (Class 7)
├── 2. Ostali prihodi
└── UKUPNO PRIHODI

RASHODI (Expenses)
├── 1. Materijalni troškovi (Class 4)
├── 2. Troškovi osoblja
├── 3. Amortizacija
├── 4. Ostali rashodi
└── UKUPNO RASHODI

DOBIT/GUBITAK = PRIHODI - RASHODI
```

### 8.4 Audit Drill-Down

Every report line must support:

```
Report Line (e.g., "Prihodi od prodaje: 50,000 EUR")
  → Account 7500 transactions
    → JournalEntry #123 (2025-01-15, Invoice R-2025-001)
      → JournalLine: Credit 1,000 EUR
        → Source: EInvoice abc123
          → [View Invoice]
```

---

## 9. RBAC Integration

### 9.1 Capabilities Extension

```typescript
// src/lib/capabilities.ts

export interface Capabilities {
  // ... existing ...

  // NEW
  accountingMode: "CASH" | "ACCRUAL"
  glAccess: {
    canViewGL: boolean
    canPostManual: boolean
    canCloseperiod: boolean
    canWriteOff: boolean
  }
}

export function deriveCapabilities(company: PartialCompany | null): Capabilities {
  const legalForm = (company?.legalForm as LegalForm) || "DOO"

  // Derive accounting mode from legal form
  const accountingMode = ["DOO", "JDOO"].includes(legalForm) ? "ACCRUAL" : "CASH"

  // GL access based on role (from session)
  const glAccess = {
    canViewGL: accountingMode === "ACCRUAL",
    canPostManual: false, // Accountant role only
    canClosePeriod: false, // Accountant role only
    canWriteOff: false, // Accountant role only
  }

  return {
    // ... existing ...
    accountingMode,
    glAccess,
  }
}
```

### 9.2 Hard Blocks

```typescript
// Prevent invalid combinations
if (company.legalForm === "DOO" && !company.glAccounts?.length) {
  throw new Error("DOO companies require Chart of Accounts setup")
}

if (company.accountingMode === "ACCRUAL" && action === "view_kpr") {
  throw new Error("KPR is not available for accrual-basis companies")
}
```

---

## 10. Index Strategy

### Required Indexes (Day 1)

```prisma
// Already in schema above, consolidated here:

@@index([companyId, rriFClass])           // GLAccount: class filtering
@@index([companyId, statementType])       // GLAccount: report grouping
@@index([companyId, status])              // PostingBatch: queue processing
@@index([sourceType, sourceId])           // PostingBatch: source lookup
@@index([companyId, entryDate])           // JournalEntry: date range queries
@@index([companyId, status])              // JournalEntry: status filtering
@@index([periodId])                       // JournalEntry: period aggregation
@@index([journalEntryId])                 // JournalLine: entry lookup
@@index([accountId])                      // JournalLine: account aggregation
@@index([companyId, itemType, status])    // OpenItem: AR/AP queries
@@index([dueDate])                        // OpenItem: aging reports
```

### Future Optimization (When Needed)

- Materialized views for trial balance per period
- Partition `JournalLine` by fiscal year (only after 1M+ rows)
- Read replicas for reporting queries

---

## 11. Open Questions

| #   | Question                                                       | Owner       | Status                 |
| --- | -------------------------------------------------------------- | ----------- | ---------------------- |
| 1   | Multi-currency support timeline                                | Product     | Deferred (EUR-only v1) |
| 2   | Integration with external accounting software (Pantheon, etc.) | Product     | Deferred               |
| 3   | Consolidation for multi-company groups                         | Product     | Deferred               |
| 4   | Depreciation module design                                     | Engineering | Not started            |
| 5   | Inventory/COGS tracking                                        | Product     | Not started            |

---

## 12. Definition of Done

**FiskAI "supports DOO/JDOO" when:**

- [ ] User can generate Trial Balance (Bruto bilanca) from GL
- [ ] User can generate Balance Sheet (Bilanca) that balances
- [ ] User can generate Income Statement (RDG) from GL
- [ ] Every report line drills down to journal entries to source documents
- [ ] Posted GL is immutable (reversals only)
- [ ] Period close prevents backdated entries
- [ ] 100% of invoices and expenses post to GL automatically
- [ ] Staff portal shows accounting issues queue
- [ ] Discrepancy between document totals and GL totals < 0.01%

---

## Appendix A: Reversal Entry Pattern

When correcting a posted entry:

```typescript
async function reverseEntry(entryId: string, reason: string): Promise<PostingResult> {
  const original = await db.journalEntry.findUnique({
    where: { id: entryId },
    include: {
      lines: {
        include: { account: true }, // Include account to get code
      },
    },
  })

  if (!original) {
    throw new Error("Entry not found")
  }

  if (original.status !== "POSTED") {
    throw new Error("Can only reverse posted entries")
  }

  // Create reversing entry with flipped debits/credits
  // Use accountCode (not accountId) to match PostingLine interface
  const reversingLines: PostingLine[] = original.lines.map((line) => ({
    accountCode: line.account.code, // Use code, not id
    debit: line.credit, // Flip
    credit: line.debit, // Flip
    description: `Storno: ${line.description}`,
  }))

  return post({
    companyId: original.companyId,
    sourceType: "ADJUSTMENT",
    sourceId: original.id,
    eventType: "RECLASSIFICATION",
    entryDate: new Date(),
    description: `Storno stavke ${original.entryNumber}: ${reason}`,
    lines: reversingLines,
    reversesEntryId: original.id, // Now accepted by PostingRequest
  })
}
```

---

## Appendix B: Source Version Hash Examples

**Invoice posting-relevant fields:**

```json
{
  "id": "inv_abc123",
  "invoiceNumber": "R-2025-001",
  "netAmount": "1000.00",
  "vatAmount": "250.00",
  "totalAmount": "1250.00",
  "buyerId": "contact_xyz",
  "issueDate": "2025-01-15"
}
```

**Hash:** `sha256(canonicalize(above))` = `a1b2c3...`

**If invoice is edited** (e.g., amount changes):

- New hash computed
- New `PostingBatch` created (different hash)
- Old posting remains (audit trail)
- New posting reflects current state

---

_End of Specification_
