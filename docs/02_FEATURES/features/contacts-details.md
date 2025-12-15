# Feature: Contact Details

## Status

- Documentation: Complete
- Last verified: 2025-12-15
- Evidence count: 16

## Purpose

Provides a comprehensive overview page for individual contacts (customers and suppliers), displaying complete contact information, financial metrics, payment behavior analytics, invoice history, and activity tracking. Users can view key performance indicators including total revenue/expenses, outstanding balances, payment patterns, and recent transaction history, with contextual actions for editing, invoicing, and managing the contact relationship.

## User Entry Points

| Type | Path           | Evidence                                            |
| ---- | -------------- | --------------------------------------------------- |
| Page | /contacts/:id  | `src/app/(dashboard)/contacts/[id]/page.tsx:31-436` |
| API  | getContactList | `src/app/actions/contact-list.ts:17-93`             |

## Core Flow

### Contact Detail View Flow

1. User navigates to contacts list at /contacts → `src/app/(dashboard)/contacts/page.tsx:85`
2. User clicks on a contact card to view details → `src/components/contacts/contact-card.tsx:55-60`
3. System authenticates user and verifies company access → `src/app/(dashboard)/contacts/[id]/page.tsx:33-47`
4. System fetches contact with all related invoices and expenses → `src/app/(dashboard)/contacts/[id]/page.tsx:50-66`
5. System filters invoices and expenses by companyId for tenant isolation → `src/app/(dashboard)/contacts/[id]/page.tsx:54,58,62`
6. System returns 404 if contact not found or doesn't belong to company → `src/app/(dashboard)/contacts/[id]/page.tsx:68-70`
7. Page displays header with contact name, type badge, and OIB → `src/app/(dashboard)/contacts/[id]/page.tsx:136-153`
8. Action buttons rendered: Edit and "New Invoice" → `src/app/(dashboard)/contacts/[id]/page.tsx:155-168`
9. Contact info bar shows email, phone, and address with clickable links → `src/app/(dashboard)/contacts/[id]/page.tsx:172-195`
10. Key metrics cards display financial overview → `src/app/(dashboard)/contacts/[id]/page.tsx:198-273`
11. Payment behavior analytics calculated and displayed → `src/app/(dashboard)/contacts/[id]/page.tsx:77-130,278-341`
12. Recent invoices list shows last 10 transactions → `src/app/(dashboard)/contacts/[id]/page.tsx:124,343-410`
13. Invoice status breakdown summarizes all invoices → `src/app/(dashboard)/contacts/[id]/page.tsx:414-433`

### Invoice Relationship Logic

1. System determines contact type (CUSTOMER, SUPPLIER, or BOTH) → `src/app/(dashboard)/contacts/[id]/page.tsx:73`
2. For CUSTOMER contacts: displays invoices where contact is buyer → `src/app/(dashboard)/contacts/[id]/page.tsx:74`
3. For SUPPLIER contacts: displays invoices where contact is seller → `src/app/(dashboard)/contacts/[id]/page.tsx:74`
4. For expenses: always shows expensesAsVendor relationship → `src/app/(dashboard)/contacts/[id]/page.tsx:75`
5. Calculates metrics based on appropriate invoice relationship → `src/app/(dashboard)/contacts/[id]/page.tsx:78-79,127,206-209`

## Key Modules

| Module                | Purpose                                    | Location                                         |
| --------------------- | ------------------------------------------ | ------------------------------------------------ |
| Contact Overview Page | Server component rendering contact details | `src/app/(dashboard)/contacts/[id]/page.tsx`     |
| Contact Card          | Contact card display in list view          | `src/components/contacts/contact-card.tsx`       |
| Contact Actions       | CRUD operations for contacts               | `src/app/actions/contact.ts:9-111`               |
| Contact List          | Filtered and paginated contact listing     | `src/app/actions/contact-list.ts:17-93`          |
| Delete Button         | Client component for contact deletion      | `src/app/(dashboard)/contacts/delete-button.tsx` |

## Data

### Database Tables

- **Contact**: Main contact table → `prisma/schema.prisma:148-171`
  - Key fields: id, companyId, type, name, oib, vatNumber
  - Address fields: address, city, postalCode, country
  - Communication: email, phone
  - Business terms: paymentTermsDays (default 15)
  - Relations: eInvoicesAsBuyer, eInvoicesAsSeller, expensesAsVendor
  - Timestamps: createdAt, updatedAt → `prisma/schema.prisma:161-162`
  - Indexed by: companyId, oib → `prisma/schema.prisma:169-170`

