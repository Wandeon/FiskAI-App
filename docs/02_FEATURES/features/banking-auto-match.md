# Feature: Auto-Match Transactions (F043)

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 28

## Purpose

The Auto-Match Transactions feature automatically links bank transactions to invoices and expenses using intelligent matching algorithms based on amount, date, reference numbers, and vendor information. The system calculates confidence scores (0-100) for each potential match and automatically creates links when confidence exceeds configurable thresholds (default 85% for invoices, 85% for expenses). Transactions with lower confidence scores (70-84%) are flagged for manual review, while transactions below 70% remain unmatched. The feature supports both automatic matching during import and on-demand matching, significantly reducing manual reconciliation effort while maintaining accuracy through confidence-based decision making.

## User Entry Points

| Type     | Path                              | Evidence                                                |
| -------- | --------------------------------- | ------------------------------------------------------- |
| API      | /api/banking/reconciliation       | `src/app/api/banking/reconciliation/route.ts:19`        |
| API      | /api/banking/reconciliation/match | `src/app/api/banking/reconciliation/match/route.ts:12`  |
| Page     | /banking/reconciliation           | `src/app/(dashboard)/banking/reconciliation/page.tsx:9` |
| Action   | autoMatchTransactions             | `src/app/actions/banking.ts:443`                        |
| Action   | autoMatchExpenses                 | `src/app/actions/expense-reconciliation.ts:21`          |
| Function | runAutoMatchTransactions          | `src/lib/banking/reconciliation-service.ts:15`          |
| Function | runAutoMatchExpenses              | `src/lib/banking/expense-reconciliation-service.ts:20`  |

## Core Flow

### Invoice Matching Flow

1. System loads unmatched positive transactions (incoming payments) → `src/lib/banking/reconciliation-service.ts:26-34`
2. System queries unpaid outbound invoices → `src/lib/banking/reconciliation-service.ts:40-47`
3. Transactions converted to ParsedTransaction format → `src/lib/banking/reconciliation-service.ts:58-68`
4. Matching algorithm runs for each transaction → `src/lib/banking/reconciliation.ts:21-58`
5. System builds candidate matches for all invoices → `src/lib/banking/reconciliation.ts:84-94`
6. Match score calculated using reference, amount, date → `src/lib/banking/reconciliation.ts:96-120`
7. Ambiguous matches detected (same score) → `src/lib/banking/reconciliation.ts:30-38`
8. Matches meeting threshold (≥85) auto-linked → `src/lib/banking/reconciliation-service.ts:79-82`
9. Transaction updated with match status and confidence → `src/lib/banking/reconciliation-service.ts:84-90`
10. Invoice marked as paid with transaction date → `src/lib/banking/reconciliation-service.ts:95-107`
11. System revalidates banking and invoice pages → `src/lib/banking/reconciliation-service.ts:125-131`

### Expense Matching Flow

1. System loads unmatched negative transactions (outgoing payments) → `src/lib/banking/expense-reconciliation-service.ts:23-41`
2. System queries unpaid expenses without linked transactions → `src/lib/banking/expense-reconciliation-service.ts:48-58`
3. Transactions converted with absolute amount values → `src/lib/banking/expense-reconciliation-service.ts:64-74`
4. Matching algorithm runs for each transaction → `src/lib/banking/expense-reconciliation.ts:30-68`
5. Match score calculated using vendor, amount, date → `src/lib/banking/expense-reconciliation.ts:108-146`
6. Vendor name matched against transaction description → `src/lib/banking/expense-reconciliation.ts:118-120`
7. Matches meeting threshold (≥85) auto-linked → `src/lib/banking/expense-reconciliation-service.ts:85-88`
8. Transaction updated with expense reference → `src/lib/banking/expense-reconciliation-service.ts:94-105`
9. Expense marked as PAID with payment date → `src/lib/banking/expense-reconciliation-service.ts:108-116`
10. Match logged with confidence score → `src/lib/banking/expense-reconciliation-service.ts:118-121`

### Manual Matching Flow

