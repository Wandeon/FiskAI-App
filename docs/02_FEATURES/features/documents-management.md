# Feature: Document Management (F073)

## Status

- Documentation: Complete
- Last verified: 2025-12-15
- Evidence count: 15

## Purpose

Provides a unified hub for managing all company documents across multiple categories (invoices, e-invoices, bank statements, expenses) in a single interface. The feature consolidates previously fragmented document views into one centralized location at `/documents`, with category filtering, search capabilities, document upload, and real-time processing status tracking. This serves as the primary entry point for all document-related workflows in FiskAI.

## User Entry Points

| Type       | Path                                 | Evidence                                                |
| ---------- | ------------------------------------ | ------------------------------------------------------- |
| Navigation | `/documents`                         | `src/lib/navigation.ts:40-42`                           |
| Filter     | `/documents?category=invoice`        | `src/components/documents/category-cards.tsx:54`        |
| Filter     | `/documents?category=e-invoice`      | `src/components/documents/category-cards.tsx:54`        |
| Filter     | `/documents?category=bank-statement` | `src/components/documents/category-cards.tsx:54`        |
| Filter     | `/documents?category=expense`        | `src/components/documents/category-cards.tsx:54`        |
| Search     | `/documents?search=term`             | `src/app/(dashboard)/documents/page.tsx:92`             |
| Detail     | `/documents/:id`                     | `src/app/(dashboard)/documents/[id]/page.tsx:10`        |
| Upload     | `/api/import/upload`                 | `src/app/api/import/upload/route.ts:14`                 |
| New        | `/invoices/new?type=INVOICE`         | `src/components/documents/new-document-dropdown.tsx:12` |
| New        | `/e-invoices/new`                    | `src/components/documents/new-document-dropdown.tsx:17` |
| New        | `/banking/import`                    | `src/components/documents/new-document-dropdown.tsx:23` |
| New        | `/expenses/new`                      | `src/components/documents/new-document-dropdown.tsx:30` |

## Core Flow

### Document Hub View Flow

1. User navigates to `/documents` via main navigation -> `src/lib/navigation.ts:40-42`
2. System authenticates user and loads company context -> `src/app/(dashboard)/documents/page.tsx:43-49`
3. Tenant context set for multi-tenant isolation -> `src/app/(dashboard)/documents/page.tsx:46-49`
4. Bank accounts fetched for dropzone account selector -> `src/app/(dashboard)/documents/page.tsx:52-60`
5. Pending/processing import jobs restored from database -> `src/app/(dashboard)/documents/page.tsx:63-88`
6. URL params parsed for category filter and search term -> `src/app/(dashboard)/documents/page.tsx:90-96`
7. Unified document query fetches all document types in parallel -> `src/lib/documents/unified-query.ts:110-153`
8. Documents normalized into common format with counts -> `src/lib/documents/unified-query.ts:156-225`
9. Documents sorted by date descending and paginated -> `src/lib/documents/unified-query.ts:215-224`
10. Category cards display with document counts per category -> `src/app/(dashboard)/documents/page.tsx:207`
11. Search bar allows filtering by document number/counterparty -> `src/app/(dashboard)/documents/page.tsx:210-225`
12. Responsive table displays documents with columns: date, category, number, counterparty, amount, status -> `src/app/(dashboard)/documents/page.tsx:108-180`
13. User clicks category card to filter by document type -> `src/components/documents/category-cards.tsx:54-60`
14. User clicks "Pregledaj" to view document details -> Detail Router Flow

### Document Upload Flow

1. User drops file on compact dropzone or clicks upload button -> `src/components/documents/compact-dropzone.tsx:29-40`
2. File validation checks format (PDF, XML, CSV, images) and size -> `src/app/api/import/upload/route.ts:35-47`
3. File read and checksum calculated (SHA-256) -> `src/app/api/import/upload/route.ts:49-50`
4. File stored in uploads/imports directory -> `src/app/api/import/upload/route.ts:52-57`
5. Document type detected from filename and content -> `src/lib/import/detect-document-type.ts:19-126`
6. ImportJob record created with PENDING status -> `src/app/api/import/upload/route.ts:64-75`
7. Background processing triggered via API call -> `src/app/api/import/upload/route.ts:77-86`
8. Job added to processing sidebar queue -> `src/components/documents/documents-client.tsx:86-98`
9. Sidebar auto-opens to show processing status -> `src/components/documents/documents-client.tsx:41-47`
10. Real-time polling updates job status every 2 seconds -> `src/components/documents/documents-client.tsx:50-81`
11. Processing card shows progress bar and status -> `src/components/import/processing-card.tsx:100-110`
12. User can change document type if detection was incorrect -> `src/components/import/processing-card.tsx:74-85`
13. When READY_FOR_REVIEW, user clicks "Pregledaj" -> Confirmation Flow
14. User confirms or rejects extracted data -> `src/components/documents/documents-client.tsx:158-191`
15. On confirm, data saved to appropriate tables and page refreshes -> `src/components/documents/documents-client.tsx:169-180`

