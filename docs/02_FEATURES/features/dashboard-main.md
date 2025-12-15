# Feature: Main Dashboard

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 18

## Purpose

The Main Dashboard serves as the primary landing page for authenticated users, providing an at-a-glance overview of business health, e-invoice status, revenue trends, VAT obligations, and actionable insights to guide users through their invoicing workflow.

## User Entry Points

| Type   | Path         | Evidence                                   |
| ------ | ------------ | ------------------------------------------ |
| Page   | /dashboard   | `src/app/(dashboard)/dashboard/page.tsx:1` |
| Layout | /(dashboard) | `src/app/(dashboard)/layout.tsx:10`        |

## Core Flow

1. User authenticates and accesses /dashboard → `src/app/(dashboard)/dashboard/page.tsx:20-26`
2. System validates authentication with requireAuth() → `src/lib/auth-utils.ts:12-18`
3. System retrieves current company via getCurrentCompany() → `src/lib/auth-utils.ts:20-35`
4. System redirects to onboarding if no company exists → `src/app/(dashboard)/dashboard/page.tsx:24-26`
5. System fetches dashboard data in parallel (8 concurrent queries) → `src/app/(dashboard)/dashboard/page.tsx:34-87`
6. System calculates revenue trends, VAT totals, and funnel metrics → `src/app/(dashboard)/dashboard/page.tsx:91-174`
7. System renders dashboard with 12+ distinct cards/widgets → `src/app/(dashboard)/dashboard/page.tsx:237-274`

## Key Modules

| Module              | Purpose                                       | Location                                            |
| ------------------- | --------------------------------------------- | --------------------------------------------------- |
| DashboardPage       | Main dashboard server component               | `src/app/(dashboard)/dashboard/page.tsx`            |
| HeroBanner          | Welcome banner with quick actions             | `src/components/dashboard/hero-banner.tsx`          |
| TodayActionsCard    | Alerts, stats, and onboarding tasks           | `src/components/dashboard/today-actions-card.tsx`   |
| RevenueTrendCard    | 6-month revenue line chart                    | `src/components/dashboard/revenue-trend-card.tsx`   |
| FiscalizationStatus | E-invoice provider configuration status       | `src/components/dashboard/fiscalization-status.tsx` |
| VatOverviewCard     | VAT paid vs pending with progress bar         | `src/components/dashboard/vat-overview-card.tsx`    |
| InvoiceFunnelCard   | Invoice status funnel visualization           | `src/components/dashboard/invoice-funnel-card.tsx`  |
| InsightsCard        | AI-driven recommendations based on data       | `src/components/dashboard/insights-card.tsx`        |
| RecentActivity      | Last 5 e-invoices                             | `src/components/dashboard/recent-activity.tsx`      |
| ActionCards         | Quick links to Assistant and Accountant views | `src/components/dashboard/action-cards.tsx`         |

## Dashboard Layout

The dashboard uses a responsive 2-column grid layout → `src/app/(dashboard)/dashboard/page.tsx:237-274`

### Left Column (Main Content)

1. **Hero Banner** → `src/app/(dashboard)/dashboard/page.tsx:241-247`
   - Personalized greeting with user's first name → `src/app/(dashboard)/dashboard/page.tsx:153`
   - Company name and contact count display → `src/components/dashboard/hero-banner.tsx:42`
   - Quick action cards: Create e-invoice, Draft count, Provider status → `src/components/dashboard/hero-banner.tsx:46-93`
   - CTA buttons for Assistant and email invitations → `src/components/dashboard/hero-banner.tsx:95-115`

2. **Today Actions Card** → `src/app/(dashboard)/dashboard/page.tsx:248`
   - Critical alerts (missing provider, pending drafts) → `src/app/(dashboard)/dashboard/page.tsx:176-197`
   - 4 stat highlights: Revenue, E-invoices, Contacts, Products → `src/app/(dashboard)/dashboard/page.tsx:199-226`
   - Onboarding task checklist (filtered to incomplete tasks) → `src/app/(dashboard)/dashboard/page.tsx:228-235`