1. User views reconciliation dashboard → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:32-297`
2. System displays transactions with candidate matches → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:224-287`
3. User clicks "Poveži" button for a candidate → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:265-275`
4. Client sends POST to match API endpoint → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:98-102`
5. API validates transaction and invoice ownership → `src/app/api/banking/reconciliation/match/route.ts:31-52`
6. System checks match eligibility → `src/app/api/banking/reconciliation/match/route.ts:39-44`
7. Transaction updated with MANUAL_MATCHED status → `src/app/api/banking/reconciliation/match/route.ts:61-70`
8. Confidence set to 100% for manual matches → `src/app/api/banking/reconciliation/match/route.ts:66`
9. Invoice marked as paid and accepted → `src/app/api/banking/reconciliation/match/route.ts:72-78`
10. Dashboard revalidates to show updated status → `src/app/api/banking/reconciliation/match/route.ts:80-87`

## Key Modules

| Module                             | Purpose                                  | Location                                                          |
| ---------------------------------- | ---------------------------------------- | ----------------------------------------------------------------- |
| reconciliation.ts                  | Core invoice matching algorithm          | `src/lib/banking/reconciliation.ts`                               |
| reconciliation-service.ts          | Invoice auto-match orchestration         | `src/lib/banking/reconciliation-service.ts`                       |
| expense-reconciliation.ts          | Core expense matching algorithm          | `src/lib/banking/expense-reconciliation.ts`                       |
| expense-reconciliation-service.ts  | Expense auto-match orchestration         | `src/lib/banking/expense-reconciliation-service.ts`               |
| reconciliation-config.ts           | Threshold configuration                  | `src/lib/banking/reconciliation-config.ts`                        |
| /api/reconciliation/route.ts       | Transaction list with candidates API     | `src/app/api/banking/reconciliation/route.ts`                     |
| /api/reconciliation/match/route.ts | Manual matching API                      | `src/app/api/banking/reconciliation/match/route.ts`               |
| ReconciliationDashboard            | UI for reviewing and matching            | `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx` |
| csv-parser.ts                      | Transaction parsing from bank statements | `src/lib/banking/csv-parser.ts`                                   |

## Matching Algorithm

### Invoice Reference Matching

- **Perfect Match (Score: 100)** → `src/lib/banking/reconciliation.ts:96-102`
  - Invoice number found in transaction reference
  - Reference substring match (bidirectional) → `src/lib/banking/reconciliation.ts:100`
  - Automatic link created immediately

### Amount and Date Matching

- **High Confidence (Score: 85)** → `src/lib/banking/reconciliation.ts:108-110`
  - Amount difference < €1.00 → `src/lib/banking/reconciliation.ts:108`
  - Date within 3 days of invoice date → `src/lib/banking/reconciliation.ts:108`
  - Automatic link created at this threshold

- **Partial Match (Score: 70)** → `src/lib/banking/reconciliation.ts:112-117`
  - Amount within 5% tolerance → `src/lib/banking/reconciliation.ts:114`
  - Date within 5 days of invoice date → `src/lib/banking/reconciliation.ts:114`
  - Flagged for manual review

- **No Match (Score: 0)** → `src/lib/banking/reconciliation.ts:119`
  - Conditions not met
  - Remains unmatched

### Expense Vendor Matching

- **Vendor + Amount (Score: 100)** → `src/lib/banking/expense-reconciliation.ts:123-125`
  - Vendor name found in description (normalized) → `src/lib/banking/expense-reconciliation.ts:118-120`
  - Amount exact match (delta < €1) → `src/lib/banking/expense-reconciliation.ts:123`
  - Date within 7 days → `src/lib/banking/expense-reconciliation.ts:123`

- **Amount + Date (Score: 85)** → `src/lib/banking/expense-reconciliation.ts:128-130`
  - Exact amount match → `src/lib/banking/expense-reconciliation.ts:128`
  - Date within 3 days → `src/lib/banking/expense-reconciliation.ts:128`