### Camera Capture Flow (Mobile)

1. User clicks camera button on mobile device -> `src/components/documents/compact-dropzone.tsx:117-129`
2. Native camera input triggered with environment camera -> `src/components/documents/compact-dropzone.tsx:74-82`
3. User captures photo of document -> `src/components/documents/compact-dropzone.tsx:48-58`
4. Document scanner modal opens with captured image -> `src/components/documents/compact-dropzone.tsx:149-158`
5. User adjusts image boundaries and confirms -> `src/components/documents/compact-dropzone.tsx:42-46`
6. File uploaded via standard upload flow

### Detail Router Flow

1. User clicks document row "Pregledaj" link -> `src/app/(dashboard)/documents/page.tsx:174-177`
2. System navigates to `/documents/:id` -> `src/app/(dashboard)/documents/[id]/page.tsx:10`
3. Document type detected by checking each table in order -> `src/app/(dashboard)/documents/[id]/page.tsx:22-54`
4. For invoices: redirect to `/invoices/:id` or `/e-invoices/:id` -> `src/app/(dashboard)/documents/[id]/page.tsx:28-34`
5. For bank statements: redirect to `/banking/documents/:id` -> `src/app/(dashboard)/documents/[id]/page.tsx:36-44`
6. For expenses: redirect to `/expenses/:id` -> `src/app/(dashboard)/documents/[id]/page.tsx:46-54`
7. If not found: return 404 page -> `src/app/(dashboard)/documents/[id]/page.tsx:57`

### Category Filtering Flow

1. User clicks category card (e.g., "Računi") -> `src/components/documents/category-cards.tsx:56-60`
2. Navigation updates with category query param -> `src/components/documents/category-cards.tsx:54`
3. Page reloads with filtered category -> `src/app/(dashboard)/documents/page.tsx:96`
4. Unified query filters documents by category -> `src/lib/documents/unified-query.ts:204-212`
5. Active category card highlighted with blue background -> `src/components/documents/category-cards.tsx:62-64`
6. Document count badge shows filtered total -> `src/components/documents/category-cards.tsx:68-75`

### Search Flow

1. User types search term in search input -> `src/app/(dashboard)/documents/page.tsx:213-217`
2. User clicks "Traži" button or presses Enter -> `src/app/(dashboard)/documents/page.tsx:219-224`
3. Form submits to `/documents?search=term` -> `src/app/(dashboard)/documents/page.tsx:210`
4. Search applied to unified query for each document type -> `src/lib/documents/unified-query.ts:115-147`
5. Invoices: search invoice number and buyer name -> `src/lib/documents/unified-query.ts:115-120`
6. Bank statements: search original filename -> `src/lib/documents/unified-query.ts:128-131`
7. Expenses: search vendor and description -> `src/lib/documents/unified-query.ts:140-145`
8. Results displayed with "Nema rezultata" empty state if none found -> `src/app/(dashboard)/documents/page.tsx:232-236`

### Pagination Flow

1. System calculates total pages from document count -> `src/app/(dashboard)/documents/page.tsx:106`
2. Pagination controls shown if more than 1 page -> `src/app/(dashboard)/documents/page.tsx:298-320`
3. User clicks "Prethodna" or "Sljedeća" -> `src/app/(dashboard)/documents/page.tsx:300-317`
4. Navigation updates with page query param -> `src/app/(dashboard)/documents/page.tsx:182-188`
5. Query fetches appropriate page slice -> `src/lib/documents/unified-query.ts:222-224`
6. Current page indicator shows "Stranica X od Y" -> `src/app/(dashboard)/documents/page.tsx:308-310`

### New Document Creation Flow

1. User clicks "Novi dokument" dropdown button -> `src/components/documents/new-document-dropdown.tsx:66-75`
2. Dropdown menu shows 4 document type options -> `src/components/documents/new-document-dropdown.tsx:80-96`
3. User selects document type -> `src/components/documents/new-document-dropdown.tsx:83-95`
4. System navigates to appropriate creation route -> `src/components/documents/new-document-dropdown.tsx:12-33`
5. Dropdown closes on selection -> `src/components/documents/new-document-dropdown.tsx:86`

