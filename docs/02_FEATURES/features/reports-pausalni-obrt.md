# Feature: Pausalni Obrt Report (F061)

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 11

## Purpose

The Pausalni Obrt Report provides specialized reporting and data export capabilities tailored for Croatian flat-rate sole proprietorships (paušalni obrtnici). It offers comprehensive income tracking, VAT threshold monitoring, expense categorization, and accountant-ready data exports (including KPR - Knjiga Prometa) specifically designed to meet Croatian tax compliance requirements for flat-rate businesses operating under the simplified paušalno oporezivanje tax regime.

## User Entry Points

| Type     | Path                          | Evidence                                                |
| -------- | ----------------------------- | ------------------------------------------------------- |
| UI Page  | /reports/pausalni-obrt        | `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:33` |
| UI Page  | /reports/export               | `src/app/(dashboard)/reports/export/page.tsx:6`         |
| API GET  | /api/exports/season-pack      | `src/app/api/exports/season-pack/route.ts:25`           |
| API GET  | /api/reports/vat-threshold    | `src/app/api/reports/vat-threshold/route.ts:10`         |
| Function | generateKPRReport             | `src/lib/reports/kpr-generator.ts:51`                   |
| Function | calculateVatThresholdProgress | `src/lib/reports/kpr-generator.ts:256`                  |
| Function | fetchAccountantExportData     | `src/lib/reports/accountant-export.ts:72`               |

## Core Flow

### Viewing Pausalni Obrt Dashboard

1. User navigates to /reports/pausalni-obrt → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:33`
2. System authenticates user via requireAuth() → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:34`
3. System validates company context via requireCompany() → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:35`
4. System queries annual metrics in parallel (5 queries) → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:38-168`
   - Monthly totals for current year (OUTBOUND invoices) → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:46-60`
   - Annual summary aggregation → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:63-81`
   - Tax season pack metadata → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:85-130`
   - Expense breakdown by category → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:133-150`
   - Income breakdown by month → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:153-168`
5. System groups monthly data by month (Jan-Dec) → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:171-188`
6. System displays key metric cards (income, expenses, net profit, VAT obligation) → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:203-279`
7. System shows monthly income chart visualization → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:282-308`
8. System presents accountant export packages → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:312-379`
9. System displays VAT threshold progress tracking (40,000 EUR) → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:451-487`

### Generating Tax Season Pack Export

1. User clicks export link with period/type parameters → Links to `/api/exports/season-pack`
2. System authenticates request → `src/app/api/exports/season-pack/route.ts:27-28`
3. System validates and parses query parameters (from/to dates) → `src/app/api/exports/season-pack/route.ts:30-51`
4. System fetches comprehensive export data → `src/app/api/exports/season-pack/route.ts:54`
5. System calls fetchAccountantExportData() → `src/lib/reports/accountant-export.ts:72`
   - Retrieves company details (name, OIB, VAT number) → `src/lib/reports/accountant-export.ts:78-89`
   - Fetches all invoices with date filter → `src/lib/reports/accountant-export.ts:117-128`
   - Fetches all expenses with date filter → `src/lib/reports/accountant-export.ts:148-158`
   - Fetches KPR data (paid invoices only) → `src/lib/reports/accountant-export.ts:187-196`
   - Calculates totals (income, expenses, net profit) → `src/lib/reports/accountant-export.ts:208-217`
6. System creates ZIP archive using archiver → `src/app/api/exports/season-pack/route.ts:63-65`
7. System appends CSV files to archive:
   - 00-SAZETAK.csv (summary) → `src/app/api/exports/season-pack/route.ts:79`
   - 01-RACUNI.csv (invoices) → `src/app/api/exports/season-pack/route.ts:80`
   - 02-TROSKOVI.csv (expenses) → `src/app/api/exports/season-pack/route.ts:81`
   - 03-KPR.csv (paid invoices only) → `src/app/api/exports/season-pack/route.ts:82`
