# OCR Preprocessing Lane Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Process 87 scanned PDFs (image-only) that currently fail with "No text extracted" by adding Tesseract OCR with Croatian language support and vision model fallback.

**Architecture:** OCR as a preprocessing step that produces text artifacts, consumed by existing Extractor unchanged. Tesseract primary (fast, free), Vision fallback (for low-confidence pages).

**Tech Stack:** Tesseract 5.x, poppler-utils, node child_process, Ollama vision models

---

## 1. Schema Changes

### 1.1 Evidence Model Updates

```prisma
model Evidence {
  // ... existing fields ...
  rawContent              String   @db.Text  // IMMUTABLE: original fetched payload
  contentClass            String   @default("HTML")  // HTML, PDF_TEXT, PDF_SCANNED, DOC, XLSX, JSON
  ocrMetadata             Json?    // OCR processing metadata
  primaryTextArtifactId   String?  // Points to canonical text artifact

  artifacts       EvidenceArtifact[]
}
```

**contentClass values:**

- `HTML` - Web pages (default)
- `JSON` - API responses (e.g., HNB exchange rates)
- `PDF_TEXT` - PDFs with embedded text layer
- `PDF_SCANNED` - Image-only PDFs requiring OCR
- `DOC` - Word documents
- `XLSX` - Excel spreadsheets

**ocrMetadata example:**

```json
{
  "method": "hybrid",
  "language": "hrv",
  "pages": 12,
  "avgConfidence": 87.5,
  "processingMs": 48210,
  "visionFallbackUsed": true,
  "failedPages": [7, 9],
  "engineVersion": "tesseract 5.x"
}
```

### 1.2 New EvidenceArtifact Table

```prisma
model EvidenceArtifact {
  id          String   @id @default(cuid())
  evidenceId  String
  kind        String   // PDF_TEXT, OCR_TEXT, OCR_HOCR, HTML_CLEANED, TABLE_JSON
  content     String   @db.Text
  contentHash String
  pageMap     Json?    // Per-page metadata
  createdAt   DateTime @default(now())

  evidence    Evidence @relation(fields: [evidenceId], references: [id], onDelete: Cascade)

  @@index([evidenceId])
  @@index([kind])
}
```

**Artifact kinds:**

- `PDF_TEXT` - Text extracted via pdf-parse (text-layer PDFs)
- `OCR_TEXT` - Text extracted via Tesseract/Vision OCR
- `OCR_HOCR` - hOCR format with bounding boxes (optional, for traceability)
- `HTML_CLEANED` - Cleaned HTML content
- `TABLE_JSON` - Structured table data

---

## 2. Data Flow

### 2.1 Pipeline Overview

```
Sentinel (fetch)
    │
    ├─→ HTML/JSON → Evidence(contentClass: HTML) ──────────────────→ Extractor
    │
    ├─→ PDF with text → Evidence(contentClass: PDF_TEXT)
    │                   + Artifact(PDF_TEXT) ──────────────────────→ Extractor
    │
    └─→ PDF scanned → Evidence(contentClass: PDF_SCANNED) → OCR Queue
                                                                │
                                                           OCR Worker
                                                                │
                                                    Artifact(OCR_TEXT)
                                                    + ocrMetadata
                                                                │
                                                           Extractor
```

### 2.2 Immutability Rules

- `Evidence.rawContent` = **immutable fetched payload** (PDF bytes as base64, HTML, JSON)
- `EvidenceArtifact.content` = **derived text** (from parsing or OCR)
- Never overwrite rawContent with derived text
- Always create new artifacts for reprocessing

---

## 3. OCR Processing Logic

### 3.1 Scanned PDF Detection

```typescript
async function parsePdf(buffer: Buffer): Promise<PdfParseResult> {
  const data = await pdf(buffer)
  const textLength = data.text?.trim().length || 0
  const pageCount = data.numpages || 1
  const charsPerPage = textLength / pageCount

  // Heuristic: scanned PDFs have <50 chars/page
  const isScanned = charsPerPage < 50

  return {
    text: data.text,
    isScanned,
    pageCount,
    charsPerPage,
    info: data.info,
  }
}
```

### 3.2 OCR Pipeline

```typescript
interface OcrResult {
  text: string
  pages: PageResult[]
  avgConfidence: number
  method: "tesseract" | "vision" | "hybrid"
  processingMs: number
  failedPages: number[]
}

async function processScannedPdf(buffer: Buffer): Promise<OcrResult> {
  // 1. Render PDF to images (300 DPI)
  const images = await renderPdfToImages(buffer, { dpi: 300 })

  // 2. Process each page
  const pages: PageResult[] = []
  for (const [i, imageBuffer] of images.entries()) {
    const result = await processPage(imageBuffer, i + 1)
    pages.push(result)
  }

  // 3. Combine results
  return {
    text: pages.map((p) => `[Page ${p.pageNum}]\n${p.text}`).join("\n\n"),
    pages,
    avgConfidence: average(pages.map((p) => p.confidence)),
    method: pages.some((p) => p.method === "vision") ? "hybrid" : "tesseract",
    processingMs: elapsed,
    failedPages: pages.filter((p) => p.confidence < 50).map((p) => p.pageNum),
  }
}
```

