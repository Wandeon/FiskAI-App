# Feature: Edit Expense

## Status

- Documentation: Complete
- Last verified: 2025-12-15
- Evidence count: 11

## Purpose

Allows users to modify existing expense details (description, amounts, vendor, category, dates, notes) through the updateExpense server action. Unlike invoices which have strict status-based restrictions, expenses can be updated at any time regardless of their status (DRAFT, PENDING, PAID, CANCELLED). The feature supports both full edits via the updateExpense action and inline status updates via updateExpenseInline for quick status changes.

## User Entry Points

| Type | Path                | Evidence                                         |
| ---- | ------------------- | ------------------------------------------------ |
| Page | /expenses/:id       | `src/app/(dashboard)/expenses/[id]/page.tsx:1`   |
| Page | /documents/:id      | `src/app/(dashboard)/documents/[id]/page.tsx:53` |
| API  | updateExpense       | `src/app/actions/expense.ts:95-149`              |
| API  | updateExpenseInline | `src/app/actions/expense.ts:225-269`             |

## Core Flow

### Expense Edit Flow

1. User navigates to expenses list at /expenses -> `src/app/(dashboard)/expenses/page.tsx:6`
2. System redirects to unified documents hub with expense filter -> `src/app/(dashboard)/expenses/page.tsx:6`
3. User clicks on an expense to view details -> `src/app/(dashboard)/documents/page.tsx:134-136`
4. System routes to expense detail page -> `src/app/(dashboard)/documents/[id]/page.tsx:52-54`
5. Expense detail page displays with current data -> `src/app/(dashboard)/expenses/[id]/page.tsx:35-41`
6. ExpenseActions component renders action buttons -> `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:41-58`
7. User can mark as paid or delete the expense -> `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:14,28-39`
8. For programmatic edits, user calls updateExpense server action -> `src/app/actions/expense.ts:95-149`
9. Server validates expense exists (no status restrictions) -> `src/app/actions/expense.ts:103-109`
10. Server updates expense data with provided fields -> `src/app/actions/expense.ts:111-134`
11. Cache revalidation triggers UI refresh -> `src/app/actions/expense.ts:141-142`

### Inline Status Update Flow

1. User clicks on expense status badge in list view -> `src/components/expenses/expense-inline-status.tsx:50-58`
2. Status cycles through: DRAFT -> PENDING -> PAID -> CANCELLED -> DRAFT -> `src/components/expenses/expense-inline-status.tsx:29-33`
3. Client calls updateExpenseInline with new status -> `src/components/expenses/expense-inline-status.tsx:38`
4. Server validates input with Zod schema -> `src/app/actions/expense.ts:241-244`
5. Server updates status and payment date if marked PAID -> `src/app/actions/expense.ts:247-251`
6. Cache revalidation refreshes expense list -> `src/app/actions/expense.ts:262`

### Mark as Paid Flow

1. User selects payment method from dropdown -> `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:44-54`
2. Client calls markExpenseAsPaid with payment method -> `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:16-26`
3. Server validates expense exists and is not already paid -> `src/app/actions/expense.ts:189-199`
4. Server updates status to PAID, sets payment method and date -> `src/app/actions/expense.ts:201-208`
5. Cache revalidation triggers UI refresh -> `src/app/actions/expense.ts:210-211`

## Key Modules

| Module                   | Purpose                                  | Location                                                |
| ------------------------ | ---------------------------------------- | ------------------------------------------------------- |
| Expense Detail Page      | Displays expense data with actions       | `src/app/(dashboard)/expenses/[id]/page.tsx`            |
| ExpenseActions           | Action buttons (pay/delete)              | `src/app/(dashboard)/expenses/[id]/expense-actions.tsx` |
| ExpenseInlineStatus      | Clickable status badge for quick updates | `src/components/expenses/expense-inline-status.tsx`     |
| updateExpense action     | Server action to update expense fields   | `src/app/actions/expense.ts:95-149`                     |
| updateExpenseInline      | Server action for inline status updates  | `src/app/actions/expense.ts:225-269`                    |
| markExpenseAsPaid action | Server action to mark expense as paid    | `src/app/actions/expense.ts:181-218`                    |
| deleteExpense action     | Server action to delete expenses         | `src/app/actions/expense.ts:151-179`                    |
| Document Router          | Routes document IDs to appropriate pages | `src/app/(dashboard)/documents/[id]/page.tsx`           |
| ExpenseForm              | Client component for creating expenses   | `src/app/(dashboard)/expenses/new/expense-form.tsx`     |

## Data

### Database Tables

- **Expense**: Main expense table -> `prisma/schema.prisma:345-374`
  - Key fields: id, companyId, vendorId, categoryId, description, date, dueDate
  - Amount fields: netAmount, vatAmount, totalAmount (Decimal type)
  - Status field: status (ExpenseStatus enum) -> `prisma/schema.prisma:358`
  - Payment fields: paymentMethod, paymentDate -> `prisma/schema.prisma:359-360`
  - Optional fields: receiptUrl, notes -> `prisma/schema.prisma:361-362`