8. System appends README with instructions → `src/app/api/exports/season-pack/route.ts:85-86`
9. System finalizes archive and returns ZIP → `src/app/api/exports/season-pack/route.ts:89-109`

### Calculating VAT Threshold Progress

1. User views VAT threshold report → `/reports/vat-threshold`
2. System calls calculateVatThresholdProgress() → `src/lib/reports/kpr-generator.ts:256`
3. System queries all OUTBOUND fiscalized invoices for year → `src/lib/reports/kpr-generator.ts:270-284`
4. System calculates annual revenue in EUR → `src/lib/reports/kpr-generator.ts:288-292`
5. System compares against 40,000 EUR threshold → `src/lib/reports/kpr-generator.ts:294`
6. System determines status (BELOW / WARNING / EXCEEDED):
   - EXCEEDED: >= 100% of threshold → `src/lib/reports/kpr-generator.ts:298-299`
   - WARNING: >= 90% of threshold → `src/lib/reports/kpr-generator.ts:300-301`
   - BELOW: < 90% of threshold → `src/lib/reports/kpr-generator.ts:296`
7. System logs calculation → `src/lib/reports/kpr-generator.ts:304-311`
8. System returns progress data → `src/lib/reports/kpr-generator.ts:313-318`

## Key Modules

| Module                  | Purpose                                         | Location                                             |
| ----------------------- | ----------------------------------------------- | ---------------------------------------------------- |
| PausalniObrtReportsPage | Main dashboard UI for paušalni obrt reports     | `src/app/(dashboard)/reports/pausalni-obrt/page.tsx` |
| SeasonPackExportRoute   | API endpoint for tax season ZIP export          | `src/app/api/exports/season-pack/route.ts`           |
| VATThresholdRoute       | API endpoint for VAT threshold data             | `src/app/api/reports/vat-threshold/route.ts`         |
| VATThresholdReportPage  | UI for VAT threshold monitoring                 | `src/app/(dashboard)/reports/vat-threshold/page.tsx` |
| ExportPage              | UI for accountant data export                   | `src/app/(dashboard)/reports/export/page.tsx`        |
| KPRGenerator            | Croatian KPR (Knjiga Prometa) report generation | `src/lib/reports/kpr-generator.ts`                   |
| AccountantExport        | Comprehensive data export for accountants       | `src/lib/reports/accountant-export.ts`               |
| AccountingExportForm    | Form component for date-based export            | `src/components/reports/accounting-export-form.tsx`  |

## Paušalni Obrt Business Rules

### What is Paušalni Obrt?

Paušalni obrt is a Croatian flat-rate sole proprietorship business structure designed for small businesses. It operates under simplified taxation rules (paušalno oporezivanje) where:

- Income tax is calculated at a flat rate of **12%** paid quarterly
- Social contributions are **fixed monthly** (~262.51 EUR in 2025)
- VAT registration is **not required** if annual income stays below threshold
- Bookkeeping is **simplified** - only KPR (Knjiga Prometa) is required

### Income and VAT Thresholds (2025)

- **VAT Registration Threshold**: 60,000 EUR annually (increased from 40,000 EUR effective January 1, 2025)
- **Paušalni Eligibility**: Annual income must not exceed 60,000 EUR to remain in flat-rate system
- **Warning Level**: System alerts at 90% of threshold (54,000 EUR)
- **Tracking**: System tracks progress in real-time → `src/lib/reports/kpr-generator.ts:294`

### KPR (Knjiga Prometa) Requirements

Paušalni obrtnici must maintain **Knjiga Prometa** (Book of Traffic) as their primary bookkeeping record:

- **What to Record**: All issued invoices, both cash and non-cash receipts → `src/lib/reports/kpr-generator.ts:72-89`
- **Invoice Types**: Only OUTBOUND fiscalized invoices → `src/lib/reports/kpr-generator.ts:80`
- **Invoice Status**: SENT, DELIVERED, PAID, FISCALIZED → `src/lib/reports/kpr-generator.ts:79`
- **Required Data**: Invoice number, date, buyer, amounts by VAT rate, totals → `src/lib/reports/kpr-generator.ts:122-139`
- **VAT Breakdown**: Separate tracking for 25%, 13%, 5%, 0% rates → `src/lib/reports/kpr-generator.ts:102-120`

### Fiscalization 2.0 Requirements (Starting January 1, 2026)

New fiscalization rules apply to paušalni obrtnici:

- **Scope Expansion**: All invoices to natural persons must be fiscalized, regardless of payment method
- **Technical Requirements**: Fiscal certificate, ZKI/JIR/QR codes on all invoices
- **B2B E-Invoicing**: Mandatory digital invoicing for business transactions
- **Classification Codes**: Six-digit CPA (Classification of Products by Activities) codes required for items
- **Payment Methods**: All methods covered (cash, card, bank transfer, PayPal, Google Pay, Stripe, etc.)

### Tax Payments and Deadlines

- **Quarterly Tax**: Paid by March 31, June 30, September 30, December 31
- **Monthly Contributions**: Paid by the 15th of each month (262.51 EUR in 2025)
- **Annual Report**: PO-SD form submitted by January 15 for previous year
- **VAT Registration**: If threshold exceeded, register within 5 days with Tax Administration

## Key Metrics Displayed

### Income and Expense Summary

- **Annual Income** (Prihod): Total revenue from OUTBOUND invoices → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:214`
- **Annual Expenses** (Troškovi): Total from expense records and INBOUND invoices → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:232`
- **Net Profit** (Neto dobit): Income minus expenses, basis for taxation → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:250-255`
- **VAT Obligation** (Porezna kazna): Total VAT collected → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:272`

### Monthly Breakdown

- **12 Month View**: Visual chart showing income distribution → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:294-305`
- **Croatian Month Names**: Sij, Velj, Ožu, Tra, Svi, Lip, Srp, Kol, Ruj, Lis, Stu, Pro → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:185`
- **Bar Chart Visualization**: Height proportional to monthly income → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:298-300`

### Expense Categories

- **Category Breakdown**: Expenses grouped by category → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:394-411`
- **Percentage Display**: Each category as % of total expenses → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:408`

### VAT Threshold Progress

- **Current Status Badge**: BELOW / WARNING / EXCEEDED → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:471-478`
- **Progress Bar**: Visual representation toward 40,000 EUR threshold → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:469-480`
- **Warning Colors**: Blue (safe), Amber (approaching), Red (exceeded) → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:472-474`

## Export Packages for Accountants

### 1. Paušalni Obrt Godišnji Paket (Annual Package)

- **URL**: `/api/exports/pausalni-obrt?period=yearly&type=all`
- **Contents**: Full year data + VAT breakdown
- **Use Case**: Annual tax filing
- **Link**: `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:335`

### 2. Paušalni Obrt Kvartalni Paket (Quarterly Package)

- **URL**: `/api/exports/pausalni-obrt?period=quarterly&type=summary`
- **Contents**: Q1-Q4 breakdown + summary report
- **Use Case**: Quarterly review with accountant
- **Link**: `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:353`

### 3. PDS Prijava (VAT Declaration)

- **URL**: `/api/exports/pausalni-obrt?period=yearly&type=tax`
- **Contents**: VAT declaration for Porezna uprava (Croatian Tax Administration)
- **Use Case**: VAT filing when threshold exceeded
- **Link**: `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:371`

### Tax Season Pack (Comprehensive Export)

The comprehensive export includes 4 CSV files + README:

- **00-SAZETAK.csv**: Summary of income, expenses, net profit → `src/lib/reports/accountant-export.ts:363-398`
- **01-RACUNI.csv**: Complete invoice list with buyer details → `src/lib/reports/accountant-export.ts:242-280`
- **02-TROSKOVI.csv**: Complete expense list with vendor and category → `src/lib/reports/accountant-export.ts:282-320`
- **03-KPR.csv**: Knjiga Prometa (paid invoices only) → `src/lib/reports/accountant-export.ts:322-361`
- **PROCITAJ-ME.txt**: Instructions and summary → `src/app/api/exports/season-pack/route.ts:119-199`

### CSV Format Standards

- **Encoding**: UTF-8 with BOM for Excel compatibility → `src/lib/reports/accountant-export.ts:279`
- **Separator**: Semicolon (;) → `src/lib/reports/accountant-export.ts:258`
- **Currency**: EUR with 2 decimal places → `src/lib/reports/accountant-export.ts:270-272`
- **Dates**: ISO format (YYYY-MM-DD) → `src/lib/reports/accountant-export.ts:408-411`
- **Receipt Links**: Direct URLs to scanned receipts included → `src/lib/reports/accountant-export.ts:314`

## Data Structures

### KPRRecord Interface

```typescript
{
  id: string;
  invoiceNumber: string;
  issueDate: Date;
  dueDate?: Date;
  buyerName: string;
  buyerOib?: string;
  netAmount: number;
  vat25Percent: number;
  vat13Percent: number;
  vat5Percent: number;
  vat0Percent: number;
  totalAmount: number;
  paymentMethod?: string; // G: Cash, K: Card, T: Transfer, O: Other
  currency: string;
  fiscalizedAt?: Date;
  jir?: string; // Jedinstveni Identifikator Računa
}
```

Location: `src/lib/reports/kpr-generator.ts:8-25`

### AccountantExportData Interface

```typescript
{
  companyName: string;
  companyOib: string;
  companyVatNumber: string | null;
  periodFrom: Date | undefined;
  periodTo: Date | undefined;
  invoices: InvoiceSummaryRow[];
  expenses: ExpenseSummaryRow[];
  kprRows: KprRow[];
  totals: {
    totalIncome: number;
    totalIncomeVat: number;
    totalIncomeGross: number;
    totalExpenses: number;
    totalExpensesVat: number;
    totalExpensesGross: number;
    netProfit: number;
  };
}
```

Location: `src/lib/reports/accountant-export.ts:52-70`

### VAT Threshold Progress Response

```typescript
{
  annualRevenue: number
  vatThreshold: number // 60,000 EUR (2025+)
  percentage: number
  status: "BELOW" | "WARNING" | "EXCEEDED"
}
```

Location: `src/lib/reports/kpr-generator.ts:259-264`

## Database Queries

### Annual Summary Query

Aggregates OUTBOUND invoices for current year:

```typescript
db.eInvoice.aggregate({
  where: {
    companyId: company.id,
    direction: "OUTBOUND",
    status: { in: ["PAID", "FISCALIZED", "SENT"] },
    issueDate: { gte: yearStart, lte: yearEnd },
  },
  _sum: { totalAmount, netAmount, vatAmount },
  _count: { _all },
})
```

Location: `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:63-81`

### Expense Breakdown Query

Groups expenses by category:

```typescript
db.expense.groupBy({
  where: {
    companyId: company.id,
    date: { gte: yearStart, lte: yearEnd },
  },
  by: ["categoryId"],
  _sum: { totalAmount },
  include: { category: { select: { name } } },
})
```

Location: `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:133-150`

### KPR Invoice Query

Fetches fiscalized OUTBOUND invoices:

```typescript
db.eInvoice.findMany({
  where: {
    companyId,
    issueDate: { gte: fromDate, lte: toDate },
    status: { in: ["SENT", "DELIVERED", "PAID", "FISCALIZED"] },
    direction: "OUTBOUND",
  },
  include: { lines, buyer },
  orderBy: { issueDate: "asc" },
})
```

Location: `src/lib/reports/kpr-generator.ts:72-89`

