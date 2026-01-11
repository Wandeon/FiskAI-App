# RTL Current Flow Map (Pre-Backfill)

> **Document Purpose:** Map the existing forward-only RTL discovery and processing pipeline to inform backfill implementation.
> **Date:** 2026-01-11
> **Status:** Audit Complete

---

## 1. Database Entities

### 1.1 Discovery Items (Discovered Links)

**Table:** `DiscoveredItem` (core schema)
**File:** `prisma/schema.prisma` (lines ~1890-1935)

| Field             | Type      | Purpose                                               |
| ----------------- | --------- | ----------------------------------------------------- |
| `id`              | cuid      | Primary key                                           |
| `endpointId`      | FK        | Link to DiscoveryEndpoint                             |
| `url`             | String    | Canonical URL of discovered item                      |
| `title`           | String?   | Document title if extractable                         |
| `publishedAt`     | DateTime? | Publication date if known                             |
| `contentHash`     | String?   | SHA-256 of last fetched content                       |
| `status`          | Enum      | PENDING, FETCHED, PROCESSED, SKIPPED, FAILED          |
| `processedAt`     | DateTime? | When processing completed                             |
| `evidenceId`      | String?   | Soft FK to Evidence when fetched                      |
| `errorMessage`    | String?   | Last error message                                    |
| `retryCount`      | Int       | Number of fetch retries (default 0)                   |
| `nodeType`        | Enum      | HUB, LEAF, ASSET                                      |
| `nodeRole`        | Enum?     | ARCHIVE, INDEX, NEWS_FEED, REGULATION, FORM, GUIDANCE |
| `parentUrl`       | String?   | Parent URL for crawl hierarchy                        |
| `depth`           | Int       | Crawl depth from endpoint                             |
| `changeFrequency` | Float     | EWMA of change rate                                   |
| `freshnessRisk`   | Enum      | CRITICAL, HIGH, MEDIUM, LOW                           |
| `nextScanDue`     | DateTime  | Intelligent scheduler field                           |

**Constraints:**

- `@@unique([endpointId, url])` - No duplicate URLs per endpoint
- `@@index([status])` - Fast status queries
- `@@index([nextScanDue, freshnessRisk])` - Manifest query optimization

### 1.2 Evidence (Canonical Regulatory Content)

**Table:** `Evidence` (regulatory schema)
**File:** `prisma/regulatory.prisma` (lines ~45-95)

| Field             | Type     | Purpose                                      |
| ----------------- | -------- | -------------------------------------------- |
| `id`              | cuid     | Primary key                                  |
| `sourceId`        | FK       | Link to RegulatorySource                     |
| `fetchedAt`       | DateTime | Immutable fetch timestamp                    |
| `contentHash`     | String   | SHA-256 of rawContent (immutable)            |
| `rawContent`      | Text     | Base64 encoded content (immutable)           |
| `contentType`     | Enum     | html, pdf, xml                               |
| `url`             | String   | Source URL                                   |
| `contentClass`    | Enum     | HTML, PDF_TEXT, PDF_SCANNED, DOC, XLSX, JSON |
| `stalenessStatus` | Enum     | FRESH, AGING, STALE, UNAVAILABLE, EXPIRED    |
| `embeddingStatus` | Enum     | PENDING, PROCESSING, COMPLETED, FAILED       |

**Constraints:**

- `@@unique([url, contentHash])` - Dedupe by URL+content
- Immutable fields enforced by application layer: `rawContent`, `contentHash`, `fetchedAt`
- `@@schema("regulatory")` - Separate PostgreSQL schema

### 1.3 Endpoint/Source Configuration

**Table:** `DiscoveryEndpoint` (core schema)
**File:** `prisma/schema.prisma` (lines ~1855-1888)

