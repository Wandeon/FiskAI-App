# Feature: View Bank Transactions (F040)

## Status

- Documentation: Complete
- Last verified: 2025-12-15
- Evidence count: 14

## Purpose

Provides a comprehensive view of all bank transactions imported from bank statements, enabling users to browse, filter, search, and manage transaction matching with invoices and expenses. The feature supports pagination, multi-criteria filtering, and displays connection status, match status, and reconciliation information. Users can view transaction details including counterparty information, amounts, balances, and linked documents.

## User Entry Points

| Type       | Path                      | Evidence                                            |
| ---------- | ------------------------- | --------------------------------------------------- |
| Navigation | `/banking/transactions`   | `src/lib/navigation.ts:52`                          |
| Dashboard  | `/banking` (Recent table) | `src/app/(dashboard)/banking/page.tsx:42-51`        |
| Import     | `/banking/import`         | `src/app/(dashboard)/banking/import/page.tsx:68-70` |

## Core Flow

### List View Flow

1. User accesses `/banking/transactions` route -> `src/app/(dashboard)/banking/transactions/page.tsx:26-36`
2. System validates authentication and company context -> `src/app/(dashboard)/banking/transactions/page.tsx:37-43`
3. System parses query parameters (accountId, status, dateFrom, dateTo, page) -> `src/app/(dashboard)/banking/transactions/page.tsx:45-48`
4. Fetch bank accounts for filter dropdown -> `src/app/(dashboard)/banking/transactions/page.tsx:51-54`
5. Build transaction filter with tenant isolation -> `src/app/(dashboard)/banking/transactions/page.tsx:57-77`
6. Query transactions with pagination (50 per page) -> `src/app/(dashboard)/banking/transactions/page.tsx:79-98`
7. Include related data: bank account, matched invoice, matched expense -> `src/app/(dashboard)/banking/transactions/page.tsx:82-92`
8. Display stats cards: total, unmatched, matched, ignored -> `src/app/(dashboard)/banking/transactions/page.tsx:287-323`
9. Render responsive table/card layout with transaction details -> `src/app/(dashboard)/banking/transactions/page.tsx:342-395`
10. Show pagination controls if multiple pages exist -> `src/app/(dashboard)/banking/transactions/page.tsx:398-420`

### Filter Flow

1. User selects filter criteria in form (account, status, date range) -> `src/app/(dashboard)/banking/transactions/page.tsx:213-284`
2. Filter options include all bank accounts and all match statuses -> `src/app/(dashboard)/banking/transactions/page.tsx:219-246`
3. Date range filters accept from/to dates -> `src/app/(dashboard)/banking/transactions/page.tsx:249-267`
4. Form submits via GET request with query parameters -> `src/app/(dashboard)/banking/transactions/page.tsx:215`
5. System rebuilds query with new filters -> `src/app/(dashboard)/banking/transactions/page.tsx:57-77`
6. Clear button removes all filters and redirects to base URL -> `src/app/(dashboard)/banking/transactions/page.tsx:274-280`

### Sync Status Flow

1. Transactions display source indicator (MANUAL vs AIS_SYNC) -> `prisma/schema.prisma:482`
2. Bank account shows connection status badge -> `src/app/(dashboard)/banking/components/connection-badge.tsx:1-44`
3. Connection statuses: MANUAL, CONNECTED, EXPIRED -> `prisma/schema.prisma:940-944`
4. Connected accounts show expiry warning if within 14 days -> `src/app/(dashboard)/banking/components/connection-badge.tsx:20-24`
5. Expired connections show amber warning badge -> `src/app/(dashboard)/banking/components/connection-badge.tsx:29-36`

### Match Status Display

1. Each transaction shows match status badge with color coding -> `src/app/(dashboard)/banking/transactions/page.tsx:160-180`
2. UNMATCHED: Orange badge, shows "Poveži" button -> `src/app/(dashboard)/banking/transactions/page.tsx:19-20,186-190`
3. AUTO_MATCHED: Green badge, displays matched invoice number -> `src/app/(dashboard)/banking/transactions/page.tsx:14,171-174`
4. MANUAL_MATCHED: Blue badge, displays matched document -> `src/app/(dashboard)/banking/transactions/page.tsx:15`
5. IGNORED: Gray badge, no action button -> `src/app/(dashboard)/banking/transactions/page.tsx:16,23`
6. Shows linked invoice number or expense description -> `src/app/(dashboard)/banking/transactions/page.tsx:171-178`

