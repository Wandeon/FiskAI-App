# Feature: View Contacts (F047)

## Status

- Documentation: Complete
- Last verified: 2025-12-15
- Evidence count: 12

## Purpose

Provides a comprehensive view of all contacts (customers and suppliers) with flexible visualization options, advanced filtering, and search capabilities. The feature supports both list and board (kanban) views, enabling users to browse contacts, filter by type and segments, search by multiple criteria, and access detailed contact information with invoice analytics.

## User Entry Points

| Type       | Path                 | Evidence                                          |
| ---------- | -------------------- | ------------------------------------------------- |
| Navigation | `/contacts`          | `src/lib/navigation.ts:66`                        |
| Detail     | `/contacts/:id`      | `src/app/(dashboard)/contacts/[id]/page.tsx:31`   |
| Edit       | `/contacts/:id/edit` | `src/app/(dashboard)/contacts/[id]/edit/page.tsx` |
| Create     | `/contacts/new`      | `src/app/(dashboard)/contacts/new/page.tsx`       |

## Core Flow

### List View Flow

1. User accesses `/contacts` route -> `src/app/(dashboard)/contacts/page.tsx:85-145`
2. Page extracts search params (search, type, page, view, segments) -> `src/app/(dashboard)/contacts/page.tsx:86-96`
3. Quick filter buttons display for type selection (ALL, CUSTOMER, SUPPLIER, BOTH) -> `src/app/(dashboard)/contacts/page.tsx:118-123`
4. View toggle allows switching between list and board views -> `src/app/(dashboard)/contacts/page.tsx:220-243`
5. Contact filters component provides search and segment filtering -> `src/components/contacts/contact-filters.tsx:36-310`
6. System fetches contacts via server action -> `src/app/actions/contact-list.ts:17-93`
7. Contacts displayed in card grid (3 columns on large screens) -> `src/app/(dashboard)/contacts/page.tsx:55-59`
8. Each contact card shows avatar, name, OIB, type badge, and contact details -> `src/components/contacts/contact-card.tsx:42-149`
9. Pagination controls navigate through results (12 per page) -> `src/app/(dashboard)/contacts/page.tsx:62-80`
10. User clicks contact name to view details -> Detail view flow

### Board View Flow

1. User toggles to board view via view switcher -> `src/app/(dashboard)/contacts/page.tsx:233-240`
2. System fetches up to 120 contacts for board display -> `src/app/(dashboard)/contacts/page.tsx:172-178`
3. Contacts grouped into 4 columns by type (CUSTOMER, SUPPLIER, BOTH, OTHER) -> `src/app/(dashboard)/contacts/page.tsx:180-195`
4. Each column displays contact count and contact cards -> `src/app/(dashboard)/contacts/page.tsx:198-217`
5. Board provides kanban-style visualization of contact distribution -> `src/app/(dashboard)/contacts/page.tsx:162-218`

### Detail View Flow

1. User clicks contact name or navigates to `/contacts/:id` -> `src/app/(dashboard)/contacts/[id]/page.tsx:31-436`
2. System fetches contact with all related invoices and expenses -> `src/app/(dashboard)/contacts/[id]/page.tsx:50-70`
3. Header displays contact name, type badge, and OIB -> `src/app/(dashboard)/contacts/[id]/page.tsx:134-169`
4. Contact info bar shows email, phone, and address with clickable links -> `src/app/(dashboard)/contacts/[id]/page.tsx:172-195`
5. Key metrics cards display total revenue/expenses, outstanding balance, avg payment time, total invoices -> `src/app/(dashboard)/contacts/[id]/page.tsx:198-273`
6. Payment behavior card shows on-time percentage, late/on-time counts, overdue warnings -> `src/app/(dashboard)/contacts/[id]/page.tsx:278-341`
7. Recent invoices list displays last 10 invoices with status indicators -> `src/app/(dashboard)/contacts/[id]/page.tsx:343-410`
8. Invoice status breakdown shows distribution by status (DRAFT, SENT, PAID, OVERDUE) -> `src/app/(dashboard)/contacts/[id]/page.tsx:414-433`
9. Action buttons provide edit, new invoice, and delete options -> `src/app/(dashboard)/contacts/[id]/page.tsx:155-168`

### Search and Filter Flow