| Field               | Type    | Purpose                                              |
| ------------------- | ------- | ---------------------------------------------------- |
| `id`                | cuid    | Primary key                                          |
| `domain`            | String  | e.g., "narodne-novine.nn.hr"                         |
| `path`              | String  | e.g., "/sluzbeni-list"                               |
| `name`              | String  | Human-readable name                                  |
| `endpointType`      | Enum    | SITEMAP_INDEX, SITEMAP_ISSUE, NEWS_LISTING, etc.     |
| `priority`          | Enum    | CRITICAL, HIGH, MEDIUM, LOW                          |
| `scrapeFrequency`   | Enum    | EVERY_RUN, DAILY, TWICE_WEEKLY, WEEKLY, MONTHLY      |
| `listingStrategy`   | Enum    | SITEMAP_XML, HTML_LIST, HTML_TABLE, PAGINATION, etc. |
| `urlPattern`        | String? | Regex for item URL matching                          |
| `paginationPattern` | String? | e.g., "?page={N}"                                    |
| `isActive`          | Boolean | Enable/disable endpoint                              |
| `metadata`          | Json?   | Provider-specific config                             |

**Table:** `RegulatorySource` (regulatory schema)
**File:** `prisma/regulatory.prisma` (lines ~15-40)

| Field                | Type      | Purpose                                    |
| -------------------- | --------- | ------------------------------------------ |
| `id`                 | cuid      | Primary key                                |
| `slug`               | String    | Unique identifier (e.g., "narodne-novine") |
| `name`               | String    | Display name                               |
| `url`                | String    | Base URL                                   |
| `hierarchy`          | Enum      | PRIMARY, SECONDARY, TERTIARY               |
| `fetchIntervalHours` | Int       | Refresh interval                           |
| `lastFetchedAt`      | DateTime? | Last successful fetch                      |
| `lastContentHash`    | String?   | For change detection                       |
| `isActive`           | Boolean   | Enable/disable source                      |

---

## 2. Queue Definitions (BullMQ)

**File:** `src/lib/regulatory-truth/workers/queues.ts`

```typescript
// Pipeline Processing Queues
sentinelQueue = createQueue("sentinel", { max: 5, duration: 60000 })
extractQueue = createQueue("extract", { max: 10, duration: 60000 })
ocrQueue = createQueue("ocr", { max: 2, duration: 60000 })
composeQueue = createQueue("compose", { max: 5, duration: 60000 })
reviewQueue = createQueue("review", { max: 5, duration: 60000 })
arbiterQueue = createQueue("arbiter", { max: 3, duration: 60000 })
releaseQueue = createQueue("release", { max: 2, duration: 60000 })
consolidatorQueue = createQueue("consolidator", { max: 1, duration: 300000 })

// Supporting Queues
contentSyncQueue = createQueue("content-sync", { max: 2, duration: 60000 })
embeddingQueue = createQueue("embedding", { max: 10, duration: 60000 })
```

**Default Job Options:**

```typescript
{
  attempts: 3,
  backoff: { type: "exponential", delay: 10000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 100 }
}
```

---

## 3. Forward-Only Flow (Current State)

### 3.1 Layer A: Daily Discovery (06:00 Trigger)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Scheduler Service                                                    │
│ File: src/lib/regulatory-truth/workers/scheduler.service.ts          │
│ Lines: 24-38                                                         │
│ Trigger: cron.schedule("0 6 * * *")                                  │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Sentinel Queue                                                       │
│ sentinelQueue.add("sentinel-critical", { runId, priority })          │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Sentinel Worker                                                      │
│ File: src/lib/regulatory-truth/workers/sentinel.worker.ts            │
│ Agent: src/lib/regulatory-truth/agents/sentinel.ts                   │
│                                                                      │
│ Actions:                                                             │
│   1. Fetch active DiscoveryEndpoints by priority                     │
│   2. For each endpoint:                                              │
│      - Parse sitemap/RSS/HTML based on listingStrategy               │
│      - Upsert DiscoveredItem records (status: PENDING)               │
│   3. Fetch PENDING items (fetchDiscoveredItems)                      │
│   4. Create Evidence records with rawContent                         │
│   5. Queue for extraction: extractQueue.addBulk()                    │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
                    [Layer B Processing]
