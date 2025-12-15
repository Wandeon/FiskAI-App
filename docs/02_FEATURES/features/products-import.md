# Feature: Product CSV Import (F055)

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 15

## Purpose

The Product CSV Import feature enables users to bulk import products and services from CSV files with client-side parsing, preview, validation, and automatic server-side creation. The feature includes a downloadable sample CSV template, inline row validation, toast notifications, and cache revalidation, allowing users to quickly populate their product catalog without manual entry.

## User Entry Points

| Type      | Path                 | Evidence                                            |
| --------- | -------------------- | --------------------------------------------------- |
| Component | ProductCsvImport     | `src/components/products/product-csv-import.tsx:21` |
| Page      | /products            | `src/app/(dashboard)/products/page.tsx:15`          |
| API       | /api/products/import | `src/app/api/products/import/route.ts:20`           |

## Core Flow

### CSV Import Flow

1. User navigates to /products page → `src/app/(dashboard)/products/page.tsx:15`
2. System validates user authentication with requireAuth() → `src/app/(dashboard)/products/page.tsx:16`
3. System retrieves current company via requireCompany() → `src/app/(dashboard)/products/page.tsx:17`
4. System checks module capabilities for invoicing → `src/app/(dashboard)/products/page.tsx:18-21`
5. System fetches existing products ordered by name → `src/app/(dashboard)/products/page.tsx:23-26`
6. System renders ProductCsvImport component → `src/app/(dashboard)/products/page.tsx:81`
7. User clicks "Preuzmi primjer" to download sample CSV → `src/components/products/product-csv-import.tsx:117-132`
8. User selects CSV file via file input → `src/components/products/product-csv-import.tsx:108-112`
9. System reads file as text using FileReader → `src/components/products/product-csv-import.tsx:28`
10. System parses CSV with comma-separated values → `src/components/products/product-csv-import.tsx:29-34`
11. System validates required "name" column exists → `src/components/products/product-csv-import.tsx:35-39`
12. System maps CSV columns to product fields → `src/components/products/product-csv-import.tsx:41-51`
13. System displays success toast with row count → `src/components/products/product-csv-import.tsx:55`
14. System automatically calls import API → `src/components/products/product-csv-import.tsx:66`
15. API validates user and company → `src/app/api/products/import/route.ts:22-32`
16. API validates rows with Zod schema (max 500 rows) → `src/app/api/products/import/route.ts:35-38`
17. API filters empty rows → `src/app/api/products/import/route.ts:40-43`
18. API creates products in transaction → `src/app/api/products/import/route.ts:45-61`
19. API revalidates /products path → `src/app/api/products/import/route.ts:63`
20. System displays success message with created count → `src/components/products/product-csv-import.tsx:86`

## Key Modules

| Module           | Purpose                                 | Location                                         |
| ---------------- | --------------------------------------- | ------------------------------------------------ |
| ProductCsvImport | Client component for CSV upload & parse | `src/components/products/product-csv-import.tsx` |
| ProductsPage     | Server page rendering products list     | `src/app/(dashboard)/products/page.tsx`          |
| importRoute      | API endpoint for bulk product creation  | `src/app/api/products/import/route.ts:20-69`     |
| ProductTable     | Table displaying products with filters  | `src/components/products/product-table.tsx`      |
| ProductHealth    | Product catalog health metrics          | `src/components/products/product-health.tsx`     |

## CSV Format

### Required Columns

- **name** → `src/components/products/product-csv-import.tsx:35-39`
  - Product or service name
  - Minimum 2 characters
  - Cannot be empty

### Optional Columns

- **sku** → `src/components/products/product-csv-import.tsx:46`
  - Stock Keeping Unit / Product code
  - String value, no validation
  - Default: null

- **unit** → `src/components/products/product-csv-import.tsx:47`
  - UN/ECE unit code (C62, KGM, LTR, etc.)
  - Default: "kom" (C62) → `src/app/api/products/import/route.ts:52`

