# Feature: KPR Report (Knjiga Prometa)

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 26

## Purpose

The KPR Report feature generates the Croatian "Knjiga Primitaka i Izdataka" (Book of Income and Expenses), a mandatory accounting book for sole proprietors (paušalni obrt) in Croatia. The system aggregates all paid invoices (income) and paid expenses (expenditures) into a chronologically sorted ledger with running balance calculations. Users can filter by date ranges using quick presets (this month, last quarter, etc.) or custom dates, and export the report in multiple formats (PDF, Excel, CSV, and PO-SD XML) for tax compliance and accounting purposes. This feature is specifically designed to meet Croatian tax office requirements for paušalni obrt business reporting.

## User Entry Points

| Type | Path              | Evidence                                                                     |
| ---- | ----------------- | ---------------------------------------------------------------------------- |
| Page | KPR Report        | `/reports/kpr` → `src/app/(dashboard)/reports/kpr/page.tsx:16-236`           |
| Page | Reports Dashboard | `/reports` → `src/app/(dashboard)/reports/page.tsx:16-17`                    |
| API  | CSV Export        | `GET /api/reports/kpr` → `src/app/api/reports/kpr/route.ts:5-31`             |
| API  | PDF Export        | `GET /api/reports/kpr/pdf` → `src/app/api/reports/kpr/pdf/route.ts:7-47`     |
| API  | Excel Export      | `GET /api/reports/kpr/excel` → `src/app/api/reports/kpr/excel/route.ts:6-34` |
| Nav  | Reports Sidebar   | Reports Sidebar → `src/components/documents/reports-sidebar.tsx:13`          |

## Core Flow

### Report Generation Flow

1. User navigates to KPR report page → `src/app/(dashboard)/reports/kpr/page.tsx:16`
2. System authenticates user and fetches company → `page.tsx:17-18`
3. System parses date filters from URL query params (preset or custom range) → `page.tsx:20-52`
4. System calls fetchKpr() to aggregate paid invoices and expenses → `page.tsx:54`
5. System fetches paid invoices with OUTBOUND direction → `src/lib/reports/kpr.ts:52-69`
6. System fetches paid expenses with PAID status → `src/lib/reports/kpr.ts:71-88`
7. System converts to unified KPR rows with income/expense amounts → `src/lib/reports/kpr.ts:90-117`
8. System sorts all rows chronologically by date → `src/lib/reports/kpr.ts:119-124`
9. System calculates running balance for each transaction → `src/lib/reports/kpr.ts:126-131`
10. System groups transactions by month and quarter → `src/lib/reports/kpr.ts:138-186`
11. UI displays grouped data with monthly summaries and totals → `page.tsx:83-138`
12. User can export to PDF, Excel, CSV, or PO-SD XML → `page.tsx:196-227`

### PDF Export Flow

1. User clicks "PDF izvoz" button → `src/app/(dashboard)/reports/kpr/page.tsx:197-202`
2. Browser requests PDF endpoint with date range params → `src/app/api/reports/kpr/pdf/route.ts:7`
3. API authenticates user and fetches company → `route.ts:9-10`
4. System fetches KPR data via fetchKpr() → `route.ts:20`
5. System generates PDF using react-pdf renderer → `route.ts:23-32`
6. PDF document includes header with company info → `src/lib/reports/kpr-pdf.tsx:179-186`
7. PDF renders table with all transactions → `kpr-pdf.tsx:188-245`
8. PDF includes grand totals and summary section → `kpr-pdf.tsx:247-277`
9. API returns PDF buffer with attachment headers → `route.ts:36-42`
10. Browser downloads file: `kpr-{oib}-{date}.pdf` → `route.ts:34`

### Excel Export Flow

1. User clicks "Excel izvoz" button → `src/app/(dashboard)/reports/kpr/page.tsx:203-208`
2. Browser requests Excel endpoint with date params → `src/app/api/reports/kpr/excel/route.ts:6`
3. System generates enhanced CSV with Croatian formatting → `src/lib/reports/kpr-excel.ts:7-116`
4. CSV includes header section with company metadata → `kpr-excel.ts:10-15`
5. CSV includes detailed transaction table → `kpr-excel.ts:18-39`
6. CSV includes monthly breakdown section → `kpr-excel.ts:63-84`
7. CSV includes quarterly breakdown if applicable → `kpr-excel.ts:87-108`
8. API returns CSV with Excel-compatible encoding → `route.ts:23-28`

## Key Modules

