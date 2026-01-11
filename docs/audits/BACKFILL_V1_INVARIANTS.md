# Backfill Design Invariants

> **Document Purpose:** Define the non-negotiable constraints for the RTL backfill system.
> **Date:** 2026-01-11
> **Status:** Specification Complete

---

## 1. Core Invariants

### INV-1: Same Discovery Lane

Backfill produces the **same `DiscoveredItem` records** that the forward-only fetcher already understands.

```typescript
// Backfill creates:
db.discoveredItem.upsert({
  where: { endpointId_url: { endpointId, url } },
  create: {
    endpointId,
    url,
    status: "PENDING",
    discoveryMethod: "BACKFILL", // New field to distinguish
    // ... same fields as sentinel
  },
  update: {
    // Never overwrite if already exists
  },
})
```

**Rationale:** Minimize code changes; reuse existing fetch/extract pipeline.

---

### INV-2: Stable Job IDs

Every queued job has a **deterministic `jobId`** derived from source and URL.

```typescript
jobId = `backfill:${sourceSlug}:${sha1(canonicalUrl)}`
```

**Properties:**

- Same URL always produces same jobId
- Prevents duplicate queue entries
- Survives worker restarts
- Enables idempotent retries

**Implementation:**

```typescript
import { createHash } from "crypto"

function getBackfillJobId(sourceSlug: string, url: string): string {
  const canonical = canonicalizeUrl(url)
  const hash = createHash("sha1").update(canonical).digest("hex").slice(0, 12)
  return `backfill:${sourceSlug}:${hash}`
}
```

---

### INV-3: Per-Domain Rate Limiting

Backfill respects **per-domain rate limits with jitter** to avoid blocking.

```typescript
interface DomainRateLimit {
  domain: string
  minDelayMs: number // Minimum delay between requests
  maxDelayMs: number // Maximum delay (for jitter)
  maxConcurrent: number // Max parallel requests to domain
}

// Example config
const DOMAIN_LIMITS: DomainRateLimit[] = [
  { domain: "narodne-novine.nn.hr", minDelayMs: 5000, maxDelayMs: 10000, maxConcurrent: 1 },
  { domain: "porezna-uprava.gov.hr", minDelayMs: 8000, maxDelayMs: 15000, maxConcurrent: 1 },
]
```

**Jitter Formula:**

```typescript
delay = minDelayMs + Math.random() * (maxDelayMs - minDelayMs)
```

---

### INV-4: Evidence Immutability

Backfill **never overwrites Evidence immutable fields**.

**Immutable Fields:**

- `rawContent` - Original fetched content
- `contentHash` - SHA-256 of rawContent
- `fetchedAt` - Original fetch timestamp
- `url` - Source URL

**Enforcement:**

```typescript
// Evidence creation uses upsert with immutability protection
dbReg.evidence.upsert({
  where: { url_contentHash: { url, contentHash } },
  create: {
    url,
    rawContent,
    contentHash,
    fetchedAt: new Date(),
    // ...
  },
  update: {
    // Only update mutable fields (staleness, embedding status, etc.)
    lastVerifiedAt: new Date(),
  },
})
```

**Database Constraint:**

```sql
@@unique([url, contentHash])
```

---

### INV-5: Hard Caps

Every backfill run has **hard caps per run and per source**.

```typescript
interface BackfillRunConfig {
  maxUrlsPerRun: number // Global cap (default: 1000)
  maxUrlsPerSource: number // Per-source cap (default: 500)
  maxConcurrency: number // Parallel discovery workers (default: 2)
}
```

**Enforcement:**

```typescript
if (state.discoveredCount >= config.maxUrlsPerRun) {
  console.log(`[backfill] Global cap reached: ${state.discoveredCount}`)
  break
}

if (sourceStats.count >= config.maxUrlsPerSource) {
  console.log(`[backfill] Source cap reached for ${source}: ${sourceStats.count}`)
  continue
}
```