- **EInvoice**: Invoice relationships → `prisma/schema.prisma:191-259`
  - Buyer relation: buyerId references Contact → `prisma/schema.prisma:244`
  - Seller relation: sellerId references Contact → `prisma/schema.prisma:248`
  - Used for revenue/customer metrics

- **Expense**: Supplier/vendor expenses → `prisma/schema.prisma:345-374`
  - Vendor relation: vendorId references Contact → `prisma/schema.prisma:368`
  - Used for supplier spend tracking

### Contact Type Enum

```typescript
enum ContactType {
  CUSTOMER    // Buyers - receive invoices from company
  SUPPLIER    // Vendors - provide goods/services to company
  BOTH        // Both customer and supplier relationship
}
```

Source: `prisma/schema.prisma:792-796`

## Display Sections

### Header Section

- Contact avatar with initials from name → `src/app/(dashboard)/contacts/[id]/page.tsx:138-140`
- Contact name as h1 heading → `src/app/(dashboard)/contacts/[id]/page.tsx:142`
- Type badge (Kupac/Dobavljac) with color coding → `src/app/(dashboard)/contacts/[id]/page.tsx:144-149`
  - CUSTOMER: emerald badge "Kupac"
  - SUPPLIER: purple badge "Dobavljac"
  - BOTH: uses same conditional logic
- OIB display if present → `src/app/(dashboard)/contacts/[id]/page.tsx:150`
- Edit and New Invoice action buttons → `src/app/(dashboard)/contacts/[id]/page.tsx:156-167`

### Contact Info Bar

- **Email**: Clickable mailto link with icon → `src/app/(dashboard)/contacts/[id]/page.tsx:175-180`
- **Phone**: Clickable tel link with icon → `src/app/(dashboard)/contacts/[id]/page.tsx:181-186`
- **Address**: Combined address, postal code, city display → `src/app/(dashboard)/contacts/[id]/page.tsx:187-192`
- All fields conditional (only show if present)
- Horizontal flex layout with gap spacing → `src/app/(dashboard)/contacts/[id]/page.tsx:174`

### Key Metrics Cards

Four metric cards in responsive grid:

1. **Total Revenue/Expenses** → `src/app/(dashboard)/contacts/[id]/page.tsx:199-213`
   - Shows "Ukupni prihod" for customers
   - Shows "Ukupni troskovi" for suppliers
   - Calculated from totalAmount of all related invoices/expenses
   - Formatted with formatCurrency() → `src/lib/format.ts:4-11`

2. **Outstanding Balance** → `src/app/(dashboard)/contacts/[id]/page.tsx:215-232`
   - Sum of unpaid invoices (where paidAt is null and status !== "DRAFT")
   - Amber styling when balance > 0, gray when 0
   - Dynamic icon color based on amount

3. **Average Payment Days** → `src/app/(dashboard)/contacts/[id]/page.tsx:234-258`
   - Calculated from paid invoices only → `src/app/(dashboard)/contacts/[id]/page.tsx:91-110`
   - Payment behavior indicator colors:
     - Excellent (≥80%): emerald
     - Good (≥60%): blue
     - Fair (≥40%): amber
     - Poor (<40%): red
   - Shows "-" if no payment history

4. **Total Invoices** → `src/app/(dashboard)/contacts/[id]/page.tsx:260-272`
   - Count of all invoices for this contact
   - Brand-colored icon and badge

### Payment Behavior Analytics

Detailed payment behavior card → `src/app/(dashboard)/contacts/[id]/page.tsx:278-341`:

- **On-time percentage** with visual progress bar → `src/app/(dashboard)/contacts/[id]/page.tsx:284-300`
  - Calculates % of invoices paid by due date
  - Color-coded progress bar (emerald/blue/amber/red)
  - Due date logic: uses invoice.dueDate or defaults to issueDate + 30 days → `src/app/(dashboard)/contacts/[id]/page.tsx:99`

- **Payment statistics grid** → `src/app/(dashboard)/contacts/[id]/page.tsx:303-312`
  - On-time payments count (emerald badge)
  - Late payments count (red badge)

- **Overdue warning** → `src/app/(dashboard)/contacts/[id]/page.tsx:315-320`
  - Red alert if any invoices are overdue
  - Shows count of overdue invoices
  - Only displays when overdueInvoices.length > 0