- **Tolerance Match (Score: 70)** → `src/lib/banking/expense-reconciliation.ts:133-137`
  - Amount within 5% tolerance → `src/lib/banking/expense-reconciliation.ts:135`
  - Date within 5 days → `src/lib/banking/expense-reconciliation.ts:135`

- **Vendor Only (Score: 50)** → `src/lib/banking/expense-reconciliation.ts:141-143`
  - Vendor name match only → `src/lib/banking/expense-reconciliation.ts:141`
  - Date within 14 days
  - Below auto-match threshold

### String Normalization

- **Text Processing** → `src/lib/banking/expense-reconciliation.ts:153-160`
  - Convert to lowercase → `src/lib/banking/expense-reconciliation.ts:155`
  - Remove diacritics (Croatian characters) → `src/lib/banking/expense-reconciliation.ts:156-157`
  - Remove non-alphanumeric characters → `src/lib/banking/expense-reconciliation.ts:158`
  - Enables fuzzy vendor matching

### Ambiguity Detection

- **Multiple Equal Matches** → `src/lib/banking/reconciliation.ts:30-38`
  - Top two matches have same score → `src/lib/banking/reconciliation.ts:30`
  - Status set to "ambiguous" → `src/lib/banking/reconciliation.ts:34`
  - Prevents incorrect automatic matching
  - User must manually select correct match

## Confidence Scoring

### Score Thresholds

- **Configuration** → `src/lib/banking/reconciliation-config.ts:1-3`
  - AUTO_MATCH_THRESHOLD: 85 → `src/lib/banking/reconciliation-config.ts:1`
  - PARTIAL_MATCH_THRESHOLD: 70 → `src/lib/banking/reconciliation-config.ts:2`
  - Used by both invoice and expense matching

### Score Calculation

- **Date Difference** → `src/lib/banking/reconciliation.ts:122-125`
  - Calculates days between dates → `src/lib/banking/reconciliation.ts:123`
  - Absolute difference used in scoring → `src/lib/banking/reconciliation.ts:123`

- **Amount Comparison** → `src/lib/banking/reconciliation.ts:104-106`
  - Absolute delta calculated → `src/lib/banking/reconciliation.ts:105`
  - Percentage tolerance for partial matches → `src/lib/banking/expense-reconciliation.ts:134`

### Score Reasons

