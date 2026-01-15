# APPENDIX: Continuous-Drainer Worker Audit

> **Document Type:** Stakeholder-Grade Audit
> **Worker:** `continuous-drainer`
> **Audit Date:** 2026-01-14
> **Canonical Source:** `/src/lib/regulatory-truth/workers/continuous-drainer.worker.ts`

---

## Table of Contents

1. [Overview and Purpose](#overview-and-purpose)
2. [Queues Drained](#queues-drained)
3. [Continuous Draining Mechanism](#continuous-draining-mechanism)
4. [Inputs](#inputs)
5. [Outputs](#outputs)
6. [Dependencies](#dependencies)
7. [Configuration](#configuration)
8. [Error Handling and Recovery](#error-handling-and-recovery)
9. [Circuit Breaker Behavior](#circuit-breaker-behavior)
10. [State Management](#state-management)
11. [Known Limitations](#known-limitations)
12. [Recommended Improvements](#recommended-improvements)
13. [Operational Reference](#operational-reference)

---

## Overview and Purpose

### Executive Summary

The **continuous-drainer worker** is a Layer B component of FiskAI's Regulatory Truth Layer (RTL) that operates 24/7 to ensure the regulatory processing pipeline never stalls. Unlike other workers that process individual queue jobs, the drainer is a **meta-worker** that monitors database state and populates the downstream BullMQ queues.

### Role in the RTL Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         LAYER A                                     │
│                    DAILY DISCOVERY                                  │
│   Scheduler → Sentinel → Evidence Records + Initial Queue Jobs     │
└──────────────────────────────────────────────┬──────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         LAYER B                                     │
│                    24/7 PROCESSING                                  │
│                                                                     │
│   ┌───────────────────────────────────────────────────────────┐    │
│   │              CONTINUOUS DRAINER                            │    │
│   │  Monitors DB state → Populates downstream queues          │    │
│   └────────────────────────────┬──────────────────────────────┘    │
│                                │                                    │
│   ┌─────┐   ┌─────┐   ┌─────┐ │ ┌─────┐   ┌─────┐   ┌─────┐       │
│   │ OCR │──▶│Extr.│──▶│Comp.│─┼▶│Rev. │──▶│Arb. │──▶│Rel. │       │
│   └─────┘   └─────┘   └─────┘   └─────┘   └─────┘   └─────┘       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Core Responsibilities

1. **Backlog Detection:** Continuously polls the database for items stuck at each pipeline stage
2. **Queue Population:** Creates BullMQ jobs to process stuck items
3. **Pipeline Continuity:** Ensures processing continues even if jobs fail or workers restart
4. **Rate Control:** Implements exponential backoff when idle to minimize database load
5. **Health Telemetry:** Updates Redis heartbeats for external watchdog monitoring

### Why It Exists

Without the continuous-drainer:

- Items could get stuck if a worker crashes before creating the next-stage job
- Database state and queue state could drift apart
- Manual intervention would be required to restart stalled pipelines
- There would be no recovery mechanism for dropped jobs

---

## Queues Drained

The drainer monitors 7 distinct stages and populates 6 different BullMQ queues:

| Stage                | Database Query                                                        | Target Queue                                  | Batch Size |
| -------------------- | --------------------------------------------------------------------- | --------------------------------------------- | ---------- |
| **pending-items**    | `DiscoveredItem.status = PENDING`                                     | N/A (calls `fetchDiscoveredItems()` directly) | 50         |
| **pending-ocr**      | `Evidence.contentClass = PDF_SCANNED` without `primaryTextArtifactId` | `ocrQueue`                                    | 10         |
| **fetched-evidence** | `DiscoveredItem.status = FETCHED` without `SourcePointer`             | `extractQueue`                                | 50         |
| **source-pointers**  | `SourcePointer` without linked rules                                  | `composeQueue`                                | 50         |
| **draft-rules**      | `RegulatoryRule.status = DRAFT`                                       | `reviewQueue`                                 | 100        |
| **conflicts**        | `RegulatoryConflict.status = OPEN`                                    | `arbiterQueue`                                | 10         |
| **approved-rules**   | `RegulatoryRule.status = APPROVED` without releases                   | `releaseQueue`                                | 20         |

### Queue Definitions (from `queues.ts`)

```typescript
extractQueue = createQueue("extract", { max: 10, duration: 60000 })
ocrQueue = createQueue("ocr", { max: 2, duration: 60000 })
composeQueue = createQueue("compose", { max: 5, duration: 60000 })
reviewQueue = createQueue("review", { max: 5, duration: 60000 })
arbiterQueue = createQueue("arbiter", { max: 3, duration: 60000 })
releaseQueue = createQueue("release", { max: 2, duration: 60000 })
```

---

## Continuous Draining Mechanism

### Main Loop

The drainer operates an infinite `while` loop that runs drain cycles:

```typescript
async function startContinuousDraining(): Promise<void> {
  console.log("[drainer] Starting continuous draining loop...")
  console.log("[drainer] This worker will run 24/7 until saturation")
  state.isRunning = true

  while (state.isRunning) {
    const workDone = await runDrainCycle()

    if (workDone) {
      resetBackoff()
      // Log every 10 cycles when active
      if (state.stats.cycleCount % 10 === 0) {
        logState()
      }
    } else {
      increaseBackoff()
      // Log every backoff increase when idle
      console.log(`[drainer] No work found, backing off for ${BACKOFF.currentDelay}ms`)
    }

    // Wait before next cycle
    await new Promise((resolve) => setTimeout(resolve, BACKOFF.currentDelay))
  }
}
```

### Drain Cycle Execution

Each cycle executes stages sequentially:

```
Stage 1: drainPendingItems()        → Fetch PENDING discovered items
Stage 1.5: drainPendingOcr()        → Queue scanned PDFs for OCR
Stage 2: drainFetchedEvidence()     → Queue evidence for extraction
         OR drainForClassification() → (if CLASSIFICATION_ENABLED=true)
Stage 3: drainSourcePointers()      → Queue pointers for composition
Stage 4: drainDraftRules()          → Queue drafts for review
Stage 5: drainConflicts()           → Queue conflicts for arbiter
Stage 6: drainApprovedRules()       → Queue approved rules for release
```

### Backoff Strategy

| Parameter    | Value            | Purpose                    |
| ------------ | ---------------- | -------------------------- |
| `minDelay`   | 1000ms (1 sec)   | Delay when work exists     |
| `maxDelay`   | 60000ms (60 sec) | Maximum idle delay         |
| `multiplier` | 2                | Exponential backoff factor |

**Behavior:**

- When work is found: delay resets to 1 second
- When idle: delay doubles each cycle up to 60 seconds
- Prevents database polling storms during quiet periods

---

## Inputs

### Trigger Mechanism

The continuous-drainer is **self-triggering** via its infinite loop. It does not consume jobs from any BullMQ queue. Instead, it:

1. **Polls the database** at regular intervals
2. **Queries specific conditions** that indicate work is needed
3. **Creates queue jobs** for downstream workers

### Database Queries

#### Stage 1: Pending Items

```typescript
const pendingCount = await db.discoveredItem.count({
  where: { status: "PENDING", retryCount: { lt: 3 } },
})
```

#### Stage 1.5: Pending OCR

```typescript
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
```

#### Stage 2: Fetched Evidence

```typescript
const fetchedItems = await db.discoveredItem.findMany({
  where: {
    status: "FETCHED",
    evidenceId: { not: null },
  },
  select: { evidenceId: true },
  take: 100,
})

// Filter to only evidence without source pointers
const existingPointers = await db.sourcePointer.findMany({
  where: { evidenceId: { in: evidenceIds } },
  select: { evidenceId: true },
  distinct: ["evidenceId"],
})
```

#### Stage 3: Source Pointers

```typescript
const pointers = await db.sourcePointer.findMany({
  where: {
    rules: { none: {} },
  },
  select: { id: true, domain: true },
  take: 50,
})
```

#### Stage 4: Draft Rules

```typescript
const drafts = await db.regulatoryRule.findMany({
  where: { status: "DRAFT" },
  select: { id: true },
  take: 100,
})
```

#### Stage 5: Conflicts

```typescript
const conflicts = await db.regulatoryConflict.findMany({
  where: { status: "OPEN" },
  select: { id: true },
  take: 10,
})
```

#### Stage 6: Approved Rules

```typescript
const approved = await db.regulatoryRule.findMany({
  where: {
    status: "APPROVED",
    releases: { none: {} },
  },
  select: { id: true },
  take: 20,
})
```

---

## Outputs

### Queue Jobs Created

Each stage creates jobs with specific formats:

#### OCR Jobs

```typescript
{
  name: "ocr",
  data: { evidenceId: string, runId: string },
  opts: { jobId: `ocr-${evidenceId}` }
}
```

#### Extract Jobs

```typescript
{
  name: "extract",
  data: { evidenceId: string, runId: string },
  opts: { jobId: `extract-${evidenceId}` }
}
```

#### Compose Jobs

```typescript
{
  name: "compose",
  data: { pointerIds: string[], domain: string, runId: string },
  opts: { jobId: `compose-${domain}-${sortedIds}` }
}
```

#### Review Jobs

```typescript
{
  name: "review",
  data: { ruleId: string, runId: string },
  opts: { jobId: `review-${ruleId}` }
}
```

#### Arbiter Jobs

```typescript
{
  name: "arbiter",
  data: { conflictId: string, runId: string },
  opts: { jobId: `arbiter-${conflictId}` }
}
```

#### Release Jobs

```typescript
{
  name: "release",
  data: { ruleIds: string[], runId: string },
  opts: { jobId: `release-${sortedRuleIds}` }
}
```

### Job ID Stability

All jobs use **deterministic job IDs** based on the entity being processed. This ensures:

- **Idempotency:** Re-running drainPendingOcr() for the same evidence won't create duplicate jobs
- **Deduplication:** BullMQ ignores jobs with existing IDs
- **Traceability:** Job IDs can be traced back to source entities

For jobs with multiple entities (compose, release), IDs are **sorted before joining** to ensure stability:

```typescript
const sortedIds = [...pointerIds].sort().join(",")
await composeQueue.add("compose", { ... }, { jobId: `compose-${domain}-${sortedIds}` })
```

### Redis Heartbeats

After each cycle, the drainer updates Redis with health telemetry:

```typescript
await updateDrainerHeartbeat({
  lastActivity: state.lastActivity.toISOString(),
  queueName: workDone ? "active" : "idle",
  itemsProcessed: totalItemsProcessed,
  cycleCount: state.stats.cycleCount,
})
```

**Redis Keys:**

- `regulatory-truth:drainer:heartbeat` - Overall drainer status
- `regulatory-truth:drainer:stats` - Detailed statistics hash
- `regulatory-truth:drainer:stages` - Per-stage heartbeats (Issue #807 fix)

---

## Dependencies

### Infrastructure

| Dependency                  | Purpose                                                           | Failure Impact                              |
| --------------------------- | ----------------------------------------------------------------- | ------------------------------------------- |
| **Redis**                   | BullMQ queue backend, heartbeat storage                           | Fatal - cannot create jobs or report health |
| **PostgreSQL (main)**       | DiscoveredItem, SourcePointer, RegulatoryRule, RegulatoryConflict | Fatal - cannot query work items             |
| **PostgreSQL (regulatory)** | Evidence table                                                    | Fatal for OCR stage                         |

### Internal Modules

```typescript
import {
  extractQueue,
  composeQueue,
  reviewQueue,
  arbiterQueue,
  releaseQueue,
  ocrQueue,
} from "./queues"

import { db, dbReg } from "@/lib/db"
import { fetchDiscoveredItems } from "../agents/sentinel"
import { closeRedis, updateDrainerHeartbeat, updateStageHeartbeat } from "./redis"
import { logWorkerStartup } from "./startup-log"
import { createCircuitBreaker } from "./circuit-breaker"
import { FeatureFlags } from "./utils/feature-flags"
```

### Downstream Workers

The drainer depends on these workers to consume the jobs it creates:

| Worker                | Queue          | Consumes Jobs From Drainer |
| --------------------- | -------------- | -------------------------- |
| `ocr.worker.ts`       | `ocrQueue`     | Yes                        |
| `extractor.worker.ts` | `extractQueue` | Yes                        |
| `composer.worker.ts`  | `composeQueue` | Yes                        |
| `reviewer.worker.ts`  | `reviewQueue`  | Yes                        |
| `arbiter.worker.ts`   | `arbiterQueue` | Yes                        |
| `releaser.worker.ts`  | `releaseQueue` | Yes                        |

---

## Configuration

### Environment Variables

| Variable                  | Default                  | Purpose                                    |
| ------------------------- | ------------------------ | ------------------------------------------ |
| `REDIS_URL`               | `redis://localhost:6379` | Redis connection for queues and heartbeats |
| `DATABASE_URL`            | Required                 | Main PostgreSQL connection                 |
| `REGULATORY_DATABASE_URL` | Required                 | Regulatory database connection             |
| `CLASSIFICATION_ENABLED`  | `false`                  | Feature flag for classification pipeline   |
| `NODE_ENV`                | `development`            | Environment mode                           |

### Docker Compose Configuration

From `docker-compose.workers.yml`:

```yaml
worker-continuous-drainer:
  <<: *worker-common
  container_name: fiskai-worker-continuous-drainer
  command: ["node", "dist/workers/lib/regulatory-truth/workers/continuous-drainer.worker.js"]
  environment:
    <<: *worker-env
    WORKER_TYPE: continuous-drainer
  deploy:
    resources:
      limits:
        memory: 256M
```

**Key Points:**

- **Memory Limit:** 256MB (lowest among workers, appropriate for I/O-bound work)
- **No concurrency setting:** Single-threaded by design
- **No LLM dependencies:** Does not need Ollama or OpenAI configuration

### Feature Flags

```typescript
export const FeatureFlags = {
  get classificationEnabled(): boolean {
    return process.env.CLASSIFICATION_ENABLED === "true"
  },
} as const
```

When `CLASSIFICATION_ENABLED=true`:

- Stage 2 calls `drainForClassification()` instead of `drainFetchedEvidence()`
- Currently a stub returning 0 (classification pipeline not yet implemented)

---

## Error Handling and Recovery

### Stage-Level Error Isolation

Each stage is wrapped in try-catch to prevent one failure from stopping the entire cycle:

```typescript
// Stage 1: Fetch PENDING items → Evidence
try {
  const fetched = await executeStage("pending-items", drainPendingItems)
  if (fetched > 0) {
    workDone = true
    console.log(`[drainer] Stage 1: Fetched ${fetched} items`)
  }
} catch (error) {
  console.error("[drainer] Stage 1 error:", error instanceof Error ? error.message : error)
}

// Stage 2, 3, 4, 5, 6 follow same pattern...
```

### Heartbeat Update Resilience

Heartbeat updates use non-blocking error handling:

```typescript
await updateDrainerHeartbeat({ ... }).catch((err) => {
  // Don't fail the cycle if heartbeat update fails
  console.error("[drainer] Failed to update heartbeat:", err instanceof Error ? err.message : err)
})
```

### Graceful Shutdown

The worker handles SIGTERM and SIGINT for container orchestration:

```typescript
async function shutdown(signal: string): Promise<void> {
  console.log(`[drainer] Received ${signal}, shutting down...`)
  state.isRunning = false
  logState()
  await closeRedis()
  process.exit(0)
}

process.on("SIGTERM", () => void shutdown("SIGTERM"))
process.on("SIGINT", () => void shutdown("SIGINT"))
```

**Behavior:**

1. Sets `state.isRunning = false` to break the main loop
2. Logs final statistics
3. Closes Redis connection gracefully
4. Exits with code 0

### Fatal Error Handling

Uncaught errors in the main loop cause immediate exit:

```typescript
startContinuousDraining().catch((error) => {
  console.error("[drainer] Fatal error:", error)
  process.exit(1)
})
```

---

## Circuit Breaker Behavior

### Per-Stage Circuit Breakers

Each stage has its own circuit breaker to prevent cascading failures:

```typescript
const stageCircuitBreakers = {
  "pending-items": createCircuitBreaker<number>(..., {
    timeout: 300000,          // 5 minute timeout
    name: "drainer-pending-items",
    errorThresholdPercentage: 30,
  }),
  "pending-ocr": createCircuitBreaker<number>(...),
  "fetched-evidence": createCircuitBreaker<number>(...),
  "source-pointers": createCircuitBreaker<number>(...),
  "draft-rules": createCircuitBreaker<number>(...),
  "conflicts": createCircuitBreaker<number>(...),
  "approved-rules": createCircuitBreaker<number>(...),
}
```

### Circuit Breaker Configuration

| Parameter                  | Value            | Meaning                                 |
| -------------------------- | ---------------- | --------------------------------------- |
| `timeout`                  | 300000ms (5 min) | Maximum execution time per stage        |
| `errorThresholdPercentage` | 30%              | Opens circuit when 30% of requests fail |
| `resetTimeout`             | 300000ms (5 min) | Time before half-open retry (default)   |

### Circuit States

The `opossum` circuit breaker library provides three states:

1. **CLOSED (Normal):** Requests flow through normally
2. **OPEN (Tripped):** Requests fail fast without executing
3. **HALF-OPEN (Testing):** One request allowed to test recovery

### Circuit Breaker Events

```typescript
breaker.on("open", () => {
  console.warn(`[circuit-breaker] ${options.name} OPENED - requests will fail fast`)
})

breaker.on("halfOpen", () => {
  console.info(`[circuit-breaker] ${options.name} HALF-OPEN - testing recovery`)
})

breaker.on("close", () => {
  console.info(`[circuit-breaker] ${options.name} CLOSED - back to normal`)
})
```

### Execution Through Circuit Breaker

```typescript
async function executeStage(
  stageName: string,
  stageFunction: () => Promise<number>
): Promise<number> {
  const startTime = Date.now()
  let itemsProcessed = 0

  try {
    const breaker = stageCircuitBreakers[stageName]
    itemsProcessed = (await breaker.fire(stageFunction)) as number

    // Update metrics and heartbeat on success
    stageMetrics[stageName].itemsProcessed += itemsProcessed
    stageMetrics[stageName].totalDurationMs += Date.now() - startTime
    delete stageMetrics[stageName].lastError

    await updateStageHeartbeat({ ... })
    return itemsProcessed
  } catch (err) {
    // Update metrics and heartbeat on failure
    stageMetrics[stageName].lastError = error.message
    await updateStageHeartbeat({ ..., lastError: error.message })
    throw error
  }
}
```

---

## State Management

### DrainerState Interface

```typescript
interface DrainerState {
  isRunning: boolean
  lastActivity: Date
  stats: {
    itemsFetched: number
    ocrJobsQueued: number
    classifyJobsQueued: number
    extractJobsQueued: number
    composeJobsQueued: number
    reviewJobsQueued: number
    arbiterJobsQueued: number
    releaseJobsQueued: number
    cycleCount: number
  }
}
```

### Per-Stage Metrics

```typescript
interface StageMetrics {
  itemsProcessed: number
  totalDurationMs: number
  lastError?: string
}

const stageMetrics: Record<string, StageMetrics> = {
  "pending-items": { itemsProcessed: 0, totalDurationMs: 0 },
  "pending-ocr": { itemsProcessed: 0, totalDurationMs: 0 },
  "fetched-evidence": { itemsProcessed: 0, totalDurationMs: 0 },
  "source-pointers": { itemsProcessed: 0, totalDurationMs: 0 },
  "draft-rules": { itemsProcessed: 0, totalDurationMs: 0 },
  conflicts: { itemsProcessed: 0, totalDurationMs: 0 },
  "approved-rules": { itemsProcessed: 0, totalDurationMs: 0 },
}
```

### State Logging

Periodic logging occurs every 10 active cycles:

```typescript
function logState(): void {
  console.log(`[drainer] Stats after cycle ${state.stats.cycleCount}:`, {
    itemsFetched: state.stats.itemsFetched,
    ocrJobs: state.stats.ocrJobsQueued,
    classifyJobs: state.stats.classifyJobsQueued,
    extractJobs: state.stats.extractJobsQueued,
    composeJobs: state.stats.composeJobsQueued,
    reviewJobs: state.stats.reviewJobsQueued,
    arbiterJobs: state.stats.arbiterJobsQueued,
    releaseJobs: state.stats.releaseJobsQueued,
    classificationEnabled: FeatureFlags.classificationEnabled,
    backoffDelay: `${BACKOFF.currentDelay}ms`,
  })
}
```

---

## Known Limitations

### 1. Single Instance Design

**Limitation:** Only one continuous-drainer instance should run at a time.

**Impact:** Running multiple instances would create duplicate jobs and race conditions.

**Mitigation:** Docker Compose enforces single container. No built-in distributed locking.

### 2. Sequential Stage Processing

**Limitation:** Stages execute sequentially within each cycle.

**Impact:** A slow stage (e.g., pending-items) delays all subsequent stages.

**Mitigation:** Per-stage circuit breakers with 5-minute timeout prevent infinite blocking.

### 3. No Queue Depth Awareness

**Limitation:** The drainer doesn't check existing queue depth before adding jobs.

**Impact:** Could overwhelm downstream workers with burst of jobs.

**Mitigation:**

- Deterministic job IDs prevent true duplicates
- Batch sizes are capped (10-100 per stage)
- Queue rate limiters in downstream workers

### 4. Database Polling Overhead

**Limitation:** Each cycle queries multiple database tables.

**Impact:** Creates database load even when idle (mitigated by backoff).

**Queries per cycle:**

- 6-7 SELECT queries (one per stage)
- Additional queries for filtering (e.g., existing pointers)

### 5. Classification Pipeline Stub

**Limitation:** `drainForClassification()` is not implemented.

**Impact:** When `CLASSIFICATION_ENABLED=true`, Stage 2 does nothing.

**From code:**

```typescript
async function drainForClassification(): Promise<number> {
  // TODO: Implement when classification queue and worker are ready
  console.log("[drainer] Classification not yet implemented - skipping")
  return 0
}
```

### 6. No Priority Ordering

**Limitation:** Items are queued in database order, not by priority.

**Impact:** High-priority items (T0, T1) may wait behind low-priority items.

### 7. Memory-Only State

**Limitation:** Statistics and cycle counts are not persisted.

**Impact:** State is lost on restart. Only Redis heartbeats persist.

---

## Recommended Improvements

### High Priority

#### 1. Distributed Locking

**Problem:** No protection against multiple drainer instances.
**Solution:** Implement Redis-based distributed lock (e.g., Redlock pattern).

```typescript
const lock = await redlock.acquire(["drainer:lock"], 60000)
try {
  await runDrainCycle()
} finally {
  await lock.release()
}
```

#### 2. Queue Depth Check Before Draining

**Problem:** Could overwhelm downstream workers.
**Solution:** Check queue depth and skip draining if above threshold.

```typescript
const waiting = await extractQueue.getWaitingCount()
if (waiting > MAX_WAITING_THRESHOLD) {
  console.log(`[drainer] extractQueue has ${waiting} waiting, skipping`)
  return 0
}
```

#### 3. Priority-Based Ordering

**Problem:** High-priority items may wait.
**Solution:** Add risk tier ordering to database queries.

```typescript
const drafts = await db.regulatoryRule.findMany({
  where: { status: "DRAFT" },
  orderBy: { riskTier: "asc" }, // T0 first, then T1, T2, T3
  take: 100,
})
```

### Medium Priority

#### 4. Implement Classification Pipeline

**Problem:** Feature flag exists but functionality is missing.
**Solution:** Complete Task 11 (Docker Worker Infrastructure Hardening).

#### 5. Prometheus Metrics Export

**Problem:** Metrics only visible in logs and Redis.
**Solution:** Export metrics in Prometheus format for Grafana dashboards.

```typescript
export const drainerCycleCounter = new Counter({
  name: "drainer_cycles_total",
  help: "Total drain cycles executed",
})
```

#### 6. Configurable Batch Sizes

**Problem:** Batch sizes are hardcoded.
**Solution:** Allow environment variable overrides.

```typescript
const OCR_BATCH_SIZE = parseInt(process.env.DRAINER_OCR_BATCH || "10")
```

### Low Priority

#### 7. Parallel Stage Execution

**Problem:** Sequential execution slows total cycle time.
**Solution:** Execute independent stages in parallel.

```typescript
await Promise.all([
  executeStage("pending-ocr", drainPendingOcr),
  executeStage("conflicts", drainConflicts),
])
```

#### 8. State Persistence

**Problem:** Statistics lost on restart.
**Solution:** Persist state to Redis or database.

#### 9. Retry Count Tracking

**Problem:** Items that repeatedly fail aren't tracked specially.
**Solution:** Implement dead letter handling for repeatedly-failing items.

---

## Operational Reference

### Starting the Worker

```bash
# Via Docker Compose (recommended)
docker compose -f docker-compose.workers.yml up -d worker-continuous-drainer

# Direct execution (development)
npx tsx src/lib/regulatory-truth/workers/continuous-drainer.worker.ts
```

### Checking Worker Health

```bash
# View logs
docker logs fiskai-worker-continuous-drainer --tail 100 -f

# Check Redis heartbeat
redis-cli GET "regulatory-truth:drainer:heartbeat"

# Check stage heartbeats
redis-cli HGETALL "regulatory-truth:drainer:stages"

# Check idle time
redis-cli GET "regulatory-truth:drainer:heartbeat" | jq '.lastActivity'
```

### Monitoring Queries

```sql
-- Pending items by stage
SELECT
  'pending' as stage,
  COUNT(*) as count
FROM "DiscoveredItem"
WHERE status = 'PENDING' AND "retryCount" < 3

UNION ALL

SELECT
  'fetched' as stage,
  COUNT(*) as count
FROM "DiscoveredItem"
WHERE status = 'FETCHED' AND "evidenceId" IS NOT NULL

UNION ALL

SELECT
  'draft' as stage,
  COUNT(*) as count
FROM "RegulatoryRule"
WHERE status = 'DRAFT'

UNION ALL

SELECT
  'approved' as stage,
  COUNT(*) as count
FROM "RegulatoryRule"
WHERE status = 'APPROVED';
```

### Troubleshooting

#### Drainer Not Processing Items

1. **Check circuit breaker state:**

   ```bash
   docker logs fiskai-worker-continuous-drainer 2>&1 | grep "circuit-breaker"
   ```

2. **Check Redis connectivity:**

   ```bash
   docker exec fiskai-worker-continuous-drainer redis-cli -u $REDIS_URL ping
   ```

3. **Check database connectivity:**
   ```bash
   docker logs fiskai-worker-continuous-drainer 2>&1 | grep "error"
   ```

#### Drainer Stuck in Backoff

1. **Check for work items in database** (queries above)
2. **Restart the worker:**
   ```bash
   docker compose -f docker-compose.workers.yml restart worker-continuous-drainer
   ```

#### High Database Load

1. **Increase minimum backoff:**

   ```yaml
   environment:
     DRAINER_MIN_DELAY_MS: 5000 # (if implemented)
   ```

2. **Reduce batch sizes in code** (requires deployment)

---

## Appendix: Key Files

| File                                                            | Purpose                                  |
| --------------------------------------------------------------- | ---------------------------------------- |
| `src/lib/regulatory-truth/workers/continuous-drainer.worker.ts` | Main worker implementation               |
| `src/lib/regulatory-truth/workers/queues.ts`                    | Queue definitions                        |
| `src/lib/regulatory-truth/workers/redis.ts`                     | Redis connection and heartbeat functions |
| `src/lib/regulatory-truth/workers/circuit-breaker.ts`           | Circuit breaker factory                  |
| `src/lib/regulatory-truth/workers/utils/feature-flags.ts`       | Feature flag definitions                 |
| `src/lib/regulatory-truth/workers/startup-log.ts`               | Worker startup logging                   |
| `src/lib/regulatory-truth/agents/sentinel.ts`                   | `fetchDiscoveredItems()` function        |
| `docker-compose.workers.yml`                                    | Container configuration                  |

---

## Document History

| Date       | Version | Author          | Changes                     |
| ---------- | ------- | --------------- | --------------------------- |
| 2026-01-14 | 1.0     | Claude Opus 4.5 | Initial comprehensive audit |

---

_This document was generated as part of the RTL worker audit initiative. For questions or updates, refer to the canonical source files listed above._
