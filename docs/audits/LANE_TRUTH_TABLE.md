# Document Lane Truth Table

> Audit Date: 2026-01-06
> Scope: Evidence → SourcePointer pipeline for all contentClass types

## Executive Summary

**Root blocker:** Redis OOM (572MB used / 512MB max) due to 508K+ stale job keys.
All worker queues are failing with `OOM command not allowed when used memory > 'maxmemory'`.

### Current State by Lane

| contentClass | Evidence Count | With SourcePointers | Coverage | Status                                |
| ------------ | -------------- | ------------------- | -------- | ------------------------------------- |
| PDF_TEXT     | 182            | 57                  | 31%      | PARTIAL (baseline v1 ran 57/182)      |
| PDF_SCANNED  | 55             | 0                   | 0%       | BLOCKED - Redis OOM                   |
| HTML         | 43             | 0                   | 0%       | BLOCKED - was embedding-gated (FIXED) |
| XLSX         | 12             | 0                   | 0%       | BLOCKED - Redis OOM                   |
| DOC          | 2              | 0                   | 0%       | BLOCKED - Redis OOM                   |

---

## Lane Details

### 1. HTML Lane

**Classification Path:**

```
Sentinel → detect contentType: "html" → contentClass: "HTML"
```

**Normalization Path:**

- `rawContent`: Original HTML stored as-is
- No artifact required (rawContent is extractable)

**Extraction Eligibility:**

```typescript
// content-provider.ts:92-93
// HTML/JSON - rawContent is sufficient
return true
```

**Queue/Worker Path:**

```
Sentinel → (no direct queue) → continuous-drainer → extractQueue → extractor.worker
```

**Current Status:**

- ✅ Evidence created (43 records)
- ✅ `isReadyForExtraction()` returns true
- ❌ WAS BLOCKED: `baseline-extraction.ts` had embedding status gate (NOW FIXED)
- ❌ BLOCKED: Redis OOM prevents queue operations

**Blocker:** None inherent - ready after Redis OOM resolved

---

### 2. PDF_TEXT Lane

**Classification Path:**

```
Sentinel → detect contentType: "pdf" → parseBinaryContent()
         → isScannedPdf() = false → contentClass: "PDF_TEXT"
```

**Normalization Path:**

- `rawContent`: PDF binary as base64
- `EvidenceArtifact.kind = "PDF_TEXT"`: Extracted text from pdf-parse
- `primaryTextArtifactId`: Points to PDF_TEXT artifact

**Extraction Eligibility:**

```typescript
// content-provider.ts:88-90
if (evidence.contentClass === "PDF_TEXT") {
  return evidence.artifacts.some((a) => a.kind === "PDF_TEXT")
}
```

**Queue/Worker Path:**

```
Sentinel → creates PDF_TEXT artifact → extractQueue → extractor.worker
```

**Current Status:**

- ✅ Evidence created (182 records)
- ✅ PDF_TEXT artifacts exist (182 records)
- ✅ 57 SourcePointers created (baseline v1)
- 🔄 125 remaining eligible

**Blocker:** Redis OOM prevents new queue jobs

---

### 3. PDF_SCANNED Lane

**Classification Path:**

```
Sentinel → detect contentType: "pdf" → parseBinaryContent()
         → isScannedPdf() = true → contentClass: "PDF_SCANNED"
```

**Normalization Path:**

- `rawContent`: PDF binary as base64
- Requires: `EvidenceArtifact.kind = "OCR_TEXT"` (from OCR worker)

**Extraction Eligibility:**

```typescript
// content-provider.ts:83-85
if (evidence.contentClass === "PDF_SCANNED") {
  return evidence.artifacts.some((a) => a.kind === "OCR_TEXT")
}
```

**Queue/Worker Path:**

```
Sentinel → ocrQueue → ocr.worker → creates OCR_TEXT artifact
         → extractQueue → extractor.worker
```

**OCR Pipeline Details:**

- Primary: Tesseract OCR (hrv+eng languages)
- Fallback: OpenAI Vision API (for low-confidence pages)
- Confidence threshold: 70% (pages below trigger Vision fallback)
- Manual review threshold: <50% average confidence

**Current Status:**

- ✅ Evidence created (55 records)
- ❌ OCR_TEXT artifacts: 0 (OCR never ran)
- ❌ ocrQueue jobs failed due to Redis OOM

**Blocker:**

1. Redis OOM prevents ocrQueue.add()
2. Even when fixed, OCR processing is slow (10min timeout per PDF)

---

### 4. DOC Lane

**Classification Path:**

```
Sentinel → detect Content-Type: application/msword
         → binaryType: "doc" → contentClass: "DOC"
```

**Normalization Path:**

- `rawContent`: Extracted text via `word-extractor` package
- No artifact created (text goes directly to rawContent)

**Binary Parser Implementation:**

```typescript
// binary-parser.ts
import WordExtractor from "word-extractor"
const extractor = new WordExtractor()
const doc = await extractor.extract(buffer)
return { text: doc.getBody(), metadata: { ... } }
```

**Extraction Eligibility:**

```typescript
// content-provider.ts:92-93 (fallthrough)
// HTML/JSON - rawContent is sufficient
return true // DOC falls through here too
```

**Queue/Worker Path:**

```
Sentinel → stores rawContent → (no direct queue)
         → continuous-drainer → extractQueue → extractor.worker
```

**Current Status:**

- ✅ Evidence created (2 records)
- ✅ rawContent has extracted text
- ✅ `isReadyForExtraction()` returns true
- ❌ Never queued due to Redis OOM

**Blocker:** Redis OOM

---