- **Human-Readable Explanations** → `src/lib/banking/reconciliation.ts:127-132`
  - 100: "Invoice number found in transaction reference" → `src/lib/banking/reconciliation.ts:128`
  - 85: "Exact amount match and date close to invoice" → `src/lib/banking/reconciliation.ts:129`
  - 70: "Amount within tolerance and date close" → `src/lib/banking/reconciliation.ts:130`
  - Displayed in UI for user understanding → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:258`

- **Expense Match Reasons** → `src/lib/banking/expense-reconciliation.ts:162-175`
  - vendor_and_amount: "Pronađen dobavljač u opisu i točan iznos" → `src/lib/banking/expense-reconciliation.ts:165`
  - amount_and_date: "Točan iznos i datum blizu datuma troška" → `src/lib/banking/expense-reconciliation.ts:167`
  - amount_tolerance: "Iznos unutar tolerancije i datum blizu" → `src/lib/banking/expense-reconciliation.ts:169`

## Automatic Linking

### Invoice Auto-Match

- **Threshold Check** → `src/lib/banking/reconciliation-service.ts:79-82`
  - Status must be "matched" → `src/lib/banking/reconciliation-service.ts:80`
  - Score ≥ threshold (default 85) → `src/lib/banking/reconciliation-service.ts:81`
  - Invoice ID must exist → `src/lib/banking/reconciliation-service.ts:82`

- **Transaction Update** → `src/lib/banking/reconciliation-service.ts:84-90`
  - confidenceScore stored → `src/lib/banking/reconciliation-service.ts:85`
  - matchStatus set to AUTO_MATCHED → `src/lib/banking/reconciliation-service.ts:86`
  - matchedInvoiceId linked → `src/lib/banking/reconciliation-service.ts:87`
  - matchedAt timestamp recorded → `src/lib/banking/reconciliation-service.ts:88`
  - matchedBy user ID stored → `src/lib/banking/reconciliation-service.ts:89`

- **Invoice Status Update** → `src/lib/banking/reconciliation-service.ts:95-107`
  - paidAt set to transaction date → `src/lib/banking/reconciliation-service.ts:101`
  - status changed to ACCEPTED → `src/lib/banking/reconciliation-service.ts:102`
  - Prevents duplicate matching → `src/lib/banking/reconciliation-service.ts:96-106`

### Expense Auto-Match

- **Link Creation** → `src/lib/banking/expense-reconciliation-service.ts:94-105`
  - matchStatus: AUTO_MATCHED → `src/lib/banking/expense-reconciliation-service.ts:98`
  - Confidence score stored → `src/lib/banking/expense-reconciliation-service.ts:99`
  - matchedExpenseId linked → `src/lib/banking/expense-reconciliation-service.ts:102`

- **Expense Status Update** → `src/lib/banking/expense-reconciliation-service.ts:108-116`
  - status changed to PAID → `src/lib/banking/expense-reconciliation-service.ts:112`
  - paymentDate set to transaction date → `src/lib/banking/expense-reconciliation-service.ts:113`

- **Audit Logging** → `src/lib/banking/expense-reconciliation-service.ts:118-121`
  - Transaction ID logged → `src/lib/banking/expense-reconciliation-service.ts:119`
  - Expense ID logged → `src/lib/banking/expense-reconciliation-service.ts:119`
  - Confidence score logged → `src/lib/banking/expense-reconciliation-service.ts:119`

### Batch Processing

- **Parallel Updates** → `src/lib/banking/reconciliation-service.ts:72-123`
  - All updates collected in array → `src/lib/banking/reconciliation-service.ts:72`
  - Promise.all for concurrent execution → `src/lib/banking/reconciliation-service.ts:123`
  - Returns match count and evaluated count → `src/lib/banking/reconciliation-service.ts:133-136`

### Import Integration

- **Automatic Trigger** → `src/app/(dashboard)/banking/actions.ts:256-260`
  - Runs after successful import → `src/app/(dashboard)/banking/actions.ts:256`
  - Uses imported bank account ID → `src/app/(dashboard)/banking/actions.ts:258`
  - Returns auto-match results → `src/app/(dashboard)/banking/actions.ts:270-271`

## Manual Matching

### UI Components

- **Reconciliation Dashboard** → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:32-297`
  - Account filter dropdown → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:148-159`
  - Status filter (UNMATCHED, AUTO_MATCHED, etc.) → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:163-174`
  - Summary cards with counts → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:179-188`
  - Transaction table with candidates → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:212-289`

- **Transaction Row Display** → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:228-277`
  - Date formatted for Croatian locale → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:233`
  - Description and counterparty → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:236-239`
  - Amount with currency formatting → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:242`
  - Confidence badge → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:245-249`

- **Candidate Display** → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:252-263`
  - Invoice number → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:254`
  - Amount and score → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:256`
  - Match reason → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:258`
  - Match button → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:265-275`

### Match API

- **Request Validation** → `src/app/api/banking/reconciliation/match/route.ts:7-29`
  - Schema: transactionId + invoiceId → `src/app/api/banking/reconciliation/match/route.ts:7-10`
  - Authentication required → `src/app/api/banking/reconciliation/match/route.ts:13-16`
  - Company ownership verified → `src/app/api/banking/reconciliation/match/route.ts:18-21`

- **Transaction Validation** → `src/app/api/banking/reconciliation/match/route.ts:31-44`
  - Must exist and belong to company → `src/app/api/banking/reconciliation/match/route.ts:31-33`
  - Must be UNMATCHED or IGNORED → `src/app/api/banking/reconciliation/match/route.ts:39-44`
  - Prevents duplicate matching

