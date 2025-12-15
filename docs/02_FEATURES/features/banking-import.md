# Feature: Import Bank Statement (F041)

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 35

## Purpose

The Import Bank Statement feature enables users to import and process bank statements from multiple formats (CSV, PDF, CAMT.053 XML) with AI-powered extraction, mathematical verification, automatic transaction matching to invoices, and multi-tier processing (XML parsing, text-based LLM extraction, vision-based fallback). The feature includes drag-and-drop file upload, duplicate detection, background processing with real-time status updates, and automatic reconciliation of imported transactions against outstanding invoices, forming the core banking integration workflow in FiskAI.

## User Entry Points

| Type   | Path                        | Evidence                                         |
| ------ | --------------------------- | ------------------------------------------------ |
| Page   | /banking/import             | `src/app/(dashboard)/banking/import/page.tsx:10` |
| Action | importBankStatement         | `src/app/(dashboard)/banking/actions.ts:170`     |
| API    | /api/banking/import/upload  | `src/app/api/banking/import/upload/route.ts:13`  |
| API    | /api/banking/import/process | `src/app/api/banking/import/process/route.ts:7`  |

## Core Flow

### CSV Import Flow (Simple Path)

1. User navigates to /banking/import → `src/app/(dashboard)/banking/import/page.tsx:10`
2. System validates user authentication with requireAuth() → `src/app/(dashboard)/banking/import/page.tsx:11`
3. System retrieves current company via requireCompany() → `src/app/(dashboard)/banking/import/page.tsx:12`
4. System sets tenant context for data isolation → `src/app/(dashboard)/banking/import/page.tsx:14-17`
5. System fetches bank accounts ordered by default status → `src/app/(dashboard)/banking/import/page.tsx:20-29`
6. System fetches recent imports for history display → `src/app/(dashboard)/banking/import/page.tsx:32-41`
7. System calculates last statement per account for continuity checks → `src/app/(dashboard)/banking/import/page.tsx:43-57`
8. User selects CSV file and bank account → `src/app/(dashboard)/banking/import/import-form.tsx:106-131`
9. System parses CSV with bank-specific parser → `src/app/(dashboard)/banking/import/import-form.tsx:35-104`
10. System displays preview of transactions (up to 100) → `src/app/(dashboard)/banking/import/import-form.tsx:248-310`
11. User confirms import → `src/app/(dashboard)/banking/import/import-form.tsx:133-176`
12. System calls importBankStatement server action → `src/app/(dashboard)/banking/actions.ts:170-282`
13. System creates BankImport record → `src/app/(dashboard)/banking/actions.ts:212-221`
14. System creates BankTransaction records for all transactions → `src/app/(dashboard)/banking/actions.ts:224-242`
15. System runs automatic matching against invoices → `src/app/(dashboard)/banking/actions.ts:256-260`
16. System revalidates cache and redirects to transactions → `src/app/(dashboard)/banking/import/import-form.tsx:168-170`

### PDF/XML Import Flow (Advanced Path)

1. User drags/drops PDF or XML file to dropzone → `src/app/(dashboard)/banking/import/statement-dropzone.tsx:163-168`
2. System validates file type (PDF/XML only) → `src/app/api/banking/import/upload/route.ts:65-67`
3. System checks file size (max 20MB) → `src/app/api/banking/import/upload/route.ts:73-75`
4. System calculates SHA-256 checksum → `src/app/api/banking/import/upload/route.ts:78`
5. System detects duplicate uploads by checksum → `src/app/api/banking/import/upload/route.ts:86-103`
6. System saves file to uploads/bank-statements directory → `src/app/api/banking/import/upload/route.ts:80-121`
7. System creates ImportJob with PENDING status → `src/app/api/banking/import/upload/route.ts:124-135`
8. System triggers background processing → `src/app/(dashboard)/banking/import/statement-dropzone.tsx:77-79`
9. System polls job status every 3 seconds → `src/app/(dashboard)/banking/import/statement-dropzone.tsx:109-154`
10. **XML Processing**: Parser extracts CAMT.053 structure → `src/lib/banking/import/processor.ts:129-247`
11. **PDF Processing**: Extracts text per page → `src/lib/banking/import/processor.ts:249-376`
12. System calls DeepSeek LLM for text extraction → `src/lib/banking/import/processor.ts:378-407`
13. System performs mathematical audit on each page → `src/lib/banking/import/audit.ts:30-57`
14. **Vision Fallback**: If audit fails, uses Ollama/OpenAI vision model → `src/lib/banking/import/processor.ts:448-556`
15. System creates Statement and StatementPage records → `src/lib/banking/import/processor.ts:272-285`
16. System creates BankTransaction records from extracted data → `src/lib/banking/import/processor.ts:349-364`
17. System updates job status (VERIFIED/NEEDS_REVIEW/FAILED) → `src/lib/banking/import/processor.ts:367-375`

