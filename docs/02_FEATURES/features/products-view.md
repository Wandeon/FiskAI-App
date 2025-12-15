# Feature: View Products (F053)

## Status

- Documentation: Complete
- Last verified: 2025-12-15
- Evidence count: 11

## Purpose

Provides a comprehensive product catalog management system, allowing users to browse, search, filter, and manage products and services. The feature includes a data quality health dashboard, inline editing capabilities, and CSV import functionality, enabling efficient product catalog maintenance for invoicing and e-invoicing operations.

## User Entry Points

| Type       | Path                   | Evidence                                             |
| ---------- | ---------------------- | ---------------------------------------------------- |
| Navigation | `/products`            | `src/lib/navigation.ts:67`                           |
| Detail     | `/products/:id/edit`   | `src/app/(dashboard)/products/[id]/edit/page.tsx:16` |
| Creation   | `/products/new`        | `src/app/(dashboard)/products/new/page.tsx:16`       |
| API Import | `/api/products/import` | `src/app/api/products/import/route.ts:20`            |

## Core Flow

### List View Flow

1. User navigates to `/products` -> `src/app/(dashboard)/products/page.tsx:15`
2. System checks invoicing module capabilities -> `src/app/(dashboard)/products/page.tsx:18-21`
3. Products fetched from database ordered by name -> `src/app/(dashboard)/products/page.tsx:23-26`
4. Unit codes and VAT categories loaded for display -> `src/app/(dashboard)/products/page.tsx:28-33`
5. Products transformed into table format with labels -> `src/app/(dashboard)/products/page.tsx:35-47`
6. Product health metrics calculated (inactive, missing SKU, zero price) -> `src/app/(dashboard)/products/page.tsx:76-80`
7. ProductHealth component displays data quality dashboard -> `src/components/products/product-health.tsx:12-82`
8. CSV import component rendered for bulk uploads -> `src/components/products/product-csv-import.tsx:21-152`
9. ProductTable displays filterable, searchable product list -> `src/components/products/product-table.tsx:38-260`
10. Users can search, filter by VAT category and status -> `src/components/products/product-table.tsx:46-73`
11. Inline editing allows quick price and status updates -> `src/components/products/product-table.tsx:215-233`

### Search and Filter Flow

1. User enters search term in search box -> `src/components/products/product-table.tsx:89-93`
2. Search filters by name, SKU, or description (case-insensitive) -> `src/components/products/product-table.tsx:52-58`
3. User selects VAT categories from multi-select -> `src/components/products/product-table.tsx:96-104`
4. User selects status (Active/Inactive) from multi-select -> `src/components/products/product-table.tsx:106-114`
5. Filters combine to narrow results -> `src/components/products/product-table.tsx:46-73`
6. Result count displays with active product count -> `src/components/products/product-table.tsx:117-123`
7. Clear filters button resets all filters -> `src/components/products/product-table.tsx:78-82`

### Inline Edit Flow

1. User modifies price in table cell input -> `src/components/products/product-table.tsx:162-177`
2. User clicks status badge to toggle active/inactive -> `src/components/products/product-table.tsx:189-209`
3. User clicks check button to save changes -> `src/components/products/product-table.tsx:212-243`
4. System validates and updates product via server action -> `src/app/actions/product.ts:70-110`
5. Success displays green check icon and toast notification -> `src/components/products/product-table.tsx:225-230`
6. Error displays red X icon and error toast -> `src/components/products/product-table.tsx:221-223`
7. Page revalidates to show updated data -> `src/app/actions/product.ts:107`

### Create Product Flow

1. User clicks "Novi proizvod" button -> `src/app/(dashboard)/products/page.tsx:53-55`
2. System routes to `/products/new` -> `src/app/(dashboard)/products/new/page.tsx:16`
3. Form displays with default values (25% VAT, C62 unit, active) -> `src/app/(dashboard)/products/new/page.tsx:28-34`
4. User enters product name (required) and description -> `src/app/(dashboard)/products/new/page.tsx:83-100`
5. User enters SKU and selects unit of measure -> `src/app/(dashboard)/products/new/page.tsx:102-122`
6. User enters price and selects VAT category -> `src/app/(dashboard)/products/new/page.tsx:131-171`
7. VAT rate auto-updates when category changes -> `src/app/(dashboard)/products/new/page.tsx:37-43`
8. User toggles active status checkbox -> `src/app/(dashboard)/products/new/page.tsx:176-189`
9. Form validates and submits to server action -> `src/app/actions/product.ts:20-36`
10. Redirect to product list on success -> `src/app/(dashboard)/products/new/page.tsx:64`

### Edit Product Flow