### Processing Sidebar Flow

1. Sidebar displays when active jobs exist -> `src/components/documents/documents-client.tsx:36-47`
2. Processing cards show file name, document type, status -> `src/components/import/processing-card.tsx:54-98`
3. Progress bar animates during PENDING/PROCESSING -> `src/components/import/processing-card.tsx:100-110`
4. Status icon spins during processing -> `src/components/import/processing-card.tsx:115`
5. User can change document type via dropdown -> `src/components/import/processing-card.tsx:74-85`
6. User can remove job from queue -> `src/components/import/processing-card.tsx:90-97`
7. When READY_FOR_REVIEW, "Pregledaj" button appears -> `src/components/import/processing-card.tsx:144-152`
8. When FAILED, "Pokušaj ponovo" button appears -> `src/components/import/processing-card.tsx:154-163`
9. Queue position shown for multiple ready jobs -> `src/components/import/processing-card.tsx:121-125`
10. Sidebar auto-closes when all jobs complete -> `src/components/documents/documents-client.tsx:44`

### Confirmation Modal Flow

1. User clicks "Pregledaj" on READY_FOR_REVIEW job -> `src/components/import/processing-card.tsx:147`
2. Job data fetched from API -> `src/components/documents/documents-client.tsx:145-156`
3. Confirmation modal opens with extracted data -> `src/components/documents/documents-client.tsx:280-304`
4. For bank statements: transactions table with edit capability -> `src/components/documents/documents-client.tsx:292-296`
5. For invoices: invoice fields with edit capability -> `src/components/documents/documents-client.tsx:301-302`
6. User can switch document type if incorrect -> `src/components/documents/documents-client.tsx:235-244`
7. User edits extracted data if needed -> `src/components/documents/documents-client.tsx:296, 302`
8. User clicks confirm button -> `src/components/documents/documents-client.tsx:284`
9. Data saved to database via confirm endpoint -> `src/app/api/import/jobs/[id]/confirm/route.ts:7-159`
10. Job status updated to CONFIRMED -> `src/components/documents/documents-client.tsx:170-176`
11. Page refreshes to show new document -> `src/components/documents/documents-client.tsx:180`
12. User can click "Discard" to reject -> `src/components/documents/documents-client.tsx:285`

## Key Modules

| Module                | Purpose                                       | Location                                             |
| --------------------- | --------------------------------------------- | ---------------------------------------------------- |
| DocumentsPage         | Main unified documents hub page               | `src/app/(dashboard)/documents/page.tsx`             |
| DocumentsClient       | Client-side state management and upload       | `src/components/documents/documents-client.tsx`      |
| DocumentDetailRouter  | Smart router to appropriate detail pages      | `src/app/(dashboard)/documents/[id]/page.tsx`        |
| CategoryCards         | Filterable document category cards            | `src/components/documents/category-cards.tsx`        |
| NewDocumentDropdown   | Dropdown menu for creating new documents      | `src/components/documents/new-document-dropdown.tsx` |
| CompactDropzone       | Drag-and-drop file upload with camera support | `src/components/documents/compact-dropzone.tsx`      |
| ReportsSidebar        | Processing queue sidebar                      | `src/components/documents/reports-sidebar.tsx`       |
| ProcessingCard        | Individual import job status card             | `src/components/import/processing-card.tsx`          |
| queryUnifiedDocuments | Fetches and normalizes all document types     | `src/lib/documents/unified-query.ts:106-237`         |
| detectDocumentType    | Automatic document type detection             | `src/lib/import/detect-document-type.ts:19-126`      |
| UploadRoute           | File upload API endpoint                      | `src/app/api/import/upload/route.ts`                 |
| JobRoute              | Job status query endpoint                     | `src/app/api/import/jobs/[id]/route.ts`              |
| ConfirmRoute          | Job confirmation and data save                | `src/app/api/import/jobs/[id]/confirm/route.ts`      |
| RejectRoute           | Job rejection endpoint                        | `src/app/api/import/jobs/[id]/reject/route.ts`       |
| TypeChangeRoute       | Document type change endpoint                 | `src/app/api/import/jobs/[id]/type/route.ts`         |
| ResponsiveTable       | Mobile-responsive table component             | `src/components/ui/responsive-table.tsx`             |

## Data

### Database Tables

#### ImportJob Table

Document import job tracking -> `prisma/schema.prisma:641-668`

Key fields:

- `id` (String, CUID): Unique identifier
- `companyId` (String): Tenant isolation
- `userId` (String): User who initiated import
- `bankAccountId` (String?): Associated bank account (for bank statements)
- `fileChecksum` (String): SHA-256 hash for duplicate detection
- `originalName` (String): Original filename
- `storagePath` (String): File system path to uploaded document
- `status` (JobStatus): PENDING, PROCESSING, READY_FOR_REVIEW, CONFIRMED, REJECTED, VERIFIED, NEEDS_REVIEW, FAILED -> `prisma/schema.prisma:885-894`
- `documentType` (DocumentType?): BANK_STATEMENT, INVOICE, EXPENSE -> `prisma/schema.prisma:902-906`
- `extractedData` (Json?): Raw AI extraction output
- `tierUsed` (TierType?): Processing tier used (XML, TEXT_LLM, VISION_LLM)
- `failureReason` (String?): Error message if failed
- `pagesProcessed` (Int): Number of pages successfully processed
- `pagesFailed` (Int): Number of pages that failed verification
- `createdAt` (DateTime): Upload timestamp
- `updatedAt` (DateTime): Last modification

Relations:

- `bankAccount` (BankAccount?): Associated bank account
- `company` (Company): Owner company
- `statement` (Statement?): Extracted statement data (for bank statements)

Indexes:

- `companyId`: Tenant filtering
- `bankAccountId`: Account filtering
- `status`: Status-based queries
- `bankAccountId, fileChecksum`: Duplicate detection

#### EInvoice Table

Invoice and e-invoice records -> `prisma/schema.prisma:191-226`

Key fields:

- `id` (String, CUID): Unique identifier
- `companyId` (String): Tenant isolation
- `direction` (EInvoiceDirection): OUTGOING or INCOMING
- `type` (InvoiceType): INVOICE, E_INVOICE, QUOTE, PROFORMA, CREDIT_NOTE, DEBIT_NOTE
- `invoiceNumber` (String): Invoice number
- `issueDate` (DateTime): Issue date
- `dueDate` (DateTime?): Payment due date
- `currency` (String): Currency code (default EUR)
- `netAmount` (Decimal): Net amount before VAT
- `vatAmount` (Decimal): VAT amount
- `totalAmount` (Decimal): Total amount including VAT
- `status` (EInvoiceStatus): DRAFT, SENT, FISCALIZED, DELIVERED, ACCEPTED, REJECTED, ARCHIVED, ERROR -> `prisma/schema.prisma:803-813`
- `buyerId` (String?): Buyer contact ID
- `sellerId` (String?): Seller contact ID

Relations:

- `buyer` (Contact?): Buyer contact
- `seller` (Contact?): Seller contact
- `company` (Company): Owner company
- `lines` (EInvoiceLine[]): Invoice line items

#### Expense Table

Expense records -> `prisma/schema.prisma:345-373`

Key fields:

- `id` (String, CUID): Unique identifier
- `companyId` (String): Tenant isolation
- `vendorId` (String?): Vendor contact ID
- `categoryId` (String): Expense category
- `description` (String): Expense description
- `date` (DateTime): Expense date
- `dueDate` (DateTime?): Payment due date
- `netAmount` (Decimal): Net amount before VAT
- `vatAmount` (Decimal): VAT amount
- `totalAmount` (Decimal): Total amount including VAT
- `vatDeductible` (Boolean): VAT deductibility flag
- `currency` (String): Currency code (default EUR)
- `status` (ExpenseStatus): DRAFT, PENDING, PAID, CANCELLED -> `prisma/schema.prisma:834-839`
- `receiptUrl` (String?): Link to receipt document
- `receiptNumber` (String?): Receipt number

Relations:

- `vendor` (Contact?): Vendor contact
- `category` (ExpenseCategory): Expense category
- `company` (Company): Owner company

### Document Categories

Categories for unified document view -> `src/lib/documents/unified-query.ts:5-27`

| Category       | Label (HR) | Source                       | Color                           |
| -------------- | ---------- | ---------------------------- | ------------------------------- |
| invoice        | Račun      | EInvoice (type != E_INVOICE) | bg-blue-100 text-blue-800       |
| e-invoice      | E-Račun    | EInvoice (type = E_INVOICE)  | bg-purple-100 text-purple-800   |
| bank-statement | Izvod      | ImportJob                    | bg-emerald-100 text-emerald-800 |
| expense        | Trošak     | Expense                      | bg-orange-100 text-orange-800   |

### UnifiedDocument Interface

Common document interface for display -> `src/lib/documents/unified-query.ts:8-19`

```typescript
interface UnifiedDocument {
  id: string
  category: DocumentCategory
  date: Date
  number: string
  counterparty: string | null
  amount: number | string // number for currency, string for "X str."
  currency: string | null
  status: string
  statusColor: "gray" | "blue" | "green" | "amber" | "red"
  detailUrl: string
}
```

