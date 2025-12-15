# Feature: Mark Expense as Paid

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 15

## Purpose

Mark Expense as Paid enables users to manually record when an expense has been paid by updating the payment date (`paymentDate`), payment method (`paymentMethod`), and changing the expense status to `PAID`. This feature is critical for cash flow tracking, payables management, and accounting accuracy. It can be triggered manually via the UI dropdown or automatically through bank reconciliation when a matching payment transaction is detected.

## User Entry Points

| Type          | Path                        | Evidence                                                      |
| ------------- | --------------------------- | ------------------------------------------------------------- |
| UI Dropdown   | /expenses/:id               | `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:43-55` |
| Server Action | markExpenseAsPaid           | `src/app/actions/expense.ts:181-218`                          |
| Auto Match    | Bank Reconciliation Service | `src/lib/banking/expense-reconciliation-service.ts:107-116`   |
| Manual Link   | linkTransactionToExpense    | `src/lib/banking/expense-reconciliation-service.ts:225-232`   |

## Core Flow

### Manual Payment Marking

1. User navigates to expense detail page → `src/app/(dashboard)/expenses/[id]/page.tsx:24-116`
2. System checks if expense qualifies for "Mark as Paid" action → `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:14`
   - Status must NOT be PAID or CANCELLED
   - Expense must be in DRAFT or PENDING status
3. User sees dropdown "Označi plaćeno..." with payment method options → `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:43-55`
   - CASH: Gotovina
   - CARD: Kartica
   - TRANSFER: Virman
   - OTHER: Ostalo
4. User selects payment method from dropdown → `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:45`
5. Client-side state shows loading state, disabling controls → `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:47`
6. Server action `markExpenseAsPaid` validates request → `src/app/actions/expense.ts:181-218`
7. Database updates expense with current date, payment method, and PAID status → `src/app/actions/expense.ts:201-208`
8. Success toast displayed: "Trošak označen kao plaćen" → `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:21`
9. Page refreshes to show updated status and payment details → `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:22`

### Automatic Payment via Bank Reconciliation

1. User matches bank transaction to expense via reconciliation service → `src/lib/banking/expense-reconciliation-service.ts:189-248`
2. System validates expense is not already paid → `src/app/actions/expense.ts:197-199`
3. System updates expense `paymentDate` to transaction date (not current date) → `src/lib/banking/expense-reconciliation-service.ts:230`
4. Expense status automatically changes to `PAID` → `src/lib/banking/expense-reconciliation-service.ts:229`
5. Payment method set to TRANSFER for bank-matched expenses → `src/app/actions/banking.ts:541`
6. Multiple paths revalidated to show updated state → `src/lib/banking/expense-reconciliation-service.ts:239-241`

### Inline Status Update

1. User clicks on status badge in expense list → `src/components/expenses/expense-inline-status.tsx:50-64`
2. Status cycles through: DRAFT → PENDING → PAID → CANCELLED → DRAFT → `src/components/expenses/expense-inline-status.tsx:29-33`
3. When status changes to PAID, `paymentDate` is automatically set → `src/app/actions/expense.ts:249-251`
4. Success toast shown: "Status ažuriran" → `src/components/expenses/expense-inline-status.tsx:41`

## Key Modules

| Module                 | Purpose                                          | Location                                                |
| ---------------------- | ------------------------------------------------ | ------------------------------------------------------- |
| ExpenseActions         | Client component with mark as paid dropdown      | `src/app/(dashboard)/expenses/[id]/expense-actions.tsx` |
| markExpenseAsPaid      | Server action handling payment status update     | `src/app/actions/expense.ts:181-218`                    |
| updateExpenseInline    | Server action for inline status updates          | `src/app/actions/expense.ts:225-269`                    |
| Expense Detail Page    | Displays expense with payment status and history | `src/app/(dashboard)/expenses/[id]/page.tsx`            |
| ExpenseInlineStatus    | Clickable status badge for quick updates         | `src/components/expenses/expense-inline-status.tsx`     |
| Expense Reconciliation | Automatic payment marking from bank transactions | `src/lib/banking/expense-reconciliation-service.ts`     |
| Expense Schema         | Database model with payment tracking fields      | `prisma/schema.prisma:345-374`                          |