## Key Modules

| Module                   | Purpose                                       | Location                                                    |
| ------------------------ | --------------------------------------------- | ----------------------------------------------------------- |
| ImportPage               | Server component for import page with history | `src/app/(dashboard)/banking/import/page.tsx`               |
| ImportForm               | Client form for CSV upload with preview       | `src/app/(dashboard)/banking/import/import-form.tsx`        |
| StatementDropzone        | Drag-and-drop upload with real-time progress  | `src/app/(dashboard)/banking/import/statement-dropzone.tsx` |
| importBankStatement      | Server action for CSV import                  | `src/app/(dashboard)/banking/actions.ts:170-282`            |
| uploadRoute              | API endpoint for file upload                  | `src/app/api/banking/import/upload/route.ts:13-154`         |
| processRoute             | API endpoint for background processing        | `src/app/api/banking/import/process/route.ts:7-45`          |
| processNextImportJob     | Core processor for PDF/XML files              | `src/lib/banking/import/processor.ts:72-127`                |
| handleXml                | CAMT.053 XML parser                           | `src/lib/banking/import/processor.ts:129-247`               |
| handlePdf                | PDF text extraction and LLM processing        | `src/lib/banking/import/processor.ts:249-376`               |
| auditPageMath            | Mathematical verification of balances         | `src/lib/banking/import/audit.ts:30-57`                     |
| parseCSV                 | Bank-specific CSV parser                      | `src/lib/banking/csv-parser.ts:27-40`                       |
| runAutoMatchTransactions | Automatic invoice matching                    | `src/lib/banking/reconciliation-service.ts:15-125`          |

## Import Formats

### CSV Import

- **Supported Banks** → `src/lib/banking/csv-parser.ts:12-18`
  - Generic format (default) → `src/lib/banking/csv-parser.ts:106-127`
  - Erste → `src/lib/banking/csv-parser.ts:58-80`
  - Raiffeisenbank → `src/lib/banking/csv-parser.ts:82-104`
  - Moja Banka
  - Splitska Banka
  - OTP Bank

- **Required CSV Columns** → `src/app/(dashboard)/banking/import/page.tsx:114-131`
  - datum (date in YYYY-MM-DD format)
  - opis (description)
  - iznos (amount: positive for income, negative for expenses)
  - stanje (balance after transaction)

- **Optional CSV Columns** → `src/app/(dashboard)/banking/import/page.tsx:134-148`
  - referenca (bank reference)
  - protivna_strana (counterparty name)
  - protivni_iban (counterparty IBAN)

- **CSV Parsing Features** → `src/lib/banking/csv-parser.ts:27-193`
  - Auto-detect decimal separator (comma vs dot) → `src/lib/banking/csv-parser.ts:172-179`
  - Multiple date format support → `src/lib/banking/csv-parser.ts:133-158`
  - Invoice number extraction from description → `src/lib/banking/csv-parser.ts:181-192`
  - Croatian number format parsing (1.000,00 → 1000.00) → `src/lib/banking/import/processor.ts:30-39`

### PDF Import

- **Text Extraction** → `src/lib/banking/import/processor.ts:409-446`
  - Uses pdf-parse library for page-by-page extraction → `src/lib/banking/import/processor.ts:419-427`
  - Fallback text extraction for corrupted PDFs → `src/lib/banking/import/processor.ts:432-443`

- **LLM-Based Extraction** → `src/lib/banking/import/processor.ts:378-407`
  - DeepSeek Chat model for text parsing → `src/lib/banking/import/processor.ts:379-385`
  - Structured JSON output → `src/lib/banking/import/processor.ts:387-406`
  - Croatian bank statement format awareness → `src/lib/banking/import/prompt.ts:1-56`

