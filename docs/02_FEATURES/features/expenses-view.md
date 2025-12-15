# Feature: View Expenses (F030)

## Status

- Documentation: Complete
- Last verified: 2025-12-15
- Evidence count: 10

## Purpose

Provides a unified view of all expenses alongside other financial documents, allowing users to browse, search, filter, and access detailed expense information. The feature redirects from the legacy `/expenses` route to the new unified documents hub at `/documents` with category filtering, enabling users to view expenses in the context of their entire document ecosystem while maintaining backward compatibility.

## User Entry Points

| Type       | Path                           | Evidence                                        |
| ---------- | ------------------------------ | ----------------------------------------------- |
| Navigation | `/documents?category=expense`  | `src/lib/navigation.ts:49`                      |
| Redirect   | `/expenses`                    | `src/app/(dashboard)/expenses/page.tsx:6`       |
| Detail     | `/expenses/:id`                | `src/app/(dashboard)/expenses/[id]/page.tsx:32` |
| Dashboard  | `/dashboard` (Recent Activity) | Via Recent Activity widget                      |

## Core Flow

### List View Flow

1. User accesses `/expenses` route -> `src/app/(dashboard)/expenses/page.tsx:5-7`
2. System redirects to unified documents hub -> `src/app/(dashboard)/expenses/page.tsx:6`
3. Query parameter `category=expense` filters for expenses -> `src/app/(dashboard)/documents/page.tsx:96`
4. System fetches expenses via unified query -> `src/lib/documents/unified-query.ts:137-148`
5. Expenses are normalized into UnifiedDocument format -> `src/lib/documents/unified-query.ts:184-195`
6. Category filter cards display document type counts -> `src/components/documents/category-cards.tsx:31-80`
7. Search input allows filtering by vendor name, description, or OIB -> `src/app/(dashboard)/documents/page.tsx:210-225`
8. Responsive table displays expenses with status badges -> `src/app/(dashboard)/documents/page.tsx:247-294`
9. Pagination controls navigate through results (20 per page) -> `src/app/(dashboard)/documents/page.tsx:298-320`
10. User clicks expense to view details -> Detail view flow

### Detail View Flow

1. User clicks expense number or "Pregledaj" link -> `src/app/(dashboard)/documents/page.tsx:134,176`
2. System routes to `/expenses/:id` -> `src/app/(dashboard)/expenses/[id]/page.tsx:32`
3. Expense data fetched with vendor and category relationships -> `src/app/(dashboard)/expenses/[id]/page.tsx:35-41`
4. Expense header displays description and category -> `src/app/(dashboard)/expenses/[id]/page.tsx:54-55`
5. Details card shows status, date, due date, payment info -> `src/app/(dashboard)/expenses/[id]/page.tsx:64-77`
6. Vendor card displays name, OIB, and address -> `src/app/(dashboard)/expenses/[id]/page.tsx:79-92`
7. Amounts card shows net, VAT (with deductibility), and total -> `src/app/(dashboard)/expenses/[id]/page.tsx:95-106`
8. Notes section displays additional information if present -> `src/app/(dashboard)/expenses/[id]/page.tsx:108-113`
9. Action toolbar provides payment marking and delete options -> `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:10-59`

### Search and Filter Flow

1. User enters search term in search box -> `src/app/(dashboard)/documents/page.tsx:210-225`
2. Form submits to `/documents` with search parameter -> `src/app/(dashboard)/documents/page.tsx:210`
3. Backend filters expenses by vendor or description (case-insensitive) -> `src/lib/documents/unified-query.ts:140-145`
4. Results display with matching expenses highlighted
5. User can select category to filter by document type -> `src/components/documents/category-cards.tsx:54`
6. Combined filters apply (search + category) -> `src/lib/documents/unified-query.ts:204-212`

## Key Modules