```

### 3.2 Layer B: 24/7 Continuous Processing

```
┌─────────────────────────────────────────────────────────────────────┐
│ Continuous Drainer                                                   │
│ File: src/lib/regulatory-truth/workers/continuous-drainer.worker.ts  │
│ Lines: 450-570                                                       │
│ Loop: runDrainCycle() every 1-60s (adaptive backoff)                 │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Stage 1       │     │ Stage 1.5       │     │ Stage 2         │
│ Fetch PENDING │     │ Queue OCR       │     │ Queue Extraction│
│ items         │     │ for scanned PDFs│     │                 │
└───────┬───────┘     └────────┬────────┘     └────────┬────────┘
        │                      │                       │
        ▼                      ▼                       ▼
┌───────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Create        │     │ OCR Worker      │     │ Extractor       │
│ Evidence      │     │ File: ocr.      │     │ Worker          │
│ records       │     │ worker.ts       │     │ File: extractor.│
└───────────────┘     │ Creates         │     │ worker.ts       │
                      │ EvidenceArtifact│     │ Creates         │
                      └─────────────────┘     │ SourcePointer   │
                                              └────────┬────────┘
                                                       │
        ┌──────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Stage 3: Compose                                                     │
│ File: src/lib/regulatory-truth/workers/composer.worker.ts            │
│ Agent: src/lib/regulatory-truth/agents/composer.ts                   │
│                                                                      │
│ Actions:                                                             │
│   - Group SourcePointers by domain                                   │
│   - Aggregate into RegulatoryRule (DRAFT status)                     │
│   - Detect conflicts → RegulatoryConflict records                    │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Stage 4: Review                                                      │
│ File: src/lib/regulatory-truth/workers/reviewer.worker.ts            │
│ Agent: src/lib/regulatory-truth/agents/reviewer.ts                   │
│                                                                      │
│ Actions:                                                             │
│   - LLM quality checks                                               │
│   - Auto-approve eligible rules (DRAFT → APPROVED)                   │
│   - Escalate uncertain rules for human review                        │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Stage 5: Arbiter (if conflicts)                                      │
│ File: src/lib/regulatory-truth/workers/arbiter.worker.ts             │
│ Agent: src/lib/regulatory-truth/agents/arbiter.ts                    │
│                                                                      │
│ Actions:                                                             │
│   - Resolve RegulatoryConflict records                               │
│   - Update conflicting rules                                         │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Stage 6: Release                                                     │
│ File: src/lib/regulatory-truth/workers/releaser.worker.ts            │
│ Agent: src/lib/regulatory-truth/agents/releaser.ts                   │
│                                                                      │
│ Actions:                                                             │
│   - Create ReleaseBundle                                             │
│   - Publish rules (APPROVED → PUBLISHED)                             │
│   - Build knowledge graph                                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Key File References

### 4.1 Database Layer

| Component                | File Path                  |
| ------------------------ | -------------------------- |
| Core Prisma Schema       | `prisma/schema.prisma`     |
| Regulatory Prisma Schema | `prisma/regulatory.prisma` |
| Core DB Client           | `src/lib/db/core.ts`       |
| Regulatory DB Client     | `src/lib/db/regulatory.ts` |
| DB Exports               | `src/lib/db/index.ts`      |

### 4.2 Worker Layer