- **Extraction Fields** → `src/lib/banking/import/prompt.ts:10-50`
  - Transaction date (YYYY-MM-DD format) → `src/lib/banking/import/prompt.ts:11`
  - Amount with direction (INCOMING/OUTGOING) → `src/lib/banking/import/prompt.ts:12-14`
  - Payee/payer name → `src/lib/banking/import/prompt.ts:15-16`
  - Croatian reference number (Poziv na broj) → `src/lib/banking/import/prompt.ts:17-19`
  - Page start/end balances → `src/lib/banking/import/prompt.ts:22-24`
  - Statement metadata (sequence number, IBAN) → `src/lib/banking/import/prompt.ts:26-28`

### XML Import (CAMT.053)

- **Supported Formats** → `src/lib/banking/import/processor.ts:129-247`
  - CAMT.053 (ISO 20022 bank-to-customer statement)
  - MT940 (SWIFT format) - defined in schema but not implemented

- **XML Structure Parsing** → `src/lib/banking/import/processor.ts:135-149`
  - Document/BkToCstmrStmt/Stmt path → `src/lib/banking/import/processor.ts:136-137`
  - Document/BkToCstmrAcctRpt/Rpt path → `src/lib/banking/import/processor.ts:138-139`
  - Statement ID and sequence number → `src/lib/banking/import/processor.ts:145`
  - Period dates (from/to) → `src/lib/banking/import/processor.ts:146-149`

- **Balance Extraction** → `src/lib/banking/import/processor.ts:151-164`
  - Opening balance (OPBD code) → `src/lib/banking/import/processor.ts:152-156`
  - Closing balance (CLBD code) → `src/lib/banking/import/processor.ts:157-161`
  - Currency from balance object → `src/lib/banking/import/processor.ts:164`
  - Nested amount value extraction → `src/lib/banking/import/processor.ts:41-51`

- **Transaction Parsing** → `src/lib/banking/import/processor.ts:166-236`
  - Entry array iteration → `src/lib/banking/import/processor.ts:166`
  - Credit/Debit indicator (CdtDbtInd) → `src/lib/banking/import/processor.ts:199`
  - Booking/value dates → `src/lib/banking/import/processor.ts:200`
  - Related party details (creditor/debtor) → `src/lib/banking/import/processor.ts:209-218`
  - Additional entry information → `src/lib/banking/import/processor.ts:219`

## Processing Tiers

### Tier 1: XML Parsing (Fastest)

- **When Used**: XML files (CAMT.053) → `src/lib/banking/import/processor.ts:87-88`
- **Cost**: Free (no AI models)
- **Speed**: < 1 second per statement
- **Accuracy**: 100% (structured data)
- **Status**: Immediately VERIFIED → `src/lib/banking/import/processor.ts:241`

### Tier 2: Text LLM (DeepSeek)

- **When Used**: PDF files with readable text → `src/lib/banking/import/processor.ts:90`
- **Model**: DeepSeek Chat → `src/lib/banking/import/processor.ts:380`
- **Cost**: Low (cheap text model)
- **Speed**: 2-5 seconds per page
- **Verification**: Mathematical audit per page → `src/lib/banking/import/audit.ts:30-57`
- **Status**: VERIFIED if math passes → `src/lib/banking/import/processor.ts:298`

### Tier 3: Vision LLM (Fallback)

- **When Used**: Text extraction fails math audit → `src/lib/banking/import/processor.ts:301-327`
- **Primary Model**: Ollama Qwen3-VL → `src/lib/banking/import/processor.ts:459-507`
- **Fallback Model**: OpenAI GPT-4o-mini → `src/lib/banking/import/processor.ts:509-533`
- **Cost**: Higher (vision processing)
- **Speed**: 10-30 seconds per page
- **Input**: PDF base64 + previous JSON + page text → `src/lib/banking/import/processor.ts:478-487`
- **Re-verification**: Runs math audit again → `src/lib/banking/import/processor.ts:310-322`
- **Status**: VERIFIED if repaired, else NEEDS_REVIEW → `src/lib/banking/import/processor.ts:319-322`

## Mathematical Verification

