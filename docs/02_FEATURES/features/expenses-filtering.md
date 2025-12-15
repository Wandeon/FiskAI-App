# Feature: Expense Filtering

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 15

## Purpose

The Expense Filtering feature provides a comprehensive, multi-criteria filtering system for expenses integrated into the unified documents hub (/documents?category=expense). Users can filter expenses by status, category, and search across vendor names, descriptions, and OIB numbers. The feature was originally built for a dedicated /expenses page with advanced multi-select filters and has been migrated to the unified documents system while preserving legacy filter components for backward compatibility.

## User Entry Points

| Type | Path                        | Evidence                                                            |
| ---- | --------------------------- | ------------------------------------------------------------------- |
| Page | /documents?category=expense | `src/app/(dashboard)/documents/page.tsx:96-104`                     |
| Page | /expenses                   | `src/app/(dashboard)/expenses/page.tsx:6` (redirects to /documents) |

## Core Flow

1. User navigates to /expenses (redirects to /documents?category=expense) → `src/app/(dashboard)/expenses/page.tsx:1-7`
2. System parses query parameters: category=expense, search, page → `src/app/(dashboard)/documents/page.tsx:90-96`
3. System fetches unified documents with expense category filter → `src/app/(dashboard)/documents/page.tsx:98-104`
4. Unified query fetches expenses with search filtering → `src/lib/documents/unified-query.ts:137-148`
5. Search filters are applied to vendor, description, and vendor OIB → `src/lib/documents/unified-query.ts:140-145`
6. Results are normalized with expense-specific formatting → `src/lib/documents/unified-query.ts:184-195`
7. Documents are sorted by date descending and paginated → `src/lib/documents/unified-query.ts:214-224`
8. User can interact with CategoryCards to filter by document type → `src/components/documents/category-cards.tsx:28`
9. User can enter search terms to filter by vendor/description → `src/app/(dashboard)/documents/page.tsx:210-225`
10. Pagination preserves all active filters via query parameters → `src/app/(dashboard)/documents/page.tsx:182-188`

## Key Modules

| Module                | Purpose                                             | Location                                      |
| --------------------- | --------------------------------------------------- | --------------------------------------------- |
| ExpensesPage          | Redirect route for backwards compatibility          | `src/app/(dashboard)/expenses/page.tsx`       |
| DocumentsPage         | Main server component with unified filtering logic  | `src/app/(dashboard)/documents/page.tsx`      |
| queryUnifiedDocuments | Server-side query aggregator for all doc types      | `src/lib/documents/unified-query.ts`          |
| ExpenseFilters        | Legacy filter component with multi-select dropdowns | `src/components/expenses/expense-filters.tsx` |
| CategoryCards         | Client component for category filter pills          | `src/components/documents/category-cards.tsx` |
| MultiSelect           | Reusable multi-select dropdown component            | `src/components/ui/multi-select.tsx`          |

## Filter Components

### Legacy Expense Filters (Preserved but deprecated in favor of unified documents)

The `ExpenseFilters` component was originally built for a dedicated /expenses page → `src/components/expenses/expense-filters.tsx:17-137`

**Features:**

- Search by vendor name, description, or OIB → `src/components/expenses/expense-filters.tsx:66-73`
- Multi-select filters for status (Draft, Pending, Paid, Cancelled) → `src/components/expenses/expense-filters.tsx:90-96`
- Multi-select filters for expense categories → `src/components/expenses/expense-filters.tsx:97-103`
- Clear all filters button → `src/components/expenses/expense-filters.tsx:54-59`
- Apply filters button with loading state → `src/components/expenses/expense-filters.tsx:107-109`
- URL-based state management via router.push → `src/components/expenses/expense-filters.tsx:40-52`
- Enter key support on search input → `src/components/expenses/expense-filters.tsx:70`

### Current Unified Documents Filtering

The new unified approach uses simpler, more intuitive filtering → `src/app/(dashboard)/documents/page.tsx:206-225`

**Features:**

- Category filter pills (All, Računi, E-Računi, Izvodi, Troškovi) → `src/components/documents/category-cards.tsx:19-29`
- Single search input for cross-field text search → `src/app/(dashboard)/documents/page.tsx:210-225`
- Real-time count badges on category pills → `src/components/documents/category-cards.tsx:68-74`
- Active category highlighting (Troškovi pill for expenses) → `src/components/documents/category-cards.tsx:60-64`
- Search preserved across category switches → `src/app/(dashboard)/documents/page.tsx:211`

## Server-Side Filtering Logic

### Unified Query Function

The `queryUnifiedDocuments` function handles expense filtering as part of the unified document system → `src/lib/documents/unified-query.ts:106-237`

**Query Parameters:**

- `companyId` (required) - Tenant isolation
- `category` (optional) - Filter by 'expense' to show only expenses
- `search` (optional) - Text search across vendor and description
- `page` (optional) - Pagination page number (default: 1)
- `pageSize` (optional) - Results per page (default: 20)

**Search Implementation:**

