# Feature: VAT Overview

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 8

## Purpose

Provides VAT taxpayers with a real-time overview of their VAT obligations, displaying paid and pending VAT amounts calculated from e-invoice statuses. The card helps users track VAT payment progress and ensures they understand which invoice statuses contribute to their VAT obligations.

## User Entry Points

| Type | Path       | Evidence                                     |
| ---- | ---------- | -------------------------------------------- |
| Page | /dashboard | `src/app/(dashboard)/dashboard/page.tsx:237` |

## Core Flow

1. Dashboard page loads and fetches company data including `isVatPayer` status → `src/app/(dashboard)/dashboard/page.tsx:22`
2. System queries database to group e-invoices by status and sum VAT amounts → `src/app/(dashboard)/dashboard/page.tsx:81-87`
3. VAT amounts are calculated by summing specific status buckets → `src/app/(dashboard)/dashboard/page.tsx:158-165`
4. VatOverviewCard component renders with paid/pending VAT and taxpayer status → `src/app/(dashboard)/dashboard/page.tsx:258-262`
5. Component displays metrics, progress bar, and status badge → `src/components/dashboard/vat-overview-card.tsx:18-78`

## Key Modules

| Module          | Purpose                                                         | Location                                         |
| --------------- | --------------------------------------------------------------- | ------------------------------------------------ |
| VatOverviewCard | Renders VAT overview UI with paid/pending amounts and progress  | `src/components/dashboard/vat-overview-card.tsx` |
| Dashboard Page  | Calculates VAT metrics from invoice statuses and passes to card | `src/app/(dashboard)/dashboard/page.tsx`         |

## Data

- **Tables**: `Company` → `prisma/schema.prisma:80`, `EInvoice` → `prisma/schema.prisma:203`
- **Key fields**:
  - `Company.isVatPayer` (Boolean): Determines if company is registered VAT taxpayer
  - `Company.vatNumber` (String): Official VAT registration number
  - `EInvoice.vatAmount` (Decimal): VAT amount per invoice
  - `EInvoice.status` (EInvoiceStatus enum): Invoice status determining VAT category

## VAT Metrics Displayed

### 1. VAT Taxpayer Status Badge

- **Source**: `Company.isVatPayer` field → `src/components/dashboard/vat-overview-card.tsx:7`
- **Display**: Green badge "PDV obveznik" if true, amber badge "Niste PDV obveznik" if false → `src/components/dashboard/vat-overview-card.tsx:28-36`
- **Purpose**: Visual indicator of company's VAT registration status

### 2. Paid VAT (PDV plaćen)

- **Calculation**: Sum of `vatAmount` from invoices with statuses: FISCALIZED, DELIVERED, ACCEPTED → `src/app/(dashboard)/dashboard/page.tsx:164`
- **Logic**: `sumVatForStatuses(["FISCALIZED", "DELIVERED", "ACCEPTED"])` → `src/app/(dashboard)/dashboard/page.tsx:158-162`
- **Display**: Shows amount in EUR with Croatian locale formatting and percentage of total → `src/components/dashboard/vat-overview-card.tsx:47-51`
- **Rationale**: These statuses represent completed/accepted transactions where VAT obligation is finalized

### 3. Pending VAT (PDV u tijeku)

- **Calculation**: Sum of `vatAmount` from invoices with statuses: PENDING_FISCALIZATION, SENT → `src/app/(dashboard)/dashboard/page.tsx:165`
- **Logic**: `sumVatForStatuses(["PENDING_FISCALIZATION", "SENT"])` → `src/app/(dashboard)/dashboard/page.tsx:165`
- **Display**: Shows amount in EUR with percentage of total → `src/components/dashboard/vat-overview-card.tsx:52-56`
- **Rationale**: These statuses represent invoices in transit where VAT is not yet finalized

### 4. Total VAT and Progress Bar

- **Calculation**: `paidVat + pendingVat` → `src/components/dashboard/vat-overview-card.tsx:14`
- **Percentage Calculations**:
  - Paid percentage: `(paidVat / total) * 100` capped at 100% → `src/components/dashboard/vat-overview-card.tsx:15`
  - Pending percentage: `(pendingVat / total) * 100` capped at 100% → `src/components/dashboard/vat-overview-card.tsx:16`