3. **Revenue Trend Card** → `src/app/(dashboard)/dashboard/page.tsx:249`
   - 6-month revenue chart with SVG polyline visualization → `src/components/dashboard/revenue-trend-card.tsx:54-77`
   - Month-over-month percentage change indicator → `src/components/dashboard/revenue-trend-card.tsx:19`
   - Only counts FISCALIZED, SENT, DELIVERED, ACCEPTED invoices → `src/app/(dashboard)/dashboard/page.tsx:18`

### Right Column (Sidebar Widgets)

1. **Fiscalization Status** → `src/app/(dashboard)/dashboard/page.tsx:252-257`
   - E-invoice provider connection status → `src/components/dashboard/fiscalization-status.tsx:42-50`
   - Company OIB and VAT number display → `src/components/dashboard/fiscalization-status.tsx:53-69`
   - Link to settings for configuration → `src/components/dashboard/fiscalization-status.tsx:28-34`

2. **VAT Overview Card** → `src/app/(dashboard)/dashboard/page.tsx:258-262`
   - VAT paid (FISCALIZED, DELIVERED, ACCEPTED) → `src/app/(dashboard)/dashboard/page.tsx:164`
   - VAT pending (PENDING_FISCALIZATION, SENT) → `src/app/(dashboard)/dashboard/page.tsx:165`
   - Progress bar visualization → `src/components/dashboard/vat-overview-card.tsx:64-69`
   - Non-VAT payer warning → `src/components/dashboard/vat-overview-card.tsx:39-44`

3. **Invoice Funnel Card** → `src/app/(dashboard)/dashboard/page.tsx:263`
   - 4 funnel stages: Drafts, Sending, Delivered, Accepted → `src/app/(dashboard)/dashboard/page.tsx:169-174`
   - Conversion rate calculation → `src/components/dashboard/invoice-funnel-card.tsx:15`
   - Horizontal bar visualization → `src/components/dashboard/invoice-funnel-card.tsx:31-51`

4. **Insights Card** → `src/app/(dashboard)/dashboard/page.tsx:264-269`
   - Context-aware recommendations based on company data → `src/components/dashboard/insights-card.tsx:18-48`
   - Dynamic messages for VAT payers vs non-payers → `src/components/dashboard/insights-card.tsx:20-24`
   - Conditional insights based on contact/product counts → `src/components/dashboard/insights-card.tsx:27-40`

5. **Recent Activity** → `src/app/(dashboard)/dashboard/page.tsx:270`
   - Last 5 e-invoices with status badges → `src/app/(dashboard)/dashboard/page.tsx:50-62`
   - Buyer name, amount, and creation date → `src/components/dashboard/recent-activity.tsx:70-91`
   - Empty state with "New e-invoice" CTA → `src/components/dashboard/recent-activity.tsx:50-60`

6. **Action Cards** → `src/app/(dashboard)/dashboard/page.tsx:271`
   - FiskAI Assistant launcher → `src/components/dashboard/action-cards.tsx:10-26`
   - Accountant Workspace link → `src/components/dashboard/action-cards.tsx:28-44`

## Data

### Database Tables

- **Company** → `prisma/schema.prisma:68`
  - Fields: name, oib, vatNumber, isVatPayer, eInvoiceProvider → `prisma/schema.prisma:70-81`
  - Queried via getCurrentCompany() → `src/app/(dashboard)/dashboard/page.tsx:22`

- **EInvoice** → `prisma/schema.prisma:191`
  - Fields: invoiceNumber, totalAmount, vatAmount, status, createdAt → `prisma/schema.prisma:192-218`
  - 5 aggregate queries: count, drafts, recent, revenue, trend, status buckets → `src/app/(dashboard)/dashboard/page.tsx:34-87`

- **Contact** → `prisma/schema.prisma:148`
  - Count query for onboarding checklist → `src/app/(dashboard)/dashboard/page.tsx:45`
  - Displayed in hero banner → `src/components/dashboard/hero-banner.tsx:42`

- **Product** → `prisma/schema.prisma:173`
  - Count query for onboarding checklist → `src/app/(dashboard)/dashboard/page.tsx:46`
  - Used in insights recommendations → `src/components/dashboard/insights-card.tsx:35-40`

### Data Fetching Strategy