- **Behavior rating** → `src/app/(dashboard)/contacts/[id]/page.tsx:323-339`
  - "Odlican platiša" (Excellent payer): ≥80%
  - "Dobar platiša" (Good payer): ≥60%
  - "Prosjecan platiša" (Average payer): ≥40%
  - "Cesto kasni s placanjem" (Often late): <40%
  - Color-coded with trending icons

### Recent Invoices List

Card showing last 10 invoices → `src/app/(dashboard)/contacts/[id]/page.tsx:343-410`:

- **Header** with "Svi racuni" link to filtered invoice list → `src/app/(dashboard)/contacts/[id]/page.tsx:345-350`
- **Empty state** when no invoices → `src/app/(dashboard)/contacts/[id]/page.tsx:352-362`
  - Shows "Kreiraj prvi racun" button
  - Links to /e-invoices/new with buyerId pre-filled

- **Invoice items** → `src/app/(dashboard)/contacts/[id]/page.tsx:364-406`
  - Status icon (CheckCircle, AlertCircle, Clock)
  - Invoice number and issue date
  - Total amount formatted
  - Status label: "Placeno", "Dospjelo", "Ceka placanje"
  - Clickable link to invoice detail page
  - Color coding: emerald (paid), red (overdue), gray (pending)

### Status Breakdown

Grid showing invoice counts by status → `src/app/(dashboard)/contacts/[id]/page.tsx:414-433`:

- **Nacrti** (Drafts): status === "DRAFT"
- **Poslano** (Sent): status in ["SENT", "DELIVERED", "ACCEPTED"]
- **Placeno** (Paid): invoices with paidAt date
- **Dospjelo** (Overdue): unpaid invoices past due date

Each with colored background and large count number.

## Actions Available

### View Contact Details

- **Entry**: Click contact card or navigate to /contacts/:id → `src/components/contacts/contact-card.tsx:55-60`
- **Access Control**: Requires authentication and company ownership → `src/app/(dashboard)/contacts/[id]/page.tsx:33-47,68-70`
- **Data Fetching**: Includes related invoices and expenses → `src/app/(dashboard)/contacts/[id]/page.tsx:50-66`

### Edit Contact

- **Button**: "Uredi" in header → `src/app/(dashboard)/contacts/[id]/page.tsx:156-161`
- **Navigation**: `/contacts/:id/edit` → `src/app/(dashboard)/contacts/[id]/edit/page.tsx:10-32`
- **Server Action**: updateContact() → `src/app/actions/contact.ts:28-58`
- **Validation**: Uses contactSchema → `src/lib/validations/contact.ts:3-15`

### Create Invoice

- **Button**: "Novi racun" in header → `src/app/(dashboard)/contacts/[id]/page.tsx:162-167`
- **Navigation**: `/e-invoices/new?buyerId={id}`
- **Pre-fills**: Buyer/contact field in invoice creation form
- **Also available**: From contact card footer → `src/components/contacts/contact-card.tsx:129-135`

### Delete Contact

- **Location**: Contact card footer in list view → `src/components/contacts/contact-card.tsx:144`
- **Component**: DeleteContactButton → `src/app/(dashboard)/contacts/delete-button.tsx:13-47`
- **Confirmation**: Shows confirmation dialog → `src/app/(dashboard)/contacts/delete-button.tsx:34-44`
- **Server Action**: deleteContact() → `src/app/actions/contact.ts:60-79`
- **Cascade**: Related invoices updated (buyerId/sellerId set to null)

### Quick Contact Actions

From contact card → `src/components/contacts/contact-card.tsx:109-146`:

- **Email**: mailto: link
- **Phone**: tel: link
- **New Invoice**: Links to /e-invoices/new
- **Edit**: Links to /contacts/:id/edit
- **Delete**: Opens confirmation dialog

## Metrics & Calculations

### Financial Metrics

- **Total Revenue**: Sum of totalAmount from eInvoicesAsBuyer → `src/app/(dashboard)/contacts/[id]/page.tsx:79`
- **Total Expenses**: Sum of totalAmount from expensesAsVendor → `src/app/(dashboard)/contacts/[id]/page.tsx:127`
- **Outstanding Balance**: Sum of unpaid invoices → `src/app/(dashboard)/contacts/[id]/page.tsx:84`
- **Currency Formatting**: Croatian locale (hr-HR) → `src/lib/format.ts:5`

### Payment Analytics

