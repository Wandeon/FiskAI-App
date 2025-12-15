# Feature: View Invoices (F016)

## Status

- Documentation: Complete
- Last verified: 2025-12-15
- Evidence count: 12

## Purpose

Provides a unified view of all invoices (regular and e-invoices) alongside other financial documents, allowing users to browse, search, filter, and access detailed invoice information. The feature redirects from the legacy `/invoices` route to the new unified documents hub at `/documents` with category filtering, enabling users to view invoices in the context of their entire document ecosystem while maintaining backward compatibility.

## User Entry Points

| Type       | Path                             | Evidence                                         |
| ---------- | -------------------------------- | ------------------------------------------------ |
| Navigation | `/documents?category=invoice`    | `src/lib/navigation.ts:46`                       |
| Navigation | `/documents?category=e-invoice`  | `src/lib/navigation.ts:47`                       |
| Redirect   | `/invoices`                      | `src/app/(dashboard)/invoices/page.tsx:18`       |
| Detail     | `/invoices/:id`                  | `src/app/(dashboard)/invoices/[id]/page.tsx:32`  |
| Detail     | `/documents/:id` (auto-redirect) | `src/app/(dashboard)/documents/[id]/page.tsx:32` |
| Dashboard  | `/dashboard` (Recent Activity)   | Via Recent Activity widget                       |

## Core Flow

### List View Flow

1. User accesses `/invoices` route -> `src/app/(dashboard)/invoices/page.tsx:5-19`
2. System redirects to unified documents hub -> `src/app/(dashboard)/invoices/page.tsx:18`
3. Query parameter `category=invoice` filters for regular invoices -> `src/app/(dashboard)/documents/page.tsx:96`
4. System fetches invoices via unified query -> `src/lib/documents/unified-query.ts:106-237`
5. Invoices are normalized into UnifiedDocument format -> `src/lib/documents/unified-query.ts:156-167`
6. Category filter cards display document type counts -> `src/components/documents/category-cards.tsx:31-80`
7. Search input allows filtering by invoice number or buyer name -> `src/app/(dashboard)/documents/page.tsx:210-225`
8. Responsive table displays invoices with status badges -> `src/app/(dashboard)/documents/page.tsx:247-294`
9. Pagination controls navigate through results (20 per page) -> `src/app/(dashboard)/documents/page.tsx:298-320`
10. User clicks invoice to view details -> Detail view flow

### Detail View Flow

1. User clicks invoice number or "Pregledaj" link -> `src/app/(dashboard)/documents/page.tsx:134,176`
2. System routes to `/invoices/:id` -> `src/app/(dashboard)/invoices/[id]/page.tsx:32`
3. Invoice data fetched with relationships -> `src/app/(dashboard)/invoices/[id]/page.tsx:46-59`
4. Fiscal certificate status checked -> `src/app/(dashboard)/invoices/[id]/page.tsx:66-72`
5. Invoice header displays number, type, and status -> `src/app/(dashboard)/invoices/[id]/page.tsx:84-92`
6. Buyer and invoice details shown in cards -> `src/app/(dashboard)/invoices/[id]/page.tsx:138-186`
7. Fiscal status badge with JIR/ZKI displayed -> `src/app/(dashboard)/invoices/[id]/fiscal-status-badge.tsx:19-166`
8. Line items table shows products/services -> `src/app/(dashboard)/invoices/[id]/page.tsx:190-220`
9. Totals card calculates net, VAT, and total amounts -> `src/app/(dashboard)/invoices/[id]/page.tsx:223-242`
10. Invoice actions toolbar provides PDF download, email send, convert, delete -> `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:15-136`

### Search and Filter Flow

1. User enters search term in search box -> `src/app/(dashboard)/documents/page.tsx:210-225`
2. Form submits to `/documents` with search parameter -> `src/app/(dashboard)/documents/page.tsx:210`
3. Backend filters invoices by invoice number or buyer name -> `src/lib/documents/unified-query.ts:115-120`
4. Results display with matching invoices highlighted
5. User can select category to filter by document type -> `src/components/documents/category-cards.tsx:54`
6. Combined filters apply (search + category) -> `src/lib/documents/unified-query.ts:204-212`

## Key Modules