- **price** → `src/components/products/product-csv-import.tsx:48`
  - Decimal price value
  - Default: 0 → `src/app/api/products/import/route.ts:53`

- **vatRate** → `src/components/products/product-csv-import.tsx:49`
  - VAT percentage (0-100)
  - Default: 25 → `src/app/api/products/import/route.ts:54`

- **vatCategory** → `src/app/api/products/import/route.ts:55`
  - EN 16931 category code (S, AA, E, Z, O)
  - Default: "S" (Standard 25%)

### Sample CSV

```csv
name,sku,unit,price,vatRate
Usluga konsaltinga,CONS-001,h,80,25
Licenca softvera,LIC-2025,kom,250,25
```

Generated via download button → `src/components/products/product-csv-import.tsx:121-128`

## Field Mapping

### Client-Side Mapping

- **CSV Parsing** → `src/components/products/product-csv-import.tsx:27-57`
  - Splits lines by `\r?\n` (cross-platform line breaks)
  - Header row normalized to lowercase
  - Column access via indexOf lookup
  - Number fields coerced with Number()
  - Empty values mapped to undefined

### Server-Side Mapping

- **Product Creation** → `src/app/api/products/import/route.ts:47-58`
  - companyId: From authenticated company context
  - name: Direct from CSV (required)
  - sku: CSV value or null
  - unit: CSV value or default "kom"
  - price: CSV value or default 0
  - vatRate: CSV value or default 25
  - vatCategory: CSV value or default "S"
  - description: Always null (not supported in import)
  - isActive: Always true (new products active by default)

## Validation

### Client-Side Validation

1. **File Type Validation** → `src/components/products/product-csv-import.tsx:110`
   - Accept attribute: `.csv,text/csv`
   - Browser native validation

2. **CSV Structure Validation** → `src/components/products/product-csv-import.tsx:30-39`
   - File must not be empty
   - Must have at least one header row
   - Required column "name" must exist
   - Error displayed inline if validation fails

3. **Row Parsing** → `src/components/products/product-csv-import.tsx:41-51`
   - All rows after header parsed (no max limit client-side)
   - Number fields coerced without validation
   - Missing optional fields default to undefined

### Server-Side Validation

1. **Authentication** → `src/app/api/products/import/route.ts:22-32`
   - User must be authenticated
   - Company must exist
   - 401 if no user, 404 if no company

2. **Request Body Validation** → `src/app/api/products/import/route.ts:34-38`
   - Zod schema validation via importSchema
   - Maximum 500 rows enforced → `src/app/api/products/import/route.ts:17`
   - 400 error if validation fails

3. **Row Schema Validation** → `src/app/api/products/import/route.ts:7-14`
   - name: string, minimum 1 character (required)
   - sku: string, optional
   - unit: string, optional
   - price: number, optional
   - vatRate: number, optional
   - vatCategory: string, optional

4. **Empty Row Filtering** → `src/app/api/products/import/route.ts:40-43`
   - Filters rows where name is empty after trimming
   - Returns 400 if all rows empty ("Prazan CSV")

5. **Product Schema Validation** → `src/lib/validations/product.ts:3-12`
   - name: min 2 characters
   - price: min 0 (non-negative)
   - vatRate: 0-100 range
   - vatCategory: enum ["S", "AA", "E", "Z", "O"]
   - Applied implicitly via default values

## Duplicate Handling

**No duplicate detection** → Product model has no unique constraints on name or SKU → `prisma/schema.prisma:173-189`

- Multiple products with same name: **Allowed**
- Multiple products with same SKU: **Allowed**
- Duplicate rows in CSV: **All created**
- Re-importing same CSV: **Creates duplicate products**

**Rationale**: Products may have variations (sizes, colors, packages) with similar names. SKU is optional and not enforced as unique in the schema.

## Database Operations

### Transaction Creation

- **Bulk Insert** → `src/app/api/products/import/route.ts:45-61`
  - Uses `db.$transaction()` with array of create promises
  - All-or-nothing: Either all products created or none
  - Rollback on any single product failure
  - Prisma automatically handles tenant isolation via companyId