### Document Type Detection

Automatic detection rules -> `src/lib/import/detect-document-type.ts:19-126`

| File Type | Pattern                         | Detected Type  | Confidence |
| --------- | ------------------------------- | -------------- | ---------- |
| XML       | Any .xml file                   | BANK_STATEMENT | 0.95       |
| CSV       | Any .csv file                   | BANK_STATEMENT | 0.85       |
| Image     | .jpg, .jpeg, .png, .heic, .webp | INVOICE        | 0.8        |
| PDF       | FSTM pattern in filename        | BANK_STATEMENT | 0.95       |
| PDF       | "izvod" or "statement" in name  | BANK_STATEMENT | 0.9        |
| PDF       | "racun" or "faktura" in name    | INVOICE        | 0.9        |
| PDF       | Content keyword analysis        | Highest score  | 0.5-0.9    |
| PDF       | Default                         | INVOICE        | 0.5        |
| Other     | Fallback                        | INVOICE        | 0.3        |

### Query Patterns

#### Unified Document Query

Fetches all document types in parallel -> `src/lib/documents/unified-query.ts:110-153`

```typescript
const [invoices, bankStatements, expenses, invoiceCount, bankCount, expenseCount] =
  await Promise.all([
    db.eInvoice.findMany({
      where: {
        companyId,
        ...(search
          ? {
              OR: [
                { invoiceNumber: { contains: search, mode: "insensitive" } },
                { buyer: { is: { name: { contains: search, mode: "insensitive" } } } },
              ],
            }
          : {}),
      },
      include: { buyer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.importJob.findMany({
      where: {
        companyId,
        ...(search ? { originalName: { contains: search, mode: "insensitive" } } : {}),
      },
      include: { bankAccount: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.expense.findMany({
      where: {
        companyId,
        ...(search
          ? {
              OR: [
                { vendor: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    }),
    db.eInvoice.count({ where: { companyId } }),
    db.importJob.count({ where: { companyId } }),
    db.expense.count({ where: { companyId } }),
  ])
```

#### Document Normalization

Transform to unified format -> `src/lib/documents/unified-query.ts:156-195`

```typescript
// Invoices
const normalizedInvoices: UnifiedDocument[] = invoices.map((inv) => ({
  id: inv.id,
  category: inv.type === "E_INVOICE" ? "e-invoice" : "invoice",
  date: inv.issueDate,
  number: inv.invoiceNumber || "Bez broja",
  counterparty: inv.buyer?.name || null,
  amount: Number(inv.totalAmount),
  currency: inv.currency,
  status: INVOICE_STATUS_LABELS[inv.status] || inv.status,
  statusColor: getInvoiceStatusColor(inv.status),
  detailUrl: inv.type === "E_INVOICE" ? `/e-invoices/${inv.id}` : `/invoices/${inv.id}`,
}))

// Bank statements
const normalizedBankStatements: UnifiedDocument[] = bankStatements.map((job) => ({
  id: job.id,
  category: "bank-statement",
  date: job.createdAt,
  number: job.originalName,
  counterparty: job.bankAccount?.name || null,
  amount: `${job.pagesProcessed || 0} str.`,
  currency: null,
  status: BANK_STATUS_LABELS[job.status] || job.status,
  statusColor: getBankStatementStatusColor(job.status),
  detailUrl: `/banking/documents/${job.id}`,
}))

// Expenses
const normalizedExpenses: UnifiedDocument[] = expenses.map((exp) => ({
  id: exp.id,
  category: "expense",
  date: exp.date,
  number: exp.receiptNumber || exp.description?.slice(0, 30) || "Bez broja",
  counterparty: exp.vendor || null,
  amount: Number(exp.amount),
  currency: exp.currency,
  status: EXPENSE_STATUS_LABELS[exp.status] || exp.status,
  statusColor:
    exp.status === "APPROVED" || exp.status === "PAID"
      ? "green"
      : exp.status === "REJECTED"
        ? "red"
        : "gray",
  detailUrl: `/expenses/${exp.id}`,
}))
```

#### Job Status Update

Real-time polling for job progress -> `src/components/documents/documents-client.tsx:50-81`

