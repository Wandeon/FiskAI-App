# Feature: Invoice Funnel

## Status

- Documentation: Complete
- Last verified: 2025-12-15
- Evidence count: 8

## Purpose

Visualizes the invoice lifecycle progression from draft to accepted, helping users understand invoice conversion rates and identify bottlenecks in their invoicing process. Shows where invoices get stuck and calculates overall conversion rate from draft to accepted.

## User Entry Points

| Type      | Path       | Evidence                                     |
| --------- | ---------- | -------------------------------------------- |
| Dashboard | /dashboard | `src/app/(dashboard)/dashboard/page.tsx:263` |

## Core Flow

1. Dashboard loads and fetches invoice status counts -> `src/app/(dashboard)/dashboard/page.tsx:81-86`
2. System groups invoices by status using Prisma groupBy -> `src/app/(dashboard)/dashboard/page.tsx:81-86`
3. Status buckets are transformed into funnel stages -> `src/app/(dashboard)/dashboard/page.tsx:169-174`
4. InvoiceFunnelCard component renders visualization -> `src/components/dashboard/invoice-funnel-card.tsx:12-62`
5. Component calculates conversion rate (accepted/total) -> `src/components/dashboard/invoice-funnel-card.tsx:13-15`
6. Each stage displays as a horizontal bar proportional to count -> `src/components/dashboard/invoice-funnel-card.tsx:32-50`
7. Total and accepted counts shown in summary footer -> `src/components/dashboard/invoice-funnel-card.tsx:53-59`

## Funnel Stages

The funnel tracks four key stages in the invoice lifecycle:

### Stage 1: Nacrti (Drafts)

- **Status**: DRAFT
- **Description**: Invoices created but not yet fiscalized or sent
- **Data source**: `statusCount("DRAFT")` -> `src/app/(dashboard)/dashboard/page.tsx:170`
- **User action needed**: Finalize and fiscalize the invoice

### Stage 2: Slanje (Sending)

- **Statuses**: SENT + PENDING_FISCALIZATION
- **Description**: Invoices in the process of being sent or awaiting fiscalization
- **Data source**: `statusCount("SENT") + statusCount("PENDING_FISCALIZATION")` -> `src/app/(dashboard)/dashboard/page.tsx:171`
- **User action needed**: Wait for fiscalization or buyer receipt

### Stage 3: Dostavljeno (Delivered)

- **Status**: DELIVERED
- **Description**: Invoices successfully delivered to buyer
- **Data source**: `statusCount("DELIVERED")` -> `src/app/(dashboard)/dashboard/page.tsx:172`
- **User action needed**: Wait for buyer acceptance

### Stage 4: Prihvaćeno (Accepted)

- **Status**: ACCEPTED
- **Description**: Invoices accepted by buyer - final successful state
- **Data source**: `statusCount("ACCEPTED")` -> `src/app/(dashboard)/dashboard/page.tsx:173`
- **User action needed**: None - invoice successfully processed

## Key Modules

| Module            | Purpose                                     | Location                                           |
| ----------------- | ------------------------------------------- | -------------------------------------------------- |
| InvoiceFunnelCard | Visual funnel component with bars and stats | `src/components/dashboard/invoice-funnel-card.tsx` |
| DashboardPage     | Fetches and aggregates invoice status data  | `src/app/(dashboard)/dashboard/page.tsx`           |
| statusBuckets     | Grouped invoice counts by status            | `src/app/(dashboard)/dashboard/page.tsx:81-86`     |
| funnelStages      | Transformed data for funnel visualization   | `src/app/(dashboard)/dashboard/page.tsx:169-174`   |

## Data Calculation

### Conversion Rate Calculation

```typescript
const total = stages.reduce((sum, stage) => sum + stage.value, 0)
const accepted = stages[stages.length - 1]?.value ?? 0
const conversionRate = total > 0 ? (accepted / total) * 100 : 0
```

Location: `src/components/dashboard/invoice-funnel-card.tsx:13-15`