### Tenant Isolation

- **Company Scope** → `src/app/api/products/import/route.ts:49`
  - All products linked to authenticated company
  - companyId set from getCurrentCompany()
  - Product model has cascading delete on Company → `prisma/schema.prisma:186`
  - Company filter applied via Prisma extension → `src/lib/db.ts:13`

## Error Handling

### Client Errors

1. **Empty File** → `src/components/products/product-csv-import.tsx:30-33`
   - Message: "Prazna datoteka"
   - Displayed inline with AlertCircle icon

2. **Missing Required Column** → `src/components/products/product-csv-import.tsx:36-39`
   - Message: "CSV mora imati stupac 'name'"
   - Displayed inline with AlertCircle icon

3. **File Read Error** → `src/components/products/product-csv-import.tsx:68-71`
   - Message: "Greška pri čitanju CSV-a"
   - Toast notification displayed
   - Console error logged

4. **Import API Error** → `src/components/products/product-csv-import.tsx:83-90`
   - Message: "Uvoz nije uspio"
   - Toast notification displayed
   - Console error logged

### Server Errors

1. **Authentication Failure** → `src/app/api/products/import/route.ts:24-26`
   - Status: 401 Unauthorized
   - Response: `{ error: "Unauthorized" }`

2. **Company Not Found** → `src/app/api/products/import/route.ts:30-32`
   - Status: 404 Not Found
   - Response: `{ error: "No company found" }`

3. **Validation Failure** → `src/app/api/products/import/route.ts:36-38`
   - Status: 400 Bad Request
   - Response: `{ error: "Neispravni podaci" }`

4. **Empty CSV** → `src/app/api/products/import/route.ts:41-43`
   - Status: 400 Bad Request
   - Response: `{ error: "Prazan CSV" }`

5. **Database Error** → `src/app/api/products/import/route.ts:65-68`
   - Status: 500 Internal Server Error
   - Response: `{ error: "Greška pri uvozu" }`
   - Error logged to console

## User Feedback

### Success States

1. **CSV Parsed** → `src/components/products/product-csv-import.tsx:55`
   - Toast: "CSV učitan" with row count
   - Message: `${rows.length} stavki spremno za uvoz`
   - CheckCircle2 icon displayed in component

2. **Products Created** → `src/components/products/product-csv-import.tsx:86`
   - Toast: "Uspješno"
   - Message: `${json.created} proizvoda kreirano`
   - Green success notification

3. **Row Count Display** → `src/components/products/product-csv-import.tsx:144`
   - Message: `${rowCount} redaka učitano`
   - Green text with CheckCircle2 icon

### Error States

1. **Inline Error** → `src/components/products/product-csv-import.tsx:136-140`
   - Red text with AlertCircle icon
   - Error message displayed below file input
   - Prevents import submission

2. **Toast Notification** → `src/components/products/product-csv-import.tsx:70, 89`
   - Red error toast with "Greška" title
   - Specific error message
   - Auto-dismissible

### Loading States

1. **Import in Progress** → `src/components/products/product-csv-import.tsx:25, 115`
   - Button text: "U tijeku..."
   - Button disabled during transition
   - Uses React useTransition hook

## UI Components

### ProductCsvImport Component

- **Location** → `src/components/products/product-csv-import.tsx:21-152`
- **Appearance** → `src/components/products/product-csv-import.tsx:95`
  - Rounded border with dashed style
  - Brand-colored upload icon
  - Secondary surface background
  - Responsive padding

- **File Input** → `src/components/products/product-csv-import.tsx:105-116`
  - Hidden native input
  - Custom label with FileText icon
  - Styled as rounded button
  - Accept: `.csv,text/csv`

- **Sample Download Button** → `src/components/products/product-csv-import.tsx:117-132`
  - Variant: outline
  - Creates blob from example CSV
  - Downloads as "primjer-proizvodi.csv"
  - In-memory file generation

- **Status Display** → `src/components/products/product-csv-import.tsx:135-147`
  - Shows error OR success/pending state
  - Color-coded text (red/green/gray)
  - Icon prefix (AlertCircle/CheckCircle2)
  - File name or row count displayed