## Integration Points

### From Marketing Landing Page

- **Landing Page**: `/for/pausalni-obrt` → `src/app/(marketing)/for/pausalni-obrt/page.tsx`
- **Target Audience**: Croatian sole proprietors (paušalni obrtnici)
- **Value Proposition**: Time savings (5-10h → 1-2h monthly), fewer errors, simplified export
- **Pricing**: 39 EUR/month, 50 invoices, unlimited expenses with OCR

### To Other Reports

- **KPR Report**: Links to `/reports/kpr` → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:525-528`
- **VAT Reports**: Links to `/reports/vat` → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:530-535`
- **VAT Threshold**: Links to `/reports/vat-threshold` via API → `src/app/api/reports/vat-threshold/route.ts`

### To Expense Tracking

- **Expense Categories**: Links to `/expenses` → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:536-541`
- **Receipt Scanner**: Expense OCR integration for receipt scanning
- **Category Assignment**: Automatic expense categorization

### To Invoice Management

- **Invoice Creation**: Uses e-invoice system for OUTBOUND invoices
- **Fiscalization**: JIR/ZKI tracking for Croatian fiscal compliance
- **Payment Tracking**: Paid status required for KPR inclusion

## Compliance Features

### Croatian Regulatory Compliance

- **HOK (Hrvatska Obrtnička Komora)**: Croatian Chamber of Trades compliance
- **Porezna Uprava**: Tax Administration reporting requirements
- **KPR Form**: Official Obrazac KPR format → `src/lib/reports/kpr-generator.ts:8-25`
- **OIB Validation**: 11-digit Croatian tax identification number validation

### 11-Year Archiving

System supports long-term archiving requirement:

- **Retention Period**: 11 years as mandated by Croatian law
- **Access**: Report mentions "11-godišnje arhiviranje - operativno" → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:445`
- **Compliance Card**: Displayed in dashboard → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:419-448`

### Fiscalization Status Tracking

- **JIR (Jedinstveni Identifikator Računa)**: Unique invoice identifier → `src/lib/reports/kpr-generator.ts:24`
- **ZKI (Zaštitni Kod Izdavatelja)**: Protective issuer code
- **Fiscalized At**: Timestamp of fiscalization → `src/lib/reports/kpr-generator.ts:137`
- **Status Filtering**: Only fiscalized invoices in KPR → `src/lib/reports/kpr-generator.ts:79`

## User Experience

### Dashboard Layout

- **Header Section**: Badge + title + description → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:192-200`
- **4 Metric Cards**: Income, Expenses, Net Profit, VAT Obligation → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:203-279`
- **Monthly Chart**: 12-month bar chart visualization → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:282-308`
- **2-Column Grid**: Export packages + Expense categories → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:310-415`
- **3-Card Grid**: Compliance status + VAT threshold + Next steps → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:417-520`
- **Quick Links**: 3 buttons to related reports → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:522-543`

### Export Package UI

Each package shows:

- **Icon**: Color-coded (green/blue/purple) → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:326-327`
- **Title**: Package name in Croatian → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:330`
- **Subtitle**: Brief description → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:331`
- **Download Button**: Triggers export API → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:334-339`

### VAT Threshold Visualization

- **Progress Bar**: 0 to 40,000 EUR scale → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:469-484`
- **Color Coding**: Safe (blue), Warning (amber), Exceeded (red) → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:471-477`
- **Percentage Display**: Current progress as % → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:476-477`

## Error Handling

### Export Errors

- **Invalid Date Format**: Returns 400 with error message → `src/app/api/exports/season-pack/route.ts:37-51`
- **Company Not Found**: Throws error in fetchAccountantExportData → `src/lib/reports/accountant-export.ts:88`
- **Archive Creation Failure**: Caught and logged → `src/app/api/exports/season-pack/route.ts:74-76`
- **Server Error Response**: Returns 500 with generic message → `src/app/api/exports/season-pack/route.ts:110-116`

