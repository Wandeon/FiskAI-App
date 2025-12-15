# Feature: VAT Threshold Report (F060)

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 12

## Purpose

The VAT Threshold Report monitors a company's annual revenue against the Croatian VAT registration threshold of 40,000 EUR. This feature helps small businesses and paušalni obrt (sole proprietors) track their progress toward the mandatory VAT threshold, providing real-time calculations, projections, and actionable alerts to ensure timely VAT registration compliance.

## User Entry Points

| Type     | Path                          | Evidence                                                |
| -------- | ----------------------------- | ------------------------------------------------------- |
| Page     | /reports/vat-threshold        | `src/app/(dashboard)/reports/vat-threshold/page.tsx:46` |
| API GET  | /api/reports/vat-threshold    | `src/app/api/reports/vat-threshold/route.ts:10`         |
| API POST | /api/reports/vat-threshold    | `src/app/api/reports/vat-threshold/route.ts:114`        |
| Function | calculateVatThresholdProgress | `src/lib/reports/kpr-generator.ts:256`                  |

## Core Flow

### Threshold Monitoring Flow

1. User navigates to /reports/vat-threshold → `src/app/(dashboard)/reports/vat-threshold/page.tsx:46`
2. System authenticates user and retrieves company context → `src/app/(dashboard)/reports/vat-threshold/page.tsx:47-48`
3. System sets tenant context for multi-tenancy → `src/app/(dashboard)/reports/vat-threshold/page.tsx:50-53`
4. System calculates VAT threshold progress for current year → `src/app/(dashboard)/reports/vat-threshold/page.tsx:57`
5. System queries database for monthly revenue breakdown → `src/app/(dashboard)/reports/vat-threshold/page.tsx:60-74`
6. System groups revenue by month (Siječanj through Prosinac) → `src/app/(dashboard)/reports/vat-threshold/page.tsx:76-100`
7. System calculates projections and remaining capacity → `src/app/(dashboard)/reports/vat-threshold/page.tsx:102-116`
8. System renders dashboard with metrics, progress bars, and recommendations → `src/app/(dashboard)/reports/vat-threshold/page.tsx:129-513`

### API Data Retrieval Flow

1. Client submits GET request to /api/reports/vat-threshold → `src/app/api/reports/vat-threshold/route.ts:10`
2. System authenticates user via requireAuth() → `src/app/api/reports/vat-threshold/route.ts:12`
3. System retrieves company context via requireCompany() → `src/app/api/reports/vat-threshold/route.ts:13`
4. System parses year parameter (defaults to current year) → `src/app/api/reports/vat-threshold/route.ts:15-17`
5. System calculates threshold data via calculateVatThresholdProgress() → `src/app/api/reports/vat-threshold/route.ts:20`
6. System aggregates monthly revenue breakdown from e-invoices → `src/app/api/reports/vat-threshold/route.ts:29-58`
7. System calculates projections and daily revenue needed → `src/app/api/reports/vat-threshold/route.ts:60-73`
8. System logs report generation event → `src/app/api/reports/vat-threshold/route.ts:93-99`
9. System returns JSON response with complete report data → `src/app/api/reports/vat-threshold/route.ts:101`

## Key Modules

| Module                        | Purpose                                          | Location                                             |
| ----------------------------- | ------------------------------------------------ | ---------------------------------------------------- |
| VatThresholdReportPage        | Main report UI with visualizations and metrics   | `src/app/(dashboard)/reports/vat-threshold/page.tsx` |
| VatThresholdAPI               | REST API for threshold data retrieval            | `src/app/api/reports/vat-threshold/route.ts`         |
| calculateVatThresholdProgress | Core calculation function for threshold tracking | `src/lib/reports/kpr-generator.ts:256`               |
| ProgressBar                   | Visual progress indicator component              | `src/components/ui/progress-bar.tsx:24`              |

## Threshold Calculation Logic

### Revenue Calculation

The system calculates annual revenue by summing OUTBOUND e-invoices with fiscalized statuses:

- **Invoice Query** → `src/lib/reports/kpr-generator.ts:270-284`
  - Filter: `companyId` (tenant isolation)
  - Filter: `issueDate` between January 1 and December 31 of target year
  - Filter: `status` in ["SENT", "DELIVERED", "PAID", "FISCALIZED"]
  - Filter: `direction` = "OUTBOUND" (only issued invoices count)
  - Aggregate: Sum of `totalAmount` field

- **Currency Handling** → `src/lib/reports/kpr-generator.ts:286-292`
  - All amounts assumed in EUR for threshold calculation
  - Note: Future enhancement needed for multi-currency conversion

### Threshold Status Classification

- **Threshold Value**: 40,000 EUR (Croatian VAT registration threshold) → `src/lib/reports/kpr-generator.ts:294`
- **Percentage Calculation**: `(annualRevenue / 40000) * 100` → `src/lib/reports/kpr-generator.ts:295`

**Status Categories:**

1. **EXCEEDED** → `src/lib/reports/kpr-generator.ts:298-299`
   - Percentage >= 100%
   - Revenue has exceeded 40,000 EUR
   - Mandatory VAT registration required

2. **WARNING** → `src/lib/reports/kpr-generator.ts:300-301`
   - Percentage >= 90%
   - Revenue between 36,000 EUR and 40,000 EUR
   - Business approaching threshold, planning recommended

3. **BELOW** → `src/lib/reports/kpr-generator.ts:296`
   - Percentage < 90%
   - Revenue below 36,000 EUR
   - Business safely under threshold

### Projection Calculations

- **Days Calculation** → `src/app/(dashboard)/reports/vat-threshold/page.tsx:103-106`
  - Days into year: `(currentDate - Jan 1) / (1000 * 60 * 60 * 24)`
  - Days left in year: `365 - daysIntoYear`

- **Projected Annual Revenue** → `src/app/(dashboard)/reports/vat-threshold/page.tsx:108-110`
  - Formula: `(currentRevenue / daysIntoYear) * 365`
  - Extrapolates current pace to full year

- **Remaining Until Threshold** → `src/app/(dashboard)/reports/vat-threshold/page.tsx:112`
  - Formula: `max(0, 40000 - annualRevenue)`
  - Amount of revenue capacity remaining

- **Daily Revenue Needed** → `src/app/(dashboard)/reports/vat-threshold/page.tsx:113-115`
  - Formula: `remainingUntilThreshold / daysLeftInYear`
  - Average daily revenue to reach threshold by year-end

## Dashboard Metrics

### 1. Current Annual Revenue (Trenutni prihod)

- **Display**: Large green text with EUR formatting → `src/app/(dashboard)/reports/vat-threshold/page.tsx:157-173`
- **Calculation**: Sum of all fiscalized OUTBOUND invoices for the year
- **Secondary Info**: Percentage of 40,000 EUR threshold
- **Icon**: Euro symbol (€)

### 2. VAT Threshold (Prag PDV-a)

- **Display**: Large blue text showing 40,000 EUR → `src/app/(dashboard)/reports/vat-threshold/page.tsx:175-191`
- **Static Value**: 40,000 EUR as per Croatian VAT law
- **Secondary Info**: "Prema Zakonu o PDV-u" (According to VAT Law)
- **Icon**: Scale/Balance icon

### 3. Remaining Until Threshold (Preostalo do praga)

- **Display**: Amber or green text with remaining amount → `src/app/(dashboard)/reports/vat-threshold/page.tsx:193-211`
- **Calculation**: `40,000 EUR - currentRevenue`
- **Color Logic**: Amber if positive, green if zero/negative
- **Secondary Info**: Days remaining in year
- **Icon**: Trending Up icon

### 4. Projected Annual Revenue (Projekcija)

- **Display**: Red (if exceeding) or purple text → `src/app/(dashboard)/reports/vat-threshold/page.tsx:213-231`
- **Calculation**: Extrapolated from current pace
- **Status Badge**: "PREKO PRAGA" (over threshold) or "ISPRAVNO" (correct)
- **Icon**: Target icon

### 5. Progress Visualization

- **Progress Bar** → `src/app/(dashboard)/reports/vat-threshold/page.tsx:234-261`
  - Width: Percentage of threshold (capped at 100%)
  - Height: 3-unit height (h-3 class)
  - Color: Gradient from blue to red as percentage increases
  - Labels: Current revenue on left, 40,000 EUR on right

