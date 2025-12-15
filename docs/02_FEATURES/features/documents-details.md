# Feature: Document Details - F076

## Status

- Documentation: Complete
- Last verified: 2025-12-15
- Evidence count: 14

## Purpose

Provides detailed view functionality for all document types (invoices, e-invoices, bank statements, and expenses) in FiskAI. This feature implements intelligent routing that automatically detects the document type and redirects to the appropriate detail page, along with specialized detail views for each document type with type-specific actions and information display.

## User Entry Points

| Type   | Path                                | Evidence                                                    |
| ------ | ----------------------------------- | ----------------------------------------------------------- |
| Router | `/documents/:id`                    | `src/app/(dashboard)/documents/[id]/page.tsx:10-58`         |
| Detail | `/invoices/:id`                     | `src/app/(dashboard)/invoices/[id]/page.tsx:32-257`         |
| Detail | `/e-invoices/:id`                   | `src/app/(dashboard)/e-invoices/[id]/page.tsx:36-299`       |
| Detail | `/banking/documents/:id`            | `src/app/(dashboard)/banking/documents/[id]/page.tsx:10-62` |
| Detail | `/expenses/:id`                     | `src/app/(dashboard)/expenses/[id]/page.tsx:24-116`         |
| API    | `/api/invoices/:id/pdf`             | `src/app/api/invoices/[id]/pdf/route.ts:11-167`             |
| API    | `/api/banking/import/jobs/:id/file` | `src/app/api/banking/import/jobs/[id]/file/route.ts:9-49`   |

## Core Flow

### Document Router Flow

1. User clicks document link from unified documents list -> `src/app/(dashboard)/documents/page.tsx:134,176`
2. System routes to `/documents/:id` -> `src/app/(dashboard)/documents/[id]/page.tsx:10`
3. Router checks eInvoice table for invoice types -> `src/app/(dashboard)/documents/[id]/page.tsx:23-34`
4. If found and type is E_INVOICE, redirect to `/e-invoices/:id` -> `src/app/(dashboard)/documents/[id]/page.tsx:29-30`
5. If found and type is INVOICE/QUOTE/PROFORMA, redirect to `/invoices/:id` -> `src/app/(dashboard)/documents/[id]/page.tsx:32`
6. Router checks ImportJob table for bank statements -> `src/app/(dashboard)/documents/[id]/page.tsx:37-44`
7. If found, redirect to `/banking/documents/:id` -> `src/app/(dashboard)/documents/[id]/page.tsx:43`
8. Router checks Expense table -> `src/app/(dashboard)/documents/[id]/page.tsx:47-54`
9. If found, redirect to `/expenses/:id` -> `src/app/(dashboard)/documents/[id]/page.tsx:53`
10. If not found anywhere, return 404 -> `src/app/(dashboard)/documents/[id]/page.tsx:57`

### Invoice Detail Flow

1. System fetches invoice with all relationships -> `src/app/(dashboard)/invoices/[id]/page.tsx:46-59`
2. Includes: buyer, seller, lines, conversion history, fiscal requests -> `src/app/(dashboard)/invoices/[id]/page.tsx:48-58`
3. Fiscal certificate status checked -> `src/app/(dashboard)/invoices/[id]/page.tsx:66-72`
4. Header displays invoice number, type badge, status badge -> `src/app/(dashboard)/invoices/[id]/page.tsx:84-92`
5. Conversion info shows source/derived documents -> `src/app/(dashboard)/invoices/[id]/page.tsx:106-134`
6. Buyer card displays contact details -> `src/app/(dashboard)/invoices/[id]/page.tsx:138-158`
7. Invoice details card shows dates and fiscal status -> `src/app/(dashboard)/invoices/[id]/page.tsx:161-186`
8. Line items table renders all products/services -> `src/app/(dashboard)/invoices/[id]/page.tsx:190-220`
9. Totals card calculates net, VAT, and gross amounts -> `src/app/(dashboard)/invoices/[id]/page.tsx:223-242`
10. Notes section displays if present -> `src/app/(dashboard)/invoices/[id]/page.tsx:245-254`
11. Action toolbar provides operations based on status -> `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:103-135`