- **Average Payment Days**: Mean time from issueDate to paidAt → `src/app/(dashboard)/contacts/[id]/page.tsx:87-110`
- **On-time Payments**: Paid before or on dueDate → `src/app/(dashboard)/contacts/[id]/page.tsx:100-101`
- **Late Payments**: Paid after dueDate → `src/app/(dashboard)/contacts/[id]/page.tsx:103`
- **On-time Percentage**: (onTimePayments / paidInvoices) \* 100 → `src/app/(dashboard)/contacts/[id]/page.tsx:112-114`
- **Overdue Invoices**: Unpaid and past due date → `src/app/(dashboard)/contacts/[id]/page.tsx:117-121`

### Payment Behavior Rating

Logic: `src/app/(dashboard)/contacts/[id]/page.tsx:130`

- **Excellent**: onTimePercentage ≥ 80%
- **Good**: onTimePercentage ≥ 60%
- **Fair**: onTimePercentage ≥ 40%
- **Poor**: onTimePercentage < 40%

## Security Features

### Authentication & Authorization

- Requires authenticated user → `src/app/(dashboard)/contacts/[id]/page.tsx:33-37`
- Company ownership validation → `src/app/(dashboard)/contacts/[id]/page.tsx:40-47,68-70`
- Tenant context isolation via companyId filter → `src/app/(dashboard)/contacts/[id]/page.tsx:54,58,62`

### Data Access Controls

- Contact filtered by companyId → `src/app/(dashboard)/contacts/[id]/page.tsx:51,68`
- Invoices filtered by companyId → `src/app/(dashboard)/contacts/[id]/page.tsx:54,58`
- Expenses filtered by companyId → `src/app/(dashboard)/contacts/[id]/page.tsx:62`
- 404 response if contact not found or unauthorized → `src/app/(dashboard)/contacts/[id]/page.tsx:68-70`
- Server actions use requireCompanyWithContext → `src/app/actions/contact.ts:12,34,63`

### Tenant Isolation

- Uses runWithTenant() for automatic filtering → `src/lib/auth-utils.ts:86-88`
- All database queries automatically scoped to companyId
- Prevents cross-company data access

## Dependencies

- **Depends on**:
  - Contact Management (F031) - CRUD operations for contacts
  - E-Invoice System - Invoice relationships and data
  - Expense Tracking - Vendor/supplier expense data
  - Company Settings - Tenant context and authentication

- **Depended by**:
  - Invoice Creation - Pre-fills buyer/seller from contact
  - Contact List (F032) - Entry point to detail page
  - Payment Analytics - Uses contact payment behavior data
  - Financial Reports - Contact-level revenue/expense metrics

## Integrations

### Prisma ORM

- Complex includes for relations → `src/app/(dashboard)/contacts/[id]/page.tsx:52-65`
- Decimal type for monetary values → `prisma/schema.prisma:353-355`
- Ordered invoices by issueDate → `src/app/(dashboard)/contacts/[id]/page.tsx:55,59`
- Ordered expenses by date → `src/app/(dashboard)/contacts/[id]/page.tsx:63`

### Next.js Features

- Server component for data fetching → `src/app/(dashboard)/contacts/[id]/page.tsx:31`
- Dynamic routing with async params → `src/app/(dashboard)/contacts/[id]/page.tsx:27-32`
- notFound() for 404 handling → `src/app/(dashboard)/contacts/[id]/page.tsx:36,46,69`
- Link component for navigation → `src/app/(dashboard)/contacts/[id]/page.tsx:156,162`

### UI Components

- Card components for layout → `src/app/(dashboard)/contacts/[id]/page.tsx:5`
- Button components for actions → `src/app/(dashboard)/contacts/[id]/page.tsx:6`
- Lucide icons for visual elements → `src/app/(dashboard)/contacts/[id]/page.tsx:7-23`
- Client component for delete action → `src/app/(dashboard)/contacts/delete-button.tsx:13`

## UI Components

### Layout Components

- **Card, CardHeader, CardTitle, CardContent**: Structure containers → `src/app/(dashboard)/contacts/[id]/page.tsx:5`
- **Grid layout**: Responsive grid for metrics (2/4 columns) → `src/app/(dashboard)/contacts/[id]/page.tsx:198,276`
- **Flex layouts**: Header and info bar → `src/app/(dashboard)/contacts/[id]/page.tsx:135,155,174`

### Type Badge

- Dynamic color mapping by ContactType → `src/components/contacts/contact-card.tsx:23-27`
- CUSTOMER: emerald (bg-emerald-100 text-emerald-700)
- SUPPLIER: purple (bg-purple-100 text-purple-700)
- BOTH: success/emerald colors
- Rounded pill design → `src/app/(dashboard)/contacts/[id]/page.tsx:144-149`

### Icon Usage