- **Visual Progress**: Gradient bar showing paid percentage width → `src/components/dashboard/vat-overview-card.tsx:64-69`
- **Display**: Total amount shown above progress bar → `src/components/dashboard/vat-overview-card.tsx:60-63`

### 5. Contextual Alerts

- **Non-taxpayer Warning**: Shown when `isVatPayer` is false, prompts user to verify VAT status → `src/components/dashboard/vat-overview-card.tsx:39-44`
- **Status Explanation**: Info box explaining which statuses count as paid vs pending → `src/components/dashboard/vat-overview-card.tsx:70-75`

## Calculation Logic

The VAT overview uses a status-based aggregation approach:

1. **Database Aggregation**: Groups all company e-invoices by status and sums VAT amounts → `src/app/(dashboard)/dashboard/page.tsx:81-87`

   ```typescript
   db.eInvoice.groupBy({
     by: ["status"],
     where: { companyId: company.id },
     _count: { id: true },
     _sum: { vatAmount: true },
   })
   ```

2. **Status Categorization**:
   - **Paid**: FISCALIZED (fiskalizirani), DELIVERED (dostavljeni), ACCEPTED (prihvaćeni) represent finalized transactions
   - **Pending**: PENDING_FISCALIZATION (na fiskalizaciji), SENT (poslani) represent in-progress transactions
   - **Excluded**: DRAFT, REJECTED, ARCHIVED, ERROR are not included in VAT calculations

3. **Formatting**: All amounts use Croatian locale (`hr-HR`) with 2 decimal places → `src/components/dashboard/vat-overview-card.tsx:10-11`

## Dependencies

- **Depends on**: [[auth-session]] (requires authenticated user), Company Management (requires company setup)
- **Depended by**: Dashboard Overview, [[reporting-posd]] (uses similar VAT aggregation logic)

## Integrations

- **Prisma ORM**: Database queries for invoice status aggregation → `src/app/(dashboard)/dashboard/page.tsx:81-87`
- **Croatian Locale**: Number formatting with `toLocaleString("hr-HR")` → `src/components/dashboard/vat-overview-card.tsx:11`
- **Lucide Icons**: BadgePercent, ShieldAlert, ShieldCheck icons → `src/components/dashboard/vat-overview-card.tsx:1`

## Related Features

This VAT calculation logic is also used in:

- **POSD Report Generator**: Calculates total VAT collected, paid, and due for reporting → `src/lib/reports/posd-generator.ts:199-220`
- The POSD report uses a similar but extended calculation that includes both sales (collected) and expense (paid) VAT

## Verification Checklist

- [ ] Non-VAT taxpayer sees amber badge and warning message
- [ ] VAT taxpayer sees green badge without warning
- [ ] Paid VAT correctly sums FISCALIZED, DELIVERED, ACCEPTED invoices
- [ ] Pending VAT correctly sums PENDING_FISCALIZATION, SENT invoices
- [ ] Progress bar width matches paid percentage calculation
- [ ] Total amount equals paid + pending VAT
- [ ] All amounts display in Croatian format with 2 decimals and € symbol
- [ ] Percentage calculations handle zero total without errors
- [ ] Status explanation box clearly describes which statuses count where

## Evidence Links

1. `src/components/dashboard/vat-overview-card.tsx:1-80` - Complete VAT overview card component with UI rendering
2. `src/app/(dashboard)/dashboard/page.tsx:81-87` - Database query grouping invoices by status and summing VAT
3. `src/app/(dashboard)/dashboard/page.tsx:158-165` - VAT calculation logic using status categorization
4. `src/app/(dashboard)/dashboard/page.tsx:258-262` - VatOverviewCard instantiation with calculated props
5. `prisma/schema.prisma:80` - Company.isVatPayer field definition
6. `prisma/schema.prisma:203` - EInvoice.vatAmount field definition
7. `prisma/schema.prisma:803-813` - EInvoiceStatus enum defining all possible invoice states
8. `src/lib/reports/posd-generator.ts:199-220` - Related VAT calculation logic for POSD reporting