### E-Invoice Detail Flow

1. System fetches e-invoice with relationships -> `src/app/(dashboard)/e-invoices/[id]/page.tsx:41-53`
2. Header shows invoice number and status badge -> `src/app/(dashboard)/e-invoices/[id]/page.tsx:62-78`
3. Actions toolbar displayed with status-dependent options -> `src/app/(dashboard)/e-invoices/[id]/detail-actions.tsx:100-135`
4. Seller/buyer cards show party information -> `src/app/(dashboard)/e-invoices/[id]/page.tsx:92-128`
5. Line items table with calculations -> `src/app/(dashboard)/e-invoices/[id]/page.tsx:131-171`
6. Summary card shows totals -> `src/app/(dashboard)/e-invoices/[id]/page.tsx:177-195`
7. Details card shows dates and direction -> `src/app/(dashboard)/e-invoices/[id]/page.tsx:198-224`
8. Fiscalization card displays JIR/ZKI if present -> `src/app/(dashboard)/e-invoices/[id]/page.tsx:227-253`
9. Error card shown if provider error exists -> `src/app/(dashboard)/e-invoices/[id]/page.tsx:256-265`
10. History card shows timestamps -> `src/app/(dashboard)/e-invoices/[id]/page.tsx:268-294`

### Bank Statement Detail Flow

1. System fetches ImportJob with full relations -> `src/app/(dashboard)/banking/documents/[id]/page.tsx:20-33`
2. Includes: statement, pages, transactions, bank account -> `src/app/(dashboard)/banking/documents/[id]/page.tsx:22-32`
3. Header displays filename, account, and status -> `src/app/(dashboard)/banking/documents/[id]/page.tsx:44-52`
4. Split-screen layout loads document viewer -> `src/app/(dashboard)/banking/documents/[id]/ui/document-detail.tsx:76-104`
5. Left panel shows PDF or image preview -> `src/app/(dashboard)/banking/documents/[id]/ui/document-detail.tsx:82-103`
6. Right panel displays editable transaction table -> `src/app/(dashboard)/banking/documents/[id]/ui/document-detail.tsx:106-204`
7. User can edit date, description, reference, amount -> `src/app/(dashboard)/banking/documents/[id]/ui/document-detail.tsx:134-189`
8. Save button updates transactions -> `src/app/(dashboard)/banking/documents/[id]/ui/document-detail.tsx:33-63`
9. Verify button marks document as verified -> `src/app/(dashboard)/banking/documents/[id]/ui/document-detail.tsx:65-73`
10. Status indicator shows verification state -> `src/app/(dashboard)/banking/documents/[id]/ui/document-detail.tsx:107-119`

### Expense Detail Flow

1. System fetches expense with relations -> `src/app/(dashboard)/expenses/[id]/page.tsx:35-41`
2. Includes: vendor, category -> `src/app/(dashboard)/expenses/[id]/page.tsx:38-40`
3. Header shows description and category -> `src/app/(dashboard)/expenses/[id]/page.tsx:54-55`
4. Details card displays status, dates, payment method -> `src/app/(dashboard)/expenses/[id]/page.tsx:64-77`
5. Vendor card shows supplier information -> `src/app/(dashboard)/expenses/[id]/page.tsx:79-92`
6. Amounts card shows net, VAT (deductible status), total -> `src/app/(dashboard)/expenses/[id]/page.tsx:95-106`
7. Notes section displays if present -> `src/app/(dashboard)/expenses/[id]/page.tsx:108-113`
8. Actions toolbar provides mark paid and delete options -> `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:41-58`

## Key Modules