### Balance Audit

- **Formula** → `src/lib/banking/import/audit.ts:40-45`
  - Calculated End = Start + Incoming - Outgoing
  - Uses Decimal.js for precision → `src/lib/banking/import/audit.ts:1`
  - Tolerance: ±0.01 EUR → `src/lib/banking/import/audit.ts:24`

- **Verification Process** → `src/lib/banking/import/audit.ts:30-57`
  - Requires page start and end balances → `src/lib/banking/import/audit.ts:31-38`
  - Iterates through all transactions → `src/lib/banking/import/audit.ts:42-45`
  - Compares calculated vs reported balance → `src/lib/banking/import/audit.ts:47-49`
  - Returns isVerified, calculatedEnd, discrepancy → `src/lib/banking/import/audit.ts:51-56`

- **Failure Reasons** → `src/lib/banking/import/audit.ts:22`
  - MISSING_PAGE_BALANCES: No start/end balance found
  - MATH_MISMATCH: Calculation doesn't match reported balance

## Automatic Reconciliation

### Invoice Matching

- **Trigger**: Runs after every CSV import → `src/app/(dashboard)/banking/actions.ts:256-260`
- **Algorithm**: Matches unmatched transactions to unpaid invoices → `src/lib/banking/reconciliation-service.ts:15-125`
- **Confidence Threshold**: 80% for auto-match → `src/lib/banking/reconciliation-service.ts:79-82`

- **Matching Criteria** → `src/lib/banking/reconciliation.ts` (referenced)
  - Amount exact match
  - Reference number match
  - Date proximity
  - Counterparty name similarity

- **Transaction Filtering** → `src/lib/banking/reconciliation-service.ts:26-56`
  - Status: UNMATCHED only → `src/lib/banking/reconciliation-service.ts:20`
  - Amount: Positive (credits) only → `src/lib/banking/reconciliation-service.ts:53`
  - Optional: Filter by bank account → `src/lib/banking/reconciliation-service.ts:22-24`

- **Invoice Filtering** → `src/lib/banking/reconciliation-service.ts:40-47`
  - Direction: OUTBOUND only
  - Status: Unpaid (paidAt is null)
  - Includes line items for amount calculation

- **Match Results** → `src/lib/banking/reconciliation-service.ts:75-113`
  - Sets matchStatus: AUTO_MATCHED → `src/lib/banking/reconciliation-service.ts:86`
  - Links matchedInvoiceId → `src/lib/banking/reconciliation-service.ts:87`
  - Records matchedAt timestamp → `src/lib/banking/reconciliation-service.ts:88`
  - Records matchedBy user → `src/lib/banking/reconciliation-service.ts:89`
  - Stores confidence score → `src/lib/banking/reconciliation-service.ts:85`
  - Updates invoice paidAt → `src/lib/banking/reconciliation-service.ts:98-106`

## Upload Features

### File Validation

- **Allowed Extensions** → `src/app/api/banking/import/upload/route.ts:11`
  - PDF (bank statements)
  - XML (CAMT.053, MT940)

- **Size Limit** → `src/app/api/banking/import/upload/route.ts:10`
  - Maximum: 20MB
  - Validation before processing → `src/app/api/banking/import/upload/route.ts:73-75`

- **MIME Type Check** → `src/app/(dashboard)/banking/import/statement-dropzone.tsx:36-40`
  - application/pdf
  - application/xml
  - text/xml
  - File extension fallback → `src/app/api/banking/import/upload/route.ts:64`

### Duplicate Detection

- **Checksum-Based** → `src/app/api/banking/import/upload/route.ts:78`
  - SHA-256 hash of file contents
  - Prevents duplicate imports per bank account → `src/app/api/banking/import/upload/route.ts:86-91`
  - Stored as fileChecksum in ImportJob → `src/app/api/banking/import/upload/route.ts:129`

- **Overwrite Flow** → `src/app/api/banking/import/upload/route.ts:93-119`
  - Returns 409 Conflict if duplicate found → `src/app/api/banking/import/upload/route.ts:94-102`
  - User confirms overwrite → `src/app/(dashboard)/banking/import/statement-dropzone.tsx:268-288`
  - Deletes previous ImportJob and file → `src/app/api/banking/import/upload/route.ts:107-118`
  - Proceeds with new upload → `src/app/api/banking/import/upload/route.ts:121`

