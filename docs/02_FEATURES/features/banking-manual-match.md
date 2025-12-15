# Feature: Manual Transaction Matching

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 12

## Purpose

Manual Transaction Matching enables users to manually link bank transactions to expenses or invoices when automatic matching fails or when the confidence score is below the auto-match threshold (85%). This feature provides full control over the reconciliation process, allowing users to review suggested matches, confirm connections, and unlink previously matched transactions. It serves as a critical fallback mechanism for complex or ambiguous transaction matching scenarios.

## User Entry Points

| Type           | Path                              | Evidence                                                                 |
| -------------- | --------------------------------- | ------------------------------------------------------------------------ |
| Reconciliation | /banking/reconciliation           | `src/app/(dashboard)/banking/reconciliation/page.tsx:24-70`              |
| Match Button   | ReconciliationDashboard           | `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:94-118` |
| Server Action  | manuallyLinkExpense               | `src/app/actions/expense-reconciliation.ts:70-93`                        |
| Server Action  | unlinkExpense                     | `src/app/actions/expense-reconciliation.ts:98-113`                       |
| API Endpoint   | /api/banking/reconciliation/match | `src/app/api/banking/reconciliation/match/route.ts:12-90`                |

## Core Flow

### Manual Expense Matching

1. User navigates to reconciliation dashboard → `src/app/(dashboard)/banking/reconciliation/page.tsx:9-70`
2. System loads unmatched transactions with expense candidates → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:47-85`
3. For each transaction, AI calculates match scores against unpaid expenses → `src/lib/banking/expense-reconciliation.ts:30-68`
4. System displays top 3 expense candidates with confidence scores → `src/lib/banking/expense-reconciliation.ts:70-88`
5. User reviews candidate list with scores and reasons → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:224-263`
6. User clicks "Poveži" button on desired match → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:268`
7. Client calls handleMatch function with transaction and expense IDs → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:94-118`
8. Server action `manuallyLinkExpense` validates both records belong to company → `src/app/actions/expense-reconciliation.ts:75-83`
9. Transaction updated with MANUAL_MATCHED status, confidence score 100 → `src/lib/banking/expense-reconciliation-service.ts:214-223`
10. Expense marked as PAID with transaction date as payment date → `src/lib/banking/expense-reconciliation-service.ts:225-232`
11. Success message displayed: "Transakcija je povezana s računom" → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:110`
12. Dashboard refreshes to show updated match status → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:111`

### Manual Invoice Matching

