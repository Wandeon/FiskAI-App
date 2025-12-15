# F074 - Document Upload

## Summary

Provides a unified document upload system at `/documents` that enables users to drag-and-drop or select files (PDF, XML, CSV, images) for automatic processing into invoices, bank statements, or expenses. The feature includes intelligent document type detection, multi-file upload support, AI-powered OCR extraction, mobile camera capture with document scanning filters, and Cloudflare R2 cloud storage integration for secure file management.

## Route & Accessibility

| Type      | Path                     | Evidence                                               |
| --------- | ------------------------ | ------------------------------------------------------ |
| Page      | /documents               | `src/app/(dashboard)/documents/page.tsx:38-324`        |
| Component | CompactDropzone          | `src/components/documents/compact-dropzone.tsx:18-161` |
| Component | DocumentsClient          | `src/components/documents/documents-client.tsx:28-307` |
| API       | POST /api/import/upload  | `src/app/api/import/upload/route.ts:14-95`             |
| API       | POST /api/import/process | `src/app/api/import/process/route.ts:9-404`            |
| API       | GET /api/import/jobs/:id | `src/app/api/import/jobs/[id]/route.ts:6-47`           |
| Storage   | R2 Client                | `src/lib/r2-client.ts:5-67`                            |
| Detection | Document Type Detection  | `src/lib/import/detect-document-type.ts:19-155`        |

## User Flow

1. User navigates to `/documents` page -> `src/app/(dashboard)/documents/page.tsx:38`
2. Page displays CompactDropzone upload area at top -> `src/components/documents/documents-client.tsx:256-261`
3. User drags files or clicks "Odaberi" button -> `src/components/documents/compact-dropzone.tsx:35-40`
4. On mobile, user can tap Camera icon to capture document -> `src/components/documents/compact-dropzone.tsx:116-129`
5. Camera opens, user captures image -> `src/components/documents/compact-dropzone.tsx:75-82`
6. DocumentScanner modal shows preview with filter options -> `src/components/import/document-scanner.tsx:14-212`
7. User applies Enhanced/B&W filters to improve readability -> `src/components/import/document-scanner.tsx:64-93`
8. User confirms capture, file added to upload queue -> `src/components/import/document-scanner.tsx:96-111`
9. File uploaded to server via FormData -> `src/components/documents/documents-client.tsx:101-111`
10. Server validates file type and size -> `src/app/api/import/upload/route.ts:34-47`
11. Document type detected automatically -> `src/app/api/import/upload/route.ts:59-61`
12. File stored locally and ImportJob created -> `src/app/api/import/upload/route.ts:52-75`
13. Background processing triggered -> `src/app/api/import/upload/route.ts:77-86`
14. AI extracts data based on document type -> `src/app/api/import/process/route.ts:32-76`
15. Processing sidebar shows real-time progress -> `src/components/documents/documents-client.tsx:268-277`
16. User reviews extracted data in confirmation modal -> `src/components/documents/documents-client.tsx:145-156`
17. User confirms or rejects import -> `src/components/documents/documents-client.tsx:158-191`
18. Confirmed documents appear in unified documents list -> `src/app/(dashboard)/documents/page.tsx:228-295`

## Component Architecture

| Component           | Purpose                                   | Evidence                                                   |
| ------------------- | ----------------------------------------- | ---------------------------------------------------------- |
| DocumentsPage       | Server component with upload area & list  | `src/app/(dashboard)/documents/page.tsx:38-324`            |
| DocumentsClient     | Client wrapper managing upload state      | `src/components/documents/documents-client.tsx:28-307`     |
| CompactDropzone     | Drag-drop upload area with camera support | `src/components/documents/compact-dropzone.tsx:18-161`     |
| DocumentScanner     | Mobile camera capture with filters        | `src/components/import/document-scanner.tsx:14-212`        |
| ReportsSidebar      | Processing queue sidebar                  | `src/components/documents/documents-client.tsx:268-277`    |
| ConfirmationModal   | Review & edit extracted data              | `src/components/documents/documents-client.tsx:280-304`    |
| CategoryCards       | Filter documents by category              | `src/components/documents/category-cards.tsx:31-117`       |
| NewDocumentDropdown | Create new document menu                  | `src/components/documents/new-document-dropdown.tsx:9-102` |

