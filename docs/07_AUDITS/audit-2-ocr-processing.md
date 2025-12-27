# AUDIT 2: OCR (Text Extraction) Processing

**Audit Date:** 2025-12-27
**Auditor:** Claude (Automated Audit)
**Scope:** OCR processing stage of the Regulatory Truth system

---

## Executive Summary

This audit validates the OCR processing stage that extracts text from scanned PDFs. The audit was conducted through static code analysis of the OCR pipeline implementation.

**Overall Assessment: PASS** (with database validation pending)

---

## 1. Architecture Overview

### Components Analyzed

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/regulatory-truth/workers/ocr.worker.ts` | BullMQ worker for OCR jobs | ✓ Reviewed |
| `src/lib/regulatory-truth/utils/ocr-processor.ts` | Main OCR pipeline orchestrator | ✓ Reviewed |
| `src/lib/regulatory-truth/utils/tesseract.ts` | Tesseract CLI wrapper | ✓ Reviewed |
| `src/lib/regulatory-truth/utils/vision-ocr.ts` | Vision model fallback | ✓ Reviewed |
| `src/lib/regulatory-truth/utils/pdf-renderer.ts` | PDF to image conversion | ✓ Reviewed |
| `src/lib/regulatory-truth/agents/sentinel.ts` | PDF classification (PDF_TEXT vs PDF_SCANNED) | ✓ Reviewed |

### Data Flow

```
PDF_SCANNED Evidence
       │
       ▼
   OCR Queue (BullMQ)
       │
       ▼
   OCR Worker
       │
       ▼
   pdf-renderer.ts (pdftoppm @ 300 DPI)
       │
       ▼
   Per-page processing
       │
       ├─► Tesseract (hrv+eng)
       │       │
       │       ▼
       │   Confidence < 70% OR garbage text?
       │       │
       │       ▼ (yes)
       └─► Vision fallback (llama3.2-vision)
       │
       ▼
   EvidenceArtifact (kind: OCR_TEXT)
       │
       ▼
   Extract Queue
```

---

## 2. Detailed Findings

### 2.1 OCR Queue Configuration

**Location:** `src/lib/regulatory-truth/workers/queues.ts:31`

```typescript
export const ocrQueue = createQueue("ocr", { max: 2, duration: 60000 })
```

| Setting | Value | Assessment |
|---------|-------|------------|
| Rate Limit | 2 jobs/minute | **PASS** - Prevents resource exhaustion |
| Retry Attempts | 3 | **PASS** - Standard retry policy |
| Backoff | Exponential (10s, 20s, 40s) | **PASS** - Good backoff strategy |
| Dead Letter Queue | Yes | **PASS** - Failed jobs preserved for inspection |

**Worker Concurrency:** `1` (hardcoded in `ocr.worker.ts:155`)
**Assessment:** **PASS** - OCR is CPU-intensive, single concurrency prevents overload.

---

### 2.2 PDF Classification (Sentinel)

**Location:** `src/lib/regulatory-truth/agents/sentinel.ts:628-681` and `ocr-processor.ts:126-130`

**Classification Logic:**
```typescript
function isScannedPdf(extractedText: string, pageCount: number): boolean {
  const textLength = extractedText?.trim().length || 0
  const charsPerPage = textLength / Math.max(pageCount, 1)
  return charsPerPage < 50  // Less than 50 chars/page = scanned
}
```

| Check | Result | Notes |
|-------|--------|-------|
| Text vs Scanned differentiation | **PASS** | 50 chars/page threshold is reasonable |
| Content class assignment | **PASS** | PDF_TEXT and PDF_SCANNED correctly set |
| Queue routing | **PASS** | PDF_SCANNED → OCR queue, PDF_TEXT → Extract queue |

---

### 2.3 Artifact Generation

**Location:** `src/lib/regulatory-truth/workers/ocr.worker.ts:74-87`

```typescript
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
```

| Check | Result | Notes |
|-------|--------|-------|
| OCR_TEXT artifact creation | **PASS** | Artifact created with extracted text |
| Content hash | **PASS** | Hash computed for deduplication |
| Page-level metadata | **PASS** | Per-page confidence and method stored in `pageMap` |
| primaryTextArtifactId update | **PASS** | Evidence linked to canonical text artifact |
| OCR_HOCR (coordinates) | **WARN** | Not implemented - tables may lose structure |

**Recommendation:** Consider adding OCR_HOCR artifacts with coordinate data for better table extraction.

---

### 2.4 Text Quality Processing

**Location:** `src/lib/regulatory-truth/utils/ocr-processor.ts`

#### Thresholds

| Threshold | Value | Purpose |
|-----------|-------|---------|
| TESSERACT_CONFIDENCE_THRESHOLD | 70% | Trigger Vision fallback |
| GARBAGE_TEXT_THRESHOLD | 0.2 | Detect garbage output (80% non-letters) |
| MANUAL_REVIEW_THRESHOLD | 50% | Flag for human review |

**Garbage Text Detection:**
```typescript
function isGarbageText(text: string): boolean {
  if (!text || text.length < 20) return true
  const letters = text.match(/[\p{L}]/gu) || []
  return letters.length / text.length < 1 - GARBAGE_TEXT_THRESHOLD
}
```

| Check | Result | Notes |
|-------|--------|-------|
| Minimum text length check | **PASS** | <20 chars treated as garbage |
| Letter ratio validation | **PASS** | Unicode letter matching (`\p{L}`) |
| Manual review flagging | **PASS** | needsManualReview set when avgConfidence < 50% |

---

### 2.5 Croatian Diacritics Support

**Location:** `src/lib/regulatory-truth/utils/tesseract.ts:37` and `vision-ocr.ts:19`

**Tesseract Language:**
```typescript
await runTesseract(imageBuffer, "hrv+eng")
```

**Vision Prompt:**
```
Keep Croatian characters exactly as shown (č, ć, đ, š, ž, Č, Ć, Đ, Š, Ž)
```

| Check | Result | Notes |
|-------|--------|-------|
| Croatian language model | **PASS** | `hrv+eng` language pack used |
| Vision prompt for diacritics | **PASS** | Explicit instruction to preserve č, ć, đ, š, ž |
| Unicode handling in TSV parsing | **PASS** | UTF-8 encoding preserved |

---

### 2.6 Fallback Handling (Tesseract → Vision)

**Location:** `src/lib/regulatory-truth/utils/ocr-processor.ts:39-83`

```typescript
const needsVision =
  tesseractResult.confidence < TESSERACT_CONFIDENCE_THRESHOLD ||
  isGarbageText(tesseractResult.text)