| Module                | Purpose                                         | Location                                                    |
| --------------------- | ----------------------------------------------- | ----------------------------------------------------------- |
| InvoicesPage (Legacy) | Redirects to unified documents hub              | `src/app/(dashboard)/invoices/page.tsx`                     |
| DocumentsPage         | Main unified documents list with filtering      | `src/app/(dashboard)/documents/page.tsx`                    |
| queryUnifiedDocuments | Fetches and normalizes all document types       | `src/lib/documents/unified-query.ts:106-237`                |
| CategoryCards         | Document type filter with counts                | `src/components/documents/category-cards.tsx`               |
| ResponsiveTable       | Adaptive table/card layout for invoices         | `src/components/ui/responsive-table.tsx`                    |
| InvoiceDetailPage     | Individual invoice view with full details       | `src/app/(dashboard)/invoices/[id]/page.tsx`                |
| InvoiceActions        | Action toolbar (PDF, email, convert, delete)    | `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx`     |
| FiscalStatusBadge     | Fiscalization status display with JIR/ZKI       | `src/app/(dashboard)/invoices/[id]/fiscal-status-badge.tsx` |
| DocumentsClient       | Client wrapper for dropzone and sidebar         | `src/components/documents/documents-client.tsx`             |
| getInvoice            | Server action to fetch single invoice           | `src/app/actions/invoice.ts:308-323`                        |
| getInvoices           | Server action to fetch invoice list with cursor | `src/app/actions/invoice.ts:325-355`                        |

## Data

### Database Tables

#### EInvoice Table

Primary invoice storage table -> `prisma/schema.prisma:191-259`

Key fields:

- `id` (String, CUID): Unique identifier
- `companyId` (String): Tenant isolation
- `type` (InvoiceType): INVOICE, E_INVOICE, QUOTE, PROFORMA, CREDIT_NOTE, DEBIT_NOTE -> `prisma/schema.prisma:228,815-822`
- `direction` (EInvoiceDirection): OUTBOUND or INBOUND -> `prisma/schema.prisma:194,799-801`
- `status` (EInvoiceStatus): DRAFT, PENDING_FISCALIZATION, FISCALIZED, SENT, DELIVERED, ACCEPTED, REJECTED, ARCHIVED, ERROR -> `prisma/schema.prisma:205,803-813`
- `invoiceNumber` (String): Display number -> `prisma/schema.prisma:197`
- `internalReference` (String?): Internal tracking code -> `prisma/schema.prisma:229`
- `issueDate` (DateTime): Invoice date -> `prisma/schema.prisma:198`
- `dueDate` (DateTime?): Payment due date -> `prisma/schema.prisma:199`
- `buyerId` (String?): Contact relation -> `prisma/schema.prisma:196`
- `netAmount` (Decimal): Base amount before VAT -> `prisma/schema.prisma:202`
- `vatAmount` (Decimal): Total VAT -> `prisma/schema.prisma:203`
- `totalAmount` (Decimal): Final amount -> `prisma/schema.prisma:204`
- `currency` (String): Currency code, default EUR -> `prisma/schema.prisma:200`
- `jir` (String?): Fiscal identifier (JIR) -> `prisma/schema.prisma:206`
- `zki` (String?): Protective code (ZKI) -> `prisma/schema.prisma:207`
- `fiscalizedAt` (DateTime?): Fiscalization timestamp -> `prisma/schema.prisma:208`
- `paidAt` (DateTime?): Payment timestamp -> `prisma/schema.prisma:232`
- `convertedFromId` (String?): Source document for conversions -> `prisma/schema.prisma:231`

Relations:

- `buyer` (Contact): Invoice recipient -> `prisma/schema.prisma:244`
- `seller` (Contact): Invoice issuer -> `prisma/schema.prisma:248`
- `company` (Company): Owner company -> `prisma/schema.prisma:245`
- `lines` (EInvoiceLine[]): Line items -> `prisma/schema.prisma:250`
- `fiscalRequests` (FiscalRequest[]): Fiscalization attempts -> `prisma/schema.prisma:251`
- `convertedFrom` (EInvoice): Source document -> `prisma/schema.prisma:246`
- `convertedTo` (EInvoice[]): Derived documents -> `prisma/schema.prisma:247`

Indexes:

- `companyId`: Tenant filtering -> `prisma/schema.prisma:253`
- `status`: Status-based queries -> `prisma/schema.prisma:254`
- `invoiceNumber`: Number lookups -> `prisma/schema.prisma:255`
- `direction`: Inbound/outbound filtering -> `prisma/schema.prisma:256`
- `type`: Document type filtering -> `prisma/schema.prisma:257`