## Key Modules

| Module                   | Purpose                                         | Location                                                      |
| ------------------------ | ----------------------------------------------- | ------------------------------------------------------------- |
| TransactionsPage         | Main transaction list page with filtering       | `src/app/(dashboard)/banking/transactions/page.tsx`           |
| ResponsiveTable          | Adaptive table/card layout for transactions     | `src/components/ui/responsive-table.tsx`                      |
| ConnectionBadge          | Bank account connection status indicator        | `src/app/(dashboard)/banking/components/connection-badge.tsx` |
| importBankStatement      | Server action for CSV import with auto-match    | `src/app/(dashboard)/banking/actions.ts:170-278`              |
| runAutoMatchTransactions | Auto-matching service for reconciliation        | `src/lib/banking/reconciliation-service.ts:15-137`            |
| parseCSV                 | Bank statement CSV parser with bank formats     | `src/lib/banking/csv-parser.ts:26-39`                         |
| BankingPage              | Main banking dashboard with recent transactions | `src/app/(dashboard)/banking/page.tsx`                        |
| ImportPage               | Statement import page with instructions         | `src/app/(dashboard)/banking/import/page.tsx`                 |
| ImportForm               | Client-side import form with preview            | `src/app/(dashboard)/banking/import/import-form.tsx:24-200`   |

## Data

### Database Tables

#### BankTransaction Table

Primary transaction storage -> `prisma/schema.prisma:461-493`

Key fields:

- `id` (String, CUID): Unique identifier
- `companyId` (String): Tenant isolation
- `bankAccountId` (String): Bank account reference -> `prisma/schema.prisma:464`
- `date` (DateTime): Transaction date -> `prisma/schema.prisma:465`
- `description` (String): Transaction description -> `prisma/schema.prisma:466`
- `amount` (Decimal): Transaction amount (positive=credit, negative=debit) -> `prisma/schema.prisma:467`
- `balance` (Decimal): Running balance after transaction -> `prisma/schema.prisma:468`
- `reference` (String?): Bank reference number -> `prisma/schema.prisma:469`
- `counterpartyName` (String?): Counterparty name -> `prisma/schema.prisma:470`
- `counterpartyIban` (String?): Counterparty IBAN -> `prisma/schema.prisma:471`
- `matchedInvoiceId` (String?): Linked invoice ID -> `prisma/schema.prisma:472`
- `matchedExpenseId` (String?): Linked expense ID -> `prisma/schema.prisma:473`
- `matchStatus` (MatchStatus): UNMATCHED, AUTO_MATCHED, MANUAL_MATCHED, IGNORED -> `prisma/schema.prisma:474,872-877`
- `matchedAt` (DateTime?): When transaction was matched -> `prisma/schema.prisma:475`
- `matchedBy` (String?): User ID who matched -> `prisma/schema.prisma:476`
- `confidenceScore` (Int?): Auto-match confidence (0-100) -> `prisma/schema.prisma:478`
- `externalId` (String?): Provider transaction ID for deduplication -> `prisma/schema.prisma:481`
- `source` (TransactionSource): MANUAL or AIS_SYNC -> `prisma/schema.prisma:482,946-949`

Relations:

- `bankAccount` (BankAccount): Bank account reference -> `prisma/schema.prisma:484`
- `matchedExpense` (Expense?): Linked expense -> `prisma/schema.prisma:485`
- `matchedInvoice` (EInvoice?): Linked invoice -> `prisma/schema.prisma:486`

Indexes:

- `companyId`: Tenant filtering -> `prisma/schema.prisma:488`
- `bankAccountId`: Account filtering -> `prisma/schema.prisma:489`
- `matchStatus`: Status filtering -> `prisma/schema.prisma:490`
- `date`: Date-based queries -> `prisma/schema.prisma:491`
- `externalId`: Deduplication -> `prisma/schema.prisma:492`

#### BankAccount Table

Bank account information -> `prisma/schema.prisma:430-459`

Key fields:

- `id` (String, CUID): Unique identifier
- `companyId` (String): Tenant isolation
- `name` (String): Account display name
- `iban` (String): Account IBAN
- `bankName` (String): Bank institution name
- `currency` (String): Currency code, default EUR
- `currentBalance` (Decimal): Current account balance
- `lastSyncAt` (DateTime?): Last sync timestamp
- `isDefault` (Boolean): Whether this is the default account
- `syncProvider` (SyncProvider?): GOCARDLESS, PLAID, SALTEDGE -> `prisma/schema.prisma:444,934-938`
- `syncProviderAccountId` (String?): Provider's account ID
- `connectionStatus` (ConnectionStatus): MANUAL, CONNECTED, EXPIRED -> `prisma/schema.prisma:446,940-944`
- `connectionExpiresAt` (DateTime?): Connection expiry timestamp