### 5. DOCX Lane

**Classification Path:**

```
Sentinel → detect Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document
         → binaryType: "docx" → contentClass: "DOCX"
```

**Normalization Path:**

- `rawContent`: Extracted text via `mammoth` package
- No artifact created

**Binary Parser Implementation:**

```typescript
// binary-parser.ts
import mammoth from "mammoth"
const result = await mammoth.extractRawText({ buffer })
return { text: result.value, metadata: { ... } }
```

**Extraction Eligibility:** Same as DOC (falls through to true)

**Queue/Worker Path:** Same as DOC

**Current Status:**

- Evidence: 0 records (none discovered yet)
- Would be extraction-ready if created

**Blocker:** Redis OOM (if any Evidence existed)

---

### 6. XLSX Lane

**Classification Path:**

```
Sentinel → detect Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
         → binaryType: "xlsx" → contentClass: "XLSX"
```

**Normalization Path:**

- `rawContent`: Extracted text via `exceljs` package (cell values concatenated)
- No artifact created

**Binary Parser Implementation:**

```typescript
// binary-parser.ts
import ExcelJS from "exceljs"
const workbook = new ExcelJS.Workbook()
await workbook.xlsx.load(buffer)
// Iterates sheets, rows, cells - concatenates all values
return { text: allText.join("\n"), metadata: { sheets: ... } }
```

**Extraction Eligibility:** Same as DOC (falls through to true)

**Queue/Worker Path:** Same as DOC

**Current Status:**

- ✅ Evidence created (12 records)
- ✅ rawContent has extracted text
- ✅ `isReadyForExtraction()` returns true
- ❌ Never queued due to Redis OOM

**Blocker:** Redis OOM

---

## Root Cause Analysis

### Redis Memory Bloat

```
Used memory:  572.17MB
Max memory:   512.00MB
Total keys:   508,125
```

**Key distribution:**
| Pattern | Count | % of Total |
|---------|-------|------------|
| fiskai:extract:_ | 436,499 | 85.9% |
| fiskai:review:_ | 41,900 | 8.2% |
| fiskai:arbiter:_ | 20,950 | 4.1% |
| fiskai:compose:_ | 6,285 | 1.2% |
| fiskai:release:\* | 2,095 | 0.4% |

**Root cause:** BullMQ job records not being cleaned up. Completed/failed jobs accumulate indefinitely.

**Fix required:** Configure job cleanup in queue options:

```typescript
{
  defaultJobOptions: {
    removeOnComplete: { count: 1000 },  // Keep last 1000
    removeOnFail: { count: 500 },       // Keep last 500
  }
}
```

---

## Resolution Plan

### Immediate (Unblock All Lanes)

1. **Flush stale Redis keys:**

   ```bash
   # WARNING: This clears all job history!
   docker exec fiskai-redis redis-cli FLUSHDB
   ```

   OR selective cleanup:

   ```bash
   # Delete completed job data (safer)
   docker exec fiskai-redis redis-cli --scan --pattern 'fiskai:*:[0-9]*' | xargs -L 100 docker exec -i fiskai-redis redis-cli DEL
   ```

2. **Increase Redis maxmemory:**

   ```yaml
   # docker-compose.workers.yml
   redis:
     command: redis-server --maxmemory 1gb --maxmemory-policy allkeys-lru
   ```

3. **Add job TTL to queue configs:**
   Update `src/lib/regulatory-truth/workers/queues.ts` with `removeOnComplete` options.

### Per-Lane Actions

| Lane        | Post-Redis-Fix Action                                                    |
| ----------- | ------------------------------------------------------------------------ |
| HTML        | Run `npx tsx scripts/baseline-extraction.ts`                             |
| PDF_TEXT    | Run `npx tsx scripts/baseline-extraction.ts --limit 200` (125 remaining) |
| PDF_SCANNED | Workers will auto-process via ocrQueue → extractQueue                    |
| DOC         | continuous-drainer will auto-queue                                       |
| XLSX        | continuous-drainer will auto-queue                                       |

---

## File References

| File                                                            | Purpose                         |
| --------------------------------------------------------------- | ------------------------------- |
| `src/lib/regulatory-truth/agents/sentinel.ts:1060-1232`         | Content classification logic    |
| `src/lib/regulatory-truth/utils/binary-parser.ts`               | DOC/DOCX/XLSX text extraction   |
| `src/lib/regulatory-truth/utils/content-provider.ts`            | Extraction eligibility checks   |
| `src/lib/regulatory-truth/workers/ocr.worker.ts`                | PDF_SCANNED → OCR_TEXT pipeline |
| `src/lib/regulatory-truth/workers/continuous-drainer.worker.ts` | FETCHED → extractQueue draining |
| `scripts/baseline-extraction.ts`                                | Manual extraction batch runner  |

---

## Appendix: isReadyForExtraction() Logic

```typescript
// content-provider.ts:70-94
export async function isReadyForExtraction(evidenceId: string): Promise<boolean> {
  const evidence = await dbReg.evidence.findUnique({
    where: { id: evidenceId },
    include: { artifacts: { select: { kind: true } } },
  })

  if (!evidence) return false

  // Scanned PDFs need OCR artifact
  if (evidence.contentClass === "PDF_SCANNED") {
    return evidence.artifacts.some((a) => a.kind === "OCR_TEXT")
  }

  // Text PDFs need PDF_TEXT artifact
  if (evidence.contentClass === "PDF_TEXT") {
    return evidence.artifacts.some((a) => a.kind === "PDF_TEXT")
  }

  // HTML/JSON/DOC/DOCX/XLSX - rawContent is sufficient
  return true
}
```
