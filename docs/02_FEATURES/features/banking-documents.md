# Feature: Banking Documents (F045)

## Status

- Documentation: Complete
- Last verified: 2025-12-15
- Evidence count: 11

## Purpose

Provides a centralized document management system for uploaded bank statements, enabling users to view, verify, and manage imported banking documents (PDF and XML formats). The feature redirects from the legacy `/banking/documents` route to the unified documents hub at `/documents` with category filtering, while maintaining a dedicated detail view at `/banking/documents/:id` for statement verification and transaction review.

## User Entry Points

| Type       | Path                                 | Evidence                                                 |
| ---------- | ------------------------------------ | -------------------------------------------------------- |
| Navigation | `/documents?category=bank-statement` | `src/lib/navigation.ts:48`                               |
| Redirect   | `/banking/documents`                 | `src/app/(dashboard)/banking/documents/page.tsx:6`       |
| Upload     | `/banking/import`                    | `src/app/(dashboard)/banking/import/page.tsx:10`         |
| Detail     | `/banking/documents/:id`             | `src/app/(dashboard)/banking/documents/[id]/page.tsx:10` |
| API Upload | `/api/banking/import/upload`         | `src/app/api/banking/import/upload/route.ts:13`          |

## Core Flow

### Document List View Flow

1. User accesses `/banking/documents` route -> `src/app/(dashboard)/banking/documents/page.tsx:5-7`
2. System redirects to unified documents hub -> `src/app/(dashboard)/banking/documents/page.tsx:6`
3. Query parameter `category=bank-statement` filters for bank statements -> `src/lib/documents/unified-query.ts:125-135`
4. System fetches ImportJob records via unified query -> `src/lib/documents/unified-query.ts:126-135`
5. Bank statements normalized into UnifiedDocument format -> `src/lib/documents/unified-query.ts:170-181`
6. Category filter shows bank statement count
7. Table displays documents with: filename, account, status, pages, upload date -> `src/app/(dashboard)/banking/documents/table.tsx:42-111`
8. User clicks "Pregledaj" to view details -> Detail view flow

### Document Upload Flow

1. User navigates to `/banking/import` -> `src/app/(dashboard)/banking/import/page.tsx:10-218`
2. System displays upload dropzone with account selection -> `src/app/(dashboard)/banking/import/statement-dropzone.tsx:186-311`
3. User drags PDF or XML file or clicks browse -> `src/app/(dashboard)/banking/import/statement-dropzone.tsx:156-172`
4. File validation checks format (PDF/XML only) and size (max 20MB) -> `src/app/api/banking/import/upload/route.ts:10-75`
5. SHA-256 checksum calculated to detect duplicates -> `src/app/api/banking/import/upload/route.ts:78`
6. Duplicate detection checks existing imports for same account -> `src/app/api/banking/import/upload/route.ts:86-103`
7. ImportJob record created with PENDING status -> `src/app/api/banking/import/upload/route.ts:124-135`
8. Background processing initiated -> `src/lib/banking/import/processor.ts:72-127`
9. Real-time polling displays processing progress -> `src/app/(dashboard)/banking/import/statement-dropzone.tsx:104-154`
10. Upload completes with VERIFIED, NEEDS_REVIEW, or FAILED status

### Document Processing Flow

1. Background processor picks up PENDING ImportJob -> `src/lib/banking/import/processor.ts:73-77`
2. Job status updated to PROCESSING -> `src/lib/banking/import/processor.ts:80-83`
3. File type detection (XML or PDF) -> `src/lib/banking/import/processor.ts:86-91`
4. **XML Processing Path:**
   - CAMT.053 XML parsed with fast-xml-parser -> `src/lib/banking/import/processor.ts:129-247`
   - Opening/closing balances extracted -> `src/lib/banking/import/processor.ts:151-163`
   - Statement metadata extracted (sequence number, dates) -> `src/lib/banking/import/processor.ts:145-149`
   - Statement record created -> `src/lib/banking/import/processor.ts:168-181`
   - Transactions extracted and stored -> `src/lib/banking/import/processor.ts:195-236`
   - Job marked as VERIFIED -> `src/lib/banking/import/processor.ts:238-246`