#### BankImport Table

Import tracking -> `prisma/schema.prisma:626-639`

Key fields:

- `id` (String, CUID): Unique identifier
- `companyId` (String): Tenant isolation
- `bankAccountId` (String): Target bank account
- `fileName` (String): Original file name
- `format` (ImportFormat): CSV, XML_CAMT053, MT940 -> `prisma/schema.prisma:631,879-882`
- `transactionCount` (Int): Number of imported transactions
- `importedAt` (DateTime): Import timestamp
- `importedBy` (String): User ID who imported

### Query Patterns

#### Transaction List Query

Fetches transactions with filtering and pagination -> `src/app/(dashboard)/banking/transactions/page.tsx:79-98`

```typescript
const [transactions, total] = await Promise.all([
  db.bankTransaction.findMany({
    where: {
      companyId: company.id,
      ...(accountId && { bankAccountId: accountId }),
      ...(status && { matchStatus: status as MatchStatus }),
      ...(dateFrom || dateTo
        ? {
            date: {
              ...(dateFrom && { gte: new Date(dateFrom) }),
              ...(dateTo && { lte: new Date(dateTo) }),
            },
          }
        : {}),
    },
    include: {
      bankAccount: { select: { name: true, currency: true } },
      matchedInvoice: { select: { invoiceNumber: true } },
      matchedExpense: { select: { id: true, description: true } },
    },
    orderBy: { date: "desc" },
    take: 50,
    skip: (page - 1) * 50,
  }),
  db.bankTransaction.count({ where }),
])
```

#### Recent Transactions Query

Dashboard recent activity -> `src/app/(dashboard)/banking/page.tsx:42-51`

```typescript
const recentTransactions = await db.bankTransaction.findMany({
  where: { companyId: company.id },
  include: {
    bankAccount: { select: { name: true } },
  },
  orderBy: { date: "desc" },
  take: 10,
})
```

#### Import Transaction Creation

Create transactions from CSV import -> `src/app/(dashboard)/banking/actions.ts:224-242`

```typescript
await db.bankTransaction.create({
  data: {
    companyId: company.id,
    bankAccountId: accountId,
    date: new Date(txn.date),
    description: txn.description,
    amount: parseFloat(txn.amount),
    balance: parseFloat(txn.balance),
    reference: txn.reference || null,
    counterpartyName: txn.counterpartyName || null,
    counterpartyIban: txn.counterpartyIban || null,
    matchStatus: "UNMATCHED",
    confidenceScore: 0,
  },
})
```

### Status Labels

Croatian translations for match statuses -> `src/app/(dashboard)/banking/transactions/page.tsx:12-17`

```typescript
const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  UNMATCHED: "Nepovezano",
  AUTO_MATCHED: "Automatski povezano",
  MANUAL_MATCHED: "Ručno povezano",
  IGNORED: "Ignorirano",
}
```

Status color coding -> `src/app/(dashboard)/banking/transactions/page.tsx:19-24`

```typescript
const MATCH_STATUS_COLORS: Record<MatchStatus, string> = {
  UNMATCHED: "bg-orange-100 text-orange-800",
  AUTO_MATCHED: "bg-green-100 text-green-800",
  MANUAL_MATCHED: "bg-blue-100 text-blue-800",
  IGNORED: "bg-gray-100 text-gray-800",
}
```

## Dependencies

### Depends On

- **Authentication System**: User and company context -> `src/lib/auth-utils.ts:requireAuth, requireCompany`
- **Tenant Context**: Multi-tenant data isolation -> `src/lib/prisma-extensions.ts:setTenantContext`
- **Bank Account Management**: Account data and configuration -> `prisma/schema.prisma:BankAccount`
- **Invoice System**: Matching transactions to outbound invoices -> `prisma/schema.prisma:EInvoice`
- **Expense System**: Matching transactions to expenses -> `prisma/schema.prisma:Expense`
- **Responsive UI**: Adaptive table component -> `src/components/ui/responsive-table.tsx`

### Depended By