- **Invoice Validation** → `src/app/api/banking/reconciliation/match/route.ts:46-59`
  - Must exist and belong to company → `src/app/api/banking/reconciliation/match/route.ts:46-48`
  - Must not already be paid → `src/app/api/banking/reconciliation/match/route.ts:54-59`

- **Match Creation** → `src/app/api/banking/reconciliation/match/route.ts:61-78`
  - Transaction linked to invoice → `src/app/api/banking/reconciliation/match/route.ts:64`
  - Status: MANUAL_MATCHED → `src/app/api/banking/reconciliation/match/route.ts:65`
  - Confidence: 100% (manual is certain) → `src/app/api/banking/reconciliation/match/route.ts:66`
  - Invoice marked paid → `src/app/api/banking/reconciliation/match/route.ts:75-76`

### Expense Manual Linking

- **Service Function** → `src/lib/banking/expense-reconciliation-service.ts:189-248`
  - Validates both transaction and expense → `src/lib/banking/expense-reconciliation-service.ts:197-211`
  - Creates bidirectional link → `src/lib/banking/expense-reconciliation-service.ts:214-232`
  - Updates expense to PAID status → `src/lib/banking/expense-reconciliation-service.ts:226-232`
  - Logs manual link action → `src/lib/banking/expense-reconciliation-service.ts:234-237`

- **Action Wrapper** → `src/app/actions/expense-reconciliation.ts:70-93`
  - Requires authentication → `src/app/actions/expense-reconciliation.ts:75-76`
  - Calls service function → `src/app/actions/expense-reconciliation.ts:78-83`
  - Returns success/error result → `src/app/actions/expense-reconciliation.ts:85`

## Data

### Database Tables

- **BankTransaction** → `prisma/schema.prisma:461-489`
  - matchedInvoiceId: Invoice foreign key → `prisma/schema.prisma:472`
  - matchedExpenseId: Expense foreign key → `prisma/schema.prisma:473`
  - matchStatus: UNMATCHED | AUTO_MATCHED | MANUAL_MATCHED | IGNORED → `prisma/schema.prisma:474`
  - matchedAt: Timestamp of match → `prisma/schema.prisma:475`
  - matchedBy: User who matched → `prisma/schema.prisma:476`
  - confidenceScore: 0-100 score → `prisma/schema.prisma:478`

- **MatchStatus Enum** → `prisma/schema.prisma:872-877`
  - UNMATCHED: Not yet matched → `prisma/schema.prisma:873`
  - AUTO_MATCHED: Algorithmically matched → `prisma/schema.prisma:874`
  - MANUAL_MATCHED: User-confirmed match → `prisma/schema.prisma:875`
  - IGNORED: User chose to ignore → `prisma/schema.prisma:876`

### Data Types

- **ParsedTransaction** → `src/lib/banking/csv-parser.ts:1-10`
  - date: Transaction date → `src/lib/banking/csv-parser.ts:2`
  - reference: Invoice number or reference → `src/lib/banking/csv-parser.ts:3`
  - amount: Transaction amount → `src/lib/banking/csv-parser.ts:4`
  - description: Transaction description → `src/lib/banking/csv-parser.ts:5`
  - type: debit or credit → `src/lib/banking/csv-parser.ts:6`

- **ReconciliationResult** → `src/lib/banking/reconciliation.ts:4-10`
  - transactionId: Transaction reference → `src/lib/banking/reconciliation.ts:5`
  - matchedInvoiceId: Matched invoice or null → `src/lib/banking/reconciliation.ts:6`
  - matchStatus: Match quality → `src/lib/banking/reconciliation.ts:7`
  - confidenceScore: Numeric score → `src/lib/banking/reconciliation.ts:8`
  - reason: Human explanation → `src/lib/banking/reconciliation.ts:9`

- **InvoiceCandidate** → `src/lib/banking/reconciliation.ts:12-19`
  - invoiceId, invoiceNumber, issueDate → `src/lib/banking/reconciliation.ts:13-15`
  - totalAmount: Invoice total → `src/lib/banking/reconciliation.ts:16`
  - score: Match confidence → `src/lib/banking/reconciliation.ts:17`
  - reason: Match explanation → `src/lib/banking/reconciliation.ts:18`