```typescript
useEffect(() => {
  const pendingIds = jobs
    .filter((j) => j.status === "PENDING" || j.status === "PROCESSING")
    .map((j) => j.id)

  if (pendingIds.length === 0) return

  const interval = setInterval(async () => {
    for (const id of pendingIds) {
      try {
        const res = await fetch(`/api/import/jobs/${id}`)
        const data = await res.json()
        if (data.success && data.job) {
          setJobs((prev) =>
            prev.map((j) =>
              j.id === id
                ? {
                    ...j,
                    status: data.job.status,
                    documentType: data.job.documentType,
                    progress:
                      data.job.status === "READY_FOR_REVIEW"
                        ? 100
                        : data.job.status === "PROCESSING"
                          ? 50
                          : j.progress,
                    error: data.job.failureReason,
                  }
                : j
            )
          )
        }
      } catch (e) {
        console.error("Poll failed", e)
      }
    }
  }, 2000)

  return () => clearInterval(interval)
}, [jobs])
```

## Dependencies

### Depends On

- **Authentication System**: User and company context -> `src/lib/auth-utils.ts:requireAuth, requireCompany`
- **Tenant Context**: Multi-tenant data isolation -> `src/lib/prisma-extensions.ts:setTenantContext`
- **Bank Account Management**: Account selection for imports -> Banking accounts feature
- **Contact Management**: Buyer/seller/vendor relationships -> Contacts feature
- **Expense Categories**: Category assignment for imported invoices -> Expense categories feature
- **File Storage**: Local filesystem storage for uploaded documents -> File system at `/uploads/imports`
- **AI Processing**: Document type detection and data extraction -> Import processing system
- **Navigation System**: Main menu integration -> `src/lib/navigation.ts`

### Depended By

- **Invoice Management**: Uses unified hub for invoice listing -> Invoicing feature
- **E-Invoice Management**: Uses unified hub for e-invoice listing -> E-invoicing feature
- **Expense Management**: Uses unified hub for expense listing -> Expenses feature
- **Banking Documents**: Uses unified hub for bank statement listing -> Banking documents feature
- **Dashboard**: Recent documents for activity feed
- **Reports**: Document data for financial reports

## Integrations

### Internal Integrations

#### Navigation System

Main menu with document submenu -> `src/lib/navigation.ts:38-55`

```typescript
{
  title: "Financije",
  items: [
    {
      name: "Dokumenti",
      href: "/documents",
      icon: FileText,
      module: "invoicing",
      children: [
        { name: "Svi dokumenti", href: "/documents" },
        { name: "Računi", href: "/documents?category=invoice" },
        { name: "E-Računi", href: "/documents?category=e-invoice" },
        { name: "Bankovni izvodi", href: "/documents?category=bank-statement" },
        { name: "Troškovi", href: "/documents?category=expense" },
      ]
    },
    // ...
  ]
}
```

#### Responsive Table Component

Mobile-responsive table with card fallback -> `src/components/ui/responsive-table.tsx`

- Desktop: Full table layout with all columns
- Mobile: Card layout with compact information
- Automatic breakpoint detection
- Custom card renderer per document type
- Configurable columns with render functions

#### File Upload Integration

Multi-format file acceptance -> `src/lib/import/detect-document-type.ts:143-155`

Accepted formats:

- PDF: `application/pdf` (.pdf)
- XML: `application/xml`, `text/xml` (.xml)
- CSV: `text/csv` (.csv)
- Images: `image/jpeg` (.jpg, .jpeg), `image/png` (.png), `image/heic` (.heic), `image/webp` (.webp)

#### Processing Status Mapping

Job status to UI representation -> `src/components/import/processing-card.tsx:28-37`

| JobStatus        | Label (HR)         | Color          | Icon         |
| ---------------- | ------------------ | -------------- | ------------ |
| PENDING          | U redu čekanja...  | text-gray-500  | Loader2      |
| PROCESSING       | Obrada...          | text-blue-600  | Loader2      |
| READY_FOR_REVIEW | Spreman za pregled | text-amber-600 | Eye          |
| CONFIRMED        | Potvrđeno          | text-green-600 | CheckCircle2 |
| REJECTED         | Odbijeno           | text-gray-400  | X            |
| VERIFIED         | Verificirano       | text-green-600 | CheckCircle2 |
| NEEDS_REVIEW     | Potreban pregled   | text-amber-600 | AlertCircle  |
| FAILED           | Greška             | text-red-600   | AlertCircle  |

#### Document Status Mapping

Document status to UI representation -> `src/lib/documents/unified-query.ts:30-82`

Invoice statuses (Croatian labels):

- DRAFT -> Nacrt (gray)
- SENT -> Poslano (blue)
- PENDING_FISCALIZATION -> Čeka fiskalizaciju (blue)
- FISCALIZED -> Fiskalizirano (green)
- DELIVERED -> Dostavljeno (green)
- ACCEPTED -> Prihvaćeno (green)
- REJECTED -> Odbijeno (red)
- ERROR -> Greška (red)
- ARCHIVED -> Arhivirano (gray)

