# Feature: Create Product (F052)

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 35

## Purpose

The Create Product feature enables users to define products and services with standardized units, VAT categories, and pricing that can be used in invoicing workflows. The feature includes UN/ECE compliant unit codes (C62, KGM, LTR, etc.), EN 16931 VAT categories (S, AA, E, Z, O), automatic VAT rate assignment based on category selection, inline price editing, and CSV bulk import capabilities, forming the foundation of the product catalog system in FiskAI.

## User Entry Points

| Type   | Path          | Evidence                                       |
| ------ | ------------- | ---------------------------------------------- |
| Page   | /products/new | `src/app/(dashboard)/products/new/page.tsx:16` |
| Action | createProduct | `src/app/actions/product.ts:20`                |
| Button | Novi proizvod | `src/app/(dashboard)/products/page.tsx:54`     |
| API    | CSV Import    | `src/app/api/products/import/route.ts:20`      |

## Core Flow

1. User navigates to /products/new → `src/app/(dashboard)/products/new/page.tsx:16`
2. System renders client-side form with react-hook-form → `src/app/(dashboard)/products/new/page.tsx:21-34`
3. System sets default values (unit: C62, vatRate: 25, vatCategory: S, isActive: true) → `src/app/(dashboard)/products/new/page.tsx:28-33`
4. User enters product name (required, min 2 characters) → `src/lib/validations/product.ts:4`
5. User optionally enters description, SKU, and unit selection → `src/app/(dashboard)/products/new/page.tsx:92-122`
6. User selects VAT category from dropdown (S, AA, E, Z, O) → `src/app/(dashboard)/products/new/page.tsx:143-158`
7. System automatically sets VAT rate based on category selection → `src/app/(dashboard)/products/new/page.tsx:37-43`
8. User enters price in EUR (required, min 0, step 0.01) → `src/app/(dashboard)/products/new/page.tsx:131-141`
9. User can toggle isActive checkbox (defaults to true) → `src/app/(dashboard)/products/new/page.tsx:177-188`
10. Form validates via Zod schema → `src/lib/validations/product.ts:3-12`
11. User submits form, triggering client-side validation → `src/app/(dashboard)/products/new/page.tsx:45-65`
12. System calls createProduct server action → `src/app/actions/product.ts:20-36`
13. System validates authentication and company context → `src/app/actions/product.ts:21-23`
14. System validates form data with Zod schema → `src/app/actions/product.ts:24-28`
15. System creates Product with tenant-isolated companyId → `src/app/actions/product.ts:30-32`
16. System revalidates /products route cache → `src/app/actions/product.ts:34`
17. User redirected to /products with success state → `src/app/(dashboard)/products/new/page.tsx:64`

## Key Modules

| Module              | Purpose                                       | Location                                                  |
| ------------------- | --------------------------------------------- | --------------------------------------------------------- |
| NewProductPage      | Client form component for product creation    | `src/app/(dashboard)/products/new/page.tsx`               |
| createProduct       | Server action for product creation            | `src/app/actions/product.ts:20-36`                        |
| updateProduct       | Server action for full product update         | `src/app/actions/product.ts:39-67`                        |
| updateProductInline | Server action for inline price/status updates | `src/app/actions/product.ts:70-109`                       |
| deleteProduct       | Server action for product deletion            | `src/app/actions/product.ts:112-130`                      |
| productSchema       | Zod validation schema for products            | `src/lib/validations/product.ts:3-12`                     |
| ProductTable        | Client table with inline editing              | `src/components/products/product-table.tsx:38`            |
| ProductCsvImport    | CSV import component                          | `src/components/products/product-csv-import.tsx:21`       |
| ProductHealth       | Catalog health dashboard widget               | `src/components/products/product-health.tsx:12`           |
| ProductsPage        | Server component listing products             | `src/app/(dashboard)/products/page.tsx:15`                |
| EditProductForm     | Client form for editing existing products     | `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:21` |

## Product Form Features

### Basic Information Fields

- **Product Name** → `src/app/(dashboard)/products/new/page.tsx:84-89`
  - Required field with min 2 characters → `src/lib/validations/product.ts:4`
  - Input placeholder: "Naziv proizvoda ili usluge" → `src/app/(dashboard)/products/new/page.tsx:87`
  - Zod validation error displayed inline → `src/app/(dashboard)/products/new/page.tsx:88`