- 8 parallel Promise.all queries for optimal performance → `src/app/(dashboard)/dashboard/page.tsx:34-87`
- Server-side rendering with async components (no client-side loading state)
- 6-month revenue trend window → `src/app/(dashboard)/dashboard/page.tsx:29`
- Revenue filtered to 4 specific statuses: FISCALIZED, SENT, DELIVERED, ACCEPTED → `src/app/(dashboard)/dashboard/page.tsx:18`

## Onboarding Integration

The dashboard includes a 5-step onboarding checklist → `src/app/(dashboard)/dashboard/page.tsx:115-151`

1. **Company Data** - OIB and address → `src/app/(dashboard)/dashboard/page.tsx:121`
2. **Provider Configuration** - E-invoice provider setup → `src/app/(dashboard)/dashboard/page.tsx:128`
3. **First Contact** - Add customer or supplier → `src/app/(dashboard)/dashboard/page.tsx:135`
4. **First Product** - Add product/service → `src/app/(dashboard)/dashboard/page.tsx:142`
5. **First E-Invoice** - Create and fiscalize invoice → `src/app/(dashboard)/dashboard/page.tsx:149`

Incomplete tasks are displayed in Today Actions Card → `src/app/(dashboard)/dashboard/page.tsx:228-235`

## Dependencies

- **Depends on**:
  - [[auth-login]] - User must be authenticated → `src/app/(dashboard)/layout.tsx:15-19`
  - [[company-management]] - Company must exist or redirect to onboarding → `src/app/(dashboard)/dashboard/page.tsx:24-26`

- **Depended by**:
  - All dashboard-protected routes use the same layout → `src/app/(dashboard)/layout.tsx:1`
  - Quick action links navigate to e-invoices, contacts, products, settings

## Integrations

None - This is a pure data visualization feature with no external API integrations.

## Verification Checklist

- [x] Authenticated user can access /dashboard
- [x] Dashboard displays personalized greeting with first name
- [x] Revenue trend chart shows last 6 months of data
- [x] VAT overview correctly calculates paid vs pending
- [x] Invoice funnel shows all 4 stages (Draft, Sending, Delivered, Accepted)
- [x] Recent activity displays last 5 invoices with correct status badges
- [x] Onboarding checklist only shows incomplete tasks
- [x] Hero banner displays correct draft count
- [x] Fiscalization status shows provider configuration state
- [x] Insights card provides context-aware recommendations
- [x] Action cards link to Assistant and Accountant workspaces
- [x] Non-company users are redirected to /onboarding
- [x] Mobile responsive with proper layout adjustments

## Evidence Links

1. `src/app/(dashboard)/dashboard/page.tsx:1-276` - Main dashboard page component
2. `src/app/(dashboard)/layout.tsx:10-63` - Dashboard layout with auth guard
3. `src/components/dashboard/hero-banner.tsx:16-119` - Hero banner with personalization
4. `src/components/dashboard/revenue-trend-card.tsx:14-88` - Revenue trend visualization
5. `src/components/dashboard/today-actions-card.tsx:34-127` - Today actions with alerts/stats
6. `src/components/dashboard/fiscalization-status.tsx:14-75` - Provider status widget
7. `src/components/dashboard/vat-overview-card.tsx:13-79` - VAT calculations and display
8. `src/components/dashboard/invoice-funnel-card.tsx:12-62` - Funnel visualization
9. `src/components/dashboard/insights-card.tsx:17-79` - AI-driven recommendations
10. `src/components/dashboard/recent-activity.tsx:33-99` - Recent invoices list
11. `src/components/dashboard/action-cards.tsx:7-47` - Quick action launchers
12. `src/lib/auth-utils.ts:12-35` - Authentication utilities
13. `prisma/schema.prisma:68-92` - Company model
14. `prisma/schema.prisma:148-163` - Contact model
15. `prisma/schema.prisma:173-188` - Product model
16. `prisma/schema.prisma:191-260` - EInvoice model
17. `docs/_meta/inventory/routes.json:162-164` - Dashboard route registration
18. `src/app/(dashboard)/dashboard/page.tsx:34-87` - Parallel data fetching queries