| Module                 | Purpose                                      | Location                                                            |
| ---------------------- | -------------------------------------------- | ------------------------------------------------------------------- |
| DocumentDetailRouter   | Intelligent routing to correct detail page   | `src/app/(dashboard)/documents/[id]/page.tsx`                       |
| InvoiceDetailPage      | Full invoice detail view with actions        | `src/app/(dashboard)/invoices/[id]/page.tsx`                        |
| EInvoiceDetailPage     | E-invoice detail with fiscalization status   | `src/app/(dashboard)/e-invoices/[id]/page.tsx`                      |
| BankDocumentDetailPage | Bank statement viewer with verification      | `src/app/(dashboard)/banking/documents/[id]/page.tsx`               |
| ExpenseDetailPage      | Expense detail with payment tracking         | `src/app/(dashboard)/expenses/[id]/page.tsx`                        |
| InvoiceActions         | Invoice action toolbar (PDF, email, convert) | `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx`             |
| InvoiceDetailActions   | E-invoice actions (send, mark paid, delete)  | `src/app/(dashboard)/e-invoices/[id]/detail-actions.tsx`            |
| DocumentDetail         | Split-screen document viewer with editing    | `src/app/(dashboard)/banking/documents/[id]/ui/document-detail.tsx` |
| ExpenseActions         | Expense actions (mark paid, delete)          | `src/app/(dashboard)/expenses/[id]/expense-actions.tsx`             |
| FiscalStatusBadge      | Fiscalization status display with JIR/ZKI    | `src/app/(dashboard)/invoices/[id]/fiscal-status-badge.tsx`         |
| InvoicePDFRoute        | PDF generation and download endpoint         | `src/app/api/invoices/[id]/pdf/route.ts`                            |
| FileRoute              | Serves original uploaded bank documents      | `src/app/api/banking/import/jobs/[id]/file/route.ts`                |

## Data

### Database Queries

#### Document Router Queries

Sequential queries to find document type -> `src/app/(dashboard)/documents/[id]/page.tsx:23-54`

```typescript
// Check invoices
const invoice = await db.eInvoice.findUnique({
  where: { id },
  select: { id: true, type: true, companyId: true },
})

// Check bank statements
const importJob = await db.importJob.findUnique({
  where: { id },
  select: { id: true, companyId: true },
})

// Check expenses
const expense = await db.expense.findUnique({
  where: { id },
  select: { id: true, companyId: true },
})
```

#### Invoice Detail Query

Full invoice with relationships -> `src/app/(dashboard)/invoices/[id]/page.tsx:46-59`

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

#### Bank Statement Detail Query

Import job with full statement data -> `src/app/(dashboard)/banking/documents/[id]/page.tsx:20-33`

```typescript
const job = await db.importJob.findUnique({
  where: { id },
  include: {
    statement: {
      include: {
        pages: {
          orderBy: { pageNumber: "asc" },
        },
        transactions: true,
      },
    },
    bankAccount: { select: { name: true, iban: true } },
  },
})
```

#### Expense Detail Query

Expense with vendor and category -> `src/app/(dashboard)/expenses/[id]/page.tsx:35-41`

```typescript
const expense = await db.expense.findFirst({
  where: { id, companyId: company.id },
  include: {
    vendor: true,
    category: true,
  },
})
```

### Actions per Document Type

#### Invoice Actions

Available actions based on document type and status -> `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:15-136`

- **Download PDF**: Always available -> `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:57-86`
  - Generates PDF via `/api/invoices/:id/pdf`
  - Includes JIR/ZKI if fiscalized
  - Filename format: `racun-{invoiceNumber}.pdf`

- **Send Email**: Available for FISCALIZED, SENT, DELIVERED with buyer email -> `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:88-101`
  - Sends PDF attachment via Resend
  - Updates sentAt timestamp
  - Action: `sendInvoiceEmail` -> `src/app/actions/e-invoice.ts:348-445`

- **Convert to Invoice**: Available for QUOTE and PROFORMA types -> `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:123-127`
  - Creates new INVOICE from source
  - Links via convertedFromId
  - Action: `convertToInvoice` -> `src/app/actions/invoice.ts:117-191`

- **Delete**: Available only for DRAFT status -> `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:129-133`
  - Requires confirmation
  - Prevents deletion if converted to other documents
  - Action: `deleteInvoice` -> `src/app/actions/invoice.ts:269-306`

#### E-Invoice Actions

Status-dependent actions -> `src/app/(dashboard)/e-invoices/[id]/detail-actions.tsx:100-135`

