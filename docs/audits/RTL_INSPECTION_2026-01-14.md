# RTL Pipeline Inspection Report

**Date:** 2026-01-14
**Inspector:** Claude Agent
**Scope:** Verified recent work + current pipeline state

---

## 1. Recent Completed Work (Verified)

### 1.1 Narodne Novine Streaming Sitemap Discovery

**Problem:** NN sitemap index has ~9,551 child sitemaps. Original "fetch everything then filter" approach caused timeouts and memory exhaustion.

**Solution Implemented:**

| Component                     | File                                                  | Description                                                 |
| ----------------------------- | ----------------------------------------------------- | ----------------------------------------------------------- |
| SAX streaming parser          | `backfill/streaming-sitemap-parser.ts` (391 lines)    | Yields URLs immediately without materializing full document |
| Streaming discovery generator | `backfill/streaming-sitemap-discovery.ts` (367 lines) | Async generator with checkpoint persistence                 |
| Source config                 | `backfill/source-backfill-config.ts:38-52`            | NN-specific config with `childSitemapDatePattern`           |

**Key Design Decisions:**

```typescript
// Checkpoint persistence semantics (streaming-sitemap-discovery.ts:299-307)
// On early stop: checkpoint uses childIndex - 1 (last COMPLETED child)
// This ensures on resume, partial child is re-fetched from beginning
return {
  lastCompletedChildSitemapIndex: childIndex - 1,
  lastCompletedChildSitemapUrl: previousChildUrl,
  urlsEmittedSoFar: totalUrlsEmitted,
}
```

**Fail-Closed Behavior:**

- `includeUndatedChildren=false` (default) - undated child sitemaps are skipped
- `StreamingParserLimitError` is re-thrown, not caught (line 332-335)
- Parser limits: `maxLocLengthChars: 2048`, `maxLocsPerFile: 100,000`, `maxBytesPerFile: 50MB`

**Gate Evidence:** `docs/audits/NN_STREAMING_GATE_2026-01-11.md`

| Criterion                                        | Status |
| ------------------------------------------------ | ------ |
| Checkpoint persisted to DB                       | PASS   |
| Date prefiltering active (started at child 9006) | PASS   |
| Rate limiting active (8-15s with jitter)         | PASS   |
| includeUndatedChildren=false (fail-closed)       | PASS   |
| Idempotency: 0 new queued on rerun               | PASS   |

**Test Coverage:** `backfill/__tests__/streaming-sitemap-discovery.test.ts` (743 lines, 27,151 bytes)

---

### 1.2 Backfill V1 Discovery Rollout

**Commits:** Multiple PRs culminating in #1413

**Invariants Defined:** `docs/audits/BACKFILL_V1_INVARIANTS.md`

| Invariant | Description                                              | Verified                         |
| --------- | -------------------------------------------------------- | -------------------------------- |
| INV-1     | Same DiscoveredItem records as sentinel                  | Yes (discoveryMethod='BACKFILL') |
| INV-2     | Stable jobId = `backfill:{slug}:{sha1(url).slice(0,12)}` | Yes                              |
| INV-3     | Per-domain rate limits with jitter                       | Yes                              |
| INV-4     | Evidence immutability (rawContent never overwritten)     | Yes                              |
| INV-5     | Hard caps per run/source                                 | Yes                              |
| INV-6     | Kill switch via BACKFILL_ENABLED=false                   | Yes                              |
| INV-7     | Deduplication at 3 levels                                | Yes                              |
| INV-8     | Full audit trail in BackfillRun table                    | Yes                              |

**Production Evidence:** `docs/audits/BACKFILL_V1_FIRST_REAL_RUN_TRACE.md`, `BACKFILL_V1_POST_DEPLOY_SNAPSHOT.md`

**Porezna-uprava Fix:** Archive URL redirect handled in `source-backfill-config.ts:58-79`

- Old `/HR/Stranice/Arhiva.aspx` redirected to homepage (broken)
- New: Uses `/hr/vijesti/8` with pagination pattern `?Page={N}`

---

### 1.3 PR-7: Unified LLM Accounting (durationMs + provider)

**Commit:** `9b3f2cff` feat(ai): add duration and provider tracking to AI usage

**Schema Change:** `prisma/schema.prisma` (AIUsage model)

```prisma
model AIUsage {
  // ... existing fields ...
  durationMs Int?     // API call latency in milliseconds
  provider   String?  // "openai" | "deepseek" | "ollama"
  // ...
}
```

**Implementation:** `src/lib/ai/usage-tracking.ts:60-96`

```typescript
export async function trackAIUsage(params: {
  companyId: string
  operation: AIOperation
  model?: string
  inputTokens?: number
  outputTokens?: number
  success?: boolean
  durationMs?: number // NEW
  provider?: string // NEW
}): Promise<void>
```

**Callsites Updated:**

- `src/lib/ai/extract.ts` - OpenAI extraction calls
- `src/lib/ai/ocr.ts` - OpenAI OCR calls
- `src/lib/news/pipeline/deepseek-client.ts` - DeepSeek/OpenAI/Ollama calls

**Test Coverage:** `src/lib/ai/__tests__/usage-tracking.test.ts` (239 lines)

**What's Still Missing for "Waste Detection":**

- Outcome/state-change linkage (was this LLM call useful?)
- Cost allocation by outcome category
- Admin UI for viewing usage by provider

---

### 1.4 PR-A: AgentRun Outcome Taxonomy

**Commit:** `253feeb0` feat(rtl): add AgentRun outcome taxonomy for LLM waste analysis

**Schema:** `prisma/schema.prisma`