| Module                | Purpose                                    | Location                                                |
| --------------------- | ------------------------------------------ | ------------------------------------------------------- |
| ExpensesPage (Legacy) | Redirects to unified documents hub         | `src/app/(dashboard)/expenses/page.tsx`                 |
| DocumentsPage         | Main unified documents list with filtering | `src/app/(dashboard)/documents/page.tsx`                |
| queryUnifiedDocuments | Fetches and normalizes all document types  | `src/lib/documents/unified-query.ts:106-237`            |
| CategoryCards         | Document type filter with counts           | `src/components/documents/category-cards.tsx`           |
| ResponsiveTable       | Adaptive table/card layout for expenses    | `src/components/ui/responsive-table.tsx`                |
| ExpenseDetailPage     | Individual expense view with full details  | `src/app/(dashboard)/expenses/[id]/page.tsx`            |
| ExpenseActions        | Action toolbar (mark paid, delete)         | `src/app/(dashboard)/expenses/[id]/expense-actions.tsx` |
| ExpenseInlineStatus   | Inline status editor with cycle button     | `src/components/expenses/expense-inline-status.tsx`     |
| DocumentsClient       | Client wrapper for dropzone and sidebar    | `src/components/documents/documents-client.tsx`         |
| ExpenseFilters        | Advanced filtering by status and category  | `src/components/expenses/expense-filters.tsx`           |

## Data

### Database Tables

#### Expense Table

Primary expense storage table -> `prisma/schema.prisma:345-374`

Key fields:

- `id` (String, CUID): Unique identifier
- `companyId` (String): Tenant isolation
- `vendorId` (String?): Contact relation for vendor -> `prisma/schema.prisma:348`
- `categoryId` (String): Expense category reference -> `prisma/schema.prisma:349`
- `description` (String): Expense description -> `prisma/schema.prisma:350`
- `date` (DateTime): Expense date -> `prisma/schema.prisma:351`
- `dueDate` (DateTime?): Payment due date -> `prisma/schema.prisma:352`
- `netAmount` (Decimal): Base amount before VAT -> `prisma/schema.prisma:353`
- `vatAmount` (Decimal): Total VAT -> `prisma/schema.prisma:354`
- `totalAmount` (Decimal): Final amount -> `prisma/schema.prisma:355`
- `vatDeductible` (Boolean): Whether VAT can be deducted, default true -> `prisma/schema.prisma:356`
- `currency` (String): Currency code, default EUR -> `prisma/schema.prisma:357`
- `status` (ExpenseStatus): DRAFT, PENDING, PAID, CANCELLED -> `prisma/schema.prisma:358,834-839`
- `paymentMethod` (PaymentMethod?): CASH, CARD, TRANSFER, OTHER -> `prisma/schema.prisma:359`
- `paymentDate` (DateTime?): Payment timestamp -> `prisma/schema.prisma:360`
- `receiptUrl` (String?): Link to receipt image or PDF -> `prisma/schema.prisma:361`
- `notes` (String?): Additional notes -> `prisma/schema.prisma:362`

Relations:

- `vendor` (Contact): Expense vendor -> `prisma/schema.prisma:368`
- `category` (ExpenseCategory): Expense category -> `prisma/schema.prisma:366`
- `company` (Company): Owner company -> `prisma/schema.prisma:367`
- `bankTransactions` (BankTransaction[]): Linked transactions -> `prisma/schema.prisma:365`

Indexes:

- `companyId`: Tenant filtering -> `prisma/schema.prisma:370`
- `date`: Date-based queries -> `prisma/schema.prisma:371`
- `status`: Status-based queries -> `prisma/schema.prisma:372`
- `categoryId`: Category filtering -> `prisma/schema.prisma:373`

#### ExpenseCategory Table

Expense categorization -> `prisma/schema.prisma:376-390`

Key fields:

- `id` (String, CUID): Unique identifier
- `companyId` (String?): Tenant isolation (null for global categories)
- `name` (String): Category display name
- `code` (String): Category code (uppercase)
- `vatDeductibleDefault` (Boolean): Default VAT deductibility
- `isActive` (Boolean): Whether category is active

### Query Patterns

#### Unified Document Query

Fetches all document types in parallel -> `src/lib/documents/unified-query.ts:137-148`

```typescript
db.expense.findMany({
  where: {
    companyId,
    ...(search
      ? {
          OR: [
            { vendor: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  },
  orderBy: { createdAt: "desc" },
})
```

