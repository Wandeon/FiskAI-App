# Appendix: Extractor Worker - Stakeholder Audit

> Version: 1.0.0
> Last Updated: 2026-01-14
> Status: Comprehensive Stakeholder-Grade Audit

---

## Table of Contents

1. [Overview](#1-overview)
2. [Technical Implementation](#2-technical-implementation)
3. [Inputs](#3-inputs)
4. [Outputs](#4-outputs)
5. [Dependencies](#5-dependencies)
6. [Prerequisites](#6-prerequisites)
7. [Triggers](#7-triggers)
8. [Error Handling](#8-error-handling)
9. [Guardrails and Safety](#9-guardrails-and-safety)
10. [Monitoring and Observability](#10-monitoring-and-observability)
11. [Configuration](#11-configuration)
12. [Known Issues and Limitations](#12-known-issues-and-limitations)
13. [Data Flow Diagram](#13-data-flow-diagram)
14. [Prompt Engineering](#14-prompt-engineering)
15. [Appendix A: Schema Definitions](#appendix-a-schema-definitions)
16. [Appendix B: Validation Rules](#appendix-b-validation-rules)

---

## 1. Overview

### 1.1 Purpose

The **Extractor Worker** is the LLM-powered core of fact extraction in the Regulatory Truth Layer. It processes evidence documents (HTML, PDF, XML, JSON) and extracts structured regulatory facts with precise citations and confidence scores.

The extractor serves as the bridge between raw regulatory content and actionable structured data that can inform compliance decisions.

### 1.2 Role in Layer B (Processing)

The Extractor Worker operates in **Layer B: 24/7 Processing** of the Regulatory Truth Layer:

```
Layer A: Daily Discovery
    Sentinel -> Evidence Records

Layer B: 24/7 Processing
    OCR Worker (if needed) -> [EXTRACTOR WORKER] -> Composer -> Reviewer -> Arbiter -> Releaser
                                      ^
                                      |
                              YOU ARE HERE
```

**Position in Pipeline:**

- **Upstream:** OCR Worker (for scanned PDFs), Sentinel (creates Evidence)
- **Downstream:** Composer (aggregates facts into rules), CandidateFact promotion workflow

### 1.3 What "Regulatory Facts" Means

A **regulatory fact** is a discrete, verifiable piece of information extracted from official regulatory sources. Each fact includes:

| Component           | Description          | Example                              |
| ------------------- | -------------------- | ------------------------------------ |
| **Domain**          | Regulatory area      | `pausalni`, `pdv`, `porez_dohodak`   |
| **Value Type**      | Data classification  | `currency_eur`, `percentage`, `date` |
| **Extracted Value** | The actual value     | `40000`, `0.25`, `2025-01-15`        |
| **Exact Quote**     | Verbatim source text | "prag od 40.000 EUR"                 |
| **Confidence**      | Extraction certainty | `0.95` (95% confident)               |
| **Legal Reference** | Law citation         | "Zakon o PDV-u (NN 73/13), cl. 38"   |

**Key Principle:** The extractor NEVER infers values. It only extracts what is explicitly stated character-for-character in the source content.

---

## 2. Technical Implementation

### 2.1 Entry Point

**File:** `src/lib/regulatory-truth/workers/extractor.worker.ts`

```typescript
// Worker initialization
const worker = createWorker<ExtractJobData>("extract", processExtractJob, {
  name: "extractor",
  concurrency: 2,
  lockDuration: 360000, // 6 minutes (exceeds 5 min agent timeout)
  stalledInterval: 60000, // Check for stalled jobs every 60s
})
```

### 2.2 Job Processing Flow

```
1. Receive Job (evidenceId, runId)
         |
         v
2. Check Readiness (isReadyForExtraction)
         |
    [Not Ready?] --> Re-queue with 30s delay
         |
         v
3. Get Evidence with Source Info
         |
         v
4. Rate Limit Check (llmLimiter)
         |
         v
5. Run Extractor Agent (runExtractor)
         |
         +-- Content Provider (get text)
         +-- Content Cleaner (remove noise)
         +-- LLM Call (via runner.ts)
         +-- Parse Response
         +-- Validate Extractions
         +-- Store CandidateFacts
         |
         v
6. Update AgentRun Outcome
         |
         v
7. Return Result (candidateFactIds)
```

### 2.3 LLM Integration (Ollama)

The extractor uses the agent runner infrastructure to make LLM calls:

**Configuration Resolution:**

```typescript
// Priority: OLLAMA_EXTRACT_* > OLLAMA_* > defaults
endpoint = OLLAMA_EXTRACT_ENDPOINT || OLLAMA_ENDPOINT || "https://ollama.com"
model = OLLAMA_EXTRACT_MODEL || OLLAMA_MODEL || "llama3.1"
apiKey = OLLAMA_EXTRACT_API_KEY || OLLAMA_API_KEY
```

**LLM Call Parameters:**

```typescript
{
  model: extractModel,
  messages: [
    { role: "system", content: systemPrompt + formatInstructions },
    { role: "user", content: input }
  ],
  stream: false,
  options: {
    temperature: 0.1,  // Low temperature for consistency
    num_predict: 16384 // Max tokens
  }
}
```

### 2.4 Prompt Engineering Approach

The extractor prompt is designed around these principles:

1. **NO-INFERENCE Rule:** Values must be explicitly stated in text
2. **Exact Quote Requirement:** Every extraction must include verbatim source text
3. **Confidence Calibration:** Clear thresholds for different certainty levels
4. **Domain Classification:** Standardized Croatian regulatory domains

**Prompt Template ID:** `rtl.extractor.v1`

See [Section 14: Prompt Engineering](#14-prompt-engineering) for the full prompt specification.

### 2.5 Response Parsing

The runner handles multiple LLM response formats:

````typescript
// 1. Extract JSON from response
let jsonContent = rawContent.trim()

// 2. Handle markdown code blocks
const codeBlockMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/)
if (codeBlockMatch) {
  jsonContent = codeBlockMatch[1].trim()
}

// 3. Find JSON object
const jsonMatch = jsonContent.match(/\{[\s\S]*\}/)

// 4. Parse and validate against schema
const parsed = JSON.parse(jsonContent)
const outputValidation = outputSchema.safeParse(parsed)
````

---

## 3. Inputs

### 3.1 Job Payload Schema

```typescript
interface ExtractJobData {
  evidenceId: string // UUID of Evidence record
  runId: string // Correlation ID for pipeline tracking
  parentJobId?: string // Optional parent job reference
}
```

### 3.2 Evidence Record Requirements

The Evidence record must exist and contain:

| Field          | Type     | Required | Description                       |
| -------------- | -------- | -------- | --------------------------------- |
| `id`           | UUID     | Yes      | Primary key                       |
| `url`          | String   | Yes      | Source URL                        |
| `rawContent`   | Text     | Yes      | Original fetched content          |
| `contentType`  | Enum     | Yes      | `html`, `pdf`, `xml`, `json`      |
| `contentClass` | Enum     | Yes      | `PDF_TEXT`, `PDF_SCANNED`, `HTML` |
| `source`       | Relation | No       | Source configuration              |
| `artifacts`    | Relation | No       | OCR/text artifacts                |

### 3.3 Text Artifact Requirements ("Not Ready" Condition)

The extractor checks readiness based on content class:

| Content Class | Ready When              | Artifact Required         |
| ------------- | ----------------------- | ------------------------- |
| `PDF_SCANNED` | Has `OCR_TEXT` artifact | Yes (from OCR worker)     |
| `PDF_TEXT`    | Has `PDF_TEXT` artifact | Yes (from PDF extraction) |
| `HTML`        | Always ready            | No (uses rawContent)      |
| `JSON`        | Always ready            | No (uses rawContent)      |

**Readiness Check Logic:**

```typescript
async function isReadyForExtraction(evidenceId: string): Promise<boolean> {
  if (evidence.contentClass === "PDF_SCANNED") {
    return evidence.artifacts.some((a) => a.kind === "OCR_TEXT")
  }
  if (evidence.contentClass === "PDF_TEXT") {
    return evidence.artifacts.some((a) => a.kind === "PDF_TEXT")
  }
  return true // HTML/JSON - rawContent is sufficient
}
```

### 3.4 Extractor Input Schema

```typescript
const ExtractorInputSchema = z.object({
  evidenceId: z.string(),
  content: z.string(),
  contentType: z.enum(["html", "pdf", "xml", "json", "json-ld", "doc", "docx", "xls", "xlsx"]),
  sourceUrl: z.string().url(),
})
```

---

## 4. Outputs

### 4.1 CandidateFact Records (Primary Output)

**PHASE-D Update:** The extractor now creates `CandidateFact` records (not `SourcePointer`).

```typescript
const candidateFact = await db.candidateFact.create({
  data: {
    suggestedDomain: extraction.domain,
    suggestedValueType: extraction.value_type,
    extractedValue: String(extraction.extracted_value),
    overallConfidence: extraction.confidence,
    valueConfidence: extraction.confidence,
    groundingQuotes: [
      {
        text: normalizedQuote,
        contextBefore: normalizedContextBefore || null,
        contextAfter: normalizedContextAfter || null,
        evidenceId: evidence.id,
        articleNumber: extraction.article_number || null,
        lawReference: extraction.law_reference || null,
      },
    ],
    suggestedConceptSlug: `${extraction.domain}-${extraction.value_type}`,
    legalReferenceRaw: extraction.law_reference || null,
    extractorNotes: extraction.extraction_notes || null,
    suggestedPillar: extraction.domain,
    status: "CAPTURED",
    promotionCandidate: extraction.confidence >= 0.9,
  },
})
```

### 4.2 CandidateFact Fields

| Field                | Type    | Description                                |
| -------------------- | ------- | ------------------------------------------ |
| `suggestedDomain`    | String  | Regulatory domain (pausalni, pdv, etc.)    |
| `suggestedValueType` | String  | Value classification                       |
| `extractedValue`     | String  | The extracted value                        |
| `overallConfidence`  | Float   | 0.0 - 1.0 confidence score                 |
| `groundingQuotes`    | JSON    | Array of quote objects with evidence links |
| `status`             | Enum    | `CAPTURED` (initial), later promoted       |
| `promotionCandidate` | Boolean | True if confidence >= 0.9                  |

### 4.3 ExtractionRejected Records (Dead Letter)

Failed extractions are stored for analysis:

```typescript
await dbReg.extractionRejected.create({
  data: {
    evidenceId: evidence.id,
    rejectionType:
      "INVALID_DOMAIN" |
      "OUT_OF_RANGE" |
      "INVALID_CURRENCY" |
      "INVALID_DATE" |
      "NO_QUOTE_MATCH" |
      "VALIDATION_FAILED",
    rawOutput: extraction, // Full LLM output for debugging
    errorDetails: "Description of why rejected",
  },
})
```

### 4.4 Extraction Rejection Types

| Type                | Cause                      | Example                                  |
| ------------------- | -------------------------- | ---------------------------------------- |
| `INVALID_DOMAIN`    | Domain not in DomainSchema | `"taxes"` instead of `"pdv"`             |
| `OUT_OF_RANGE`      | Value outside valid range  | Percentage > 100                         |
| `INVALID_CURRENCY`  | Currency amount invalid    | Negative amounts                         |
| `INVALID_DATE`      | Date format invalid        | `"31-01-2025"` instead of `"2025-01-31"` |
| `NO_QUOTE_MATCH`    | Quote not found in content | Hallucinated quote                       |
| `VALIDATION_FAILED` | General validation failure | Multiple issues                          |

### 4.5 CoverageReport Records

After extraction, a coverage report is generated:

```typescript
const coverageReport = await generateCoverageReport(evidenceId)
// Contains: claimsCount, processesCount, coverageScore, isComplete, etc.
```

### 4.6 ExtractorResult Return Type

```typescript
interface ExtractorResult {
  success: boolean
  output: ExtractorOutput | null
  sourcePointerIds: string[] // DEPRECATED: Always empty in PHASE-D
  candidateFactIds: string[] // Primary output
  agentRunId: string | null // For outcome updates
  error: string | null
}
```

---

## 5. Dependencies

### 5.1 Ollama LLM Service

| Setting  | Environment Variable      | Default              | Description  |
| -------- | ------------------------- | -------------------- | ------------ |
| Endpoint | `OLLAMA_EXTRACT_ENDPOINT` | `https://ollama.com` | API endpoint |
| Model    | `OLLAMA_EXTRACT_MODEL`    | `llama3.1`           | Model name   |
| API Key  | `OLLAMA_EXTRACT_API_KEY`  | None                 | Bearer token |

**Fallback Chain:**

1. `OLLAMA_EXTRACT_*` (specific extraction config)
2. `OLLAMA_*` (generic config)
3. Hardcoded defaults

### 5.2 Evidence with Text Artifacts

**Priority Order for Text Content:**

1. `primaryTextArtifactId` (explicit pointer from OCR worker)
2. `OCR_TEXT` artifact
3. `PDF_TEXT` artifact
4. `HTML_CLEANED` artifact
5. `rawContent` (fallback)

### 5.3 Database Access

**Regulatory Database (dbReg):**

- `evidence` - Source records
- `extractionRejected` - Dead letter storage

**Main Database (db):**

- `candidateFact` - Extracted facts
- `agentRun` - Execution tracking
- `agentResultCache` - LLM response cache
- `coverageReport` - Extraction metrics

### 5.4 Redis Queue

- Queue name: `extract`
- Rate limiter: `{ max: 10, duration: 60000 }` (10 jobs/minute)
- Default attempts: 3 with exponential backoff

---

## 6. Prerequisites

### 6.1 Evidence Must Have Text Content

For PDF evidence:

- `PDF_TEXT`: Must have `PDF_TEXT` artifact
- `PDF_SCANNED`: Must have `OCR_TEXT` artifact (from OCR worker)

For HTML/JSON:

- `rawContent` must be non-empty

### 6.2 Content Must Be Extractable

**Minimum Input Size:** 100 bytes (configurable per agent)

```typescript
const MIN_INPUT_BYTES: Record<string, number> = {
  EXTRACTOR: 100,
  // ...
}
```

Content below minimum size returns `CONTENT_LOW_QUALITY` outcome.

### 6.3 LLM Must Be Available

The runner includes timeout and retry logic:

```typescript
const AGENT_TIMEOUTS: Record<string, number> = {
  EXTRACTOR: 120000,  // 2 minutes
}

// Retry configuration
maxRetries: 3,
backoff: exponential (base: 1000ms, rate limit: 30000ms)
```

### 6.4 Domain Must Not Be Blocked

Test domains are blocked to prevent polluting production data:

```typescript
if (isBlockedDomain(urlDomain)) {
  return {
    success: false,
    error: `Blocked test domain: ${urlDomain}`,
  }
}
```

---

## 7. Triggers

### 7.1 Continuous Drainer

The primary trigger is the **continuous-drainer worker**, which:

1. Polls for Evidence records without CandidateFacts
2. Creates extract jobs for unprocessed evidence
3. Respects rate limits and priorities

### 7.2 Jobs Created After OCR Completes

For scanned PDFs, the OCR worker queues extraction:

```typescript
// In OCR worker (after creating OCR_TEXT artifact)
await extractQueue.add("extract", {
  evidenceId: evidence.id,
  runId: runId,
})
```

### 7.3 Manual Trigger Methods

**Via Script:**

```bash
npx tsx src/lib/regulatory-truth/scripts/run-extractor.ts [evidenceId]
```

**Via Batch Processing:**

```typescript
import { runExtractorBatch } from "../agents/extractor"
const result = await runExtractorBatch(20) // Process 20 unprocessed evidence
```

**Via API (if exposed):**

```bash
curl -X POST /api/admin/regulatory/extract \
  -d '{"evidenceId": "uuid-here"}'
```

---

## 8. Error Handling

### 8.1 LLM Failure Retries

**Retry Configuration:**

```typescript
{
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 10000,  // 10s, 20s, 40s
  }
}
```

**Rate Limit (429) Handling:**

```typescript
if (lastError?.message?.includes("429")) {
  const baseDelay = 30000 // 30 seconds
  const delay = Math.pow(2, attempt - 1) * baseDelay
  await new Promise((resolve) => setTimeout(resolve, delay))
}
```

### 8.2 Agent Timeout Handling

```typescript
const timeoutMs = 120000 // 2 minutes for EXTRACTOR

const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

// On abort:
if (lastError?.name === "AbortError") {
  outcome = "TIMEOUT"
  // Record failure, don't retry
}
```

### 8.3 "Not Ready" Requeueing Logic

```typescript
if (!ready) {
  console.log(`[extractor] Evidence ${evidenceId} not ready, requeueing...`)
  await extractQueue.add(
    "extract",
    { evidenceId, runId },
    { delay: 30000, jobId: `extract-${evidenceId}` } // 30s delay
  )
  return {
    success: true,
    data: { requeued: true, reason: "awaiting_artifact" },
  }
}
```

### 8.4 ExtractionRejected Tracking

All validation failures are recorded:

```typescript
// Domain validation failure
await dbReg.extractionRejected.create({
  data: {
    evidenceId: evidence.id,
    rejectionType: "INVALID_DOMAIN",
    rawOutput: extraction,
    errorDetails: `Domain '${extraction.domain}' is not in DomainSchema`,
  },
})

// Quote validation failure
await dbReg.extractionRejected.create({
  data: {
    evidenceId: evidence.id,
    rejectionType: "NO_QUOTE_MATCH",
    rawOutput: extraction,
    errorDetails: validation.errors.join("; "),
  },
})
```

### 8.5 Dead Letter Queue (DLQ)

Jobs that exhaust all retries are moved to DLQ:

```typescript
worker.on("failed", (job, err) => {
  if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
    void moveToDeadLetterQueue(job, err, queueName, options.name)
  }
})
```

**DLQ Alert Threshold:** 10 jobs (configurable via `DLQ_ALERT_THRESHOLD`)

---

## 9. Guardrails and Safety

### 9.1 Confidence Thresholds

**Minimum Confidence for Processing:** 0.5

```typescript
const MIN_CONFIDENCE = 0.5
if (confidence !== undefined && confidence < MIN_CONFIDENCE) {
  outcome = "LOW_CONFIDENCE"
  // Do not store extraction
}
```

**Promotion Candidate Threshold:** 0.9

```typescript
promotionCandidate: extraction.confidence >= 0.9
```

### 9.2 Hallucination Prevention

**NO-INFERENCE Rule in Prompt:**

```
CRITICAL RULE - NO INFERENCE ALLOWED:
You may ONLY extract values that are EXPLICITLY STATED in the text.
- If a value is not written character-for-character, DO NOT extract it
- If you would need to calculate, derive, or infer a value, DO NOT extract it
```

**Quote Verification:**

```typescript
// Verify value appears in quote
const quoteCheck = validateValueInQuote(extraction.extracted_value, extraction.exact_quote)
if (!quoteCheck.valid) {
  errors.push(quoteCheck.error!)
}

// Verify quote appears in content
const contentCheck = validateQuoteInEvidence(extraction.exact_quote, cleanedContent)
if (!contentCheck.valid) {
  errors.push(`Quote not found in cleaned content: ${contentCheck.error}`)
}
```

### 9.3 Source Verification

**Quote Normalization:**

```typescript
// Handle Croatian diacritics and smart quotes
const normalizedQuote = normalizeQuotes(extraction.exact_quote)
const normalizedContextBefore = extraction.context_before
  ? normalizeQuotes(extraction.context_before)
  : undefined
```

**Fuzzy Matching for OCR Tolerance:**

```typescript
const fuzzyResult = fuzzyContainsCroatian(exactQuote, value, 0.85)
if (fuzzyResult.found) {
  return { valid: true }
}
```

### 9.4 Rate Limiting to LLM

**Per-Process Limiter:**

```typescript
export const llmLimiter = new Bottleneck({
  reservoir: 5, // 5 concurrent calls
  reservoirRefreshAmount: 5,
  reservoirRefreshInterval: 60000, // Refill every minute
  maxConcurrent: 5,
  minTime: 1000, // Min 1s between calls
})
```

**Queue-Level Limiter:**

```typescript
export const extractQueue = createQueue("extract", {
  max: 10,
  duration: 60000, // 10 jobs per minute
})
```

### 9.5 Domain Validation

Only standard domains are accepted:

```typescript
const DomainSchema = z.enum([
  "pausalni",
  "pdv",
  "porez_dohodak",
  "doprinosi",
  "fiskalizacija",
  "rokovi",
  "obrasci",
  "exemptions",
  "references",
])

if (!isValidDomain(extraction.domain)) {
  rejectedExtractions.push({
    extraction,
    errors: [`Invalid domain: '${extraction.domain}' is not in DomainSchema`],
  })
}
```

### 9.6 Value Range Validation

**Domain-Specific Ranges:**

```typescript
const DOMAIN_RANGES: Record<string, DomainRanges> = {
  pdv: { percentageMax: 30 }, // VAT max 30%
  doprinosi: { percentageMax: 50 }, // Contributions max 50%
  porez_dohodak: { percentageMax: 60 }, // Income tax max 60%
  pausalni: { currencyMax: 1_000_000 }, // Pausalni threshold max 1M EUR
}
```

---

## 10. Monitoring and Observability

### 10.1 Prometheus Metrics

**Jobs Processed Counter:**

```typescript
jobsProcessed.inc({ worker: "extractor", status: "success", queue: "extract" })
jobsProcessed.inc({ worker: "extractor", status: "failed", queue: "extract" })
```

**Job Duration Histogram:**

```typescript
jobDuration.observe({ worker: "extractor", queue: "extract" }, duration / 1000)
```

**Metric Definitions:**

```typescript
// Jobs processed
export const jobsProcessed = new Counter({
  name: "worker_jobs_processed_total",
  help: "Total jobs processed by worker",
  labelNames: ["worker", "status", "queue"],
})

// Job duration
export const jobDuration = new Histogram({
  name: "worker_job_duration_seconds",
  help: "Job processing duration",
  labelNames: ["worker", "queue"],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
})
```

### 10.2 LLM Call Tracking

**AgentRun Records:**

```typescript
// Stored for every LLM call
await db.agentRun.create({
  data: {
    agentType: "EXTRACTOR",
    status: "RUNNING" | "COMPLETED" | "FAILED",
    outcome: "SUCCESS_APPLIED" | "PARSE_FAILED" | "TIMEOUT" | etc.,
    input: extractorInput,
    output: extractorOutput,
    durationMs: duration,
    tokensUsed: data.eval_count,
    inputChars: inputStr.length,
    inputBytes: Buffer.byteLength(inputStr, "utf8"),
    confidence: outputData.confidence,
    // ... correlation fields
  },
})
```

### 10.3 Token Usage

Tracked via `tokensUsed` field from Ollama response:

```typescript
const data = await response.json()
const tokensUsed = data.eval_count || null

// Stored in AgentRun and AgentResultCache
```

### 10.4 Extraction Statistics

**Console Logging:**

```typescript
console.log(
  `[extractor] Cleaned content for ${evidence.url}: ` +
    `${stats.originalLength} -> ${stats.cleanedLength} chars ` +
    `(${stats.reductionPercent}% reduction, ${stats.newsItemsFound} news items found)`
)

console.log(
  `[extractor] Coverage: ${(coverageReport.coverageScore * 100).toFixed(0)}% ` +
    `(${coverageReport.isComplete ? "complete" : "incomplete"})`
)
```

### 10.5 Rejection Tracking

```typescript
if (rejectedExtractions.length > 0) {
  console.warn(
    `[extractor] Rejected ${rejectedExtractions.length}/${result.output.extractions.length} extractions`
  )
}
```

---

## 11. Configuration

### 11.1 Environment Variables

| Variable                  | Required | Default              | Description             |
| ------------------------- | -------- | -------------------- | ----------------------- |
| `OLLAMA_EXTRACT_ENDPOINT` | No       | `https://ollama.com` | Ollama API endpoint     |
| `OLLAMA_EXTRACT_MODEL`    | No       | `llama3.1`           | Model for extraction    |
| `OLLAMA_EXTRACT_API_KEY`  | No       | None                 | API authentication      |
| `WORKER_CONCURRENCY`      | No       | `2`                  | Parallel job processing |
| `EXTRACTOR_TIMEOUT_MS`    | No       | `120000`             | Agent timeout (2 min)   |
| `DLQ_ALERT_THRESHOLD`     | No       | `10`                 | DLQ alert threshold     |

### 11.2 Concurrency Settings

**Worker Level:**

```typescript
const concurrency = options.concurrency ?? parseInt(process.env.WORKER_CONCURRENCY || "2")
```

**Queue Level:**

```typescript
export const extractQueue = createQueue("extract", {
  max: 10, // Max jobs per interval
  duration: 60000, // Interval (1 minute)
})
```

**LLM Limiter:**

```typescript
const llmLimiter = new Bottleneck({
  reservoir: 5,
  maxConcurrent: 5,
  minTime: 1000,
})
```

### 11.3 Docker Compose Configuration

```yaml
worker-extractor:
  <<: *worker-common
  container_name: fiskai-worker-extractor
  command: ["node", "dist/workers/lib/regulatory-truth/workers/extractor.worker.js"]
  environment:
    <<: *worker-env
    OLLAMA_EXTRACT_ENDPOINT: ${OLLAMA_EXTRACT_ENDPOINT}
    OLLAMA_EXTRACT_API_KEY: ${OLLAMA_EXTRACT_API_KEY}
    OLLAMA_EXTRACT_MODEL: ${OLLAMA_EXTRACT_MODEL}
    WORKER_TYPE: extractor
    WORKER_CONCURRENCY: 1
  deploy:
    resources:
      limits:
        memory: 1G
```

### 11.4 Timeout Configuration

```typescript
const AGENT_TIMEOUTS: Record<string, number> = {
  EXTRACTOR: 120000, // 2 minutes
}

// Lock duration must exceed agent timeout
const worker = createWorker({
  lockDuration: 360000, // 6 minutes
  stalledInterval: 60000, // Check every 60s
})
```

---

## 12. Known Issues and Limitations

### 12.1 "Not Ready" Evidence Handling

**Issue:** Evidence may arrive before OCR completes for scanned PDFs.

**Current Solution:** Re-queue with 30-second delay.

**Limitation:** Could cause job accumulation if OCR is consistently slow.

**Mitigation:**

- Job deduplication via `jobId: extract-${evidenceId}`
- Queue depth monitoring
- DLQ for persistent failures

### 12.2 Content Type Limitations

**Supported:**

- HTML (with cleaning)
- PDF (text layer or OCR)
- XML
- JSON / JSON-LD

**Not Yet Supported:**

- Audio/video transcripts
- Image-only documents (requires OCR pipeline)
- Password-protected documents

### 12.3 LLM Context Window Limits

**Model Constraint:** LLM context window is finite (varies by model).

**Impact:** Very large documents may be truncated.

**Current Handling:**

- Content cleaning removes navigation/footer noise
- No explicit chunking implemented yet

**Future Improvement:** Implement semantic chunking for large documents.

### 12.4 Croatian Language Specifics

**Challenges:**

- Diacritics (c, s, z, d) must be handled
- Date formats differ from ISO (DD.MM.YYYY vs YYYY-MM-DD)
- Number formatting (40.000 vs 40,000)

**Solutions:**

- Croatian-aware text normalization
- Multiple date format pattern matching
- Number format normalization in validation

### 12.5 JSON Content Extraction

**Issue:** JSON APIs (like HNB exchange rates) don't have "quotes" in the traditional sense.

**Solution:** Special handling to extract JSON key-value pairs as quotes:

```typescript
if (evidence.contentType === "json" || isJsonContent(content)) {
  const jsonQuote = extractQuoteFromJson(content, String(extraction.extracted_value))
  if (jsonQuote) {
    extraction.exact_quote = jsonQuote // e.g., '"srednji_tecaj": "7.5345"'
  }
}
```

### 12.6 Cache Invalidation

**Issue:** Cached LLM results may become stale if prompts change.

**Current Approach:** Cache key includes prompt hash, so prompt changes invalidate cache.

**Limitation:** Content changes in same evidence require manual cache clearing.

### 12.7 PHASE-D Migration

**Status:** SourcePointer creation has been removed.

**Impact:**

- Composer worker is temporarily disabled
- CandidateFacts are the new primary output
- Promotion workflow handles fact-to-rule conversion

**Migration Path:**

- CandidateFacts accumulate in CAPTURED status
- Promotion workflow reviews and promotes to RuleFacts
- Composer migration planned for future phase

---

## 13. Data Flow Diagram

```
                              +------------------------+
                              |    Regulatory Source   |
                              |  (Narodne novine, etc) |
                              +------------------------+
                                          |
                                          v
                              +------------------------+
                              |    Sentinel Worker     |
                              |   (Layer A: Discovery) |
                              +------------------------+
                                          |
                                          v
                              +------------------------+
                              |    Evidence Record     |
                              |   (rawContent stored)  |
                              +------------------------+
                                          |
                        +-----------------+-----------------+
                        |                                   |
              [PDF_SCANNED?]                          [HTML/JSON?]
                        |                                   |
                        v                                   |
              +------------------+                          |
              |   OCR Worker     |                          |
              | (Creates artifact)|                         |
              +------------------+                          |
                        |                                   |
                        +------------------+----------------+
                                           |
                                           v
                        +--------------------------------------+
                        |         EXTRACTOR WORKER             |
                        |                                      |
                        |  1. Check readiness                  |
                        |  2. Get text content                 |
                        |  3. Clean content (remove noise)     |
                        |  4. Build LLM input                  |
                        |  5. Call Ollama API                  |
                        |  6. Parse JSON response              |
                        |  7. Validate extractions             |
                        |  8. Store CandidateFacts             |
                        |  9. Generate coverage report         |
                        +--------------------------------------+
                                           |
                    +----------------------+----------------------+
                    |                      |                      |
                    v                      v                      v
          +------------------+   +------------------+   +------------------+
          | CandidateFact    |   | ExtractionReject |   | CoverageReport   |
          | (success output) |   | (dead letter)    |   | (metrics)        |
          +------------------+   +------------------+   +------------------+
                    |
                    v
          +------------------+
          | Promotion Flow   |
          | (to RuleFact)    |
          +------------------+
```

---

## 14. Prompt Engineering

### 14.1 System Prompt Structure

The EXTRACTOR prompt follows this structure:

1. **Role Definition** - Establishes agent identity
2. **Critical Rules** - NO-INFERENCE requirement
3. **Examples** - What TO DO and NOT to do
4. **Task Description** - Extraction requirements
5. **Domain Taxonomy** - Valid domain classifications
6. **Article Extraction** - Legal reference patterns
7. **Output Format** - JSON schema specification
8. **Confidence Scoring** - Calibration guidance
9. **Constraints** - Final guardrails

### 14.2 Full Prompt Template

```
ROLE: You are the Extractor Agent. You parse regulatory documents and
extract specific data points with precise citations.

INPUT: An Evidence record containing regulatory content.

CRITICAL RULE - NO INFERENCE ALLOWED:
You may ONLY extract values that are EXPLICITLY STATED in the text.
- If a value is not written character-for-character, DO NOT extract it
- If you would need to calculate, derive, or infer a value, DO NOT extract it
- If the text says "threshold" but doesn't give the number, DO NOT guess
- The exact_quote MUST contain the extracted_value (or its formatted equivalent)

EXAMPLES OF WHAT NOT TO DO:
- Text says "pausalni obrt" -> DO NOT infer the 40,000 EUR threshold
- Text says "standard VAT rate applies" -> DO NOT infer 25%
- Text says "deadline is end of month" -> DO NOT convert to specific date

EXAMPLES OF CORRECT EXTRACTION:
- Text says "stopa PDV-a iznosi 25%" -> Extract 25, percentage
- Text says "prag od 40.000 EUR" -> Extract 40000, currency_eur
- Text says "do 15. sijecnja 2025." -> Extract 2025-01-15, date

TASK:
1. Identify all regulatory values, thresholds, rates, and deadlines
2. For each, extract:
   - The exact value (number, date, percentage, etc.)
   - The exact quote containing this value (MUST include the value!)
   - Surrounding context (sentence before and after)
   - A CSS selector or XPath to locate this in the original
3. Classify each extraction by regulatory domain

DOMAINS:
- pausalni: Pausalni obrt thresholds, rates, deadlines
- pdv: VAT rates, thresholds, exemptions
- porez_dohodak: Income tax brackets, deductions
- doprinosi: Contribution rates (health, pension)
- fiskalizacija: Fiscalization rules, schemas
- rokovi: Deadlines, calendars
- obrasci: Form requirements, field specs
- exemptions: Exemptions and exceptions to rules
- references: Cross-references between laws

ARTICLE EXTRACTION:
When extracting values, also identify the legal source:
- article_number: Look for "clanak X", "cl. X", "Article X"
- paragraph_number: Look for "stavak X", "st. X", "(X)"
- law_reference: Look for "Zakon o...", "Pravilnik o...", "(NN XX/YY)"

OUTPUT FORMAT:
{
  "evidence_id": "ID of the input evidence",
  "extractions": [
    {
      "id": "unique extraction ID",
      "domain": "one of the domains above",
      "value_type": "currency" | "percentage" | "date" | "threshold" | "text",
      "extracted_value": "the value (e.g., 40000, 0.25, 2024-01-31)",
      "display_value": "human readable",
      "exact_quote": "the exact text from source CONTAINING THIS VALUE",
      "context_before": "previous sentence or paragraph",
      "context_after": "following sentence or paragraph",
      "selector": "CSS selector or XPath to locate",
      "article_number": "article number if identifiable",
      "paragraph_number": "paragraph number within article if identifiable",
      "law_reference": "full law citation if identifiable",
      "confidence": 0.0-1.0,
      "extraction_notes": "any ambiguity or concerns"
    }
  ],
  "extraction_metadata": {
    "total_extractions": number,
    "by_domain": { "domain": count },
    "low_confidence_count": number,
    "processing_notes": "any issues encountered"
  }
}

CONFIDENCE SCORING:
- 1.0: Explicit, unambiguous value in clear context
- 0.9: Clear value but context could apply to multiple scenarios
- 0.8: Value present but requires interpretation of scope
- <0.8: DO NOT EXTRACT - if you're not 80% sure, skip it

CONSTRAINTS:
- NEVER infer values not explicitly stated (CRITICAL!)
- Quote EXACTLY, preserve Croatian characters
- The exact_quote MUST contain the extracted_value
- If unsure, DO NOT extract - fewer correct extractions beats many wrong ones
- Flag any ambiguous language in extraction_notes
```

### 14.3 Response Format Instructions

Appended to system prompt:

````
RESPONSE FORMAT REQUIREMENTS:
1. Your response must be ONLY a valid JSON object
2. Start your response directly with { - no preamble text
3. Do NOT wrap in markdown code blocks (no ```json)
4. Do NOT include any thinking, explanation, or commentary
5. End your response with } - nothing after
6. If you cannot extract any data, return:
   {"extractions": [], "extraction_metadata": {"total_extractions": 0, "processing_notes": "No extractable data found"}}
````

### 14.4 User Message Format

```
INPUT:
{
  "evidenceId": "uuid-here",
  "content": "cleaned content text...",
  "contentType": "html",
  "sourceUrl": "https://example.gov.hr/..."
}

Please process this input and return the result in the specified JSON format.
```

---

## Appendix A: Schema Definitions

### A.1 ExtractorInputSchema

```typescript
export const ExtractorInputSchema = z.object({
  evidenceId: z.string(),
  content: z.string(),
  contentType: z.enum(["html", "pdf", "xml", "json", "json-ld", "doc", "docx", "xls", "xlsx"]),
  sourceUrl: z.string().url(),
})
```

### A.2 ExtractionItemSchema

```typescript
export const ExtractionItemSchema = z.object({
  id: z.string().nullish().default(""),
  domain: DomainSchema,
  value_type: ValueTypeSchema,
  extracted_value: z.union([z.string(), z.number()]),
  display_value: z.string().nullish().default(""),
  exact_quote: z.string().min(1),
  context_before: z.string().nullish().default(""),
  context_after: z.string().nullish().default(""),
  selector: z.string().nullish().default(""),
  article_number: z.string().nullish().default(null),
  paragraph_number: z.string().nullish().default(null),
  law_reference: z.string().nullish().default(null),
  confidence: ConfidenceSchema,
  extraction_notes: z.string().nullish().default(""),
})
```

### A.3 ExtractorOutputSchema

```typescript
export const ExtractorOutputSchema = z.object({
  evidence_id: z.string().optional(),
  extractions: z.array(ExtractionItemSchema).default([]),
  extraction_metadata: z
    .object({
      total_extractions: z.number().int().min(0).default(0),
      by_domain: z.record(z.string(), z.number()).default({}),
      low_confidence_count: z.number().int().min(0).default(0),
      processing_notes: z.string().default(""),
    })
    .default({
      total_extractions: 0,
      by_domain: {},
      low_confidence_count: 0,
      processing_notes: "",
    }),
})
```

### A.4 DomainSchema

```typescript
export const DomainSchema = z.enum([
  "pausalni",
  "pdv",
  "porez_dohodak",
  "doprinosi",
  "fiskalizacija",
  "rokovi",
  "obrasci",
  "exemptions",
  "references",
])
```

### A.5 ValueTypeSchema

```typescript
export const ValueTypeSchema = z.enum([
  "currency",
  "percentage",
  "date",
  "threshold",
  "text",
  "currency_hrk",
  "currency_eur",
  "count",
  "cross_reference",
  "exemption_condition",
])
```

---

## Appendix B: Validation Rules

### B.1 Percentage Validation

```typescript
export function validatePercentage(value: number, max: number = 100): ValidationResult {
  if (typeof value !== "number" || isNaN(value)) {
    return { valid: false, error: "Percentage must be a number" }
  }
  if (value < 0) {
    return { valid: false, error: "Percentage cannot be negative" }
  }
  if (value > max) {
    return { valid: false, error: `Percentage cannot exceed ${max}` }
  }
  return { valid: true }
}
```

### B.2 Currency Validation

```typescript
export function validateCurrency(
  value: number,
  currency: "eur" | "hrk",
  maxAmount?: number
): ValidationResult {
  const defaultMax = currency === "eur" ? 100_000_000_000 : 750_000_000_000
  const max = maxAmount !== undefined ? maxAmount : defaultMax

  if (typeof value !== "number" || isNaN(value)) {
    return { valid: false, error: "Currency amount must be a number" }
  }
  if (value < 0) {
    return { valid: false, error: "Currency amount cannot be negative" }
  }
  if (value > max) {
    return { valid: false, error: `Currency amount ${value} is unrealistic` }
  }
  return { valid: true }
}
```

### B.3 Date Validation

```typescript
export function validateDate(value: string): ValidationResult {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { valid: false, error: "Date must be ISO format YYYY-MM-DD" }
  }

  const date = new Date(value)
  if (isNaN(date.getTime())) {
    return { valid: false, error: "Invalid date" }
  }

  const [year, month, day] = value.split("-").map(Number)
  if (month < 1 || month > 12) {
    return { valid: false, error: "Invalid month" }
  }

  const daysInMonth = new Date(year, month, 0).getDate()
  if (day < 1 || day > daysInMonth) {
    return { valid: false, error: "Invalid day for month" }
  }

  if (year < 1990 || year > 2050) {
    return { valid: false, error: "Date out of reasonable range" }
  }

  return { valid: true }
}
```

### B.4 Quote Verification

```typescript
export function validateValueInQuote(
  extractedValue: string | number,
  exactQuote: string,
  options: { fuzzyThreshold?: number } = {}
): ValidationResult {
  const value = String(extractedValue)
  const { fuzzyThreshold = 0.85 } = options

  // Special handling for dates
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const patterns = dateToPatterns(value)
    // Try exact and fuzzy matching...
  }

  // For numeric values
  if (/^[\d.,]+$/.test(value)) {
    const patterns = normalizeNumber(value)
    // Try pattern matching with thousand separator tolerance...
  }

  // For text values
  const fuzzyResult = fuzzyContainsCroatian(exactQuote, value, fuzzyThreshold)
  if (fuzzyResult.found) {
    return { valid: true }
  }

  return {
    valid: false,
    error: `Value "${value}" not found in quote. Possible inference detected.`,
  }
}
```

### B.5 Domain-Specific Ranges

```typescript
const DOMAIN_RANGES: Record<string, DomainRanges> = {
  pdv: { percentageMax: 30 }, // VAT max 30%
  doprinosi: { percentageMax: 50 }, // Contributions max 50%
  porez_dohodak: { percentageMax: 60 }, // Income tax max 60%
  pausalni: { currencyMax: 1_000_000 }, // Pausalni threshold max 1M EUR
  interest_rates: { percentageMax: 20 }, // Interest rates max 20%
  exchange_rates: {
    exchangeRateMin: 0.0001,
    exchangeRateMax: 10000,
  },
}
```

---

## Document History

| Version | Date       | Author          | Changes                     |
| ------- | ---------- | --------------- | --------------------------- |
| 1.0.0   | 2026-01-14 | Claude Opus 4.5 | Initial comprehensive audit |

---

_This document provides a complete stakeholder-grade audit of the extractor worker. For questions or clarifications, consult the source files referenced throughout this document._