Bank statement statuses:

- PENDING -> Na čekanju (blue)
- PROCESSING -> Obrada (blue)
- VERIFIED -> Verificirano (green)
- NEEDS_REVIEW -> Treba pregled (amber)
- FAILED -> Neuspjelo (red)

Expense statuses:

- PENDING -> Na čekanju (gray)
- APPROVED -> Odobreno (green)
- REJECTED -> Odbijeno (red)
- PAID -> Plaćeno (green)

### External Integrations

#### File System Storage

Document file persistence -> `src/app/api/import/upload/route.ts:52-57`

- Storage directory: `uploads/imports/`
- Filename format: `{sha256-checksum}.{extension}`
- Automatic directory creation
- Checksum-based deduplication

#### Document Type Detection

Heuristic detection algorithm -> `src/lib/import/detect-document-type.ts:19-126`

Detection rules:

1. Extension-based detection (XML, CSV, images)
2. PDF filename pattern matching (Croatian bank keywords)
3. Content keyword analysis (bank vs invoice keywords)
4. Confidence scoring (0.0-1.0)
5. Fallback to INVOICE type for unknown formats

Keywords for bank statements:

- izvod, stanje, promet, saldo, iban, swift, bic
- transakcij, uplat, isplat, banka, račun

Keywords for invoices:

- račun, faktura, invoice, pdv, vat, oib, iznos
- ukupno, total, dobavljač, kupac, dospijeće

## Verification Checklist

### Document Hub

- [ ] User can access documents via main navigation `/documents`
- [ ] All document types display in unified table
- [ ] Category cards show correct counts per document type
- [ ] "Svi" category shows total document count
- [ ] Active category highlighted with blue background
- [ ] Documents sorted by date descending (newest first)
- [ ] Table displays: date, category badge, number, counterparty, amount, status badge
- [ ] Mobile view switches to card layout
- [ ] Empty state displays when no documents found
- [ ] Pagination controls show when total pages > 1

### Category Filtering

- [ ] Clicking "Računi" filters to invoices only
- [ ] Clicking "E-Računi" filters to e-invoices only
- [ ] Clicking "Izvodi" filters to bank statements only
- [ ] Clicking "Troškovi" filters to expenses only
- [ ] Clicking "Svi" shows all document types
- [ ] URL updates with `?category=` parameter
- [ ] Category filter persists across page navigation
- [ ] Back button returns to previous filter state
- [ ] Category badge uses correct color per document type

### Search Functionality

- [ ] Search input accepts text queries
- [ ] Search filters invoice numbers (case-insensitive)
- [ ] Search filters buyer/vendor names (case-insensitive)
- [ ] Search filters bank statement filenames (case-insensitive)
- [ ] Search filters expense descriptions (case-insensitive)
- [ ] Search works across all document types
- [ ] Search combines with category filter
- [ ] Empty search results show "Nema rezultata" message
- [ ] Search term displays in input after submit
- [ ] URL updates with `?search=` parameter

### Document Upload

- [ ] Dropzone accepts PDF, XML, CSV, and image files
- [ ] Drag-and-drop triggers file upload
- [ ] "Odaberi" button opens file picker
- [ ] Camera button visible on mobile devices
- [ ] Camera button opens native camera
- [ ] File size validation rejects files over 20MB
- [ ] Format validation rejects unsupported file types
- [ ] Bank account selector shows all accounts
- [ ] Selected account persists across uploads
- [ ] Upload adds job to processing sidebar

### Processing Sidebar

- [ ] Sidebar auto-opens when jobs added
- [ ] Sidebar shows all pending/processing jobs
- [ ] Processing cards display filename, document type, status
- [ ] Progress bar animates during PENDING/PROCESSING
- [ ] Status icon spins during processing
- [ ] Queue position shown for multiple ready jobs
- [ ] User can change document type via dropdown
- [ ] User can remove job from queue
- [ ] "Pregledaj" button appears when READY_FOR_REVIEW
- [ ] "Pokušaj ponovo" button appears when FAILED
- [ ] Error messages display for failed jobs
- [ ] Sidebar auto-closes when all jobs complete

### Job Processing

- [ ] Jobs poll for status updates every 2 seconds
- [ ] Document type auto-detected from filename/content
- [ ] Detection confidence shown in job record
- [ ] User can override detected document type
- [ ] Type change triggers reprocessing
- [ ] Status updates reflect in real-time
- [ ] READY_FOR_REVIEW status triggers review notification
- [ ] FAILED status shows failure reason
- [ ] Confirmed jobs removed from sidebar
- [ ] Rejected jobs removed from sidebar