5. **PDF Processing Path:**
   - Text extracted per page using pdf-parse -> `src/lib/banking/import/processor.ts:254-446`
   - Each page sent to DeepSeek LLM for transaction extraction -> `src/lib/banking/import/processor.ts:378-407`
   - Mathematical audit verifies page balances -> `src/lib/banking/import/processor.ts:288-298`
   - Failed pages retry with vision model (Ollama/OpenAI) -> `src/lib/banking/import/processor.ts:301-327`
   - Statement and page records created -> `src/lib/banking/import/processor.ts:272-345`
   - Transactions stored with UNMATCHED status -> `src/lib/banking/import/processor.ts:349-364`
   - Job status set based on page verification results -> `src/lib/banking/import/processor.ts:367-375`

### Detail View Flow

1. User clicks document row to view details -> `src/app/(dashboard)/banking/documents/table.tsx:88-92`
2. System routes to `/banking/documents/:id` -> `src/app/(dashboard)/banking/documents/[id]/page.tsx:10`
3. ImportJob fetched with statement, pages, and transactions -> `src/app/(dashboard)/banking/documents/[id]/page.tsx:20-33`
4. Split-screen view displays original document and extracted data -> `src/app/(dashboard)/banking/documents/[id]/ui/document-detail.tsx:76-104`
5. PDF/image preview shown in left panel -> `src/app/(dashboard)/banking/documents/[id]/ui/document-detail.tsx:82-103`
6. Editable transaction table shown in right panel -> `src/app/(dashboard)/banking/documents/[id]/ui/document-detail.tsx:121-193`
7. User corrects transaction dates, amounts, descriptions, references -> `src/app/(dashboard)/banking/documents/[id]/ui/document-detail.tsx:134-189`
8. Changes saved via PATCH endpoint -> `src/app/api/banking/import/jobs/[id]/route.ts:120-161`
9. User marks document as verified -> `src/app/(dashboard)/banking/documents/[id]/ui/document-detail.tsx:65-73`
10. Status updated to VERIFIED via status endpoint

## Key Modules

| Module                | Purpose                                         | Location                                                            |
| --------------------- | ----------------------------------------------- | ------------------------------------------------------------------- |
| BankingDocumentsPage  | Redirects to unified documents hub              | `src/app/(dashboard)/banking/documents/page.tsx`                    |
| DocumentDetail        | Split-screen document viewer with editing       | `src/app/(dashboard)/banking/documents/[id]/ui/document-detail.tsx` |
| DocumentsTable        | List view of imported bank statements           | `src/app/(dashboard)/banking/documents/table.tsx`                   |
| StatementDropzone     | Drag-and-drop upload with real-time progress    | `src/app/(dashboard)/banking/import/statement-dropzone.tsx`         |
| ImportProcessor       | Background job processor for PDF/XML extraction | `src/lib/banking/import/processor.ts`                               |
| UploadRoute           | File upload handler with duplicate detection    | `src/app/api/banking/import/upload/route.ts`                        |
| JobRoute              | Job status/update/delete API endpoint           | `src/app/api/banking/import/jobs/[id]/route.ts`                     |
| FileRoute             | Serves original uploaded document               | `src/app/api/banking/import/jobs/[id]/file/route.ts`                |
| queryUnifiedDocuments | Fetches bank statements for documents hub       | `src/lib/documents/unified-query.ts:106-237`                        |

## Data

### Database Tables

#### ImportJob Table

Document import job tracking -> `prisma/schema.prisma:641-668`

Key fields:

- `id` (String, CUID): Unique identifier
- `companyId` (String): Tenant isolation
- `userId` (String): User who initiated import
- `bankAccountId` (String?): Associated bank account
- `fileChecksum` (String): SHA-256 hash for duplicate detection
- `originalName` (String): Original filename
- `storagePath` (String): File system path to uploaded document
- `status` (JobStatus): PENDING, PROCESSING, READY_FOR_REVIEW, CONFIRMED, REJECTED, VERIFIED, NEEDS_REVIEW, FAILED -> `prisma/schema.prisma:885-894`
- `documentType` (DocumentType?): Classification of document type
- `extractedData` (Json?): Raw extraction output
- `tierUsed` (TierType?): Processing tier (TEXT_LLM, VISION_LLM, XML)
- `failureReason` (String?): Error message if failed
- `pagesProcessed` (Int): Number of pages processed
- `pagesFailed` (Int): Number of pages that failed verification
- `createdAt` (DateTime): Upload timestamp
- `updatedAt` (DateTime): Last modification

Relations:

- `bankAccount` (BankAccount?): Associated bank account -> `prisma/schema.prisma:658`
- `company` (Company): Owner company -> `prisma/schema.prisma:659`
- `statement` (Statement?): Extracted statement data -> `prisma/schema.prisma:660`