1. User clicks "Uredi" button on product row -> `src/components/products/product-table.tsx:244-248`
2. System routes to `/products/:id/edit` -> `src/app/(dashboard)/products/[id]/edit/page.tsx:10`
3. Product fetched with tenant isolation check -> `src/app/(dashboard)/products/[id]/edit/page.tsx:15-24`
4. EditProductForm renders with current values -> `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:21-206`
5. User modifies fields with same validation as create -> `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:76-194`
6. Form submits to updateProduct server action -> `src/app/actions/product.ts:39-68`
7. Redirect to product list on success -> `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:72`

### Delete Product Flow

1. User clicks "Obriši" button on product row -> `src/components/products/product-table.tsx:249`
2. Confirmation dialog displays product name -> `src/app/(dashboard)/products/delete-button.tsx:46-56`
3. User confirms deletion -> `src/app/(dashboard)/products/delete-button.tsx:20-33`
4. System deletes product via server action -> `src/app/actions/product.ts:112-131`
5. Success toast displays and page refreshes -> `src/app/(dashboard)/products/delete-button.tsx:30-32`

### CSV Import Flow

1. User clicks "Odaberi CSV" in import component -> `src/components/products/product-csv-import.tsx:105-116`
2. System parses CSV with required 'name' column -> `src/components/products/product-csv-import.tsx:27-57`
3. Optional columns: sku, unit, price, vatRate -> `src/components/products/product-csv-import.tsx:41-51`
4. Parsed rows validated and row count displayed -> `src/components/products/product-csv-import.tsx:52-56`
5. System sends POST request to import API -> `src/components/products/product-csv-import.tsx:74-92`
6. API validates with max 500 rows limit -> `src/app/api/products/import/route.ts:16-38`
7. Products created in transaction for atomicity -> `src/app/api/products/import/route.ts:45-61`
8. Success toast shows created count -> `src/components/products/product-csv-import.tsx:86`

## Key Modules

| Module              | Purpose                                      | Location                                               |
| ------------------- | -------------------------------------------- | ------------------------------------------------------ |
| ProductsPage        | Main product list page with health dashboard | `src/app/(dashboard)/products/page.tsx`                |
| ProductTable        | Filterable table with inline editing         | `src/components/products/product-table.tsx`            |
| ProductHealth       | Data quality metrics dashboard               | `src/components/products/product-health.tsx`           |
| ProductCsvImport    | CSV import component with preview            | `src/components/products/product-csv-import.tsx`       |
| NewProductPage      | Product creation form                        | `src/app/(dashboard)/products/new/page.tsx`            |
| EditProductPage     | Product editing page wrapper                 | `src/app/(dashboard)/products/[id]/edit/page.tsx`      |
| EditProductForm     | Product editing form component               | `src/app/(dashboard)/products/[id]/edit/edit-form.tsx` |
| DeleteProductButton | Delete confirmation dialog                   | `src/app/(dashboard)/products/delete-button.tsx`       |
| ProductActions      | Server actions for CRUD operations           | `src/app/actions/product.ts`                           |
| ProductPicker       | Product selection combobox for invoices      | `src/components/invoice/product-picker.tsx`            |
| ImportAPI           | CSV import API endpoint                      | `src/app/api/products/import/route.ts`                 |

## Data

### Database Tables

#### Product Table

Primary product storage table -> `prisma/schema.prisma:173-189`

Key fields:

- `id` (String, CUID): Unique identifier
- `companyId` (String): Tenant isolation -> `prisma/schema.prisma:175`
- `name` (String): Product or service name -> `prisma/schema.prisma:176`
- `description` (String?): Optional description -> `prisma/schema.prisma:177`
- `sku` (String?): Stock keeping unit/product code -> `prisma/schema.prisma:178`
- `unit` (String): UN/ECE unit code, default C62 (piece) -> `prisma/schema.prisma:179`
- `price` (Decimal): Unit price in EUR -> `prisma/schema.prisma:180`
- `vatRate` (Decimal): VAT percentage, default 25% -> `prisma/schema.prisma:181`
- `vatCategory` (String): EN 16931 VAT category (S/AA/E/Z/O), default S -> `prisma/schema.prisma:182`
- `isActive` (Boolean): Whether product appears in pickers, default true -> `prisma/schema.prisma:183`
- `createdAt` (DateTime): Creation timestamp -> `prisma/schema.prisma:184`
- `updatedAt` (DateTime): Last update timestamp -> `prisma/schema.prisma:185`

Relations:

- `company` (Company): Owner company -> `prisma/schema.prisma:186`

Indexes:

- `companyId`: Tenant filtering -> `prisma/schema.prisma:188`

### Validation Schema

Product validation using Zod -> `src/lib/validations/product.ts:3-12`

```typescript
const productSchema = z.object({
  name: z.string().min(2, "Naziv mora imati najmanje 2 znaka"),
  description: z.string().optional(),
  sku: z.string().optional(),
  unit: z.string().default("C62"),
  price: z.coerce.number().min(0, "Cijena mora biti pozitivna"),
  vatRate: z.coerce.number().min(0).max(100).default(25),
  vatCategory: z.enum(["S", "AA", "E", "Z", "O"]).default("S"),
  isActive: z.boolean().default(true),
})
```

### Unit Codes

UN/ECE Recommendation 20 standard units -> `src/lib/validations/product.ts:17-28`

- C62: Komad (piece) - default
- KGM: Kilogram
- LTR: Litra (liter)
- MTR: Metar (meter)
- MTK: Kvadratni metar (square meter)
- HUR: Sat (hour)
- DAY: Dan (day)
- MON: Mjesec (month)
- SET: Set
- PCE: Komad (piece alternative)

### VAT Categories

EN 16931 compliant VAT categories -> `src/lib/validations/product.ts:31-37`

- S: Standardna stopa (Standard rate - 25%)
- AA: Snižena stopa (Reduced rate - 13%)
- E: Oslobođeno PDV-a (Exempt from VAT - 0%)
- Z: Nulta stopa (Zero rated - 0%)
- O: Izvan oporezivanja (Outside scope of tax - 0%)

### Query Patterns

#### List All Products

Fetches all company products sorted alphabetically -> `src/app/(dashboard)/products/page.tsx:23-26`

```typescript
const products = await db.product.findMany({
  where: { companyId: company.id },
  orderBy: { name: "asc" },
})
```

#### Get Active Products

Fetches only active products for invoice creation -> `src/app/actions/product.ts:133-143`

```typescript
return db.product.findMany({
  where: {
    ...(activeOnly && { isActive: true }),
  },
  orderBy: { name: "asc" },
})
```

#### Search Products

Case-insensitive search by name, SKU, or description -> `src/app/actions/product.ts:146-163`

```typescript
return db.product.findMany({
  where: {
    isActive: true,
    OR: [
      { name: { contains: query, mode: "insensitive" } },
      { sku: { contains: query, mode: "insensitive" } },
      { description: { contains: query, mode: "insensitive" } },
    ],
  },
  take: 10,
  orderBy: { name: "asc" },
})
```

## Dependencies

### Depends On

- **Authentication System**: User and company context -> `src/lib/auth-utils.ts:requireAuth, requireCompany`
- **Tenant Context**: Multi-tenant data isolation via Prisma extensions -> Automatic via `requireCompanyWithContext`
- **Capability System**: Module access control -> `src/lib/capabilities.ts:deriveCapabilities`
- **Form Validation**: Zod schema validation -> `src/lib/validations/product.ts`

### Depended By

- **Invoice Creation**: Product picker for line items -> `src/components/invoice/product-picker.tsx`
- **E-Invoice Creation**: Product selection for e-invoicing -> Used via product picker
- **Offer Creation**: Product catalog for quotes and proposals
- **Pricing Calculations**: VAT rates and pricing for financial documents

## Integrations

### Internal Integrations

#### Navigation System

Sidebar navigation under "Podaci" section -> `src/lib/navigation.ts:64-68`

```typescript
{
  title: "Podaci",
  items: [
    { name: "Kontakti", href: "/contacts", icon: Users },
    { name: "Proizvodi", href: "/products", icon: Package },
  ],
}
```

#### Invoice Line Items

Products selected via ProductPicker component -> `src/components/invoice/product-picker.tsx:11-36`

- Displays product name and SKU in combobox
- Pre-fills line item with product details
- Includes price, unit, and VAT information
- Only shows active products

#### Data Quality Dashboard

ProductHealth component tracks catalog health -> `src/components/products/product-health.tsx:12-82`

Metrics tracked:

- Products without SKU (Bez šifre)
- Products with zero price (Cijena = 0)
- Inactive products (Neaktivni)
- Total product count (Ukupno stavki)

#### CSV Import

ProductCsvImport enables bulk product creation -> `src/components/products/product-csv-import.tsx:21-152`

Features:

- Client-side CSV parsing
- Example CSV download
- Batch import up to 500 products
- Transactional creation (all-or-nothing)
- Real-time validation feedback

### External Integrations

None currently. Products are an internal catalog feature without external API integrations.

## Verification Checklist

### List View