- **Description** → `src/app/(dashboard)/products/new/page.tsx:92-100`
  - Optional textarea field (3 rows) → `src/app/(dashboard)/products/new/page.tsx:96`
  - Stored as nullable string → `src/lib/validations/product.ts:5`
  - Placeholder: "Kratki opis proizvoda ili usluge" → `src/app/(dashboard)/products/new/page.tsx:98`

- **SKU (Stock Keeping Unit)** → `src/app/(dashboard)/products/new/page.tsx:102-108`
  - Optional text field → `src/lib/validations/product.ts:6`
  - Used for inventory tracking and search → `src/app/actions/product.ts:155`
  - Placeholder: "ABC-123" → `src/app/(dashboard)/products/new/page.tsx:106`

- **Unit of Measure** → `src/app/(dashboard)/products/new/page.tsx:110-122`
  - Dropdown with UN/ECE Recommendation 20 codes → `src/lib/validations/product.ts:16-28`
  - Default: "C62" (Komad/Piece) → `src/lib/validations/product.ts:7`
  - Options include: C62 (Komad), KGM (Kilogram), LTR (Litra), MTR (Metar), MTK (Kvadratni metar), HUR (Sat), DAY (Dan), MON (Mjesec), SET (Set), PCE (Komad) → `src/lib/validations/product.ts:17-27`
  - Displayed as "Name (Code)" format → `src/app/(dashboard)/products/new/page.tsx:118`

### Price and VAT Configuration

- **Price (EUR)** → `src/app/(dashboard)/products/new/page.tsx:131-141`
  - Required number field → `src/lib/validations/product.ts:8`
  - Min value: 0, Step: 0.01 → `src/app/(dashboard)/products/new/page.tsx:135-136`
  - Stored as Decimal(10,2) for precision → `prisma/schema.prisma:180`
  - Coerced to number via Zod → `src/lib/validations/product.ts:8`
  - Placeholder: "0.00" → `src/app/(dashboard)/products/new/page.tsx:138`

- **VAT Category** → `src/app/(dashboard)/products/new/page.tsx:143-158`
  - Dropdown with EN 16931 compliant categories → `src/lib/validations/product.ts:30-37`
  - Options:
    - S: Standardna stopa (25%) → `src/lib/validations/product.ts:32`
    - AA: Snižena stopa (13%) → `src/lib/validations/product.ts:33`
    - E: Oslobođeno PDV-a (0%) → `src/lib/validations/product.ts:34`
    - Z: Nulta stopa (0%) → `src/lib/validations/product.ts:35`
    - O: Izvan oporezivanja (0%) → `src/lib/validations/product.ts:36`
  - Default: "S" (Standard 25%) → `src/lib/validations/product.ts:10`
  - Auto-sets VAT rate on change → `src/app/(dashboard)/products/new/page.tsx:37-43`

- **VAT Rate** → `src/app/(dashboard)/products/new/page.tsx:161-171`
  - Number field with min 0, max 100, step 0.01 → `src/app/(dashboard)/products/new/page.tsx:165-167`
  - Default: 25% → `src/lib/validations/product.ts:9`
  - Stored as Decimal(5,2) → `prisma/schema.prisma:181`
  - Automatically updated when VAT category changes → `src/app/(dashboard)/products/new/page.tsx:41`
  - Can be manually overridden for edge cases → `src/app/(dashboard)/products/new/page.tsx:163-170`

### Active Status

- **isActive Checkbox** → `src/app/(dashboard)/products/new/page.tsx:175-189`
  - Boolean field, defaults to true → `src/lib/validations/product.ts:11`
  - Label: "Aktivan proizvod" → `src/app/(dashboard)/products/new/page.tsx:183`
  - Help text: "Neaktivni proizvodi neće se prikazivati prilikom kreiranja računa" → `src/app/(dashboard)/products/new/page.tsx:186`
  - Controls visibility in invoice product selectors → `src/app/(dashboard)/e-invoices/new/page.tsx:21`

## Server-Side Processing

### Authentication & Tenant Isolation

- **Multi-Layer Security** → `src/app/actions/product.ts:21-23`
  - requireAuth() validates session → `src/lib/auth-utils.ts:12-18`
  - requireCompanyWithContext() enforces tenant scope → `src/lib/auth-utils.ts:75-89`
  - runWithTenant() wraps database operations → `src/lib/auth-utils.ts:86-88`
  - All queries auto-filtered by companyId → `src/lib/prisma-extensions.ts:55`