### KPR Generation Errors

- **Company Not Found**: Throws error with company ID → `src/lib/reports/kpr-generator.ts:68`
- **Database Query Failure**: Logged with context (companyId, dates) → `src/lib/reports/kpr-generator.ts:182-187`
- **Error Propagation**: Errors thrown up to caller → `src/lib/reports/kpr-generator.ts:189`

### VAT Threshold Calculation Errors

- **Query Failure**: Logged with company and year → `src/lib/reports/kpr-generator.ts:320-325`
- **Currency Conversion**: Note about future exchange rate handling → `src/lib/reports/kpr-generator.ts:287-291`

## Logging

### Operation Tracking

- **KPR Report Generated**: Logs company, period, record count → `src/lib/reports/kpr-generator.ts:173-178`
- **Monthly KPR Summary**: Logs company, year → `src/lib/reports/kpr-generator.ts:235-239`
- **VAT Threshold Calculated**: Logs revenue, percentage, status → `src/lib/reports/kpr-generator.ts:304-311`
- **VAT Threshold Report Generated**: Logs user, company, year, revenue → `src/app/api/reports/vat-threshold/route.ts:93-99`

### Error Logging

- **KPR Generation Failed**: Logs error, company, dates → `src/lib/reports/kpr-generator.ts:182-187`
- **VAT Calculation Failed**: Logs error, company, year → `src/lib/reports/kpr-generator.ts:320-325`
- **Export Error**: Logs to console → `src/app/api/exports/season-pack/route.ts:111`
- **VAT API Error**: Logs structured error → `src/app/api/reports/vat-threshold/route.ts:104`

## Dependencies

- **Depends on**:
  - [[auth-login]] - User authentication required → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:34`
  - [[company-management]] - Company context required → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:35`
  - [[e-invoicing]] - Invoice data source → Query `db.eInvoice`
  - [[expense-tracking]] - Expense data source → Query `db.expense`
  - [[fiscalization]] - JIR/ZKI codes for KPR → `src/lib/reports/kpr-generator.ts:24,138`
  - **Archiver** - ZIP file creation → `src/app/api/exports/season-pack/route.ts:11`
  - **Prisma** - Database access → `src/lib/reports/kpr-generator.ts:4`
  - **Pino Logger** - Structured logging → `src/lib/reports/kpr-generator.ts:6`

- **Depended by**:
  - [[accountant-collaboration]] - Uses export packages
  - [[tax-compliance]] - KPR data for Croatian tax filing
  - [[vat-management]] - Threshold monitoring triggers VAT registration
  - **Marketing Site** - `/for/pausalni-obrt` landing page promotes feature
  - **Billing System** - "pausalni" subscription plan → `prisma/schema.prisma:97`

## Verification Checklist

- [ ] User can access /reports/pausalni-obrt dashboard
- [ ] Dashboard displays 4 key metric cards (income, expenses, net profit, VAT)
- [ ] Monthly income chart shows 12 months with Croatian names
- [ ] Expense breakdown shows categories with percentages
- [ ] VAT threshold progress bar displays correctly
- [ ] VAT threshold color coding: blue (safe), amber (warning), red (exceeded)
- [ ] Three export packages are available (Godišnji, Kvartalni, PDS)
- [ ] Tax season pack export creates valid ZIP file
- [ ] ZIP contains 4 CSV files + README
- [ ] CSV files use UTF-8 BOM encoding
- [ ] CSV uses semicolon separator
- [ ] All amounts formatted to 2 decimal places
- [ ] Dates in ISO format (YYYY-MM-DD)
- [ ] KPR includes only fiscalized OUTBOUND invoices
- [ ] KPR excludes unpaid invoices
- [ ] KPR groups VAT by rate (25%, 13%, 5%, 0%)
- [ ] Invoice data includes buyer name and OIB
- [ ] Expense data includes vendor, category, receipt URL
- [ ] Summary CSV shows totals correctly
- [ ] README includes company details and period
- [ ] VAT threshold calculated at 40,000 EUR
- [ ] Status WARNING triggers at 90% (36,000 EUR)
- [ ] Status EXCEEDED triggers at 100% (40,000 EUR)
- [ ] Monthly breakdown API returns 12 months
- [ ] Projected annual revenue calculated correctly
- [ ] Days left in year calculated correctly
- [ ] Quick links navigate to KPR, VAT, Expenses reports
- [ ] Compliance checklist shows KPR, PDV, Fiskalizacija status
- [ ] 11-year archiving mentioned in compliance card
- [ ] Croatian month names displayed correctly (Sij-Pro)
- [ ] Company tenant isolation enforced on all queries
- [ ] Authentication required for all pages and APIs
- [ ] Structured logging captures key operations
- [ ] Errors logged with context (companyId, dates, etc.)