| Module            | Purpose                              | Location                                          |
| ----------------- | ------------------------------------ | ------------------------------------------------- |
| KprPage           | Main report page with filters and UI | `src/app/(dashboard)/reports/kpr/page.tsx:16-355` |
| fetchKpr          | Core data aggregation function       | `src/lib/reports/kpr.ts:51-205`                   |
| kprToCsv          | CSV export formatter                 | `src/lib/reports/kpr.ts:207-242`                  |
| kprToExcel        | Excel-enhanced CSV formatter         | `src/lib/reports/kpr-excel.ts:7-156`              |
| KprPdfDocument    | React-PDF document component         | `src/lib/reports/kpr-pdf.tsx:168-286`             |
| posdXml           | PO-SD XML generator for tax filing   | `src/lib/reports/kpr.ts:272-291`                  |
| generateKPRReport | Legacy KPR generator (VAT breakdown) | `src/lib/reports/kpr-generator.ts:51-191`         |

## Data Aggregation

### Income Sources

The system aggregates income from paid OUTBOUND invoices → `src/lib/reports/kpr.ts:52-69`:

**Query Criteria**:

- Direction: `OUTBOUND` (issued invoices)
- Payment date: `paidAt` field must not be null
- Date filter: `paidAt` within specified range (if provided)
- Sorted by: `paidAt` ascending

**Fields Extracted**:

- `paidAt` - Transaction date (when payment was received)
- `invoiceNumber` - Document number for ledger
- `buyer.name` - Counterparty name
- `totalAmount` - Income amount (primitak)
- `netAmount`, `vatAmount` - For legacy PO-SD XML

**Conversion to KPR Row** → `src/lib/reports/kpr.ts:91-107`:

```typescript
{
  date: inv.paidAt,
  documentNumber: inv.invoiceNumber,
  description: `Račun za ${inv.buyer?.name || "nepoznati kupac"}`,
  income: numberFromDecimal(inv.totalAmount),
  expense: 0,
  balance: 0, // Calculated later in running balance pass
  type: "INCOME"
}
```

### Expense Sources

The system aggregates expenses from paid expense records → `src/lib/reports/kpr.ts:71-88`:

**Query Criteria**:

- Status: `PAID` (only paid expenses count)
- Payment date: `paymentDate` field must not be null
- Date filter: `paymentDate` within specified range (if provided)
- Sorted by: `paymentDate` ascending

**Fields Extracted**:

- `paymentDate` - Transaction date (when payment was made)
- `date` - Original expense date (for document number)
- `description` - Expense description
- `vendor.name` - Counterparty name
- `totalAmount` - Expense amount (izdatak)

**Conversion to KPR Row** → `src/lib/reports/kpr.ts:109-117`:

```typescript
{
  date: exp.paymentDate,
  documentNumber: `EXP-${exp.date.toISOString().slice(0, 10)}`,
  description: `${exp.description} (${exp.vendor?.name || "nepoznati dobavljač"})`,
  income: 0,
  expense: numberFromDecimal(exp.totalAmount),
  balance: 0, // Calculated later
  type: "EXPENSE"
}
```

### Running Balance Calculation

After combining income and expense rows, the system calculates a running balance → `src/lib/reports/kpr.ts:119-131`:

**Algorithm**:

1. Sort all rows by date (chronological order)
2. Initialize `runningBalance = 0`
3. For each row in order:
   - Add `row.income` to balance
   - Subtract `row.expense` from balance
   - Store result in `row.balance`

**Example**:

```
Date       | Doc    | Income | Expense | Balance
2025-01-05 | INV-1  | 1000   | 0       | 1000
2025-01-10 | EXP-1  | 0      | 300     | 700
2025-01-15 | INV-2  | 500    | 0       | 1200
2025-01-20 | EXP-2  | 0      | 200     | 1000
```

## Monthly and Quarterly Grouping

### Monthly Aggregation

System groups transactions by month → `src/lib/reports/kpr.ts:138-160`:

**Grouping Logic**:

- Extract year and month from transaction date
- Create key: `YYYY-MM` (e.g., "2025-01")
- Transactions without dates grouped as "unknown"

**Monthly Summary Fields**:

- `rows[]` - All transactions in the month
- `totalIncome` - Sum of all income amounts
- `totalExpense` - Sum of all expense amounts
- `netIncome` - Income minus expenses
- `period` - Month key for reference

**UI Display** → `src/app/(dashboard)/reports/kpr/page.tsx:86-136`:

- Month name in Croatian (Siječanj, Veljača, etc.)
- Transaction count badge
- Summary: "Total Income / Total Expense = Net"
- Expandable table with all transactions

### Quarterly Aggregation

System groups months into quarters → `src/lib/reports/kpr.ts:162-186`:

**Grouping Logic**:

- Extract quarter from month: `Math.ceil(month / 3)`
- Create key: `YYYY-QN` (e.g., "2025-Q1")
- Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec

**Quarterly Summary Fields**:

- `months{}` - Map of monthly summaries in quarter
- `totalIncome` - Sum across all months
- `totalExpense` - Sum across all months
- `netIncome` - Net across all months
- `period` - Quarter key

**UI Display** → `src/app/(dashboard)/reports/kpr/page.tsx:180-192`:

- Shown in summary card sidebar
- Displays net income per quarter
- Color-coded: green for profit, red for loss

## Croatian Tax Compliance

### KPR Requirements

The Knjiga Primitaka i Izdataka must meet Croatian Tax Administration requirements for paušalni obrt:

**Mandatory Elements** → `src/lib/reports/kpr.ts:207-242`:

1. **Redni broj** (Sequential number) - Row index starting from 1
2. **Datum** (Date) - Transaction date in DD.MM.YYYY format
3. **Broj računa/dokumenta** (Document number) - Invoice or expense ID
4. **Opis** (Description) - Transaction description with counterparty
5. **Primitak (Prihod)** (Income) - Received amounts only
6. **Izdatak (Trošak)** (Expense) - Paid amounts only
7. **Saldo** (Balance) - Running balance after each transaction

**Compliance Rules**:

- All monetary amounts in EUR (Croatian standard since 2023)
- Chronological ordering by payment date (not issue date)
- Only paid/completed transactions included
- Running balance must be accurate for audit verification

### PO-SD XML Export

The system generates PO-SD (Paušalni Obrt - Standardna Deklaracija) XML for electronic tax filing → `src/lib/reports/kpr.ts:272-291`:

**XML Structure**:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<POSDReport>
  <Period>
    <From>2025-01-01</From>
    <To>2025-12-31</To>
  </Period>
  <Totals>
    <InvoiceCount>156</InvoiceCount>
    <TotalNet>25000.00</TotalNet>
    <TotalVAT>6250.00</TotalVAT>
    <TotalGross>31250.00</TotalGross>
  </Totals>