| Worker             | File Path                                                       | Queue           |
| ------------------ | --------------------------------------------------------------- | --------------- |
| Scheduler          | `src/lib/regulatory-truth/workers/scheduler.service.ts`         | (cron)          |
| Sentinel           | `src/lib/regulatory-truth/workers/sentinel.worker.ts`           | sentinel        |
| OCR                | `src/lib/regulatory-truth/workers/ocr.worker.ts`                | ocr             |
| Extractor          | `src/lib/regulatory-truth/workers/extractor.worker.ts`          | extract         |
| Composer           | `src/lib/regulatory-truth/workers/composer.worker.ts`           | compose         |
| Reviewer           | `src/lib/regulatory-truth/workers/reviewer.worker.ts`           | review          |
| Arbiter            | `src/lib/regulatory-truth/workers/arbiter.worker.ts`            | arbiter         |
| Releaser           | `src/lib/regulatory-truth/workers/releaser.worker.ts`           | release         |
| Continuous Drainer | `src/lib/regulatory-truth/workers/continuous-drainer.worker.ts` | (internal loop) |

### 4.3 Agent Layer

| Agent     | File Path                                      |
| --------- | ---------------------------------------------- |
| Sentinel  | `src/lib/regulatory-truth/agents/sentinel.ts`  |
| Extractor | `src/lib/regulatory-truth/agents/extractor.ts` |
| Composer  | `src/lib/regulatory-truth/agents/composer.ts`  |
| Reviewer  | `src/lib/regulatory-truth/agents/reviewer.ts`  |
| Arbiter   | `src/lib/regulatory-truth/agents/arbiter.ts`   |
| Releaser  | `src/lib/regulatory-truth/agents/releaser.ts`  |

### 4.4 Queue Infrastructure

| Component         | File Path                                          |
| ----------------- | -------------------------------------------------- |
| Queue Definitions | `src/lib/regulatory-truth/workers/queues.ts`       |
| Base Worker       | `src/lib/regulatory-truth/workers/base.ts`         |
| Rate Limiter      | `src/lib/regulatory-truth/workers/rate-limiter.ts` |

---

## 5. Evidence Creation Flow (Detail)

```
1. Sentinel discovers URL
   ├─ Source: DiscoveryEndpoint + listingStrategy
   └─ Creates: DiscoveredItem { status: "PENDING", url, endpointId }

2. Drainer fetches PENDING items
   ├─ Query: db.discoveredItem.findMany({ status: "PENDING" })
   ├─ Fetch: HTTP GET with retry
   └─ Creates: Evidence { url, rawContent, contentHash, contentClass }

3. Evidence deduplication
   ├─ Constraint: @@unique([url, contentHash])
   └─ If exists: Skip (no duplicate content)

4. Content classification
   ├─ PDF_TEXT: Direct to extraction
   ├─ PDF_SCANNED: Queue OCR first
   └─ HTML: Direct to extraction

5. Link DiscoveredItem → Evidence
   └─ Update: db.discoveredItem.update({ evidenceId, status: "FETCHED" })
```

---

## 6. Gap Analysis for Backfill

### Current Limitations (Forward-Only)

1. **No historical discovery:** Sentinel only processes current sitemap/RSS
2. **No date-range support:** Cannot target specific time periods
3. **No archive crawling:** No pagination through archive pages
4. **No backfill tracking:** No audit trail for historical runs

### Required for Backfill

1. **BackfillRun entity:** Track historical discovery runs
2. **Date range support:** Filter by publication date
3. **Archive/pagination strategies:** Crawl historical listings
4. **Deduplication:** Leverage existing `@@unique([url, contentHash])`
5. **Rate limiting:** Per-domain delays to avoid blocking
6. **Stable job IDs:** Prevent duplicate queue entries

---

## 7. Integration Points for Backfill

### Entry Point: After Discovery

Backfill should produce `DiscoveredItem` records that the existing fetcher already understands.

### Queue Integration

Use existing `extractQueue` for processing, with stable `jobId` format:

```typescript
jobId: `backfill:${sourceId}:${sha1(url)}`
```

### Evidence Creation

Leverage existing Evidence creation with deduplication:

- Same `@@unique([url, contentHash])` constraint
- Same immutable field protections

---

**Document complete. Ready for backfill implementation.**