### Validation

- **Zod Schema Validation** → `src/app/actions/product.ts:24-28`
  - Validates name (min 2 chars) → `src/lib/validations/product.ts:4`
  - Validates price (min 0) → `src/lib/validations/product.ts:8`
  - Validates vatRate (0-100) → `src/lib/validations/product.ts:9`
  - Validates vatCategory enum (S, AA, E, Z, O) → `src/lib/validations/product.ts:10`
  - Returns structured error messages → `src/app/actions/product.ts:27`

### Database Transaction

- **Product Creation** → `src/app/actions/product.ts:30-32`
  - Creates Product record → `src/app/actions/product.ts:30`
  - Auto-adds companyId via tenant middleware → `src/lib/prisma-extensions.ts:52-76`
  - Returns success with product data → `src/app/actions/product.ts:35`
  - Triggers route cache revalidation → `src/app/actions/product.ts:34`

## Product List Features

### Filtering and Search

- **Text Search** → `src/components/products/product-table.tsx:39-57`
  - Searches name, SKU, and description → `src/components/products/product-table.tsx:53-56`
  - Case-insensitive matching → `src/components/products/product-table.tsx:54`
  - Real-time filtering as user types → `src/components/products/product-table.tsx:91-92`
  - Placeholder: "Naziv, šifra ili opis" → `src/components/products/product-table.tsx:90`

- **VAT Category Filter** → `src/components/products/product-table.tsx:40-60`
  - Multi-select dropdown with all VAT categories → `src/components/products/product-table.tsx:98-103`
  - Shows only products matching selected categories → `src/components/products/product-table.tsx:60-62`
  - Placeholder: "Sve kategorije" → `src/components/products/product-table.tsx:102`

- **Status Filter** → `src/components/products/product-table.tsx:41-67`
  - Multi-select dropdown (Active/Inactive) → `src/components/products/product-table.tsx:108-113`
  - Options: "Aktivni", "Neaktivni" → `src/components/products/product-table.tsx:33-36`
  - Filters based on isActive boolean → `src/components/products/product-table.tsx:64-68`

- **Filter Reset** → `src/components/products/product-table.tsx:78-81`
  - "Resetiraj filtre" button appears when filters active → `src/components/products/product-table.tsx:124-127`
  - Clears search, VAT, and status filters → `src/components/products/product-table.tsx:78-82`

### Inline Editing

- **Price Editing** → `src/components/products/product-table.tsx:162-176`
  - Number input in table cell → `src/components/products/product-table.tsx:162`
  - Local draft state before save → `src/components/products/product-table.tsx:42`
  - Type: number, step: 0.01 → `src/components/products/product-table.tsx:174-175`
  - Right-aligned for readability → `src/components/products/product-table.tsx:173`

- **Status Toggle** → `src/components/products/product-table.tsx:189-208`
  - Clickable badge toggles active/inactive → `src/components/products/product-table.tsx:189-199`
  - Visual feedback: green for active, gray for inactive → `src/components/products/product-table.tsx:200-205`
  - Updates draft state immediately → `src/components/products/product-table.tsx:192-198`

- **Save Action** → `src/components/products/product-table.tsx:212-233`
  - Check icon button triggers save → `src/components/products/product-table.tsx:212`
  - Calls updateProductInline with price and isActive → `src/components/products/product-table.tsx:220`
  - Shows loading spinner during save → `src/components/products/product-table.tsx:236-237`
  - Success: green check icon + toast notification → `src/components/products/product-table.tsx:225`
  - Error: red X icon + toast error → `src/components/products/product-table.tsx:222-223`
  - Clears draft state on success → `src/components/products/product-table.tsx:226-230`

### Table Display

- **Product Columns** → `src/components/products/product-table.tsx:139-146`
  - Naziv (Name) with optional description → `src/components/products/product-table.tsx:152-156`
  - Šifra (SKU) or "—" if missing → `src/components/products/product-table.tsx:158-160`
  - Cijena (Price) with inline editing → `src/components/products/product-table.tsx:161-177`
  - Jedinica (Unit) with code → `src/components/products/product-table.tsx:178-181`
  - PDV (VAT) rate + category label → `src/components/products/product-table.tsx:182-186`
  - Status (Active/Inactive) toggle → `src/components/products/product-table.tsx:188-209`
  - Akcije (Actions): Save, Edit, Delete → `src/components/products/product-table.tsx:210-251`