</POSDReport>
```

**XML Download** → `src/app/(dashboard)/reports/kpr/page.tsx:215-226`:

- Generated client-side as data URI
- Filename: PO-SD XML
- Encoding: UTF-8 with XML declaration
- Format: Standard Croatian Tax Office XML schema

**Note**: Current PO-SD XML implementation is simplified. Full Croatian Tax Office compliance may require additional fields (business premises code, operator OIB, etc.) based on specific filing requirements.

## Date Filtering

### Quick Presets

Users can select common date ranges via preset buttons → `src/app/(dashboard)/reports/kpr/page.tsx:27-52`:

| Preset         | Parameter     | Date Range Logic                          |
| -------------- | ------------- | ----------------------------------------- |
| Ovaj mjesec    | `thisMonth`   | First day to last day of current month    |
| Prošli mjesec  | `lastMonth`   | First day to last day of previous month   |
| Ovaj kvartal   | `thisQuarter` | First day of Q to last day of Q           |
| Prošli kvartal | `lastQuarter` | First day of prev Q to last day of prev Q |
| Ova godina     | `thisYear`    | Jan 1 to Dec 31 of current year           |
| Prošla godina  | `lastYear`    | Jan 1 to Dec 31 of previous year          |

**URL Format**: `/reports/kpr?preset=thisMonth`

**Implementation** → `page.tsx:27-52`:

- Server-side date calculation on each page load
- Current date retrieved from `new Date()`
- Quarter calculated: `Math.floor(month / 3)`
- Handles year boundaries for "last quarter"

### Custom Date Range

Users can select specific date ranges → `src/app/(dashboard)/reports/kpr/page.tsx:297-330`:

**UI Components**:

- "Od datuma" (From date) - HTML5 date input
- "Do datuma" (To date) - HTML5 date input
- "Primijeni" (Apply) - Submit button
- "Poništi" (Reset) - Link to clear filters

**URL Format**: `/reports/kpr?from=2025-01-01&to=2025-03-31`

**Filter Behavior**:

- If no filters: All-time data (no date restriction)
- If only `from`: All transactions from that date forward
- If only `to`: All transactions up to that date
- If both: Transactions within inclusive range

## Export Formats

### CSV Export

Basic CSV format for spreadsheet import → `src/lib/reports/kpr.ts:207-242`:

**Headers**:

```csv
Redni broj,Datum,Broj računa/dokumenta,Opis,Primitak (Prihod),Izdatak (Trošak),Saldo
```

**Row Format**:

- Sequential number starting from 1
- Date in YYYY-MM-DD format
- Document number (escaped for CSV safety)
- Description (escaped, may contain commas)
- Income amount with 2 decimal places
- Expense amount with 2 decimal places
- Balance with 2 decimal places

**Footer Row**:

```csv
,,,UKUPNO,25000.00,12000.00,13000.00
```

**Download**: Direct download via `/api/reports/kpr` endpoint
**Filename**: `kpr-{companyId}.csv`

### Excel Export

Enhanced CSV with rich formatting → `src/lib/reports/kpr-excel.ts:7-156`:

**Structure**:

1. **Header Block** → lines 10-15
   - Report title: "KNJIGA PRIMITAKA I IZDATAKA (KPR)"
   - Company name and OIB
   - Period description
   - Empty line separator

2. **Transaction Table** → lines 18-39
   - Column headers in Croatian
   - All transaction rows
   - Empty line before totals
   - Grand total row

3. **Summary Section** → lines 54-60
   - "SAŽETAK" heading
   - Total income with currency
   - Total expense with currency
   - Net profit with currency
   - Transaction count

4. **Monthly Breakdown** → lines 63-84
   - "MJESEČNI PREGLED" heading
   - Table: Month | Income | Expense | Net
   - Sorted chronologically

5. **Quarterly Breakdown** → lines 87-108
   - "KVARTALNI PREGLED" heading
   - Table: Quarter | Income | Expense | Net
   - Only included if data spans multiple quarters

**Special Formatting**:

- All text fields quoted for Excel compatibility
- Croatian locale date formatting
- Decimal separator: period (international standard)
- Currency labels: " EUR" suffix

**Download**: `/api/reports/kpr/excel` endpoint
**Filename**: `kpr-{oib}-{date}.csv`
**Encoding**: UTF-8 with BOM for Excel recognition

### PDF Export

Professional PDF report with tables and summaries → `src/lib/reports/kpr-pdf.tsx:168-286`:

**Page Configuration**:

- Size: A4 landscape (for wide tables)
- Margins: 30pt all sides
- Font: Helvetica (built-in PDF font)
- Base font size: 9pt

**Layout Sections**:

1. **Header** → lines 179-186
   - Title: "Knjiga Primitaka i Izdataka (KPR)" (18pt bold)
   - Company info: Name and OIB (9pt)
   - Period subtitle with date range (10pt, gray)

2. **Table Header** → lines 189-197
   - Gray background (#f0f0f0)
   - Column titles in Croatian (8pt bold)
   - Columns: Rb. | Datum | Broj dokumenta | Opis | Primitak | Izdatak | Saldo

3. **Table Rows** → lines 200-212
   - Alternating row colors (white / #f9f9f9)
   - Border between rows (0.5pt, #e0e0e0)
   - Right-aligned numeric columns
   - Empty cells for zero amounts (displayed as "—")

4. **Monthly Grouping** (optional) → lines 213-245
   - Month section headers (11pt bold, blue background)
   - Transactions grouped under month
   - Month subtotal row (bold, larger border)

5. **Grand Total** → lines 247-256
   - Blue background (#e8f4f8)
   - Thicker borders (2pt top and bottom)
   - Bold text (9pt)
   - "UKUPNO:" label

6. **Summary Box** → lines 259-277
   - Gray background (#f5f5f5)
   - Rounded corners (5pt radius)
   - Total income in EUR
   - Total expense in EUR
   - Net profit in EUR
   - Transaction count

7. **Footer** → lines 280-282
   - Absolute positioning at page bottom
   - Generation date and system attribution
   - Gray text (8pt)

**Download**: `/api/reports/kpr/pdf` endpoint
**Filename**: `kpr-{oib}-{date}.pdf`
**Content-Type**: `application/pdf`

## Data Models

### KprRow

Individual transaction row in the report → `src/lib/reports/kpr.ts:4-20`:

```typescript
type KprRow = {
  date: Date | null // Transaction date (paidAt or paymentDate)
  documentNumber: string | null // Invoice number or expense ID
  description: string | null // Transaction description with counterparty
  income: number // Amount received (0 for expenses)
  expense: number // Amount paid (0 for income)
  balance: number // Running balance after this transaction
  type: "INCOME" | "EXPENSE" // Transaction type

  // Legacy fields for PO-SD XML compatibility
  paidAt?: Date | null
  issueDate?: Date | null
  invoiceNumber?: string | null
  buyerName?: string | null
  netAmount?: number
  vatAmount?: number
  totalAmount?: number
}
```

### KprSummary

Complete report with aggregations → `src/lib/reports/kpr.ts:22-33`:

```typescript
type KprSummary = {
  rows: KprRow[] // All transactions chronologically
  totalIncome: number // Sum of all income
  totalExpense: number // Sum of all expenses
  netIncome: number // Income - Expense
  byMonth: Record<string, MonthlyKprSummary> // Grouped by "YYYY-MM"
  byQuarter?: Record<string, QuarterlyKprSummary> // Grouped by "YYYY-QN"

  // Legacy fields for backwards compatibility
  totalNet?: number
  totalVat?: number
  totalGross?: number
}
```

### MonthlyKprSummary

Aggregated data for one month → `src/lib/reports/kpr.ts:35-41`:

```typescript
type MonthlyKprSummary = {
  rows: KprRow[] // Transactions in this month
  totalIncome: number // Sum of income for month
  totalExpense: number // Sum of expenses for month
  netIncome: number // Net for month
  period: string // Month key "YYYY-MM"
}
```

### QuarterlyKprSummary

Aggregated data for one quarter → `src/lib/reports/kpr.ts:43-49`:

```typescript
type QuarterlyKprSummary = {
  months: Record<string, MonthlyKprSummary> // Monthly data in quarter
  totalIncome: number // Sum across quarter
  totalExpense: number // Sum across quarter
  netIncome: number // Net across quarter
  period: string // Quarter key "YYYY-QN"
}
```

## Database Integration

### EInvoice Model (Income)

The report queries paid outbound invoices → `prisma/schema.prisma:173-259`:

**Relevant Fields**:

- `companyId` - Tenant isolation
- `direction` - Must be "OUTBOUND" (issued invoices)
- `paidAt` - Payment date (must not be null)
- `invoiceNumber` - Document number
- `buyer` - Relation to Contact for name
- `totalAmount` - Gross amount (primitak)
- `netAmount` - Base amount (for PO-SD)
- `vatAmount` - Tax amount (for PO-SD)
- `status` - Not explicitly filtered, but paidAt implies paid

**Query** → `src/lib/reports/kpr.ts:53-69`:

```typescript
db.eInvoice.findMany({
  where: {
    companyId,
    direction: "OUTBOUND",
    paidAt: {
      not: null,
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    },
  },
  orderBy: [{ paidAt: "asc" }],
  select: {
    paidAt: true,
    issueDate: true,
    invoiceNumber: true,
    buyer: { select: { name: true } },
    totalAmount: true,
    netAmount: true,
    vatAmount: true,
  },
})
```

### Expense Model (Expenditures)

The report queries paid expense records → `prisma/schema.prisma:345-374`:

**Relevant Fields**:

- `companyId` - Tenant isolation
- `status` - Must be "PAID"
- `paymentDate` - Payment date (must not be null)
- `date` - Expense date (for document number)
- `description` - Expense description
- `vendor` - Relation to Contact for name
- `totalAmount` - Gross amount (izdatak)
- `netAmount` - Base amount (for PO-SD)
- `vatAmount` - Tax amount (for PO-SD)

**Query** → `src/lib/reports/kpr.ts:72-88`:

```typescript
db.expense.findMany({
  where: {
    companyId,
    status: "PAID",
    paymentDate: {
      not: null,
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    },
  },
  orderBy: [{ paymentDate: "asc" }],
  select: {
    paymentDate: true,
    date: true,
    description: true,
    vendor: { select: { name: true } },
    totalAmount: true,
    netAmount: true,
    vatAmount: true,
  },
})
```

### ExpenseStatus Enum

Valid expense statuses → `prisma/schema.prisma:835-839`:

```prisma
enum ExpenseStatus {
  DRAFT      // Not yet approved
  PENDING    // Approved but not paid
  PAID       // Paid (included in KPR)
  CANCELLED  // Voided
}
```

## Security

### Authentication & Authorization

**User Authentication** → `src/app/(dashboard)/reports/kpr/page.tsx:17`:

- All pages require valid session via `requireAuth()`
- Unauthenticated requests redirected to `/login`

**Company Context** → `src/app/(dashboard)/reports/kpr/page.tsx:18`:

- User must belong to company via `requireCompany()`
- Multi-tenant isolation enforced at data layer

**API Security** → `src/app/api/reports/kpr/route.ts:7-8`:

- CSV export endpoint requires authentication
- PDF export endpoint requires authentication → `src/app/api/reports/kpr/pdf/route.ts:9-10`
- Excel export endpoint requires authentication → `src/app/api/reports/kpr/excel/route.ts:8-9`

### Data Access Controls

**Tenant Isolation**:

- All queries filtered by `companyId`
- User can only access their company's data
- No cross-company data leakage possible

**Query Example** → `src/lib/reports/kpr.ts:54-57`:

```typescript
db.eInvoice.findMany({
  where: {
    companyId, // Tenant filter
    direction: "OUTBOUND",
    paidAt: { not: null },
  },
  // ...
})
```

**No Direct Database Access**:

- All data fetched via authenticated API routes
- Client cannot bypass server-side filters
- URL parameters sanitized and validated

## UI Components

### Main Report Page

**Location**: `/reports/kpr` → `src/app/(dashboard)/reports/kpr/page.tsx:61-236`

**Layout Structure**:

1. **Header Section** → lines 62-69
   - Breadcrumb: "Paušalni obrt — knjiga prometa / PO-SD"
   - Page title: "KPR i PO-SD"
   - Description text

2. **Filters Card** → lines 71, 261-334
   - Quick preset buttons (6 presets)
   - Custom date range inputs
   - Apply and reset buttons

3. **Two-Column Grid** → line 73
   - Left: Transaction table (wider, 1.3fr)
   - Right: Summary sidebar (narrower, 0.7fr)

4. **Transaction Table Card** → lines 74-138
   - Card header with title and transaction count badge
   - Monthly sections with accordion-style display
   - Per-month summary: Income / Expense = Net
   - Expandable transaction table for each month

5. **Summary Card** → lines 141-233
   - Period display
   - Total income (green card)
   - Total expense (red card)
   - Net income/loss (blue/orange card)
   - Quarterly breakdown (if applicable)
   - Export buttons (PDF, Excel, CSV, PO-SD XML)

### Filters Component

**Location**: `src/app/(dashboard)/reports/kpr/page.tsx:261-334`

**Quick Presets Section** → lines 273-294:

- Grid layout: 2 columns on mobile, 3 on tablet, 6 on desktop
- Each preset is a link button
- Outline variant for secondary styling
- Small size for compact display

**Preset Buttons**:

```tsx
<Button variant="outline" size="sm" asChild>
  <Link href="/reports/kpr?preset=thisMonth">Ovaj mjesec</Link>