Indexes:

- `companyId`: Tenant filtering -> `prisma/schema.prisma:664`
- `bankAccountId`: Account filtering -> `prisma/schema.prisma:665`
- `status`: Status-based queries -> `prisma/schema.prisma:666`
- `bankAccountId, fileChecksum`: Duplicate detection -> `prisma/schema.prisma:667`

#### Statement Table

Extracted bank statement metadata -> `prisma/schema.prisma:670-699`

Key fields:

- `id` (String, CUID): Unique identifier
- `importJobId` (String, Unique): Link to import job
- `companyId` (String): Tenant isolation
- `bankAccountId` (String): Associated bank account
- `statementDate` (DateTime): Statement issue date
- `periodStart` (DateTime): Statement period start
- `periodEnd` (DateTime): Statement period end
- `sequenceNumber` (Int): Sequential statement number
- `previousStatementId` (String?): Chain to previous statement
- `openingBalance` (Decimal): Starting balance
- `closingBalance` (Decimal): Ending balance
- `currency` (String): Currency code (default EUR)
- `isGapDetected` (Boolean): Missing sequence number flag
- `isLocked` (Boolean): Prevents modifications
- `createdAt` (DateTime): Creation timestamp
- `updatedAt` (DateTime): Last modification

Relations:

- `bankAccount` (BankAccount): Associated account -> `prisma/schema.prisma:687`
- `company` (Company): Owner company -> `prisma/schema.prisma:688`
- `importJob` (ImportJob): Source import -> `prisma/schema.prisma:689`
- `previousStatement` (Statement?): Previous in chain -> `prisma/schema.prisma:690`
- `nextStatements` (Statement[]): Following statements -> `prisma/schema.prisma:691`
- `pages` (StatementPage[]): Individual pages -> `prisma/schema.prisma:692`
- `transactions` (Transaction[]): All transactions -> `prisma/schema.prisma:693`

Indexes:

- Unique: `bankAccountId, sequenceNumber, periodStart` -> `prisma/schema.prisma:695`
- `companyId`: Tenant filtering -> `prisma/schema.prisma:696`
- `bankAccountId`: Account filtering -> `prisma/schema.prisma:697`
- `periodStart`: Date range queries -> `prisma/schema.prisma:698`

#### StatementPage Table

Individual page processing status -> `prisma/schema.prisma:701-716`

Key fields:

- `id` (String, CUID): Unique identifier
- `statementId` (String): Parent statement
- `companyId` (String): Tenant isolation
- `pageNumber` (Int): Sequential page number
- `pageStartBalance` (Decimal?): Balance at page start
- `pageEndBalance` (Decimal?): Balance at page end
- `status` (PageStatus): PENDING, VERIFIED, NEEDS_VISION, FAILED -> `prisma/schema.prisma:908-913`
- `rawText` (String?): Extracted OCR text

Relations:

- `company` (Company): Owner company -> `prisma/schema.prisma:710`
- `statement` (Statement): Parent statement -> `prisma/schema.prisma:711`
- `transactions` (Transaction[]): Page transactions -> `prisma/schema.prisma:712`

Indexes:

- Unique: `statementId, pageNumber` -> `prisma/schema.prisma:714`
- `companyId`: Tenant filtering -> `prisma/schema.prisma:715`

#### Transaction Table

Extracted bank transactions -> `prisma/schema.prisma:718-739`

Key fields:

- `id` (String, CUID): Unique identifier
- `statementId` (String): Parent statement
- `pageId` (String): Source page
- `companyId` (String): Tenant isolation
- `date` (DateTime): Transaction date
- `amount` (Decimal): Transaction amount
- `direction` (TxDirection): INCOMING or OUTGOING
- `payeeName` (String?): Counterparty name
- `description` (String?): Transaction description
- `reference` (String?): Bank reference number
- `iban` (String?): Counterparty IBAN
- `category` (String?): Transaction category

Relations:

- `company` (Company): Owner company -> `prisma/schema.prisma:731`
- `page` (StatementPage): Source page -> `prisma/schema.prisma:732`
- `statement` (Statement): Parent statement -> `prisma/schema.prisma:733`

Indexes:

- `companyId`: Tenant filtering -> `prisma/schema.prisma:735`
- `statementId`: Statement queries -> `prisma/schema.prisma:736`
- `pageId`: Page queries -> `prisma/schema.prisma:737`
- `date`: Date range queries -> `prisma/schema.prisma:738`