## Cache Management

### Revalidation

- **After Import** → `src/app/api/products/import/route.ts:63`
  - Calls `revalidatePath("/products")`
  - Invalidates Next.js cache for products page
  - Fresh data fetched on next page load
  - No manual refresh needed

- **Also Revalidated By** → `src/app/actions/product.ts`
  - createProduct() → line 34
  - updateProduct() → line 65
  - updateProductInline() → line 107
  - deleteProduct() → line 128

## Dependencies

- **Depends on**:
  - [[auth-login]] - User authentication required → `src/app/api/products/import/route.ts:22`
  - [[company-management]] - Company must exist → `src/app/api/products/import/route.ts:28`
  - [[module-capabilities]] - Invoicing module must be enabled → `src/app/(dashboard)/products/page.tsx:19`

- **Depended by**:
  - [[invoicing-create]] - Products used as line items in invoices
  - [[products-view]] - Import displayed on products list page → `src/app/(dashboard)/products/page.tsx:81`
  - [[products-edit]] - Imported products can be edited individually

## Integrations

### Zod Validation

- **Library**: zod (npm package)
- **Schemas** → `src/app/api/products/import/route.ts:7-18`
  - rowSchema: Validates individual CSV rows
  - importSchema: Validates request body with max 500 rows
- **Product Schema** → `src/lib/validations/product.ts:3-12`
  - Used for manual product creation
  - Defines field types and constraints

### Prisma ORM

- **Transaction** → `src/app/api/products/import/route.ts:45-61`
  - Batch create with rollback on failure
  - Automatic tenant isolation via extension → `src/lib/prisma-extensions.ts`
  - Connection pooling via pg adapter → `src/lib/db.ts:11-12`

### Next.js Cache

- **revalidatePath** → `src/app/api/products/import/route.ts:63`
  - Server-side cache invalidation
  - Ensures fresh data after import
  - Path: "/products"

## Verification Checklist

- [ ] User can access /products page with authentication
- [ ] CSV import component visible on products page
- [ ] Sample CSV download button works
- [ ] Downloaded sample has correct headers and format
- [ ] File input accepts .csv files
- [ ] Client parses CSV with comma separators
- [ ] Required "name" column validation works
- [ ] Optional columns (sku, unit, price, vatRate) parsed
- [ ] Success toast displays row count after parse
- [ ] API validates max 500 rows
- [ ] API creates products in transaction
- [ ] Empty rows filtered before creation
- [ ] All products linked to current company
- [ ] Default values applied (unit=kom, price=0, vatRate=25)
- [ ] Duplicate products allowed (no SKU uniqueness)
- [ ] Error toast displayed on import failure
- [ ] Products page revalidated after import
- [ ] Success toast shows created count
- [ ] Imported products visible in ProductTable
- [ ] Module capability check enforced

## Evidence Links

1. ProductCsvImport component → `src/components/products/product-csv-import.tsx:21`
2. Products page entry point → `src/app/(dashboard)/products/page.tsx:15`
3. Import API route → `src/app/api/products/import/route.ts:20`
4. Row schema validation → `src/app/api/products/import/route.ts:7`
5. Import schema with max 500 → `src/app/api/products/import/route.ts:16`
6. CSV parsing logic → `src/components/products/product-csv-import.tsx:27`
7. Field mapping → `src/components/products/product-csv-import.tsx:41`
8. Transaction creation → `src/app/api/products/import/route.ts:45`
9. Default values applied → `src/app/api/products/import/route.ts:52`
10. Empty row filtering → `src/app/api/products/import/route.ts:40`
11. Success toast → `src/components/products/product-csv-import.tsx:86`
12. Error handling → `src/components/products/product-csv-import.tsx:88`
13. Cache revalidation → `src/app/api/products/import/route.ts:63`
14. Product schema definition → `prisma/schema.prisma:173`
15. Product validation schema → `src/lib/validations/product.ts:3`