- **ExpenseCandidate** → `src/lib/banking/expense-reconciliation.ts:15-23`
  - expenseId, description, vendorName → `src/lib/banking/expense-reconciliation.ts:16-18`
  - date: Expense date → `src/lib/banking/expense-reconciliation.ts:19`
  - totalAmount: Expense total → `src/lib/banking/expense-reconciliation.ts:20`
  - score: Match confidence → `src/lib/banking/expense-reconciliation.ts:21`

## Error Handling

### Validation Errors

- **Already Matched** → `src/app/api/banking/reconciliation/match/route.ts:39-44`
  - Returns 400 error → `src/app/api/banking/reconciliation/match/route.ts:42`
  - Message: "Transakcija je već povezana" → `src/app/api/banking/reconciliation/match/route.ts:41`

- **Invoice Already Paid** → `src/app/api/banking/reconciliation/match/route.ts:54-59`
  - Returns 400 error → `src/app/api/banking/reconciliation/match/route.ts:57`
  - Message: "Račun je već evidentiran kao plaćen" → `src/app/api/banking/reconciliation/match/route.ts:56`

- **Not Found Errors** → `src/app/api/banking/reconciliation/match/route.ts:35-37`
  - Transaction not found: 404 → `src/app/api/banking/reconciliation/match/route.ts:36`
  - Invoice not found: 404 → `src/app/api/banking/reconciliation/match/route.ts:51`

### UI Error Display

- **Status Messages** → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:190-201`
  - Success: Green banner with CheckCircle → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:193-194`
  - Error: Red banner with AlertCircle → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:195`
  - Auto-dismisses on next action → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:96`

- **Loading States** → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:267-273`
  - Button disabled during match → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:267`
  - Spinner icon displayed → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:271`
  - Transaction ID tracked → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:45`

### Logging

- **Expense Match Logging** → `src/lib/banking/expense-reconciliation-service.ts:118-121`
  - Info level logging → `src/lib/banking/expense-reconciliation-service.ts:118`
  - Transaction and expense IDs → `src/lib/banking/expense-reconciliation-service.ts:119`
  - Confidence score included → `src/lib/banking/expense-reconciliation-service.ts:119`
  - Message: "Auto-matched expense to transaction" → `src/lib/banking/expense-reconciliation-service.ts:120`

## Dependencies

- **Depends on**:
  - [[auth-login]] - User authentication required → `src/app/api/banking/reconciliation/match/route.ts:13`
  - [[company-management]] - Company context required → `src/app/api/banking/reconciliation/match/route.ts:18`
  - [[e-invoicing]] - Invoice data for matching → `src/lib/banking/reconciliation-service.ts:40-47`
  - [[expenses]] - Expense data for matching → `src/lib/banking/expense-reconciliation-service.ts:48-58`
  - [[banking-import]] - Triggers auto-match after import → `src/app/(dashboard)/banking/actions.ts:256-260`
  - Prisma ORM - Database operations → `src/lib/db.ts`

- **Depended by**:
  - [[banking-transactions]] - Displays match status
  - [[invoicing-mark-paid]] - Uses matched transactions
  - [[expenses-mark-paid]] - Uses matched transactions
  - [[banking-reconciliation-dashboard]] - UI for reviewing matches

## Integrations

### Banking Import

- **Automatic Triggering** → `src/app/(dashboard)/banking/actions.ts:256-260`
  - Called after successful import → `src/app/(dashboard)/banking/actions.ts:256`
  - Uses company and bank account context → `src/app/(dashboard)/banking/actions.ts:257-259`
  - Results included in import response → `src/app/(dashboard)/banking/actions.ts:269-271`

### CSV Parser