if (!needsVision) {
  return { ...tesseractResult }  // Tesseract OK
}

try {
  const visionResult = await runVisionOcr(imageBuffer)
  if (visionResult.confidence > tesseractResult.confidence) {
    return { ...visionResult }  // Vision better
  }
} catch (error) {
  console.warn(`Vision failed, using Tesseract anyway`)
}

return { ...tesseractResult }  // Fallback to Tesseract
```

| Check | Result | Notes |
|-------|--------|-------|
| Confidence-based fallback trigger | **PASS** | <70% confidence triggers Vision |
| Garbage text fallback trigger | **PASS** | Garbage output triggers Vision |
| Vision failure handling | **PASS** | Falls back to Tesseract on Vision error |
| Best-result selection | **PASS** | Higher confidence result used |
| Maximum retry limit | **PASS** | Worker has 3 retries with exponential backoff |

**Vision Model Configuration:**
```typescript
const VISION_MODEL = process.env.OLLAMA_VISION_MODEL || "llama3.2-vision"
const OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT || "http://localhost:11434"
```

| Check | Result | Notes |
|-------|--------|-------|
| Configurable model | **PASS** | Environment variable override |
| Configurable endpoint | **PASS** | Self-hosted Ollama support |
| Vision confidence estimation | **PASS** | Heuristic based on unclear markers and garbage ratio |

---

### 2.7 Performance & Resource Management

**Location:** `src/lib/regulatory-truth/utils/pdf-renderer.ts`

**PDF Rendering:**
```typescript
await execAsync(`pdftoppm -png -r ${dpi} "${tempPdf}" "${tempDir}/page"`)
```

| Check | Result | Notes |
|-------|--------|-------|
| DPI setting | 300 DPI | **PASS** - Standard OCR quality |
| Temp file cleanup | **PASS** | Files cleaned in finally block |
| Memory management | **WARN** | No explicit chunking for large PDFs |

**Concerns:**
- Large PDFs (>50 pages) are NOT chunked - all pages processed sequentially
- No memory limit enforcement during processing
- No explicit timeout per page

**Recommendations:**
1. Add page count limit or chunking for PDFs >50 pages
2. Consider streaming/chunked processing for memory efficiency
3. Add per-page timeout (e.g., 60s/page)

---

### 2.8 Error Handling & Logging

**Location:** `src/lib/regulatory-truth/workers/ocr.worker.ts:129-150`

```typescript
} catch (error) {
  jobsProcessed.inc({ worker: "ocr", status: "failed", queue: "ocr" })

  await db.evidence.update({
    where: { id: evidenceId },
    data: {
      ocrMetadata: {
        error: error instanceof Error ? error.message : String(error),
        needsManualReview: true,
      },
    },
  }).catch(() => {})

  return {
    success: false,
    duration: Date.now() - start,
    error: error instanceof Error ? error.message : String(error),
  }
}
```

| Check | Result | Notes |
|-------|--------|-------|
| Error stored in ocrMetadata | **PASS** | Errors preserved for debugging |
| Manual review flag | **PASS** | Failed OCR flagged for human review |
| Prometheus metrics | **PASS** | jobsProcessed and jobDuration tracked |
| Logging | **PASS** | Comprehensive console logging |

---

### 2.9 Queue-to-Extraction Handoff

**Location:** `src/lib/regulatory-truth/workers/ocr.worker.ts:107-108`

```typescript
// Queue for extraction (now has text artifact)
await extractQueue.add("extract", { evidenceId, runId })
```

| Check | Result | Notes |
|-------|--------|-------|
| Automatic extraction queue | **PASS** | Successful OCR queues for extraction |
| Run ID propagation | **PASS** | runId passed for tracing |
| Content provider integration | **PASS** | content-provider.ts checks for OCR_TEXT artifact |

---

## 3. Audit Checklist Summary

| Category | Check | Status |
|----------|-------|--------|
| **OCR Queue Health** | Queue configuration | ✅ PASS |
| | Rate limiting | ✅ PASS |
| | Dead letter queue | ✅ PASS |
| | Retry policy | ✅ PASS |
| **Artifact Generation** | OCR_TEXT creation | ✅ PASS |
| | Content hash | ✅ PASS |
| | Page-level metadata | ✅ PASS |
| | OCR_HOCR for tables | ⚠️ WARN (not implemented) |
| **Text Quality** | Confidence scoring | ✅ PASS |
| | Garbage detection | ✅ PASS |
| | Croatian diacritics | ✅ PASS |
| | Manual review flagging | ✅ PASS |
| **Fallback Handling** | Vision API fallback | ✅ PASS |
| | Vision failure recovery | ✅ PASS |
| | Best-result selection | ✅ PASS |
| **Performance** | DPI quality | ✅ PASS |
| | Temp file cleanup | ✅ PASS |
| | Large PDF chunking | ⚠️ WARN (not implemented) |
| | Memory bounds | ⚠️ WARN (not enforced) |
| **Error Handling** | Error persistence | ✅ PASS |
| | Metrics collection | ✅ PASS |
| | Logging | ✅ PASS |

---

## 4. Database Validation (Pending)

**Note:** Database queries could not be executed in this environment due to missing DATABASE_URL.

An audit script has been created at `scripts/audit-ocr.ts` to run the following checks when database access is available:

```sql
-- 1. Pending OCR items
SELECT COUNT(*) FROM "Evidence"
WHERE "contentClass" = 'PDF_SCANNED' AND "primaryTextArtifactId" IS NULL;