1. User navigates to reconciliation dashboard → `src/app/(dashboard)/banking/reconciliation/page.tsx:9-70`
2. System filters credit transactions (positive amounts) for invoice matching → `src/app/api/banking/reconciliation/route.ts:86-94`
3. System displays invoice candidates with confidence scores → `src/app/api/banking/reconciliation/route.ts:96-137`
4. User clicks "Poveži" button to link transaction to invoice → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:265-276`
5. API endpoint validates transaction is unmatched or ignored → `src/app/api/banking/reconciliation/match/route.ts:39-44`
6. Invoice validation checks if already paid → `src/app/api/banking/reconciliation/match/route.ts:54-59`
7. Transaction updated with MANUAL_MATCHED status and invoice link → `src/app/api/banking/reconciliation/match/route.ts:61-70`
8. Invoice marked as ACCEPTED with paidAt timestamp → `src/app/api/banking/reconciliation/match/route.ts:72-78`
9. Multiple cache paths revalidated → `src/app/api/banking/reconciliation/match/route.ts:80-87`

### Unlinking Transactions

1. User identifies incorrectly matched transaction → `src/lib/banking/expense-reconciliation-service.ts:253-303`
2. User triggers unlink action via server action → `src/app/actions/expense-reconciliation.ts:98-113`
3. System validates transaction belongs to company → `src/lib/banking/expense-reconciliation-service.ts:258-265`
4. Transaction match status reset to UNMATCHED → `src/lib/banking/expense-reconciliation-service.ts:270-279`
5. Linked expense status reverted to PENDING, paymentDate cleared → `src/lib/banking/expense-reconciliation-service.ts:282-289`
6. Logger records unlink event → `src/lib/banking/expense-reconciliation-service.ts:292`
7. Cache paths revalidated → `src/lib/banking/expense-reconciliation-service.ts:294-296`

## Key Modules

| Module                       | Purpose                                             | Location                                                          |
| ---------------------------- | --------------------------------------------------- | ----------------------------------------------------------------- |
| ReconciliationPage           | Server component rendering reconciliation dashboard | `src/app/(dashboard)/banking/reconciliation/page.tsx`             |
| ReconciliationDashboard      | Client component with match UI and interactions     | `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx` |
| manuallyLinkExpense          | Server action to link transaction to expense        | `src/app/actions/expense-reconciliation.ts:70-93`                 |
| unlinkExpense                | Server action to unlink transaction from expense    | `src/app/actions/expense-reconciliation.ts:98-113`                |
| linkTransactionToExpense     | Service function for expense linking logic          | `src/lib/banking/expense-reconciliation-service.ts:189-248`       |
| unlinkTransactionFromExpense | Service function for unlinking logic                | `src/lib/banking/expense-reconciliation-service.ts:253-303`       |
| getSuggestedExpenses         | Service function to get expense match candidates    | `src/lib/banking/expense-reconciliation-service.ts:144-184`       |
| matchTransactionsToExpenses  | Core AI matching algorithm for expenses             | `src/lib/banking/expense-reconciliation.ts:30-68`                 |
| API Match Route              | API endpoint for manual invoice matching            | `src/app/api/banking/reconciliation/match/route.ts`               |

## Data

### Tables

- **BankTransaction** → `prisma/schema.prisma:461-493`
  - Stores bank transaction data with match status and linked records
- **Expense** → `prisma/schema.prisma:345-374`
  - Stores expense data, updated when matched to transaction
- **EInvoice** → Used for invoice matching (referenced in match route)

### Key Fields

| Table           | Field            | Type          | Purpose                                           | Evidence                   |
| --------------- | ---------------- | ------------- | ------------------------------------------------- | -------------------------- |
| BankTransaction | matchStatus      | MatchStatus   | Current match status (MANUAL_MATCHED when linked) | `prisma/schema.prisma:474` |
| BankTransaction | matchedExpenseId | String?       | Foreign key to linked Expense                     | `prisma/schema.prisma:473` |
| BankTransaction | matchedInvoiceId | String?       | Foreign key to linked EInvoice                    | `prisma/schema.prisma:472` |
| BankTransaction | confidenceScore  | Int?          | Match confidence (100 for manual matches)         | `prisma/schema.prisma:478` |
| BankTransaction | matchedAt        | DateTime?     | Timestamp when match was created                  | `prisma/schema.prisma:475` |
| BankTransaction | matchedBy        | String?       | User ID who created the match                     | `prisma/schema.prisma:476` |
| Expense         | status           | ExpenseStatus | Changes to PAID when matched                      | `prisma/schema.prisma:358` |
| Expense         | paymentDate      | DateTime?     | Set to transaction date when matched              | `prisma/schema.prisma:360` |

### Match Status Enum

```prisma
enum MatchStatus {
  UNMATCHED       // Not yet matched
  AUTO_MATCHED    // Automatically matched (score ≥ 85%)
  MANUAL_MATCHED  // Manually linked by user
  IGNORED         // User chose to ignore
}
```

Evidence: `prisma/schema.prisma:872-877`

### Match Status Flow

```
UNMATCHED → MANUAL_MATCHED → UNMATCHED (via unlink)
    ↓