## Supported File Formats

The system accepts multiple file formats with automatic type detection -> `src/lib/import/detect-document-type.ts:143-155`:

| Format | MIME Type       | Extensions  | Typical Use Case     | Evidence                                         |
| ------ | --------------- | ----------- | -------------------- | ------------------------------------------------ |
| PDF    | application/pdf | .pdf        | Invoices, statements | `src/lib/import/detect-document-type.ts:144`     |
| XML    | application/xml | .xml        | CAMT.053 statements  | `src/lib/import/detect-document-type.ts:145-146` |
| CSV    | text/csv        | .csv        | Bank exports         | `src/lib/import/detect-document-type.ts:147`     |
| JPEG   | image/jpeg      | .jpg, .jpeg | Scanned receipts     | `src/lib/import/detect-document-type.ts:148`     |
| PNG    | image/png       | .png        | Screenshots          | `src/lib/import/detect-document-type.ts:149`     |
| HEIC   | image/heic      | .heic       | iPhone photos        | `src/lib/import/detect-document-type.ts:150`     |
| WebP   | image/webp      | .webp       | Modern images        | `src/lib/import/detect-document-type.ts:151`     |

File validation constraints -> `src/app/api/import/upload/route.ts:11-47`:

- Maximum file size: 20MB -> `src/app/api/import/upload/route.ts:11`
- Allowed extensions validated on upload -> `src/app/api/import/upload/route.ts:12`
- Empty files rejected -> `src/app/api/import/upload/route.ts:42-44`
- Unsupported types return error -> `src/app/api/import/upload/route.ts:36-39`

## Document Type Detection

Intelligent detection based on file characteristics -> `src/lib/import/detect-document-type.ts:19-126`:

### XML Detection

```typescript
// XML files = bank statements (CAMT.053)
if (ext === "xml") {
  return {
    type: DocumentType.BANK_STATEMENT,
    confidence: 0.95,
    reason: "XML format typically used for CAMT.053 bank statements",
  }
}
```

Evidence: `src/lib/import/detect-document-type.ts:28-34`

### CSV Detection

```typescript
// CSV files = bank exports
if (ext === "csv") {
  return {
    type: DocumentType.BANK_STATEMENT,
    confidence: 0.85,
    reason: "CSV format typically used for bank transaction exports",
  }
}
```

Evidence: `src/lib/import/detect-document-type.ts:37-43`

### Image Detection

```typescript
// Images = invoices/receipts
if (["jpg", "jpeg", "png", "heic", "webp"].includes(ext)) {
  return {
    type: DocumentType.INVOICE,
    confidence: 0.8,
    reason: "Image format typically used for scanned invoices",
  }
}
```

Evidence: `src/lib/import/detect-document-type.ts:46-52`

### PDF Detection

PDF files use filename pattern matching and content analysis -> `src/lib/import/detect-document-type.ts:55-118`:

**Croatian bank statement patterns:**

- FSTM prefix (Fina statements): 95% confidence -> `src/lib/import/detect-document-type.ts:58-64`
- "izvod", "statement", "promet" keywords: 90% confidence -> `src/lib/import/detect-document-type.ts:67-79`

**Invoice patterns:**

- "racun", "faktura", "invoice" keywords: 90% confidence -> `src/lib/import/detect-document-type.ts:82-88`

**Content-based detection:**

- Bank keywords (izvod, stanje, promet, iban): Bank statement -> `src/lib/import/detect-document-type.ts:9-11,91-101`
- Invoice keywords (račun, pdv, oib, iznos): Invoice -> `src/lib/import/detect-document-type.ts:14-16,103-109`
- Default: Invoice (50% confidence) -> `src/lib/import/detect-document-type.ts:112-117`