-- 2. Artifact counts by kind
SELECT kind, COUNT(*) FROM "EvidenceArtifact" GROUP BY kind;

-- 3. Failed OCR (errors in metadata)
SELECT id, "ocrMetadata"->'error' FROM "Evidence"
WHERE "contentClass" = 'PDF_SCANNED' AND "ocrMetadata"->>'error' IS NOT NULL;

-- 4. Processing time metrics
SELECT AVG(("ocrMetadata"->>'processingMs')::int) FROM "Evidence"
WHERE "ocrMetadata"->>'processingMs' IS NOT NULL;
```

**To run the audit script:**
```bash
npx tsx scripts/audit-ocr.ts
```

---

## 5. Recommendations

### High Priority

1. **Add OCR_HOCR artifacts** for table extraction support
   - Store bounding box coordinates from Tesseract TSV output
   - Enable structured table parsing downstream

### Medium Priority

2. **Implement PDF chunking** for large documents
   - Process PDFs >50 pages in batches
   - Add memory monitoring during processing

3. **Add per-page timeout**
   - Limit individual page OCR to 60s
   - Prevent hung jobs from blocking queue

### Low Priority

4. **Vision model monitoring**
   - Track Vision API usage and costs
   - Add fallback when Ollama is unavailable

---

## 6. Files Created/Modified

| File | Action |
|------|--------|
| `scripts/audit-ocr.ts` | Created - Database audit script |
| `docs/07_AUDITS/audit-2-ocr-processing.md` | Created - This report |

---

## 7. Conclusion

The OCR processing implementation is **well-designed and production-ready**. Key strengths:

- ✅ Robust two-tier approach (Tesseract + Vision fallback)
- ✅ Proper Croatian language support
- ✅ Good error handling and observability
- ✅ Clean queue-based architecture

Areas for improvement are primarily around handling edge cases (very large PDFs, table extraction) rather than core functionality issues.

**Final Verdict: PASS**

---

*Audit completed by Claude (Opus 4.5) on 2025-12-27*