1. User enters search term in search box -> `src/components/contacts/contact-filters.tsx:129-137`
2. User can filter by type dropdown (desktop) or buttons (mobile) -> `src/components/contacts/contact-filters.tsx:159-167,211-226`
3. User toggles segment filters: VAT_PAYER, MISSING_EMAIL, NO_DOCUMENTS -> `src/components/contacts/contact-filters.tsx:170-188,231-246`
4. User clicks "Filtriraj" to apply filters -> `src/components/contacts/contact-filters.tsx:70-80`
5. URL updates with search parameters, triggering server-side filtering -> `src/app/actions/contact-list.ts:45-56`
6. Backend filters contacts by search (name, OIB, email) and segments -> `src/app/actions/contact-list.ts:24-56`
7. Results display with matching contacts
8. User can save filter combinations as presets for quick access -> `src/components/contacts/contact-filters.tsx:94-121`
9. Saved presets stored in localStorage and displayed as quick-apply buttons -> `src/components/contacts/contact-filters.tsx:281-306`

## Key Modules

| Module              | Purpose                                      | Location                                         |
| ------------------- | -------------------------------------------- | ------------------------------------------------ |
| ContactsPage        | Main contacts list page with view switcher   | `src/app/(dashboard)/contacts/page.tsx`          |
| ContactList         | Server component for paginated list view     | `src/app/(dashboard)/contacts/page.tsx:19-83`    |
| ContactBoard        | Server component for kanban board view       | `src/app/(dashboard)/contacts/page.tsx:162-218`  |
| ContactCard         | Individual contact card with actions         | `src/components/contacts/contact-card.tsx`       |
| ContactFilters      | Advanced filtering with presets              | `src/components/contacts/contact-filters.tsx`    |
| ContactDetailPage   | Individual contact overview with analytics   | `src/app/(dashboard)/contacts/[id]/page.tsx`     |
| DeleteContactButton | Confirmation dialog for contact deletion     | `src/app/(dashboard)/contacts/delete-button.tsx` |
| getContactList      | Server action for fetching filtered contacts | `src/app/actions/contact-list.ts`                |
| contactActions      | CRUD operations for contacts                 | `src/app/actions/contact.ts`                     |
| ContactListSkeleton | Loading placeholder for contact cards        | `src/components/contacts/contact-skeleton.tsx`   |

## Data

### Database Tables

#### Contact Table

Primary contact storage table -> `prisma/schema.prisma:148-171`

Key fields:

- `id` (String, CUID): Unique identifier
- `companyId` (String): Tenant isolation -> `prisma/schema.prisma:150`
- `type` (ContactType): CUSTOMER, SUPPLIER, or BOTH -> `prisma/schema.prisma:151,792-796`
- `name` (String): Contact name -> `prisma/schema.prisma:152`
- `oib` (String?): Croatian tax number (OIB) -> `prisma/schema.prisma:153`
- `vatNumber` (String?): VAT number for EU businesses -> `prisma/schema.prisma:154`
- `address` (String?): Street address -> `prisma/schema.prisma:155`
- `city` (String?): City name -> `prisma/schema.prisma:156`
- `postalCode` (String?): Postal/ZIP code -> `prisma/schema.prisma:157`
- `country` (String): Country code, default "HR" -> `prisma/schema.prisma:158`
- `email` (String?): Email address -> `prisma/schema.prisma:159`
- `phone` (String?): Phone number -> `prisma/schema.prisma:160`
- `paymentTermsDays` (Int): Default payment terms in days, default 15 -> `prisma/schema.prisma:163`

Relations:

- `company` (Company): Owner company -> `prisma/schema.prisma:164`
- `eInvoicesAsBuyer` (EInvoice[]): Invoices where this contact is the buyer -> `prisma/schema.prisma:165`
- `eInvoicesAsSeller` (EInvoice[]): Invoices where this contact is the seller -> `prisma/schema.prisma:166`
- `expensesAsVendor` (Expense[]): Expenses where this contact is the vendor -> `prisma/schema.prisma:167`

Indexes:

- `companyId`: Tenant filtering -> `prisma/schema.prisma:169`
- `oib`: Fast OIB lookups -> `prisma/schema.prisma:170`

### Query Patterns

#### Contact List Query

Fetches contacts with filtering, pagination, and invoice counts -> `src/app/actions/contact-list.ts:58-81`

```typescript
db.contact.findMany({
  where: {
    companyId: company.id,
    ...(type && type !== "ALL" && { type }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { oib: { contains: search } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    }),
    ...(segmentConditions.length > 0 && { AND: segmentConditions }),
  },
  orderBy: { name: "asc" },
  skip,
  take: limit,
  select: {
    id: true,
    name: true,
    type: true,
    oib: true,
    email: true,
    phone: true,
    city: true,
    _count: {
      select: {
        eInvoicesAsBuyer: true,
        eInvoicesAsSeller: true,
      },
    },
  },
})
```

