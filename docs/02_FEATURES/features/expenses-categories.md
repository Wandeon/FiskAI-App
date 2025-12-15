# Feature: Expense Categories

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 13

## Purpose

The Expense Categories feature provides a comprehensive category management system for classifying business expenses. It supports both system-wide default categories and company-specific custom categories, with built-in VAT deductibility defaults to streamline expense tracking and VAT reporting. Categories can be seeded with Croatian business-standard defaults or created individually to match specific business needs.

## User Entry Points

| Type | Path                 | Evidence                                                        |
| ---- | -------------------- | --------------------------------------------------------------- |
| Page | /expenses/categories | `src/app/(dashboard)/expenses/categories/page.tsx:10`           |
| Page | /expenses/new        | `src/app/(dashboard)/expenses/new/page.tsx:8` (uses categories) |

## Core Flow

1. User navigates to /expenses/categories → `src/app/(dashboard)/expenses/categories/page.tsx:10-94`
2. System loads categories: both global (companyId: null) and company-specific → `src/app/(dashboard)/expenses/categories/page.tsx:16-20`
3. Categories are displayed in two groups: "Vaše kategorije" and "Sistemske kategorije" → `src/app/(dashboard)/expenses/categories/page.tsx:48-91`
4. User can seed default categories if none exist → `src/app/(dashboard)/expenses/categories/seed-button.tsx:9-30`
5. System creates 8 predefined categories via seedDefaultCategories action → `src/app/actions/expense.ts:344-375`
6. User can create custom categories via inline form → `src/app/(dashboard)/expenses/categories/category-form.tsx:10-50`
7. System validates unique code per company → `src/app/actions/expense.ts:281-288`
8. When creating expenses, categories are loaded and used for classification → `src/app/(dashboard)/expenses/new/page.tsx:23-26`
9. Category dropdown auto-sets VAT deductible default → `src/app/(dashboard)/expenses/new/expense-form.tsx:212`
10. AI-based category suggestions use categories for keyword matching → `src/lib/ai/categorize.ts:20-47`

## Key Modules

| Module                  | Purpose                                       | Location                                                    |
| ----------------------- | --------------------------------------------- | ----------------------------------------------------------- |
| ExpenseCategoriesPage   | Main category management page                 | `src/app/(dashboard)/expenses/categories/page.tsx`          |
| CategoryForm            | Client component for creating categories      | `src/app/(dashboard)/expenses/categories/category-form.tsx` |
| SeedButton              | Triggers seeding of default categories        | `src/app/(dashboard)/expenses/categories/seed-button.tsx`   |
| createExpenseCategory   | Server action for category creation           | `src/app/actions/expense.ts:272-305`                        |
| seedDefaultCategories   | Server action for bulk category creation      | `src/app/actions/expense.ts:344-375`                        |
| deleteExpenseCategory   | Server action for category deletion           | `src/app/actions/expense.ts:307-341`                        |
| suggestCategory         | AI-powered category suggestion via keywords   | `src/lib/ai/categorize.ts:20-47`                            |
| suggestCategoryByVendor | AI-powered suggestion based on vendor history | `src/lib/ai/categorize.ts:49-91`                            |

## Category Structure

### Database Schema

From `prisma/schema.prisma:376-390`:

```prisma
model ExpenseCategory {
  id                   String    @id @default(cuid())
  companyId            String?   // null = system default (global)
  name                 String    // Display name (e.g., "Uredski materijal")
  code                 String    // Unique code (e.g., "OFFICE")
  vatDeductibleDefault Boolean   @default(true)
  isActive             Boolean   @default(true)
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt
  expenses             Expense[]
  company              Company?  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@unique([companyId, code])
  @@index([companyId])
}
```

### Category Hierarchy

The system supports a **two-tier hierarchy**:

1. **System Categories** (companyId: null) → `src/app/(dashboard)/expenses/categories/page.tsx:23`
   - Global categories accessible to all companies
   - Cannot be edited or deleted by users
   - Created by system administrators or migrations
   - Displayed with reduced opacity to indicate read-only status → `src/app/(dashboard)/expenses/categories/page.tsx:80`