- **Actions** → `src/components/products/product-table.tsx:244-249`
  - Save button (inline changes) → `src/components/products/product-table.tsx:212-243`
  - "Uredi" button links to /products/:id/edit → `src/components/products/product-table.tsx:244-247`
  - DeleteProductButton with confirmation → `src/app/(dashboard)/products/delete-button.tsx:15-59`

### Health Dashboard

- **Catalog Quality Metrics** → `src/components/products/product-health.tsx:12-82`
  - Total product count → `src/components/products/product-health.tsx:77-78`
  - Inactive products count → `src/app/(dashboard)/products/page.tsx:77`
  - Missing SKU count → `src/app/(dashboard)/products/page.tsx:78`
  - Zero price count → `src/app/(dashboard)/products/page.tsx:79`
  - Color-coded indicators: amber for issues, green for OK → `src/components/products/product-health.tsx:60-68`
  - Helpful hints for each metric → `src/components/products/product-health.tsx:14-16`
  - Status message: "Katalog je spreman" or "Dovršite podatke" → `src/components/products/product-health.tsx:31-33`

## CSV Import

### Import Component

- **CSV Upload** → `src/components/products/product-csv-import.tsx:27-72`
  - File input accepting .csv and text/csv → `src/components/products/product-csv-import.tsx:110`
  - Client-side CSV parsing → `src/components/products/product-csv-import.tsx:27-57`
  - Required column: "name" → `src/components/products/product-csv-import.tsx:35-38`
  - Optional columns: sku, unit, price, vatRate → `src/components/products/product-csv-import.tsx:44-50`
  - Max 500 rows per import → `src/app/api/products/import/route.ts:17`

- **Example CSV Download** → `src/components/products/product-csv-import.tsx:120-129`
  - "Preuzmi primjer" button generates sample CSV → `src/components/products/product-csv-import.tsx:120`
  - Example content includes headers and two products → `src/components/products/product-csv-import.tsx:121`
  - Downloads as "primjer-proizvodi.csv" → `src/components/products/product-csv-import.tsx:126`

- **Import Feedback** → `src/components/products/product-csv-import.tsx:136-147`
  - Shows row count after parsing → `src/components/products/product-csv-import.tsx:144`
  - Error messages for invalid CSV → `src/components/products/product-csv-import.tsx:137-140`
  - Success toast: "{count} stavki spremno za uvoz" → `src/components/products/product-csv-import.tsx:55`

### Import API

- **CSV Processing** → `src/app/api/products/import/route.ts:20-69`
  - POST endpoint at /api/products/import → `src/app/api/products/import/route.ts:20`
  - Authenticates user and retrieves company → `src/app/api/products/import/route.ts:22-32`
  - Validates with Zod schema → `src/app/api/products/import/route.ts:35-38`
  - Filters empty rows → `src/app/api/products/import/route.ts:40`
  - Creates products in transaction → `src/app/api/products/import/route.ts:45-61`
  - Defaults: unit="kom", price=0, vatRate=25, vatCategory="S", isActive=true → `src/app/api/products/import/route.ts:52-57`
  - Returns created count → `src/app/api/products/import/route.ts:64`
  - Revalidates /products route → `src/app/api/products/import/route.ts:63`

## Edit Flow

### Edit Page

- **Product Edit Entry** → `src/app/(dashboard)/products/[id]/edit/page.tsx:10-32`
  - Route: /products/:id/edit → `src/app/(dashboard)/products/[id]/edit/page.tsx:10`
  - Server component fetches product by ID → `src/app/(dashboard)/products/[id]/edit/page.tsx:15-20`
  - Enforces tenant isolation (companyId filter) → `src/app/(dashboard)/products/[id]/edit/page.tsx:18`
  - Returns 404 if not found → `src/app/(dashboard)/products/[id]/edit/page.tsx:22-24`
  - Renders EditProductForm with product data → `src/app/(dashboard)/products/[id]/edit/page.tsx:29`

### Edit Form

- **Form Initialization** → `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:26-43`
  - Uses react-hook-form with Zod resolver → `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:26-32`
  - Pre-fills all fields from existing product → `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:33-42`
  - Converts Decimal to Number for form inputs → `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:38-39`
  - Auto-updates VAT rate on category change → `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:45-51`