### Drag-and-Drop UI

- **Dropzone Component** → `src/app/(dashboard)/banking/import/statement-dropzone.tsx:15-312`
  - Drag/drop event handlers → `src/app/(dashboard)/banking/import/statement-dropzone.tsx:163-168`
  - Browse button fallback → `src/app/(dashboard)/banking/import/statement-dropzone.tsx:170-172`
  - Visual feedback (idle/uploading/success/error) → `src/app/(dashboard)/banking/import/statement-dropzone.tsx:174-179`

- **Progress Tracking** → `src/app/(dashboard)/banking/import/statement-dropzone.tsx:314-352`
  - 4-step progress bar (upload/process/vision/done) → `src/app/(dashboard)/banking/import/statement-dropzone.tsx:315-321`
  - Page-level progress display → `src/app/(dashboard)/banking/import/statement-dropzone.tsx:118-122`
  - Process log (last 6 entries) → `src/app/(dashboard)/banking/import/statement-dropzone.tsx:297-308`

- **Status Polling** → `src/app/(dashboard)/banking/import/statement-dropzone.tsx:104-154`
  - 3-second interval → `src/app/(dashboard)/banking/import/statement-dropzone.tsx:109`
  - Fetches job status via API → `src/app/(dashboard)/banking/import/statement-dropzone.tsx:111-112`
  - Stops on terminal status → `src/app/(dashboard)/banking/import/statement-dropzone.tsx:130-148`
  - Terminal states: VERIFIED, NEEDS_REVIEW, FAILED → `src/app/(dashboard)/banking/import/statement-dropzone.tsx:130`

## Data Flow

### CSV Import Data Flow

1. **File Upload** → `src/app/(dashboard)/banking/import/import-form.tsx:106-131`
   - FileReader reads file as text
   - Client-side CSV parsing with preview
   - Validation: required columns, valid data types

2. **Form Submission** → `src/app/(dashboard)/banking/import/import-form.tsx:133-176`
   - FormData with accountId, fileName, transactions JSON
   - Server action call: importBankStatement

3. **Server Processing** → `src/app/(dashboard)/banking/actions.ts:170-282`
   - Parse transactions JSON
   - Validate each transaction with Zod schema
   - Create BankImport record
   - Bulk insert BankTransaction records
   - Update bank account balance
   - Run auto-matching

4. **Success Response** → `src/app/(dashboard)/banking/import/import-form.tsx:153-170`
   - Display success message with count
   - Show auto-matched count
   - Redirect to /banking/transactions

### PDF/XML Import Data Flow

1. **File Upload** → `src/app/(dashboard)/banking/import/statement-dropzone.tsx:30-94`
   - Drag/drop or browse file selection
   - FormData with file, accountId, overwrite flag
   - POST to /api/banking/import/upload

2. **Upload Processing** → `src/app/api/banking/import/upload/route.ts:13-154`
   - Read file buffer
   - Calculate SHA-256 checksum
   - Check for duplicates
   - Save to uploads/bank-statements/{checksum}.{ext}
   - Create ImportJob (status: PENDING)

3. **Background Processing** → `src/lib/banking/import/processor.ts:72-127`
   - Find first PENDING job
   - Update status to PROCESSING
   - Route to XML or PDF handler
   - Create Statement and StatementPage records
   - Create BankTransaction records
   - Update job status (VERIFIED/NEEDS_REVIEW/FAILED)

4. **Status Updates** → `src/app/(dashboard)/banking/import/statement-dropzone.tsx:109-154`
   - Poll /api/banking/import/jobs/{id} every 3 seconds
   - Display progress (pages processed, verified, needs vision)
   - Stop polling on terminal status
   - Show final message

## Database Schema

### ImportJob

- **Purpose**: Tracks background processing of uploaded statements
- **Key Fields** → `prisma/schema.prisma:641-666`
  - fileChecksum: SHA-256 for duplicate detection → `prisma/schema.prisma:646`
  - storagePath: Local file path → `prisma/schema.prisma:648`
  - status: JobStatus enum → `prisma/schema.prisma:649`
  - tierUsed: TierType (XML/TEXT_LLM/VISION_LLM) → `prisma/schema.prisma:652`
  - pagesProcessed: Count of processed pages → `prisma/schema.prisma:654`
  - pagesFailed: Count of failed pages → `prisma/schema.prisma:655`
  - failureReason: Error message if FAILED → `prisma/schema.prisma:653`