IGNORED
```

## Business Rules

### Manual Match Eligibility

1. **Transaction Must Be Unmatched** → `src/app/api/banking/reconciliation/match/route.ts:39-44`
   - Transaction status must be UNMATCHED or IGNORED
   - Error: "Transakcija je već povezana"

2. **Expense Must Be Unpaid** → `src/lib/banking/expense-reconciliation-service.ts:161-165`
   - Expense status must be DRAFT or PENDING
   - Expense must not have existing bank transaction link

3. **Invoice Must Not Be Paid** → `src/app/api/banking/reconciliation/match/route.ts:54-59`
   - Invoice paidAt field must be null
   - Error: "Račun je već evidentiran kao plaćen"

4. **Tenant Security** → `src/app/actions/expense-reconciliation.ts:75-76`
   - Both transaction and expense/invoice must belong to same company
   - Automatically enforced via tenant context

### Confidence Score Calculation

**Expense Matching Algorithm** → `src/lib/banking/expense-reconciliation.ts:108-146`

1. **Vendor + Amount Match (100%)** → `src/lib/banking/expense-reconciliation.ts:123-125`
   - Vendor name found in transaction description
   - Exact amount match (delta < 1)
   - Date within 7 days

2. **Amount + Date Match (85%)** → `src/lib/banking/expense-reconciliation.ts:128-130`
   - Exact amount match (delta < 1)
   - Date within 3 days

3. **Amount Tolerance Match (70%)** → `src/lib/banking/expense-reconciliation.ts:132-138`
   - Amount within 5% tolerance
   - Date within 5 days

4. **Vendor Name Only (50%)** → `src/lib/banking/expense-reconciliation.ts:141-143`
   - Vendor name found in description
   - Date within 14 days

### Manual Match Behavior

**When Transaction Is Manually Linked:**

- Match status set to `MANUAL_MATCHED` → `src/lib/banking/expense-reconciliation-service.ts:217`
- Confidence score set to 100 (manual = certain) → `src/lib/banking/expense-reconciliation-service.ts:220`
- matchedAt timestamp recorded → `src/lib/banking/expense-reconciliation-service.ts:218`
- matchedBy set to current user ID → `src/lib/banking/expense-reconciliation-service.ts:219`
- Expense status changed to PAID → `src/lib/banking/expense-reconciliation-service.ts:229`
- Expense paymentDate set to transaction date (not current date) → `src/lib/banking/expense-reconciliation-service.ts:230`

**When Transaction Is Unlinked:**

- Match status reset to `UNMATCHED` → `src/lib/banking/expense-reconciliation-service.ts:273`
- All match metadata cleared (matchedAt, matchedBy, confidenceScore) → `src/lib/banking/expense-reconciliation-service.ts:274-277`
- Expense status reverted to PENDING → `src/lib/banking/expense-reconciliation-service.ts:286`
- Expense paymentDate cleared → `src/lib/banking/expense-reconciliation-service.ts:287`

## UI Components

### Reconciliation Dashboard

**Visual Design:**

- Account selector dropdown → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:146-160`
- Status filter dropdown (UNMATCHED, AUTO_MATCHED, MANUAL_MATCHED, IGNORED) → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:161-176`
- Summary cards showing counts by status → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:179-188`
- Transaction table with candidate suggestions → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:209-294`

**Table Columns:**

- Datum (Date) - Transaction date in Croatian format
- Opis (Description) - Transaction description and counterparty
- Iznos (Amount) - Transaction amount with currency
- Prag (Threshold) - Confidence score badge
- Kandidat (Candidate) - Top suggested match with details
- Akcija (Action) - "Poveži" button

Evidence: `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:214-221`

### Match Button

**Visual Design:**

- Button labeled "Poveži" (Connect) → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:273`
- Disabled when no candidates available → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:267`
- Loading state with spinner during match → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:270-274`
- Size: sm (small button)

Evidence: `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:265-276`

### Candidate Display

**Visual Design:**