---

### INV-6: Kill Switch

Backfill can be **globally disabled** via environment variable.

```typescript
const BACKFILL_ENABLED = process.env.BACKFILL_ENABLED === "true"

// Worker startup check
if (!BACKFILL_ENABLED) {
  console.log("[backfill] DISABLED via BACKFILL_ENABLED=false")
  process.exit(0)
}

// Job scheduling check
async function scheduleBackfillJob(runId: string) {
  if (!BACKFILL_ENABLED) {
    throw new Error("Backfill disabled. Set BACKFILL_ENABLED=true to enable.")
  }
  // ...
}
```

**Default:** `BACKFILL_ENABLED=false` (opt-in only)

---

### INV-7: Deduplication

Backfill leverages existing deduplication at multiple levels.

**Level 1: DiscoveredItem**

```sql
@@unique([endpointId, url])
-- Prevents duplicate discovery
```

**Level 2: Evidence**

```sql
@@unique([url, contentHash])
-- Prevents duplicate content storage
```

**Level 3: BullMQ Job**

```typescript
queue.add("fetch", data, { jobId: stableJobId })
// Prevents duplicate queue entries
```

---

### INV-8: Audit Trail

Every backfill run is **fully tracked** in `BackfillRun` table.

```typescript
interface BackfillRun {
  id: string
  createdAt: DateTime
  updatedAt: DateTime
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED"

  // Configuration
  sources: string[] // Source slugs
  mode: "SITEMAP" | "ARCHIVE" | "PAGINATION"
  dateFrom?: DateTime
  dateTo?: DateTime
  maxUrls: number
  concurrency: number
  delayMs: number
  dryRun: boolean

  // Execution
  startedAt?: DateTime
  finishedAt?: DateTime

  // Counters
  discoveredCount: number // URLs found
  queuedCount: number // Jobs enqueued
  skippedCount: number // Already existed
  errorCount: number // Errors encountered

  // Metadata
  errorLog?: string // JSON array of errors
  runBy?: string // Operator identifier
}
```

---

## 2. Architectural Constraints

### ARC-1: Separate Discovery Lane

Backfill runs in parallel with daily Sentinel without interference.

```
┌─────────────────┐     ┌─────────────────┐
│ Daily Sentinel  │     │ Backfill Worker │
│ (06:00 trigger) │     │ (on-demand)     │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │   DiscoveredItem      │
         │   (same table)        │
         ▼                       ▼
┌─────────────────────────────────────────┐
│ DiscoveredItem                          │
│ @@unique([endpointId, url])             │
│ discoveryMethod: "SENTINEL" | "BACKFILL"│
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Existing Fetch/Extract Pipeline         │
│ (unchanged)                              │
└─────────────────────────────────────────┘
```

---

### ARC-2: Configuration Isolation

Backfill configs are stored in dedicated file, not mixed with endpoint configs.

```
src/lib/regulatory-truth/backfill/
├── source-backfill-config.ts    # Backfill-specific configs
├── backfill-discover.worker.ts  # Worker implementation
├── url-canonicalizer.ts         # URL normalization
├── sitemap-parser.ts            # Sitemap parsing
├── pagination-parser.ts         # Archive pagination
└── types.ts                     # Type definitions
```

---

### ARC-3: Redis Queue Protection

Backfill cannot flood Redis with unbounded jobs.

```typescript
// Queue configuration
const BACKFILL_QUEUE_OPTIONS = {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 30000 },
    removeOnComplete: { count: 100 }, // Aggressive cleanup
    removeOnFail: { count: 50 }, // Limited failure retention
  },
}

// Rate limiting
const BACKFILL_RATE_LIMIT = {
  max: 2, // 2 jobs per duration
  duration: 60000, // per minute
}
```

---

## 3. Operational Constraints

### OPS-1: Dry Run Support

Every backfill run can be previewed without side effects.