- **ExpenseCategory**: Expense categories -> `prisma/schema.prisma:376-390`
  - Key fields: id, companyId, name, code, vatDeductibleDefault
  - Supports both global (companyId: null) and company-specific categories
  - Used for categorization and default VAT deductibility

- **Contact**: Vendor information (shared with invoices) -> Referenced in relations
  - Expenses link to vendors via vendorId
  - Optional relationship, expenses can exist without vendor

### Status Enum

```typescript
enum ExpenseStatus {
  DRAFT        // Initial state, not yet confirmed
  PENDING      // Awaiting payment
  PAID         // Payment completed
  CANCELLED    // Cancelled/voided expense
}
```

Source: `prisma/schema.prisma:834-839`

### Status Labels

```typescript
const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Nacrt",
  PENDING: "Čeka plaćanje",
  PAID: "Plaćeno",
  CANCELLED: "Otkazano",
}
```

Source: `src/app/(dashboard)/expenses/[id]/page.tsx:10-15`

## Edit Restrictions

### Status-Based Rules

**Unlike invoices, expenses have NO status-based edit restrictions:**

- **DRAFT**: Can be edited and deleted -> `src/app/actions/expense.ts:103-109`
- **PENDING**: Can be edited and deleted -> `src/app/actions/expense.ts:103-109`
- **PAID**: Can be edited and deleted -> `src/app/actions/expense.ts:103-109`
- **CANCELLED**: Can be edited and deleted -> `src/app/actions/expense.ts:103-109`

### Server-Side Validation

```typescript
const existing = await db.expense.findFirst({
  where: { id },
})

if (!existing) {
  return { success: false, error: "Trošak nije pronađen" }
}
```

Source: `src/app/actions/expense.ts:103-109`

**Note**: No status check - any existing expense can be updated.

### Payment Status Validation

For markExpenseAsPaid action only:

```typescript
if (expense.status === "PAID") {
  return { success: false, error: "Trošak je već plaćen" }
}
```

Source: `src/app/actions/expense.ts:197-199`

### UI Conditional Rendering

- Payment dropdown shown only if status is not PAID or CANCELLED -> `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:14,43-55`
- Delete button always shown (no status restrictions) -> `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:56`
- Status badge is always clickable for inline editing -> `src/components/expenses/expense-inline-status.tsx:50-58`

## Field Validation

### Update Input Fields

All fields are optional in updateExpense (Partial<CreateExpenseInput>):

- **categoryId**: Must exist and be accessible to company -> `src/app/actions/expense.ts:113`
- **vendorId**: Optional, can be set, cleared, or updated -> `src/app/actions/expense.ts:114-116`
- **description**: String, free text -> `src/app/actions/expense.ts:117`
- **date**: DateTime, expense date -> `src/app/actions/expense.ts:118`
- **dueDate**: Optional DateTime -> `src/app/actions/expense.ts:119`
- **netAmount**: Decimal, net amount before VAT -> `src/app/actions/expense.ts:120`
- **vatAmount**: Decimal, VAT amount -> `src/app/actions/expense.ts:121`
- **totalAmount**: Decimal, total including VAT -> `src/app/actions/expense.ts:122`
- **vatDeductible**: Boolean, whether VAT is deductible -> `src/app/actions/expense.ts:123`
- **notes**: Optional text notes -> `src/app/actions/expense.ts:124`
- **paymentMethod**: Optional, triggers status change to PAID -> `src/app/actions/expense.ts:125-131`
- **receiptUrl**: Optional receipt file URL -> `src/app/actions/expense.ts:132-134`

### Inline Update Schema

```typescript
const expenseInlineSchema = z.object({
  status: z.nativeEnum(ExpenseStatus).optional(),
  totalAmount: z.number().optional(),
})
```

Source: `src/app/actions/expense.ts:220-223`

## Security Features

### Authentication & Authorization

- Requires authenticated user -> `src/app/actions/expense.ts:100,186,230`
- Tenant context isolation via requireCompanyWithContext -> `src/app/actions/expense.ts:102,188,232`
- Company ownership validation through tenant middleware -> `src/lib/prisma-extensions` (implicit)

### Permission Requirements

- **Update**: Standard company context, no special permission -> `src/app/actions/expense.ts:102`
- **Delete**: Requires 'expense:delete' permission -> `src/app/actions/expense.ts:155`
- **Mark as Paid**: Standard company context, no special permission -> `src/app/actions/expense.ts:188`
- **Inline Update**: Standard company context, no special permission -> `src/app/actions/expense.ts:232`

### Data Integrity

- Amounts stored as Decimal for precise monetary calculations -> `src/app/actions/expense.ts:120-122`
- Tenant isolation prevents cross-company access -> `src/app/actions/expense.ts:102`
- Payment method triggers automatic status and date updates -> `src/app/actions/expense.ts:125-131`
- Category validation ensures valid category assignment -> `src/app/actions/expense.ts:113`

## Dependencies

- **Depends on**:
  - Create Expense (F030) - Uses same data structures and validation
  - View Expenses (F032) - Entry point for editing
  - Expense Categories (F033) - Required for category assignment