</Button>
```

**Custom Date Range Section** → lines 298-330:

- Border-top separator from presets
- Form with 3-column grid on desktop
- Two date inputs: "Od datuma" and "Do datuma"
- Submit button: "Primijeni"
- Reset button: "Poništi" (links back to `/reports/kpr`)

**Date Input**:

```tsx
<input
  id="from"
  type="date"
  name="from"
  defaultValue={fromVal}
  className="h-10 w-full rounded-md border border-border bg-background px-3"
/>
```

### Transaction Table

**Location**: `src/app/(dashboard)/reports/kpr/page.tsx:104-133`

**Table Structure**:

- Responsive: Horizontal scroll on small screens
- Rounded borders with muted background
- Sticky header with uppercase labels

**Columns**:

1. **Rb.** (Row number) - 7% width, muted text
2. **Datum** (Date) - 12% width, Croatian format
3. **Dokument** (Document) - 15% width, monospace font
4. **Opis** (Description) - 30% width, muted text
5. **Primitak** (Income) - 12% width, right-aligned, green text
6. **Izdatak** (Expense) - 12% width, right-aligned, red text
7. **Saldo** (Balance) - 12% width, right-aligned, bold

**Row Rendering** → lines 117-131:

```tsx
<tr key={idx} className="border-t border-border/80">
  <td className="px-3 py-2 text-muted-foreground">{summary.rows.indexOf(r) + 1}</td>
  <td className="px-3 py-2">{fmt(r.date)}</td>
  <td className="px-3 py-2 font-mono text-xs text-foreground">{r.documentNumber}</td>
  <td className="px-3 py-2 text-muted-foreground">{r.description}</td>
  <td className="px-3 py-2 text-right text-green-600">
    {r.income > 0 ? formatCurrency(r.income) : "—"}
  </td>
  <td className="px-3 py-2 text-right text-red-600">
    {r.expense > 0 ? formatCurrency(r.expense) : "—"}
  </td>
  <td className="px-3 py-2 text-right font-semibold">{formatCurrency(r.balance)}</td>