- **Bank Reconciliation**: Uses transaction data for matching -> `src/app/(dashboard)/banking/reconciliation/page.tsx`
- **Banking Dashboard**: Displays recent transactions -> `src/app/(dashboard)/banking/page.tsx:42-51`
- **Auto-Match Service**: Updates match status and links -> `src/lib/banking/reconciliation-service.ts`
- **Import Process**: Creates transactions from statements -> `src/app/(dashboard)/banking/actions.ts:170-278`

## Integrations

### Internal Integrations

#### Navigation System

Main banking navigation -> `src/lib/navigation.ts:52`

```typescript
{ name: "Banka", href: "/banking", icon: Building2, module: "banking" }
```

#### Import Integration

Statement import flow -> `src/app/(dashboard)/banking/import/page.tsx:68-70`

- Imports CSV files with transaction data
- Validates format and data structure
- Parses multiple bank formats (Erste, Raiffeisenbank, generic)
- Auto-matches transactions to invoices after import
- Updates account balance from last transaction
- Redirects to transactions page after successful import

Import action flow -> `src/app/(dashboard)/banking/actions.ts:170-278`

1. Validates account and file data
2. Parses transaction JSON from form
3. Creates BankImport record for tracking
4. Inserts all transactions with UNMATCHED status
5. Updates bank account balance and lastSyncAt
6. Triggers auto-match reconciliation
7. Returns import ID and statistics

#### Auto-Match Reconciliation

Automatic transaction matching -> `src/lib/banking/reconciliation-service.ts:15-137`

- Runs after CSV import automatically
- Matches positive (credit) transactions to unpaid invoices
- Uses reference number, amount, and date for matching
- Applies confidence threshold (default 85%)
- Updates transaction status to AUTO_MATCHED if confident
- Marks invoice as PAID with transaction date
- Supports manual threshold override

Matching criteria -> `src/lib/banking/reconciliation-service.ts:70-83`

```typescript
const shouldAutoMatch =
  result.matchStatus === "matched" &&
  result.confidenceScore >= threshold &&
  !!result.matchedInvoiceId
```

#### Responsive Layout

Adaptive display for mobile and desktop -> `src/app/(dashboard)/banking/transactions/page.tsx:342-395`

Desktop view (table):

- Shows all columns: date, account, description, amount, balance, status, actions
- Fixed column headers with sorting
- Hover effects on rows
- Truncated descriptions with ellipsis

Mobile view (cards):

- Stacked card layout with all information
- Date formatted with short month
- Counterparty name below description
- Amount and balance prominently displayed
- Status badge and action button at bottom

#### Banking Dashboard Integration

Recent transactions widget -> `src/app/(dashboard)/banking/page.tsx:169-266`

- Shows last 10 transactions across all accounts
- Displays in table format with key columns
- Links to full transactions list
- Shows unmatched count in stats
- Provides quick access to import function

### External Integrations

#### Bank Sync Providers

Supports multiple AIS providers -> `prisma/schema.prisma:934-938`

- **GoCardless**: European bank connections via PSD2
- **Plaid**: North American bank connections
- **SaltEdge**: Global bank connections

Connection tracking -> `prisma/schema.prisma:495-519`

- Stores provider connection ID and credentials
- Tracks authorization and expiry dates
- Monitors connection status and errors
- Links to specific bank account
- Enables automatic transaction sync

Transaction source tracking -> `prisma/schema.prisma:482,946-949`

- `MANUAL`: CSV/PDF uploaded by user
- `AIS_SYNC`: Fetched from bank API provider
- External ID stored for deduplication

#### CSV Parser

Multi-bank format support -> `src/lib/banking/csv-parser.ts:11-18,26-39`

Supported banks:

- Erste Bank Croatia
- Raiffeisenbank Croatia
- Generic CSV format

Parser features:

- Auto-detects date format (DD.MM.YYYY, YYYY-MM-DD)
- Handles decimal separators (comma and period)
- Extracts invoice numbers from descriptions
- Parses counterparty IBAN and name
- Validates data before import

## Verification Checklist

### List View

- [ ] User can access transactions via `/banking/transactions`
- [ ] All transactions are filtered by company ID (tenant isolation)
- [ ] Pagination displays 50 transactions per page
- [ ] Filters work: bank account, match status, date range
- [ ] Clear filters button resets to base URL
- [ ] Transactions ordered by date descending
- [ ] Mobile view displays as cards instead of table
- [ ] Desktop view shows full table with all columns
- [ ] Empty state displays when no transactions found
- [ ] Transaction count stats display correctly (total, unmatched, matched, ignored)

### Transaction Display