- **Depended by**:
  - Mark Expense as Paid (F035) - Specialized update action
  - Expense Reporting - Uses updated expense data
  - Bank Reconciliation - May update expenses during reconciliation

## Integrations

### Prisma ORM

- Decimal type for precise monetary calculations -> `src/app/actions/expense.ts:9,120-122`
- Tenant context filtering via middleware -> `src/lib/prisma-extensions`
- Relation updates via connect/disconnect -> `src/app/actions/expense.ts:113-116`

### Next.js Cache

- revalidatePath for real-time UI updates -> `src/app/actions/expense.ts:141-142,210-211,262`
- Invalidates both list and detail views -> `src/app/actions/expense.ts:141-142`
- Supports optimistic UI updates in client components -> `src/components/expenses/expense-inline-status.tsx:26`

### Category System

- Validates category exists and is accessible -> Via ExpenseCategory query
- Supports both global and company-specific categories -> `src/app/actions/expense.ts:43-52`
- Categories have unique compound key (companyId, code) -> `prisma/schema.prisma:388`

## UI Components

### Detail Page Components

- **Card, CardHeader, CardTitle, CardContent**: Layout containers -> `src/app/(dashboard)/expenses/[id]/page.tsx:64-106`
- **Button**: Action triggers with variant styles -> `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:56`
- **ExpenseActions**: Action button group -> `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:41-58`
- **Link**: Navigation to expense list -> `src/app/(dashboard)/expenses/[id]/page.tsx:58`

### Inline Editing Components

- **ExpenseInlineStatus**: Clickable status badge -> `src/components/expenses/expense-inline-status.tsx:24-65`
  - Cycles through status values on click
  - Shows loading spinner during update
  - Displays error indicator on failure
  - Uses optimistic updates with useTransition

### Form Components (Create/Edit)

- **ExpenseForm**: Full form for expense creation -> `src/app/(dashboard)/expenses/new/expense-form.tsx:27-338`
  - Real-time VAT and total calculations
  - AI-powered category suggestions
  - Receipt scanner integration
  - Vendor and payment info editing

### Status Badge Styling

```typescript
const STATUS_COLORS: Record<ExpenseStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  PAID: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
}
```

Source: `src/components/expenses/expense-inline-status.tsx:17-22`

## Error Handling

- **Expense not found**: Returns error "Trošak nije pronađen" -> `src/app/actions/expense.ts:108,161,194,238`
- **Category not found**: Returns error during category validation (in create flow)
- **Already paid**: Returns error when trying to mark paid expense as paid -> `src/app/actions/expense.ts:198`
- **Permission denied**: Returns error for delete without permission -> `src/app/actions/expense.ts:173-175`
- **Invalid inline data**: Returns error "Neispravni podaci" for schema validation failure -> `src/app/actions/expense.ts:243`
- **Client-side validation**: Form validation before submit -> `src/app/(dashboard)/expenses/new/expense-form.tsx:134-139`
- **Optimistic update failures**: Shows error toast and restores previous state -> `src/components/expenses/expense-inline-status.tsx:43-45`

## Verification Checklist

- [x] User can view expense details at /expenses/:id
- [x] Expense actions show payment and delete buttons
- [x] No status-based restrictions on editing
- [x] updateExpense accepts partial updates
- [x] Category and vendor can be updated
- [x] Amounts are stored as Decimal for precision
- [x] Cache invalidation refreshes UI
- [x] Permission check for delete action only
- [x] Inline status updates work with optimistic UI
- [x] markExpenseAsPaid sets status and payment date
- [x] Tenant isolation prevents cross-company edits
- [x] Error messages are clear and localized

## Related Features

- **Create Expense**: `src/app/actions/expense.ts:33-93` (F030)
- **View Expenses**: `src/app/(dashboard)/expenses/page.tsx` (F032)
- **Delete Expense**: `src/app/actions/expense.ts:151-179` (part of edit feature)
- **Mark Expense as Paid**: `src/app/actions/expense.ts:181-218` (F035)
- **Expense Categories**: `src/app/actions/expense.ts:272-305` (F033)

## Evidence Links

1. `src/app/(dashboard)/expenses/[id]/page.tsx:1-116` - Main expense detail page with status display
2. `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:1-59` - Action buttons with pay/delete logic
3. `src/app/actions/expense.ts:95-149` - updateExpense server action with no status restrictions
4. `src/app/actions/expense.ts:103-109` - Expense existence check (no status validation)
5. `src/app/actions/expense.ts:111-134` - Field updates with partial input support
6. `src/app/actions/expense.ts:141-142` - Cache revalidation for UI updates
7. `src/app/actions/expense.ts:181-218` - markExpenseAsPaid with status validation
8. `src/app/actions/expense.ts:225-269` - updateExpenseInline for quick status changes
9. `src/components/expenses/expense-inline-status.tsx:1-65` - Inline status editing component
10. `prisma/schema.prisma:345-374` - Expense model with all fields
11. `prisma/schema.prisma:834-839` - ExpenseStatus enum definition