### Bar Width Calculation

Each stage's bar width is proportional to the maximum value across all stages:

```typescript
const maxValue = Math.max(...stages.map((stage) => stage.value), 0)
const baseWidth = maxValue > 0 ? (stage.value / maxValue) * 100 : 0
const width = stage.value === 0 ? 0 : Math.max(baseWidth, 6)
```

Location: `src/components/dashboard/invoice-funnel-card.tsx:16,33-34`

Minimum width of 6% ensures visibility for non-zero values.

### Status Aggregation Query

```typescript
db.eInvoice.groupBy({
  by: ["status"],
  where: { companyId: company.id },
  _count: { id: true },
  _sum: { vatAmount: true },
})
```

Location: `src/app/(dashboard)/dashboard/page.tsx:81-86`

## Data

### Database Tables

- **EInvoice**: Main invoice records -> `prisma/schema.prisma:191-259`
  - Key fields: id, companyId, status, totalAmount, createdAt
  - Status field determines funnel stage -> `prisma/schema.prisma:205`

### Invoice Statuses

Complete status enumeration -> `prisma/schema.prisma:803-813`:

- DRAFT - Initial creation state
- PENDING_FISCALIZATION - Queued for fiscal processing
- FISCALIZED - Tax authority approved
- SENT - Transmitted to buyer
- DELIVERED - Confirmed received by buyer
- ACCEPTED - Buyer accepted the invoice
- REJECTED - Buyer rejected the invoice
- ARCHIVED - Moved to archive
- ERROR - Processing error occurred

## Visual Design

### Gradient Bar Styling

- **Colors**: Brand gradient from brand-500 to purple-500
- **Implementation**: `bg-gradient-to-r from-brand-500 via-indigo-500 to-purple-500`
- **Location**: `src/components/dashboard/invoice-funnel-card.tsx:40`

### Conversion Rate Badge

- **Display**: Percentage with "% prolaznost" label
- **Styling**: Brand colors with rounded pill design
- **Location**: `src/components/dashboard/invoice-funnel-card.tsx:26-28`

### Stage Display

Each stage shows:

1. Stage label (left-aligned, fixed width 24)
2. Horizontal progress bar (flex-1, gradient colored)
3. Count value with arrow indicator (right-aligned)

Location: `src/components/dashboard/invoice-funnel-card.tsx:36-48`

## Dependencies

- **Depends on**: None (standalone dashboard widget)
- **Depended by**: Dashboard Overview (displays the funnel)

## Integrations

- **Prisma ORM**: For database queries -> `src/lib/db.ts`
- **Lucide Icons**: ArrowRight icon for stage transitions -> `src/components/dashboard/invoice-funnel-card.tsx:1`

## Verification Checklist

- [ ] User can view funnel on dashboard after login
- [ ] Conversion rate displays correctly as percentage
- [ ] All four stages are visible with correct labels
- [ ] Bar widths are proportional to invoice counts
- [ ] Total invoice count matches sum of all stages
- [ ] Accepted count shown in summary footer
- [ ] Empty states (0 invoices) display without errors
- [ ] Stage arrows appear between all non-final stages

## Evidence Links

1. `src/components/dashboard/invoice-funnel-card.tsx:1-62` - Main funnel component with visualization logic
2. `src/app/(dashboard)/dashboard/page.tsx:81-86` - Status aggregation query
3. `src/app/(dashboard)/dashboard/page.tsx:169-174` - Funnel stages data transformation
4. `src/app/(dashboard)/dashboard/page.tsx:263` - Component rendering in dashboard
5. `prisma/schema.prisma:191-259` - EInvoice model definition
6. `prisma/schema.prisma:803-813` - EInvoiceStatus enum definition
7. `src/app/(dashboard)/dashboard/page.tsx:167` - statusCount helper function
8. `src/components/dashboard/invoice-funnel-card.tsx:13-16` - Conversion rate and max value calculations