- **Form Structure** → `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:75-204`
  - Identical layout to create form → `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:83-194`
  - Section 1: Osnovni podaci (Name, Description, SKU, Unit) → `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:83-129`
  - Section 2: Cijena i PDV (Price, VAT Category, VAT Rate) → `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:131-178`
  - Section 3: Aktivan proizvod (isActive checkbox) → `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:180-194`
  - Actions: "Spremi promjene" and "Odustani" buttons → `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:196-203`

- **Update Processing** → `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:53-73`
  - Calls updateProduct server action → `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:57`
  - Validates data with same schema as create → `src/app/actions/product.ts:54-58`
  - Checks product exists and belongs to company → `src/app/actions/product.ts:46-52`
  - Updates all fields → `src/app/actions/product.ts:60-63`
  - Redirects to /products on success → `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:72`

## Delete Flow

### Delete Confirmation

- **DeleteProductButton** → `src/app/(dashboard)/products/delete-button.tsx:15-59`
  - Red "Obriši" button in actions column → `src/app/(dashboard)/products/delete-button.tsx:37-44`
  - Opens confirmation dialog on click → `src/app/(dashboard)/products/delete-button.tsx:40`
  - Dialog title: "Obriši proizvod" → `src/app/(dashboard)/products/delete-button.tsx:50`
  - Warning message with product name → `src/app/(dashboard)/products/delete-button.tsx:51`
  - "Ova akcija se ne može poništiti" warning → `src/app/(dashboard)/products/delete-button.tsx:51`

- **Delete Processing** → `src/app/(dashboard)/products/delete-button.tsx:20-33`
  - Calls deleteProduct server action → `src/app/(dashboard)/products/delete-button.tsx:22`
  - Server validates product existence and ownership → `src/app/actions/product.ts:116-122`
  - Deletes product record → `src/app/actions/product.ts:124-126`
  - Shows success toast → `src/app/(dashboard)/products/delete-button.tsx:30`
  - Refreshes page to reflect changes → `src/app/(dashboard)/products/delete-button.tsx:32`

## Data

### Database Schema

- **Product Model** → `prisma/schema.prisma:173-189`
  - id: String (cuid) → `prisma/schema.prisma:174`
  - companyId: String (tenant isolation) → `prisma/schema.prisma:175`
  - name: String (required) → `prisma/schema.prisma:176`
  - description: String? (optional) → `prisma/schema.prisma:177`
  - sku: String? (optional) → `prisma/schema.prisma:178`
  - unit: String (default "C62") → `prisma/schema.prisma:179`
  - price: Decimal(10,2) → `prisma/schema.prisma:180`
  - vatRate: Decimal(5,2) (default 25) → `prisma/schema.prisma:181`
  - vatCategory: String (default "S") → `prisma/schema.prisma:182`
  - isActive: Boolean (default true) → `prisma/schema.prisma:183`
  - createdAt: DateTime → `prisma/schema.prisma:184`
  - updatedAt: DateTime → `prisma/schema.prisma:185`
  - company: Relation to Company → `prisma/schema.prisma:186`
  - Index on companyId → `prisma/schema.prisma:188`

### Data Flow

1. **Create Flow** → `src/app/actions/product.ts:20-36`
   - Validate auth and company context
   - Validate form data with Zod schema
   - Create product with auto-added companyId
   - Revalidate /products route
   - Return success with product data

2. **List Flow** → `src/app/(dashboard)/products/page.tsx:23-47`
   - Fetch all products for company (ordered by name)
   - Map unit codes and VAT categories to labels
   - Convert Decimal to Number for display
   - Pass to ProductTable component

3. **Search Flow** → `src/app/actions/product.ts:146-162`
   - getProducts(activeOnly) for basic filtering → `src/app/actions/product.ts:133-143`
   - searchProducts(query) for text search → `src/app/actions/product.ts:146-162`
   - OR search across name, sku, description → `src/app/actions/product.ts:153-156`
   - Case-insensitive matching → `src/app/actions/product.ts:154`
   - Limit to 10 results → `src/app/actions/product.ts:159`
   - Only active products → `src/app/actions/product.ts:152`

4. **Update Flow** → `src/app/actions/product.ts:39-67`
   - Validate product exists and belongs to company
   - Validate updated data with Zod schema
   - Update all fields
   - Revalidate route
   - Return success

