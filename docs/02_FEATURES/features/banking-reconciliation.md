# Feature: Bank Reconciliation

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 18

## Purpose

The Bank Reconciliation feature enables FiskAI to automatically match bank transactions with unpaid invoices using AI-powered scoring algorithms. When users import bank statements via CSV, the system analyzes each transaction and attempts to match it with outstanding invoices based on amount, date proximity, and invoice number references. High-confidence matches (≥85%) are automatically linked and mark invoices as paid, while lower-confidence matches are presented to users for manual review and confirmation. This streamlines cash flow tracking and eliminates manual reconciliation work.

## User Entry Points

| Type | Path                     | Evidence                                                                                             |
| ---- | ------------------------ | ---------------------------------------------------------------------------------------------------- |
| Page | Reconciliation Dashboard | `/banking/reconciliation` → `src/app/(dashboard)/banking/reconciliation/page.tsx:9-70`               |
| Page | Transaction List         | `/banking/transactions` → `src/app/(dashboard)/banking/transactions/page.tsx:26-450`                 |
| Page | Import Statement         | `/banking/import` → `src/app/(dashboard)/banking/import/page.tsx:10-218`                             |
| API  | Reconciliation Data      | `GET /api/banking/reconciliation` → `src/app/api/banking/reconciliation/route.ts:19-148`             |
| API  | Manual Match             | `POST /api/banking/reconciliation/match` → `src/app/api/banking/reconciliation/match/route.ts:12-90` |

## Core Flow

### Automatic Matching Flow

1. User uploads CSV bank statement via import page → `src/app/(dashboard)/banking/import/page.tsx:10-218`
2. System parses CSV file and extracts transactions → `src/lib/banking/csv-parser.ts:27-56`
3. Transactions inserted into database with UNMATCHED status → `src/app/(dashboard)/banking/actions.ts:224-241`
4. Auto-match service runs immediately after import → `src/app/(dashboard)/banking/actions.ts:256-260`
5. System retrieves all UNMATCHED transactions for account → `src/lib/banking/reconciliation-service.ts:26-34`
6. System fetches unpaid OUTBOUND invoices → `src/lib/banking/reconciliation-service.ts:40-47`
7. Matching algorithm scores each transaction against invoices → `src/lib/banking/reconciliation.ts:21-58`
8. Transactions with confidence ≥85% automatically matched → `src/lib/banking/reconciliation-service.ts:79-82`
9. Matched transactions update to AUTO_MATCHED status → `src/lib/banking/reconciliation-service.ts:84-90`
10. Linked invoices marked as paid with ACCEPTED status → `src/lib/banking/reconciliation-service.ts:95-106`
11. User sees auto-match results in success message → `src/app/(dashboard)/banking/import/import-form.tsx:156-159`

### Manual Matching Flow

1. User navigates to reconciliation dashboard → `src/app/(dashboard)/banking/reconciliation/page.tsx:9`
2. System displays UNMATCHED transactions with top candidates → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:32-296`
3. User reviews transaction with confidence score and candidate details → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:226-262`
4. User clicks "Poveži" button for selected candidate → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:265-275`
5. API validates transaction and invoice exist and belong to company → `src/app/api/banking/reconciliation/match/route.ts:31-52`
6. System updates transaction to MANUAL_MATCHED with 100% confidence → `src/app/api/banking/reconciliation/match/route.ts:61-70`
7. Invoice marked as paid with transaction date → `src/app/api/banking/reconciliation/match/route.ts:72-78`
8. Success message displayed and dashboard refreshes → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:109-111`

## Key Modules

| Module                      | Purpose                                          | Location                                                                 |
| --------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------ |
| ReconciliationDashboard     | Main UI for reviewing unmatched transactions     | `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:32-296` |
| runAutoMatchTransactions    | Automatic matching service after import          | `src/lib/banking/reconciliation-service.ts:15-137`                       |
| matchTransactionsToInvoices | Core matching algorithm with scoring             | `src/lib/banking/reconciliation.ts:21-58`                                |
| getInvoiceCandidates        | Retrieves top match candidates for UI            | `src/lib/banking/reconciliation.ts:60-77`                                |
| calculateMatchScore         | Scoring algorithm based on amount/date/reference | `src/lib/banking/reconciliation.ts:96-120`                               |
| parseCSV                    | Multi-bank CSV parser with format detection      | `src/lib/banking/csv-parser.ts:27-56`                                    |
| ImportForm                  | Client-side CSV upload and preview               | `src/app/(dashboard)/banking/import/import-form.tsx:25-319`              |