#### EInvoiceLine Table

Invoice line items -> `prisma/schema.prisma:261-276`

Key fields:

- `lineNumber` (Int): Sequential order
- `description` (String): Item description
- `quantity` (Decimal): Item quantity
- `unit` (String): Unit of measure (default C62)
- `unitPrice` (Decimal): Price per unit
- `netAmount` (Decimal): Line subtotal
- `vatRate` (Decimal): VAT percentage
- `vatAmount` (Decimal): Line VAT

### Query Patterns

#### Unified Document Query

Fetches all document types in parallel -> `src/lib/documents/unified-query.ts:110-153`

```typescript
const [invoices, bankStatements, expenses, invoiceCount, bankCount, expenseCount] =
  await Promise.all([
    db.eInvoice.findMany({
      where: {
        companyId,
        ...(search
          ? {
              OR: [
                { invoiceNumber: { contains: search, mode: "insensitive" } },
                { buyer: { is: { name: { contains: search, mode: "insensitive" } } } },
              ],
            }
          : {}),
      },
      include: { buyer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    // ... other document types
  ])
```

#### Invoice Detail Query

Fetches single invoice with full relationships -> `src/app/(dashboard)/invoices/[id]/page.tsx:46-59`

```typescript
const invoice = await db.eInvoice.findFirst({
  where: { id, companyId: company.id },
  include: {
    buyer: true,
    seller: true,
    lines: { orderBy: { lineNumber: "asc" } },
    convertedFrom: { select: { id: true, invoiceNumber: true, type: true } },
    convertedTo: { select: { id: true, invoiceNumber: true, type: true } },
    fiscalRequests: {
      orderBy: { createdAt: "desc" },
      take: 1,
    },
  },
})
```

#### Paginated Invoice Query

Cursor-based pagination for large datasets -> `src/app/actions/invoice.ts:341-347`

```typescript
const invoices = await db.eInvoice.findMany({
  where,
  include: { buyer: { select: { name: true } } },
  orderBy: { createdAt: "desc" },
  take: limit + 1,
  ...(options?.cursor && { cursor: { id: options.cursor }, skip: 1 }),
})
```

### Data Normalization

Invoices transformed into unified format -> `src/lib/documents/unified-query.ts:156-167`

```typescript
const normalizedInvoices: UnifiedDocument[] = invoices.map((inv) => ({
  id: inv.id,
  category: inv.type === "E_INVOICE" ? "e-invoice" : "invoice",
  date: inv.issueDate,
  number: inv.invoiceNumber || "Bez broja",
  counterparty: inv.buyer?.name || null,
  amount: Number(inv.totalAmount),
  currency: inv.currency,
  status: INVOICE_STATUS_LABELS[inv.status] || inv.status,
  statusColor: getInvoiceStatusColor(inv.status),
  detailUrl: inv.type === "E_INVOICE" ? `/e-invoices/${inv.id}` : `/invoices/${inv.id}`,
}))
```

## Dependencies

### Depends On

- **Authentication System**: User and company context -> `src/lib/auth-utils.ts:requireAuth, requireCompany`
- **Tenant Context**: Multi-tenant data isolation -> `src/lib/prisma-extensions.ts:setTenantContext`
- **Contact Management**: Buyer/seller information -> `prisma/schema.prisma:Contact`
- **Fiscal Certificate**: Fiscalization capability check -> `prisma/schema.prisma:FiscalCertificate`

### Depended By