- **Status Badge** → `src/app/(dashboard)/reports/vat-threshold/page.tsx:262-289`
  - EXCEEDED: Red destructive badge with XCircle icon
  - WARNING: Secondary amber badge with AlertTriangle icon
  - BELOW: Default green badge with CheckCircle icon

### 6. Monthly Revenue Breakdown (Mjesečni prikaz prihoda)

- **Display**: 12 rows (January-December) with progress bars → `src/app/(dashboard)/reports/vat-threshold/page.tsx:294-330`
- **Month Names**: Croatian names (Siječanj, Veljača, etc.) → `src/app/(dashboard)/reports/vat-threshold/page.tsx:78-81`
- **Per-Month Metrics**:
  - Month name
  - Revenue amount in EUR
  - Percentage of threshold (what % of 40k this single month represents)
  - Color-coded bar: Red if >100%, Amber if >85%, Blue otherwise → `src/app/(dashboard)/reports/vat-threshold/page.tsx:318-323`

## Recommendations and Alerts

### EXCEEDED Status Recommendations

- **Alert Type**: Red error box → `src/app/(dashboard)/reports/vat-threshold/page.tsx:346-358`
- **Icon**: XCircle
- **Message**: "Prekoračili ste prag od 40.000 €. Obvezni ste prijaviti PDV."
- **Translation**: "You have exceeded the 40,000 EUR threshold. You are required to register for VAT."
- **Action Button**: "Postavi PDV status" (Set VAT status) → links to /settings?tab=vat
- **Legal Context**: 5-day registration deadline mentioned → `src/app/(dashboard)/reports/vat-threshold/page.tsx:426`

### WARNING Status Recommendations

- **Alert Type**: Amber warning box → `src/app/(dashboard)/reports/vat-threshold/page.tsx:361-373`
- **Icon**: AlertTriangle
- **Message**: "Opasna zona" (Danger zone)
- **Details**: Shows projected annual revenue
- **Action Button**: "Planiraj promjene" (Plan changes) → links to /settings?tab=vat
- **Purpose**: Proactive warning before threshold breach

### BELOW Status Recommendations

- **Alert Type**: Green success box → `src/app/(dashboard)/reports/vat-threshold/page.tsx:376-388`
- **Icon**: CheckCircle
- **Message**: "Ispravan status" (Correct status)
- **Details**: "Ispod praga PDV-a. Trenutno ste izuzeći od obveze PDV-a."
- **Translation**: "Below VAT threshold. Currently exempt from VAT obligation."
- **Projection**: Shows estimated year-end revenue

### Business Insights Section

Four key insights provided → `src/app/(dashboard)/reports/vat-threshold/page.tsx:407-474`:

1. **PDV registracija** (VAT Registration) → `src/app/(dashboard)/reports/vat-threshold/page.tsx:419-428`
   - 5-day registration deadline after exceeding threshold
   - Linked to Croatian Tax Authority requirements

2. **Paušalni obrt status** → `src/app/(dashboard)/reports/vat-threshold/page.tsx:431-441`
   - Explains paušalni obrt VAT exemption up to 40,000 EUR
   - Relevant for sole proprietors

3. **Planiranje rasta** (Growth Planning) → `src/app/(dashboard)/reports/vat-threshold/page.tsx:443-453`
   - Strategic use of report for business planning
   - Proactive threshold management

4. **Revizija poslovanja** (Business Review) → `src/app/(dashboard)/reports/vat-threshold/page.tsx:455-465`
   - Consider business structure changes before threshold breach
   - Tax optimization considerations

## Export Options

Three export formats available → `src/app/(dashboard)/reports/vat-threshold/page.tsx:479-511`:

1. **PDF Report**
   - Endpoint: `/api/exports/vat-threshold?year=YYYY&format=pdf`
   - Use case: Archive, print, submit to accountant

2. **Excel Export**
   - Endpoint: `/api/exports/vat-threshold?year=YYYY&format=excel`
   - Use case: Further analysis, spreadsheet integration

3. **JSON Data**
   - Endpoint: `/api/exports/vat-threshold?year=YYYY&format=json`
   - Use case: API integration, custom reporting tools

