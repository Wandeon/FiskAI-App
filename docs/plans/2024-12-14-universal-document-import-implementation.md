# Universal Document Import - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a unified document import system with smart dropzone, parallel processing, and user confirmation before DB write.

**Architecture:** React client components manage file queue state. Files upload to API, process in parallel via background jobs, store extracted data as JSON in ImportJob. User reviews in full-screen modal, edits if needed, then confirms to write to actual DB tables.

**Tech Stack:** Next.js 15 App Router, React 18, Prisma, PostgreSQL, Tailwind CSS, react-pdf for PDF viewing

---

## Task 1: Update Prisma Schema

**Files:**

- Modify: `prisma/schema.prisma:451-474` (ImportJob model)
- Modify: `prisma/schema.prisma:691-697` (JobStatus enum)

**Step 1: Add new enum values and fields to schema**

Add to `JobStatus` enum (after FAILED):

```prisma
enum JobStatus {
  PENDING
  PROCESSING
  READY_FOR_REVIEW
  CONFIRMED
  REJECTED
  VERIFIED
  NEEDS_REVIEW
  FAILED
}
```

Add new `DocumentType` enum (after JobStatus):

```prisma
enum DocumentType {
  BANK_STATEMENT
  INVOICE
  EXPENSE
}
```

Update `ImportJob` model:

```prisma
model ImportJob {
  id             String        @id @default(cuid())
  companyId      String
  userId         String
  bankAccountId  String?       // Make optional - not needed for invoices
  fileChecksum   String
  originalName   String
  storagePath    String
  status         JobStatus     @default(PENDING)
  documentType   DocumentType?
  extractedData  Json?         // Parsed data before confirmation
  tierUsed       TierType?
  failureReason  String?
  pagesProcessed Int           @default(0)
  pagesFailed    Int           @default(0)
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  bankAccount    BankAccount?  @relation(fields: [bankAccountId], references: [id], onDelete: Cascade)
  company        Company       @relation(fields: [companyId], references: [id], onDelete: Cascade)
  statement      Statement?

  @@index([companyId])
  @@index([bankAccountId])
  @@index([status])
  @@index([bankAccountId, fileChecksum])
}
```

**Step 2: Generate Prisma client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client"

**Step 3: Create and apply migration**

Run: `npx prisma migrate dev --name add_document_import_fields`
Expected: Migration applied successfully

**Step 4: Commit**

```bash
git add prisma/
git commit -m "feat(schema): add DocumentType enum and ImportJob fields for universal import"
```

---

## Task 2: Create Document Type Detection

**Files:**

- Create: `src/lib/import/detect-document-type.ts`

**Step 1: Create detection utility**

```typescript
import { DocumentType } from "@prisma/client"

export interface DetectionResult {
  type: DocumentType
  confidence: number // 0-1
  reason: string
}

const BANK_KEYWORDS = [
  "izvod",
  "stanje",
  "promet",
  "saldo",
  "iban",
  "swift",
  "bic",
  "transakcij",
  "uplat",
  "isplat",
  "banka",
  "račun",
]

const INVOICE_KEYWORDS = [
  "račun",
  "faktura",
  "invoice",
  "pdv",
  "vat",
  "oib",
  "iznos",
  "ukupno",
  "total",
  "dobavljač",
  "kupac",
  "dospijeće",
]

export function detectDocumentType(
  fileName: string,
  mimeType: string,
  textContent?: string
): DetectionResult {
  const ext = fileName.split(".").pop()?.toLowerCase() || ""
  const nameLower = fileName.toLowerCase()

  // XML files are almost always bank statements (CAMT.053)
  if (ext === "xml") {
    return {
      type: DocumentType.BANK_STATEMENT,
      confidence: 0.95,
      reason: "XML format typically used for CAMT.053 bank statements",
    }
  }

  // CSV files are typically bank exports
  if (ext === "csv") {
    return {
      type: DocumentType.BANK_STATEMENT,
      confidence: 0.85,
      reason: "CSV format typically used for bank transaction exports",
    }
  }

  // Image files are typically invoices/receipts
  if (["jpg", "jpeg", "png", "heic", "webp"].includes(ext)) {
    return {
      type: DocumentType.INVOICE,
      confidence: 0.8,
      reason: "Image format typically used for scanned invoices",
    }
  }

  // For PDFs, check filename and content
  if (ext === "pdf") {
    // Check filename hints
    if (nameLower.includes("izvod") || nameLower.includes("statement")) {
      return {
        type: DocumentType.BANK_STATEMENT,
        confidence: 0.9,
        reason: "Filename suggests bank statement",
      }
    }
    if (
      nameLower.includes("racun") ||
      nameLower.includes("faktura") ||
      nameLower.includes("invoice")
    ) {
      return {
        type: DocumentType.INVOICE,
        confidence: 0.9,
        reason: "Filename suggests invoice",
      }
    }

    // Check text content if available
    if (textContent) {
      const textLower = textContent.toLowerCase()
      const bankScore = BANK_KEYWORDS.filter((k) => textLower.includes(k)).length
      const invoiceScore = INVOICE_KEYWORDS.filter((k) => textLower.includes(k)).length

      if (bankScore > invoiceScore && bankScore >= 3) {
        return {
          type: DocumentType.BANK_STATEMENT,
          confidence: Math.min(0.5 + bankScore * 0.1, 0.9),
          reason: `Found ${bankScore} bank-related keywords`,
        }
      }
      if (invoiceScore > bankScore && invoiceScore >= 2) {
        return {
          type: DocumentType.INVOICE,
          confidence: Math.min(0.5 + invoiceScore * 0.1, 0.9),
          reason: `Found ${invoiceScore} invoice-related keywords`,
        }
      }
    }

    // Default PDF to invoice (more common use case)
    return {
      type: DocumentType.INVOICE,
      confidence: 0.5,
      reason: "PDF defaulting to invoice - please verify",
    }
  }

  // Fallback
  return {
    type: DocumentType.INVOICE,
    confidence: 0.3,
    reason: "Unknown format - defaulting to invoice",
  }
}

export function getMimeTypeFromExtension(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || ""
  const mimeMap: Record<string, string> = {
    pdf: "application/pdf",
    xml: "application/xml",
    csv: "text/csv",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    heic: "image/heic",
    webp: "image/webp",
  }
  return mimeMap[ext] || "application/octet-stream"
}

export const ACCEPTED_FILE_TYPES = {
  "application/pdf": [".pdf"],
  "application/xml": [".xml"],
  "text/xml": [".xml"],
  "text/csv": [".csv"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/heic": [".heic"],
  "image/webp": [".webp"],
}

export const ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".xml",
  ".csv",
  ".jpg",
  ".jpeg",
  ".png",
  ".heic",
  ".webp",
]
```