- **Edit**: Available for DRAFT status -> `src/app/(dashboard)/e-invoices/[id]/detail-actions.tsx:102-106`
  - Navigates to `/e-invoices/:id/edit`

- **Send**: Available for DRAFT and ERROR status -> `src/app/(dashboard)/e-invoices/[id]/detail-actions.tsx:108-112`
  - Requires e-invoice provider configuration
  - Generates UBL XML
  - Queues fiscalization if needed
  - Action: `sendEInvoice` -> `src/app/actions/e-invoice.ts:129-220`

- **Mark as Paid**: Available for FISCALIZED, SENT, DELIVERED (unpaid) -> `src/app/(dashboard)/e-invoices/[id]/detail-actions.tsx:114-123`
  - Sets paidAt timestamp
  - Updates status to ACCEPTED
  - Action: `markInvoiceAsPaid` -> `src/app/actions/e-invoice.ts:309-346`

- **Delete**: Available for DRAFT status -> `src/app/(dashboard)/e-invoices/[id]/detail-actions.tsx:125-133`
  - Requires confirmation
  - Action: `deleteEInvoice` -> `src/app/actions/e-invoice.ts:285-306`

#### Bank Statement Actions

Verification workflow -> `src/app/(dashboard)/banking/documents/[id]/ui/document-detail.tsx:33-73`

- **Edit Transactions**: Always available -> `src/app/(dashboard)/banking/documents/[id]/ui/document-detail.tsx:134-189`
  - Editable fields: date, description, reference, amount
  - Changes tracked in local state

- **Save Changes**: Persists transaction edits -> `src/app/(dashboard)/banking/documents/[id]/ui/document-detail.tsx:33-63`
  - Updates transactions via PATCH `/api/banking/import/jobs/:id`
  - Shows success/error message

- **Mark as Verified**: Confirms document accuracy -> `src/app/(dashboard)/banking/documents/[id]/ui/document-detail.tsx:65-73`
  - Saves changes first
  - Updates job status to VERIFIED via POST `/api/banking/import/jobs/:id/status`

#### Expense Actions

Payment tracking -> `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:10-59`

- **Mark as Paid**: Available for non-PAID, non-CANCELLED status -> `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:43-55`
  - Dropdown with payment methods: CASH, CARD, TRANSFER, OTHER
  - Sets paymentDate and paymentMethod
  - Updates status to PAID
  - Action: `markExpenseAsPaid` -> `src/app/actions/expense.ts:181-218`

- **Delete**: Always available -> `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:56`
  - Requires confirmation
  - Action: `deleteExpense` -> `src/app/actions/expense.ts:151-179`

## Dependencies

### Depends On

- **Authentication System**: User and company context -> `src/lib/auth-utils.ts:requireAuth, requireCompany`
- **Tenant Context**: Multi-tenant data isolation -> `src/lib/prisma-extensions.ts:setTenantContext`
- **Contact Management**: Buyer/seller/vendor information -> `prisma/schema.prisma:Contact`
- **Fiscal Certificate**: Fiscalization capability and status -> `prisma/schema.prisma:FiscalCertificate`
- **PDF Generation**: @react-pdf/renderer for invoice PDFs -> `src/app/api/invoices/[id]/pdf/route.ts:6-7`
- **Email Service**: Resend for invoice delivery -> `src/app/actions/e-invoice.ts:396-423`
- **File Storage**: Local filesystem for bank documents -> `src/app/api/banking/import/jobs/[id]/file/route.ts:27-48`

### Depended By

- **Unified Documents Hub**: Links to detail pages -> `src/app/(dashboard)/documents/page.tsx:134,176`
- **Dashboard Recent Activity**: Quick access to document details
- **Reports**: Detail links from financial reports
- **Banking Reconciliation**: Transaction detail access

## Integrations

### Internal Integrations

#### PDF Generation System

Invoice PDF rendering -> `src/app/api/invoices/[id]/pdf/route.ts:143-159`

- Uses @react-pdf/renderer for PDF creation
- Template: `InvoicePDFDocument` -> `src/lib/pdf/invoice-template`
- Includes JIR/ZKI fiscal codes when available
- Generates 2D barcode for HUB3 payments -> `src/app/api/invoices/[id]/pdf/route.ts:130-141`
- Content-Type: application/pdf
- Filename format: `racun-{invoiceNumber}.pdf`