2. **Company Categories** (companyId: {companyId}) → `src/app/(dashboard)/expenses/categories/page.tsx:22`
   - Custom categories specific to a single company
   - Created by company users via category form
   - Can be deleted if no expenses use them → `src/app/actions/expense.ts:320-324`
   - Take precedence in UI display → `src/app/(dashboard)/expenses/categories/page.tsx:48-72`

**Loading Pattern**: Both system and company categories are loaded together using OR clause → `src/app/actions/expense.ts:43-47`:

```typescript
const category = await db.expenseCategory.findFirst({
  where: {
    id: input.categoryId,
    OR: [{ companyId: company.id }, { companyId: null }],
  },
})
```

## Predefined Categories

### Default Categories Seed

When a company has no custom categories, they can seed 8 default categories → `src/app/actions/expense.ts:349-358`:

| Code      | Name (Croatian)   | VAT Deductible Default | Purpose                          |
| --------- | ----------------- | ---------------------- | -------------------------------- |
| OFFICE    | Uredski materijal | Yes                    | Office supplies and materials    |
| TRAVEL    | Putni troškovi    | Yes                    | Travel expenses                  |
| FUEL      | Gorivo            | No                     | Fuel (50% deductible in Croatia) |
| TELECOM   | Telekomunikacije  | Yes                    | Telecommunications               |
| RENT      | Najam             | Yes                    | Rent and lease payments          |
| UTILITIES | Režije            | Yes                    | Utilities (electricity, water)   |
| SERVICES  | Usluge            | Yes                    | Professional services            |
| OTHER     | Ostalo            | No                     | Miscellaneous expenses           |

**Note**: FUEL is set to non-deductible by default because Croatian VAT law allows only 50% deductibility for fuel expenses, which must be manually calculated → `src/app/actions/expense.ts:352`.

## Category Management Operations

### Create Category

**User Flow**:

1. User fills inline form with code, name, and VAT deductible checkbox → `src/app/(dashboard)/expenses/categories/category-form.tsx:36-48`
2. Form submits to createExpenseCategory action → `src/app/(dashboard)/expenses/categories/category-form.tsx:19`
3. Code is automatically uppercased → `src/app/actions/expense.ts:293`
4. System validates unique code per company → `src/app/actions/expense.ts:282-288`
5. Category is created and page refreshes → `src/app/(dashboard)/expenses/categories/category-form.tsx:28`

**Validation**:

- Code must be unique within company scope (composite unique constraint) → `prisma/schema.prisma:388`
- Both name and code are required → `src/app/(dashboard)/expenses/categories/category-form.tsx:38-41`
- VAT deductible defaults to checked (true) → `src/app/(dashboard)/expenses/categories/category-form.tsx:44`

### Delete Category

**Constraints** → `src/app/actions/expense.ts:307-341`:

- User must have `expense_category:delete` permission → `src/app/actions/expense.ts:311`
- Category cannot be deleted if it has associated expenses → `src/app/actions/expense.ts:320-324`
- System categories (companyId: null) cannot be deleted by users

**Error Messages**:

- "Kategorija nije pronađena" - Category not found
- "Nije moguće obrisati kategoriju koja ima troškove" - Cannot delete category with expenses
- "Nemate dopuštenje za brisanje kategorija" - Permission denied

### Seed Default Categories

**Trigger**: "Kreiraj zadane kategorije" button appears when company has no custom categories → `src/app/(dashboard)/expenses/categories/page.tsx:34`

**Implementation** → `src/app/actions/expense.ts:344-375`:

- Uses `upsert` to avoid duplicates → `src/app/actions/expense.ts:361-365`
- Creates all 8 categories with company-specific ownership
- Sets companyId explicitly (not null like system categories)
- Returns success after batch creation

## VAT Tax Code Associations

### VAT Deductibility Default

Categories include a `vatDeductibleDefault` boolean field → `prisma/schema.prisma:381`:

**Purpose**:

- Pre-fills VAT deductible checkbox when creating expenses → `src/app/(dashboard)/expenses/new/expense-form.tsx:212`
- Streamlines data entry for common expense types
- Can be overridden per-expense if needed → `src/app/(dashboard)/expenses/new/expense-form.tsx:293`

**Usage in Expense Creation**:
When user selects a category, the form auto-sets vatDeductible → `src/app/(dashboard)/expenses/new/expense-form.tsx:212`:

```typescript
onChange={(e) => {
  setCategoryId(e.target.value);
  const cat = categories.find(c => c.id === e.target.value);
  if (cat) setVatDeductible(cat.vatDeductibleDefault);
}}
```

**Impact on VAT Reporting** → `src/app/(dashboard)/reports/vat/page.tsx:39-46`:

- Expenses with vatDeductible=true contribute to deductible input VAT → `src/app/(dashboard)/reports/vat/page.tsx:56`
- Expenses with vatDeductible=false contribute to non-deductible input VAT → `src/app/(dashboard)/reports/vat/page.tsx:57`
- VAT payable = Output VAT - Deductible Input VAT → `src/app/(dashboard)/reports/vat/page.tsx:61`

### No Direct Tax Code Mapping

**Important**: Categories do NOT directly map to Croatian tax codes or chart of accounts. They are:

- Business classification tools only
- Used for reporting and analytics
- Used to set VAT deductibility defaults
- Not fiscalization requirements

## AI-Powered Category Suggestions

### Keyword-Based Suggestions

The system uses keyword matching to suggest categories → `src/lib/ai/categorize.ts:5-18`:

**Keyword Dictionary** (selected examples):

- OFFICE: ['papir', 'toner', 'uredski', 'office', 'printer', 'pisač']
- TRAVEL: ['gorivo', 'benzin', 'diesel', 'cestarina', 'parking', 'put']
- TELECOM: ['mobitel', 'internet', 'telefon', 'a1', 'tele2', 'telemach']
- MARKETING: ['marketing', 'reklama', 'promocija', 'oglas', 'advertising']

**Suggestion Algorithm** → `src/lib/ai/categorize.ts:28-44`:

1. Convert description to lowercase
2. Check each category's keywords against description
3. Calculate confidence: matches × 0.3 (capped at 0.9)
4. Return top 3 suggestions sorted by confidence
5. Include matched keywords in reason field

**Display** → `src/app/(dashboard)/expenses/new/expense-form.tsx:216-247`:

- Shows as clickable badges below category dropdown
- Displays confidence percentage
- Shows matched keywords on hover
- Triggered on description or vendor name change → `src/app/(dashboard)/expenses/new/expense-form.tsx:52-84`

### Vendor-Based Suggestions

The system learns from previous expenses → `src/lib/ai/categorize.ts:49-91`:

**Logic**:

1. Find most recent expense from same vendor → `src/lib/ai/categorize.ts:67-78`
2. Suggest that expense's category with 95% confidence
3. Include vendor name in reason: "Prethodno korišteno za '{vendor}'" → `src/lib/ai/categorize.ts:85`

**Priority**: Vendor suggestions appear first due to higher confidence → `src/app/api/ai/suggest-category/route.ts:38-42`

## Data

### Database Tables

- **ExpenseCategory** → `prisma/schema.prisma:376-390`
  - Indexed fields: companyId (for tenant isolation)
  - Unique constraint: (companyId, code) composite key
  - Relationships: Company (optional), Expense[] (one-to-many)
  - Soft delete: isActive boolean flag

- **Expense** → `prisma/schema.prisma:345-374`
  - Foreign key: categoryId (required)
  - Uses category's vatDeductibleDefault as starting value
  - Includes usage count in category listing → `src/app/(dashboard)/expenses/categories/page.tsx:18`

### Query Patterns

**Category Loading for Expense Form** → `src/app/(dashboard)/expenses/new/page.tsx:23-26`:

```typescript
db.expenseCategory.findMany({
  where: { OR: [{ companyId: company.id }, { companyId: null }], isActive: true },
  orderBy: { name: "asc" },
})
```

**Category Display with Usage Count** → `src/app/(dashboard)/expenses/categories/page.tsx:16-20`:

```typescript
db.expenseCategory.findMany({
  where: { OR: [{ companyId: company.id }, { companyId: null }] },
  include: { _count: { select: { expenses: true } } },
  orderBy: { name: "asc" },
})
```

## State Management

### Server-Side Rendering

All category data is server-rendered → `src/app/(dashboard)/expenses/categories/page.tsx:10`:

- No client-side state for category list
- Form submission triggers router.refresh() → `src/app/(dashboard)/expenses/categories/category-form.tsx:28`
- Uses Next.js revalidatePath for cache invalidation → `src/app/actions/expense.ts:298`

### Client Form State

Category creation form uses controlled components → `src/app/(dashboard)/expenses/categories/category-form.tsx:11-12`:

- `isLoading` - Loading state during submission
- Form fields are uncontrolled (native FormData)
- Resets form after successful creation → `src/app/(dashboard)/expenses/categories/category-form.tsx:29`

## Dependencies

- **Depends on**:
  - [[auth-login]] - User must be authenticated → `src/app/(dashboard)/expenses/categories/page.tsx:11`
  - [[company-management]] - Company context required for tenant isolation → `src/app/(dashboard)/expenses/categories/page.tsx:12`
  - [[permissions-system]] - Delete requires specific permission → `src/app/actions/expense.ts:311`

- **Depended by**:
  - [[expense-management]] - Categories required for expense creation → `src/app/actions/expense.ts:43-52`
  - [[expense-ai-suggestions]] - Categories used for AI-powered suggestions → `src/lib/ai/categorize.ts:24-26`
  - [[vat-reporting]] - Category VAT defaults affect deductibility calculations → `src/app/(dashboard)/reports/vat/page.tsx:56-57`

## Integrations

None - This is a pure internal data management feature with no external API integrations.

## Verification Checklist

- [x] Authenticated user can access /expenses/categories
- [x] System categories (companyId: null) display as read-only
- [x] Company categories display with usage count
- [x] Seed button appears only when no company categories exist
- [x] Seed creates all 8 default categories with correct VAT defaults
- [x] Category form validates unique code per company
- [x] Category code is automatically uppercased
- [x] VAT deductible checkbox defaults to checked
- [x] Category cannot be deleted if expenses use it
- [x] Delete requires expense_category:delete permission
- [x] Categories appear in expense form dropdown
- [x] Selecting category auto-sets VAT deductible based on default
- [x] AI suggestions match keywords correctly
- [x] Vendor-based suggestions show previous category usage
- [x] All queries are tenant-scoped (companyId isolation)

## Evidence Links

1. `src/app/(dashboard)/expenses/categories/page.tsx:10-94` - Main category management page
2. `src/app/(dashboard)/expenses/categories/category-form.tsx:10-50` - Category creation form
3. `src/app/(dashboard)/expenses/categories/seed-button.tsx:9-30` - Seed button component
4. `src/app/actions/expense.ts:272-305` - createExpenseCategory server action
5. `src/app/actions/expense.ts:344-375` - seedDefaultCategories with 8 defaults
6. `src/app/actions/expense.ts:307-341` - deleteExpenseCategory with constraints
7. `src/app/(dashboard)/expenses/new/page.tsx:23-26` - Category loading for expense form
8. `src/app/(dashboard)/expenses/new/expense-form.tsx:212` - Auto-set VAT deductible from category
9. `src/lib/ai/categorize.ts:5-47` - Keyword-based category suggestions
10. `src/lib/ai/categorize.ts:49-91` - Vendor-based category suggestions
11. `src/app/api/ai/suggest-category/route.ts:9-66` - AI suggestion API endpoint
12. `src/app/(dashboard)/reports/vat/page.tsx:56-61` - VAT deductibility in reporting
13. `prisma/schema.prisma:376-390` - ExpenseCategory database schema