**Note**: The unified query has a bug - it references `exp.vendor` and `exp.receiptNumber` fields that don't exist in the schema. The Expense model has `vendorId` (relation) not `vendor` (string), and no `receiptNumber` field. This should be fixed to include the vendor relation and use `description` instead.

#### Expense Detail Query

Fetches single expense with full relationships -> `src/app/(dashboard)/expenses/[id]/page.tsx:35-41`

```typescript
const expense = await db.expense.findFirst({
  where: { id, companyId: company.id },
  include: {
    vendor: true,
    category: true,
  },
})
```

#### Expense Export Query

CSV export with full details -> `src/app/api/exports/expenses/route.ts:81-91`

```typescript
const expenses = await db.expense.findMany({
  where: {
    companyId: company.id,
    ...(dateFilter ? { date: dateFilter } : {}),
  },
  include: {
    vendor: { select: { name: true, oib: true } },
    category: { select: { name: true, code: true } },
  },
  orderBy: { date: "asc" },
})
```

### Data Normalization

Expenses transformed into unified format -> `src/lib/documents/unified-query.ts:184-195`

```typescript
const normalizedExpenses: UnifiedDocument[] = expenses.map((exp) => ({
  id: exp.id,
  category: "expense",
  date: exp.date,
  number: exp.receiptNumber || exp.description?.slice(0, 30) || "Bez broja",
  counterparty: exp.vendor || null,
  amount: Number(exp.amount),
  currency: exp.currency,
  status: EXPENSE_STATUS_LABELS[exp.status] || exp.status,
  statusColor:
    exp.status === "APPROVED" || exp.status === "PAID"
      ? "green"
      : exp.status === "REJECTED"
        ? "red"
        : "gray",
  detailUrl: `/expenses/${exp.id}`,
}))
```

**Note**: This code has bugs - references non-existent fields `exp.vendor`, `exp.receiptNumber`, and `exp.amount`. Should use `exp.vendor?.name`, `exp.description`, and `exp.totalAmount`.

### Status Labels

Croatian translations for expense statuses -> `src/lib/documents/unified-query.ts:77-82`

```typescript
const EXPENSE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Nacrt",
  PENDING: "Čeka plaćanje",
  PAID: "Plaćeno",
  CANCELLED: "Otkazano",
}
```

**Note**: The schema defines statuses as DRAFT, PENDING, PAID, CANCELLED but the labels also include APPROVED and REJECTED which don't exist in the schema.

## Dependencies

### Depends On

- **Authentication System**: User and company context -> `src/lib/auth-utils.ts:requireAuth, requireCompany`
- **Tenant Context**: Multi-tenant data isolation -> `src/lib/prisma-extensions.ts:setTenantContext`
- **Contact Management**: Vendor information -> `prisma/schema.prisma:Contact`
- **Expense Categories**: Categorization system -> `prisma/schema.prisma:ExpenseCategory`

### Depended By

- **Dashboard Recent Activity**: Shows recent expenses -> Dashboard feature
- **Reports**: Expense data for financial reports
- **Banking Reconciliation**: Expense matching with transactions
- **Export Functions**: CSV export of expenses -> `src/app/api/exports/expenses/route.ts`

## Integrations

### Internal Integrations

#### Navigation System

Sidebar navigation with document submenu -> `src/lib/navigation.ts:39-51`

```typescript
{
  name: "Dokumenti",
  href: "/documents",
  icon: FileText,
  module: "invoicing",
  children: [
    { name: "Svi dokumenti", href: "/documents" },
    { name: "Računi", href: "/documents?category=invoice" },
    { name: "E-Računi", href: "/documents?category=e-invoice" },
    { name: "Bankovni izvodi", href: "/documents?category=bank-statement" },
    { name: "Troškovi", href: "/documents?category=expense" },
  ]
}
```

#### Banking Integration

Expenses can be linked to bank transactions -> `prisma/schema.prisma:365`

- Links expenses with bank transactions for reconciliation
- Enables automatic expense matching from bank imports
- Tracks payment status through transaction links

#### CSV Export