## Data

### Tables

- **Expense** → `prisma/schema.prisma:345-374`
  - Primary table for expense data and payment tracking

### Key Fields

| Field         | Type           | Purpose                                      | Evidence                   |
| ------------- | -------------- | -------------------------------------------- | -------------------------- |
| status        | ExpenseStatus  | Current expense status (changes to PAID)     | `prisma/schema.prisma:358` |
| paymentMethod | PaymentMethod? | Method used for payment (CASH/CARD/TRANSFER) | `prisma/schema.prisma:359` |
| paymentDate   | DateTime?      | Timestamp when expense was marked as paid    | `prisma/schema.prisma:360` |

### Status Flow

```
DRAFT → PENDING → PAID
         ↓           ↑
    CANCELLED    (via payment or reconciliation)
```

Valid statuses for marking as paid: All except `PAID` and `CANCELLED` → `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:14`

### Payment Methods

```prisma
enum PaymentMethod {
  CASH
  CARD
  TRANSFER
  OTHER
}
```

Evidence: `prisma/schema.prisma:841-846`

## Business Rules

### Eligibility Requirements

1. **Status Validation** → `src/app/actions/expense.ts:197-199`
   - Expense must NOT be in PAID status
   - Error message: "Trošak je već plaćen"

2. **Already Paid Check** → `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:14`
   - Cannot mark expenses with status PAID or CANCELLED
   - UI dropdown is hidden for ineligible expenses

3. **Payment Method Required** → `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:45`
   - User must select a payment method (CASH, CARD, TRANSFER, OTHER)
   - Payment method is stored with the payment record

4. **Tenant Security** → `src/app/actions/expense.ts:188`
   - User must have permission to access expense via company context
   - Automatically filtered by tenant isolation

### Status Transition

When marked as paid:

- `paymentDate` set to current timestamp (manual) or transaction date (automatic) → `src/app/actions/expense.ts:206`
- `paymentMethod` set to user-selected method or TRANSFER (auto) → `src/app/actions/expense.ts:205`
- `status` changed to `PAID` → `src/app/actions/expense.ts:204`
- Multiple cache paths revalidated → `src/app/actions/expense.ts:210-211`

### Bank Reconciliation Integration

When marking paid via bank reconciliation:

- Uses transaction date instead of current date → `src/lib/banking/expense-reconciliation-service.ts:230`
- Links transaction to expense via `matchedExpenseId` → `src/lib/banking/expense-reconciliation-service.ts:221`
- Prevents double-payment by checking existing status → `src/app/actions/expense.ts:197-199`
- Payment method automatically set to TRANSFER → `src/app/actions/banking.ts:541`
- Error message: "Trošak je već plaćen"

## UI Components

### Mark as Paid Dropdown

**Visual Design:**

- Dropdown selector with payment method options → `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:43-55`
- Placeholder text: "Označi plaćeno..." → `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:49`
- Options displayed in Croatian:
  - Gotovina (CASH)
  - Kartica (CARD)
  - Virman (TRANSFER)
  - Ostalo (OTHER)
- Loading state: Controls disabled during processing → `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:47`

**Conditional Rendering:**

```typescript
const canPay = expense.status !== "PAID" && expense.status !== "CANCELLED"
```

Evidence: `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:14`

### Payment Details Display

After marking as paid, payment details appear in detail page:

- Payment Method: Displayed with Croatian labels → `src/app/(dashboard)/expenses/[id]/page.tsx:73`
- Payment Date: Croatian date format (`hr-HR`) → `src/app/(dashboard)/expenses/[id]/page.tsx:74`
- Location: Details card, left sidebar → `src/app/(dashboard)/expenses/[id]/page.tsx:64-77`

Evidence: `src/app/(dashboard)/expenses/[id]/page.tsx:68-75`

### Status Badge

Expense status updates to show "Plaćeno" (Paid):