5. **Delete Flow** → `src/app/actions/product.ts:112-130`
   - Validate product exists and belongs to company
   - Delete product record
   - Revalidate route
   - Return success

## Validation

### Client-Side Validation

1. **React Hook Form** → `src/app/(dashboard)/products/new/page.tsx:21-34`
   - Zod resolver for schema validation → `src/app/(dashboard)/products/new/page.tsx:27`
   - Real-time field validation → `src/app/(dashboard)/products/new/page.tsx:88`
   - Error messages displayed inline → `src/app/(dashboard)/products/new/page.tsx:88-89`

2. **Input Constraints** → `src/app/(dashboard)/products/new/page.tsx:134-167`
   - Price: number, min 0, step 0.01 → `src/app/(dashboard)/products/new/page.tsx:134-136`
   - VAT Rate: number, min 0, max 100, step 0.01 → `src/app/(dashboard)/products/new/page.tsx:165-167`
   - Name: min 2 characters → `src/lib/validations/product.ts:4`

### Server-Side Validation

1. **Authentication** → `src/app/actions/product.ts:21`
   - Session validation via requireAuth()
   - User must be logged in

2. **Tenant Isolation** → `src/app/actions/product.ts:23`
   - requireCompanyWithContext() enforces company scope
   - All queries filtered by companyId

3. **Schema Validation** → `src/app/actions/product.ts:24-28`
   - Zod safeParse with structured errors
   - Validates name, price, vatRate, vatCategory, unit, isActive
   - Returns detailed error messages

4. **Ownership Verification** → `src/app/actions/product.ts:46-52`
   - Update/delete operations verify product belongs to company
   - Tenant middleware ensures companyId match
   - Returns error if not found

## Enums & Constants

### Unit Codes (UN/ECE Recommendation 20)

- **Standard Units** → `src/lib/validations/product.ts:17-27`
  - C62: Komad (Piece) → `src/lib/validations/product.ts:18`
  - KGM: Kilogram → `src/lib/validations/product.ts:19`
  - LTR: Litra (Liter) → `src/lib/validations/product.ts:20`
  - MTR: Metar (Meter) → `src/lib/validations/product.ts:21`
  - MTK: Kvadratni metar (Square meter) → `src/lib/validations/product.ts:22`
  - HUR: Sat (Hour) → `src/lib/validations/product.ts:23`
  - DAY: Dan (Day) → `src/lib/validations/product.ts:24`
  - MON: Mjesec (Month) → `src/lib/validations/product.ts:25`
  - SET: Set → `src/lib/validations/product.ts:26`
  - PCE: Komad (Piece) → `src/lib/validations/product.ts:27`

### VAT Categories (EN 16931)

- **Tax Categories** → `src/lib/validations/product.ts:31-37`
  - S: Standardna stopa (25%) → `src/lib/validations/product.ts:32`
  - AA: Snižena stopa (13%) → `src/lib/validations/product.ts:33`
  - E: Oslobođeno PDV-a (0%) → `src/lib/validations/product.ts:34`
  - Z: Nulta stopa (0%) → `src/lib/validations/product.ts:35`
  - O: Izvan oporezivanja (0%) → `src/lib/validations/product.ts:36`

## Dependencies

- **Depends on**:
  - [[auth-login]] - User authentication required → `src/app/actions/product.ts:21`
  - [[company-management]] - Company must exist → `src/app/actions/product.ts:23`
  - [[tenant-isolation]] - Multi-tenant data filtering → `src/lib/prisma-extensions.ts:55`
  - [[capabilities]] - Feature gating (invoicing module required) → `src/app/(dashboard)/products/page.tsx:18-21`

- **Depended by**:
  - [[invoicing-create]] - Products used in invoice line items → `src/app/(dashboard)/e-invoices/new/page.tsx:21`
  - [[e-invoicing-create]] - Products with VAT categories for e-invoices
  - [[product-search]] - Search functionality uses products → `src/app/actions/product.ts:146-162`

## Integrations

### Invoice Integration

- **Product Selection** → `src/app/(dashboard)/e-invoices/new/page.tsx:19-36`
  - getProducts() fetches all products for invoice form → `src/app/(dashboard)/e-invoices/new/page.tsx:21`
  - Converts Decimal to Number for client components → `src/app/(dashboard)/e-invoices/new/page.tsx:33-34`
  - Only active products shown by default → `src/app/actions/product.ts:139`
  - Products include name, sku, unit, price, vatRate, vatCategory → `src/app/(dashboard)/e-invoices/new/page.tsx:28-35`