</tr>
```

### Month Section Card

**Location**: `src/app/(dashboard)/reports/kpr/page.tsx:87-136`

**Structure** → lines 87-102:

- Rounded border card
- Month header with name and transaction count
- Summary line: "+Income / -Expense = Net"
- Color-coded: green for income, red for expense, green/red for net

**Month Header**:

```tsx
<div className="flex items-center justify-between">
  <div className="flex items-center gap-2">
    <p className="text-sm font-semibold text-foreground">{getMonthName(month)}</p>
    <Badge variant="outline">{group.rows.length} transakcija</Badge>
  </div>
  <div className="text-sm font-semibold text-foreground">
    <span className="text-green-600">+{formatCurrency(group.totalIncome)}</span>
    {" / "}
    <span className="text-red-600">-{formatCurrency(group.totalExpense)}</span>
    {" = "}
    <span className={group.netIncome >= 0 ? "text-green-600" : "text-red-600"}>
      {formatCurrency(group.netIncome)}
    </span>
  </div>
</div>
```

### Summary Cards

**Location**: `src/app/(dashboard)/reports/kpr/page.tsx:147-178`

**Period Card** → lines 147-151:

- Muted background with border
- Period text: "od DD.MM.YYYY do DD.MM.YYYY"
- Transaction count

**Income Card** → lines 153-156:

- Green background and border
- Label: "Primitak (Prihod)"
- Large bold amount (2xl text)

**Expense Card** → lines 158-161:

- Red background and border
- Label: "Izdatak (Trošak)"
- Large bold amount

**Net Profit/Loss Card** → lines 163-178:

- Dynamic color: Blue for profit, orange for loss
- Label: "Neto Dobit" or "Neto Gubitak"
- Absolute value displayed

### Export Buttons

**Location**: `src/app/(dashboard)/reports/kpr/page.tsx:194-227`

**Button Layout** → lines 196-227:

- Vertical flex column with gap
- Four export options
- Outline variant for secondary styling
- Small size for compact display
- Icons from lucide-react

**Export Options**:

1. **PDF izvoz** → lines 197-202
   - FileText icon
   - Links to `/api/reports/kpr/pdf?from={from}&to={to}`

2. **Excel izvoz** → lines 203-208
   - FileSpreadsheet icon
   - Links to `/api/reports/kpr/excel?from={from}&to={to}`

3. **CSV izvoz** → lines 209-214
   - Download icon
   - Links to `/api/reports/kpr?from={from}&to={to}`

4. **PO-SD XML** → lines 215-226
   - Download icon
   - Data URI download (client-side)
   - XML string encoded with `encodeURIComponent()`

**Helper Text** → lines 228-230:

```tsx
<p className="text-xs text-muted-foreground">
  PDF i Excel uključuju potpuni pregled s mjesečnim i kvartalnim sažetkom.