- Green badge: `bg-green-100 text-green-800` → `src/components/expenses/expense-inline-status.tsx:20`
- Label: "Plaćeno" → `src/components/expenses/expense-inline-status.tsx:13`
- Clickable for inline status cycling → `src/components/expenses/expense-inline-status.tsx:50-64`

Evidence: `src/components/expenses/expense-inline-status.tsx:10-22`

### Inline Status Component

Interactive status badge with click-to-cycle functionality:

- Status order: DRAFT → PENDING → PAID → CANCELLED → DRAFT → `src/components/expenses/expense-inline-status.tsx:30`
- Check icon displayed on badge → `src/components/expenses/expense-inline-status.tsx:60`
- Loader icon during save → `src/components/expenses/expense-inline-status.tsx:60`
- Error indicator with XCircle icon → `src/components/expenses/expense-inline-status.tsx:62`

Evidence: `src/components/expenses/expense-inline-status.tsx:24-65`

## User Feedback

### Success Messages

1. **Manual marking** → `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:21`
   - Toast: "Trošak označen kao plaćen"
   - Type: Success (green)
   - Library: Sonner via custom toast wrapper → `src/lib/toast.ts`

2. **Inline status update** → `src/components/expenses/expense-inline-status.tsx:41`
   - Toast: "Status ažuriran"
   - Type: Success (green)

3. **Automatic via reconciliation**
   - Implicit success through page refresh and updated status
   - Logger info message recorded → `src/lib/banking/expense-reconciliation-service.ts:234-237`

### Error Messages

1. **Already Paid** → `src/app/actions/expense.ts:198`
   - Message: "Trošak je već plaćen"
   - Prevents duplicate payment recording

2. **Not Found** → `src/app/actions/expense.ts:194`
   - Message: "Trošak nije pronađen"
   - Handles missing expense or permission issues

3. **General Error** → `src/app/actions/expense.ts:216`
   - Message: "Greška pri označavanju plaćanja"
   - Displayed for unexpected errors
   - Error logged to console → `src/app/actions/expense.ts:215`

4. **Inline Update Error** → `src/components/expenses/expense-inline-status.tsx:44`
   - Message: "Greška" with optional details
   - Red XCircle icon displayed on badge → `src/components/expenses/expense-inline-status.tsx:62`

### Visual Feedback

- Loading state disables dropdown during processing → `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:47`
- Spinner animation on inline status badge → `src/components/expenses/expense-inline-status.tsx:60`
- Page refresh after successful update → `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:22`

## Dependencies

- **Depends on**:
  - [[auth-session]] - User authentication required
  - [[expense-details]] - Expense must exist and be viewable
  - Database migration `20251211_add_expenses` - Created Expense table → `prisma/migrations/20251211_add_expenses/migration.sql`
  - Prisma Client - Database access and types
  - Toast notifications - User feedback system → `src/lib/toast.ts`

- **Depended by**:
  - [[bank-reconciliation]] - Auto-marks expenses as paid when matched
  - [[expense-reconciliation-service]] - Matches bank transactions to expenses
  - [[expense-exports]] - Filters by paid status for CSV exports
  - [[unified-documents-hub]] - Displays expense payment status in document list

## Integrations

### Database Migration

Created Expense table with payment tracking fields:

```sql
CREATE TABLE "Expense" (
    "status" "ExpenseStatus" NOT NULL DEFAULT 'DRAFT',
    "paymentMethod" "PaymentMethod",
    "paymentDate" TIMESTAMP(3),
    ...
);
```

Evidence: `prisma/migrations/20251211_add_expenses/migration.sql:11-33`

### Status Enum

`ExpenseStatus` enum includes `PAID` state:

```prisma
enum ExpenseStatus {
  DRAFT
  PENDING
  PAID        // ← Used when expense is marked as paid
  CANCELLED
}
```

Evidence: `prisma/schema.prisma:834-839`

### Payment Method Enum

```prisma
enum PaymentMethod {
  CASH
  CARD
  TRANSFER
  OTHER
}
```

Evidence: `prisma/schema.prisma:841-846`