```prisma
enum AgentRunOutcome {
  SUCCESS_APPLIED        // Output validated and state advanced
  SUCCESS_NO_CHANGE      // Output valid but no new information
  VALIDATION_REJECTED    // Failed deterministic validation
  LOW_CONFIDENCE         // Below confidence threshold
  EMPTY_OUTPUT           // LLM returned empty/null
  PARSE_FAILED           // LLM output not valid JSON
  CONTENT_LOW_QUALITY    // Pre-filter rejected input
  SKIPPED_DETERMINISTIC  // Pre-LLM rules decided no LLM needed
  CIRCUIT_OPEN           // Circuit breaker prevented call
  DUPLICATE_CACHED       // Cache hit, no LLM call
  RETRY_EXHAUSTED        // All retries failed
  TIMEOUT                // Aborted due to timeout
}

enum NoChangeCode {
  ALREADY_EXTRACTED
  DUPLICATE_POINTERS
  NO_RELEVANT_CHANGES
  BELOW_MIN_CONFIDENCE
  VALIDATION_BLOCKED
}
```

**Purpose:** Enables slicing LLM usage by outcome to identify waste (e.g., "How many calls resulted in SUCCESS_NO_CHANGE?")

**Implementation:** `src/lib/regulatory-truth/agents/runner.ts`

---

## 2. Current Pipeline State (Verified)

### 2.1 Architecture

**Two-Layer Model:** Verified in `docs/01_ARCHITECTURE/two-layer-model.md`

```
Layer A: Daily Discovery (Scheduled)
├── Scheduler Service
├── Sentinel Agent
└── Creates Evidence + queues jobs

Layer B: 24/7 Processing (Continuous)
├── OCR Worker
├── Extractor Worker
├── Composer Worker
├── Reviewer Worker
├── Arbiter Worker
└── Releaser Worker
```

### 2.2 Queue Configuration

**File:** `src/lib/regulatory-truth/workers/queues.ts`

| Queue         | Rate Limit | Purpose             |
| ------------- | ---------- | ------------------- |
| sentinelQueue | 5/min      | Discovery           |
| extractQueue  | 10/min     | LLM extraction      |
| ocrQueue      | 2/min      | Tesseract OCR       |
| composeQueue  | 5/min      | Rule composition    |
| reviewQueue   | 5/min      | Quality review      |
| arbiterQueue  | 3/min      | Conflict resolution |
| releaseQueue  | 2/min      | Publication         |

**Note:** Rate limits are configured but enforcement depends on BullMQ settings. Verify with actual queue inspection.

### 2.3 Worker Deployment

**File:** `docker-compose.workers.yml` (292 lines)

Workers deployed: orchestrator, sentinel, extractor, ocr, composer, reviewer, arbiter, releaser, scheduler, continuous-drainer, content-sync, article, evidence-embedding, embedding, einvoice-inbound

### 2.4 Fail-Closed Behavior (Verified)

| Location                                 | Behavior                                  |
| ---------------------------------------- | ----------------------------------------- |
| `streaming-sitemap-parser.ts:332-335`    | StreamingParserLimitError re-thrown       |
| `streaming-sitemap-discovery.ts:264-275` | Undated children skipped when fail-closed |
| `backfill-discover.worker.ts:6-8`        | BACKFILL_ENABLED check throws if false    |

---

## 3. Trust Guarantees (Design vs Implementation)

| Guarantee             | Design                                       | Implementation Status                       |
| --------------------- | -------------------------------------------- | ------------------------------------------- |
| Evidence-backed rules | Every rule links to SourcePointer → Evidence | **Enforced at release time**                |
| No hallucination      | exact_quote verified against source          | **Implemented in extractor**                |
| Fail-closed           | Low confidence → human queue                 | **Implemented**                             |
| Immutable evidence    | rawContent never updated                     | **DB constraint + upsert logic**            |
| Acyclic graph         | Cycle detection on precedence edges          | **Implemented in graph/cycle-detection.ts** |

---

## 4. What's NOT Verified (Architectural Intent Only)

These are documented but not verified in this inspection:

- Actual rate limit enforcement at runtime (requires queue monitoring)
- Confidence thresholds in production (need to check AgentRun records)
- OCR confidence fallback behavior (need test with scanned PDF)
- Arbiter resolution outcomes (need conflict examples)
- End-to-end rule publication (need to trace a rule from Evidence to PUBLISHED)

---

## 5. Files Referenced

| File                                          | Lines | Purpose                    |
| --------------------------------------------- | ----- | -------------------------- |
| `backfill/streaming-sitemap-parser.ts`        | 391   | SAX streaming parser       |
| `backfill/streaming-sitemap-discovery.ts`     | 367   | Checkpoint-based discovery |
| `backfill/source-backfill-config.ts`          | 180   | Per-source configs         |
| `src/lib/ai/usage-tracking.ts`                | 272   | AI usage tracking (PR-7)   |
| `agents/runner.ts`                            | ~800  | Agent execution framework  |
| `docs/audits/BACKFILL_V1_INVARIANTS.md`       | 464   | Invariant definitions      |
| `docs/audits/NN_STREAMING_GATE_2026-01-11.md` | 107   | Gate test evidence         |

---

## 6. Recommendations

### Immediate

1. **Verify rate limit enforcement** - Run queue inspection during active processing
2. **Add outcome tracking to AI usage** - Link `AIUsage.id` to `AgentRun.id` for waste analysis
3. **Document the 9,551 child sitemap problem** - Add to streaming parser comments for posterity

### Short-term

1. **Admin UI for LLM usage** - Slice by provider, operation, outcome
2. **End-to-end rule trace** - Script to verify Evidence → PUBLISHED path
3. **Production confidence histogram** - Analyze actual confidence distribution

---

**Document complete. This inspection reflects verified implemented work, not architectural aspirations.**