## Evidence Links

1. Pausalni Obrt reports page → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:33`
2. Tax season pack export API → `src/app/api/exports/season-pack/route.ts:25`
3. VAT threshold report API → `src/app/api/reports/vat-threshold/route.ts:10`
4. VAT threshold page UI → `src/app/(dashboard)/reports/vat-threshold/page.tsx:46`
5. Export page UI → `src/app/(dashboard)/reports/export/page.tsx:6`
6. KPR generator function → `src/lib/reports/kpr-generator.ts:51`
7. VAT threshold calculator → `src/lib/reports/kpr-generator.ts:256`
8. Accountant export data fetcher → `src/lib/reports/accountant-export.ts:72`
9. CSV export functions → `src/lib/reports/accountant-export.ts:242-398`
10. Company schema with pausalni plan → `prisma/schema.prisma:97`
11. Marketing landing page → `src/app/(marketing)/for/pausalni-obrt/page.tsx:10`

## External References

### Croatian Tax Authority

- [Hrvatska obrtnička komora - Knjiga prometa (KPR)](https://www.hok.hr/gospodarstvo-i-savjetovanje/obrasci-za-poslovanje-obrta/knjiga-prometa-obrazac-kpr)
- [Porezna uprava - Obrtnici paušalisti](https://porezna-uprava.gov.hr/hr/obrtnici-pausalisti/4564)
- [Croatia VAT guide 2025 update](https://www.vatcalc.com/croatia/croatia-vat-guide-2023/)

### Paušalni Obrt Information

- [How to open and close an obrt in Croatia: Guide for 2025](https://www.expatincroatia.com/open-close-obrt-croatia/)
- [Paušalni obrt – vodič za početnike](https://fiskalopedija.hr/baza-znanja/pausalni-obrt)
- [Paušalni obrt – Porezi i doprinosi u 2025](https://www.business-up.hr/post/pau%C5%A1alni-obrt-porezi-i-doprinosi-u-2025-tablice-i-primjer)

### Fiscalization 2.0

- [Fiscalization 2.0: Key Information for Paušalni Obrtnici](https://finacro.hr/en/dobro-je-znati/fiscalization-2-0-key-information-for-taxpayers-outside-the-vat-system-and-flat-rate-craftsmen-pausalni-obrtnici/)
- [FISCALIZATION 2.0 – application from 01.01.2026](https://finacro.hr/en/dobro-je-znati/fiscalization-2-0-what-it-brings-us-application-from-01-01-2026/)
- [Croatia Updates Fiscalization Service Rules for 2026](https://www.vatupdate.com/2025/09/24/croatia-updates-fiscalization-service-rules-for-2026/)

### Tax Law Changes

- [Amendments of tax legislation with effect from 1 January 2025](https://www.deloitte.com/ce/en/related-content/hr-tax-reform-2025-in-croatia.html)
- [Latest Croatian law changes (Effective 2025)](https://www.expatincroatia.com/law-changes-2025/)