### Tenant Isolation

- **Prisma Extensions** → `src/lib/prisma-extensions.ts:53-76`
  - Product model included in TENANT_MODELS → `src/lib/prisma-extensions.ts:55`
  - All queries automatically filtered by companyId
  - Middleware adds companyId on create
  - Prevents cross-company data access

### CSV Import Integration

- **Bulk Import** → `src/components/products/product-csv-import.tsx:74-92`
  - Client-side CSV parsing
  - POST to /api/products/import → `src/components/products/product-csv-import.tsx:77`
  - Server validates and creates products in transaction → `src/app/api/products/import/route.ts:45-61`
  - Toast notifications for success/error → `src/components/products/product-csv-import.tsx:86`

## Verification Checklist

- [ ] User can access /products/new after authentication
- [ ] Form validates required fields (name, price)
- [ ] VAT category auto-sets VAT rate
- [ ] Unit dropdown shows all UN/ECE codes
- [ ] Product created with correct companyId
- [ ] Tenant isolation prevents cross-company access
- [ ] Product list displays all company products
- [ ] Search filters by name, SKU, and description
- [ ] VAT and status filters work correctly
- [ ] Inline price editing updates product
- [ ] Status toggle updates isActive flag
- [ ] Edit page loads existing product data
- [ ] Update saves all changed fields
- [ ] Delete shows confirmation dialog
- [ ] Delete removes product successfully
- [ ] CSV import creates multiple products
- [ ] CSV validation rejects invalid data
- [ ] Health dashboard shows correct metrics
- [ ] Only active products appear in invoice forms
- [ ] Inactive products hidden from invoice selection
- [ ] Route revalidation refreshes cached data

## Evidence Links

1. Entry point page component → `src/app/(dashboard)/products/new/page.tsx:16`
2. Create product server action → `src/app/actions/product.ts:20`
3. Product schema validation → `src/lib/validations/product.ts:3`
4. Unit codes definition → `src/lib/validations/product.ts:16`
5. VAT categories definition → `src/lib/validations/product.ts:30`
6. Product database model → `prisma/schema.prisma:173`
7. Products list page → `src/app/(dashboard)/products/page.tsx:15`
8. Product table component → `src/components/products/product-table.tsx:38`
9. Inline update action → `src/app/actions/product.ts:70`
10. Delete product action → `src/app/actions/product.ts:112`
11. Edit page component → `src/app/(dashboard)/products/[id]/edit/page.tsx:10`
12. Edit form component → `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:21`
13. Update product action → `src/app/actions/product.ts:39`
14. Delete button component → `src/app/(dashboard)/products/delete-button.tsx:15`
15. Product health widget → `src/components/products/product-health.tsx:12`
16. CSV import component → `src/components/products/product-csv-import.tsx:21`
17. CSV import API → `src/app/api/products/import/route.ts:20`
18. Search products action → `src/app/actions/product.ts:146`
19. Get products action → `src/app/actions/product.ts:133`
20. Tenant isolation model list → `src/lib/prisma-extensions.ts:55`
21. Product usage in e-invoices → `src/app/(dashboard)/e-invoices/new/page.tsx:21`
22. VAT category change handler → `src/app/(dashboard)/products/new/page.tsx:37`
23. Form default values → `src/app/(dashboard)/products/new/page.tsx:28`
24. Client-side form setup → `src/app/(dashboard)/products/new/page.tsx:21`
25. Price field configuration → `src/app/(dashboard)/products/new/page.tsx:131`
26. Unit dropdown rendering → `src/app/(dashboard)/products/new/page.tsx:110`
27. VAT category dropdown → `src/app/(dashboard)/products/new/page.tsx:143`
28. Active checkbox → `src/app/(dashboard)/products/new/page.tsx:177`
29. Form submission handler → `src/app/(dashboard)/products/new/page.tsx:45`
30. Auth and tenant context → `src/app/actions/product.ts:21-23`
31. Database create operation → `src/app/actions/product.ts:30`
32. Route revalidation → `src/app/actions/product.ts:34`
33. Success redirect → `src/app/(dashboard)/products/new/page.tsx:64`
34. Product table filtering → `src/components/products/product-table.tsx:46`
35. CSV import validation → `src/app/api/products/import/route.ts:35`
