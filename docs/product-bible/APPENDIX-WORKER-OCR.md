# APPENDIX: OCR Worker - Stakeholder-Grade Audit

> **Document Type:** Worker Audit
> **Status:** Canonical Reference
> **Last Updated:** 2026-01-14
> **Audience:** Stakeholders, Engineering, Operations, Compliance

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Overview](#2-overview)
3. [Technical Implementation](#3-technical-implementation)
4. [Inputs](#4-inputs)
5. [Outputs](#5-outputs)
6. [Dependencies](#6-dependencies)
7. [Prerequisites](#7-prerequisites)
8. [Triggers](#8-triggers)
9. [Error Handling](#9-error-handling)
10. [Guardrails & Safety](#10-guardrails--safety)
11. [Monitoring & Observability](#11-monitoring--observability)
12. [Configuration](#12-configuration)
13. [Known Issues & Limitations](#13-known-issues--limitations)
14. [Operational Runbook](#14-operational-runbook)
15. [Security Considerations](#15-security-considerations)
16. [Related Documentation](#16-related-documentation)

---

## 1. Executive Summary

### What is this worker?

The **OCR Worker** is a specialized background processor in the FiskAI Regulatory Truth Layer (RTL) that extracts text from scanned PDF documents. It transforms image-based PDF content into machine-readable text, enabling downstream regulatory fact extraction.

### Why does it exist?

Croatian regulatory sources often publish documents as scanned PDFs (digitized paper documents) rather than digital-native PDFs with embedded text. Without OCR processing, these documents would be invisible to the extraction pipeline, creating gaps in regulatory coverage.

### Key Metrics

| Metric              | Value                        |
| ------------------- | ---------------------------- |
| **Queue Name**      | `ocr`                        |
| **Concurrency**     | 1 (CPU-intensive)            |
| **Rate Limit**      | 2 jobs per minute            |
| **Memory Limit**    | 2GB                          |
| **Retry Attempts**  | 3 with exponential backoff   |
| **Primary Engine**  | Tesseract 5.x                |
| **Fallback Engine** | Vision LLM (llama3.2-vision) |

### Trust Guarantees

- Every OCR output is linked to immutable source evidence
- Confidence scores are recorded for audit
- Low-confidence results are flagged for human review
- No text modification - pure transcription only

---

## 2. Overview

### 2.1 Purpose

The OCR Worker processes scanned PDF documents to extract text content, enabling the full regulatory truth pipeline to operate on documents that would otherwise be inaccessible.

**Core Mission:** Convert image-based regulatory documents into searchable, extractable text while maintaining audit trail and quality metrics.

### 2.2 Role in Layer B (Processing)

The OCR Worker operates within **Layer B: 24/7 Processing** of the RTL architecture:

```
Layer A: Daily Discovery
├── Sentinel scans regulatory endpoints
├── Creates Evidence records
└── Classifies: PDF_SCANNED triggers OCR queue

Layer B: 24/7 Processing
├── OCR Worker ← THIS WORKER
│   └── Processes PDF_SCANNED evidence
├── Extractor (LLM-based fact extraction)
├── Composer (rule composition)
├── Reviewer (quality assurance)
├── Arbiter (conflict resolution)
└── Releaser (publication)
```

### 2.3 Pipeline Position

```
Evidence (PDF_SCANNED) → OCR Worker → Extract Worker → ...rest of pipeline
                              │
                              ├── Primary: Tesseract OCR
                              │       ↓ (if confidence < 70%)
                              └── Fallback: Vision LLM
```

### 2.4 Key Invariants

1. **OCR Text is Derived, Not Authoritative:** The OCR output is stored as an `EvidenceArtifact`, separate from the immutable `Evidence.rawContent`
2. **Confidence Tracking:** Every page includes confidence scores for quality assessment
3. **Method Attribution:** Each page records which engine (Tesseract or Vision) produced the text
4. **Human Review Escalation:** Low-confidence results trigger centralized human review requests

---

## 3. Technical Implementation

### 3.1 Entry Point

**File:** `src/lib/regulatory-truth/workers/ocr.worker.ts`

The worker is a BullMQ job processor that:

1. Receives jobs from the `ocr` queue
2. Fetches the associated Evidence record
3. Invokes the OCR pipeline
4. Creates artifacts and updates metadata
5. Queues the next pipeline stage (Extract)

### 3.2 Core Processing Flow

```typescript
async function processOcrJob(job: Job<OcrJobData>): Promise<JobResult> {
  // 1. Fetch evidence record
  const evidence = await dbReg.evidence.findUnique({ where: { id: evidenceId } })

  // 2. Validate contentClass is PDF_SCANNED
  if (evidence.contentClass !== "PDF_SCANNED") {
    return { success: false, error: "Not a scanned PDF" }
  }

  // 3. Check for existing OCR artifact (idempotency)
  const existingArtifact = await dbReg.evidenceArtifact.findFirst({
    where: { evidenceId, kind: "OCR_TEXT" },
  })
  if (existingArtifact) return { success: true, data: { skipped: true } }

  // 4. Decode PDF from base64
  const pdfBuffer = Buffer.from(evidence.rawContent, "base64")

  // 5. Run OCR pipeline
  const ocrResult = await processScannedPdf(pdfBuffer)

  // 6. Create OCR artifact
  const artifact = await dbReg.evidenceArtifact.create({
    data: {
      evidenceId,
      kind: "OCR_TEXT",
      content: ocrResult.text,
      contentHash: hashContent(ocrResult.text),
      pageMap: ocrResult.pages.map((p) => ({
        page: p.pageNum,
        confidence: p.confidence,
        method: p.method,
      })),
    },
  })

  // 7. Update evidence metadata
  await dbReg.evidence.update({
    where: { id: evidenceId },
    data: {
      primaryTextArtifactId: artifact.id,
      ocrMetadata: {
        method: ocrResult.method,
        language: "hrv+eng",
        pages: ocrResult.pages.length,
        avgConfidence: ocrResult.avgConfidence,
        processingMs: ocrResult.processingMs,
        failedPages: ocrResult.failedPages,
        needsManualReview: ocrResult.needsManualReview,
        engineVersion: "tesseract 5.x",
      },
    },
  })

  // 8. Queue for extraction (now has text artifact)
  await extractQueue.add("extract", { evidenceId, runId })

  return { success: true, duration, data: { pages, avgConfidence, method } }
}
```

### 3.3 Tesseract Integration

**File:** `src/lib/regulatory-truth/utils/tesseract.ts`

The Tesseract wrapper:

- Writes image buffer to temp file
- Invokes Tesseract CLI with TSV output for confidence data
- Parses TSV to extract per-word confidence scores
- Reconstructs text with line structure
- Cleans up temp files

```typescript
async function runTesseract(
  imageBuffer: Buffer,
  lang: string = "hrv+eng"
): Promise<TesseractResult> {
  // Write temp file
  await writeFile(tempIn, imageBuffer)

  // Run Tesseract with TSV output
  // --psm 1: Automatic page segmentation with OSD
  // --oem 1: LSTM neural network mode
  await execAsync(`tesseract "${tempIn}" "${tempOutBase}" -l ${lang} --psm 1 --oem 1 tsv`)

  // Parse TSV for confidence data
  const tsvContent = await readFile(tempOutTsv, "utf-8")
  return parseTesseractTsv(tsvContent)
}
```

**TSV Column Structure:**
| Column | Description |
|--------|-------------|
| 10 | Confidence score (0-100) |
| 11 | Word text |
| 4 | Line number |

**Confidence Calculation:**

- Average of all word-level confidence scores
- Words with confidence < 0 are excluded
- Empty words are excluded

### 3.4 Vision Fallback Logic

**File:** `src/lib/regulatory-truth/utils/vision-ocr.ts`

When Tesseract produces low-quality results, the Vision model provides a fallback:

```typescript
async function runVisionOcr(imageBuffer: Buffer): Promise<VisionOcrResult> {
  const base64Image = imageBuffer.toString("base64")

  const response = await fetch(`${OLLAMA_ENDPOINT}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(OLLAMA_API_KEY && { Authorization: `Bearer ${OLLAMA_API_KEY}` }),
    },
    body: JSON.stringify({
      model: OLLAMA_VISION_MODEL, // Default: llama3.2-vision
      messages: [
        {
          role: "user",
          content: VISION_PROMPT,
          images: [base64Image],
        },
      ],
      stream: false,
      options: {
        temperature: 0.1, // Low temperature for accuracy
        num_predict: 4096, // Max tokens for long documents
      },
    }),
  })

  return { text, confidence: estimateVisionConfidence(text) }
}
```

**Vision Prompt (Optimized for Croatian Documents):**

```
You are an OCR assistant. Extract ALL text from this scanned document image.

Rules:
- Output ONLY the extracted text, no explanations or commentary
- Preserve original formatting (paragraphs, lists, tables)
- For tables, use | separators between columns
- Keep Croatian characters exactly as shown (c, c, d, s, z, C, C, D, S, Z)
- If text is unclear or illegible, use [nejasno] placeholder
- Do not translate, interpret, or summarize - just transcribe exactly what you see
- Maintain the original reading order (top to bottom, left to right)
```

**Fallback Decision Logic:**

```typescript
async function processPage(imageBuffer: Buffer, pageNum: number): Promise<PageResult> {
  // Run Tesseract first
  const tesseractResult = await runTesseract(imageBuffer, "hrv+eng")

  // Check if Vision fallback is needed
  const needsVision =
    tesseractResult.confidence < TESSERACT_CONFIDENCE_THRESHOLD || // < 70%
    isGarbageText(tesseractResult.text) // > 20% non-letter chars

  if (!needsVision) {
    return {
      pageNum,
      text: tesseractResult.text,
      confidence: tesseractResult.confidence,
      method: "tesseract",
    }
  }

  // Try Vision fallback
  try {
    const visionResult = await runVisionOcr(imageBuffer)

    // Use Vision result only if it's better
    if (visionResult.confidence > tesseractResult.confidence) {
      return {
        pageNum,
        text: visionResult.text,
        confidence: visionResult.confidence,
        method: "vision",
      }
    }
  } catch (error) {
    console.warn(`[ocr] Page ${pageNum}: Vision failed, using Tesseract anyway`)
  }

  // Fall back to Tesseract result
  return {
    pageNum,
    text: tesseractResult.text,
    confidence: tesseractResult.confidence,
    method: "tesseract",
  }
}
```

### 3.5 PDF Page Extraction

**File:** `src/lib/regulatory-truth/utils/pdf-renderer.ts`

Uses poppler-utils (pdftoppm) to render PDF pages as PNG images:

```typescript
async function renderPdfToImages(
  pdfBuffer: Buffer,
  options: RenderOptions = {}
): Promise<RenderedPage[]> {
  const dpi = options.dpi || 300 // 300 DPI for OCR quality

  // Create temp directory
  await mkdir(tempDir, { recursive: true })
  await writeFile(tempPdf, pdfBuffer)

  // Get page count
  const { stdout } = await execAsync(`pdfinfo "${tempPdf}" | grep Pages`)
  const pageCount = parseInt(stdout.match(/Pages:\s+(\d+)/)?.[1] || "1")

  // Render all pages to PNG
  await execAsync(`pdftoppm -png -r ${dpi} "${tempPdf}" "${tempDir}/page"`)

  // Read generated images
  const pages: RenderedPage[] = []
  for (const pageFile of pageFiles) {
    const imgBuffer = await readFile(path.join(tempDir, pageFile))
    pages.push({ pageNum: i + 1, buffer: imgBuffer })
  }

  // Cleanup temp directory
  await rm(tempDir, { recursive: true, force: true })

  return pages
}
```

### 3.6 Text Artifact Creation

The OCR output is stored as an `EvidenceArtifact`:

```typescript
const artifact = await dbReg.evidenceArtifact.create({
  data: {
    evidenceId,
    kind: "OCR_TEXT",
    content: ocrResult.text, // Combined text from all pages
    contentHash: hashContent(ocrResult.text), // SHA256 for integrity
    pageMap: ocrResult.pages.map((p) => ({
      page: p.pageNum,
      confidence: p.confidence,
      method: p.method, // "tesseract" or "vision"
    })),
  },
})
```

**Text Format:**

```
[Stranica 1]
<text from page 1>

[Stranica 2]
<text from page 2>

...
```

---

## 4. Inputs

### 4.1 Job Payload Schema

```typescript
interface OcrJobData {
  evidenceId: string // UUID of Evidence record to process
  runId: string // Pipeline run identifier for tracking
}
```

### 4.2 Evidence Requirements

| Field                   | Requirement                          |
| ----------------------- | ------------------------------------ |
| `id`                    | Valid UUID                           |
| `contentClass`          | Must be `PDF_SCANNED`                |
| `rawContent`            | Base64-encoded PDF binary            |
| `primaryTextArtifactId` | Should be `null` (not yet processed) |

### 4.3 PDF Content Expectations

- **Format:** Base64-encoded PDF binary stored in `Evidence.rawContent`
- **Type:** Scanned document (image-based, not text-layer PDF)
- **Size:** Unbounded (but memory limits apply)
- **Quality:** Reasonable scan quality (recommended 200+ DPI original)
- **Pages:** Any count (processed sequentially)

### 4.4 Classification Flow

Evidence is classified as `PDF_SCANNED` during Sentinel discovery when:

```typescript
function isScannedPdf(extractedText: string, pageCount: number): boolean {
  const textLength = extractedText?.trim().length || 0
  const charsPerPage = textLength / Math.max(pageCount, 1)
  return charsPerPage < 50 // Less than 50 chars per page = scanned
}
```

---

## 5. Outputs

### 5.1 EvidenceArtifact (OCR_TEXT)

**Table:** `EvidenceArtifact` (Regulatory Database)

| Field         | Type     | Description                      |
| ------------- | -------- | -------------------------------- |
| `id`          | UUID     | Artifact identifier              |
| `evidenceId`  | UUID     | Link to source Evidence          |
| `kind`        | Enum     | `"OCR_TEXT"`                     |
| `content`     | Text     | Extracted text with page markers |
| `contentHash` | String   | SHA256 of extracted text         |
| `pageMap`     | JSON     | Per-page metadata array          |
| `createdAt`   | DateTime | Creation timestamp               |

**pageMap Structure:**

```json
[
  { "page": 1, "confidence": 87.5, "method": "tesseract" },
  { "page": 2, "confidence": 65.2, "method": "vision" },
  { "page": 3, "confidence": 92.1, "method": "tesseract" }
]
```

### 5.2 Evidence Metadata Updates

**Table:** `Evidence` (Regulatory Database)

| Field                   | Type | Description                         |
| ----------------------- | ---- | ----------------------------------- |
| `primaryTextArtifactId` | UUID | Points to created OCR_TEXT artifact |
| `ocrMetadata`           | JSON | Comprehensive OCR metadata          |

**ocrMetadata Structure:**

```json
{
  "method": "tesseract" | "vision" | "hybrid",
  "language": "hrv+eng",
  "pages": 12,
  "avgConfidence": 78.5,
  "processingMs": 45230,
  "failedPages": [5, 9],
  "needsManualReview": true,
  "engineVersion": "tesseract 5.x"
}
```

### 5.3 Human Review Queue Entry

When `needsManualReview` is true, creates a `HumanReviewQueue` entry:

```typescript
await requestOcrReview(evidenceId, {
  avgConfidence: ocrResult.avgConfidence,
  failedPages: ocrResult.failedPages,
})
```

**Review Reasons:**
| Reason | Default Priority | SLA |
|--------|------------------|-----|
| `LOW_OCR_CONFIDENCE` | NORMAL | 72 hours |
| `OCR_FAILED` | HIGH | 48 hours |

### 5.4 Downstream Queue Job

On success, queues extraction:

```typescript
await extractQueue.add("extract", { evidenceId, runId }, { jobId: `extract-${evidenceId}` })
```

---

## 6. Dependencies

### 6.1 System Binaries

| Dependency             | Package                  | Purpose                                     |
| ---------------------- | ------------------------ | ------------------------------------------- |
| **Tesseract**          | `tesseract-ocr`          | Primary OCR engine                          |
| **Tesseract Croatian** | `tesseract-ocr-data-hrv` | Croatian language model                     |
| **Tesseract English**  | `tesseract-ocr-data-eng` | English language model                      |
| **Poppler**            | `poppler-utils`          | PDF to image conversion (pdftoppm, pdfinfo) |
| **Ghostscript**        | `ghostscript`            | PDF processing support                      |

### 6.2 Docker Image Requirements

The OCR worker requires a special Docker image built with `WITH_OCR=true`:

```dockerfile
# From Dockerfile.worker
ARG WITH_OCR=false
RUN if [ "$WITH_OCR" = "true" ]; then \
    apk add --no-cache \
        tesseract-ocr \
        tesseract-ocr-data-hrv \
        tesseract-ocr-data-eng \
        poppler-utils \
        ghostscript; \
    fi
```

**Image Tag:** `ghcr.io/wandeon/fiskai-worker-ocr:${IMAGE_TAG}`

### 6.3 Vision LLM (Fallback)

| Dependency        | Purpose              |
| ----------------- | -------------------- |
| Ollama Endpoint   | Vision model hosting |
| `llama3.2-vision` | Default vision model |

**Environment Variables:**

```bash
OLLAMA_ENDPOINT=https://...
OLLAMA_API_KEY=...
OLLAMA_VISION_MODEL=llama3.2-vision  # Optional, default shown
```

### 6.4 Database

| Database      | Client  | Purpose                            |
| ------------- | ------- | ---------------------------------- |
| Regulatory DB | `dbReg` | Evidence, EvidenceArtifact storage |
| Main DB       | `db`    | HumanReviewQueue entries           |

### 6.5 Queue System

| Dependency | Purpose                  |
| ---------- | ------------------------ |
| Redis      | BullMQ job queue backend |
| BullMQ     | Job processing framework |

---

## 7. Prerequisites

### 7.1 Evidence State Requirements

| Requirement                 | Validation                                | Error if Violated                               |
| --------------------------- | ----------------------------------------- | ----------------------------------------------- |
| Evidence exists             | `findUnique` returns record               | "Evidence not found: {id}"                      |
| contentClass is PDF_SCANNED | `evidence.contentClass === "PDF_SCANNED"` | "Evidence {id} is not PDF_SCANNED (is {class})" |
| Not already processed       | No existing OCR_TEXT artifact             | Skipped (success with `skipped: true`)          |

### 7.2 PDF Validity

| Requirement         | Validation                | Behavior     |
| ------------------- | ------------------------- | ------------ |
| Valid base64        | Successful Buffer.from()  | Error thrown |
| Valid PDF structure | pdftoppm succeeds         | Error thrown |
| At least 1 page     | pdfinfo returns Pages > 0 | Error thrown |

### 7.3 Tool Availability

| Tool         | Check                 | Fallback              |
| ------------ | --------------------- | --------------------- |
| Tesseract    | `tesseract --version` | None (required)       |
| Vision model | API health check      | Tesseract result used |
| pdftoppm     | Part of poppler-utils | None (required)       |

---

## 8. Triggers

### 8.1 Router Worker Routing

The primary trigger path is through the Router Worker:

```typescript
// From router.worker.ts
if (scoutResult.needsOCR) {
  await ocrQueue.add("ocr", { evidenceId, runId }, { jobId: `ocr-${evidenceId}` })
}
```

### 8.2 Continuous Drainer

The Continuous Drainer scans for PDF_SCANNED evidence without OCR artifacts:

```typescript
async function drainPendingOcr(): Promise<number> {
  const pending = await dbReg.evidence.findMany({
    where: {
      contentClass: "PDF_SCANNED",
      primaryTextArtifactId: null,
      OR: [
        { ocrMetadata: { equals: Prisma.DbNull } },
        { ocrMetadata: { path: ["error"], equals: Prisma.DbNull } },
      ],
    },
    select: { id: true },
    take: 10,
  })

  // Queue OCR jobs
  await ocrQueue.addBulk(
    pending.map((e) => ({
      name: "ocr",
      data: { evidenceId: e.id, runId: `drain-ocr-${Date.now()}` },
      opts: { jobId: `ocr-${e.id}` },
    }))
  )
}
```

### 8.3 Manual Trigger

```bash
# Via script
npx tsx src/lib/regulatory-truth/scripts/run-ocr.ts [evidenceId]

# Via direct queue addition
npx tsx -e "
import { ocrQueue } from './src/lib/regulatory-truth/workers/queues'
await ocrQueue.add('ocr', { evidenceId: 'xxx', runId: 'manual' })
"
```

### 8.4 Trigger Conditions Summary

| Trigger Source     | When                            | Rate               |
| ------------------ | ------------------------------- | ------------------ |
| Router Worker      | `scoutResult.needsOCR === true` | Per evidence       |
| Continuous Drainer | PDF_SCANNED without artifact    | Up to 10 per cycle |
| Manual Script      | On demand                       | Single job         |

---

## 9. Error Handling

### 9.1 OCR Failure Handling

When OCR produces no text:

```typescript
if (!ocrResult.text || ocrResult.text.trim().length === 0) {
  // Update metadata with error
  await dbReg.evidence.update({
    where: { id: evidenceId },
    data: {
      ocrMetadata: {
        error: "No text extracted",
        processingMs: ocrResult.processingMs,
        needsManualReview: true,
      },
    },
  })

  // Create human review request
  await requestOcrReview(evidenceId, { error: "No text extracted" })

  return { success: false, error: "No text extracted from OCR" }
}
```

### 9.2 Vision Fallback Error Handling

When Vision API fails:

```typescript
try {
  const visionResult = await runVisionOcr(imageBuffer)
  // Use vision result if better
} catch (error) {
  console.warn(`[ocr] Page ${pageNum}: Vision failed, using Tesseract anyway`)
  // Continue with Tesseract result
}
```

### 9.3 Page-Level Error Recovery

Each page is processed independently. A failure on one page does not stop processing of other pages:

```typescript
const pages: PageResult[] = []
for (const rendered of renderedPages) {
  const pageResult = await processPage(rendered.buffer, rendered.pageNum)
  pages.push(pageResult) // Always pushed, confidence reflects quality
}
```

Low-confidence pages are tracked:

```typescript
const failedPages = pages
  .filter((p) => p.confidence < MANUAL_REVIEW_THRESHOLD) // < 50%
  .map((p) => p.pageNum)
```

### 9.4 Retry Logic

Configured in queue definition:

```typescript
const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 10000, // 10s, 20s, 40s
  },
}
```

### 9.5 Dead Letter Queue

After all retries exhausted:

```typescript
worker.on("failed", (job, err) => {
  if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
    void moveToDeadLetterQueue(job, err, queueName, workerName)
  }
})
```

### 9.6 Error Categories

| Error Type         | Handling            | Recovery             |
| ------------------ | ------------------- | -------------------- |
| Evidence not found | Return failure      | None                 |
| Wrong contentClass | Return failure      | None                 |
| PDF decode error   | Throw, retry        | Retry 3x             |
| Tesseract error    | Return empty result | Vision fallback      |
| Vision API error   | Log warning         | Use Tesseract result |
| DB write error     | Throw, retry        | Retry 3x             |

---

## 10. Guardrails & Safety

### 10.1 Quality Thresholds

Defined in `ocr-processor.ts`:

```typescript
const TESSERACT_CONFIDENCE_THRESHOLD = 70 // >= 70% skips vision fallback
const GARBAGE_TEXT_THRESHOLD = 0.2 // > 20% non-letter/number triggers vision
const MANUAL_REVIEW_THRESHOLD = 50 // < 50% avg confidence flags for human review
```

### 10.2 Confidence Scoring

**Tesseract Confidence:**

- Per-word confidence from TSV output (0-100)
- Average across all valid words
- Words with confidence < 0 excluded

**Vision Confidence Estimation:**

```typescript
function estimateVisionConfidence(text: string): number {
  let confidence = 85 // Base confidence

  // Reduce for unclear markers
  const unclearRatio = unclearCount / totalWords
  confidence -= unclearRatio * 40

  // Reduce for garbage characters
  const garbageRatio = 1 - validChars.length / text.length
  confidence -= garbageRatio * 50

  // Reduce for very short text
  if (text.length < 50) confidence -= 20

  return Math.max(0, Math.min(100, confidence))
}
```

### 10.3 Garbage Text Detection

Detects OCR artifacts that indicate failed recognition:

```typescript
function isGarbageText(text: string): boolean {
  if (!text || text.length < 20) return true

  // Count non-letter, non-number, non-whitespace
  // Catches: UAEU, C, and other OCR noise
  const garbageChars = text.match(/[^\p{L}\p{N}\s]/gu) || []
  const garbageRatio = garbageChars.length / text.length

  return garbageRatio > GARBAGE_TEXT_THRESHOLD // > 20%
}
```

### 10.4 Memory Management

| Control                    | Setting           | Purpose             |
| -------------------------- | ----------------- | ------------------- |
| Container memory limit     | 2GB               | Prevent OOM         |
| Concurrency                | 1                 | Single-threaded OCR |
| Temp file cleanup          | Always in finally | Prevent disk fill   |
| Sequential page processing | For loop          | Controlled memory   |

### 10.5 Maximum Page Limits

No explicit page limit, but practical limits:

- Memory: 2GB container limit
- Time: Job timeout from BullMQ
- Backoff: Rate limit of 2 jobs/minute

### 10.6 Idempotency

Jobs are idempotent - reprocessing same evidence is safe:

```typescript
const existingArtifact = await dbReg.evidenceArtifact.findFirst({
  where: { evidenceId, kind: "OCR_TEXT" },
})

if (existingArtifact) {
  console.log(`[ocr] Evidence ${evidenceId} already has OCR_TEXT artifact, skipping`)
  return { success: true, duration: 0, data: { skipped: true } }
}
```

---

## 11. Monitoring & Observability

### 11.1 Prometheus Metrics

**Counter: Jobs Processed**

```typescript
jobsProcessed.inc({ worker: "ocr", status: "success", queue: "ocr" })
jobsProcessed.inc({ worker: "ocr", status: "failed", queue: "ocr" })
```

**Histogram: Job Duration**

```typescript
jobDuration.observe({ worker: "ocr", queue: "ocr" }, duration / 1000)
```

Histogram buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120] seconds

### 11.2 Console Logging

**Job Start:**

```
[ocr] Processing job xxx: ocr
```

**Page Progress:**

```
[ocr] Page 1: Running Tesseract...
[ocr] Page 1: Tesseract OK (conf=87.5%)
[ocr] Page 2: Tesseract low quality (conf=45.2%), trying vision...
[ocr] Page 2: Vision better (conf=72.1%)
```

**Job Completion:**

```
[ocr] Completed {evidenceId}: {pages} pages, conf={avgConfidence}%, time={duration}ms
[ocr] Job xxx completed in {duration}ms
```

### 11.3 Key Metrics to Monitor

| Metric                                                      | Description        | Alert Threshold    |
| ----------------------------------------------------------- | ------------------ | ------------------ |
| `worker_jobs_processed_total{worker="ocr",status="failed"}` | Failed OCR jobs    | > 5% of total      |
| `worker_job_duration_seconds{worker="ocr"}`                 | Processing time    | p95 > 120s         |
| `ocrMetadata.avgConfidence`                                 | Average confidence | < 60% across batch |
| `ocrMetadata.needsManualReview` count                       | Human review rate  | > 10% of jobs      |
| Vision fallback rate                                        | Pages using vision | > 30% of pages     |

### 11.4 Observability Queries

**Success Rate:**

```sql
SELECT
  COUNT(*) FILTER (WHERE "ocrMetadata"->>'error' IS NULL) as success,
  COUNT(*) FILTER (WHERE "ocrMetadata"->>'error' IS NOT NULL) as failed
FROM "Evidence"
WHERE "contentClass" = 'PDF_SCANNED';
```

**Average Confidence by Source:**

```sql
SELECT
  s.slug,
  AVG(CAST(e."ocrMetadata"->>'avgConfidence' AS FLOAT)) as avg_conf,
  COUNT(*) as count
FROM "Evidence" e
JOIN "RegulatorySource" s ON e."sourceId" = s.id
WHERE e."contentClass" = 'PDF_SCANNED'
GROUP BY s.slug
ORDER BY avg_conf ASC;
```

**Vision Fallback Usage:**

```sql
SELECT
  "ocrMetadata"->>'method' as method,
  COUNT(*) as count
FROM "Evidence"
WHERE "contentClass" = 'PDF_SCANNED'
  AND "ocrMetadata" IS NOT NULL
GROUP BY method;
```

### 11.5 Processing Time Breakdown

| Phase           | Typical Duration  | Notes             |
| --------------- | ----------------- | ----------------- |
| PDF decode      | 10-50ms           | Depends on size   |
| Page rendering  | 500ms-2s per page | 300 DPI PNG       |
| Tesseract OCR   | 2-10s per page    | CPU-bound         |
| Vision fallback | 5-15s per page    | API latency       |
| DB writes       | 50-200ms          | Includes artifact |

---

## 12. Configuration

### 12.1 Environment Variables

| Variable              | Default                  | Description                 |
| --------------------- | ------------------------ | --------------------------- |
| `OLLAMA_ENDPOINT`     | `http://localhost:11434` | Ollama API endpoint         |
| `OLLAMA_API_KEY`      | (none)                   | Optional API key            |
| `OLLAMA_VISION_MODEL` | `llama3.2-vision`        | Vision model name           |
| `WORKER_CONCURRENCY`  | 1                        | Jobs processed concurrently |

### 12.2 Docker Compose Configuration

```yaml
# From docker-compose.workers.yml
worker-ocr:
  image: ghcr.io/wandeon/fiskai-worker-ocr:${IMAGE_TAG:-latest}
  container_name: fiskai-worker-ocr
  command: ["node", "dist/workers/lib/regulatory-truth/workers/ocr.worker.js"]
  environment:
    NODE_ENV: production
    REDIS_URL: redis://fiskai-redis:6379
    DATABASE_URL: ${DATABASE_URL}
    REGULATORY_DATABASE_URL: ${REGULATORY_DATABASE_URL}
    OLLAMA_ENDPOINT: ${OLLAMA_ENDPOINT}
    OLLAMA_API_KEY: ${OLLAMA_API_KEY}
    OLLAMA_VISION_MODEL: ${OLLAMA_VISION_MODEL:-llama3.2-vision}
    WORKER_TYPE: ocr
    WORKER_CONCURRENCY: 1
  deploy:
    resources:
      limits:
        memory: 2G
```

### 12.3 Tesseract Language Packs

Installed languages:

- `hrv` - Croatian
- `eng` - English

Combined usage: `hrv+eng` (tries both, Croatian primary)

To add more languages:

```dockerfile
RUN apk add --no-cache tesseract-ocr-data-deu  # German
```

### 12.4 Quality Thresholds (Hardcoded)

```typescript
// src/lib/regulatory-truth/utils/ocr-processor.ts
const TESSERACT_CONFIDENCE_THRESHOLD = 70
const GARBAGE_TEXT_THRESHOLD = 0.2
const MANUAL_REVIEW_THRESHOLD = 50
```

### 12.5 Rate Limiting

```typescript
// From queues.ts
export const ocrQueue = createQueue("ocr", { max: 2, duration: 60000 })
// 2 jobs per 60 seconds
```

### 12.6 Retry Configuration

```typescript
const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 10000, // 10s initial, doubles each retry
  },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 100 },
}
```

---

## 13. Known Issues & Limitations

### 13.1 Scanned Image Quality Requirements

| Issue                     | Impact              | Mitigation              |
| ------------------------- | ------------------- | ----------------------- |
| Low DPI scans (< 150 DPI) | Poor recognition    | Vision fallback         |
| Skewed pages              | Reduced accuracy    | None (TODO: deskew)     |
| Handwritten content       | Very low confidence | Human review escalation |
| Faded text                | Low confidence      | Vision fallback         |
| Multi-column layouts      | Text mixing         | Vision fallback         |

### 13.2 Language Support Limitations

| Supported       | Quality                |
| --------------- | ---------------------- |
| Croatian        | Good (with hrv model)  |
| English         | Good (with eng model)  |
| Mixed HR/EN     | Good                   |
| Other languages | Poor (fallback to eng) |

**Known Issues:**

- Special Croatian characters (c, c, d, s, z) occasionally misrecognized
- Vision model better at Croatian preservation

### 13.3 Large PDF Handling

| Pages | Typical Time | Memory    | Notes       |
| ----- | ------------ | --------- | ----------- |
| 1-10  | 30s-5min     | < 500MB   | Normal      |
| 10-50 | 5-30min      | 500MB-1GB | May timeout |
| 50+   | 30min+       | 1-2GB     | Risk of OOM |

**Recommendations:**

- Consider splitting very large PDFs
- Monitor memory usage
- Adjust timeout if needed

### 13.4 Memory Usage Patterns

| Phase          | Memory Impact                      |
| -------------- | ---------------------------------- |
| PDF loading    | Size of PDF \* 2 (base64 + buffer) |
| Page rendering | ~10MB per 300 DPI page             |
| Tesseract      | ~100MB per page during processing  |
| Vision API     | Minimal (base64 sent to API)       |

### 13.5 Known Bugs

1. **Temp file cleanup race:** In rare cases, cleanup may fail if process crashes mid-job
   - Impact: Orphaned files in /tmp
   - Workaround: Periodic /tmp cleanup

2. **Vision timeout not configurable:** API timeout is not configurable
   - Impact: Long pages may timeout
   - Workaround: None currently

### 13.6 Future Improvements

- [ ] PDF deskew preprocessing
- [ ] Configurable page limits
- [ ] Table structure preservation
- [ ] Form field detection
- [ ] Multi-language support expansion
- [ ] GPU acceleration for Tesseract

---

## 14. Operational Runbook

### 14.1 Health Check

```bash
# Check worker logs
docker logs fiskai-worker-ocr --tail 50

# Check queue depth
npx tsx scripts/queue-status.ts

# Check recent OCR results
docker exec fiskai-db psql -U fiskai -d fiskai_regulatory -c \
  "SELECT id, \"ocrMetadata\"->>'avgConfidence' as conf,
          \"ocrMetadata\"->>'method' as method,
          \"ocrMetadata\"->>'needsManualReview' as review
   FROM \"Evidence\"
   WHERE \"contentClass\" = 'PDF_SCANNED'
   ORDER BY \"fetchedAt\" DESC LIMIT 10"
```

### 14.2 Manual OCR Test

```bash
# Test OCR on specific evidence
npx tsx -e "
import { processScannedPdf } from './src/lib/regulatory-truth/utils/ocr-processor'
import { dbReg } from './src/lib/db'

const evidence = await dbReg.evidence.findUnique({
  where: { id: 'EVIDENCE_ID' }
})
const pdfBuffer = Buffer.from(evidence.rawContent, 'base64')
const result = await processScannedPdf(pdfBuffer)
console.log(result)
"
```

### 14.3 Tesseract Availability Check

```bash
# In container
docker exec fiskai-worker-ocr tesseract --version
docker exec fiskai-worker-ocr tesseract --list-langs

# Expected output:
# tesseract 5.x.x
# List of available languages:
# eng
# hrv
```

### 14.4 Vision Model Check

```bash
# Check Ollama models
curl -s ${OLLAMA_ENDPOINT}/api/tags | jq '.models[].name'

# Test vision model
npx tsx -e "
import { isVisionModelAvailable } from './src/lib/regulatory-truth/utils/vision-ocr'
console.log(await isVisionModelAvailable())
"
```

### 14.5 Queue Management

```bash
# View pending jobs
npx tsx -e "
import { ocrQueue } from './src/lib/regulatory-truth/workers/queues'
const jobs = await ocrQueue.getJobs(['waiting', 'active'])
console.log(jobs.length, 'jobs in queue')
jobs.slice(0, 5).forEach(j => console.log(j.id, j.data))
"

# Clear stuck jobs
npx tsx -e "
import { ocrQueue } from './src/lib/regulatory-truth/workers/queues'
await ocrQueue.clean(60000, 100, 'failed')
await ocrQueue.clean(60000, 100, 'stalled')
"
```

### 14.6 Restart Worker

```bash
# Restart single worker
docker restart fiskai-worker-ocr

# Full redeploy
./scripts/deploy-workers.sh
```

### 14.7 Debug Low Confidence

```sql
-- Find low confidence OCR results
SELECT
  id,
  url,
  "ocrMetadata"->>'avgConfidence' as confidence,
  "ocrMetadata"->>'failedPages' as failed_pages,
  "ocrMetadata"->>'method' as method
FROM "Evidence"
WHERE "contentClass" = 'PDF_SCANNED'
  AND CAST("ocrMetadata"->>'avgConfidence' AS FLOAT) < 60
ORDER BY "fetchedAt" DESC
LIMIT 20;
```

---

## 15. Security Considerations

### 15.1 Input Validation

| Input           | Validation             | Risk if Skipped   |
| --------------- | ---------------------- | ----------------- |
| Evidence ID     | UUID format            | SQL injection     |
| PDF content     | Valid PDF structure    | Binary exploit    |
| Base64 decoding | Handled by Buffer.from | Memory corruption |

### 15.2 Command Injection Prevention

All external commands use parameterized paths:

```typescript
// Safe - path is quoted and sanitized
await execAsync(`tesseract "${tempIn}" "${tempOutBase}" -l ${lang} --psm 1 --oem 1 tsv`)
```

- Temp file paths use `randomUUID()` - no user input in paths
- Language parameter is hardcoded (`hrv+eng`)

### 15.3 Temp File Security

| Control      | Implementation                       |
| ------------ | ------------------------------------ |
| Random names | `randomUUID()` in path               |
| Cleanup      | `finally` block ensures removal      |
| Location     | System /tmp with container isolation |
| Permissions  | Non-root user in container           |

### 15.4 Vision API Security

| Control       | Implementation                   |
| ------------- | -------------------------------- |
| API key       | Environment variable, not logged |
| HTTPS         | Endpoint should use HTTPS        |
| Image content | Base64 encoded, not persisted    |

### 15.5 Data Privacy

- Raw PDF content stored in database (encrypted at rest)
- OCR text stored in separate artifact table
- No external logging of document content
- Vision model may process content - ensure compliant model

---

## 16. Related Documentation

### Internal Documentation

| Document               | Path                                             | Description                      |
| ---------------------- | ------------------------------------------------ | -------------------------------- |
| RTL Architecture       | `docs/01_ARCHITECTURE/REGULATORY_TRUTH_LAYER.md` | Complete RTL system architecture |
| Worker Build Authority | `docs/operations/WORKER_BUILD_AUTHORITY.md`      | Docker image build process       |
| Product Bible          | `docs/product-bible/`                            | Full product specification       |

### External Resources

| Resource      | URL                                        | Description                |
| ------------- | ------------------------------------------ | -------------------------- |
| Tesseract OCR | https://github.com/tesseract-ocr/tesseract | Primary OCR engine         |
| Poppler Utils | https://poppler.freedesktop.org/           | PDF rendering tools        |
| Ollama        | https://ollama.ai                          | Vision model hosting       |
| BullMQ        | https://docs.bullmq.io/                    | Queue system documentation |

### Related Workers

| Worker             | Relationship                             |
| ------------------ | ---------------------------------------- |
| Sentinel           | Classifies evidence as PDF_SCANNED       |
| Router             | Routes PDF_SCANNED to OCR queue          |
| Continuous Drainer | Queues unprocessed PDF_SCANNED           |
| Extractor          | Processes OCR output for fact extraction |

---

## Appendix A: Data Model Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Evidence                                  │
├─────────────────────────────────────────────────────────────────┤
│ id                    UUID                                       │
│ url                   String                                     │
│ rawContent            String (base64 PDF)                        │
│ contentHash           String (SHA256)                            │
│ contentClass          "PDF_SCANNED"                              │
│ ocrMetadata           JSON (OCR results)                         │
│ primaryTextArtifactId UUID (FK to EvidenceArtifact)              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ 1:1
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EvidenceArtifact                              │
├─────────────────────────────────────────────────────────────────┤
│ id                    UUID                                       │
│ evidenceId            UUID (FK to Evidence)                      │
│ kind                  "OCR_TEXT"                                 │
│ content               String (extracted text)                    │
│ contentHash           String (SHA256)                            │
│ pageMap               JSON (per-page metadata)                   │
│ createdAt             DateTime                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Appendix B: Threshold Reference

| Threshold            | Value         | Purpose                 | Location               |
| -------------------- | ------------- | ----------------------- | ---------------------- |
| Tesseract Confidence | 70%           | Skip vision if above    | `ocr-processor.ts:10`  |
| Garbage Text         | 20%           | Trigger vision if above | `ocr-processor.ts:11`  |
| Manual Review        | 50%           | Flag for human if below | `ocr-processor.ts:12`  |
| Scanned Detection    | 50 chars/page | Classify as PDF_SCANNED | `ocr-processor.ts:134` |

---

## Appendix C: Error Message Reference

| Error Message                      | Cause                     | Resolution                                   |
| ---------------------------------- | ------------------------- | -------------------------------------------- |
| "Evidence not found: {id}"         | Invalid evidence ID       | Check ID exists in database                  |
| "Evidence {id} is not PDF_SCANNED" | Wrong content class       | Evidence should not be in OCR queue          |
| "No text extracted from OCR"       | OCR produced empty result | Check PDF quality, escalated to human review |
| "tesseract: command not found"     | Missing Tesseract         | Use OCR Docker image                         |
| "pdfinfo: command not found"       | Missing poppler-utils     | Use OCR Docker image                         |
| "Vision API error: {status}"       | Vision model unavailable  | Check Ollama endpoint                        |

---

## Document History

| Version | Date       | Author      | Changes                   |
| ------- | ---------- | ----------- | ------------------------- |
| 1.0     | 2026-01-14 | Claude Code | Initial stakeholder audit |

---

_This document is maintained as part of the FiskAI Product Bible. For updates, contact the RTL team._