### Unified Documents Hub

Expenses with `PAID` status are displayed with green status badge:

- Status label: "Plaćeno" → `src/lib/documents/unified-query.ts:81`
- Status color: Green for PAID → `src/lib/documents/unified-query.ts:193`
- Included in unified document queries → `src/lib/documents/unified-query.ts:137-148`

Evidence: `src/lib/documents/unified-query.ts:77-82,183-195`

### Bank Reconciliation

Automatic payment marking flow:

1. Transaction matched to expense → `src/lib/banking/expense-reconciliation-service.ts:214-223`
2. Expense `paymentDate` set to transaction date → `src/lib/banking/expense-reconciliation-service.ts:230`
3. Expense `paymentMethod` set to TRANSFER → `src/app/actions/banking.ts:541`
4. Status changed to `PAID` → `src/lib/banking/expense-reconciliation-service.ts:229`
5. Bank transaction `matchStatus` set to `AUTO_MATCHED` or `MANUAL_MATCHED` → `src/lib/banking/expense-reconciliation-service.ts:217`

Evidence: `src/lib/banking/expense-reconciliation-service.ts:189-248`

### Auto-Matching Service

Automatic expense reconciliation with confidence scoring:

- Matches unmatched debit transactions (amount < 0) to unpaid expenses → `src/lib/banking/expense-reconciliation-service.ts:20-139`
- Only auto-matches with confidence score ≥ 85% → `src/lib/banking/expense-reconciliation-service.ts:11,85-88`
- Filters expenses with status DRAFT or PENDING → `src/lib/banking/expense-reconciliation-service.ts:51`
- Excludes expenses already linked to bank transactions → `src/lib/banking/expense-reconciliation-service.ts:52`
- Sets payment method to TRANSFER for auto-matched expenses

Evidence: `src/lib/banking/expense-reconciliation-service.ts:20-139`

## Verification Checklist

- [x] User can see "Označi plaćeno..." dropdown on unpaid expenses
- [x] Dropdown is hidden if expense status is PAID or CANCELLED
- [x] Dropdown displays four payment method options in Croatian
- [x] Success toast shown: "Trošak označen kao plaćen"
- [x] Expense status changes to "PAID" after marking as paid
- [x] Payment date appears in Details section with Croatian formatting
- [x] Payment method appears in Details section with Croatian label
- [x] Status badge updates to green "Plaćeno"
- [x] Error shown if trying to mark already-paid expense
- [x] Bank reconciliation can automatically mark expenses as paid
- [x] Transaction date (not current date) used for auto-payment
- [x] Payment method set to TRANSFER for auto-matched expenses
- [x] Page refreshes automatically to show updated state
- [x] Multiple cache paths revalidated for consistency
- [x] Inline status badge allows click-to-cycle status updates

## Evidence Links

1. `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:7` - markExpenseAsPaid action import
2. `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:14` - canPay eligibility logic
3. `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:16-26` - handlePay client function
4. `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:43-55` - Payment method dropdown UI
5. `src/app/actions/expense.ts:181-218` - markExpenseAsPaid server action implementation
6. `src/app/actions/expense.ts:197-199` - Already paid validation check
7. `src/app/actions/expense.ts:201-208` - Database update with paymentDate, paymentMethod, and status change
8. `prisma/schema.prisma:358-360` - status, paymentMethod, and paymentDate field definitions
9. `prisma/schema.prisma:834-846` - ExpenseStatus and PaymentMethod enum definitions
10. `prisma/migrations/20251211_add_expenses/migration.sql` - Migration creating Expense table
11. `src/app/(dashboard)/expenses/[id]/page.tsx:68-75` - Payment details display in UI
12. `src/lib/banking/expense-reconciliation-service.ts:189-248` - Automatic payment via bank reconciliation
13. `src/components/expenses/expense-inline-status.tsx:24-65` - Inline status update component
14. `src/lib/documents/unified-query.ts:77-82,183-195` - Expense status display in unified documents
15. `src/app/actions/banking.ts:536-544` - Payment method set to TRANSFER for auto-matched expenses