#### Segment Filtering

Dynamic segment conditions for advanced filtering -> `src/app/actions/contact-list.ts:24-43`

- **VAT_PAYER**: Contacts with non-null vatNumber
- **MISSING_EMAIL**: Contacts with null or empty email
- **NO_DOCUMENTS**: Contacts with no invoices (as buyer or seller)

#### Contact Detail Query

Fetches single contact with all related documents -> `src/app/(dashboard)/contacts/[id]/page.tsx:50-66`

```typescript
db.contact.findUnique({
  where: { id },
  include: {
    eInvoicesAsBuyer: {
      where: { companyId: companyUser.companyId },
      orderBy: { issueDate: "desc" },
    },
    eInvoicesAsSeller: {
      where: { companyId: companyUser.companyId },
      orderBy: { issueDate: "desc" },
    },
    expensesAsVendor: {
      where: { companyId: companyUser.companyId },
      orderBy: { date: "desc" },
    },
  },
})
```

### Analytics Calculations

Contact detail page calculates various metrics -> `src/app/(dashboard)/contacts/[id]/page.tsx:72-131`

- **Total Revenue**: Sum of all invoice totalAmount values
- **Outstanding Balance**: Sum of unpaid invoice amounts (excluding DRAFT)
- **Average Payment Days**: Average time between issueDate and paidAt for paid invoices
- **On-time Percentage**: Percentage of invoices paid before dueDate
- **Overdue Invoices**: Unpaid invoices past their due date
- **Payment Behavior**: Rating based on on-time percentage (excellent ≥80%, good ≥60%, fair ≥40%, poor <40%)

### Type Labels

Croatian translations for contact types -> `src/components/contacts/contact-card.tsx:23-27`

```typescript
const typeConfig: Record<ContactType, { label: string; className: string }> = {
  CUSTOMER: { label: "Kupac", className: "bg-brand-100 text-brand-700" },
  SUPPLIER: { label: "Dobavljač", className: "bg-purple-100 text-purple-700" },
  BOTH: { label: "Kupac/Dobavljač", className: "bg-success-100 text-success-700" },
}
```

## Dependencies

### Depends On

- **Authentication System**: User and company context -> `src/lib/auth-utils.ts:requireAuth, requireCompany`
- **Tenant Context**: Multi-tenant data isolation -> `src/lib/auth-utils.ts:requireCompanyWithContext`
- **E-Invoice System**: Invoice relationships and metrics -> `prisma/schema.prisma:EInvoice`
- **Expense System**: Expense vendor relationships -> `prisma/schema.prisma:Expense`

### Depended By

- **E-Invoice Creation**: Contact selection for buyer/seller -> E-Invoice feature
- **Expense Tracking**: Vendor selection for expenses -> Expense feature
- **Invoice Templates**: Auto-fill contact information -> Invoicing feature
- **Payment Analytics**: Payment behavior tracking -> Reports feature

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

#### Quick Actions in Cards

Contact cards provide quick action buttons -> `src/components/contacts/contact-card.tsx:109-146`

- **Email**: Opens mailto link for direct email sending
- **Phone**: Opens tel link for calling
- **New Invoice**: Navigates to `/e-invoices/new?contactId={id}` with pre-filled contact
- **Edit**: Navigates to contact edit page
- **Delete**: Opens confirmation dialog with cascade delete warning

#### Filter Presets

Client-side filter preset management -> `src/components/contacts/contact-filters.tsx:47-121`

- Saved in localStorage as JSON
- Each preset stores: name, search, type, segments
- Presets can be applied with one click
- Duplicate names automatically replace existing presets
- Presets persist across sessions

#### Empty State

Contextual empty states based on filter state -> `src/app/(dashboard)/contacts/page.tsx:29-51`

- **No filters**: Prompts to create first contact with action button
- **With filters**: Suggests adjusting filters to find results
- Displays appropriate icon and messaging

### External Integrations

None currently. Contacts are an internal data management feature without external API integrations.

## Verification Checklist

### List View

- [ ] User can access contacts via `/contacts`
- [ ] Quick filter buttons show ALL, CUSTOMER, SUPPLIER, BOTH types
- [ ] View toggle switches between list and board views
- [ ] Search filters by name, OIB, and email (case-insensitive)
- [ ] Type filter shows dropdown on desktop, buttons on mobile
- [ ] Segment filters: VAT_PAYER, MISSING_EMAIL, NO_DOCUMENTS work correctly
- [ ] Pagination displays 12 contacts per page
- [ ] Contact cards show: avatar (initials), name, OIB, type badge, email, phone, city
- [ ] Invoice count displays total from buyer and seller relations
- [ ] Empty state displays when no contacts found
- [ ] Page numbers and previous/next buttons work correctly

