# Feature: Revenue Trends

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 7

## Purpose

Displays a visual trend chart of company revenue over the last 6 months, showing monthly totals with percentage change indicators to help users quickly understand revenue patterns and business growth.

## User Entry Points

| Type | Path       | Evidence                                        |
| ---- | ---------- | ----------------------------------------------- |
| Page | /dashboard | `src/app/(dashboard)/dashboard/page.tsx:20-276` |

## Core Flow

1. Dashboard page loads and fetches revenue data from last 6 months → `src/app/(dashboard)/dashboard/page.tsx:29-32`
2. E-invoices with revenue-qualifying statuses are queried from database → `src/app/(dashboard)/dashboard/page.tsx:70-80`
3. Revenue data is bucketed by month and aggregated → `src/app/(dashboard)/dashboard/page.tsx:91-112`
4. RevenueTrendCard component renders SVG chart with trend line → `src/components/dashboard/revenue-trend-card.tsx:14-88`
5. Percentage change is calculated comparing last two months → `src/components/dashboard/revenue-trend-card.tsx:17-19`

## Key Modules

| Module           | Purpose                                      | Location                                          |
| ---------------- | -------------------------------------------- | ------------------------------------------------- |
| RevenueTrendCard | Renders the revenue trend chart with SVG     | `src/components/dashboard/revenue-trend-card.tsx` |
| Dashboard Page   | Fetches and aggregates revenue data by month | `src/app/(dashboard)/dashboard/page.tsx`          |

## Data

- **Tables**: `EInvoice` → `prisma/schema.prisma:191`
- **Key fields**:
  - `totalAmount` (Decimal) - Total invoice amount including VAT → `prisma/schema.prisma:204`
  - `createdAt` (DateTime) - Invoice creation timestamp for monthly bucketing → `prisma/schema.prisma:217`
  - `status` (EInvoiceStatus) - Must be FISCALIZED, SENT, DELIVERED, or ACCEPTED to count as revenue → `prisma/schema.prisma:205`
- **Revenue-qualifying statuses**: FISCALIZED, SENT, DELIVERED, ACCEPTED → `src/app/(dashboard)/dashboard/page.tsx:18`

## Chart Implementation

- **Library**: Native SVG (no external charting library)
- **Chart Type**: Line chart with gradient fill
- **Visualization Elements**:
  - Polyline stroke for trend line → `src/components/dashboard/revenue-trend-card.tsx:62-69`
  - Linear gradient fill under the line → `src/components/dashboard/revenue-trend-card.tsx:56-60, 70-75`
  - Month labels along x-axis → `src/components/dashboard/revenue-trend-card.tsx:78-84`
- **Time Period**: Last 6 months → `src/app/(dashboard)/dashboard/page.tsx:29`
- **Data Points**: 6 monthly buckets with abbreviated month names (e.g., "sij", "velj") → `src/app/(dashboard)/dashboard/page.tsx:91-99`

## Data Calculation

- **Aggregation Logic**:
  - Query fetches all revenue-qualifying invoices from last 6 months → `src/app/(dashboard)/dashboard/page.tsx:70-80`
  - Invoices are bucketed by year-month key (YYYY-MM format) → `src/app/(dashboard)/dashboard/page.tsx:101-112`
  - Monthly totals are summed from invoice totalAmount values → `src/app/(dashboard)/dashboard/page.tsx:102-110`
- **Trend Indicator**:
  - Compares most recent month vs. previous month → `src/components/dashboard/revenue-trend-card.tsx:17-19`
  - Shows percentage change with TrendingUp/TrendingDown icon → `src/components/dashboard/revenue-trend-card.tsx:44-48`
  - Green background for positive change, red for negative → `src/components/dashboard/revenue-trend-card.tsx:39-42`

## UI Details

- **Card Header**: Displays "Prihod zadnjih 6 mjeseci" (Revenue last 6 months) → `src/components/dashboard/revenue-trend-card.tsx:33`
- **Current Value**: Shows latest month's revenue in EUR with Croatian locale formatting → `src/components/dashboard/revenue-trend-card.tsx:34-36`
- **Chart Height**: 128px (h-32) → `src/components/dashboard/revenue-trend-card.tsx:54`
- **Gradient Colors**: Blue (hsl(217, 91%, 60%)) with opacity fade → `src/components/dashboard/revenue-trend-card.tsx:57-59`

## Dependencies

- **Depends on**: [[auth-session]] (requires authenticated user and company), E-Invoice data
- **Depended by**: None (standalone visualization component)

## Integrations

- **Database**: Prisma ORM for querying EInvoice records → `src/app/(dashboard)/dashboard/page.tsx:70-80`
- **UI Icons**: Lucide React (TrendingUp, TrendingDown) → `src/components/dashboard/revenue-trend-card.tsx:1`
- **Styling**: CSS variables for theming and cn utility → `src/components/dashboard/revenue-trend-card.tsx:2`

## Verification Checklist

- [ ] User can view revenue trend chart on dashboard at /dashboard
- [ ] Chart displays 6 months of data with abbreviated month labels
- [ ] Only FISCALIZED, SENT, DELIVERED, and ACCEPTED invoices count toward revenue
- [ ] Percentage change indicator shows correct calculation between last two months
- [ ] Trend indicator icon changes (up/down) based on positive/negative change
- [ ] Latest month revenue displays in EUR with Croatian number formatting
- [ ] SVG chart renders correctly with gradient fill and polyline stroke
- [ ] Chart scales properly based on maximum value in dataset

## Evidence Links

1. `src/components/dashboard/revenue-trend-card.tsx:1-88` - Complete RevenueTrendCard component with SVG chart rendering
2. `src/app/(dashboard)/dashboard/page.tsx:29-32` - Revenue trend time window configuration (6 months)
3. `src/app/(dashboard)/dashboard/page.tsx:70-80` - Database query for revenue-qualifying invoices
4. `src/app/(dashboard)/dashboard/page.tsx:91-112` - Monthly bucketing and aggregation logic
5. `src/app/(dashboard)/dashboard/page.tsx:18` - Revenue status definition array
6. `prisma/schema.prisma:191-220` - EInvoice model with totalAmount and status fields
7. `prisma/schema.prisma:803-813` - EInvoiceStatus enum defining all possible statuses
