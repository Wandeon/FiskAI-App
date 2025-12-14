# Universal Document Import Hub

**Date:** 2024-12-14
**Status:** Approved

## Overview

A unified, user-friendly document import system that handles bank statements (PDF, XML, CSV) and invoices (PDF, JPG, PNG) with a smart dropzone, parallel processing, and confirmation workflow before data is written to the database.

## Key Requirements

1. **Single smart dropzone** accepting PDF, XML, CSV, JPG, PNG, HEIC
2. **Multiple files at once** - drop many files, they queue up
3. **Processing cards on the side** showing real-time status per file
4. **Auto-detect document type** with manual override
5. **Parallel processing, sequential confirmation**
6. **Full-screen confirmation modal** with side-by-side PDF preview + editable data
7. **No DB write until user confirms** - extracted data stored as JSON in ImportJob

## Supported Document Types

| Document Type | Accepted Formats | Extraction Method |
|---------------|------------------|-------------------|
| Bank Statement | PDF, XML (CAMT.053), CSV | XML parser / AI text extraction |
| Invoice | PDF, JPG, PNG, HEIC | AI vision extraction |

## Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Header: "Uvoz dokumenata"                                  │
├─────────────────────────────────────────────────────────────┤
│  Document Type: [Auto-detect ▼]  Bank Account: [Erste ▼]   │
├──────────────────────────────────┬──────────────────────────┤
│                                  │                          │
│   Smart Dropzone                 │   Processing Queue       │
│   (PDF, XML, CSV, JPG, PNG)      │   (file cards stacked)   │
│                                  │                          │
└──────────────────────────────────┴──────────────────────────┘
```

Mobile: Queue stacks below dropzone.

## Processing Card States

1. **Uploading** - progress bar, "Učitavanje..."
2. **Detecting** - "Prepoznavanje vrste dokumenta..."
3. **Processing** - "Ekstrakcija podataka..." (shows tier)
4. **Ready** - "Spreman za pregled" + [Pregledaj] button
5. **Confirmed** - green checkmark, "Potvrđeno (12 transakcija)"
6. **Error** - red, error message + [Retry] button

## Confirmation Modal

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ✕  izvod-sijecanj.pdf                           [Odbaci] [Potvrdi uvoz] │
├────────────────────────────────────┬─────────────────────────────────────┤
│                                    │  Prepoznato: Bankovni izvod         │
│        PDF PREVIEW                 │  Račun: [HR123... Erste ▼]          │
│   (scrollable, zoomable)           │─────────────────────────────────────│
│                                    │  12 transakcija | Saldo: ✓          │
│   [page 1 of 3]                    │─────────────────────────────────────│
│                                    │  Datum    Opis         Iznos     ✎  │
│                                    │  15.01.  Uplata ABC   +1,500.00  ✎  │
│                                    │  ...                               │
└────────────────────────────────────┴─────────────────────────────────────┘
```

- **Left:** PDF/image viewer with zoom and page navigation
- **Right:** Editable transaction table (for statements) or invoice form
- **Inline editing:** Click cell to edit, Tab to move, Escape to cancel
- **Math validation:** Shows if balances add up correctly

## Data Flow

```
1. UPLOAD PHASE
   Files dropped → POST /api/import/upload
   → Returns jobId, stores file, status: PENDING

2. PROCESSING PHASE (parallel)
   Auto-triggered → POST /api/import/process
   → Detects type, extracts data, validates math
   → Status: PROCESSING → READY_FOR_REVIEW
   → Extracted data stored in ImportJob.extractedData (JSON)

3. CONFIRMATION PHASE (sequential)
   User reviews → PUT /api/import/jobs/[id]/confirm
   → Writes to actual tables (BankTransaction, EInvoice, etc.)
   → Status: READY_FOR_REVIEW → CONFIRMED

   Or rejects → PUT /api/import/jobs/[id]/reject
   → Status: READY_FOR_REVIEW → REJECTED
```

## Schema Changes

```prisma
enum DocumentType {
  BANK_STATEMENT
  INVOICE
  EXPENSE
}

enum JobStatus {
  PENDING
  PROCESSING
  READY_FOR_REVIEW  // NEW
  CONFIRMED         // NEW
  REJECTED          // NEW
  VERIFIED
  NEEDS_REVIEW
  FAILED
}

model ImportJob {
  // ... existing fields
  documentType    DocumentType?
  extractedData   Json?          // Parsed data before confirmation
}
```

## File Structure

```
src/
├── app/(dashboard)/import/
│   └── page.tsx                    # Universal import page
│
├── components/import/
│   ├── smart-dropzone.tsx          # Universal dropzone
│   ├── processing-queue.tsx        # Queue container
│   ├── processing-card.tsx         # Individual file card
│   ├── confirmation-modal.tsx      # Full-screen modal
│   ├── pdf-viewer.tsx              # PDF/image preview
│   ├── transaction-editor.tsx      # Editable table for statements
│   └── invoice-editor.tsx          # Editable form for invoices
│
├── lib/import/
│   ├── detect-document-type.ts     # Auto-detect logic
│   ├── process-bank-statement.ts   # Bank statement extraction
│   └── process-invoice.ts          # Invoice extraction
│
└── app/api/import/
    ├── upload/route.ts             # File upload
    ├── process/route.ts            # Processing trigger
    └── jobs/[id]/
        ├── route.ts                # GET status + extracted data
        ├── confirm/route.ts        # PUT - write to DB
        └── reject/route.ts         # PUT - mark rejected
```

## Error Handling

- **File too large (>20MB):** Error in card, allow retry
- **Unsupported format:** Reject immediately
- **Processing fails:** Offer manual entry or reject
- **Math validation fails:** Warning, allow "Potvrdi unatoč odstupanju"
- **Duplicate detection:** "Ovaj izvod već postoji. Prepiši?"
- **IBAN mismatch:** Warning only, not blocker

## Context Fields by Type

| Document Type | Context Fields |
|---------------|----------------|
| Bank Statement | Bank Account (dropdown) |
| Invoice | Type (incoming/outgoing), Supplier/Customer |