- [ ] Date displays in Croatian format (dd.mm.yyyy)
- [ ] Bank account name shows correctly
- [ ] Description truncates with ellipsis on long text
- [ ] Counterparty name displays if present
- [ ] Counterparty IBAN displays if present in monospace font
- [ ] Amount shows with correct color (green for positive, red for negative)
- [ ] Amount prefixed with + for positive values
- [ ] Balance displays in monospace font
- [ ] Currency formatting uses hr-HR locale
- [ ] Match status badge shows with correct color

### Match Status

- [ ] UNMATCHED shows orange badge "Nepovezano"
- [ ] AUTO_MATCHED shows green badge "Automatski povezano"
- [ ] MANUAL_MATCHED shows blue badge "Ručno povezano"
- [ ] IGNORED shows gray badge "Ignorirano"
- [ ] Matched transactions display linked invoice number
- [ ] Matched transactions display linked expense description
- [ ] "Poveži" button appears only for UNMATCHED transactions
- [ ] Confidence score stored for auto-matched transactions

### Filtering

- [ ] Account filter dropdown shows all company accounts
- [ ] Status filter dropdown shows all match statuses
- [ ] Date from filter accepts and applies correctly
- [ ] Date to filter accepts and applies correctly
- [ ] Multiple filters combine correctly (AND logic)
- [ ] Filter form preserves values after submission
- [ ] Clear button removes all active filters
- [ ] Pagination resets to page 1 when filters change

### Import Integration

- [ ] Import page accessible from transactions list
- [ ] CSV import creates transactions with UNMATCHED status
- [ ] Auto-match runs automatically after import
- [ ] High-confidence matches (≥85%) auto-link to invoices
- [ ] Matched invoices marked as PAID with transaction date
- [ ] Account balance updates from last transaction
- [ ] Import record created for tracking
- [ ] Transaction count matches imported rows
- [ ] Validation errors display clearly

### Sync Status

- [ ] MANUAL accounts show "Ručni uvoz" badge
- [ ] CONNECTED accounts show green "Povezano" badge with dot
- [ ] EXPIRED accounts show amber "Isteklo" badge
- [ ] Connection expiry warning shows within 14 days
- [ ] External ID stored for AIS_SYNC transactions
- [ ] Source field distinguishes manual vs synced transactions
- [ ] Deduplication prevents duplicate AIS imports

### Data Integrity

- [ ] All queries filter by companyId (tenant isolation)
- [ ] Amount precision maintained (Decimal 12,2)
- [ ] Balance precision maintained (Decimal 12,2)
- [ ] Date stored as DateTime with timezone
- [ ] IBAN format validated before import
- [ ] Transaction references stored correctly
- [ ] Match relationships maintain referential integrity
- [ ] Deleted bank accounts cascade to transactions

### Responsive Design

- [ ] Table hidden on mobile (< md breakpoint)
- [ ] Cards hidden on desktop (≥ md breakpoint)
- [ ] Cards show all transaction information
- [ ] Card layout maintains readability on small screens
- [ ] Filter form responsive on mobile
- [ ] Stats cards stack on mobile
- [ ] Pagination controls accessible on mobile

## Evidence Links

1. `src/app/(dashboard)/banking/transactions/page.tsx:26-450` - Main transactions list page with filtering and pagination
2. `prisma/schema.prisma:461-493` - BankTransaction table schema with all fields and relations
3. `prisma/schema.prisma:430-459` - BankAccount table schema with sync fields
4. `src/app/(dashboard)/banking/actions.ts:170-278` - Import bank statement server action
5. `src/lib/banking/reconciliation-service.ts:15-137` - Auto-match transaction reconciliation service
6. `src/lib/banking/csv-parser.ts:26-99` - CSV parser with multi-bank format support
7. `src/app/(dashboard)/banking/page.tsx:42-51` - Banking dashboard recent transactions query
8. `src/app/(dashboard)/banking/import/page.tsx:1-219` - Import page with instructions and recent imports
9. `src/components/ui/responsive-table.tsx:1-50` - Responsive table component for adaptive layout
10. `src/app/(dashboard)/banking/components/connection-badge.tsx:1-44` - Connection status badge component
11. `src/lib/navigation.ts:52` - Banking navigation menu entry
12. `prisma/schema.prisma:872-877` - MatchStatus enum definition
13. `prisma/schema.prisma:934-949` - Sync provider and connection status enums
14. `src/app/(dashboard)/banking/import/import-form.tsx:24-200` - Client-side import form with preview