For expenses → `src/lib/documents/unified-query.ts:137-148`:

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

**Normalization:**

Expenses are normalized into the unified document format → `src/lib/documents/unified-query.ts:184-195`:

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

### Legacy Expense Filtering (Pre-Unification)

The original expense page used direct Prisma queries with advanced filtering → Historical reference from git commit dc4d38e

**Supported Filters:**

- `search` - Text search across vendor name, description, and vendor OIB
- `status` - ExpenseStatus enum filter (multi-select)
- `category` - ExpenseCategory ID filter (multi-select)
- `page` - Offset-based pagination
- Search used vendor relation join for name and OIB lookups

## Available Filter Options

### Expense Statuses

Defined in `prisma/schema.prisma:834-839`:

| Status    | Label (Croatian) | Color | Evidence                                |
| --------- | ---------------- | ----- | --------------------------------------- |
| DRAFT     | Nacrt            | gray  | `src/lib/documents/unified-query.ts:78` |
| PENDING   | Na čekanju       | gray  | `src/lib/documents/unified-query.ts:78` |
| PAID      | Plaćeno          | green | `src/lib/documents/unified-query.ts:81` |
| CANCELLED | Otkazano         | red   | `prisma/schema.prisma:838`              |

Note: Legacy status labels also included APPROVED and REJECTED for expense workflow states.

Croatian labels defined in → `src/lib/documents/unified-query.ts:77-82`

### Expense Categories

Categories can be:

- **Global categories** (companyId: null) - Available to all tenants
- **Company-specific categories** - Tenant-isolated custom categories

Default categories seeded by system → `src/app/actions/expense.ts:349-358`:

| Code      | Name (Croatian)   | VAT Deductible Default | Evidence                         |
| --------- | ----------------- | ---------------------- | -------------------------------- |
| OFFICE    | Uredski materijal | true                   | `src/app/actions/expense.ts:350` |
| TRAVEL    | Putni troškovi    | true                   | `src/app/actions/expense.ts:351` |
| FUEL      | Gorivo            | false (50% deductible) | `src/app/actions/expense.ts:352` |
| TELECOM   | Telekomunikacije  | true                   | `src/app/actions/expense.ts:353` |
| RENT      | Najam             | true                   | `src/app/actions/expense.ts:354` |
| UTILITIES | Režije            | true                   | `src/app/actions/expense.ts:355` |
| SERVICES  | Usluge            | true                   | `src/app/actions/expense.ts:356` |
| OTHER     | Ostalo            | false                  | `src/app/actions/expense.ts:357` |

### Document Category

When filtering via unified documents hub:

| Category | Label  | Color Class                   | Evidence                                |
| -------- | ------ | ----------------------------- | --------------------------------------- |
| expense  | Trošak | bg-orange-100 text-orange-800 | `src/lib/documents/unified-query.ts:26` |

## Data

### Database Tables

- **Expense** → `prisma/schema.prisma:345-374`
  - Indexed fields: companyId, date, status, categoryId
  - Searchable fields: vendor (from Contact relation), description
  - Filterable fields: status, categoryId
  - Related: category (ExpenseCategory), vendor (Contact), company (Company)
  - Amount fields: netAmount, vatAmount, totalAmount (Decimal)

- **ExpenseCategory** → `prisma/schema.prisma:376-390`
  - Fields: name, code, vatDeductibleDefault, isActive
  - Unique constraint: companyId + code
  - Supports both global (null companyId) and company-specific categories
  - Special handling required for OR query: `{ OR: [{ companyId: company.id }, { companyId: null }] }` → `src/app/actions/expense.ts:46`

- **Contact** (Vendor relation) → Used for vendor lookups
  - Fields: name, oib, email, address
  - Related to expenses via vendorId

### Query Performance

- Parallel queries for all document types → `src/lib/documents/unified-query.ts:110-153`
- Expenses query is one of 6 parallel database queries (3 data fetches + 3 counts)
- Uses Prisma's `contains` with `mode: 'insensitive'` for case-insensitive search
- Tenant isolation via global tenant context (automatic filtering by companyId)
- In-memory sorting and pagination after aggregation → `src/lib/documents/unified-query.ts:214-224`
- Legacy implementation used vendor relation joins for OIB search

## State Management

### URL-Based State (Current Implementation)

All filter state is stored in URL query parameters → `src/app/(dashboard)/documents/page.tsx:90-96`

**Parameters:**

- `category=expense` - Document category filter (always 'expense' for expense view)
- `search` - Search term (string, applied to vendor/description)
- `page` - Current page number (number, default: 1)

**Benefits:**

- Shareable URLs with filters applied
- Browser back/forward navigation works correctly
- Server-side rendering compatible
- No client-side state management needed

### Legacy Client State (ExpenseFilters)

The old ExpenseFilters component uses React state → `src/components/expenses/expense-filters.tsx:27-33`

**State Variables:**

- `search` - Text search input value
- `statusValues` - Selected statuses (MultiSelectOption[])
- `categoryValues` - Selected expense categories (MultiSelectOption[])
- `isPending` - Loading state during navigation (useTransition)