- **Dashboard Recent Activity**: Shows recent invoices -> Dashboard feature
- **Reports**: Invoice data for financial reports
- **Banking Reconciliation**: Invoice matching with transactions
- **Export Functions**: CSV/Excel export of invoices -> `src/app/api/exports/invoices/route.ts`

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
    // ...
  ]
}
```

#### Fiscal System Integration

Displays fiscalization status with JIR/ZKI -> `src/app/(dashboard)/invoices/[id]/fiscal-status-badge.tsx:26-46`

- Shows JIR (Jedinstveni Identifikator Računa)
- Shows ZKI (Zaštitni Kod Izdavatelja)
- Displays fiscalization timestamp
- Allows manual fiscalization for failed requests

#### PDF Generation

Invoice PDF download via API route -> `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:57-86`

- Endpoint: `/api/invoices/:id/pdf`
- Downloads formatted PDF with fiscal codes
- Filename format: `racun-{invoiceNumber}.pdf`

#### Email Delivery

Send invoice via email to buyer -> `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:88-101`

- Requires buyer email address
- Only available for FISCALIZED, SENT, DELIVERED statuses
- Uses Resend email service
- Tracks delivery, opens, clicks via webhooks -> `prisma/schema.prisma:221-227`

#### Document Import System

Invoices can be created from imported documents -> `src/components/documents/documents-client.tsx:145-156`

- Drag-and-drop file upload
- AI extraction of invoice data
- Review and confirmation modal
- Links to ImportJob -> `prisma/schema.prisma:242`

### External Integrations

#### Croatian Fiscal System (CIS)

Invoice fiscalization for tax compliance -> Fiscal certificate feature

- Generates JIR and ZKI codes
- Submits to Croatian Tax Authority
- Tracks fiscalization requests -> `prisma/schema.prisma:FiscalRequest`

## Verification Checklist

### List View

- [ ] User can access invoices via `/documents?category=invoice`
- [ ] Legacy `/invoices` route redirects to unified documents
- [ ] Invoice count badge shows correct total
- [ ] Search filters by invoice number and buyer name (case-insensitive)
- [ ] Category filter shows separate counts for regular and e-invoices
- [ ] Pagination displays 20 invoices per page
- [ ] Table shows: date, category, number, counterparty, amount, status
- [ ] Mobile view displays as cards instead of table
- [ ] Status badges use correct colors (DRAFT=gray, SENT=blue, FISCALIZED=green, etc.)
- [ ] Clicking invoice number navigates to detail page
- [ ] Empty state displays when no invoices found

### Detail View

- [ ] Invoice header shows number, type badge, and status badge
- [ ] Internal reference displays if present
- [ ] Buyer information card shows name, OIB, address
- [ ] Invoice details card shows issue date and due date
- [ ] Fiscal status badge displays JIR and ZKI when fiscalized
- [ ] Line items table shows all products/services with calculations
- [ ] Totals card displays net amount, VAT, and total
- [ ] Currency formatting uses hr-HR locale with correct symbol
- [ ] Notes section displays if notes exist
- [ ] Conversion info shows source document if converted
- [ ] Conversion info shows derived documents if converted to others

### Actions

- [ ] PDF download button generates and downloads PDF
- [ ] Email button appears only for fiscalized invoices with buyer email
- [ ] Email confirmation dialog shows recipient address
- [ ] Convert button appears only for QUOTE and PROFORMA types
- [ ] Delete button appears only for DRAFT status
- [ ] Delete requires confirmation
- [ ] Manual fiscalization button appears when certificate active and invoice not fiscalized
- [ ] Fiscal status updates after manual fiscalization
- [ ] Back button returns to documents list

### Data Integrity

- [ ] All queries filter by companyId (tenant isolation)
- [ ] Invoice totals match sum of line items
- [ ] VAT calculations are accurate
- [ ] Status transitions follow valid state machine
- [ ] Converted invoices maintain proper relationships
- [ ] Fiscal requests track all fiscalization attempts

## Evidence Links

1. `src/app/(dashboard)/invoices/page.tsx:1-19` - Legacy route redirect to unified documents hub
2. `src/app/(dashboard)/documents/page.tsx:38-324` - Main unified documents page with invoice list
3. `src/lib/documents/unified-query.ts:106-237` - Unified document query with invoice normalization
4. `src/app/(dashboard)/invoices/[id]/page.tsx:32-257` - Invoice detail page with full data display
5. `src/app/actions/invoice.ts:308-355` - Server actions for fetching invoices
6. `src/components/documents/category-cards.tsx:19-117` - Category filter with invoice counts
7. `src/components/ui/responsive-table.tsx:17-73` - Responsive table component for mobile/desktop
8. `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:15-136` - Invoice action toolbar
9. `src/app/(dashboard)/invoices/[id]/fiscal-status-badge.tsx:19-166` - Fiscal status display
10. `prisma/schema.prisma:191-259` - EInvoice table schema
11. `prisma/schema.prisma:803-813` - EInvoiceStatus enum definition
12. `src/lib/navigation.ts:39-51` - Navigation structure with document categories