### Confirmation Modal

- [ ] Modal opens when "Pregledaj" clicked
- [ ] Modal shows original document preview
- [ ] Modal shows extracted data in editable form
- [ ] Bank statements show transactions table
- [ ] Invoices show invoice fields
- [ ] User can edit extracted data
- [ ] User can switch document type in modal
- [ ] Type switch closes modal and reprocesses
- [ ] "Confirm" button saves data and closes modal
- [ ] "Discard" button rejects job and closes modal
- [ ] Page refreshes after confirmation
- [ ] New document appears in main table

### Detail Router

- [ ] Clicking "Pregledaj" navigates to `/documents/:id`
- [ ] Invoices redirect to `/invoices/:id`
- [ ] E-invoices redirect to `/e-invoices/:id`
- [ ] Bank statements redirect to `/banking/documents/:id`
- [ ] Expenses redirect to `/expenses/:id`
- [ ] Invalid IDs show 404 page
- [ ] Documents from other companies return 404

### New Document Creation

- [ ] "Novi dokument" dropdown button opens menu
- [ ] Menu shows 4 document type options with icons
- [ ] "Novi račun" navigates to invoice creation
- [ ] "Novi e-račun" navigates to e-invoice creation
- [ ] "Uvezi bankovni izvod" navigates to import page
- [ ] "Novi trošak" navigates to expense creation
- [ ] Dropdown closes on selection
- [ ] Dropdown closes on outside click
- [ ] Dropdown closes on Escape key

### Mobile Responsiveness

- [ ] Table switches to card layout on mobile
- [ ] Category cards wrap on narrow screens
- [ ] Search input full-width on mobile
- [ ] Camera button visible on mobile
- [ ] Camera button opens native camera interface
- [ ] Dropzone responsive on small screens
- [ ] Processing sidebar overlays on mobile
- [ ] Sidebar backdrop dismisses sidebar
- [ ] Touch interactions work smoothly
- [ ] Navigation drawer accessible

### Data Integrity

- [ ] All queries filter by companyId (tenant isolation)
- [ ] Documents only visible to owning company
- [ ] Cross-tenant access returns 404
- [ ] File checksums prevent duplicate uploads
- [ ] Uploaded files persist in storage directory
- [ ] File deletion removes both database record and file
- [ ] Transaction updates require ownership validation
- [ ] Job status transitions follow valid state machine
- [ ] Extracted data stored in JSON format
- [ ] Page refresh restores processing sidebar state

### Performance

- [ ] Parallel queries for all document types
- [ ] Category counts cached per request
- [ ] Pagination limits to 20 documents per page
- [ ] Search uses database indexes
- [ ] Real-time polling limited to active jobs only
- [ ] Polling stops when no active jobs
- [ ] File uploads show progress feedback
- [ ] Large files handled without timeout
- [ ] Database queries use proper indexes
- [ ] Component state optimized to prevent re-renders

## Evidence Links

1. `src/app/(dashboard)/documents/page.tsx:1-324` - Main unified documents hub page with upload, filtering, search, pagination
2. `src/components/documents/documents-client.tsx:1-307` - Client-side state management, upload handling, and processing sidebar
3. `src/components/documents/category-cards.tsx:1-117` - Category filter cards with counts and active state
4. `src/components/documents/new-document-dropdown.tsx:1-103` - Document creation dropdown menu
5. `src/components/documents/compact-dropzone.tsx:1-161` - File upload dropzone with camera support
6. `src/components/documents/reports-sidebar.tsx:1-143` - Processing queue sidebar with job cards
7. `src/components/import/processing-card.tsx:1-169` - Individual job status card with actions
8. `src/app/(dashboard)/documents/[id]/page.tsx:1-58` - Smart detail router for all document types
9. `src/lib/documents/unified-query.ts:1-237` - Unified query and normalization for all document types
10. `src/lib/import/detect-document-type.ts:1-155` - Automatic document type detection algorithm
11. `src/app/api/import/upload/route.ts:1-95` - File upload API endpoint with validation
12. `src/app/api/import/jobs/[id]/route.ts:1-47` - Job status query endpoint
13. `src/app/api/import/jobs/[id]/confirm/route.ts:1-159` - Job confirmation and data save endpoint
14. `src/lib/navigation.ts:38-55` - Main navigation with documents submenu
15. `prisma/schema.prisma:641-668, 191-226, 345-373, 885-906` - ImportJob, EInvoice, Expense tables and enums