- [ ] User can access products via `/products` navigation
- [ ] Non-invoicing companies redirect to settings/plan page
- [ ] Empty state displays when no products exist
- [ ] Product health dashboard shows correct metrics (inactive, missing SKU, zero price)
- [ ] Total product count displays accurately
- [ ] Active product count shows in metrics bar
- [ ] Search filters by name, SKU, and description (case-insensitive)
- [ ] VAT category filter displays all 5 categories (S, AA, E, Z, O)
- [ ] Status filter allows Active/Inactive selection
- [ ] Combined filters work correctly (search + VAT + status)
- [ ] Clear filters button resets all filters
- [ ] Result count updates dynamically with filters

### Table Display

- [ ] Products display in alphabetical order by name
- [ ] Name and description columns show correctly
- [ ] SKU displays or shows "—" when empty
- [ ] Price displays in right-aligned EUR format
- [ ] Unit displays label (Komad) and code (C62)
- [ ] VAT rate displays as percentage with category name
- [ ] Status badge shows "Aktivan" (green) or "Neaktivan" (gray)
- [ ] Rows alternate background color for readability
- [ ] Empty filter results show helpful message

### Inline Editing

- [ ] Price input allows decimal values
- [ ] Status badge toggles between active/inactive on click
- [ ] Check button shows during unsaved changes
- [ ] Loading spinner displays during save
- [ ] Success shows green check icon
- [ ] Error shows red X icon with toast
- [ ] Changes persist after save
- [ ] Page revalidates to reflect updates

### Create Product

- [ ] "Novi proizvod" button routes to creation form
- [ ] Name field is required with 2+ characters
- [ ] Description is optional textarea
- [ ] SKU is optional text field
- [ ] Unit selector shows all 10 unit codes with labels
- [ ] Default unit is C62 (Komad)
- [ ] Price is required, must be positive
- [ ] VAT category selector shows all 5 categories
- [ ] VAT rate auto-updates when category changes
- [ ] Default VAT is 25% (Standard - S)
- [ ] Active checkbox defaults to checked
- [ ] Validation errors display per field
- [ ] Success redirects to product list
- [ ] Cancel button navigates back

### Edit Product

- [ ] "Uredi" button routes to edit form
- [ ] Form pre-fills with current product data
- [ ] All validations match create form
- [ ] 404 displays for non-existent product ID
- [ ] Tenant isolation prevents cross-company editing
- [ ] Changes save correctly
- [ ] Success redirects to product list

### Delete Product

- [ ] "Obriši" button opens confirmation dialog
- [ ] Dialog displays product name
- [ ] Cancel closes dialog without action
- [ ] Confirm deletes product and shows toast
- [ ] Deleted product removed from list immediately
- [ ] Page refreshes to reflect deletion
- [ ] Cannot delete another company's product

### CSV Import

- [ ] File input accepts .csv files
- [ ] Example CSV download button works
- [ ] CSV requires 'name' column
- [ ] Optional columns: sku, unit, price, vatRate
- [ ] Row count displays after successful parse
- [ ] Error message shows for invalid CSV
- [ ] Import limited to 500 rows maximum
- [ ] Success toast shows count of created products
- [ ] Transaction ensures all-or-nothing import
- [ ] Page revalidates after import

### Data Integrity

- [ ] All queries filter by companyId (tenant isolation)
- [ ] Products belong to correct company
- [ ] Unit codes match UN/ECE Recommendation 20
- [ ] VAT categories comply with EN 16931 standard
- [ ] VAT rates align with category (S=25%, AA=13%, etc.)
- [ ] Price stored as Decimal(10,2) for accuracy
- [ ] Inactive products excluded from invoice pickers
- [ ] Timestamps (createdAt, updatedAt) track correctly

## Evidence Links

1. `src/app/(dashboard)/products/page.tsx:15-87` - Main products list page with health dashboard
2. `src/components/products/product-table.tsx:38-260` - Filterable table with inline editing
3. `src/components/products/product-health.tsx:12-82` - Data quality metrics dashboard
4. `src/components/products/product-csv-import.tsx:21-152` - CSV import with validation
5. `src/app/actions/product.ts:20-163` - Server actions for CRUD operations and search
6. `src/app/(dashboard)/products/new/page.tsx:16-202` - Product creation form
7. `src/app/(dashboard)/products/[id]/edit/page.tsx:10-32` - Product edit page wrapper
8. `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:21-206` - Product edit form
9. `src/app/(dashboard)/products/delete-button.tsx:15-59` - Delete confirmation dialog
10. `src/app/api/products/import/route.ts:20-69` - CSV import API endpoint
11. `prisma/schema.prisma:173-189` - Product table schema definition