## Integration Points

### Accountant Dashboard Integration

- **Display Location**: Accountant workspace → `src/app/(dashboard)/accountant/page.tsx:44`
- **Function Call**: `calculateVatThresholdProgress(company.id, currentYear)` → `src/app/(dashboard)/accountant/page.tsx:118`
- **Purpose**: Accountants can monitor client VAT threshold status
- **Error Handling**: Falls back to default values if calculation fails → `src/app/(dashboard)/accountant/page.tsx:118-123`

### Reports Dashboard

- **Entry Point**: Reports listing page at /reports
- **Link Display**: Not yet added to reports sidebar → `src/components/documents/reports-sidebar.tsx:9-15`
- **Future Enhancement**: Should be added to REPORTS array for easier access

### Company Settings

- **VAT Status Field**: `Company.isVatPayer` → `prisma/schema.prisma:80`
- **VAT Number Field**: `Company.vatNumber` → `prisma/schema.prisma:72`
- **Purpose**: Companies should update these fields when exceeding threshold
- **Settings Link**: Recommendations direct to /settings?tab=vat

## Data

### Database Schema

- **EInvoice Model** → Used for revenue calculation
  - `companyId`: String (tenant isolation)
  - `direction`: OUTBOUND/INBOUND enum
  - `status`: EInvoiceStatus enum
  - `totalAmount`: Decimal(10,2) (summed for threshold)
  - `issueDate`: DateTime (filtered by year)
  - `currency`: String (default EUR)

- **Company Model** → `prisma/schema.prisma:68-108`
  - `isVatPayer`: Boolean @default(false) - VAT registration status
  - `vatNumber`: String? - Official VAT registration number
  - `oib`: String @unique - Croatian tax ID
  - `country`: String @default("HR") - Must be Croatia for 40k EUR threshold

### TypeScript Interfaces

- **VatThresholdData** → `src/app/(dashboard)/reports/vat-threshold/page.tsx:29-44`

  ```typescript
  {
    annualRevenue: number
    vatThreshold: number // 40,000 EUR
    percentage: number
    status: "BELOW" | "WARNING" | "EXCEEDED"
    monthlyBreakdown: Array<{
      month: number
      monthName: string
      revenue: number
      percentageOfThreshold: number
    }>
    projectedAnnualRevenue: number
    remainingUntilThreshold: number
    daysLeftInYear: number
    estimatedDailyRevenueNeeded: number
  }
  ```

- **API Response** → `src/app/api/reports/vat-threshold/route.ts:75-91`
  - Includes company info (name, oib, isVatPayer)
  - All threshold calculations
  - Monthly breakdown array
  - Projection metrics

## Error Handling

### Calculation Errors

- **Function-Level Handling** → `src/lib/reports/kpr-generator.ts:319-327`
  - Logs error with context (companyId, year)
  - Re-throws error for upstream handling
  - Operation: "vat_threshold_calculated"

### API Errors

- **500 Internal Server Error** → `src/app/api/reports/vat-threshold/route.ts:103-109`
  - Logs error details
  - Returns generic error message to client
  - Message: "Failed to generate VAT threshold report"

- **Authentication Errors**
  - requireAuth() throws if user not authenticated
  - requireCompany() throws if company not found
  - Handled by Next.js error boundaries

## Logging

### Successful Calculation Log

- **Event**: "VAT threshold calculation completed" → `src/lib/reports/kpr-generator.ts:304-311`
- **Operation**: "vat_threshold_calculated"
- **Data Logged**:
  - companyId
  - year
  - annualRevenue
  - percentage
  - status (BELOW/WARNING/EXCEEDED)

### API Report Generation Log

- **Event**: "VAT threshold report generated successfully" → `src/app/api/reports/vat-threshold/route.ts:93-99`
- **Operation**: "vat_threshold_report_generated"
- **Data Logged**:
  - userId
  - companyId
  - year
  - annualRevenue

## Dependencies