## Matching Algorithm

### Scoring Logic

The matching algorithm uses three tiers of confidence scoring → `src/lib/banking/reconciliation.ts:96-120`:

**Tier 1: Perfect Match (100 points)**

- Invoice number found in transaction reference field
- Example: Transaction reference "INV-2025/43-1-1" matches invoice number "43-1-1"
- Logic: `reference.includes(invoiceNumber) || invoiceNumber.includes(reference)` → line 100

**Tier 2: High Confidence (85 points)**

- Amount difference less than 1.00 currency unit
- Date difference 3 days or less
- Triggers automatic matching → `src/lib/banking/reconciliation.ts:108-110`

**Tier 3: Partial Match (70 points)**

- Amount within 5% tolerance
- Date difference 5 days or less
- Presented as candidate, requires manual review → `src/lib/banking/reconciliation.ts:112-117`

**No Match (0 points)**

- All other cases → `src/lib/banking/reconciliation.ts:119`

### Auto-Match Threshold

Configured at 85% minimum for automatic linking → `src/lib/banking/reconciliation-config.ts:1`:

```typescript
export const AUTO_MATCH_THRESHOLD = 85
export const PARTIAL_MATCH_THRESHOLD = 70
```

### Ambiguity Detection

If two invoices have identical top scores, system marks as AMBIGUOUS and requires manual review → `src/lib/banking/reconciliation.ts:30-38`:

```typescript
if (topMatch && secondMatch && topMatch.score > 0 && secondMatch.score === topMatch.score) {
  return {
    matchedInvoiceId: null,
    matchStatus: "ambiguous",
    confidenceScore: topMatch.score,
    reason: "Multiple invoices match with the same score",
  }
}
```

## Match Status Tracking

### Status Enum

Four distinct statuses track reconciliation state → `prisma/schema.prisma:872-877`:

```prisma
enum MatchStatus {
  UNMATCHED       // No match found, awaiting review
  AUTO_MATCHED    // Automatically matched by algorithm (≥85%)
  MANUAL_MATCHED  // Manually confirmed by user
  IGNORED         // Marked to skip (not currently used)
}
```

### Status Display

UI shows color-coded badges for each status → `src/app/(dashboard)/banking/transactions/page.tsx:12-24`:

| Status         | Label               | Color  | Meaning         |
| -------------- | ------------------- | ------ | --------------- |
| UNMATCHED      | Nepovezano          | Orange | Needs attention |
| AUTO_MATCHED   | Automatski povezano | Green  | AI matched      |
| MANUAL_MATCHED | Ručno povezano      | Blue   | User confirmed  |
| IGNORED        | Ignorirano          | Gray   | Skipped         |

### Status Transitions

```
UNMATCHED → AUTO_MATCHED   (via auto-match if score ≥85%)
UNMATCHED → MANUAL_MATCHED (via user clicking "Poveži")
UNMATCHED → IGNORED        (future feature)
```

## Data Models

### BankTransaction

Primary transaction record with matching metadata → `prisma/schema.prisma:461-492`:

```prisma
model BankTransaction {
  id               String      @id @default(cuid())
  companyId        String
  bankAccountId    String
  date             DateTime
  description      String
  amount           Decimal     @db.Decimal(12, 2)
  balance          Decimal     @db.Decimal(12, 2)
  reference        String?
  counterpartyName String?
  counterpartyIban String?

  // Matching fields
  matchedInvoiceId String?
  matchedExpenseId String?
  matchStatus      MatchStatus @default(UNMATCHED)
  matchedAt        DateTime?
  matchedBy        String?
  confidenceScore  Int?

  // Bank Sync fields
  externalId       String?
  source           TransactionSource @default(MANUAL)
  createdAt        DateTime    @default(now())

  bankAccount      BankAccount @relation(...)
  matchedInvoice   EInvoice?   @relation(...)
  matchedExpense   Expense?    @relation(...)
}
```

### BankAccount

Account record linking transactions → `prisma/schema.prisma:430-450`:

Key fields:

- `iban` - Croatian IBAN format (HR + 19 digits)
- `currency` - Default EUR
- `currentBalance` - Updated after each import
- `lastSyncAt` - Timestamp of last import

### BankImport

Import history tracking → `prisma/schema.prisma:626-639`:

```prisma
model BankImport {
  id               String       @id @default(cuid())
  companyId        String
  bankAccountId    String
  fileName         String
  format           ImportFormat
  transactionCount Int
  importedAt       DateTime     @default(now())
  importedBy       String
}
```

## CSV Import

### Supported Banks

Parser supports multiple Croatian banks with format-specific logic → `src/lib/banking/csv-parser.ts:12-18`:

- **erste** - Erste Bank format
- **raiffeisenbank** - Raiffeisenbank format
- **moja-banka** - Moja banka format
- **splitska** - Splitska banka format
- **otp** - OTP Banka format
- **generic** - Fallback parser for standard CSV

### Required CSV Columns

Generic format requires → `src/app/(dashboard)/banking/import/page.tsx:114-131`:

| Column Name       | Croatian        | Description                        | Required |
| ----------------- | --------------- | ---------------------------------- | -------- |
| date              | datum           | Transaction date (YYYY-MM-DD)      | Yes      |
| description       | opis            | Transaction description            | Yes      |
| amount            | iznos           | Amount (+ for credit, - for debit) | Yes      |
| balance           | stanje          | Account balance after transaction  | Yes      |
| reference         | referenca       | Bank reference number              | Optional |
| counterparty      | protivna_strana | Counterparty name                  | Optional |
| counterparty_iban | protivni_iban   | Counterparty IBAN                  | Optional |

### Parsing Features

**Date Format Detection** → `src/lib/banking/csv-parser.ts:133-158`:

- Supports DD.MM.YYYY, YYYY-MM-DD, DD/MM/YYYY
- Automatically detects format from content

**Decimal Separator Detection** → `src/lib/banking/csv-parser.ts:172-179`:

- Handles both comma (,) and period (.) as decimal
- Detects based on last occurrence in string

**Invoice Number Extraction** → `src/lib/banking/csv-parser.ts:181-192`:

- Regex patterns match common invoice formats
- Extracts "2025/43-1-1" from descriptions
- Patterns: `invoice #123`, `račun 2025/1`, `#123`

## Security

### Authentication & Authorization

1. **User Authentication** → `src/app/(dashboard)/banking/reconciliation/page.tsx:10`
   - Requires valid session via `requireAuth()`
   - Unauthenticated requests redirected to /login

2. **Company Context** → `src/app/(dashboard)/banking/reconciliation/page.tsx:11`
   - User must belong to company via `requireCompany()`
   - Multi-tenant isolation enforced

3. **Tenant Context** → `src/app/(dashboard)/banking/reconciliation/page.tsx:13-16`
   - Set on every database query
   - Prevents cross-company data access

4. **API Validation** → `src/app/api/banking/reconciliation/match/route.ts:31-44`
   - Transaction and invoice ownership verified
   - Company ID matched on all lookups

### Data Access Controls

**Transaction Filtering**:

```typescript
where: {
  id: transactionId,
  companyId: company.id  // Tenant isolation
}
```

→ `src/app/api/banking/reconciliation/match/route.ts:31-33`

**Invoice Filtering**:

```typescript
where: {
  id: invoiceId,
  companyId: company.id,
  direction: "OUTBOUND",
  paidAt: null
}
```

→ `src/app/api/banking/reconciliation/route.ts:74-79`

### Validation Rules

1. **Transaction Must Be Unmatchable** → `src/app/api/banking/reconciliation/match/route.ts:39-44`
   - Status must be UNMATCHED or IGNORED
   - Prevents re-matching already linked transactions

2. **Invoice Must Be Unpaid** → `src/app/api/banking/reconciliation/match/route.ts:54-59`
   - `paidAt` field must be null
   - Error: "Račun je već evidentiran kao plaćen"

3. **Positive Transactions Only** → `src/lib/banking/reconciliation-service.ts:53-56`
   - Only credits (positive amounts) matched to invoices
   - Debits (expenses) excluded from invoice matching

## UI Components

### Reconciliation Dashboard

