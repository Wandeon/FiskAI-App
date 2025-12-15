# Feature: Edit Product

## Status

- Documentation: Complete
- Last verified: 2025-12-15
- Evidence count: 11

## Purpose

Allows users to modify existing product and service details (name, description, SKU, unit, price, VAT settings, active status) through both a dedicated edit page and inline table editing. Products can be updated at any time with no restrictions. The feature supports full edits via the updateProduct server action and quick inline updates via updateProductInline for price and status changes. Automatic timestamps (createdAt, updatedAt) provide implicit price change tracking through the updatedAt field.

## User Entry Points

| Type | Path                | Evidence                                            |
| ---- | ------------------- | --------------------------------------------------- |
| Page | /products/:id/edit  | `src/app/(dashboard)/products/[id]/edit/page.tsx:1` |
| Page | /products           | `src/app/(dashboard)/products/page.tsx:1`           |
| API  | updateProduct       | `src/app/actions/product.ts:39-68`                  |
| API  | updateProductInline | `src/app/actions/product.ts:70-110`                 |

## Core Flow

### Full Product Edit Flow

1. User navigates to products list at /products -> `src/app/(dashboard)/products/page.tsx:15`
2. Product table displays all products with filter options -> `src/components/products/product-table.tsx:38-260`
3. User clicks "Uredi" button on product row -> `src/components/products/product-table.tsx:244-248`
4. System routes to edit page /products/:id/edit -> `src/app/(dashboard)/products/[id]/edit/page.tsx:10`
5. Edit page loads existing product data -> `src/app/(dashboard)/products/[id]/edit/page.tsx:15-24`
6. EditProductForm displays with current values -> `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:21-206`
7. User modifies product fields (name, price, VAT, etc.) -> `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:88-194`
8. User submits form -> `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:53-73`
9. Client validates with Zod schema -> `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:32`
10. Client calls updateProduct server action -> `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:57`
11. Server validates product exists and belongs to company -> `src/app/actions/product.ts:46-52`
12. Server validates input with Zod schema -> `src/app/actions/product.ts:54-58`
13. Server updates product with new data -> `src/app/actions/product.ts:60-63`
14. Cache revalidation triggers UI refresh -> `src/app/actions/product.ts:65`
15. User redirected to products list -> `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:72`

### Inline Edit Flow

1. User views product table with inline editing fields -> `src/components/products/product-table.tsx:136-260`
2. User modifies price directly in table input -> `src/components/products/product-table.tsx:162-176`
3. User clicks status badge to toggle active/inactive -> `src/components/products/product-table.tsx:189-208`
4. User clicks check button to save changes -> `src/components/products/product-table.tsx:212-243`
5. Client calls updateProductInline with partial data -> `src/components/products/product-table.tsx:220`
6. Server validates product exists -> `src/app/actions/product.ts:77-83`
7. Server merges partial update with existing data -> `src/app/actions/product.ts:85-100`
8. Server updates product -> `src/app/actions/product.ts:102-105`
9. Cache revalidation refreshes table -> `src/app/actions/product.ts:107`
10. Success toast displayed -> `src/components/products/product-table.tsx:225`

## Key Modules

| Module               | Purpose                                  | Location                                               |
| -------------------- | ---------------------------------------- | ------------------------------------------------------ |
| Edit Product Page    | Server component that loads product data | `src/app/(dashboard)/products/[id]/edit/page.tsx`      |
| EditProductForm      | Client form for full product editing     | `src/app/(dashboard)/products/[id]/edit/edit-form.tsx` |
| ProductTable         | Table with inline editing capabilities   | `src/components/products/product-table.tsx`            |
| Products List Page   | Main products page with table            | `src/app/(dashboard)/products/page.tsx`                |
| updateProduct action | Server action for full product updates   | `src/app/actions/product.ts:39-68`                     |
| updateProductInline  | Server action for partial inline updates | `src/app/actions/product.ts:70-110`                    |
| deleteProduct action | Server action to delete products         | `src/app/actions/product.ts:112-131`                   |
| DeleteProductButton  | Delete confirmation dialog component     | `src/app/(dashboard)/products/delete-button.tsx`       |
| Product validations  | Zod schema and constants                 | `src/lib/validations/product.ts`                       |

## Data

### Database Tables

- **Product**: Main product/service table -> `prisma/schema.prisma:173-189`
  - Key fields: id, companyId, name, description, sku
  - Pricing fields: price (Decimal), vatRate (Decimal), vatCategory (String)
  - Unit field: unit (String, default "C62")
  - Status field: isActive (Boolean, default true)
  - Audit fields: createdAt, updatedAt (DateTime, auto-managed)

### Product Schema

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

Source: `src/lib/validations/product.ts:3-12`

### VAT Categories

EN 16931 standard VAT categories used in Croatia:

- **S**: Standardna stopa (25%) -> `src/lib/validations/product.ts:32`
- **AA**: Snižena stopa (13%) -> `src/lib/validations/product.ts:33`
- **E**: Oslobođeno PDV-a (0%) -> `src/lib/validations/product.ts:34`
- **Z**: Nulta stopa (0%) -> `src/lib/validations/product.ts:35`
- **O**: Izvan oporezivanja (0%) -> `src/lib/validations/product.ts:36`

### Unit Codes

UN/ECE Recommendation 20 unit codes commonly used:

- C62 (Komad), KGM (Kilogram), LTR (Litra), MTR (Metar), MTK (Kvadratni metar), HUR (Sat), DAY (Dan), MON (Mjesec), SET (Set), PCE (Komad) -> `src/lib/validations/product.ts:17-28`

## Edit Restrictions

### Status-Based Rules

**No status-based edit restrictions** - Products can be edited at any time:

- **Active products**: Can be fully edited and deleted -> `src/app/actions/product.ts:39-68`
- **Inactive products**: Can be fully edited and deleted -> `src/app/actions/product.ts:39-68`

### Server-Side Validation

```typescript
const existingProduct = await db.product.findFirst({
  where: { id: productId },
})

if (!existingProduct) {
  return { error: "Proizvod nije pronađen" }
}
```

Source: `src/app/actions/product.ts:46-52`

**Note**: Only checks product exists - no status restrictions.

### Company Ownership Validation

- Tenant isolation ensures users can only edit products in their company -> `src/app/actions/product.ts:45`
- requireCompanyWithContext automatically filters by companyId -> `src/lib/auth-utils.ts:74-77`

## Field Validation

### Editable Fields

All fields can be updated:

- **name**: Required, minimum 2 characters -> `src/lib/validations/product.ts:4`
- **description**: Optional text field -> `src/lib/validations/product.ts:5`
- **sku**: Optional product code -> `src/lib/validations/product.ts:6`
- **unit**: Unit of measure, default "C62" (piece) -> `src/lib/validations/product.ts:7`
- **price**: Required number, minimum 0 -> `src/lib/validations/product.ts:8`
- **vatRate**: Number 0-100, default 25% -> `src/lib/validations/product.ts:9`
- **vatCategory**: Enum ["S", "AA", "E", "Z", "O"], default "S" -> `src/lib/validations/product.ts:10`
- **isActive**: Boolean, default true -> `src/lib/validations/product.ts:11`

### Inline Update Schema

```typescript
const productInlineSchema = productSchema.pick({
  name: true,
  sku: true,
  description: true,
  unit: true,
  price: true,
  vatRate: true,
  vatCategory: true,
  isActive: true,
})
```

Source: `src/app/actions/product.ts:9-18`

### Form Behavior

- VAT rate auto-updates when VAT category changes -> `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:45-51`
- Price accepts decimal values with 0.01 step -> `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:140`
- Active status toggle with explanation text -> `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:182-193`

## Price History Tracking

### Implicit Tracking via Timestamps

- **updatedAt**: Automatically updated on every product change -> `prisma/schema.prisma:185`
- **createdAt**: Records initial product creation time -> `prisma/schema.prisma:184`
- Changes to price update the updatedAt timestamp -> Database trigger
- No explicit price history table - timestamps provide audit trail

### Future Enhancement Potential

While not currently implemented, price history could be tracked by:

- Creating a ProductPriceHistory table
- Recording price changes with timestamps and user
- Displaying historical prices in product detail view

## Security Features

### Authentication & Authorization

- Requires authenticated user -> `src/app/(dashboard)/products/[id]/edit/page.tsx:12`
- Requires company membership -> `src/app/(dashboard)/products/[id]/edit/page.tsx:13`
- Tenant context isolation via requireCompanyWithContext -> `src/app/actions/product.ts:45`

### Permission Requirements

- **Update**: Standard company context, no special permission -> `src/app/actions/product.ts:39-68`
- **Delete**: Standard company context, no special permission -> `src/app/actions/product.ts:112-131`
- **Inline Update**: Standard company context, no special permission -> `src/app/actions/product.ts:70-110`

### Data Integrity

- Price stored as Decimal for precise monetary calculations -> `prisma/schema.prisma:180`
- Tenant isolation prevents cross-company product access -> `src/app/actions/product.ts:45`
- Zod validation ensures data type and range correctness -> `src/lib/validations/product.ts:3-12`
- Company ownership enforced through database query filters -> `src/app/(dashboard)/products/[id]/edit/page.tsx:16-19`

## Dependencies

- **Depends on**:
  - Create Product (F053) - Uses same data structures and validation
  - View Products (F052) - Entry point for editing
  - Authentication - Requires logged-in user with company