- **Depends on**:
  - [[auth-login]] - User authentication required → `src/app/(dashboard)/reports/vat-threshold/page.tsx:47`
  - [[company-management]] - Company context required → `src/app/(dashboard)/reports/vat-threshold/page.tsx:48`
  - [[e-invoicing-create]] - E-invoices are data source for revenue → Revenue calculated from EInvoice table
  - **Pino Logger** - Structured logging → `src/app/api/reports/vat-threshold/route.ts:7`
  - **Prisma ORM** - Database queries → `src/app/api/reports/vat-threshold/route.ts:6`

- **Depended by**:
  - [[accountant-dashboard]] - Displays threshold progress → `src/app/(dashboard)/accountant/page.tsx:118`
  - **Compliance Monitoring** - VAT registration compliance tracking
  - **Business Planning** - Strategic revenue planning and tax optimization

## Croatian Tax Compliance Context

### VAT Registration Threshold

- **Amount**: 40,000 EUR annually
- **Legal Basis**: Croatian VAT Act (Zakon o PDV-u)
- **Applicability**: All businesses operating in Croatia
- **Exemption**: Paušalni obrt (sole proprietors) below threshold

### Registration Requirements

- **Deadline**: 5 days after exceeding threshold → `src/app/(dashboard)/reports/vat-threshold/page.tsx:426`
- **Authority**: Croatian Tax Administration (Porezna uprava)
- **Consequence**: Mandatory VAT collection and reporting
- **Grace Period**: None - immediate obligation upon threshold breach

### Special Cases

- **Paušalni Obrt**: Simplified tax regime for sole proprietors → `src/app/(dashboard)/reports/vat-threshold/page.tsx:437-439`
  - VAT exempt up to 40,000 EUR
  - Must register if threshold exceeded
  - Often transition to d.o.o. (LLC) instead

## Verification Checklist

- [ ] User can access VAT threshold report at /reports/vat-threshold
- [ ] System authenticates user and enforces tenant isolation
- [ ] Annual revenue correctly sums OUTBOUND fiscalized invoices
- [ ] Threshold percentage calculated as (revenue / 40000) \* 100
- [ ] Status correctly categorized: BELOW (<90%), WARNING (90-99%), EXCEEDED (≥100%)
- [ ] Monthly breakdown shows all 12 months with Croatian names
- [ ] Each month calculates revenue and percentage correctly
- [ ] Progress bar width matches percentage (capped at 100%)
- [ ] Progress bar color changes: blue → amber (85%) → red (100%)
- [ ] Projected annual revenue extrapolates current pace
- [ ] Remaining capacity calculated as 40000 - currentRevenue
- [ ] Daily revenue needed calculated for remaining days
- [ ] EXCEEDED status shows red alert with registration warning
- [ ] WARNING status shows amber alert with projection
- [ ] BELOW status shows green success message
- [ ] Recommendations section displays appropriate advice
- [ ] Business insights provide Croatian tax context
- [ ] Export buttons link to correct endpoints with year parameter
- [ ] API endpoint returns complete JSON with company info
- [ ] Logging captures calculation and report generation events
- [ ] Accountant dashboard displays threshold progress card
- [ ] Error handling gracefully manages calculation failures

## Evidence Links

1. VAT threshold page component → `src/app/(dashboard)/reports/vat-threshold/page.tsx:46`
2. API GET endpoint for threshold data → `src/app/api/reports/vat-threshold/route.ts:10`
3. Core calculation function → `src/lib/reports/kpr-generator.ts:256-327`
4. Threshold status classification logic → `src/lib/reports/kpr-generator.ts:296-302`
5. Revenue query with fiscalized status filter → `src/lib/reports/kpr-generator.ts:270-284`
6. Monthly breakdown aggregation → `src/app/(dashboard)/reports/vat-threshold/page.tsx:60-100`
7. Projection calculations → `src/app/(dashboard)/reports/vat-threshold/page.tsx:102-127`
8. Progress bar visualization → `src/app/(dashboard)/reports/vat-threshold/page.tsx:234-261`
9. Status-based recommendations → `src/app/(dashboard)/reports/vat-threshold/page.tsx:333-405`
10. Business insights section → `src/app/(dashboard)/reports/vat-threshold/page.tsx:407-474`
11. Accountant dashboard integration → `src/app/(dashboard)/accountant/page.tsx:118-123`
12. Company schema with VAT fields → `prisma/schema.prisma:68-108`