### Query Patterns

#### Unified Document Query

Fetches bank statements alongside other documents -> `src/lib/documents/unified-query.ts:125-135`

```typescript
db.importJob.findMany({
  where: {
    companyId,
    ...(search
      ? {
          originalName: { contains: search, mode: "insensitive" },
        }
      : {}),
  },
  include: { bankAccount: { select: { name: true } } },
  orderBy: { createdAt: "desc" },
})
```

#### Document Detail Query

Fetches import job with full statement data -> `src/app/(dashboard)/banking/documents/[id]/page.tsx:20-33`

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

#### Transaction Update

Updates extracted transaction data -> `src/app/api/banking/import/jobs/[id]/route.ts:145-158`

```typescript
await db.transaction.updateMany({
  where: { id: tx.id, companyId: company.id },
  data: {
    date: tx.date ? new Date(tx.date) : undefined,
    amount: tx.amount !== undefined ? new Prisma.Decimal(tx.amount) : undefined,
    description: tx.description ?? undefined,
    reference: tx.reference ?? undefined,
    payeeName: tx.payeeName ?? undefined,
    iban: tx.iban ?? undefined,
  },
})
```

### Data Normalization

Bank statements transformed into unified format -> `src/lib/documents/unified-query.ts:170-181`

```typescript
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
```

## Dependencies

### Depends On

- **Authentication System**: User and company context -> `src/lib/auth-utils.ts:requireAuth, requireCompany`
- **Tenant Context**: Multi-tenant data isolation -> `src/lib/prisma-extensions.ts:setTenantContext`
- **Bank Account Management**: Account selection for imports -> `prisma/schema.prisma:BankAccount`
- **AI Processing**: DeepSeek for text extraction, Ollama/OpenAI for vision fallback -> `src/lib/banking/import/processor.ts:378-556`
- **File Storage**: Local filesystem storage for uploaded documents -> `src/app/api/banking/import/upload/route.ts:80-121`

### Depended By

- **Banking Reconciliation**: Uses imported transactions for matching -> Banking reconciliation feature
- **Banking Transactions**: Displays imported transactions -> Banking transactions feature
- **Reports**: Bank statement data for financial reports
- **Dashboard**: Recent imports for activity feed

## Integrations

### Internal Integrations

#### Navigation System

Sidebar navigation with bank statement submenu -> `src/lib/navigation.ts:48`

```typescript
{
  name: "Dokumenti",
  href: "/documents",
  icon: FileText,
  children: [
    { name: "Bankovni izvodi", href: "/documents?category=bank-statement" },
    // ...
  ]
}
```

#### Unified Documents Hub

Bank statements integrated into central documents view -> `src/lib/documents/unified-query.ts:110-153`

- Fetches ImportJob records in parallel with invoices and expenses
- Normalizes into UnifiedDocument format
- Supports category filtering and search
- Maintains consistent UI across document types

#### File Serving

Original documents served via API endpoint -> `src/app/api/banking/import/jobs/[id]/file/route.ts:9-49`

- Endpoint: `/api/banking/import/jobs/:id/file`
- Content-Type detection via mime-types
- Inline display with original filename
- Access control via tenant isolation

#### Processing Pipeline

Multi-tier AI processing with fallback -> `src/lib/banking/import/processor.ts:72-592`

- **Tier 1 (XML)**: Fast XML parsing for CAMT.053 format
- **Tier 2 (Text LLM)**: DeepSeek extraction from PDF text
- **Tier 3 (Vision LLM)**: Ollama/OpenAI for failed pages
- Mathematical audit validates page balance continuity
- Automatic retry with higher-tier models on failure

### External Integrations

#### CAMT.053 XML Standard

ISO 20022 bank statement format -> `src/lib/banking/import/processor.ts:129-247`

- Parses BkToCstmrStmt and BkToCstmrAcctRpt messages
- Extracts opening/closing balances (OPBD/CLBD)
- Parses transaction entries with counterparty details
- Supports multiple banks (RBA, ZABA, PBZ)

#### PDF Processing

Multi-page PDF extraction -> `src/lib/banking/import/processor.ts:409-446`

- Uses pdf-parse library for text extraction
- Per-page processing for large statements
- Fallback to simple text extraction if pdf-parse fails
- Base64 encoding for vision model input

#### DeepSeek AI

Text-based transaction extraction -> `src/lib/banking/import/processor.ts:378-407`