#### File Serving System

Bank document preview -> `src/app/api/banking/import/jobs/[id]/file/route.ts:9-49`

- Serves original uploaded documents
- MIME type detection via mime-types package
- Inline display with original filename
- Supports PDF, images (JPG, PNG, HEIC), XML
- Access control via tenant validation

#### Fiscalization Integration

Fiscal status tracking -> `src/app/(dashboard)/invoices/[id]/fiscal-status-badge.tsx:19-166`

- Displays JIR (Jedinstveni Identifikator Računa)
- Displays ZKI (Zaštitni Kod Izdavatelja)
- Shows fiscalization timestamp
- Tracks fiscal request status: QUEUED, PROCESSING, FAILED, DEAD
- Allows manual retry for failed requests
- Shows error messages and codes

#### Email Delivery System

Invoice email with PDF attachment -> `src/app/actions/e-invoice.ts:348-445`

- Template: `InvoiceEmail` -> `src/lib/email/templates/invoice-email`
- Generates PDF via `/api/invoices/:id/pdf`
- Attaches PDF to email
- Tracks email message ID for webhooks
- Updates sentAt timestamp
- Supports B2B vs B2C messaging

### External Integrations

#### Croatian Fiscal System (CIS)

Fiscalization status display -> `src/app/(dashboard)/invoices/[id]/fiscal-status-badge.tsx:26-46`

- JIR: Unique invoice identifier from tax authority
- ZKI: Protective code for offline validation
- Real-time fiscalization status tracking
- Manual fiscalization trigger available

#### Payment Barcode (HUB3)

2D barcode generation -> `src/app/api/invoices/[id]/pdf/route.ts:130-141`

- Croatian banking standard for payments
- Includes: creditor name, IBAN, amount, currency, reference
- Embedded in PDF for easy scanning
- Library: `generateInvoiceBarcodeDataUrl` -> `src/lib/barcode`

## Verification Checklist

### Document Router

- [ ] Accessing `/documents/:id` for invoice redirects to `/invoices/:id`
- [ ] Accessing `/documents/:id` for e-invoice redirects to `/e-invoices/:id`
- [ ] Accessing `/documents/:id` for bank statement redirects to `/banking/documents/:id`
- [ ] Accessing `/documents/:id` for expense redirects to `/expenses/:id`
- [ ] Unknown document ID returns 404 page
- [ ] All redirects preserve tenant isolation (companyId check)

### Invoice Detail View

- [ ] Header displays invoice number, type badge, status badge
- [ ] Internal reference shown if present
- [ ] Conversion info shows source document if converted from quote/proforma
- [ ] Conversion info shows derived documents if converted to invoices
- [ ] Buyer card displays name, OIB, address correctly
- [ ] Invoice details card shows issue date and due date
- [ ] Fiscal status badge displays JIR and ZKI when fiscalized
- [ ] Line items table shows all products with correct calculations
- [ ] Totals card displays net amount, VAT, and total
- [ ] Currency formatting uses hr-HR locale
- [ ] Notes section displays when notes exist
- [ ] Back button returns to documents list

### Invoice Actions

- [ ] PDF download button generates and downloads PDF
- [ ] PDF includes JIR/ZKI when fiscalized
- [ ] Email button only appears for fiscalized invoices with buyer email
- [ ] Email confirmation shows recipient address
- [ ] Convert button only appears for QUOTE and PROFORMA types
- [ ] Delete button only appears for DRAFT status
- [ ] Delete requires confirmation and prevents conversion chain deletion
- [ ] Manual fiscalization button appears when certificate active

### E-Invoice Detail View

- [ ] Header shows invoice number and status badge with correct colors
- [ ] Seller card displays company information
- [ ] Buyer card displays contact information or placeholder
- [ ] Line items table shows quantity, unit, price, VAT, and totals
- [ ] Summary card displays net, VAT, and total amounts
- [ ] Details card shows issue date, due date, buyer reference
- [ ] Direction displays as "Izlazni" or "Ulazni"
- [ ] Fiscalization card shows JIR and ZKI when present
- [ ] Error card displays when provider error exists
- [ ] History card shows created, sent, updated, paid timestamps