### Board View

- [ ] Board view displays 4 columns: CUSTOMER, SUPPLIER, BOTH, OTHER
- [ ] Each column shows contact count
- [ ] Contacts grouped correctly by type
- [ ] Board loads up to 120 contacts
- [ ] Contact cards display same information as list view
- [ ] Empty columns show "Nema kontakata" message

### Filters

- [ ] Search box accepts text input and filters on Enter key
- [ ] Type filter updates results correctly
- [ ] Segment toggles apply multiple conditions
- [ ] Filter button applies all active filters
- [ ] Clear button resets all filters
- [ ] URL updates with filter parameters
- [ ] Filters persist across page refreshes
- [ ] View parameter preserved when applying filters
- [ ] Filter presets can be saved with custom names
- [ ] Saved presets display as clickable badges
- [ ] Applying preset restores all filter values
- [ ] Deleting preset removes from localStorage

### Detail View

- [ ] Contact header shows name, type badge, and OIB
- [ ] Contact info bar displays email (mailto), phone (tel), and address
- [ ] Total revenue/expenses metric displays correctly based on type
- [ ] Outstanding balance highlights unpaid invoices in amber
- [ ] Average payment days calculates correctly for paid invoices
- [ ] Total invoices count matches invoice count
- [ ] On-time percentage displays with color-coded progress bar
- [ ] On-time and late payment counts match calculations
- [ ] Overdue warning appears when invoices past due date exist
- [ ] Payment behavior indicator shows correct rating and color
- [ ] Recent invoices list shows last 10 invoices
- [ ] Invoice status icons display correctly (paid=check, overdue=alert, pending=clock)
- [ ] Invoice date formatting uses Croatian locale (dd.mm.yyyy)
- [ ] Invoice status breakdown shows DRAFT, SENT, PAID, OVERDUE counts
- [ ] Edit button navigates to contact edit page
- [ ] New invoice button pre-fills contact in invoice form
- [ ] Empty state displays when contact has no invoices

### Actions

- [ ] Contact card quick actions work: email, phone, new invoice
- [ ] Edit button navigates to edit form
- [ ] Delete button opens confirmation dialog
- [ ] Delete confirmation shows contact name
- [ ] Delete requires explicit confirmation
- [ ] Delete revalidates contact list after success
- [ ] Success/error feedback displays for all actions
- [ ] Actions disabled during processing

### Data Integrity

- [ ] All queries filter by companyId (tenant isolation)
- [ ] Contact type enum validates correctly (CUSTOMER, SUPPLIER, BOTH)
- [ ] OIB field accepts Croatian tax numbers
- [ ] VAT number stored separately from OIB
- [ ] Payment terms default to 15 days
- [ ] Country defaults to "HR"
- [ ] Email validation prevents invalid formats
- [ ] Phone numbers stored without formatting constraints
- [ ] Invoice count aggregations accurate
- [ ] Analytics calculations handle edge cases (no invoices, all unpaid)

## Evidence Links

1. `src/app/(dashboard)/contacts/page.tsx:85-253` - Main contacts page with list/board views and quick filters
2. `src/components/contacts/contact-card.tsx:29-150` - Contact card component with avatar, details, and quick actions
3. `src/components/contacts/contact-filters.tsx:36-310` - Advanced filtering component with search, segments, and presets
4. `src/app/(dashboard)/contacts/[id]/page.tsx:31-436` - Contact detail page with analytics and invoice history
5. `src/app/actions/contact-list.ts:17-93` - Server action for fetching filtered and paginated contacts
6. `src/app/actions/contact.ts:9-111` - CRUD server actions for contact management
7. `src/app/(dashboard)/contacts/delete-button.tsx:13-47` - Delete contact button with confirmation dialog
8. `prisma/schema.prisma:148-171` - Contact model schema with fields and relations
9. `prisma/schema.prisma:792-796` - ContactType enum definition (CUSTOMER, SUPPLIER, BOTH)
10. `src/lib/navigation.ts:66` - Navigation menu entry for contacts
11. `src/components/contacts/contact-skeleton.tsx:3-39` - Loading skeleton for contact cards
12. `src/app/(dashboard)/contacts/page.tsx:245-252` - Pagination link builder with parameter preservation