- Invoice number or expense description → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:254`
- Amount with currency and confidence score → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:255-257`
- Match reason explanation → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:258`
- Gray placeholder when no candidates: "Nema kandidata" → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:261`

Evidence: `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:252-262`

### Confidence Score Badge

**Visual Design:**

- Small badge with gray background → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:245-249`
- Displays percentage (e.g., "85%")
- Located in "Prag" (Threshold) column

Evidence: `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:244-250`

## User Feedback

### Success Messages

1. **Manual Link Success** → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:109-110`
   - Message: "Transakcija je povezana s računom"
   - Type: Success (green with CheckCircle icon)
   - Duration: Brief toast notification

2. **Unlink Success** → `src/lib/banking/expense-reconciliation-service.ts:298`
   - Returns `{ success: true }` to caller
   - Logger info message: "Unlinked transaction from expense" → `src/lib/banking/expense-reconciliation-service.ts:292`

### Error Messages

1. **Transaction Not Found** → `src/lib/banking/expense-reconciliation-service.ts:206-208`
   - Message: "Transakcija nije pronađena"
   - Occurs when transaction doesn't exist or belongs to different company

2. **Expense Not Found** → `src/lib/banking/expense-reconciliation-service.ts:209-211`
   - Message: "Trošak nije pronađen"
   - Occurs when expense doesn't exist or belongs to different company

3. **Link Failed** → `src/lib/banking/expense-reconciliation-service.ts:246`
   - Message: "Greška pri povezivanju"
   - Generic error for unexpected failures

4. **Unlink Failed** → `src/lib/banking/expense-reconciliation-service.ts:301`
   - Message: "Greška pri odspajanju"
   - Generic error for unexpected failures

5. **Match Error** → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:113-114`
   - Displays error message from API response
   - Type: Error (red with AlertCircle icon)

6. **Already Matched** → `src/app/api/banking/reconciliation/match/route.ts:41-42`
   - Message: "Transakcija je već povezana"
   - Prevents duplicate matching

7. **Invoice Already Paid** → `src/app/api/banking/reconciliation/match/route.ts:55-58`
   - Message: "Račun je već evidentiran kao plaćen"
   - Prevents matching to already paid invoices

### Visual Feedback

- Loading spinner on match button during processing → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:270-272`
- Status message banner with color-coded background → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:190-201`
- Table auto-refreshes after successful match → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:111`
- "Ažuriranje..." message during data revalidation → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:290-292`

## Dependencies

- **Depends on**:
  - [[auth-session]] - User authentication required
  - [[banking-accounts]] - Bank accounts must exist
  - [[banking-transactions]] - Transactions must be imported
  - [[expenses-create]] - Expenses must exist for matching
  - [[expense-reconciliation-algorithm]] - AI matching score calculation
  - Database migration `20251211_add_banking` - Created BankTransaction table → `prisma/migrations/20251211_add_banking/migration.sql`
  - Prisma Client - Database access and types
  - SWR - Client-side data fetching and caching

- **Depended by**:
  - [[banking-reconciliation-dashboard]] - Primary UI for manual matching
  - [[expense-payment-tracking]] - Updates expense payment status
  - [[invoice-payment-tracking]] - Updates invoice payment status
  - [[banking-transaction-list]] - Displays match status

## Integrations

### Database Migration

Created BankTransaction table with match tracking fields:

```sql
CREATE TABLE "BankTransaction" (
    "matchedInvoiceId" TEXT,
    "matchedExpenseId" TEXT,
    "matchStatus" "MatchStatus" NOT NULL DEFAULT 'UNMATCHED',
    "matchedAt" TIMESTAMP(3),
    "matchedBy" TEXT,
    "confidenceScore" INTEGER,
    ...
);
```

Evidence: `prisma/migrations/20251211_add_banking/migration.sql:25-44`

### Foreign Key Relationships

Transaction linked to Expense and Invoice:

```sql
ALTER TABLE "BankTransaction"
  ADD CONSTRAINT "BankTransaction_matchedExpenseId_fkey"
  FOREIGN KEY ("matchedExpenseId") REFERENCES "Expense"("id")
  ON DELETE SET NULL;

