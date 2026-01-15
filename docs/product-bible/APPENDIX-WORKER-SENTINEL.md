# APPENDIX: Sentinel Worker Audit

> **Document Type:** Stakeholder-Grade Technical Audit
> **Component:** Sentinel Worker (Discovery Engine)
> **Layer:** Layer A - Daily Discovery
> **Last Updated:** 2026-01-14
> **Document Version:** 1.0.0

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
9. [Guardrails & Safety](#9-guardrails--safety)
10. [Monitoring & Observability](#10-monitoring--observability)
11. [Configuration](#11-configuration)
12. [Known Issues & Limitations](#12-known-issues--limitations)
13. [Source Registry](#13-source-registry)
14. [Appendix A: Content Classification](#appendix-a-content-classification)
15. [Appendix B: Listing Strategies](#appendix-b-listing-strategies)
16. [Appendix C: Adaptive Scanning](#appendix-c-adaptive-scanning)

---

## 1. Overview

### 1.1 Purpose

The **Sentinel Worker** is the discovery engine of the FiskAI Regulatory Truth Layer. Its primary mission is the **daily discovery of regulatory content** from Croatian government sources, official gazettes, and regulatory bodies.

### 1.2 Role in Layer A (Discovery)

```
Layer A: Daily Discovery (Scheduled)
=======================================
[Scheduler] --> [Sentinel Worker] --> [Evidence Records]
    |                                        |
    |                                        v
    |               [Scout Queue] --> [Router] --> [OCR/Extract]
    |
    06:00 daily cron job
```

The Sentinel operates as the first stage of the Regulatory Truth Layer pipeline:

1. **Discovery Phase:** Scans regulatory endpoints (sitemaps, RSS feeds, HTML pages)
2. **Fetch Phase:** Downloads content from discovered URLs
3. **Classification Phase:** Classifies content type (PDF_TEXT, PDF_SCANNED, HTML, etc.)
4. **Routing Phase:** Queues downstream jobs for Scout (pre-LLM quality assessment)

### 1.3 Sources Monitored

The Sentinel monitors **71 regulatory sources** across these categories:

| Category                  | Count | Priority      | Examples                                   |
| ------------------------- | ----- | ------------- | ------------------------------------------ |
| Pausalni Core             | 3     | CRITICAL      | Porezna uprava - Pausalno oporezivanje     |
| Contributions (Doprinosi) | 3     | CRITICAL      | HZMO, HZZO doprinosi                       |
| VAT (PDV)                 | 3     | CRITICAL/HIGH | Porezna uprava - PDV stope                 |
| Fiscalization             | 2     | HIGH          | FINA fiskalizacija, Porezna fiskalizacija  |
| Deadlines (Rokovi)        | 2     | HIGH/CRITICAL | Porezni kalendar, zatezne kamate           |
| Laws (Narodne novine)     | 12    | CRITICAL/HIGH | Zakon o PDV-u, Zakon o obrtu               |
| Regulations (Pravilnici)  | 4     | HIGH          | Pravilnik o PDV-u, Pravilnik o doprinosima |
| Institutions              | 15    | MEDIUM        | MRMS, FINA, HNB, DZS                       |
| Chambers                  | 4     | MEDIUM/LOW    | HOK, HGK                                   |
| EU Sources                | 1     | MEDIUM        | EU VAT Directive                           |
| Official Interpretations  | 2     | MEDIUM        | Misljenja i upute                          |
| Other                     | 20    | LOW/MEDIUM    | Various supporting sources                 |

---

## 2. Technical Implementation

### 2.1 Entry Point

**Worker File:** `src/lib/regulatory-truth/workers/sentinel.worker.ts`

```typescript
// Entry point signature
const worker = createWorker<SentinelJobData>("sentinel", processSentinelJob, {
  name: "sentinel",
  concurrency: 1, // Only one sentinel at a time
})
```

### 2.2 Main Loop

The Sentinel worker executes in three phases:

```typescript
async function processSentinelJob(job: Job<SentinelJobData>): Promise<JobResult> {
  // Phase 1: Run Sentinel Discovery
  const result = await runSentinel(priority)

  // Phase 2: Fetch Discovered Items
  const fetchResult = await fetchDiscoveredItems(50)

  // Phase 3: Queue Scout Jobs for New Evidence
  const newEvidence = await dbReg.evidence.findMany({
    where: { id: { notIn: processedEvidenceIds } },
    take: 50,
  })

  await scoutQueue.addBulk(
    newEvidence.map((e) => ({
      name: "scout",
      data: { evidenceId: e.id, runId, parentJobId: job.id },
    }))
  )
}
```

### 2.3 BullMQ Queue Configuration

**Queue Name:** `sentinel`

```typescript
// From queues.ts
export const sentinelQueue = createQueue("sentinel", {
  max: 5, // Max 5 jobs per minute
  duration: 60000, // Rate limit window: 60 seconds
})
```

**Default Job Options:**

- `attempts: 3` - Maximum retry attempts
- `backoff: { type: "exponential", delay: 10000 }` - 10s, 20s, 40s retry delays
- `removeOnComplete: { count: 1000 }` - Keep last 1000 completed jobs
- `removeOnFail: { count: 100 }` - Keep last 100 failed jobs

### 2.4 Endpoint Scanning Process

```
processEndpoint(endpoint, config)
        |
        v
[Check Headless Requirement]
        |
        +--[Yes]--> fetchWithHeadless(url) --> [Playwright render]
        |
        +--[No]---> fetchWithRateLimit(url) --> [HTTP fetch]
        |
        v
[Detect Content Change] --> hashContent(content) --> compare with lastContentHash
        |
        v
[Parse Content Based on Strategy]
        |
        +--[RSS_FEED]--------> parseRSSFeed()
        +--[SITEMAP_XML]-----> parseSitemap() / scanSitemapRecursively()
        +--[CRAWL]-----------> crawlSite()
        +--[PAGINATION]------> parseHtmlList() + findPaginationLinks()
        +--[HTML_LIST]-------> parseHtmlList() + extractDocumentLinks()
        |
        v
[Create DiscoveredItem Records]
```

---

## 3. Inputs

### 3.1 Job Payload Schema

```typescript
interface SentinelJobData {
  runId: string // Unique run identifier (e.g., "discovery-1705234567890")
  sourceId?: string // Optional: specific source to scan
  priority?: DiscoveryPriority // Filter: "CRITICAL" | "HIGH" | "NORMAL" | "LOW"
}
```

### 3.2 Discovery Endpoint Definition

**Database Table:** `DiscoveryEndpoint`

```typescript
interface DiscoveryEndpoint {
  id: string
  domain: string // e.g., "porezna-uprava.gov.hr"
  path: string // e.g., "/HR_Porezni_sustav/Stranice/pausalno.aspx"
  name: string // Human-readable name
  listingStrategy: ListingStrategy // RSS_FEED | SITEMAP_XML | HTML_LIST | PAGINATION | CRAWL
  scrapeFrequency: ScrapeFrequency // EVERY_RUN | DAILY | TWICE_WEEKLY | WEEKLY | MONTHLY
  priority: DiscoveryPriority // CRITICAL | HIGH | NORMAL | LOW
  isActive: boolean
  urlPattern: string | null // Regex for filtering discovered URLs
  paginationPattern: string | null // Pattern for pagination detection
  lastContentHash: string | null // SHA-256 hash for change detection
  lastScrapedAt: Date | null
  consecutiveErrors: number // Error tracking (circuit breaker)
  lastError: string | null
  metadata: Json | null // Strategy-specific configuration
}
```

### 3.3 Source Configuration Format

**Static Definition:** `src/lib/regulatory-truth/data/sources.ts`

```typescript
interface SourceDefinition {
  slug: string // Unique identifier: "porezna-pausalno"
  name: string // "Porezna uprava - Pausalno oporezivanje"
  url: string // Base URL for the source
  hierarchy: number // 1=Ustav, 2=Zakon, 3=Podzakonski, 4=Pravilnik, 5=Uputa, 6=Misljenje, 7=Praksa
  fetchIntervalHours: number // 24 = daily, 168 = weekly
  priority: "critical" | "high" | "medium" | "low"
  domains: string[] // ["pausalni", "pdv", "doprinosi", ...]
}
```

### 3.4 Listing Strategy Metadata

**RSS_FEED Metadata:**

```typescript
{
  urlPattern?: string       // Regex to filter items
  startDate?: string        // ISO date for date range filtering
  endDate?: string          // ISO date for date range filtering
}
```

**SITEMAP_XML Metadata (Narodne novine):**

```typescript
{
  types?: number[]          // [1, 2, 3] - Sluzbeni, Medunarodni, Oglasni
}
```

**CRAWL Metadata:**

```typescript
{
  maxDepth?: number         // Override default (4)
  maxUrls?: number          // Override default (2000)
  includePatterns?: string[]  // Regex patterns to include
  excludePatterns?: string[]  // Regex patterns to exclude
}
```

**Headless Metadata:**

```typescript
{
  requiresHeadless: true // Forces Playwright rendering
}
```

---

## 4. Outputs

### 4.1 Evidence Records Created

**Database:** `regulatory` (separate from main database)
**Table:** `Evidence`

```typescript
interface Evidence {
  id: string // CUID
  sourceId: string // FK to RegulatorySource
  url: string // Original URL
  rawContent: string // Full content (or base64 for binary)
  contentHash: string // SHA-256 hash for immutability verification
  contentType: string // "html" | "pdf" | "json" | etc.
  contentClass: ContentClass // Classification enum
  hasChanged: boolean // True if content differs from previous version
  changeSummary: string | null
  fetchedAt: Date // Immutable timestamp
  primaryTextArtifactId: string | null // For PDFs with extracted text
}
```

### 4.2 Content Classification

| ContentClass  | Description               | Next Step                              |
| ------------- | ------------------------- | -------------------------------------- |
| `HTML`        | Standard web page         | Extract queue                          |
| `PDF_TEXT`    | PDF with text layer       | Extract queue (text already extracted) |
| `PDF_SCANNED` | Scanned PDF (image-based) | OCR queue                              |
| `DOC`         | Microsoft Word (.doc)     | Extract queue                          |
| `DOCX`        | Microsoft Word (.docx)    | Extract queue                          |
| `XLS`         | Microsoft Excel (.xls)    | Extract queue                          |
| `XLSX`        | Microsoft Excel (.xlsx)   | Extract queue                          |
| `JSON`        | JSON API response         | Extract queue                          |
| `JSON_LD`     | JSON-LD structured data   | Extract queue                          |
| `XML`         | XML document              | Extract queue                          |

### 4.3 Queue Jobs Created for Downstream Workers

**Primary Flow (New Pattern):**

```
Sentinel --> Scout Queue --> Router Queue --> [OCR | Extract | Skip]
```

**Job Payloads:**

```typescript
// Scout Queue Job
{
  name: "scout",
  data: {
    evidenceId: string,
    runId: string,
    parentJobId: string
  },
  opts: { jobId: `scout-${evidenceId}` }
}

// OCR Queue Job (for PDF_SCANNED)
{
  name: "ocr",
  data: {
    evidenceId: string,
    runId: string
  },
  opts: { jobId: `ocr-${evidenceId}` }
}

// Extract Queue Job (for PDF_TEXT)
{
  name: "extract",
  data: {
    evidenceId: string,
    runId: string
  },
  opts: { jobId: `extract-${evidenceId}` }
}

// Evidence Embedding Queue Job
{
  name: "generate-embedding",
  data: {
    evidenceId: string,
    runId: string
  },
  opts: { jobId: `embed-${evidenceId}` }
}
```

### 4.4 DiscoveredItem Records

**Database:** Main application database
**Table:** `DiscoveredItem`

```typescript
interface DiscoveredItem {
  id: string
  endpointId: string
  url: string
  title: string | null
  publishedAt: Date | null
  status: ItemStatus // PENDING | FETCHED | PROCESSED | FAILED | SKIPPED
  contentHash: string | null // Hash of fetched content
  evidenceId: string | null // FK to Evidence if processed
  retryCount: number // Fetch retry counter
  errorMessage: string | null
  processedAt: Date | null
  // Adaptive scanning fields
  nodeType: NodeType // HUB | LEAF | ASSET
  nodeRole: NodeRole | null // INDEX | NEWS_FEED | ARCHIVE | REGULATION | etc.
  freshnessRisk: FreshnessRisk // CRITICAL | HIGH | MEDIUM | LOW
  changeFrequency: number // EWMA velocity (0.0-1.0)
  scanCount: number // Total scans performed
  lastChangedAt: Date | null // Last detected content change
  nextScanDue: Date // Adaptive schedule: when to re-scan
}
```

---

## 5. Dependencies

### 5.1 Database Access

| Connection          | Purpose                                                   | Variable                  |
| ------------------- | --------------------------------------------------------- | ------------------------- |
| Main Database       | DiscoveredItem, DiscoveryEndpoint, SourcePointer, Concept | `DATABASE_URL`            |
| Regulatory Database | Evidence, RegulatorySource, EvidenceArtifact              | `REGULATORY_DATABASE_URL` |

**ORM Clients:**

```typescript
import { db } from "@/lib/db" // Main database (Prisma)
import { dbReg } from "@/lib/db/regulatory" // Regulatory database (Drizzle)
```

### 5.2 HTTP/Fetch Capabilities

**Standard Fetch:**

- `fetchWithRateLimit()` - Rate-limited HTTP client with retry logic
- User-Agent: `FiskAI/1.0 (regulatory-monitoring; +https://fiskai.hr)`

**Headless Fetch (Playwright):**

- `fetchWithHeadless()` - Full browser rendering for JS-heavy sites
- User-Agent: `FiskAI/1.0 (regulatory-monitoring; +https://fiskai.hr) HeadlessFetcher`

### 5.3 Content Parsers

| Parser           | File                          | Purpose                                       |
| ---------------- | ----------------------------- | --------------------------------------------- |
| Sitemap Parser   | `parsers/sitemap-parser.ts`   | XML sitemap and sitemap index parsing         |
| RSS Parser       | `parsers/rss-parser.ts`       | RSS 2.0 and Atom feed parsing                 |
| HTML List Parser | `parsers/html-list-parser.ts` | HTML page scraping with site-specific configs |
| Binary Parser    | `utils/binary-parser.ts`      | PDF, DOCX, XLSX text extraction               |

### 5.4 Tier 1 Structured Fetchers

Direct API integrations that bypass HTML scraping:

| Fetcher         | File                         | Purpose                                          |
| --------------- | ---------------------------- | ------------------------------------------------ |
| HNB Fetcher     | `fetchers/hnb-fetcher.ts`    | Croatian National Bank exchange rates (JSON API) |
| NN Fetcher      | `fetchers/nn-fetcher.ts`     | Narodne novine article metadata                  |
| EUR-Lex Fetcher | `fetchers/eurlex-fetcher.ts` | EU legislation via CELEX identifiers             |
| MRMS Fetcher    | `fetchers/mrms-fetcher.ts`   | Ministry of Labor content                        |
| HOK Fetcher     | `fetchers/hok-fetcher.ts`    | Croatian Chamber of Trades                       |

### 5.5 External Services

| Service                 | Purpose                  | Required |
| ----------------------- | ------------------------ | -------- |
| Redis                   | BullMQ job queue backend | Yes      |
| PostgreSQL (Main)       | DiscoveredItem storage   | Yes      |
| PostgreSQL (Regulatory) | Evidence storage         | Yes      |

---

## 6. Prerequisites

### 6.1 Source Definitions

Discovery endpoints must exist in the `DiscoveryEndpoint` table. The Sentinel:

- Filters to `isActive: true` endpoints
- Skips endpoints with `consecutiveErrors >= 5` (circuit breaker)
- Orders by `priority` (CRITICAL first) then `lastScrapedAt` (oldest first)

### 6.2 RegulatorySource Records

For each domain, a `RegulatorySource` must exist or will be auto-created:

```typescript
// Auto-creation logic in findOrCreateSource()
source = await dbReg.regulatorySource.create({
  data: {
    slug: domain.replace(/\./g, "-").toLowerCase(),
    name: `Auto: ${domain}`,
    url: `https://${domain}`,
    hierarchy: 5, // Default to "Uputa" level
    isActive: true,
  },
})
```

### 6.3 Network Access

The Sentinel requires outbound HTTPS access to:

- All domains in `DiscoveryEndpoint` table
- Croatian government sites (.gov.hr)
- EU sites (eur-lex.europa.eu)
- Financial institutions (hnb.hr, fina.hr)
- Chambers (hok.hr, hgk.hr)

### 6.4 Redis Connectivity

BullMQ requires Redis connection:

```
REDIS_URL=redis://fiskai-redis:6379
```

---

## 7. Triggers

### 7.1 Scheduler Cron Job (Primary)

**Time:** 06:00 daily (Europe/Zagreb timezone)

```typescript
// scheduler.service.ts
cron.schedule(
  "0 6 * * *",
  async () => {
    const runId = `discovery-${Date.now()}`

    // Queue sentinel jobs for all priorities with staggered delays
    await sentinelQueue.add("sentinel-critical", { runId, priority: "CRITICAL" })
    await sentinelQueue.add("sentinel-high", { runId, priority: "HIGH" }, { delay: 60000 })
    await sentinelQueue.add("sentinel-normal", { runId, priority: "NORMAL" }, { delay: 120000 })
    await sentinelQueue.add("sentinel-low", { runId, priority: "LOW" }, { delay: 180000 })
  },
  { timezone: "Europe/Zagreb" }
)
```

### 7.2 Manual Trigger via Script

```bash
# Full discovery run (all priorities)
npx tsx src/lib/regulatory-truth/scripts/run-sentinel.ts

# Specific priority
npx tsx src/lib/regulatory-truth/scripts/run-sentinel.ts CRITICAL

# Fetch-only mode (skip discovery, process pending items)
npx tsx src/lib/regulatory-truth/scripts/run-sentinel.ts --fetch-only

# Force fetch after discovery
npx tsx src/lib/regulatory-truth/scripts/run-sentinel.ts --fetch

# Adaptive scanning mode
npx tsx src/lib/regulatory-truth/scripts/run-sentinel.ts --adaptive
```

### 7.3 Direct Queue Injection

```typescript
import { sentinelQueue } from "@/lib/regulatory-truth/workers/queues"

await sentinelQueue.add("sentinel-manual", {
  runId: `manual-${Date.now()}`,
  priority: "CRITICAL",
})
```

### 7.4 API Endpoint Trigger

No dedicated API endpoint exists. Manual triggers should use:

1. The script method (above)
2. Direct queue injection
3. Admin dashboard (if implemented)

---

## 8. Error Handling

### 8.1 Per-Source Failure Isolation

Each endpoint is processed independently. Errors in one endpoint do not affect others:

```typescript
for (const endpoint of endpoints) {
  const { newItems, error } = await processEndpoint(endpoint, mergedConfig)
  result.newItemsDiscovered += newItems

  if (error) {
    result.errors.push(`${endpoint.name}: ${error}`)
  }
}
```

### 8.2 Retry Logic for Failed Fetches

**HTTP Level (rate-limiter.ts):**

```typescript
// Retryable status codes
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504])

// Retryable error patterns
const RETRYABLE_ERROR_MESSAGES = [
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "socket hang up",
  "network",
  "timeout",
]

// Exponential backoff with jitter
const delay = calculateBackoffDelay(attempt, baseDelayMs, maxDelayMs)
// Formula: random(0, min(maxDelay, baseDelay * 2^attempt))
```

**Item Level (DiscoveredItem):**

```typescript
await db.discoveredItem.update({
  where: { id: item.id },
  data: {
    retryCount: { increment: 1 },
    errorMessage: errorMessage,
    status: item.retryCount >= 2 ? "FAILED" : "PENDING", // 3 total attempts
  },
})
```

### 8.3 Consecutive Failures Tracking

**Endpoint Level:**

```typescript
// On error
await db.discoveryEndpoint.update({
  where: { id: endpoint.id },
  data: {
    consecutiveErrors: { increment: 1 },
    lastError: errorMessage,
  },
})

// On success
await db.discoveryEndpoint.update({
  where: { id: endpoint.id },
  data: {
    consecutiveErrors: 0,
    lastError: null,
  },
})
```

### 8.4 Circuit Breaker

**Threshold:** 5 consecutive errors
**Reset:** Automatic after 1 hour OR manual reset

```typescript
// Circuit breaker constants
const CIRCUIT_BREAKER_THRESHOLD = 5
const CIRCUIT_BREAKER_RESET_MS = 60 * 60 * 1000 // 1 hour

// Check on fetch
if (stats.consecutiveErrors >= CIRCUIT_BREAKER_THRESHOLD) {
  stats.isCircuitBroken = true
  stats.circuitBrokenAt = Date.now()
  throw new Error(`Circuit breaker open for ${domain}`)
}
```

### 8.5 Dead Letter Queue

Failed jobs (after all retries) move to DLQ:

```typescript
// DLQ job structure
interface DeadLetterJobData {
  originalQueue: string
  originalJobId: string | undefined
  originalJobName: string
  originalJobData: unknown
  error: string
  stackTrace?: string
  attemptsMade: number
  failedAt: string
}
```

---

## 9. Guardrails & Safety

### 9.1 Rate Limiting to Sources

**Per-Domain Rate Limiting:**

```typescript
const DEFAULT_CONFIG: RateLimitConfig = {
  requestDelayMs: 2000, // 2 seconds between requests
  maxRequestsPerMinute: 20, // ~30 req/min max
  maxConcurrentRequests: 1, // Single request per domain
  requestTimeoutMs: 30000, // 30 second timeout
}
```

**Headless (Playwright) Rate Limiting:**

```typescript
const HEADLESS_CONFIG: HeadlessRateLimitConfig = {
  requestDelayMs: 12000, // 5 requests per minute
  maxConcurrentRequests: 1, // Single browser instance
  renderTimeoutMs: 30000, // 30 second render timeout
}
```

**Randomized Jitter:**

```typescript
// Avoids predictable patterns that trigger IP bans
function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = minMs + Math.random() * (maxMs - minMs) // 2000-5000ms
  return new Promise((resolve) => setTimeout(resolve, delay))
}
```

### 9.2 Content Hash Deduplication

**Change Detection:**

```typescript
const { hasChanged, newHash } = detectContentChange(content, endpoint.lastContentHash)

if (!hasChanged && endpoint.lastContentHash) {
  console.log(`No changes detected for ${endpoint.name}`)
  return { newItems: 0 }
}
```

**Evidence Deduplication:**

```typescript
// Step 1: Exact hash match
const existingEvidence = await dbReg.evidence.findFirst({
  where: { contentHash },
})

// Step 2: Semantic similarity (if hash match fails)
const similarEvidence = await findSimilarEvidenceByContent(
  content,
  contentType,
  0.9, // 90% similarity threshold
  1 // Only need one match
)
```

**URL Deduplication:**

```typescript
// Deduplicate discovered URLs before creating items
const seenUrls = new Set<string>()
const uniqueUrls = discoveredUrls.filter((item) => {
  if (seenUrls.has(item.url)) return false
  seenUrls.add(item.url)
  return true
})
```

### 9.3 Blocked Domains

Test/debug domains are blocked from pipeline entry:

```typescript
const BLOCKED_DOMAINS = ["heartbeat", "test", "synthetic", "debug"]

export function isBlockedDomain(domain: string): boolean {
  return BLOCKED_DOMAINS.some(
    (blocked) => domain.toLowerCase() === blocked || domain.toLowerCase().includes(blocked)
  )
}
```

### 9.4 Evidence Immutability

Evidence records are immutable after creation:

- `fetchedAt` cannot be updated
- `rawContent` is preserved exactly
- `contentHash` enables integrity verification

```typescript
// Upsert pattern preserves immutability
const evidence = await dbReg.evidence.upsert({
  where: { url_contentHash: { url: item.url, contentHash } },
  create: {
    /* new evidence */
  },
  update: {
    /* no-op: evidence is immutable */
  },
})
```

### 9.5 User-Agent Identification

All requests identify as FiskAI for transparency:

```typescript
headers: {
  "User-Agent": "FiskAI/1.0 (regulatory-monitoring; +https://fiskai.hr)",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9",
  "Accept-Language": "hr,en;q=0.9",
}
```

### 9.6 Robots.txt Respect

Site crawler respects robots.txt by default:

```typescript
// Parse robots.txt
const disallowedPaths = await parseRobotsTxt(domain)

// Check before crawling
if (opts.respectRobots && isDisallowedByRobots(url, disallowedPaths)) {
  result.robotsDisallowed.push(url)
  continue
}
```

---

## 10. Monitoring & Observability

### 10.1 Prometheus Metrics

**File:** `src/lib/regulatory-truth/workers/metrics.ts`

| Metric                         | Type      | Labels                | Description               |
| ------------------------------ | --------- | --------------------- | ------------------------- |
| `worker_jobs_processed_total`  | Counter   | worker, status, queue | Total jobs processed      |
| `worker_job_duration_seconds`  | Histogram | worker, queue         | Job processing time       |
| `worker_queue_depth`           | Gauge     | queue                 | Jobs waiting in queue     |
| `worker_active_jobs`           | Gauge     | worker                | Currently processing jobs |
| `worker_rate_limit_hits_total` | Counter   | worker, domain        | 429 responses             |

### 10.2 Source Health Tracking

**Health Status Structure:**

```typescript
interface EndpointHealthStatus {
  id: string
  domain: string
  name: string
  priority: DiscoveryPriority
  lastSuccessAt: Date | null
  consecutiveErrors: number
  lastError: string | null
  // Computed health flags
  isSlaBreached: boolean // No success in 24h
  hasConsecutiveErrors: boolean // >= 3 consecutive errors
  hoursSinceSuccess: number | null
}
```

**Health Check Schedule:**

```typescript
// 06:30 - After discovery completes
cron.schedule("30 6 * * *", async () => {
  const report = await runEndpointHealthCheck(runId)
})
```

### 10.3 Alerting on Source Failures

**Alert Types:**

1. `ENDPOINT_SLA_BREACH` - No successful scrape in 24 hours
2. `ENDPOINT_CONSECUTIVE_ERRORS` - 3+ consecutive errors
3. `CIRCUIT_BREAKER_OPEN` - Domain circuit breaker triggered

**Alert Flow:**

```
Endpoint Health Check --> raiseAlert() --> WatchdogAlert table
                                       --> Slack notification
```

### 10.4 Structured Logging

```typescript
// Production: JSON format
{
  "timestamp": "2026-01-14T06:00:00.000Z",
  "level": "info",
  "component": "sentinel",
  "message": "Discovered 50 new items from Porezna uprava",
  "operation": "discover",
  "endpointId": "clx123...",
  "metadata": { "newItems": 50 }
}

// Development: Human-readable
[sentinel:discover] Discovered 50 new items from Porezna uprava (https://porezna-uprava.gov.hr/...)
```

### 10.5 SentinelResult Structure

```typescript
interface SentinelResult {
  success: boolean
  endpointsChecked: number
  newItemsDiscovered: number
  errors: string[]
  health?: {
    domains: Record<
      string,
      {
        isHealthy: boolean
        successRate: number
        consecutiveErrors: number
        isCircuitBroken: boolean
        lastSuccessAt?: string
        lastError?: string
      }
    >
    overallHealthy: boolean
  }
  durationMs?: number
  retriesTotal?: number
}
```

---

## 11. Configuration

### 11.1 Environment Variables

| Variable                  | Default       | Description                      |
| ------------------------- | ------------- | -------------------------------- |
| `DATABASE_URL`            | Required      | Main PostgreSQL connection       |
| `REGULATORY_DATABASE_URL` | Required      | Regulatory PostgreSQL connection |
| `REDIS_URL`               | Required      | Redis connection for BullMQ      |
| `NODE_ENV`                | development   | Environment mode                 |
| `DEBUG`                   | -             | Enable debug logging             |
| `WATCHDOG_TIMEZONE`       | Europe/Zagreb | Timezone for scheduling          |

### 11.2 Sentinel Configuration Constants

**File:** `src/lib/regulatory-truth/agents/sentinel.ts`

```typescript
const DEFAULT_CONFIG: SentinelConfig = {
  // Discovery limits
  maxItemsPerRun: 5000, // Safety limit per run
  maxPagesPerEndpoint: 20, // Max pagination pages
  maxSitemapDepth: 5, // Recursive sitemap depth

  // Crawl settings
  crawlMaxDepth: 4, // Link depth for CRAWL strategy
  crawlMaxUrls: 2000, // Max URLs per crawl
  crawlDelayMs: 2000, // Base crawl delay

  // Rate limiting
  delayMinMs: 2000, // Minimum delay between requests
  delayMaxMs: 5000, // Maximum delay (jitter)
  sitemapDelayMs: 2000, // Delay between sitemap requests

  // Reliability
  requestTimeoutMs: 30000, // 30 second timeout
  maxRetries: 3, // Retry attempts
  baseRetryDelayMs: 1000, // Base retry delay
  maxRetryDelayMs: 30000, // Max retry delay
}
```

### 11.3 Source Fetch Intervals

| Frequency      | Interval | Use Case                |
| -------------- | -------- | ----------------------- |
| `EVERY_RUN`    | 0h       | Every sentinel run      |
| `DAILY`        | 24h      | Most regulatory sources |
| `TWICE_WEEKLY` | 84h      | Lower-priority sources  |
| `WEEKLY`       | 168h     | Laws, pravilnici        |
| `MONTHLY`      | 720h     | Rarely-changing sources |

### 11.4 Adaptive Scanning Configuration

**Velocity Profiler:**

```typescript
const DEFAULT_CONFIG: VelocityConfig = {
  warmupScans: 3, // Scans before velocity calculation
  alphaChange: 0.3, // EWMA weight on content change
  alphaStable: 0.1, // EWMA weight on no change
  minFrequency: 0.01, // Floor for velocity
  maxFrequency: 0.99, // Ceiling for velocity
}
```

**Scan Scheduler:**

```typescript
const DEFAULT_CONFIG: ScheduleConfig = {
  baseIntervalHours: 4, // Base interval
  maxIntervalHours: 720, // 30 days max
  jitterPercent: 0.1, // 10% jitter
}

const RISK_FACTORS: Record<FreshnessRisk, number> = {
  CRITICAL: 4.0, // Scan 4x more often
  HIGH: 2.0, // Scan 2x more often
  MEDIUM: 1.0, // Base rate
  LOW: 0.5, // Scan half as often
}
```

---

## 12. Known Issues & Limitations

### 12.1 Source-Specific Quirks

| Source                | Issue                                          | Workaround                        |
| --------------------- | ---------------------------------------------- | --------------------------------- |
| narodne-novine.nn.hr  | Sitemap index with thousands of child sitemaps | NN type filtering (types 1,2,3)   |
| mfin.gov.hr           | Dynamic JavaScript rendering                   | `requiresHeadless: true` metadata |
| hgk.hr                | Heavy JavaScript site                          | `requiresHeadless: true` metadata |
| porezna-uprava.gov.hr | Inconsistent page structure                    | Site-specific CSS selectors       |
| hzzo.hr               | Multiple date formats                          | Flexible date parsing             |

### 12.2 Parsing Edge Cases

1. **PDF Detection:** Some URLs don't have `.pdf` extension but return PDF content-type
   - Solution: Check both URL extension AND Content-Type header

2. **Scanned PDF Detection:** Heuristic-based (text length / page count ratio)
   - Issue: Some PDFs with minimal text are misclassified
   - Solution: Conservative threshold (characters per page)

3. **RSS Date Formats:** Various non-standard formats
   - Solution: Multiple date parsing attempts

4. **HTML Encoding:** Croatian diacritics (č, ć, đ, š, ž)
   - Solution: UTF-8 handling throughout

### 12.3 Rate Limit Sensitivity

Some government sites have aggressive rate limiting:

- `porezna-uprava.gov.hr` - Strict limits, requires 2-5s delays
- `narodne-novine.nn.hr` - Temporary bans on aggressive scraping

### 12.4 Sitemap Consistency

Sitemap URLs don't always match actual page URLs due to:

- URL canonicalization differences
- Trailing slashes
- Query parameter variations

### 12.5 Content Change False Positives

Dynamic page elements can trigger false change detection:

- Timestamps
- Session IDs
- CSRF tokens
- Advertisements

Solution: `normalizeHtmlContent()` removes these before hashing.

### 12.6 Headless Browser Resource Usage

Playwright browsers consume significant memory:

- Each render: ~100-200MB RAM
- Mitigation: Concurrency limited to 1
- Docker limit: 512MB for sentinel worker

### 12.7 Evidence Embedding Failures

Evidence embedding is non-blocking:

```typescript
// NOTE: Embedding is optional enrichment - if it fails, evidence is still valid
try {
  await evidenceEmbeddingQueue.add(...)
} catch (embeddingError) {
  console.log(`[sentinel] EMBEDDING_FAILED reason=${...} (non-blocking)`)
}
```

---

## 13. Source Registry

### 13.1 Priority Tiers

**CRITICAL (8 sources):**

- Porezna uprava - Pausalno oporezivanje
- Porezna uprava - Pausalno oporezivanje obrtnika
- Narodne novine - Zakon o porezu na dohodak
- HZMO - Doprinosi za mirovinsko osiguranje
- HZZO - Doprinosi za zdravstveno osiguranje
- Porezna uprava - Stope doprinosa
- Porezna uprava - Prag za upis u registar PDV-a
- Porezna uprava - Porezni kalendar

**HIGH (25 sources):**

- Zakon o PDV-u, Zakon o fiskalizaciji, Zakon o obrtu
- Pravilnici (PDV, dohodak, fiskalizacija, doprinosi)
- FINA services, HNB rates
- Godisnja porezna prijava, JOPPD

**MEDIUM (28 sources):**

- Ministry pages, DZS statistics
- Chambers, EU legislation
- Additional Porezna uprava pages

**LOW (10 sources):**

- Corporate tax, special taxes
- Rarely-changing institutional pages

### 13.2 Domain Categories

| Domain Category  | Count | Key Domains                                      |
| ---------------- | ----- | ------------------------------------------------ |
| Government       | 35    | porezna-uprava.gov.hr, mfin.gov.hr, vlada.gov.hr |
| Official Gazette | 12    | narodne-novine.nn.hr                             |
| Financial        | 8     | fina.hr, hnb.hr                                  |
| Social Insurance | 6     | mirovinsko.hr, hzzo.hr                           |
| Chambers         | 4     | hok.hr, hgk.hr                                   |
| EU               | 2     | eur-lex.europa.eu                                |
| Statistics       | 4     | dzs.hr                                           |

### 13.3 Regulatory Hierarchy

| Level | Type        | Example                         |
| ----- | ----------- | ------------------------------- |
| 1     | Ustav       | Croatian Constitution           |
| 2     | Zakon       | Zakon o PDV-u, Zakon o obrtu    |
| 3     | Podzakonski | Government decisions            |
| 4     | Pravilnik   | Pravilnik o PDV-u               |
| 5     | Uputa       | Porezna uprava instructions     |
| 6     | Misljenje   | Official interpretations        |
| 7     | Praksa      | Chamber practices, case studies |

---

## Appendix A: Content Classification

### A.1 Classification Decision Tree

```
URL received
    |
    +--[ends with .pdf OR Content-Type contains pdf]
    |   |
    |   +--[Text extractable & text/page > threshold]
    |   |   --> PDF_TEXT (queue: extract)
    |   |
    |   +--[Low/no text extraction]
    |       --> PDF_SCANNED (queue: ocr)
    |
    +--[ends with .doc/.docx OR Content-Type contains msword]
    |   --> DOC/DOCX (queue: extract)
    |
    +--[ends with .xls/.xlsx OR Content-Type contains spreadsheet]
    |   --> XLS/XLSX (queue: extract)
    |
    +--[Content-Type contains json]
    |   --> JSON or JSON_LD (queue: extract)
    |
    +--[Content-Type contains xml]
    |   --> XML (queue: extract)
    |
    +--[Default]
        --> HTML (queue: extract)
```

### A.2 Scanned PDF Detection

```typescript
// From ocr-processor.ts
export function isScannedPdf(extractedText: string, pageCount: number): boolean {
  const textLength = extractedText.trim().length
  const charsPerPage = textLength / Math.max(1, pageCount)

  // If less than 100 characters per page, likely scanned
  return charsPerPage < 100
}
```

---

## Appendix B: Listing Strategies

### B.1 SITEMAP_XML

Parses standard XML sitemaps (sitemap.xml, sitemap_index.xml):

```typescript
// Supports:
// - Standard sitemap (urlset)
// - Sitemap index (sitemapindex)
// - Recursive scanning (depth-limited)
// - NN-specific type filtering

const entries = parseSitemap(content)
// Returns: [{ url, lastmod?, priority? }]
```

### B.2 RSS_FEED

Parses RSS 2.0 and Atom feeds:

```typescript
// Supports:
// - RSS 2.0 (<rss><channel><item>)
// - Atom 1.0 (<feed><entry>)
// - URL pattern filtering
// - Date range filtering

const items = await parseRSSFeed(content)
// Returns: [{ url, title, date, description }]
```

### B.3 HTML_LIST

Scrapes HTML pages using CSS selectors:

```typescript
// Site-specific configurations
const SITE_CONFIGS = {
  "hzzo.hr": {
    itemSelector: "article, .news-item, .vijest",
    linkSelector: "a",
    titleSelector: "h2, h3, .title",
    dateSelector: ".date, time",
  },
  "porezna-uprava.gov.hr": {
    itemSelector: ".views-row, article",
    // ...
  },
}
```

### B.4 PAGINATION

Extends HTML_LIST with pagination support:

```typescript
// Finds pagination links
const paginationLinks = findPaginationLinks(content, baseUrl, maxPages)

// Patterns detected:
// - .pager a, .pagination a
// - ?page=N query parameters
```

### B.5 CRAWL

Recursive site crawling for sites without sitemaps:

```typescript
// Features:
// - Depth-limited BFS crawl
// - robots.txt respect
// - Document link extraction
// - URL normalization and deduplication
// - Include/exclude patterns

const result = await crawlSite(seedUrl, {
  maxDepth: 4,
  maxUrls: 2000,
  includePatterns: [/\/propisi\//],
  excludePatterns: [/\/login\//],
})
```

---

## Appendix C: Adaptive Scanning

### C.1 Node Classification

URLs are classified by type and role:

**Node Types:**

- `HUB` - Index/listing pages (many outbound links)
- `LEAF` - Content pages (final destination)
- `ASSET` - Downloadable documents (PDF, DOCX, etc.)

**Node Roles:**

- `INDEX` - Table of contents, navigation
- `NEWS_FEED` - News/announcement listings
- `ARCHIVE` - Historical content
- `REGULATION` - Laws, regulations
- `GUIDANCE` - Instructions, interpretations
- `FORM` - Downloadable forms

### C.2 Velocity Profiling

Content change frequency tracked using EWMA:

```typescript
// Exponentially Weighted Moving Average
newFrequency = alpha * signal + (1 - alpha) * currentFrequency

// Where:
// - signal = 1.0 if content changed, 0.0 otherwise
// - alpha = 0.3 for changes, 0.1 for stability
```

**Velocity Descriptions:**

- `volatile` (0.8-1.0): Changes frequently
- `active` (0.5-0.8): Regular updates
- `moderate` (0.2-0.5): Occasional changes
- `static` (0.0-0.2): Rarely changes

### C.3 Scan Scheduling

Next scan time calculated from velocity and risk:

```typescript
intervalHours = baseInterval / (velocity * riskFactor)

// Risk factors:
// CRITICAL: 4x more frequent
// HIGH: 2x more frequent
// MEDIUM: 1x (base rate)
// LOW: 0.5x less frequent

// Example: velocity=0.5, risk=CRITICAL
// interval = 4h / (0.5 * 4.0) = 2 hours
```

---

## Document Revision History

| Version | Date       | Author          | Changes                     |
| ------- | ---------- | --------------- | --------------------------- |
| 1.0.0   | 2026-01-14 | Claude Opus 4.5 | Initial comprehensive audit |

---

_This document is part of the FiskAI Product Bible. For related documentation, see:_

- [01-VISION-ARCHITECTURE.md](./01-VISION-ARCHITECTURE.md) - System architecture overview
- [08-APPENDIXES.md](./08-APPENDIXES.md) - Technical appendixes
- [REGULATORY_TRUTH_LAYER.md](../01_ARCHITECTURE/REGULATORY_TRUTH_LAYER.md) - Full RTL specification