**Step 2: Commit**

```bash
git add src/lib/import/
git commit -m "feat(import): add document type detection utility"
```

---

## Task 3: Create Smart Dropzone Component

**Files:**

- Create: `src/components/import/smart-dropzone.tsx`

**Step 1: Create dropzone component**

```typescript
'use client'

import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ACCEPTED_FILE_TYPES, ACCEPTED_EXTENSIONS } from '@/lib/import/detect-document-type'

interface SmartDropzoneProps {
  onFilesDropped: (files: File[]) => void
  disabled?: boolean
}

export function SmartDropzone({ onFilesDropped, disabled }: SmartDropzoneProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFilesDropped(acceptedFiles)
    }
  }, [onFilesDropped])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    disabled,
    multiple: true,
  })

  return (
    <div
      {...getRootProps()}
      className={`
        relative rounded-xl border-2 border-dashed p-8 transition-all cursor-pointer
        ${isDragActive
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 bg-gradient-to-br from-slate-50 to-white hover:border-gray-400'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <input {...getInputProps()} />

      <div className="flex flex-col items-center justify-center gap-4 text-center">
        <div className={`
          rounded-full p-4 transition-colors
          ${isDragActive ? 'bg-blue-100' : 'bg-gray-100'}
        `}>
          <UploadCloud className={`h-10 w-10 ${isDragActive ? 'text-blue-600' : 'text-gray-500'}`} />
        </div>

        <div>
          <p className="text-lg font-semibold text-gray-900">
            {isDragActive ? 'Ispustite datoteke ovdje' : 'Povucite dokumente ovdje'}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            PDF, XML, CSV, JPG, PNG
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Bankovni izvodi, računi, troškovi
          </p>
        </div>

        <Button type="button" variant="outline" disabled={disabled}>
          Odaberi datoteke
        </Button>
      </div>
    </div>
  )
}
```

**Step 2: Install react-dropzone if needed**

Run: `npm install react-dropzone`
Expected: Package added

**Step 3: Commit**

```bash
git add src/components/import/ package.json package-lock.json
git commit -m "feat(import): add smart dropzone component"
```

---

## Task 4: Create Processing Card Component

**Files:**

- Create: `src/components/import/processing-card.tsx`

**Step 1: Create processing card component**

```typescript
'use client'

import { FileText, CheckCircle2, AlertCircle, Loader2, X, Eye, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DocumentType, JobStatus } from '@prisma/client'

export interface ImportJobState {
  id: string
  fileName: string
  status: JobStatus
  documentType: DocumentType | null
  progress: number // 0-100
  error: string | null
  transactionCount?: number
  queuePosition?: number
  totalInQueue?: number
}

interface ProcessingCardProps {
  job: ImportJobState
  onView: (jobId: string) => void
  onRetry: (jobId: string) => void
  onRemove: (jobId: string) => void
  isCurrentForReview?: boolean
}

const STATUS_CONFIG: Record<JobStatus, { label: string; color: string; icon: typeof Loader2 }> = {
  PENDING: { label: 'U redu čekanja...', color: 'text-gray-500', icon: Loader2 },
  PROCESSING: { label: 'Obrada...', color: 'text-blue-600', icon: Loader2 },
  READY_FOR_REVIEW: { label: 'Spreman za pregled', color: 'text-amber-600', icon: Eye },
  CONFIRMED: { label: 'Potvrđeno', color: 'text-green-600', icon: CheckCircle2 },
  REJECTED: { label: 'Odbijeno', color: 'text-gray-400', icon: X },
  VERIFIED: { label: 'Verificirano', color: 'text-green-600', icon: CheckCircle2 },
  NEEDS_REVIEW: { label: 'Potreban pregled', color: 'text-amber-600', icon: AlertCircle },
  FAILED: { label: 'Greška', color: 'text-red-600', icon: AlertCircle },
}

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  BANK_STATEMENT: 'Bankovni izvod',
  INVOICE: 'Račun',
  EXPENSE: 'Trošak',
}