ALTER TABLE "BankTransaction"
  ADD CONSTRAINT "BankTransaction_matchedInvoiceId_fkey"
  FOREIGN KEY ("matchedInvoiceId") REFERENCES "EInvoice"("id")
  ON DELETE SET NULL;
```

Evidence: `prisma/migrations/20251211_add_banking/migration.sql:79-80`

### Expense Payment Integration

When transaction is manually matched to expense:

1. Expense status changes from DRAFT/PENDING to PAID → `src/lib/banking/expense-reconciliation-service.ts:229`
2. Expense paymentDate set to transaction date → `src/lib/banking/expense-reconciliation-service.ts:230`
3. Expense paymentMethod automatically set to TRANSFER (bank payment) → Referenced in expenses-mark-paid feature
4. Multiple cache paths revalidated → `src/lib/banking/expense-reconciliation-service.ts:239-241`

Evidence: `src/lib/banking/expense-reconciliation-service.ts:225-241`

### AI Matching Algorithm

Manual matching leverages same algorithm as auto-matching:

- Scores calculated using vendor name matching → `src/lib/banking/expense-reconciliation.ts:118-120`
- Amount comparison with tolerance → `src/lib/banking/expense-reconciliation.ts:112-114`
- Date proximity scoring → `src/lib/banking/expense-reconciliation.ts:115`
- String normalization removes diacritics for Croatian text → `src/lib/banking/expense-reconciliation.ts:153-160`

Evidence: `src/lib/banking/expense-reconciliation.ts:108-146`

## Verification Checklist

- [x] User can access reconciliation dashboard at /banking/reconciliation
- [x] Dashboard displays unmatched transactions by default
- [x] System shows top 3 expense/invoice candidates per transaction
- [x] Confidence scores calculated and displayed as percentage badges
- [x] Match reason explains why candidate was suggested
- [x] "Poveži" button enables manual linking
- [x] Button disabled when no candidates available
- [x] Loading spinner shown during match operation
- [x] Success message displayed after successful match
- [x] Transaction status changes to MANUAL_MATCHED
- [x] Expense status changes to PAID after match
- [x] Expense paymentDate set to transaction date (not current)
- [x] Confidence score set to 100 for manual matches
- [x] User can unlink previously matched transactions
- [x] Expense reverts to PENDING status when unlinked
- [x] Error messages shown for invalid operations
- [x] Multiple cache paths revalidated after changes
- [x] Tenant isolation prevents cross-company matching

## Evidence Links

1. `src/app/(dashboard)/banking/reconciliation/page.tsx:9-70` - Reconciliation page server component
2. `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:32-297` - Client dashboard with match UI
3. `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:94-118` - handleMatch function implementation
4. `src/app/actions/expense-reconciliation.ts:70-93` - manuallyLinkExpense server action
5. `src/app/actions/expense-reconciliation.ts:98-113` - unlinkExpense server action
6. `src/lib/banking/expense-reconciliation-service.ts:189-248` - linkTransactionToExpense service function
7. `src/lib/banking/expense-reconciliation-service.ts:253-303` - unlinkTransactionFromExpense service function
8. `src/lib/banking/expense-reconciliation.ts:30-68` - matchTransactionsToExpenses AI algorithm
9. `src/lib/banking/expense-reconciliation.ts:70-88` - getExpenseCandidates function
10. `src/app/api/banking/reconciliation/match/route.ts:12-90` - API endpoint for invoice matching
11. `prisma/schema.prisma:461-493` - BankTransaction model with match fields
12. `prisma/migrations/20251211_add_banking/migration.sql:25-44` - Database migration creating match infrastructure