## Upload Process

### Client-Side Upload Flow

**File Selection** -> `src/components/documents/compact-dropzone.tsx:29-46`:

```typescript
const onDrop = useCallback(
  (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFilesDropped(acceptedFiles)
    }
  },
  [onFilesDropped]
)

const { getRootProps, getInputProps, isDragActive } = useDropzone({
  onDrop,
  accept: ACCEPTED_FILE_TYPES,
  disabled,
  multiple: true,
})
```

**Queue Management** -> `src/components/documents/documents-client.tsx:83-143`:

1. File added to queue with temporary ID
2. Status set to PENDING
3. FormData created with file and bank account
4. Upload sent to `/api/import/upload`
5. Temporary ID replaced with server job ID
6. Status updated based on response

### Server-Side Processing

**Upload Endpoint** -> `src/app/api/import/upload/route.ts:14-95`:

1. **Authentication & Authorization**
   - Verify user session -> `src/app/api/import/upload/route.ts:15-21`
   - Set tenant context -> `src/app/api/import/upload/route.ts:18-21`

2. **File Validation**
   - Check file exists -> `src/app/api/import/upload/route.ts:28-30`
   - Validate extension -> `src/app/api/import/upload/route.ts:34-39`
   - Check file size (max 20MB) -> `src/app/api/import/upload/route.ts:45-47`
   - Reject empty files -> `src/app/api/import/upload/route.ts:42-44`

3. **File Storage**
   - Generate SHA256 checksum -> `src/app/api/import/upload/route.ts:50`
   - Store in `uploads/imports/` directory -> `src/app/api/import/upload/route.ts:53-57`
   - Filename: `{checksum}.{extension}` -> `src/app/api/import/upload/route.ts:55`

4. **Document Detection**
   - Detect type from filename and MIME -> `src/app/api/import/upload/route.ts:60`
   - Allow manual override -> `src/app/api/import/upload/route.ts:61`

5. **Job Creation**
   - Create ImportJob record -> `src/app/api/import/upload/route.ts:64-75`
   - Status: PENDING
   - Store checksum, path, type
   - Link to company and bank account

6. **Background Processing**
   - Trigger async processing -> `src/app/api/import/upload/route.ts:77-86`
   - Non-blocking fetch to `/api/import/process`
   - Returns immediately with job ID

## AI-Powered Data Extraction

### Bank Statement Processing

**XML Processing (CAMT.053)** -> `src/app/api/import/process/route.ts:79-121`:

- Parse XML with fast-xml-parser
- Extract opening/closing balances
- Parse transaction entries
- Extract counterparty IBAN and names
- Validate mathematical consistency

**CSV Processing** -> `src/app/api/import/process/route.ts:123-153`:

- Detect column headers (date, description, amount)
- Parse transaction rows
- Determine direction from amount sign
- Skip invalid rows

**PDF/Image Processing** -> `src/app/api/import/process/route.ts:155-263`:

- PDF: Extract text with pdf-parse -> `src/app/api/import/process/route.ts:162-168`
- Image: Use Ollama Vision API with base64 encoding -> `src/app/api/import/process/route.ts:179-231`
- AI model: Qwen3-VL (235B parameters) -> `src/app/api/import/process/route.ts:181`
- JSON response format with transactions array -> `src/app/api/import/process/route.ts:234-256`
- Math validation for balance accuracy -> `src/app/api/import/process/route.ts:251-255`

### Invoice Processing

**PDF Invoices** -> `src/app/api/import/process/route.ts:276-297`:

- Extract text content with pdf-parse
- Use Deepseek AI for structured extraction
- System prompt: INVOICE_SYSTEM_PROMPT
- JSON output with vendor, line items, totals

**Image Invoices** -> `src/app/api/import/process/route.ts:299-353`:

- Encode image to base64
- Send to Ollama Vision API
- Extract vendor details (name, OIB, IBAN)
- Parse line items with quantities, prices, tax rates
- Extract payment information (IBAN, model, reference)
- Validate subtotal + tax = total -> `src/app/api/import/process/route.ts:373-375`

**Extracted Invoice Data** -> `src/app/api/import/process/route.ts:377-402`:

```typescript
{
  vendor: { name, oib, address, iban, bankName },
  invoice: { number, issueDate, dueDate, deliveryDate },
  lineItems: [{ description, quantity, unitPrice, taxRate, amount }],
  subtotal: number,
  taxAmount: number,
  totalAmount: number,
  currency: string,
  payment: { iban, model, reference },
  mathValid: boolean
}
```

## Cloudflare R2 Storage Integration

### R2 Client Configuration

**Environment Variables** -> `.env.example:49-53`:

```bash
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=fiskai-documents
```

**Client Initialization** -> `src/lib/r2-client.ts:5-14`:

```typescript
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})
```

### Storage Operations

**Upload to R2** -> `src/lib/r2-client.ts:16-30`:

```typescript
export async function uploadToR2(key: string, data: Buffer, contentType: string): Promise<string> {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: data,
      ContentType: contentType,
    })
  )
  return key
}
```

**Download from R2** -> `src/lib/r2-client.ts:32-45`:

- Fetch object with GetObjectCommand
- Stream chunks into Buffer
- Return concatenated buffer

**Delete from R2** -> `src/lib/r2-client.ts:47-54`:

- Remove object with DeleteObjectCommand

**Key Generation** -> `src/lib/r2-client.ts:56-67`:

```typescript
// Pattern: attachments/{companyId}/{year}/{month}/{hash}.{ext}
// Example: attachments/cm123/2024/12/a1b2c3d4.pdf
export function generateR2Key(companyId: string, contentHash: string, filename: string): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const ext = filename.split(".").pop() || "bin"

  return `attachments/${companyId}/${year}/${month}/${contentHash}.${ext}`
}
```

### Receipt Upload Integration

**Receipt Upload API** -> `src/app/api/receipts/upload/route.ts:14-82`:

1. **Validation**
   - Max size: 10MB -> `src/app/api/receipts/upload/route.ts:11`
   - Allowed types: JPEG, PNG, WebP, HEIC, PDF -> `src/app/api/receipts/upload/route.ts:12`

2. **Upload Flow**
   - Generate content hash (SHA256, 16 chars) -> `src/app/api/receipts/upload/route.ts:51`
   - Generate R2 key with company ID -> `src/app/api/receipts/upload/route.ts:54`
   - Upload to R2 bucket -> `src/app/api/receipts/upload/route.ts:57`
   - Return receipt URL: `receipts://{key}` -> `src/app/api/receipts/upload/route.ts:61`

## Mobile Camera Integration

### Camera Capture Flow

**Native Camera Trigger** -> `src/components/documents/compact-dropzone.tsx:74-82`:

```typescript
<input
  ref={cameraInputRef}
  type="file"
  accept="image/*"
  capture="environment"
  onChange={handleCameraCapture}
  className="hidden"
/>
```

**Camera Button** -> `src/components/documents/compact-dropzone.tsx:116-129`:

- Visible on mobile devices only (sm:hidden)
- Directly triggers native camera
- Uses "environment" camera (rear-facing)
- Captures single image

**Image Processing** -> `src/components/documents/compact-dropzone.tsx:48-58`:

1. User captures image
2. File received from camera input
3. DocumentScanner modal opens
4. Image shown with filter options
5. User confirms or retakes

### Document Scanner Features

**Filter Options** -> `src/components/import/document-scanner.tsx:12-94`:

| Filter   | Effect                        | Evidence                                           |
| -------- | ----------------------------- | -------------------------------------------------- |
| Original | No processing                 | `src/components/import/document-scanner.tsx:58`    |
| Enhanced | Contrast +40%, brightness +20 | `src/components/import/document-scanner.tsx:64-72` |
| B&W      | Grayscale + threshold @ 180   | `src/components/import/document-scanner.tsx:73-91` |

**Image Processing** -> `src/components/import/document-scanner.tsx:40-94`:

1. Load image into canvas (max 1200px)
2. Apply selected filter to pixel data
3. Display preview in real-time
4. User can switch filters instantly

**Export** -> `src/components/import/document-scanner.tsx:96-111`:

- Canvas converted to JPEG blob
- Quality: 90%
- Filename: `scan-{timestamp}.jpg`
- Returned to upload handler

## Real-Time Processing Queue

### Job State Management

**ImportJobState Interface** -> `src/components/documents/documents-client.tsx:6`:

```typescript
{
  id: string
  fileName: string
  status: 'PENDING' | 'PROCESSING' | 'READY_FOR_REVIEW' | 'CONFIRMED' | 'REJECTED' | 'FAILED'
  documentType: DocumentType | null
  progress: number
  error: string | null
  extractedData?: any
  transactionCount?: number
}
```

### Status Polling

**Automatic Updates** -> `src/components/documents/documents-client.tsx:50-81`:

- Poll every 2 seconds for PENDING/PROCESSING jobs
- Fetch job status from `/api/import/jobs/{id}`
- Update progress: PROCESSING=50%, READY_FOR_REVIEW=100%
- Stop polling when job completes or fails

### Sidebar Display

**Processing Sidebar** -> `src/components/documents/documents-client.tsx:268-277`:

- Auto-opens when jobs are active -> `src/components/documents/documents-client.tsx:41-47`
- Shows queue of all non-confirmed jobs
- Real-time progress indicators
- Retry button for failed jobs
- Remove button to dismiss jobs
- Document type switcher

## Review & Confirmation

### Confirmation Modal

**Modal Trigger** -> `src/components/documents/documents-client.tsx:145-156`:

- User clicks "View" on READY_FOR_REVIEW job
- Fetches full job data with extracted content
- Opens modal with editable data

**Bank Statement Review** -> `src/components/documents/documents-client.tsx:280-304`:

- Transaction table with editable fields
- Opening/closing balance display
- Math validation indicator
- Bank account selector
- Confirm/Discard actions

**Invoice Review** -> `src/components/documents/documents-client.tsx:280-304`:

- Vendor information
- Line items table
- Tax calculation
- Payment details
- Edit before confirming

### Confirmation Actions

**Confirm** -> `src/components/documents/documents-client.tsx:158-182`:

1. Send edited data to `/api/import/jobs/{id}/confirm`
2. Create transactions or expense records
3. Mark job as CONFIRMED
4. Refresh page to show new documents

**Reject** -> `src/components/documents/documents-client.tsx:184-191`:

1. Mark job as REJECTED
2. Remove from queue
3. Keep file for potential retry

**Retry** -> `src/components/documents/documents-client.tsx:193-203`:

1. Reset job to PENDING status
2. Trigger reprocessing
3. New AI extraction attempt

**Change Type** -> `src/components/documents/documents-client.tsx:209-232`:

1. User selects different document type
2. Update job.documentType
3. Reset to PENDING
4. Reprocess with new type

## Integration with Unified Documents Hub

### Category Filtering

**Documents Display** -> `src/app/(dashboard)/documents/page.tsx:98-104`:

```typescript
const { documents, total, counts } = await queryUnifiedDocuments({
  companyId: company.id,
  category,
  search: searchTerm,
  page,
  pageSize: 20,
})
```

**Unified Query** -> `src/lib/documents/unified-query.ts:106-237`:

- Fetches invoices, bank statements, expenses in parallel
- Normalizes all document types to common format
- Filters by category if specified
- Sorts by date descending
- Returns paginated results with counts

### Document Categories