### E-Invoice Actions

- [ ] Edit button only appears for DRAFT status
- [ ] Send button appears for DRAFT and ERROR status
- [ ] Send requires e-invoice provider configuration
- [ ] Mark as paid button appears for fiscalized unpaid invoices
- [ ] Mark as paid confirmation shows before action
- [ ] Delete button only appears for DRAFT status
- [ ] All actions show loading states during execution

### Bank Statement Detail View

- [ ] Split-screen layout displays document and data
- [ ] PDF documents render in left panel
- [ ] Image documents display correctly in left panel
- [ ] XML documents show "preview not available" message
- [ ] Transaction table allows editing all fields
- [ ] Date picker works correctly
- [ ] Amount and description fields accept edits
- [ ] Save button persists changes to database
- [ ] Verify button updates job status to VERIFIED
- [ ] Status indicator shows verification state with icons
- [ ] Success messages display after save/verify

### Expense Detail View

- [ ] Header shows description and category name
- [ ] Details card displays status badge with correct color
- [ ] Details card shows expense date and payment date
- [ ] Due date displays if set
- [ ] Payment method displays with Croatian labels
- [ ] Vendor card shows supplier name, OIB, address
- [ ] Amounts card shows net amount, VAT, and total
- [ ] VAT deductible status indicated (priznati/nepriznati)
- [ ] Notes section displays when notes exist
- [ ] Back button returns to expenses list

### Expense Actions

- [ ] Mark paid dropdown shows payment method options
- [ ] Payment methods: CASH, CARD, TRANSFER, OTHER
- [ ] Marking as paid sets paymentDate and updates status
- [ ] Mark paid unavailable for already PAID expenses
- [ ] Delete button requires confirmation
- [ ] Delete action removes expense from database
- [ ] Actions show loading states during execution

### Data Integrity

- [ ] All queries filter by companyId (tenant isolation)
- [ ] Invoice totals match sum of line items
- [ ] Bank statement transactions match extracted data
- [ ] Expense amounts are correctly formatted
- [ ] Fiscal codes (JIR/ZKI) display correctly
- [ ] File paths for bank documents are valid
- [ ] PDF generation handles missing data gracefully
- [ ] Email sending validates buyer email presence

## Evidence Links

1. `src/app/(dashboard)/documents/[id]/page.tsx:10-58` - Document router with type detection and redirects
2. `src/app/(dashboard)/invoices/[id]/page.tsx:32-257` - Full invoice detail page with all sections
3. `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx:15-136` - Invoice action toolbar with PDF, email, convert, delete
4. `src/app/(dashboard)/invoices/[id]/fiscal-status-badge.tsx:19-166` - Fiscal status display with JIR/ZKI
5. `src/app/(dashboard)/e-invoices/[id]/page.tsx:36-299` - E-invoice detail page with fiscalization info
6. `src/app/(dashboard)/e-invoices/[id]/detail-actions.tsx:18-136` - E-invoice actions with send and mark paid
7. `src/app/(dashboard)/banking/documents/[id]/page.tsx:10-62` - Bank statement detail page wrapper
8. `src/app/(dashboard)/banking/documents/[id]/ui/document-detail.tsx:27-207` - Split-screen document viewer with editing
9. `src/app/(dashboard)/expenses/[id]/page.tsx:24-116` - Expense detail page with vendor and category
10. `src/app/(dashboard)/expenses/[id]/expense-actions.tsx:10-59` - Expense actions with mark paid and delete
11. `src/app/api/invoices/[id]/pdf/route.ts:11-167` - PDF generation endpoint with barcode
12. `src/app/api/banking/import/jobs/[id]/file/route.ts:9-49` - File serving endpoint for bank documents
13. `src/app/actions/invoice.ts:117-306` - Invoice server actions (convert, delete)
14. `src/app/actions/e-invoice.ts:129-445` - E-invoice server actions (send, mark paid, email, delete)