</p>
```

## Dependencies

- **Depends on**:
  - [[auth-login]] - User authentication required for all pages and APIs
  - [[company-management]] - Company context required for multi-tenancy
  - [[e-invoicing-create]] - Source of income transactions (paid invoices)
  - [[expenses-create]] - Source of expense transactions
  - [[invoicing-mark-paid]] - Invoice payment tracking (paidAt field)
  - [[expenses-mark-paid]] - Expense payment tracking (paymentDate field)

- **Depended by**:
  - [[reports-dashboard]] - Main reports page links to KPR report
  - [[accountant-export]] - May reference KPR data for comprehensive export
  - [[tax-filing]] - PO-SD XML used for Croatian tax submissions

## Integrations

### Internal Systems

1. **Invoice Management** → `src/lib/reports/kpr.ts:52-69`
   - Queries paid OUTBOUND invoices via Prisma
   - Fetches buyer contact information
   - Uses `paidAt` field for transaction date

2. **Expense Management** → `src/lib/reports/kpr.ts:71-88`
   - Queries PAID expenses via Prisma
   - Fetches vendor contact information
   - Uses `paymentDate` field for transaction date

3. **Multi-Tenancy** → `src/lib/auth-utils.ts`
   - Enforces company isolation via `requireCompany()`
   - All queries filtered by `companyId`
   - User context validated on every request

4. **PDF Generation** → `@react-pdf/renderer`
   - React components converted to PDF
   - Landscape A4 layout for wide tables
   - Professional styling with Croatian labels

5. **Date Handling** → Native JavaScript Date
   - Server-side date calculations for presets
   - Quarter logic: `Math.ceil(month / 3)`
   - Croatian locale formatting: `toLocaleDateString("hr-HR")`

### External Standards

1. **Croatian Tax Compliance**
   - KPR format follows Croatian accounting standards
   - PO-SD XML for paušalni obrt tax filing
   - Mandatory for all sole proprietors in Croatia

2. **CSV Standards**
   - RFC 4180 compliant CSV generation
   - Proper escaping of quotes and commas
   - UTF-8 encoding for Croatian characters

3. **PDF/A Standard**
   - react-pdf generates PDF 1.4 compatible documents
   - Suitable for long-term archival
   - Print-ready with embedded fonts

## Verification Checklist

- [x] User can access KPR report page at /reports/kpr
- [x] System aggregates paid OUTBOUND invoices as income
- [x] System aggregates PAID expenses as expenditures
- [x] Transactions sorted chronologically by payment date
- [x] Running balance calculated correctly for each row
- [x] Transactions grouped by month with subtotals
- [x] Transactions grouped by quarter with subtotals
- [x] Quick preset filters work (this month, last month, etc.)
- [x] Custom date range filters work (from/to inputs)
- [x] CSV export includes all required columns
- [x] PDF export renders properly in landscape A4
- [x] Excel export includes monthly and quarterly breakdowns
- [x] PO-SD XML export generates valid XML structure
- [x] Croatian locale formatting applied (dates, currency)
- [x] Multi-tenant isolation enforced on all queries
- [x] Authentication required for all pages and APIs
- [x] Summary cards display correct totals
- [x] Empty state handled when no transactions exist
- [x] Month names displayed in Croatian
- [x] Color coding: green for income, red for expenses
- [x] Export buttons link to correct API endpoints
- [x] File downloads use appropriate Content-Disposition headers
- [x] Company OIB included in exported filenames

## Evidence Links

1. `src/app/(dashboard)/reports/kpr/page.tsx:16-236` - Main KPR report page with filters and UI
2. `src/lib/reports/kpr.ts:51-205` - Core data aggregation function (fetchKpr)
3. `src/lib/reports/kpr.ts:52-69` - Paid invoices query for income
4. `src/lib/reports/kpr.ts:71-88` - Paid expenses query for expenditures
5. `src/lib/reports/kpr.ts:90-117` - Conversion to unified KPR rows
6. `src/lib/reports/kpr.ts:119-131` - Running balance calculation
7. `src/lib/reports/kpr.ts:138-160` - Monthly aggregation logic
8. `src/lib/reports/kpr.ts:162-186` - Quarterly aggregation logic
9. `src/lib/reports/kpr.ts:207-242` - CSV export formatter (kprToCsv)
10. `src/lib/reports/kpr.ts:272-291` - PO-SD XML generator
11. `src/lib/reports/kpr-pdf.tsx:168-286` - React-PDF document component
12. `src/lib/reports/kpr-excel.ts:7-156` - Excel-enhanced CSV formatter
13. `src/app/api/reports/kpr/route.ts:5-31` - CSV export API endpoint
14. `src/app/api/reports/kpr/pdf/route.ts:7-47` - PDF export API endpoint
15. `src/app/api/reports/kpr/excel/route.ts:6-34` - Excel export API endpoint
16. `src/app/(dashboard)/reports/page.tsx:16-17` - Reports dashboard with KPR link
17. `src/components/documents/reports-sidebar.tsx:13` - Sidebar navigation entry
18. `src/app/(dashboard)/reports/kpr/page.tsx:27-52` - Date preset logic
19. `src/app/(dashboard)/reports/kpr/page.tsx:261-334` - Filters component
20. `src/app/(dashboard)/reports/kpr/page.tsx:86-136` - Monthly sections rendering
21. `src/app/(dashboard)/reports/kpr/page.tsx:141-233` - Summary card with export buttons
22. `prisma/schema.prisma:173-259` - EInvoice model with paidAt field
23. `prisma/schema.prisma:345-374` - Expense model with paymentDate field
24. `prisma/schema.prisma:835-839` - ExpenseStatus enum with PAID status
25. `src/lib/reports/kpr-generator.ts:51-191` - Legacy KPR generator with VAT breakdown
26. `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:1-100` - Paušalni obrt context page