**URL Parameter Encoding:**

- Multiple values appended as separate params: `?status=PAID&status=PENDING&category=id1&category=id2`
- Search as single value: `?search=vendor%20name`
- Filters preserved in pagination links

## Pagination

### Current Implementation

Simple offset-based pagination → `src/app/(dashboard)/documents/page.tsx:298-320`

**Features:**

- Page number in query params → `src/app/(dashboard)/documents/page.tsx:93-94`
- Previous/Next links preserve all filters → `src/app/(dashboard)/documents/page.tsx:182-188`
- Current page indicator (e.g., "Stranica 2 od 5") → `src/app/(dashboard)/documents/page.tsx:308-310`
- 20 results per page → `src/app/(dashboard)/documents/page.tsx:103`

### Legacy Implementation

Offset-based pagination with multi-value filter preservation → Historical reference from git commit dc4d38e

**Implementation:**

- `page` parameter controls offset: `skip = (page - 1) * pageSize`
- `pageSize = 20` fixed
- All filter params (status[], category[], search) preserved in pagination links
- Total pages calculated from count query

## Export Functionality

CSV export endpoint supports date-range filtering → `src/app/api/exports/expenses/route.ts:1-130`

**Features:**

- Query parameters: `from` and `to` (ISO date strings) → `src/app/api/exports/expenses/route.ts:6-9`
- Filters expenses by date range if provided → `src/app/api/exports/expenses/route.ts:73-84`
- Exports all fields including vendor OIB → `src/app/api/exports/expenses/route.ts:87-91`
- CSV format with semicolon delimiters → `src/app/api/exports/expenses/route.ts:36`
- Includes vendor relation for name and OIB → `src/app/api/exports/expenses/route.ts:87-89`

**CSV Columns:**

Datum, Opis, Dobavljač, OIB dobavljača, Kategorija, Status, Osnovica, PDV, Ukupno, Plaćeno, Datum plaćanja, Način plaćanja, Link na račun/sliku, Napomena → `src/app/api/exports/expenses/route.ts:93-108`

## Dependencies

- **Depends on**:
  - [[auth-login]] - User must be authenticated → `src/app/(dashboard)/documents/page.tsx:43`
  - [[company-management]] - Company context required for tenant isolation → `src/app/(dashboard)/documents/page.tsx:44`
  - [[expense-management]] - Expense and ExpenseCategory models
  - [[contact-management]] - Contact model for vendor relations

- **Depended by**:
  - [[dashboard-main]] - Links to filtered expense views
  - [[expense-management]] - Core expense CRUD operations
  - [[reporting-exports]] - CSV export uses similar filtering logic
  - [[expense-reconciliation]] - Bank transaction matching may use expense filters

## Integrations

None - This is a pure data query and display feature with no external API integrations.

## Verification Checklist

- [x] Authenticated user can access /documents?category=expense with filters
- [x] Legacy /expenses route redirects to unified documents hub
- [x] Search input filters by vendor name case-insensitively
- [x] Search input filters by description case-insensitively
- [x] Expense category pill displays correct count
- [x] Active category (Troškovi) is visually highlighted
- [x] Pagination preserves search term in URLs
- [x] Empty state displays when no expenses match filters
- [x] Filter state persists through browser back/forward navigation
- [x] All queries are tenant-scoped (companyId isolation)
- [x] Legacy ExpenseFilters component still functional for backward compatibility
- [x] Mobile responsive layout works correctly
- [x] CSV export includes vendor OIB field
- [x] Global and company-specific categories both accessible

## Evidence Links

1. `src/app/(dashboard)/expenses/page.tsx:1-7` - Redirect route to unified documents hub
2. `src/app/(dashboard)/documents/page.tsx:90-104` - Query parameter parsing and unified query invocation
3. `src/lib/documents/unified-query.ts:137-148` - Expense query with search filtering
4. `src/lib/documents/unified-query.ts:184-195` - Expense normalization to unified document format
5. `src/components/expenses/expense-filters.tsx:17-137` - Legacy expense filter component with multi-select
6. `src/components/documents/category-cards.tsx:19-29` - Category filter pills including expense category
7. `src/components/ui/multi-select.tsx:19-74` - Multi-select dropdown component
8. `src/lib/documents/unified-query.ts:77-82` - Expense status label translations
9. `src/app/actions/expense.ts:349-358` - Default expense category seed data
10. `src/app/api/exports/expenses/route.ts:81-91` - CSV export with date filtering and vendor OIB
11. `prisma/schema.prisma:345-374` - Expense model with indexed fields
12. `prisma/schema.prisma:376-390` - ExpenseCategory model with global/company-specific support
13. `prisma/schema.prisma:834-839` - ExpenseStatus enum definition
14. `src/app/actions/expense.ts:43-48` - Category query with OR condition for global/company categories
15. `audit/work-log-2025-02-14.md:86-88` - Implementation notes for expense filtering with multi-select
