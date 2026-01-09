# Discovery & Backfill Systems Investigation

> **Audit Date:** 2026-01-07
> **Scope:** Complete investigation of Discovery, Evidence Safety, Pipeline Blockers, and Historical Backfill Design
> **Status:** Investigation Complete

---

## Executive Summary

This investigation provides a complete factual analysis of FiskAI's Regulatory Truth Layer (RTL) discovery and processing systems. Key findings:

**System Capabilities:**
- Sentinel discovers from **daily schedules** via cron (06:00 Croatia time)
- **No historical backfill mechanism exists** - Sentinel only monitors configured endpoints for NEW content
- Evidence records are **immutable** (rawContent, contentHash, fetchedAt) with hard enforcement
- Change detection works via **contentHash comparison** on re-fetch

**Current Blockers:**
- **Redis OOM** (572MB used / 512MB max) - 508K+ stale job keys blocking all queues
- **HTML extraction gate** was blocking (NOW FIXED in PR #1339)
- **PDF_SCANNED lane** blocked - 0 OCR_TEXT artifacts exist for 55 records

**Critical Gap:**
- **NO mechanism to ingest historical regulatory documents** published before monitoring started
- Sentinel is **forward-looking only** - it discovers NEW publications, not historical archives

---

## Part 1: Sentinel Reality Check

### 1.1 What Sentinel Actually Does

Sentinel is a **forward-looking discovery system** that:
- Scans configured `DiscoveryEndpoint` records on a schedule
- Discovers **newly published** URLs from listing pages, sitemaps, RSS feeds
- Creates `DiscoveredItem` records for new URLs
- Fetches content and creates `Evidence` records
- Queues Evidence for extraction pipeline

**Sentinel does NOT:**
- Crawl historical archives
- Fetch documents published before monitoring started
- Backfill missing regulatory content
- Have any awareness of what "should" exist

### 1.2 Configured Endpoints (Current State)

| Endpoint Type | Count | Strategy | Sources |
|---------------|-------|----------|---------|
| SITEMAP_XML | ~5 | Parse XML sitemaps | Narodne novine, larger sites |
| RSS_FEED | ~10 | Parse RSS with date filters | News feeds, official announcements |
| HTML_LIST | ~8 | Scrape listing pages | HZZO, Porezna, FINA |
| PAGINATION | ~3 | Follow page links | Paginated archives |
| CRAWL | ~2 | Recursive discovery | Document portals |

**Key Sites Monitored:**
- `narodne-novine.nn.hr` - Croatian Official Gazette
- `porezna-uprava.gov.hr` - Tax Authority
- `hzzo.hr` - Health Insurance Fund
- `mirovinsko.hr` - Pension Fund
- `fina.hr` - Financial Agency
- `eur-lex.europa.eu` - EU Law

### 1.3 Discovery Schedule

```
06:00 Zagreb time:
  sentinel-critical → Immediate
  sentinel-high → +60s delay
  sentinel-normal → +120s delay
  sentinel-low → +180s delay

06:30 Zagreb time:
  Health check (alerts for SLA breaches)
```

### 1.4 Adaptive Scheduling

For items already discovered, Sentinel uses EWMA (Exponential Weighted Moving Average) velocity tracking:

| Risk Level | Base Interval | High Velocity | Low Velocity |
|------------|---------------|---------------|--------------|
| CRITICAL | 4h | 1h | 12h |
| HIGH | 8h | 2h | 24h |
| MEDIUM | 24h | 6h | 72h |
| LOW | 48h | 12h | 168h |

### 1.5 Historical Depth Reality

**Sentinel has NO historical awareness:**

1. **No historical URL discovery** - Only monitors listing pages for NEW items
2. **No archive traversal** - Doesn't follow "Previous years" or archive links
3. **No date-range fetching** - Cannot request "all documents from 2020-2024"
4. **No gap detection** - Cannot identify missing regulatory documents

**Evidence:** Sentinel's `processEndpoint()` function (sentinel.ts:533-870) only:
- Parses current page content
- Extracts URLs visible on that page
- Creates DiscoveredItem if URL is new
- Has NO code path for historical crawling

---

## Part 2: Evidence Safety Model

### 2.1 Immutability Guarantees

**Immutable Fields (Hard Enforcement):**

| Field | Type | Protection |
|-------|------|------------|
| `rawContent` | TEXT | Prisma extension throws `EvidenceImmutabilityError` |
| `contentHash` | String | Prisma extension throws `EvidenceImmutabilityError` |
| `fetchedAt` | DateTime | Prisma extension throws `EvidenceImmutabilityError` |

**Enforcement Location:** `/src/lib/db/regulatory.ts:14-39`

```typescript
const EVIDENCE_IMMUTABLE_FIELDS = ["rawContent", "contentHash", "fetchedAt"]

// Prisma extension intercepts ALL update operations
// Throws EvidenceImmutabilityError if any immutable field is modified
```

### 2.2 Uniqueness Constraints

**Evidence Deduplication:**
```sql
@@unique([url, contentHash])
```
- Same URL + same content = reuse existing Evidence
- Same URL + different content = create new Evidence (content changed)

**Content Hash Calculation:**
- SHA-256 of `rawContent`
- Calculated at fetch time
- Used for change detection on re-fetch

### 2.3 Change Detection

**Staleness Thresholds (by Source Hierarchy):**

| Hierarchy | Source Type | Threshold | Status Path |
|-----------|-------------|-----------|-------------|
| 1 | Laws (Directives, NN) | 30 days | FRESH → AGING → STALE → EXPIRED |
| 2 | Regulations | 21 days | FRESH → AGING → STALE → EXPIRED |
| 3 | Official Guidance | 14 days | FRESH → AGING → STALE → EXPIRED |
| 4 | Practice Guides | 7 days | FRESH → AGING → STALE → EXPIRED |

**Change Detection Fields:**
- `sourceEtag` - ETag from HTTP headers
- `sourceLastMod` - Last-Modified header
- `hasChanged` - Boolean flag
- `changeSummary` - Description of changes

**Verification Flow:**
1. HEAD request to source URL
2. Compare ETag/Last-Modified
3. If changed → mark `hasChanged=true`, update staleness
4. Grace period: 3 consecutive failures before EXPIRED

### 2.4 Versioning Model

**Evidence records are NOT versioned - they are append-only:**

- New fetch of changed content → new Evidence record
- Old Evidence remains intact (immutable)
- Link via `url` field for history

**SourcePointer provenance:**
- `startOffset` / `endOffset` - UTF-16 indices into rawContent
- `matchType` - EXACT, NORMALIZED, NOT_FOUND, PENDING_VERIFICATION
- Invariant: `rawContent.slice(startOffset, endOffset) === exactQuote`

---

## Part 3: Pipeline Blockers

### 3.1 Root Blocker: Redis OOM

**Current State (from LANE_TRUTH_TABLE.md):**
```
Used memory:  572.17MB
Max memory:   512.00MB
Total keys:   508,125
```

**Key Distribution:**

| Pattern | Count | % |
|---------|-------|---|
| fiskai:extract:* | 436,499 | 85.9% |
| fiskai:review:* | 41,900 | 8.2% |
| fiskai:arbiter:* | 20,950 | 4.1% |
| fiskai:compose:* | 6,285 | 1.2% |
| fiskai:release:* | 2,095 | 0.4% |

**Root Cause:** BullMQ job records not being cleaned up. Completed/failed jobs accumulate indefinitely.

**Fix Required:**
```typescript
defaultJobOptions: {
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 500 },
}
```

### 3.2 Lane Status (from LANE_TRUTH_TABLE.md)

| Lane | Evidence | With SourcePointers | Coverage | Status |
|------|----------|---------------------|----------|--------|
| PDF_TEXT | 182 | 57 | 31% | PARTIAL (baseline v1 ran 57/182) |
| PDF_SCANNED | 55 | 0 | 0% | BLOCKED - Redis OOM |
| HTML | 43 | 0 | 0% | BLOCKED - was embedding-gated (FIXED) |
| XLSX | 12 | 0 | 0% | BLOCKED - Redis OOM |
| DOC | 2 | 0 | 0% | BLOCKED - Redis OOM |

### 3.3 Worker States

**BullMQ Queue Configuration:**

| Queue | Rate Limit | Concurrency | Status |
|-------|-----------|-------------|--------|
| sentinel | 5/60s | 1 | Running |
| extract | 10/60s | 2 | **BLOCKED (OOM)** |
| ocr | 2/60s | 1 | **BLOCKED (OOM)** |
| compose | 5/60s | 1 | **BLOCKED (OOM)** |
| review | 5/60s | 1 | **BLOCKED (OOM)** |

### 3.4 LLM Configuration

**Extraction Config (OLLAMA_EXTRACT_*):**
```
OLLAMA_EXTRACT_ENDPOINT=https://ollama.com
OLLAMA_EXTRACT_MODEL=gemini-3-flash-preview
```

**Embedding Config (OLLAMA_EMBED_*):**
```
OLLAMA_EMBED_ENDPOINT=http://100.89.2.111:11434 (local Tailscale)
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_EMBED_DIMS=768
```

**Split configuration ensures:**
- Extraction uses Ollama Cloud with larger models
- Embeddings use local Ollama for fast vector generation

---

## Part 4: Database State

### 4.1 Evidence by Content Class

| contentClass | Count | Ready for Extraction | Notes |
|--------------|-------|---------------------|-------|
| PDF_TEXT | 182 | YES (has PDF_TEXT artifact) | 125 remaining |
| PDF_SCANNED | 55 | NO (needs OCR_TEXT artifact) | 0 OCR processed |
| HTML | 43 | YES (rawContent sufficient) | - |
| XLSX | 12 | YES (rawContent sufficient) | - |
| DOC | 2 | YES (rawContent sufficient) | - |
| **TOTAL** | **294** | **239** | 55 awaiting OCR |

### 4.2 Extraction Eligibility Logic

**From content-provider.ts:**
```typescript
if (contentClass === "PDF_SCANNED") {
  return evidence.artifacts.some(a => a.kind === "OCR_TEXT")
}
if (contentClass === "PDF_TEXT") {
  return evidence.artifacts.some(a => a.kind === "PDF_TEXT")
}
// HTML/JSON/DOC/DOCX/XLSX
return true  // rawContent is sufficient
```

### 4.3 Extraction Quality (from EXTRACTION_EVAL_PACK.md)

**Sample Results (6 PDF_TEXT Evidence):**
- All 36 evaluated pointers: **100% confidence (1.0)**
- Croatian date formats → ISO conversion: **Working**
- Numeric thresholds: **Extracted correctly**
- URL/email detection: **Robust**

**Value Type Distribution:**
| Type | Count | % |
|------|-------|---|
| threshold | 17 | 47% |
| text | 14 | 39% |
| date | 5 | 14% |

### 4.4 Phase-1 Cutover Status

**From PHASE_E_CUTOVER_AUDIT.md:**

| Check | Expected | Actual |
|-------|----------|--------|
| RuleFact Population | Has PUBLISHED records | **Pending (local DB missing migration)** |
| CandidateFact Population | Being populated | **Pending verification** |
| SourcePointer Writes Stopped | No new writes | **Pending (Phase D merged)** |
| Evidence Linkage | groundingQuotes → Evidence | **Pending verification** |

---

## Part 5: Historical Backfill Design

### 5.1 The Gap

**What exists:**
- Forward-looking discovery (Sentinel)
- Real-time change detection
- Evidence immutability

**What's missing:**
- Historical document ingestion
- Archive traversal capability
- Gap detection (what SHOULD exist but doesn't)

### 5.2 Backfill Strategy Options

**Option A: Archive Endpoint Discovery**

Create dedicated DiscoveryEndpoints for historical archives:
```typescript
{
  domain: "narodne-novine.nn.hr",
  path: "/arhiva/2020",  // Historical archive path
  listingStrategy: "PAGINATION",
  priority: "LOW",
  scrapeFrequency: "MONTHLY"
}
```

Pros: Uses existing infrastructure
Cons: Requires archive URLs to be known, may not cover all sources

**Option B: Bulk Import Script**

Create dedicated backfill script:
```typescript
async function backfillHistoricalDocuments(config: {
  sourceSlug: string
  urls: string[]  // Pre-gathered historical URLs
  dateRange: { from: Date, to: Date }
}) {
  for (const url of urls) {
    // 1. Fetch content
    // 2. Create Evidence (dedup via url+contentHash)
    // 3. Queue for extraction
  }
}
```

Pros: Controlled, can handle any URL list
Cons: Requires gathering URLs externally

**Option C: Hybrid Crawler**

Extend Sentinel with historical mode:
```typescript
interface HistoricalCrawlConfig {
  entryPoint: string
  archiveLinkSelector: string  // e.g., "a[href*='/arhiva/']"
  dateRange: { from: Date, to: Date }
  maxDepth: number
}
```

Pros: Automated discovery
Cons: Complex, risky for large archives

### 5.3 Recommended Approach

**Phase 1: Manual URL Collection**
1. Identify critical regulatory sources with gaps
2. Manually compile historical URL lists
3. Use bulk import script for controlled ingestion

**Phase 2: Archive Endpoints**
1. Configure archive-specific DiscoveryEndpoints
2. Set low priority, monthly scrape frequency
3. Let normal pipeline process discoveries

**Phase 3: Gap Detection**
1. Build concept → expected documents mapping
2. Query Evidence to identify missing coverage
3. Target backfill efforts at identified gaps

### 5.4 Safety Invariants for Backfill

Any backfill mechanism MUST preserve:

1. **Evidence immutability** - Never modify existing Evidence
2. **Content deduplication** - Use `@@unique([url, contentHash])` constraint
3. **Source attribution** - Link to appropriate RegulatorySource
4. **Queue throttling** - Respect rate limits
5. **Audit trail** - Log all backfill operations

---

## Immediate Action Items

### Priority 1: Unblock Queues (Redis OOM)

```bash
# Option A: Flush stale keys (WARNING: clears job history)
docker exec fiskai-redis redis-cli FLUSHDB

# Option B: Selective cleanup (safer)
docker exec fiskai-redis redis-cli --scan --pattern 'fiskai:*:[0-9]*' | \
  xargs -L 100 docker exec -i fiskai-redis redis-cli DEL

# Option C: Increase memory + add TTL
# docker-compose.workers.yml
redis:
  command: redis-server --maxmemory 1gb --maxmemory-policy allkeys-lru
```

### Priority 2: Resume Extraction

After Redis fix:
```bash
# HTML + PDF_TEXT + DOC + XLSX lanes
npx tsx scripts/baseline-extraction.ts --limit 200

# PDF_SCANNED lane (after OCR)
# Will auto-queue via continuous-drainer
```

### Priority 3: OCR Pipeline

Verify OCR worker can process PDF_SCANNED backlog:
```bash
# Check OCR queue status
npx tsx scripts/queue-status.ts

# Verify Tesseract + Vision fallback working
docker logs fiskai-worker-ocr --tail 100
```

### Priority 4: Historical Backfill Planning

1. **Inventory critical gaps** - Which regulations are missing?
2. **Compile URL lists** - For each source with gaps
3. **Create backfill script** - Using Option B approach
4. **Test on small batch** - Verify Evidence creation + extraction
5. **Run full backfill** - With monitoring

---

## File References

| File | Purpose |
|------|---------|
| `src/lib/regulatory-truth/agents/sentinel.ts` | Discovery logic |
| `src/lib/regulatory-truth/utils/content-provider.ts` | Extraction eligibility |
| `src/lib/db/regulatory.ts` | Evidence immutability enforcement |
| `src/lib/regulatory-truth/workers/queues.ts` | Queue configuration |
| `docs/audits/LANE_TRUTH_TABLE.md` | Current lane status |
| `docs/audits/EXTRACTION_EVAL_PACK.md` | Extraction quality samples |
| `scripts/baseline-extraction.ts` | Manual extraction runner |

---

## Conclusion

The FiskAI Regulatory Truth Layer has a robust forward-looking discovery system but lacks historical backfill capability. The immediate blocker (Redis OOM) is preventing all processing. Once resolved:

1. **Existing Evidence** (239 eligible) can be processed through extraction
2. **PDF_SCANNED** (55 records) needs OCR pipeline working first
3. **Historical content** requires new backfill mechanism (not currently possible)

The recommended path forward is:
1. Fix Redis OOM immediately
2. Process existing Evidence backlog
3. Plan and implement historical backfill capability as a separate project