- **Depended by**:
  - Create Invoice - Uses product data for invoice line items
  - E-Invoice Creation - Products used in electronic invoices
  - Product Import - CSV import updates existing products

## Integrations

### Prisma ORM

- Decimal type for precise price calculations -> `prisma/schema.prisma:180-181`
- Tenant context filtering via middleware -> `src/lib/auth-utils.ts:74-77`
- Automatic timestamp management -> `prisma/schema.prisma:184-185`

### Next.js Cache

- revalidatePath for real-time UI updates -> `src/app/actions/product.ts:65,107,128`
- Invalidates /products path after updates -> `src/app/actions/product.ts:65`
- Supports optimistic UI updates in inline editing -> `src/components/products/product-table.tsx:162-176`

### React Hook Form

- Form state management with validation -> `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:26-43`
- Zod schema resolver for type-safe validation -> `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:32`
- Default values populated from existing product -> `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:33-42`

## UI Components

### Edit Form Components

- **Card, CardHeader, CardTitle, CardContent**: Layout containers -> `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:83-194`
- **Input**: Text and number inputs with error display -> `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:90-175`
- **Button**: Submit and cancel actions -> `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:197-202`
- **Select dropdowns**: Unit and VAT category selection -> `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:117-164`
- **Checkbox**: Active status toggle -> `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:183-186`

### Inline Editing Components

- **ProductTable**: Table with editable cells -> `src/components/products/product-table.tsx:38-260`
- **Input**: Inline price editing -> `src/components/products/product-table.tsx:162-176`
- **Status badge button**: Clickable active/inactive toggle -> `src/components/products/product-table.tsx:189-208`
- **Check button**: Save inline changes -> `src/components/products/product-table.tsx:212-243`
- **Loading spinner**: Visual feedback during save -> `src/components/products/product-table.tsx:237`
- **Error icon**: Indicates save failure -> `src/components/products/product-table.tsx:239`

### Form Sections

1. **Osnovni podaci** (Basic Data) -> `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:83-129`
   - Name, description, SKU, unit of measure

2. **Cijena i PDV** (Price and VAT) -> `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:131-178`
   - Price, VAT category, VAT rate

3. **Status** (Active Status) -> `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:180-194`
   - Active checkbox with explanation

## Error Handling

- **Product not found**: Returns error "Proizvod nije pronađen" -> `src/app/actions/product.ts:51,82,121`
- **Product not found (page)**: Shows 404 not found page -> `src/app/(dashboard)/products/[id]/edit/page.tsx:22-24`
- **Invalid data**: Returns error "Neispravni podaci" with Zod details -> `src/app/actions/product.ts:57,99`
- **Client-side validation**: Form validation before submit -> `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:32`
- **Inline update failures**: Shows error toast with message -> `src/components/products/product-table.tsx:221-223`
- **Visual error indicators**: Error icon displayed on failed inline edits -> `src/components/products/product-table.tsx:238-240`

## Verification Checklist

- [x] User can access edit page at /products/:id/edit
- [x] Edit form displays with current product values
- [x] All product fields can be modified
- [x] No status-based restrictions on editing
- [x] updateProduct validates and updates all fields
- [x] updateProductInline supports partial updates
- [x] Price stored as Decimal for precision
- [x] VAT rate auto-updates when category changes
- [x] Cache invalidation refreshes product list
- [x] Inline editing works in product table
- [x] Tenant isolation prevents cross-company edits
- [x] Error messages are clear and localized
- [x] updatedAt timestamp tracks last modification

## Related Features

- **Create Product**: `src/app/actions/product.ts:20-37` (F053)
- **View Products**: `src/app/(dashboard)/products/page.tsx` (F052)
- **Delete Product**: `src/app/actions/product.ts:112-131` (part of edit feature)
- **Product Search**: `src/app/actions/product.ts:146-163` (used in invoice creation)

## Evidence Links

1. `src/app/(dashboard)/products/[id]/edit/page.tsx:1-32` - Edit page server component with product loading
2. `src/app/(dashboard)/products/[id]/edit/edit-form.tsx:1-206` - Full edit form with validation and submission
3. `src/app/actions/product.ts:39-68` - updateProduct server action with validation
4. `src/app/actions/product.ts:46-52` - Product existence check and company validation
5. `src/app/actions/product.ts:54-58` - Zod schema validation for input
6. `src/app/actions/product.ts:60-66` - Database update and cache revalidation
7. `src/app/actions/product.ts:70-110` - updateProductInline for quick edits
8. `src/components/products/product-table.tsx:136-260` - Product table with inline editing
9. `src/lib/validations/product.ts:3-37` - Product schema and validation constants
10. `prisma/schema.prisma:173-189` - Product model with all fields and timestamps
11. `src/app/(dashboard)/products/page.tsx:1-87` - Products list page as entry point