```bash
# Dry run: discover and count, but don't queue
npx tsx scripts/backfill-run.ts \
  --source porezna-uprava.gov.hr \
  --mode sitemap \
  --max-urls 500 \
  --dry-run

# Output:
# [backfill] DRY RUN - no jobs will be queued
# [backfill] Discovered 342 URLs from porezna-uprava.gov.hr
# [backfill] Would queue 287 new items (55 already exist)
```

---

### OPS-2: Resumable Runs

Failed backfill runs can be resumed without re-processing.

```typescript
// BackfillRun tracks progress
interface BackfillRunProgress {
  lastProcessedSource: string
  lastProcessedPage: number
  lastProcessedUrl: string
}

// Resume from checkpoint
async function resumeBackfillRun(runId: string) {
  const run = await db.backfillRun.findUnique({ where: { id: runId } })
  if (run.status !== "FAILED") {
    throw new Error("Can only resume FAILED runs")
  }
  // Continue from lastProcessedSource/Page
}
```

---

### OPS-3: Observable Progress

Backfill progress is observable via logs and database.

```typescript
// Periodic progress logging
console.log(`[backfill] Progress: ${state.discoveredCount}/${config.maxUrls} URLs`)
console.log(`[backfill]   Queued: ${state.queuedCount}`)
console.log(`[backfill]   Skipped: ${state.skippedCount}`)
console.log(`[backfill]   Errors: ${state.errorCount}`)

// Database update every N items
if (state.discoveredCount % 50 === 0) {
  await db.backfillRun.update({
    where: { id: runId },
    data: {
      discoveredCount: state.discoveredCount,
      queuedCount: state.queuedCount,
      skippedCount: state.skippedCount,
      errorCount: state.errorCount,
    },
  })
}
```

---

## 4. Testing Invariants

### TEST-1: URL Canonicalization Determinism

Same URL always produces same canonical form.

```typescript
// Test cases
assert(
  canonicalizeUrl("https://example.com/page?b=2&a=1") ===
    canonicalizeUrl("https://example.com/page?a=1&b=2")
)

assert(
  canonicalizeUrl("https://example.com/page#section") ===
    canonicalizeUrl("https://example.com/page")
)

assert(canonicalizeUrl("https://example.com/page/") === canonicalizeUrl("https://example.com/page"))
```

---

### TEST-2: JobId Determinism

Same inputs always produce same jobId.

```typescript
const jobId1 = getBackfillJobId("narodne-novine", "https://narodne-novine.nn.hr/123")
const jobId2 = getBackfillJobId("narodne-novine", "https://narodne-novine.nn.hr/123")
assert(jobId1 === jobId2)
```

---

### TEST-3: Evidence Immutability

Existing Evidence content cannot be modified.

```typescript
// Create initial evidence
const ev1 = await createEvidence({ url: "https://a.com", rawContent: "v1" })

// Attempt to create with same URL, different content
const ev2 = await createEvidence({ url: "https://a.com", rawContent: "v2" })

// Both exist (different contentHash)
assert(ev1.id !== ev2.id)
assert(ev1.rawContent === "v1")
assert(ev2.rawContent === "v2")
```

---

## 5. Invariant Verification Checklist

Before merging backfill code, verify:

- [ ] **INV-1:** Backfill creates DiscoveredItem records that sentinel fetcher processes
- [ ] **INV-2:** All queued jobs have stable, deterministic jobIds
- [ ] **INV-3:** Per-domain rate limits are enforced with jitter
- [ ] **INV-4:** Evidence immutable fields are never overwritten
- [ ] **INV-5:** Hard caps are enforced per run and per source
- [ ] **INV-6:** Kill switch stops all backfill activity
- [ ] **INV-7:** Deduplication works at all three levels
- [ ] **INV-8:** Audit trail is complete for every run

---

**Document complete. Implementation must satisfy all invariants.**