export function ProcessingCard({ job, onView, onRetry, onRemove, isCurrentForReview }: ProcessingCardProps) {
  const config = STATUS_CONFIG[job.status]
  const StatusIcon = config.icon
  const isProcessing = job.status === 'PENDING' || job.status === 'PROCESSING'
  const canView = job.status === 'READY_FOR_REVIEW'
  const canRetry = job.status === 'FAILED'
  const isDone = job.status === 'CONFIRMED' || job.status === 'REJECTED'

  return (
    <div className={`
      rounded-lg border p-4 transition-all
      ${isCurrentForReview ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 bg-white'}
      ${isDone ? 'opacity-60' : ''}
    `}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="flex-shrink-0 mt-0.5">
            <FileText className="h-5 w-5 text-gray-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm text-gray-900 truncate" title={job.fileName}>
              {job.fileName}
            </p>
            {job.documentType && (
              <p className="text-xs text-gray-500 mt-0.5">
                {DOC_TYPE_LABELS[job.documentType]}
              </p>
            )}
          </div>
        </div>

        {!isDone && (
          <button
            onClick={() => onRemove(job.id)}
            className="flex-shrink-0 p-1 hover:bg-gray-100 rounded"
            title="Ukloni"
          >
            <X className="h-4 w-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Progress bar */}
      {isProcessing && (
        <div className="mt-3">
          <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${job.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Status */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon className={`h-4 w-4 ${config.color} ${isProcessing ? 'animate-spin' : ''}`} />
          <span className={`text-xs font-medium ${config.color}`}>
            {config.label}
          </span>
        </div>

        {job.queuePosition && job.totalInQueue && job.totalInQueue > 1 && canView && (
          <span className="text-xs text-gray-400">
            {job.queuePosition} od {job.totalInQueue}
          </span>
        )}
      </div>

      {/* Error message */}
      {job.error && (
        <p className="mt-2 text-xs text-red-600 line-clamp-2">
          {job.error}
        </p>
      )}

      {/* Transaction count for confirmed */}
      {job.status === 'CONFIRMED' && job.transactionCount !== undefined && (
        <p className="mt-2 text-xs text-green-600">
          {job.transactionCount} transakcija uvezeno
        </p>
      )}

      {/* Actions */}
      <div className="mt-3 flex gap-2">
        {canView && (
          <Button
            size="sm"
            onClick={() => onView(job.id)}
            className="flex-1"
          >
            <Eye className="h-4 w-4 mr-1" />
            Pregledaj
          </Button>
        )}
        {canRetry && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRetry(job.id)}
            className="flex-1"
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Pokušaj ponovo
          </Button>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/import/
git commit -m "feat(import): add processing card component"
```

---

## Task 5: Create Processing Queue Component

**Files:**

- Create: `src/components/import/processing-queue.tsx`

**Step 1: Create queue component**

```typescript
'use client'

import { ProcessingCard, ImportJobState } from './processing-card'

interface ProcessingQueueProps {
  jobs: ImportJobState[]
  onView: (jobId: string) => void
  onRetry: (jobId: string) => void
  onRemove: (jobId: string) => void
}

export function ProcessingQueue({ jobs, onView, onRetry, onRemove }: ProcessingQueueProps) {
  if (jobs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center">
        <p className="text-sm text-gray-500">
          Nema dokumenata u redu čekanja
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Povucite datoteke u dropzonu za početak
        </p>
      </div>
    )
  }

  // Calculate queue positions for ready-for-review items
  const readyJobs = jobs.filter(j => j.status === 'READY_FOR_REVIEW')
  const firstReadyId = readyJobs[0]?.id

  const jobsWithPosition = jobs.map(job => {
    if (job.status === 'READY_FOR_REVIEW') {
      const position = readyJobs.findIndex(j => j.id === job.id) + 1
      return {
        ...job,
        queuePosition: position,
        totalInQueue: readyJobs.length,
      }
    }
    return job
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          Red čekanja
        </h3>
        <span className="text-xs text-gray-500">
          {jobs.length} {jobs.length === 1 ? 'datoteka' : 'datoteka'}
        </span>
      </div>

      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {jobsWithPosition.map(job => (
          <ProcessingCard
            key={job.id}
            job={job}
            onView={onView}
            onRetry={onRetry}
            onRemove={onRemove}
            isCurrentForReview={job.id === firstReadyId}
          />
        ))}
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/import/
git commit -m "feat(import): add processing queue component"
```

---

## Task 6: Create PDF Viewer Component

**Files:**

- Create: `src/components/import/pdf-viewer.tsx`

**Step 1: Install react-pdf**

Run: `npm install react-pdf`
Expected: Package added

**Step 2: Create PDF viewer component**

```typescript
'use client'

import { useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface PdfViewerProps {
  url: string
  className?: string
}

export function PdfViewer({ url, className }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages)
    setLoading(false)
  }

  function onDocumentLoadError(err: Error) {
    setError(err.message)
    setLoading(false)
  }

  const goToPrev = () => setPageNumber(p => Math.max(1, p - 1))
  const goToNext = () => setPageNumber(p => Math.min(numPages, p + 1))
  const zoomIn = () => setScale(s => Math.min(2.5, s + 0.25))
  const zoomOut = () => setScale(s => Math.max(0.5, s - 0.25))

  return (
    <div className={`flex flex-col h-full bg-gray-100 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToPrev}
            disabled={pageNumber <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-600">
            {pageNumber} / {numPages || '?'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={goToNext}
            disabled={pageNumber >= numPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={zoomOut} disabled={scale <= 0.5}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-gray-500 w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button variant="ghost" size="sm" onClick={zoomIn} disabled={scale >= 2.5}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF content */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-4">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full">
            <p className="text-red-500">Greška: {error}</p>
          </div>
        )}

        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading=""
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            className="shadow-lg"
            loading=""
          />
        </Document>
      </div>
    </div>
  )
}

interface ImageViewerProps {
  url: string
  className?: string
}

export function ImageViewer({ url, className }: ImageViewerProps) {
  const [scale, setScale] = useState(1.0)

  const zoomIn = () => setScale(s => Math.min(3, s + 0.25))
  const zoomOut = () => setScale(s => Math.max(0.25, s - 0.25))

  return (
    <div className={`flex flex-col h-full bg-gray-100 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-end px-4 py-2 bg-white border-b">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={zoomOut} disabled={scale <= 0.25}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-gray-500 w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button variant="ghost" size="sm" onClick={zoomIn} disabled={scale >= 3}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Image content */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-4">
        <img
          src={url}
          alt="Document preview"
          className="shadow-lg transition-transform"
          style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
        />
      </div>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/components/import/ package.json package-lock.json
git commit -m "feat(import): add PDF and image viewer components"
```

---

## Task 7: Create Transaction Editor Component

**Files:**

- Create: `src/components/import/transaction-editor.tsx`

**Step 1: Create transaction editor component**

```typescript
'use client'

import { useState } from 'react'
import { CheckCircle2, AlertTriangle, Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface ExtractedTransaction {
  id: string
  date: string
  description: string
  amount: number
  direction: 'INCOMING' | 'OUTGOING'
  counterpartyName?: string | null
  counterpartyIban?: string | null
  reference?: string | null
}

interface TransactionEditorProps {
  transactions: ExtractedTransaction[]
  openingBalance?: number
  closingBalance?: number
  mathValid: boolean
  onChange: (transactions: ExtractedTransaction[]) => void
}

export function TransactionEditor({
  transactions,
  openingBalance,
  closingBalance,
  mathValid,
  onChange,
}: TransactionEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<ExtractedTransaction>>({})

  const startEdit = (txn: ExtractedTransaction) => {
    setEditingId(txn.id)
    setEditValues({
      date: txn.date,
      description: txn.description,
      amount: txn.amount,
      counterpartyName: txn.counterpartyName,
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValues({})
  }

  const saveEdit = () => {
    if (!editingId) return
    const updated = transactions.map(t =>
      t.id === editingId ? { ...t, ...editValues } : t
    )
    onChange(updated)
    setEditingId(null)
    setEditValues({})
  }

  const totalIncoming = transactions
    .filter(t => t.direction === 'INCOMING')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalOutgoing = transactions
    .filter(t => t.direction === 'OUTGOING')
    .reduce((sum, t) => sum + t.amount, 0)

  const formatAmount = (amount: number, direction: 'INCOMING' | 'OUTGOING') => {
    const sign = direction === 'INCOMING' ? '+' : '-'
    return `${sign}${amount.toLocaleString('hr-HR', { minimumFractionDigits: 2 })}`
  }

  return (
    <div className="flex flex-col h-full">
      {/* Summary header */}
      <div className="px-4 py-3 border-b bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700">
            {transactions.length} transakcija
          </span>
          <div className="flex items-center gap-2">
            {mathValid ? (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Matematički točno
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                Odstupanje u saldu
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-gray-500">Početno stanje:</span>
            <span className="ml-2 font-mono">
              {openingBalance?.toLocaleString('hr-HR', { minimumFractionDigits: 2 }) ?? '-'}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Završno stanje:</span>
            <span className="ml-2 font-mono">
              {closingBalance?.toLocaleString('hr-HR', { minimumFractionDigits: 2 }) ?? '-'}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Ukupno primljeno:</span>
            <span className="ml-2 font-mono text-green-600">
              +{totalIncoming.toLocaleString('hr-HR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Ukupno plaćeno:</span>
            <span className="ml-2 font-mono text-red-600">
              -{totalOutgoing.toLocaleString('hr-HR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Transaction list */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Datum</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Opis</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Protustrana</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Iznos</th>
              <th className="px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {transactions.map(txn => (
              <tr key={txn.id} className="hover:bg-gray-50">
                {editingId === txn.id ? (
                  <>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={editValues.date || ''}
                        onChange={e => setEditValues(v => ({ ...v, date: e.target.value }))}
                        className="w-full text-xs border rounded px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={editValues.description || ''}
                        onChange={e => setEditValues(v => ({ ...v, description: e.target.value }))}
                        className="w-full text-xs border rounded px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={editValues.counterpartyName || ''}
                        onChange={e => setEditValues(v => ({ ...v, counterpartyName: e.target.value }))}
                        className="w-full text-xs border rounded px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        value={editValues.amount || 0}
                        onChange={e => setEditValues(v => ({ ...v, amount: parseFloat(e.target.value) || 0 }))}
                        className="w-full text-xs border rounded px-2 py-1 text-right"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <button onClick={saveEdit} className="p-1 hover:bg-green-100 rounded">
                          <Check className="h-4 w-4 text-green-600" />
                        </button>
                        <button onClick={cancelEdit} className="p-1 hover:bg-red-100 rounded">
                          <X className="h-4 w-4 text-red-600" />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {new Date(txn.date).toLocaleDateString('hr-HR')}
                    </td>
                    <td className="px-3 py-2 text-xs max-w-[200px] truncate" title={txn.description}>
                      {txn.description}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600 max-w-[150px] truncate">
                      {txn.counterpartyName || '-'}
                    </td>
                    <td className={`px-3 py-2 text-xs text-right font-mono ${
                      txn.direction === 'INCOMING' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatAmount(txn.amount, txn.direction)}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => startEdit(txn)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <Pencil className="h-4 w-4 text-gray-400" />
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/import/
git commit -m "feat(import): add transaction editor component"
```

---

## Task 8: Create Confirmation Modal Component

**Files:**

- Create: `src/components/import/confirmation-modal.tsx`

**Step 1: Create confirmation modal**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PdfViewer, ImageViewer } from './pdf-viewer'
import { TransactionEditor, ExtractedTransaction } from './transaction-editor'
import { DocumentType } from '@prisma/client'

interface ExtractedData {
  transactions: ExtractedTransaction[]
  openingBalance?: number
  closingBalance?: number
  mathValid: boolean
}

interface ConfirmationModalProps {
  isOpen: boolean
  jobId: string
  fileName: string
  fileUrl: string
  fileType: 'pdf' | 'image'
  documentType: DocumentType
  extractedData: ExtractedData
  bankAccounts: { id: string; name: string; iban: string }[]
  selectedAccountId: string | null
  onAccountChange: (accountId: string) => void
  onConfirm: (jobId: string, data: ExtractedData) => void
  onReject: (jobId: string) => void
  onClose: () => void
}

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  BANK_STATEMENT: 'Bankovni izvod',
  INVOICE: 'Račun',
  EXPENSE: 'Trošak',
}

export function ConfirmationModal({
  isOpen,
  jobId,
  fileName,
  fileUrl,
  fileType,
  documentType,
  extractedData,
  bankAccounts,
  selectedAccountId,
  onAccountChange,
  onConfirm,
  onReject,
  onClose,
}: ConfirmationModalProps) {
  const [editedData, setEditedData] = useState<ExtractedData>(extractedData)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    setEditedData(extractedData)
  }, [extractedData])

  if (!isOpen) return null

  const handleConfirm = async () => {
    setConfirming(true)
    try {
      await onConfirm(jobId, editedData)
    } finally {
      setConfirming(false)
    }
  }

  const handleTransactionsChange = (transactions: ExtractedTransaction[]) => {
    setEditedData(prev => ({ ...prev, transactions }))
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white w-full h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
              <X className="h-5 w-5" />
            </button>
            <div>
              <h2 className="font-semibold text-lg">{fileName}</h2>
              <p className="text-sm text-gray-500">{DOC_TYPE_LABELS[documentType]}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => onReject(jobId)}>
              Odbaci
            </Button>
            <Button onClick={handleConfirm} disabled={confirming}>
              {confirming ? 'Potvrđujem...' : 'Potvrdi uvoz'}
            </Button>
          </div>
        </div>

        {/* Context bar */}
        {documentType === 'BANK_STATEMENT' && (
          <div className="px-6 py-3 bg-gray-50 border-b flex items-center gap-4">
            <label className="text-sm text-gray-600">Bankovni račun:</label>
            <select
              value={selectedAccountId || ''}
              onChange={e => onAccountChange(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="">Odaberi račun...</option>
              {bankAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.iban})
                </option>
              ))}
            </select>

            {!editedData.mathValid && (
              <div className="flex items-center gap-2 ml-auto text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">Matematičko odstupanje - provjerite podatke</span>
              </div>
            )}
          </div>
        )}

        {/* Main content - side by side */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: PDF/Image viewer */}
          <div className="w-1/2 border-r">
            {fileType === 'pdf' ? (
              <PdfViewer url={fileUrl} className="h-full" />
            ) : (
              <ImageViewer url={fileUrl} className="h-full" />
            )}
          </div>

          {/* Right: Editor */}
          <div className="w-1/2 flex flex-col">
            {documentType === 'BANK_STATEMENT' ? (
              <TransactionEditor
                transactions={editedData.transactions}
                openingBalance={editedData.openingBalance}
                closingBalance={editedData.closingBalance}
                mathValid={editedData.mathValid}
                onChange={handleTransactionsChange}
              />
            ) : (
              <div className="p-6">
                <p className="text-gray-500">Invoice editor - coming soon</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/import/
git commit -m "feat(import): add confirmation modal component"
```

---

## Task 9: Create Import API Routes

**Files:**

- Create: `src/app/api/import/upload/route.ts`
- Create: `src/app/api/import/jobs/[id]/route.ts`
- Create: `src/app/api/import/jobs/[id]/confirm/route.ts`
- Create: `src/app/api/import/jobs/[id]/reject/route.ts`
- Create: `src/app/api/import/jobs/[id]/file/route.ts`

**Step 1: Create upload route**

Create `src/app/api/import/upload/route.ts`:

```typescript
import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { createHash } from "crypto"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import { detectDocumentType } from "@/lib/import/detect-document-type"

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024
const ALLOWED_EXTENSIONS = ["pdf", "xml", "csv", "jpg", "jpeg", "png", "heic", "webp"]

export async function POST(request: Request) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  const formData = await request.formData()
  const file = formData.get("file")
  const bankAccountId = formData.get("bankAccountId") as string | null
  const documentTypeOverride = formData.get("documentType") as string | null

  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 })
  }

  const fileName = (file as File).name || "upload"
  const extension = fileName.split(".").pop()?.toLowerCase() || ""

  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return NextResponse.json(
      {
        error: `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
      },
      { status: 400 }
    )
  }

  const arrayBuffer = await file.arrayBuffer()
  if (arrayBuffer.byteLength === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 })
  }
  if (arrayBuffer.byteLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File too large (max 20MB)" }, { status: 413 })
  }

  const buffer = Buffer.from(arrayBuffer)
  const checksum = createHash("sha256").update(buffer).digest("hex")

  // Store file
  const storageDir = path.join(process.cwd(), "uploads", "imports")
  await fs.mkdir(storageDir, { recursive: true })
  const storedFileName = `${checksum}.${extension}`
  const storagePath = path.join(storageDir, storedFileName)
  await fs.writeFile(storagePath, buffer)

  // Detect document type
  const detection = detectDocumentType(fileName, file.type)
  const documentType = documentTypeOverride || detection.type

  // Create import job
  const job = await db.importJob.create({
    data: {
      companyId: company.id,
      userId: user.id!,
      bankAccountId: bankAccountId || null,
      fileChecksum: checksum,
      originalName: fileName,
      storagePath,
      status: "PENDING",
      documentType: documentType as any,
    },
  })

  // Trigger background processing
  fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"}/api/import/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId: job.id }),
  }).catch(() => {})

  return NextResponse.json({
    success: true,
    jobId: job.id,
    status: job.status,
    documentType,
    detectionConfidence: detection.confidence,
  })
}
```

**Step 2: Create job status route**

Create `src/app/api/import/jobs/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const { id } = await params

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  const job = await db.importJob.findUnique({
    where: { id },
    include: {
      bankAccount: {
        select: { id: true, name: true, iban: true },
      },
    },
  })

  if (!job || job.companyId !== company.id) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    job: {
      id: job.id,
      status: job.status,
      documentType: job.documentType,
      fileName: job.originalName,
      extractedData: job.extractedData,
      bankAccount: job.bankAccount,
      failureReason: job.failureReason,
      pagesProcessed: job.pagesProcessed,
      tierUsed: job.tierUsed,
      createdAt: job.createdAt,
    },
  })
}
```

**Step 3: Create confirm route**

Create `src/app/api/import/jobs/[id]/confirm/route.ts`:

```typescript
import { NextResponse } from "next/server"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import { Prisma } from "@prisma/client"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const { id } = await params
  const body = await request.json()

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  const job = await db.importJob.findUnique({ where: { id } })

  if (!job || job.companyId !== company.id) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }

  if (job.status !== "READY_FOR_REVIEW") {
    return NextResponse.json({ error: "Job not ready for confirmation" }, { status: 400 })
  }

  const { transactions, bankAccountId } = body

  if (job.documentType === "BANK_STATEMENT") {
    if (!bankAccountId) {
      return NextResponse.json({ error: "Bank account required" }, { status: 400 })
    }

    // Write transactions to database
    if (transactions && transactions.length > 0) {
      await db.bankTransaction.createMany({
        data: transactions.map((t: any) => ({
          companyId: company.id,
          bankAccountId,
          date: new Date(t.date),
          description: t.description || "",
          amount: new Prisma.Decimal(Math.abs(t.amount)),
          balance: new Prisma.Decimal(0),
          reference: t.reference || null,
          counterpartyName: t.counterpartyName || null,
          counterpartyIban: t.counterpartyIban || null,
          matchStatus: "UNMATCHED",
          confidenceScore: 0,
        })),
      })
    }
  }

  // Update job status
  await db.importJob.update({
    where: { id },
    data: {
      status: "CONFIRMED",
      bankAccountId,
    },
  })

  return NextResponse.json({
    success: true,
    transactionCount: transactions?.length || 0,
  })
}
```

**Step 4: Create reject route**

Create `src/app/api/import/jobs/[id]/reject/route.ts`:

```typescript
import { NextResponse } from "next/server"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const { id } = await params

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  const job = await db.importJob.findUnique({ where: { id } })

  if (!job || job.companyId !== company.id) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }

  await db.importJob.update({
    where: { id },
    data: { status: "REJECTED" },
  })

  return NextResponse.json({ success: true })
}
```

**Step 5: Create file serving route**

Create `src/app/api/import/jobs/[id]/file/route.ts`:

```typescript
import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const { id } = await params

  const job = await db.importJob.findUnique({ where: { id } })

  if (!job || job.companyId !== company.id) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }

  try {
    const fileBuffer = await fs.readFile(job.storagePath)
    const ext = job.originalName.split(".").pop()?.toLowerCase() || ""

    const mimeTypes: Record<string, string> = {
      pdf: "application/pdf",
      xml: "application/xml",
      csv: "text/csv",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      heic: "image/heic",
      webp: "image/webp",
    }

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": mimeTypes[ext] || "application/octet-stream",
        "Content-Disposition": `inline; filename="${job.originalName}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }
}
```

**Step 6: Commit**

```bash
git add src/app/api/import/
git commit -m "feat(api): add import API routes for upload, confirm, reject, file serving"
```

---

## Task 10: Update Process Route for New Flow

**Files:**

- Modify: `src/app/api/import/process/route.ts` (or create if needed at new location)

**Step 1: Create/update process route**

Create `src/app/api/import/process/route.ts`:

```typescript
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { JobStatus } from "@prisma/client"
import { promises as fs } from "fs"
import { XMLParser } from "fast-xml-parser"
import { deepseekJson } from "@/lib/ai/deepseek"
import { BANK_STATEMENT_SYSTEM_PROMPT } from "@/lib/banking/import/prompt"

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const targetJobId = body.jobId

  // Get next pending job or specific job
  const job = targetJobId
    ? await db.importJob.findUnique({ where: { id: targetJobId } })
    : await db.importJob.findFirst({ where: { status: JobStatus.PENDING } })

  if (!job) {
    return NextResponse.json({ status: "idle", message: "No pending jobs" })
  }

  if (job.status !== "PENDING") {
    return NextResponse.json({ status: "skip", message: "Job already processed" })
  }

  // Mark as processing
  await db.importJob.update({
    where: { id: job.id },
    data: { status: JobStatus.PROCESSING },
  })

  try {
    const extension = job.originalName.split(".").pop()?.toLowerCase() || ""
    let extractedData: any = null

    if (extension === "xml") {
      extractedData = await processXml(job.storagePath)
    } else if (extension === "csv") {
      extractedData = await processCsv(job.storagePath)
    } else if (["pdf", "jpg", "jpeg", "png", "heic", "webp"].includes(extension)) {
      extractedData = await processPdfOrImage(job.storagePath, extension)
    }

    // Store extracted data and mark ready for review
    await db.importJob.update({
      where: { id: job.id },
      data: {
        status: "READY_FOR_REVIEW" as any,
        extractedData,
        pagesProcessed: 1,
      },
    })

    return NextResponse.json({ status: "ok", jobId: job.id })
  } catch (error) {
    console.error("[process] error", error)
    await db.importJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.FAILED,
        failureReason: error instanceof Error ? error.message : "Unknown error",
      },
    })
    return NextResponse.json({ status: "error", jobId: job.id })
  }
}

async function processXml(filePath: string) {
  const xmlBuffer = await fs.readFile(filePath, "utf-8")
  const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: true })
  const parsed = parser.parse(xmlBuffer)

  const stmt =
    parsed?.Document?.BkToCstmrStmt?.Stmt?.[0] ||
    parsed?.Document?.BkToCstmrStmt?.Stmt ||
    parsed?.Document?.BkToCstmrAcctRpt?.Rpt?.[0] ||
    parsed?.Document?.BkToCstmrAcctRpt?.Rpt

  if (!stmt) throw new Error("CAMT XML does not contain a statement")

  const balances = Array.isArray(stmt.Bal) ? stmt.Bal : stmt.Bal ? [stmt.Bal] : []
  const openingBal = extractAmount(balances.find((b: any) => b?.Tp?.CdOrPrtry?.Cd === "OPBD")?.Amt)
  const closingBal = extractAmount(balances.find((b: any) => b?.Tp?.CdOrPrtry?.Cd === "CLBD")?.Amt)

  const entries = Array.isArray(stmt.Ntry) ? stmt.Ntry : stmt.Ntry ? [stmt.Ntry] : []

  const transactions = entries.map((entry: any, idx: number) => {
    const amount = extractAmount(entry?.Amt)
    const direction = entry?.CdtDbtInd === "CRDT" ? "INCOMING" : "OUTGOING"
    const dateStr = entry?.BookgDt?.Dt || entry?.ValDt?.Dt || new Date().toISOString()
    const details = Array.isArray(entry?.NtryDtls?.TxDtls)
      ? entry.NtryDtls.TxDtls[0]
      : entry?.NtryDtls?.TxDtls

    return {
      id: `txn-${idx}`,
      date: dateStr,
      description: entry?.AddtlNtryInf || details?.RmtInf?.Ustrd || "",
      amount,
      direction,
      counterpartyName: details?.RltdPties?.Cdtr?.Nm || details?.RltdPties?.Dbtr?.Nm || null,
      counterpartyIban:
        details?.RltdPties?.CdtrAcct?.Id?.IBAN || details?.RltdPties?.DbtrAcct?.Id?.IBAN || null,
      reference: entry?.NtryRef || details?.Refs?.EndToEndId || null,
    }
  })

  const calcClosing =
    openingBal +
    transactions.reduce(
      (sum: number, t: any) => sum + (t.direction === "INCOMING" ? t.amount : -t.amount),
      0
    )
  const mathValid = Math.abs(calcClosing - closingBal) < 0.01

  return { transactions, openingBalance: openingBal, closingBalance: closingBal, mathValid }
}

async function processCsv(filePath: string) {
  const csvText = await fs.readFile(filePath, "utf-8")
  const lines = csvText.trim().split("\n")
  if (lines.length < 2) throw new Error("CSV file is empty")

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase())
  const dateIdx = header.findIndex((h) => ["datum", "date"].includes(h))
  const descIdx = header.findIndex((h) => ["opis", "description"].includes(h))
  const amountIdx = header.findIndex((h) => ["iznos", "amount"].includes(h))

  if (dateIdx === -1 || descIdx === -1 || amountIdx === -1) {
    throw new Error("CSV must have date, description, amount columns")
  }

  const transactions = lines
    .slice(1)
    .map((line, idx) => {
      const values = line.split(",").map((v) => v.trim())
      const amount = parseFloat(values[amountIdx].replace(",", ".")) || 0
      return {
        id: `txn-${idx}`,
        date: values[dateIdx],
        description: values[descIdx],
        amount: Math.abs(amount),
        direction: amount >= 0 ? "INCOMING" : "OUTGOING",
        counterpartyName: null,
        counterpartyIban: null,
        reference: null,
      }
    })
    .filter((t) => t.date && t.description)

  return { transactions, openingBalance: null, closingBalance: null, mathValid: true }
}

async function processPdfOrImage(filePath: string, ext: string) {
  // For PDFs, extract text first
  let textContent = ""
  if (ext === "pdf") {
    try {
      const pdfParse = (await import("pdf-parse")).default
      const buffer = await fs.readFile(filePath)
      const data = await pdfParse(buffer)
      textContent = data.text
    } catch {
      textContent = ""
    }
  }

  // Use AI to extract transactions
  const response = await deepseekJson({
    model: "deepseek-chat",
    messages: [
      { role: "system", content: BANK_STATEMENT_SYSTEM_PROMPT },
      { role: "user", content: textContent || "Extract transactions from this bank statement." },
    ],
  })

  const parsed = JSON.parse(response)
  const transactions = (parsed.transactions || []).map((t: any, idx: number) => ({
    id: `txn-${idx}`,
    date: t.date || new Date().toISOString().split("T")[0],
    description: t.description || "",
    amount: Math.abs(Number(t.amount) || 0),
    direction: t.direction === "INCOMING" ? "INCOMING" : "OUTGOING",
    counterpartyName: t.payee || null,
    counterpartyIban: t.counterpartyIban || null,
    reference: t.reference || null,
  }))

  return {
    transactions,
    openingBalance: parsed.pageStartBalance || null,
    closingBalance: parsed.pageEndBalance || null,
    mathValid: false, // Will be recalculated
  }
}

function extractAmount(amt: any): number {
  if (!amt) return 0
  if (typeof amt === "number") return amt
  if (typeof amt === "string") return parseFloat(amt) || 0
  if (typeof amt === "object") {
    const text = amt["#text"] ?? amt["_text"] ?? amt["$t"]
    if (text) return parseFloat(String(text)) || 0
  }
  return 0
}
```

**Step 2: Commit**

```bash
git add src/app/api/import/
git commit -m "feat(api): add process route with XML, CSV, PDF/image handling"
```

---

## Task 11: Create Import Page

**Files:**

- Create: `src/app/(dashboard)/import/page.tsx`

**Step 1: Create the import page**

```typescript
import { requireAuth, requireCompany } from '@/lib/auth-utils'
import { db } from '@/lib/db'
import { setTenantContext } from '@/lib/prisma-extensions'
import { ImportClient } from './import-client'

export default async function ImportPage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  // Get bank accounts for the selector
  const bankAccounts = await db.bankAccount.findMany({
    where: { companyId: company.id },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      iban: true,
    },
  })

  // Get any pending/in-progress jobs to restore queue state
  const pendingJobs = await db.importJob.findMany({
    where: {
      companyId: company.id,
      status: { in: ['PENDING', 'PROCESSING', 'READY_FOR_REVIEW'] },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      originalName: true,
      status: true,
      documentType: true,
      extractedData: true,
      failureReason: true,
      pagesProcessed: true,
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Uvoz dokumenata</h1>
        <p className="text-gray-500">Uvezite bankovne izvode, račune i druge dokumente</p>
      </div>

      <ImportClient
        bankAccounts={bankAccounts}
        initialJobs={pendingJobs.map(j => ({
          id: j.id,
          fileName: j.originalName,
          status: j.status as any,
          documentType: j.documentType,
          progress: j.status === 'READY_FOR_REVIEW' ? 100 : j.status === 'PROCESSING' ? 50 : 0,
          error: j.failureReason,
          extractedData: j.extractedData as any,
        }))}
      />
    </div>
  )
}
```

**Step 2: Create import client component**

Create `src/app/(dashboard)/import/import-client.tsx`:

```typescript
'use client'

import { useState, useCallback, useEffect } from 'react'
import { SmartDropzone } from '@/components/import/smart-dropzone'
import { ProcessingQueue } from '@/components/import/processing-queue'
import { ConfirmationModal } from '@/components/import/confirmation-modal'
import { ImportJobState } from '@/components/import/processing-card'
import { DocumentType, JobStatus } from '@prisma/client'

interface BankAccount {
  id: string
  name: string
  iban: string
}

interface ImportClientProps {
  bankAccounts: BankAccount[]
  initialJobs: ImportJobState[]
}

export function ImportClient({ bankAccounts, initialJobs }: ImportClientProps) {
  const [jobs, setJobs] = useState<ImportJobState[]>(initialJobs)
  const [selectedAccountId, setSelectedAccountId] = useState<string>(bankAccounts[0]?.id || '')
  const [modalJob, setModalJob] = useState<ImportJobState | null>(null)
  const [modalData, setModalData] = useState<any>(null)

  // Poll for job status updates
  useEffect(() => {
    const pendingIds = jobs
      .filter(j => j.status === 'PENDING' || j.status === 'PROCESSING')
      .map(j => j.id)

    if (pendingIds.length === 0) return

    const interval = setInterval(async () => {
      for (const id of pendingIds) {
        try {
          const res = await fetch(`/api/import/jobs/${id}`)
          const data = await res.json()
          if (data.success && data.job) {
            setJobs(prev => prev.map(j =>
              j.id === id ? {
                ...j,
                status: data.job.status,
                documentType: data.job.documentType,
                progress: data.job.status === 'READY_FOR_REVIEW' ? 100 :
                         data.job.status === 'PROCESSING' ? 50 : j.progress,
                error: data.job.failureReason,
              } : j
            ))
          }
        } catch (e) {
          console.error('Poll failed', e)
        }
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [jobs])

  const handleFilesDropped = useCallback(async (files: File[]) => {
    for (const file of files) {
      const tempId = `temp-${Date.now()}-${Math.random()}`

      // Add to queue immediately with uploading state
      setJobs(prev => [...prev, {
        id: tempId,
        fileName: file.name,
        status: 'PENDING' as JobStatus,
        documentType: null,
        progress: 0,
        error: null,
      }])

      // Upload file
      const formData = new FormData()
      formData.append('file', file)
      if (selectedAccountId) {
        formData.append('bankAccountId', selectedAccountId)
      }

      try {
        const res = await fetch('/api/import/upload', {
          method: 'POST',
          body: formData,
        })
        const data = await res.json()

        if (data.success) {
          // Replace temp job with real job
          setJobs(prev => prev.map(j =>
            j.id === tempId ? {
              ...j,
              id: data.jobId,
              status: 'PROCESSING' as JobStatus,
              documentType: data.documentType,
              progress: 25,
            } : j
          ))
        } else {
          setJobs(prev => prev.map(j =>
            j.id === tempId ? {
              ...j,
              status: 'FAILED' as JobStatus,
              error: data.error,
            } : j
          ))
        }
      } catch (e) {
        setJobs(prev => prev.map(j =>
          j.id === tempId ? {
            ...j,
            status: 'FAILED' as JobStatus,
            error: 'Upload failed',
          } : j
        ))
      }
    }
  }, [selectedAccountId])

  const handleView = useCallback(async (jobId: string) => {
    const res = await fetch(`/api/import/jobs/${jobId}`)
    const data = await res.json()

    if (data.success) {
      const job = jobs.find(j => j.id === jobId)
      if (job) {
        setModalJob({ ...job, ...data.job })
        setModalData(data.job.extractedData)
      }
    }
  }, [jobs])

  const handleConfirm = useCallback(async (jobId: string, editedData: any) => {
    const res = await fetch(`/api/import/jobs/${jobId}/confirm`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transactions: editedData.transactions,
        bankAccountId: selectedAccountId,
      }),
    })

    const data = await res.json()
    if (data.success) {
      setJobs(prev => prev.map(j =>
        j.id === jobId ? {
          ...j,
          status: 'CONFIRMED' as JobStatus,
          transactionCount: data.transactionCount,
        } : j
      ))
      setModalJob(null)
      setModalData(null)
    }
  }, [selectedAccountId])

  const handleReject = useCallback(async (jobId: string) => {
    await fetch(`/api/import/jobs/${jobId}/reject`, { method: 'PUT' })
    setJobs(prev => prev.map(j =>
      j.id === jobId ? { ...j, status: 'REJECTED' as JobStatus } : j
    ))
    setModalJob(null)
    setModalData(null)
  }, [])

  const handleRetry = useCallback(async (jobId: string) => {
    // Reset job to pending and trigger reprocess
    setJobs(prev => prev.map(j =>
      j.id === jobId ? { ...j, status: 'PENDING' as JobStatus, error: null, progress: 0 } : j
    ))

    await fetch('/api/import/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    })
  }, [])

  const handleRemove = useCallback((jobId: string) => {
    setJobs(prev => prev.filter(j => j.id !== jobId))
  }, [])

  const getFileType = (fileName: string): 'pdf' | 'image' => {
    const ext = fileName.split('.').pop()?.toLowerCase() || ''
    return ['jpg', 'jpeg', 'png', 'heic', 'webp'].includes(ext) ? 'image' : 'pdf'
  }

  return (
    <>
      {/* Bank account selector */}
      <div className="flex items-center gap-4 p-4 bg-slate-900 rounded-xl text-white">
        <div>
          <p className="text-sm text-slate-300">Bankovni račun za izvode:</p>
        </div>
        <select
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
          className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
        >
          {bankAccounts.map(acc => (
            <option key={acc.id} value={acc.id}>
              {acc.name} ({acc.iban})
            </option>
          ))}
        </select>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SmartDropzone onFilesDropped={handleFilesDropped} />
        <ProcessingQueue
          jobs={jobs}
          onView={handleView}
          onRetry={handleRetry}
          onRemove={handleRemove}
        />
      </div>

      {/* Confirmation modal */}
      {modalJob && modalData && (
        <ConfirmationModal
          isOpen={true}
          jobId={modalJob.id}
          fileName={modalJob.fileName}
          fileUrl={`/api/import/jobs/${modalJob.id}/file`}
          fileType={getFileType(modalJob.fileName)}
          documentType={modalJob.documentType || DocumentType.BANK_STATEMENT}
          extractedData={modalData}
          bankAccounts={bankAccounts}
          selectedAccountId={selectedAccountId}
          onAccountChange={setSelectedAccountId}
          onConfirm={handleConfirm}
          onReject={handleReject}
          onClose={() => { setModalJob(null); setModalData(null); }}
        />
      )}
    </>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/(dashboard)/import/
git commit -m "feat(import): add universal import page with client component"
```

---

## Task 12: Update Navigation

**Files:**

- Modify: `src/lib/navigation.ts`

**Step 1: Add import page to navigation**

Add to the "Financije" section after "Dokumenti":

```typescript
{
  name: "Uvoz",
  href: "/import",
  icon: UploadCloud,
  module: "invoicing",
},
```

Import `UploadCloud` from lucide-react at the top.

**Step 2: Commit**

```bash
git add src/lib/navigation.ts
git commit -m "feat(nav): add import page to navigation"
```

---

## Task 13: Run Build and Test

**Step 1: Run Prisma generate**

Run: `npx prisma generate`
Expected: Success

**Step 2: Run build**

Run: `npm run build`
Expected: Build completes without errors

**Step 3: Start dev server and test manually**

Run: `npm run dev -- -p 3001`
Test: Navigate to `/import`, drop a file, verify processing and confirmation flow

**Step 4: Final commit**

```bash
git add .
git commit -m "feat(import): complete universal document import implementation"
```

---

## Summary

This plan implements a universal document import system with:

- Smart dropzone accepting PDF, XML, CSV, and images
- Multi-file parallel processing with queue display
- Auto-detection of document type with override
- Full-screen confirmation modal with side-by-side PDF preview
- Editable transaction table before DB write
- Clean API with upload, process, confirm, reject endpoints