**Location**: `/banking/reconciliation` → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx`

**Key Features**:

1. **Summary Cards** → lines 87-92
   - Nepovezano (Unmatched) count
   - Automatski (Auto-matched) count
   - Ručno (Manual-matched) count
   - Ignorirano (Ignored) count

2. **Filters** → lines 138-177
   - Bank account selector
   - Match status dropdown
   - Real-time data refresh via SWR

3. **Transaction Table** → lines 209-294
   - Date, description, amount display
   - Confidence score badge
   - Top candidate with score and reason
   - "Poveži" button for manual linking

**Loading States**:

- SWR handles automatic revalidation → line 56
- Loading spinner on match button → lines 270-272
- Status message feedback → lines 190-201

### Transaction List

**Location**: `/banking/transactions` → `src/app/(dashboard)/banking/transactions/page.tsx`

**Features**:

- Paginated list (50 per page) → line 47
- Filterable by account, status, date range → lines 56-77
- Status badges with color coding → lines 160-181
- Linked invoice number display → lines 171-175
- Responsive table with mobile cards → lines 342-394

### Import Page

**Location**: `/banking/import` → `src/app/(dashboard)/banking/import/page.tsx`

**Components**:

1. **ImportForm** - CSV upload with live preview → `import-form.tsx:25-319`
2. **StatementDropzone** - Drag-and-drop for PDF statements → `statement-dropzone.tsx`
3. **Import Instructions** - Documentation for CSV format → lines 109-160
4. **Recent Imports** - History table → lines 163-215

**Preview Table** → `import-form.tsx:248-310`:

- Shows first 100 transactions
- Color-coded amounts (green/red)
- Validates before submission
- Displays auto-match results in success message

## Invoice Status Updates

### Automatic Status Change

When transaction matches invoice, two updates occur → `src/lib/banking/reconciliation-service.ts:95-106`:

**Transaction Update**:

```typescript
{
  matchedInvoiceId: invoice.id,
  matchStatus: MatchStatus.AUTO_MATCHED,
  confidenceScore: result.confidenceScore,
  matchedAt: new Date(),
  matchedBy: userId
}
```

**Invoice Update**:

```typescript
{
  paidAt: transaction.date,  // Use transaction date, not current date
  status: "ACCEPTED"          // Mark as accepted/paid
}
```

### Manual Match Updates

Manual matching sets confidence to 100% → `src/app/api/banking/reconciliation/match/route.ts:61-78`:

```typescript
await db.bankTransaction.update({
  data: {
    matchedInvoiceId: invoice.id,
    matchStatus: "MANUAL_MATCHED",
    confidenceScore: 100,
    matchedAt: new Date(),
    matchedBy: user.id!,
  },
})
```

## Cache Management

System revalidates Next.js cache after matching operations to ensure UI consistency.

### Auto-Match Revalidation

After CSV import and auto-match → `src/lib/banking/reconciliation-service.ts:125-131`:

```typescript
revalidatePath("/banking")
revalidatePath("/banking/transactions")
revalidatePath("/banking/reconciliation")
revalidatePath("/e-invoices")
if (bankAccountId) {
  revalidatePath(`/banking/${bankAccountId}`)
}
```

### Manual Match Revalidation

After user confirms match → `src/app/api/banking/reconciliation/match/route.ts:80-87`:

```typescript
revalidatePath("/banking")
revalidatePath("/banking/transactions")
revalidatePath("/banking/reconciliation")
revalidatePath("/e-invoices")
revalidatePath(`/banking/${transaction.bankAccountId}`)
revalidatePath(`/e-invoices/${invoice.id}`)
```

## Error Handling

### Common Error Cases

1. **Transaction Not Found** → `src/app/api/banking/reconciliation/match/route.ts:35-37`
   - Message: "Transakcija nije pronađena"
   - Status: 404

2. **Already Matched** → `src/app/api/banking/reconciliation/match/route.ts:39-44`
   - Message: "Transakcija je već povezana"
   - Status: 400
   - Prevents duplicate matches

3. **Invoice Not Found** → `src/app/api/banking/reconciliation/match/route.ts:50-52`
   - Message: "Račun nije pronađen"
   - Status: 404

4. **Invoice Already Paid** → `src/app/api/banking/reconciliation/match/route.ts:54-59`
   - Message: "Račun je već evidentiran kao plaćen"
   - Status: 400

5. **Invalid CSV Format** → `src/app/(dashboard)/banking/import/import-form.tsx:55-59`
   - Message: "CSV datoteka mora sadržavati stupce: datum, opis, iznos, stanje"
   - Displayed in red alert box

6. **Parse Error** → `src/app/(dashboard)/banking/import/import-form.tsx:93`
   - Message: "Nevažeći podaci u retku {N}"
   - Prevents import submission

### Client-Side Error Display

ImportForm component shows errors in alert box → `src/app/(dashboard)/banking/import/import-form.tsx:180-184`:

```tsx
{
  error && (
    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">{error}</div>
  )
}
```

ReconciliationDashboard shows errors inline → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:203-207`:

```tsx
{
  error && (
    <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {(error as Error).message}
    </div>
  )
}
```

## Dependencies

- **Depends on**:
  - [[auth-login]] - User authentication required for all operations
  - [[company-management]] - Company context required for multi-tenancy
  - [[banking-accounts]] - Bank accounts must exist before import
  - [[e-invoicing-create]] - Invoices must exist to match against
  - [[invoicing-mark-paid]] - Uses same paid status update logic

- **Depended by**:
  - [[cash-flow-reporting]] - Relies on matched transaction data
  - [[receivables-aging]] - Payment dates from reconciliation
  - [[banking-dashboard]] - Summary statistics from match status

## Integrations

### Internal Systems

1. **Invoice Management** → `src/lib/banking/reconciliation-service.ts:40-47`
   - Queries unpaid OUTBOUND invoices
   - Updates `paidAt` and `status` fields
   - Maintains invoice history

2. **Multi-Tenancy** → `src/lib/auth-utils.ts:43-49`
   - Enforces company isolation
   - Sets tenant context on every query
   - Validates user permissions

3. **CSV Parsing** → `src/lib/banking/csv-parser.ts:27-192`
   - Multi-format bank statement support
   - Smart date/decimal detection
   - Invoice number extraction

4. **Cache Layer** → `next/cache`
   - Revalidates affected paths
   - Ensures UI consistency
   - Optimizes performance with SWR

## Verification Checklist

- [x] CSV import parses multiple bank formats correctly
- [x] Invoice number extracted from transaction descriptions
- [x] Auto-match runs after CSV import
- [x] Transactions with score ≥85% automatically matched
- [x] Matched invoices marked as paid with transaction date
- [x] UNMATCHED transactions visible in reconciliation dashboard
- [x] Dashboard shows confidence score for each transaction
- [x] Top 3 invoice candidates displayed per transaction
- [x] Manual match button appears for UNMATCHED status
- [x] Manual match updates status to MANUAL_MATCHED
- [x] Manual match sets confidence to 100%
- [x] Ambiguous matches (tied scores) marked appropriately
- [x] Transaction list filterable by account, status, date
- [x] Status badges color-coded correctly
- [x] Success message shows auto-match count
- [x] Cache revalidated after matching operations
- [x] Multi-tenant isolation enforced on all queries
- [x] Error messages displayed for invalid operations

## Evidence Links

1. `src/app/(dashboard)/banking/reconciliation/page.tsx:9-70` - Main reconciliation page with auth and data loading
2. `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:32-296` - Client component with filtering and manual matching
3. `src/lib/banking/reconciliation.ts:96-120` - Core scoring algorithm with three confidence tiers
4. `src/lib/banking/reconciliation-service.ts:15-137` - Auto-match service after CSV import
5. `src/app/api/banking/reconciliation/route.ts:19-148` - API endpoint for fetching transactions with candidates
6. `src/app/api/banking/reconciliation/match/route.ts:12-90` - API endpoint for manual match confirmation
7. `src/lib/banking/csv-parser.ts:27-192` - Multi-bank CSV parser with smart detection
8. `src/app/(dashboard)/banking/import/import-form.tsx:25-319` - CSV upload form with preview
9. `src/app/(dashboard)/banking/actions.ts:170-282` - Server action for statement import
10. `src/app/(dashboard)/banking/transactions/page.tsx:26-450` - Transaction list with filtering
11. `prisma/schema.prisma:461-492` - BankTransaction model with matching fields
12. `prisma/schema.prisma:872-877` - MatchStatus enum definition
13. `src/lib/banking/reconciliation-config.ts:1-2` - Auto-match threshold configuration
14. `src/lib/banking/reconciliation.ts:21-58` - Main matching function with ambiguity detection
15. `src/lib/banking/reconciliation.ts:60-77` - Candidate retrieval for UI display
16. `src/app/(dashboard)/banking/reconciliation/page.tsx:18-21` - Bank account loading for filters
17. `src/lib/banking/reconciliation-service.ts:95-106` - Invoice status update on auto-match
18. `src/app/api/banking/reconciliation/match/route.ts:61-78` - Manual match with 100% confidence