**Category Metadata** -> `src/lib/documents/unified-query.ts:22-27`:

| Category       | Label   | Color                           | Source                     |
| -------------- | ------- | ------------------------------- | -------------------------- |
| invoice        | Račun   | bg-blue-100 text-blue-800       | EInvoice (type!=E_INVOICE) |
| e-invoice      | E-Račun | bg-purple-100 text-purple-800   | EInvoice (type=E_INVOICE)  |
| bank-statement | Izvod   | bg-emerald-100 text-emerald-800 | ImportJob                  |
| expense        | Trošak  | bg-orange-100 text-orange-800   | Expense                    |

**Filter Cards** -> `src/components/documents/category-cards.tsx:19-79`:

- "Svi" shows all documents
- "Računi" filters to invoices
- "E-Računi" filters to e-invoices
- "Izvodi" filters to bank statements -> Uses uploaded documents
- "Troškovi" filters to expenses
- Count badges show totals per category
- Active category highlighted in blue

## Dependencies & Integrations

### Frontend Dependencies

| Package        | Purpose                     | Evidence                                          |
| -------------- | --------------------------- | ------------------------------------------------- |
| react-dropzone | Drag-drop file upload       | `src/components/documents/compact-dropzone.tsx:4` |
| lucide-react   | Icons (UploadCloud, Camera) | `src/components/documents/compact-dropzone.tsx:5` |
| next/dynamic   | Code splitting for modal    | `src/components/documents/documents-client.tsx:7` |

### Backend Dependencies

| Package            | Purpose                  | Evidence                                  |
| ------------------ | ------------------------ | ----------------------------------------- |
| @aws-sdk/client-s3 | S3-compatible R2 storage | `src/lib/r2-client.ts:3`                  |
| fast-xml-parser    | Parse CAMT.053 XML       | `src/app/api/import/process/route.ts:5`   |
| pdf-parse          | Extract PDF text         | `src/app/api/import/process/route.ts:163` |

### AI Services

| Service     | Model                  | Use Case            | Evidence                                  |
| ----------- | ---------------------- | ------------------- | ----------------------------------------- |
| Deepseek AI | deepseek-chat          | PDF text extraction | `src/app/api/import/process/route.ts:170` |
| Ollama      | qwen3-vl:235b-instruct | Image OCR           | `src/app/api/import/process/route.ts:181` |

## Feature Evidence Links

1. **Main Documents Page** - Server component with upload area and unified document listing
   `src/app/(dashboard)/documents/page.tsx:38-324`

2. **CompactDropzone Component** - Drag-drop upload with camera support and file validation
   `src/components/documents/compact-dropzone.tsx:18-161`

3. **DocumentsClient Wrapper** - Client-side state management for upload queue and processing
   `src/components/documents/documents-client.tsx:28-307`

4. **Upload API Endpoint** - File validation, storage, and job creation
   `src/app/api/import/upload/route.ts:14-95`

5. **Processing API Endpoint** - AI-powered data extraction for all document types
   `src/app/api/import/process/route.ts:9-404`

6. **Document Type Detection** - Intelligent detection from filename, extension, and content
   `src/lib/import/detect-document-type.ts:19-155`

7. **R2 Storage Client** - Cloudflare R2 integration for secure file storage
   `src/lib/r2-client.ts:5-67`

8. **DocumentScanner Component** - Mobile camera capture with image enhancement filters
   `src/components/import/document-scanner.tsx:14-212`

9. **Unified Query System** - Aggregates all document types with category filtering
   `src/lib/documents/unified-query.ts:106-237`

10. **Category Cards Component** - Filter pills for document categories with count badges
    `src/components/documents/category-cards.tsx:31-117`

11. **Job Status API** - Real-time job status polling for processing updates
    `src/app/api/import/jobs/[id]/route.ts:6-47`

12. **Receipt Upload API** - Dedicated endpoint for expense receipt uploads to R2
    `src/app/api/receipts/upload/route.ts:14-82`