- Model: deepseek-chat
- System prompt defines extraction schema
- JSON structured output
- Extracts: dates, amounts, descriptions, references, IBANs

#### Vision Models

OCR fallback for mathematical discrepancies -> `src/lib/banking/import/processor.ts:448-556`

- Primary: Ollama with qwen3-vl:235b-instruct
- Fallback: OpenAI gpt-4o-mini
- 90-second timeout for Ollama
- Repairs multi-line transactions and balance errors

## Verification Checklist

### List View

- [ ] User can access bank statements via `/documents?category=bank-statement`
- [ ] Legacy `/banking/documents` route redirects to unified documents
- [ ] Bank statement count badge shows correct total
- [ ] Search filters by filename (case-insensitive)
- [ ] Table shows: filename, account, status, pages processed, upload date
- [ ] Status badges use correct colors (PENDING=gray, VERIFIED=green, NEEDS_REVIEW=amber, FAILED=red)
- [ ] Clicking "Pregledaj" navigates to detail page
- [ ] Empty state displays when no documents found
- [ ] Delete button removes document and underlying file

### Upload Flow

- [ ] Dropzone accepts PDF and XML files via drag-and-drop
- [ ] Browse button opens file picker
- [ ] File size validation rejects files over 20MB
- [ ] Format validation only allows .pdf and .xml extensions
- [ ] Duplicate detection warns when same checksum exists for account
- [ ] Overwrite confirmation allows replacing existing document
- [ ] Upload progress shows real-time status
- [ ] Progress bar displays: Upload -> Text & Matematika -> Vision fallback -> Završeno
- [ ] Processing logs show step-by-step progress
- [ ] Account selector shows all bank accounts with IBAN

### Detail View

- [ ] Split-screen layout displays document and extracted data
- [ ] PDF documents render in left panel with inline viewer
- [ ] Image documents (JPG, PNG, HEIC) display in left panel
- [ ] XML documents show "Pregled ovog formata nije dostupan"
- [ ] Transaction table allows editing date, description, reference, amount
- [ ] Input changes reflect immediately in UI
- [ ] "Spremi promjene" button saves transaction updates
- [ ] "Označi kao verificirano" button updates job status to VERIFIED
- [ ] Status badge shows current verification state
- [ ] Success message confirms save operations
- [ ] Back button returns to documents list

### Processing

- [ ] XML files process immediately without AI extraction
- [ ] PDF files extract text per page
- [ ] Mathematical audit verifies page balance continuity
- [ ] Failed pages trigger vision model fallback
- [ ] Job status updates to VERIFIED when all pages pass
- [ ] Job status updates to NEEDS_REVIEW when pages fail
- [ ] Job status updates to FAILED on critical errors
- [ ] Failure reason displays in job record
- [ ] Pages processed counter increments during processing
- [ ] Pages failed counter tracks verification failures

### Data Integrity

- [ ] All queries filter by companyId (tenant isolation)
- [ ] File checksum prevents duplicate uploads per account
- [ ] Statement sequence numbers maintain continuity
- [ ] Opening balance of statement N+1 matches closing balance of statement N
- [ ] Transaction amounts match page balance deltas
- [ ] Uploaded files persist in storage directory
- [ ] File deletion removes both database record and file
- [ ] Transaction updates require company ownership validation

## Evidence Links

1. `src/app/(dashboard)/banking/documents/page.tsx:1-7` - Legacy route redirect to unified documents hub
2. `src/app/(dashboard)/banking/documents/[id]/page.tsx:10-62` - Document detail page with statement data
3. `src/app/(dashboard)/banking/documents/table.tsx:17-113` - Documents table with status and actions
4. `src/app/(dashboard)/banking/documents/[id]/ui/document-detail.tsx:27-207` - Split-screen document viewer with editing
5. `src/app/(dashboard)/banking/import/page.tsx:10-218` - Import page with upload instructions
6. `src/app/(dashboard)/banking/import/statement-dropzone.tsx:15-352` - Drag-and-drop upload with real-time progress
7. `src/app/api/banking/import/upload/route.ts:13-154` - File upload handler with duplicate detection
8. `src/app/api/banking/import/jobs/[id]/route.ts:6-161` - Job status/update/delete endpoints
9. `src/lib/banking/import/processor.ts:72-592` - Background processor for PDF/XML extraction
10. `src/lib/documents/unified-query.ts:125-181` - Unified query with bank statement normalization
11. `prisma/schema.prisma:641-739` - ImportJob, Statement, StatementPage, Transaction tables