### Statement

- **Purpose**: Represents a complete bank statement
- **Key Fields** → `prisma/schema.prisma:670-695`
  - importJobId: Links to ImportJob (unique) → `prisma/schema.prisma:672`
  - sequenceNumber: Statement number from bank → `prisma/schema.prisma:678`
  - periodStart/periodEnd: Date range → `prisma/schema.prisma:676-677`
  - openingBalance/closingBalance: Statement totals → `prisma/schema.prisma:680-681`
  - previousStatementId: Chain link for continuity → `prisma/schema.prisma:679`
  - isGapDetected: Missing sequence warning → `prisma/schema.prisma:683`

### StatementPage

- **Purpose**: Individual pages within PDF statements
- **Key Fields** → `prisma/schema.prisma:701-716`
  - pageNumber: Sequential page number → `prisma/schema.prisma:705`
  - pageStartBalance/pageEndBalance: For math audit → `prisma/schema.prisma:706-707`
  - status: PageStatus (PENDING/VERIFIED/NEEDS_VISION/FAILED) → `prisma/schema.prisma:708`
  - rawText: Extracted text for debugging → `prisma/schema.prisma:709`

### BankTransaction

- **Purpose**: Individual bank account movements
- **Key Fields** → `prisma/schema.prisma:461-486`
  - date: Transaction date → `prisma/schema.prisma:465`
  - amount: Decimal(12,2) precision → `prisma/schema.prisma:467`
  - balance: Running balance → `prisma/schema.prisma:468`
  - reference: Bank reference number → `prisma/schema.prisma:469`
  - counterpartyName/counterpartyIban: Other party details → `prisma/schema.prisma:470-471`
  - matchStatus: MatchStatus enum → `prisma/schema.prisma:474`
  - matchedInvoiceId/matchedExpenseId: Reconciliation links → `prisma/schema.prisma:472-473`
  - confidenceScore: Match quality (0-100) → `prisma/schema.prisma:478`
  - source: TransactionSource (MANUAL/IMPORT/SYNC) → `prisma/schema.prisma:482`

### BankImport

- **Purpose**: Records import history
- **Key Fields** → `prisma/schema.prisma:626-639`
  - fileName: Original uploaded file name → `prisma/schema.prisma:630`
  - format: ImportFormat (CSV/XML_CAMT053/MT940) → `prisma/schema.prisma:631`
  - transactionCount: Number imported → `prisma/schema.prisma:632`
  - importedAt: Timestamp → `prisma/schema.prisma:633`
  - importedBy: User ID → `prisma/schema.prisma:634`

## Enums

### ImportFormat

- **Values** → `prisma/schema.prisma:879-883`
  - CSV: Manual CSV upload
  - XML_CAMT053: ISO 20022 format
  - MT940: SWIFT format (defined but not implemented)

### JobStatus

- **Values** → `prisma/schema.prisma:885-893`
  - PENDING: Awaiting processing
  - PROCESSING: Currently being processed
  - VERIFIED: Math audit passed
  - NEEDS_REVIEW: Manual review required
  - FAILED: Processing error

### TierType

- **Values** → `prisma/schema.prisma:896-900`
  - XML: Direct XML parsing
  - TEXT_LLM: DeepSeek text extraction
  - VISION_LLM: Ollama/OpenAI vision fallback

### PageStatus

- **Values** → `prisma/schema.prisma:908-913`
  - PENDING: Not yet processed
  - VERIFIED: Math audit passed
  - NEEDS_VISION: Requires vision model
  - FAILED: Processing failed

## Validation

### Client-Side Validation

1. **CSV Validation** → `src/app/(dashboard)/banking/import/import-form.tsx:55-101`
   - Header row must contain: datum, opis, iznos, stanje
   - Data rows must have valid date format
   - Amount and balance must be numbers
   - At least one valid transaction required

2. **File Type Validation** → `src/app/(dashboard)/banking/import/statement-dropzone.tsx:36-40`
   - PDF or XML only
   - MIME type check with extension fallback