- **Transaction Extraction** → `src/lib/banking/csv-parser.ts:181-192`
  - Extracts invoice numbers from descriptions → `src/lib/banking/csv-parser.ts:182-189`
  - Patterns: "Invoice", "Račun", "#123" → `src/lib/banking/csv-parser.ts:183-186`
  - Used for reference matching → `src/lib/banking/reconciliation.ts:97-98`

## Verification Checklist

- [ ] Auto-match runs after bank statement import
- [ ] Invoice reference matching returns 100% confidence
- [ ] Amount + date matching returns 85% confidence
- [ ] Partial amount matching (±5%) returns 70% confidence
- [ ] Matches ≥85% automatically create links
- [ ] Matched invoices marked as ACCEPTED and paidAt set
- [ ] Expense vendor name matching works with normalization
- [ ] Diacritics removed for Croatian name matching
- [ ] Ambiguous matches (same score) flagged as "ambiguous"
- [ ] Manual match button creates MANUAL_MATCHED status
- [ ] Manual matches set confidence to 100%
- [ ] Already matched transactions rejected with error
- [ ] Reconciliation dashboard displays candidates correctly
- [ ] Confidence scores display in transaction rows
- [ ] Match reasons display in human-readable format
- [ ] Expense auto-match runs for negative transactions
- [ ] Invoice auto-match runs for positive transactions
- [ ] Transaction table filters by match status
- [ ] Summary cards show correct counts per status
- [ ] Success/error messages display in UI
- [ ] Loading states prevent double-clicking
- [ ] Unlink functionality resets match status
- [ ] Tenant isolation prevents cross-company matching
- [ ] Date calculations use absolute differences
- [ ] Currency formatting respects bank account currency
- [ ] Revalidation updates all affected pages
- [ ] Batch processing handles multiple matches
- [ ] Logging captures auto-match events

## Evidence Links

1. Core reconciliation algorithm → `src/lib/banking/reconciliation.ts:21`
2. Invoice auto-match service → `src/lib/banking/reconciliation-service.ts:15`
3. Expense matching algorithm → `src/lib/banking/expense-reconciliation.ts:30`
4. Expense auto-match service → `src/lib/banking/expense-reconciliation-service.ts:20`
5. Match calculation function → `src/lib/banking/reconciliation.ts:96`
6. Expense match calculation → `src/lib/banking/expense-reconciliation.ts:108`
7. Threshold configuration → `src/lib/banking/reconciliation-config.ts:1`
8. Reconciliation API endpoint → `src/app/api/banking/reconciliation/route.ts:19`
9. Manual match API endpoint → `src/app/api/banking/reconciliation/match/route.ts:12`
10. Reconciliation dashboard page → `src/app/(dashboard)/banking/reconciliation/page.tsx:9`
11. Dashboard client component → `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx:32`
12. Auto-match action → `src/app/actions/banking.ts:443`
13. Expense auto-match action → `src/app/actions/expense-reconciliation.ts:21`
14. Import integration → `src/app/(dashboard)/banking/actions.ts:256`
15. BankTransaction schema → `prisma/schema.prisma:461`
16. MatchStatus enum → `prisma/schema.prisma:872`
17. ParsedTransaction type → `src/lib/banking/csv-parser.ts:1`
18. ReconciliationResult type → `src/lib/banking/reconciliation.ts:4`
19. InvoiceCandidate type → `src/lib/banking/reconciliation.ts:12`
20. ExpenseCandidate type → `src/lib/banking/expense-reconciliation.ts:15`
21. String normalization → `src/lib/banking/expense-reconciliation.ts:153`
22. Invoice number extraction → `src/lib/banking/csv-parser.ts:181`
23. Ambiguity detection → `src/lib/banking/reconciliation.ts:30`
24. Date difference calculation → `src/lib/banking/reconciliation.ts:122`
25. Score reason mapping → `src/lib/banking/reconciliation.ts:127`
26. Manual link service → `src/lib/banking/expense-reconciliation-service.ts:189`
27. Batch update processing → `src/lib/banking/reconciliation-service.ts:123`
28. Match logging → `src/lib/banking/expense-reconciliation-service.ts:118`