- Building2: Contact avatar → `src/app/(dashboard)/contacts/[id]/page.tsx:139`
- Mail: Email links → `src/app/(dashboard)/contacts/[id]/page.tsx:177`
- Phone: Phone links → `src/app/(dashboard)/contacts/[id]/page.tsx:183`
- MapPin: Address display → `src/app/(dashboard)/contacts/[id]/page.tsx:189`
- CheckCircle: Paid invoices → `src/app/(dashboard)/contacts/[id]/page.tsx:381`
- AlertCircle: Overdue invoices → `src/app/(dashboard)/contacts/[id]/page.tsx:317,383`
- Clock: Pending invoices → `src/app/(dashboard)/contacts/[id]/page.tsx:243,385`

### Formatting Utilities

- **formatCurrency()**: Croatian EUR formatting → `src/lib/format.ts:4-11`
- **Date formatting**: Croatian locale (hr-HR) → `src/app/(dashboard)/contacts/[id]/page.tsx:391`
- **Number formatting**: Intl.NumberFormat with hr-HR locale

## Error Handling

- **Contact not found**: Returns 404 via notFound() → `src/app/(dashboard)/contacts/[id]/page.tsx:68-70`
- **Unauthorized access**: 404 if companyId mismatch → `src/app/(dashboard)/contacts/[id]/page.tsx:68`
- **No authentication**: Redirects to login → `src/lib/auth-utils.ts:14-16`
- **No company**: Redirects to onboarding → `src/lib/auth-utils.ts:45-47`
- **Delete errors**: Handled in server action → `src/app/actions/contact.ts:68-70`

## Verification Checklist

- [x] User can view contact details at /contacts/:id
- [x] Contact type badge displays correct label and color
- [x] Contact information (email, phone, address) shown correctly
- [x] Key metrics calculated accurately (revenue, outstanding, payments)
- [x] Payment behavior analytics display on-time percentage
- [x] Payment behavior rating calculated correctly
- [x] Recent invoices list shows last 10 transactions
- [x] Invoice status breakdown shows correct counts
- [x] Edit button navigates to edit page
- [x] New Invoice button pre-fills buyer/contact
- [x] Delete action shows confirmation dialog
- [x] Overdue warning displays when invoices past due
- [x] Empty state shown when no invoices
- [x] 404 shown for non-existent or unauthorized contacts
- [x] Tenant isolation prevents cross-company access
- [x] All invoice relationships filtered by companyId

## Related Features

- **Contact List**: `src/app/(dashboard)/contacts/page.tsx:85-145` (F032)
- **Contact CRUD**: `src/app/actions/contact.ts:9-111` (F031)
- **E-Invoice Creation**: Pre-fills contact data
- **Expense Tracking**: Vendor relationship display
- **Payment Analytics**: Contact-level payment metrics

## Evidence Links

1. `src/app/(dashboard)/contacts/[id]/page.tsx:31-436` - Main contact overview page component
2. `src/app/(dashboard)/contacts/[id]/page.tsx:50-66` - Contact data fetching with invoice/expense relations
3. `src/app/(dashboard)/contacts/[id]/page.tsx:136-168` - Contact header with name, type badge, and action buttons
4. `src/app/(dashboard)/contacts/[id]/page.tsx:172-195` - Contact info bar with email, phone, address
5. `src/app/(dashboard)/contacts/[id]/page.tsx:198-273` - Key metrics cards (revenue, outstanding, payment days, invoice count)
6. `src/app/(dashboard)/contacts/[id]/page.tsx:278-341` - Payment behavior analytics card with on-time percentage
7. `src/app/(dashboard)/contacts/[id]/page.tsx:343-410` - Recent invoices list with status indicators
8. `src/app/(dashboard)/contacts/[id]/page.tsx:414-433` - Invoice status breakdown grid
9. `src/app/(dashboard)/contacts/[id]/page.tsx:77-130` - Payment analytics calculations and metrics
10. `src/app/actions/contact.ts:28-58` - updateContact server action
11. `src/app/actions/contact.ts:60-79` - deleteContact server action
12. `src/app/actions/contact-list.ts:17-93` - getContactList with filtering and pagination
13. `src/components/contacts/contact-card.tsx:29-150` - Contact card component with quick actions
14. `src/app/(dashboard)/contacts/delete-button.tsx:13-47` - Delete button with confirmation dialog
15. `src/lib/validations/contact.ts:3-15` - Contact schema validation
16. `prisma/schema.prisma:148-171` - Contact model with all fields and relations