3. **Preview Generation** → `src/app/(dashboard)/banking/import/import-form.tsx:106-131`
   - Real-time parsing as file loads
   - Error display if parsing fails
   - Shows first 100 transactions

### Server-Side Validation

1. **Upload Validation** → `src/app/api/banking/import/upload/route.ts:54-75`
   - File and accountId required
   - Bank account must belong to company
   - File extension in allowed list
   - File not empty
   - File size under 20MB

2. **Transaction Validation** → `src/app/(dashboard)/banking/actions.ts:192-209`
   - Zod schema validation per transaction
   - Required: accountId, date, description, amount
   - Optional: balance, reference, counterparty details
   - Amount must be numeric
   - Date must be valid

3. **Tenant Isolation** → `src/app/api/banking/import/upload/route.ts:44-47`
   - setTenantContext enforces company scope
   - Bank account ownership verified
   - All queries filtered by companyId

## Dependencies

- **Depends on**:
  - [[auth-login]] - User authentication required → `src/app/(dashboard)/banking/import/page.tsx:11`
  - [[company-management]] - Company must exist → `src/app/(dashboard)/banking/import/page.tsx:12`
  - [[bank-accounts]] - Must have bank account to import → `src/app/(dashboard)/banking/import/page.tsx:20-29`
  - [[deepseek-integration]] - Text extraction from PDF → `src/lib/banking/import/processor.ts:379`
  - [[ollama-integration]] - Vision fallback model → `src/lib/banking/import/processor.ts:459-507`
  - [[openai-integration]] - Vision fallback alternative → `src/lib/banking/import/processor.ts:509-533`
  - [[pdf-parse]] - PDF text extraction → `src/lib/banking/import/processor.ts:412`
  - [[fast-xml-parser]] - XML parsing → `src/lib/banking/import/processor.ts:8`

- **Depended by**:
  - [[bank-reconciliation]] - Uses imported transactions for matching
  - [[bank-transactions]] - Displays imported transactions → `src/app/(dashboard)/banking/import/import-form.tsx:169`
  - [[statement-review]] - Manual review of NEEDS_REVIEW statements
  - [[invoice-reconciliation]] - Auto-matches imports to invoices → `src/app/(dashboard)/banking/actions.ts:256-260`

## Integrations

### DeepSeek Integration

- **Model**: deepseek-chat → `src/lib/banking/import/processor.ts:380`
- **Purpose**: Extract structured data from PDF text
- **Input**: System prompt + page text → `src/lib/banking/import/processor.ts:381-384`
- **Output**: JSON with transactions and balances → `src/lib/banking/import/processor.ts:387-406`
- **System Prompt**: Croatian bank statement expertise → `src/lib/banking/import/prompt.ts:1-56`

### Ollama Integration

- **Model**: qwen3-vl:235b-instruct → `src/lib/banking/import/processor.ts:461`
- **Purpose**: Vision-based extraction for failed text parsing
- **Timeout**: 90 seconds → `src/lib/banking/import/processor.ts:468`
- **Input**: Page text + previous JSON + PDF base64 → `src/lib/banking/import/processor.ts:478-487`
- **Response Format**: JSON object → `src/lib/banking/import/processor.ts:489`

### OpenAI Integration

- **Model**: gpt-4o-mini → `src/lib/banking/import/processor.ts:514`
- **Purpose**: Fallback if Ollama unavailable
- **Input**: Same as Ollama → `src/lib/banking/import/processor.ts:518-524`
- **Response Format**: JSON object → `src/lib/banking/import/processor.ts:526`

### PDF Parse Integration

- **Library**: pdf-parse (npm package) → `src/lib/banking/import/processor.ts:412`
- **Method**: Page-by-page text extraction → `src/lib/banking/import/processor.ts:419-427`
- **Fallback**: Simple string extraction for corrupted PDFs → `src/lib/banking/import/processor.ts:432-443`

### Fast XML Parser Integration

- **Library**: fast-xml-parser → `src/lib/banking/import/processor.ts:8`
- **Configuration**: Preserves attributes, parses values → `src/lib/banking/import/processor.ts:132`
- **Standards**: ISO 20022 CAMT.053 compliance → `src/lib/banking/import/processor.ts:136-139`