### 3.3 Per-Page Processing

```typescript
async function processPage(imageBuffer: Buffer, pageNum: number): Promise<PageResult> {
  // 1. Tesseract first (fast, free)
  const tesseract = await runTesseract(imageBuffer, "hrv+eng")

  // 2. Check if vision fallback needed
  const needsVision = tesseract.confidence < 70 || isGarbageText(tesseract.text)

  if (!needsVision) {
    return { pageNum, text: tesseract.text, confidence: tesseract.confidence, method: "tesseract" }
  }

  // 3. Vision fallback
  try {
    const vision = await runVisionOcr(imageBuffer)
    if (vision.confidence > tesseract.confidence) {
      return { pageNum, text: vision.text, confidence: vision.confidence, method: "vision" }
    }
  } catch {}

  // 4. Keep tesseract result if vision fails
  return { pageNum, text: tesseract.text, confidence: tesseract.confidence, method: "tesseract" }
}
```

### 3.4 Thresholds

| Threshold         | Value                | Purpose                 |
| ----------------- | -------------------- | ----------------------- |
| Scanned detection | < 50 chars/page      | Classify as PDF_SCANNED |
| Tesseract accept  | >= 70% confidence    | Skip vision fallback    |
| Garbage text      | > 20% non-letters    | Trigger vision fallback |
| Manual review     | < 50% avg confidence | Flag for human review   |

---

## 4. Docker/Infrastructure

### 4.1 Dockerfile.worker Updates

```dockerfile
FROM node:22-alpine AS base

# ... build stage unchanged ...

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# ========== OCR DEPENDENCIES ==========
RUN apk add --no-cache \
    tesseract-ocr \
    tesseract-ocr-data-hrv \
    tesseract-ocr-data-eng \
    poppler-utils \
    ghostscript
# ======================================

# ... rest unchanged ...
```

### 4.2 New Environment Variables

```yaml
# docker-compose.workers.yml
OLLAMA_VISION_MODEL=llama3.2-vision # Vision fallback model
```

### 4.3 New Worker Service

```yaml
worker-ocr:
  build:
    context: .
    dockerfile: Dockerfile.worker
  container_name: fiskai-worker-ocr
  restart: unless-stopped
  command: ["npx", "tsx", "src/lib/regulatory-truth/workers/ocr.worker.ts"]
  environment:
    - NODE_ENV=production
    - REDIS_URL=redis://fiskai-redis:6379
    - DATABASE_URL=${DATABASE_URL}
    - OLLAMA_ENDPOINT=${OLLAMA_ENDPOINT}
    - OLLAMA_API_KEY=${OLLAMA_API_KEY}
    - OLLAMA_VISION_MODEL=${OLLAMA_VISION_MODEL:-llama3.2-vision}
    - WORKER_TYPE=ocr
    - WORKER_CONCURRENCY=1
  depends_on:
    redis:
      condition: service_healthy
  networks:
    - default
    - coolify
```

---

## 5. Queue/Worker Integration

### 5.1 New Queue

```typescript
// src/lib/regulatory-truth/workers/queues.ts
export const ocrQueue = new Queue("ocr", { connection, prefix: "fiskai" })
```

### 5.2 OCR Worker

```typescript
// src/lib/regulatory-truth/workers/ocr.worker.ts
async function processOcrJob(job: Job<OcrJobData>): Promise<JobResult> {
  const { evidenceId, runId } = job.data

  // 1. Get evidence
  const evidence = await db.evidence.findUnique({ where: { id: evidenceId } })
  if (!evidence || evidence.contentClass !== "PDF_SCANNED") {
    return { success: false, error: "Invalid evidence for OCR" }
  }

  // 2. Run OCR
  const pdfBuffer = Buffer.from(evidence.rawContent, "base64")
  const ocrResult = await processScannedPdf(pdfBuffer)

  // 3. Create artifact
  const artifact = await db.evidenceArtifact.create({
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

  // 4. Update evidence
  await db.evidence.update({
    where: { id: evidenceId },
    data: {
      primaryTextArtifactId: artifact.id,
      ocrMetadata: {
        method: ocrResult.method,
        language: "hrv",
        pages: ocrResult.pages.length,
        avgConfidence: ocrResult.avgConfidence,
        processingMs: ocrResult.processingMs,
        failedPages: ocrResult.failedPages,
        engineVersion: "tesseract 5.x",
      },
    },
  })

  // 5. Queue for extraction
  await extractQueue.add("extract", { evidenceId, runId })

  return { success: true, data: { pages: ocrResult.pages.length } }
}
```

### 5.3 Continuous Drainer Update

Add Stage 1.5 to drain pending OCR:

```typescript
async function drainPendingOcr(): Promise<number> {
  const pending = await db.evidence.findMany({
    where: {
      contentClass: "PDF_SCANNED",
      primaryTextArtifactId: null,
      NOT: { ocrMetadata: { path: ["error"], not: Prisma.DbNull } },
    },
    select: { id: true },
    take: 10,
  })

  if (pending.length === 0) return 0

  await ocrQueue.addBulk(
    pending.map((e) => ({ name: "ocr", data: { evidenceId: e.id, runId: `drain-${Date.now()}` } }))
  )

  return pending.length
}
```

---

## 6. Extractor Integration

### 6.1 Content Provider

```typescript
// src/lib/regulatory-truth/utils/content-provider.ts
export async function getExtractableContent(evidenceId: string): Promise<ExtractableContent> {
  const evidence = await db.evidence.findUnique({
    where: { id: evidenceId },
    include: { artifacts: { orderBy: { createdAt: "desc" } } },
  })

  // 1. Use primaryTextArtifact if set
  if (evidence.primaryTextArtifactId) {
    const artifact = evidence.artifacts.find((a) => a.id === evidence.primaryTextArtifactId)
    if (artifact) return { text: artifact.content, source: "artifact", artifactKind: artifact.kind }
  }

  // 2. Fallback priority: OCR_TEXT > PDF_TEXT > rawContent
  for (const kind of ["OCR_TEXT", "PDF_TEXT"]) {
    const artifact = evidence.artifacts.find((a) => a.kind === kind)
    if (artifact) return { text: artifact.content, source: "artifact", artifactKind: kind }
  }

  return { text: evidence.rawContent, source: "raw" }
}

export async function isReadyForExtraction(evidenceId: string): Promise<boolean> {
  const evidence = await db.evidence.findUnique({
    where: { id: evidenceId },
    include: { artifacts: true },
  })

  if (evidence.contentClass === "PDF_SCANNED") {
    return evidence.artifacts.some((a) => a.kind === "OCR_TEXT")
  }

  return true
}
```

### 6.2 Extractor Changes

```typescript
// src/lib/regulatory-truth/agents/extractor.ts
// CHANGE: Replace evidence.rawContent with content provider
const { text: content } = await getExtractableContent(evidenceId)
```

```typescript
// src/lib/regulatory-truth/workers/extractor.worker.ts
// CHANGE: Add readiness check
if (!(await isReadyForExtraction(evidenceId))) {
  await extractQueue.add("extract", { evidenceId, runId }, { delay: 30000 })
  return { success: true, data: { requeued: true } }
}
```

---

## 7. New Files Summary

| File                        | Purpose                                         | Lines |
| --------------------------- | ----------------------------------------------- | ----- |
| `prisma/schema.prisma`      | Add contentClass, ocrMetadata, EvidenceArtifact | ~25   |
| `utils/ocr-processor.ts`    | Main OCR pipeline                               | ~120  |
| `utils/tesseract.ts`        | Tesseract CLI wrapper                           | ~60   |
| `utils/pdf-renderer.ts`     | PDF to images (poppler)                         | ~50   |
| `utils/vision-ocr.ts`       | Vision model fallback                           | ~70   |
| `utils/content-provider.ts` | Artifact-aware content getter                   | ~60   |
| `workers/ocr.worker.ts`     | OCR queue processor                             | ~80   |
| `workers/queues.ts`         | Add ocrQueue                                    | ~2    |

**Total new code:** ~470 lines
**Modified code:** ~15 lines (extractor + drainer)

---

## 8. Migration Plan

### 8.1 Database Migration

```bash
npx prisma migrate dev --name add_ocr_support
```

### 8.2 Backfill Existing Failed PDFs

```sql
-- Mark existing failed scanned PDFs for reprocessing
UPDATE "DiscoveredItem"
SET status = 'PENDING', "retryCount" = 0, "errorMessage" = NULL
WHERE status = 'FAILED'
  AND "errorMessage" = 'No text extracted from pdf file';
```

### 8.3 Deployment Order

1. Apply schema migration
2. Build new Docker image with Tesseract
3. Deploy OCR worker
4. Update continuous-drainer with OCR stage
5. Reset failed PDFs for reprocessing

---

## 9. Monitoring

### 9.1 Queue Status Update

```typescript
// scripts/queue-status.ts
const QUEUES = [
  "sentinel",
  "extract",
  "ocr",
  "compose",
  "review",
  "arbiter",
  "release",
  "scheduled",
]
```

### 9.2 OCR Metrics

Track in monitoring dashboard:

- OCR jobs processed/failed
- Average confidence by source domain
- Vision fallback rate
- Processing time per page
- Manual review queue size

---

## 10. Acceptance Criteria

- [ ] 87 scanned PDFs process successfully
- [ ] OCR text stored in EvidenceArtifact, not Evidence.rawContent
- [ ] Extractor works unchanged via content provider
- [ ] Vision fallback triggers for low-confidence pages
- [ ] ocrMetadata contains confidence, timing, method
- [ ] Failed pages flagged for manual review
- [ ] No regression on existing HTML/JSON/text-PDF processing