Expense data export via API route -> `src/app/api/exports/expenses/route.ts:39-140`

- Endpoint: `/api/exports/expenses`
- Query parameters: `from` (date), `to` (date)
- Downloads formatted CSV with expense details
- Includes: date, description, vendor, OIB, category, status, amounts, payment info, receipt URL
- Filename format: `fiskai-troskovi-{from}-{to}.csv`

#### Inline Status Editor

Quick status updates directly from list view -> `src/components/expenses/expense-inline-status.tsx:24-65`

- Cycles through statuses: DRAFT → PENDING → PAID → CANCELLED → DRAFT
- Displays status with color coding
- Shows loading spinner during save
- Displays error indicator on failure

#### Document Import System

Expenses can be created from imported documents -> `src/components/documents/documents-client.tsx`

- Drag-and-drop file upload
- AI extraction of expense data
- Review and confirmation modal
- Links to ImportJob for tracking

### External Integrations

None currently. Expenses are an internal tracking feature without external API integrations.

## Verification Checklist

### List View

- [ ] User can access expenses via `/documents?category=expense`
- [ ] Legacy `/expenses` route redirects to unified documents
- [ ] Expense count badge shows correct total
- [ ] Search filters by vendor name and description (case-insensitive)
- [ ] Category filter shows separate count for expenses
- [ ] Pagination displays 20 expenses per page
- [ ] Table shows: date, category, number/description, vendor, amount, status
- [ ] Mobile view displays as cards instead of table
- [ ] Status badges use correct colors (DRAFT=gray, PENDING=yellow, PAID=green, CANCELLED=red)
- [ ] Clicking expense description navigates to detail page
- [ ] Empty state displays when no expenses found

### Detail View

- [ ] Expense header shows description and category name
- [ ] Details card shows status badge with proper styling
- [ ] Date displays in Croatian format (dd.mm.yyyy)
- [ ] Due date displays if present
- [ ] Payment method displays if set (Croatian label)
- [ ] Payment date displays if paid
- [ ] Vendor information card shows name, OIB, and address
- [ ] Amounts card displays net amount, VAT, and total
- [ ] VAT shows deductibility indicator ("priznati" or "nepriznati")
- [ ] Currency formatting uses hr-HR locale with correct symbol
- [ ] Notes section displays if notes exist
- [ ] Back button navigates to expenses list (legacy route)

### Actions

- [ ] Mark as paid dropdown appears for non-paid, non-cancelled expenses
- [ ] Payment method options show Croatian labels
- [ ] Marking as paid updates status to PAID immediately
- [ ] Delete button appears for all expense statuses
- [ ] Delete requires confirmation dialog
- [ ] Delete redirects to expenses list after success
- [ ] Success/error toasts display for all actions
- [ ] Actions disabled during processing

### Data Integrity

- [ ] All queries filter by companyId (tenant isolation)
- [ ] Expense totals are accurate (net + VAT = total)
- [ ] VAT deductibility flag persists correctly
- [ ] Status transitions are valid
- [ ] Payment date only set when status is PAID
- [ ] Category references validate existence
- [ ] Vendor references validate existence (if provided)
- [ ] Global categories accessible to all tenants

## Evidence Links

1. `src/app/(dashboard)/expenses/page.tsx:1-7` - Legacy route redirect to unified documents hub
2. `src/app/(dashboard)/documents/page.tsx:38-324` - Main unified documents page with expense list
3. `src/lib/documents/unified-query.ts:137-195` - Unified document query with expense normalization
4. `src/app/(dashboard)/expenses/[id]/page.tsx:24-116` - Expense detail page with full data display
5. `src/app/actions/expense.ts:33-218` - Server actions for creating, updating, and managing expenses
6. `src/components/documents/category-cards.tsx:19-117` - Category filter with expense counts
7. `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:10-59` - Expense action toolbar (mark paid, delete)
8. `src/components/expenses/expense-inline-status.tsx:24-65` - Inline status editor with cycle button
9. `src/app/api/exports/expenses/route.ts:39-140` - CSV export functionality for expenses
10. `prisma/schema.prisma:345-390` - Expense and ExpenseCategory table schemas