## Verification Checklist

- [ ] User can access /banking/import with authentication
- [ ] Bank accounts dropdown populated correctly
- [ ] CSV file upload shows preview of transactions
- [ ] CSV parsing handles Croatian number format (1.000,00)
- [ ] Bank-specific CSV formats parsed correctly (Erste, Raiffeisen)
- [ ] PDF upload creates ImportJob with PENDING status
- [ ] XML upload directly creates Statement and transactions
- [ ] SHA-256 checksum prevents duplicate imports
- [ ] Duplicate detection offers overwrite option
- [ ] Background processing updates job status
- [ ] Real-time polling displays progress
- [ ] Mathematical audit detects balance mismatches
- [ ] Vision fallback repairs failed text extraction
- [ ] Transactions created with correct amounts and dates
- [ ] Statement pages link to parent statement
- [ ] Auto-matching runs after CSV import
- [ ] Invoice reconciliation updates matchStatus
- [ ] Confidence scores calculated for matches
- [ ] Import history displays recent imports
- [ ] Last statement info shown per account
- [ ] Tenant isolation prevents cross-company access
- [ ] File size limit enforced (20MB)
- [ ] Progress bar shows correct tier (TEXT_LLM vs VISION_LLM)
- [ ] Error messages displayed for failed imports
- [ ] Success redirect to /banking/transactions

## Evidence Links

1. Entry point page component → `src/app/(dashboard)/banking/import/page.tsx:10`
2. Import form with CSV parsing → `src/app/(dashboard)/banking/import/import-form.tsx:25`
3. Drag-and-drop dropzone → `src/app/(dashboard)/banking/import/statement-dropzone.tsx:15`
4. Server action for CSV import → `src/app/(dashboard)/banking/actions.ts:170`
5. Upload API endpoint → `src/app/api/banking/import/upload/route.ts:13`
6. Processing API endpoint → `src/app/api/banking/import/process/route.ts:7`
7. Core processor function → `src/lib/banking/import/processor.ts:72`
8. XML handler (CAMT.053) → `src/lib/banking/import/processor.ts:129`
9. PDF handler → `src/lib/banking/import/processor.ts:249`
10. Math audit function → `src/lib/banking/import/audit.ts:30`
11. DeepSeek text extraction → `src/lib/banking/import/processor.ts:378`
12. Vision fallback (Ollama/OpenAI) → `src/lib/banking/import/processor.ts:448`
13. CSV parser with bank support → `src/lib/banking/csv-parser.ts:27`
14. Croatian number parsing → `src/lib/banking/import/processor.ts:30`
15. Auto-match service → `src/lib/banking/reconciliation-service.ts:15`
16. Job status API → `src/app/api/banking/import/jobs/[id]/route.ts:6`
17. ImportJob schema → `prisma/schema.prisma:641`
18. Statement schema → `prisma/schema.prisma:670`
19. StatementPage schema → `prisma/schema.prisma:701`
20. BankTransaction schema → `prisma/schema.prisma:461`
21. BankImport schema → `prisma/schema.prisma:626`
22. ImportFormat enum → `prisma/schema.prisma:879`
23. JobStatus enum → `prisma/schema.prisma:885`
24. TierType enum → `prisma/schema.prisma:896`
25. PageStatus enum → `prisma/schema.prisma:908`
26. Bank statement system prompt → `src/lib/banking/import/prompt.ts:1`
27. Duplicate detection logic → `src/app/api/banking/import/upload/route.ts:86`
28. Overwrite flow → `src/app/api/banking/import/upload/route.ts:106`
29. Status polling → `src/app/(dashboard)/banking/import/statement-dropzone.tsx:104`
30. Progress bar component → `src/app/(dashboard)/banking/import/statement-dropzone.tsx:314`
31. CSV preview table → `src/app/(dashboard)/banking/import/import-form.tsx:248`
32. Transaction validation schema → `src/app/(dashboard)/banking/actions.ts:158`
33. Balance audit result → `src/lib/banking/import/audit.ts:15`
34. Statement metadata derivation → `src/lib/banking/import/processor.ts:558`
35. Recent imports display → `src/app/(dashboard)/banking/import/page.tsx:163`
