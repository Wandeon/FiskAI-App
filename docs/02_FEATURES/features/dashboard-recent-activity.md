# Feature: Recent Activity Feed

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 8

## Purpose

Displays the 5 most recently created e-invoices on the dashboard to give users quick visibility into their latest invoicing activity. Users can see invoice status, buyer information, and amounts at a glance, with direct navigation to invoice details or the full invoice list.

## User Entry Points

| Type      | Path        | Evidence                                          |
| --------- | ----------- | ------------------------------------------------- |
| Dashboard | /dashboard  | `src/app/(dashboard)/dashboard/page.tsx:10,270`   |
| Component | Widget      | `src/components/dashboard/recent-activity.tsx:1`  |
| Link      | /e-invoices | `src/components/dashboard/recent-activity.tsx:39` |

## Core Flow

1. User navigates to /dashboard → `src/app/(dashboard)/dashboard/page.tsx:20`
2. Dashboard fetches last 5 invoices ordered by creation date → `src/app/(dashboard)/dashboard/page.tsx:50-62`
3. RecentActivity component renders invoice list with status badges → `src/components/dashboard/recent-activity.tsx:33-98`
4. Empty state shown if no invoices exist → `src/components/dashboard/recent-activity.tsx:50-60`
5. Clicking invoice navigates to detail page → `src/components/dashboard/recent-activity.tsx:70-73`
6. "Vidi sve" link navigates to full invoice list → `src/components/dashboard/recent-activity.tsx:38-44`

## Key Modules

| Module         | Purpose                                   | Location                                       |
| -------------- | ----------------------------------------- | ---------------------------------------------- |
| RecentActivity | Main component rendering recent invoices  | `src/components/dashboard/recent-activity.tsx` |
| DashboardPage  | Fetches invoice data and passes to widget | `src/app/(dashboard)/dashboard/page.tsx`       |
| EmptyState     | Displays when no invoices exist           | `src/components/ui/empty-state.tsx`            |
| PageCard       | Provides card UI structure                | `src/components/ui/page-card.tsx`              |

## Data

- **Tables**: `EInvoice` → `prisma/schema.prisma:191-259`
- **Key fields**:
  - `id` (string, CUID identifier)
  - `invoiceNumber` (string, display number)
  - `totalAmount` (Decimal, invoice total)
  - `status` (EInvoiceStatus enum)
  - `createdAt` (DateTime, for ordering)
  - `buyerId` (string, foreign key to Contact)
- **Query**: Recent invoices fetched with `orderBy: { createdAt: "desc" }` and `take: 5` limit
- **Relations**: Joins with `buyer` contact to display name → `src/app/(dashboard)/dashboard/page.tsx:60`

## Activity Events Tracked

The Recent Activity Feed tracks all e-invoice creation events with the following statuses:

1. **DRAFT** - Invoice created but not fiscalized → `prisma/schema.prisma:804`
2. **PENDING_FISCALIZATION** - Awaiting fiscal authority processing → `prisma/schema.prisma:805`
3. **FISCALIZED** - Successfully fiscalized with JIR → `prisma/schema.prisma:806`
4. **SENT** - Sent to buyer → `prisma/schema.prisma:807`
5. **DELIVERED** - Delivered to buyer's inbox → `prisma/schema.prisma:808`
6. **ACCEPTED** - Buyer accepted invoice → `prisma/schema.prisma:809`
7. **REJECTED** - Buyer rejected invoice → `prisma/schema.prisma:810`
8. **ERROR** - Error during processing → `prisma/schema.prisma:812`

Status badges are color-coded for visual recognition → `src/components/dashboard/recent-activity.tsx:22-31`

## Feed Population

The feed is populated through the following mechanism:

1. **Data Source**: Database query on `EInvoice` table filtered by `companyId` → `src/app/(dashboard)/dashboard/page.tsx:50-51`
2. **Ordering**: Sorted by `createdAt` in descending order (newest first) → `src/app/(dashboard)/dashboard/page.tsx:52`
3. **Limit**: Top 5 most recent invoices → `src/app/(dashboard)/dashboard/page.tsx:53`
4. **Selected Fields**: id, invoiceNumber, totalAmount, status, createdAt, and buyer relation → `src/app/(dashboard)/dashboard/page.tsx:54-61`
5. **Server-Side Rendering**: Fetched during page load using Next.js async server components
6. **Automatic Updates**: Feed refreshes on page navigation/refresh (no real-time updates)

## Display Information

Each activity item shows:

- **Invoice Number**: Primary identifier or "Bez broja" if not set → `src/components/dashboard/recent-activity.tsx:77`
- **Buyer Name**: Contact name or "—" for missing buyer → `src/components/dashboard/recent-activity.tsx:80`
- **Amount**: Formatted in EUR with Croatian locale (hr-HR) → `src/components/dashboard/recent-activity.tsx:85`
- **Status Badge**: Localized status label with color coding → `src/components/dashboard/recent-activity.tsx:87-89`
- **Clickable Link**: Each item links to invoice detail page → `src/components/dashboard/recent-activity.tsx:72`

## Dependencies

- **Depends on**: [[auth-session]] (requires authenticated user), [[e-invoice-management]] (invoice data)
- **Depended by**: None (standalone widget)

## Integrations

- **Database**: Prisma ORM for data queries → `src/app/(dashboard)/dashboard/page.tsx:3`
- **UI Components**: PageCard, EmptyState, Button from component library
- **Routing**: Next.js Link for navigation → `src/components/dashboard/recent-activity.tsx:1`

## Verification Checklist

- [ ] User can view last 5 invoices on dashboard
- [ ] Empty state displays when no invoices exist
- [ ] Clicking an invoice navigates to detail page
- [ ] "Vidi sve" link navigates to /e-invoices
- [ ] Status badges display correct colors and labels
- [ ] Amounts format correctly with EUR currency
- [ ] Buyer names display correctly or show fallback
- [ ] "Novi e-račun" button appears in empty state

## Evidence Links

1. `src/components/dashboard/recent-activity.tsx:1-99` - Complete RecentActivity component implementation
2. `src/app/(dashboard)/dashboard/page.tsx:50-62` - Database query fetching recent invoices
3. `src/app/(dashboard)/dashboard/page.tsx:270` - Component rendered in dashboard layout
4. `src/components/dashboard/recent-activity.tsx:22-31` - Status configuration with colors and labels
5. `src/components/dashboard/recent-activity.tsx:50-60` - Empty state implementation
6. `src/components/dashboard/recent-activity.tsx:63-94` - Invoice list rendering logic
7. `prisma/schema.prisma:191-259` - EInvoice database model
8. `prisma/schema.prisma:803-813` - EInvoiceStatus enum definition
