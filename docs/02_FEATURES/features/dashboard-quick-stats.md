# Feature: Quick Stats Display

## Status

- Documentation: Full
- Last verified: 2025-12-15
- Evidence count: 8

## Purpose

Provides at-a-glance business metrics on the dashboard, showing total revenue, invoice counts, contact counts, and product counts to help users quickly understand their business health and key operational data.

## User Entry Points

| Type | Path       | Evidence                                    |
| ---- | ---------- | ------------------------------------------- |
| Page | /dashboard | `src/app/(dashboard)/dashboard/page.tsx:20` |

## Core Flow

1. User navigates to `/dashboard` after authentication → `src/app/(dashboard)/dashboard/page.tsx:20`
2. Server fetches aggregate data from database (revenue, invoice count, contact count, product count) → `src/app/(dashboard)/dashboard/page.tsx:34-87`
3. Stats are formatted with icons and passed to `TodayActionsCard` component → `src/app/(dashboard)/dashboard/page.tsx:199-226`
4. `TodayActionsCard` renders stats in a grid layout with icons → `src/components/dashboard/today-actions-card.tsx:79-94`
5. Each stat displays label, value, optional change indicator, and icon → `src/components/dashboard/today-actions-card.tsx:80-92`

## Key Modules

| Module           | Purpose                                                    | Location                                          |
| ---------------- | ---------------------------------------------------------- | ------------------------------------------------- |
| DashboardPage    | Main dashboard page that fetches and aggregates stats data | `src/app/(dashboard)/dashboard/page.tsx`          |
| TodayActionsCard | Component that displays stats along with alerts and tasks  | `src/components/dashboard/today-actions-card.tsx` |
| StatCard         | Reusable component for rendering individual stat cards     | `src/components/ui/stat-card.tsx`                 |
| QuickStats       | Legacy standalone component for rendering stats (not used) | `src/components/dashboard/quick-stats.tsx`        |

## Data

- **Tables**: `EInvoice` → `prisma/schema.prisma:191`, `Contact` → `prisma/schema.prisma:148`, `Product` → `prisma/schema.prisma:173`, `Company` → `prisma/schema.prisma:67`
- **Key fields**:
  - `EInvoice.totalAmount` - aggregated for total revenue
  - `EInvoice.status` - filtered for FISCALIZED, SENT, DELIVERED, ACCEPTED statuses
  - `EInvoice.companyId` - filters data to current company
  - `Contact.companyId` - counts contacts for current company
  - `Product.companyId` - counts products for current company

## Metrics Displayed

The Quick Stats Display shows four key metrics:

1. **Total Revenue (Ukupni prihod)**:
   - Aggregates `totalAmount` from all e-invoices with status in [FISCALIZED, SENT, DELIVERED, ACCEPTED]
   - Formatted as Euro currency with 2 decimal places
   - Shows "Zadnjih 6 mjeseci" (Last 6 months) as context
   - Icon: TrendingUp

2. **E-Invoices (E-Računi)**:
   - Total count of all e-invoices for the company
   - Shows additional info if drafts exist: "{count} u nacrtu"
   - Icon: FileText

3. **Contacts (Kontakti)**:
   - Total count of all contacts (buyers and vendors)
   - No additional description
   - Icon: Users

4. **Products (Proizvodi)**:
   - Total count of all products/services
   - No additional description
   - Icon: Package

## Data Fetching

Data is fetched server-side using Prisma queries in parallel:

- `db.eInvoice.count()` - Gets total invoice count → `src/app/(dashboard)/dashboard/page.tsx:44`
- `db.contact.count()` - Gets total contact count → `src/app/(dashboard)/dashboard/page.tsx:45`
- `db.product.count()` - Gets total product count → `src/app/(dashboard)/dashboard/page.tsx:46`
- `db.eInvoice.aggregate()` - Sums total revenue from completed invoices → `src/app/(dashboard)/dashboard/page.tsx:63-69`
- `db.eInvoice.count({ status: "DRAFT" })` - Gets draft count for additional context → `src/app/(dashboard)/dashboard/page.tsx:47-49`

All queries are scoped to the current company using `companyId` filter.

## Dependencies

- **Depends on**: [[auth-session]] (requires authenticated user), Company selection (must have current company)
- **Depended by**: None (standalone display component)

## Integrations

- Prisma ORM → Database queries for aggregate data
- Lucide React → Icon library for TrendingUp, FileText, Users, Package icons

## Verification Checklist

- [ ] User can view total revenue in Euros with 2 decimal places
- [ ] User can see total count of e-invoices
- [ ] User can see draft invoice count (if any exist)
- [ ] User can see total contact count
- [ ] User can see total product count
- [ ] All stats display appropriate icons
- [ ] Stats are filtered to current company only
- [ ] Revenue only includes completed invoice statuses (FISCALIZED, SENT, DELIVERED, ACCEPTED)

## Evidence Links

1. `src/app/(dashboard)/dashboard/page.tsx:20-276` - Main dashboard page implementation
2. `src/app/(dashboard)/dashboard/page.tsx:34-87` - Parallel data fetching using Promise.all
3. `src/app/(dashboard)/dashboard/page.tsx:44-46` - Database count queries for invoices, contacts, products
4. `src/app/(dashboard)/dashboard/page.tsx:63-69` - Revenue aggregation query with status filter
5. `src/app/(dashboard)/dashboard/page.tsx:199-226` - Stats highlights array construction with formatting
6. `src/components/dashboard/today-actions-card.tsx:79-94` - Stats grid rendering
7. `src/components/ui/stat-card.tsx:1-60` - Reusable stat card component (alternate implementation)
8. `prisma/schema.prisma:191-199` - EInvoice model schema
