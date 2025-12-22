# Regulatory Truth Service Architecture Design

> **For Claude:** This is an architectural design document. Use `superpowers:writing-plans` to create the implementation plan when ready.

**Goal:** Transform the monolithic overnight-run.ts script into independent, queue-based workers with proper job processing, retry logic, horizontal scaling, and full observability.

**Architecture:** BullMQ + Redis for job queuing, Docker services in Coolify, event-driven cascading flow, integrated with existing Watchdog monitoring.

**Tech Stack:** BullMQ, Redis 7, Docker Compose, Bull Board, Prometheus metrics, existing Next.js app

---

## 1. Core Architecture

### Queue Topology

Six queues matching pipeline phases, each with its own worker pool:

```
┌──────────────────────────────────────────────────────────────────┐
│                         Redis (BullMQ)                            │
├──────────────────────────────────────────────────────────────────┤
│  queue:sentinel    → discovers new content, emits to extract      │
│  queue:extract     → processes evidence, emits to compose         │
│  queue:compose     → creates draft rules, emits to review         │
│  queue:review      → reviews rules, emits to release or arbiter   │
│  queue:arbiter     → resolves conflicts                           │
│  queue:release     → publishes approved rules                     │
├──────────────────────────────────────────────────────────────────┤
│  queue:scheduled   → cron-triggered jobs (daily run, audits)      │
│  queue:deadletter  → failed jobs after max retries                │
└──────────────────────────────────────────────────────────────────┘
```

### Job Flow

Jobs cascade through queues. When Sentinel finds new evidence, it adds jobs to the `extract` queue. When Extractor creates pointers, it adds jobs to `compose`, and so on.

```typescript
// Sentinel worker completes → adds extract jobs
await extractQueue.addBulk(evidenceIds.map((id) => ({ name: "extract", data: { evidenceId: id } })))
```

### Worker Scaling

Each worker is an independent Docker service. Scale horizontally by changing replica count:

| Worker    | Default Replicas | Can Scale To     |
| --------- | ---------------- | ---------------- |
| sentinel  | 1                | 1 (rate-limited) |
| extractor | 2                | 5                |
| composer  | 1                | 3                |
| reviewer  | 1                | 2                |
| arbiter   | 1                | 1                |
| releaser  | 1                | 1                |

---

## 2. Job Structure & Retry Logic

### Job Schema

Every job follows a consistent structure for traceability:

```typescript
interface RegulatoryJob {
  // Identity
  id: string // cuid, assigned by BullMQ
  type: JobType // 'extract' | 'compose' | 'review' | ...

  // Payload
  entityId: string // evidenceId, ruleId, conflictId, etc.
  priority: number // 1=critical, 2=high, 3=normal

  // Lineage (for audit trail)
  parentJobId?: string // job that spawned this one
  runId: string // groups jobs from same pipeline run

  // Rate limiting
  domain?: string // for per-domain throttling
}
```

### Retry Strategy

Different failure modes get different treatment:

| Error Type         | Retry | Backoff         | Max Attempts    |
| ------------------ | ----- | --------------- | --------------- |
| Rate limit (429)   | Yes   | 60s, 120s, 300s | 5               |
| LLM timeout        | Yes   | 30s, 60s, 120s  | 3               |
| LLM invalid output | Yes   | 10s, 20s, 40s   | 3               |
| DB connection      | Yes   | 5s, 10s, 20s    | 5               |
| Validation error   | No    | —               | 1 (dead-letter) |
| Missing entity     | No    | —               | 1 (dead-letter) |

```typescript
// BullMQ job options
{
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 10000  // 10s, 20s, 40s
  },
  removeOnComplete: { age: 86400 },  // keep 24h
  removeOnFail: false  // keep failed for inspection
}
```

### Dead Letter Handling

Jobs that exhaust retries go to `queue:deadletter`. The Watchdog health monitor checks this queue and raises alerts when jobs accumulate.

---

## 3. Docker Services & Deployment

### Service Architecture

Each worker becomes a separate Docker service in the Coolify stack:

```yaml
# docker-compose.workers.yml
services:
  redis:
    image: redis:7-alpine
    container_name: fiskai-redis
    restart: unless-stopped
    volumes:
      - fiskai_redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s

  worker-sentinel:
    build:
      context: .
      dockerfile: Dockerfile.worker
    command: node dist/workers/sentinel.js
    environment:
      - WORKER_TYPE=sentinel
      - WORKER_CONCURRENCY=1
    depends_on: [redis, fiskai-db]
    deploy:
      replicas: 1

  worker-extractor:
    build:
      context: .
      dockerfile: Dockerfile.worker
    command: node dist/workers/extractor.js
    environment:
      - WORKER_TYPE=extractor
      - WORKER_CONCURRENCY=2
    depends_on: [redis, fiskai-db]
    deploy:
      replicas: 2 # scale horizontally

  worker-composer:
    build:
      context: .
      dockerfile: Dockerfile.worker
    command: node dist/workers/composer.js
    environment:
      - WORKER_TYPE=composer
      - WORKER_CONCURRENCY=1
    depends_on: [redis, fiskai-db]
    deploy:
      replicas: 1

  worker-reviewer:
    build:
      context: .
      dockerfile: Dockerfile.worker
    command: node dist/workers/reviewer.js
    environment:
      - WORKER_TYPE=reviewer
      - WORKER_CONCURRENCY=1
    depends_on: [redis, fiskai-db]
    deploy:
      replicas: 1

  worker-arbiter:
    build:
      context: .
      dockerfile: Dockerfile.worker
    command: node dist/workers/arbiter.js
    environment:
      - WORKER_TYPE=arbiter
      - WORKER_CONCURRENCY=1
    depends_on: [redis, fiskai-db]
    deploy:
      replicas: 1

  worker-releaser:
    build:
      context: .
      dockerfile: Dockerfile.worker
    command: node dist/workers/releaser.js
    environment:
      - WORKER_TYPE=releaser
      - WORKER_CONCURRENCY=1
    depends_on: [redis, fiskai-db]
    deploy:
      replicas: 1

  worker-orchestrator:
    build:
      context: .
      dockerfile: Dockerfile.worker
    command: node dist/workers/orchestrator.js
    environment:
      - WORKER_TYPE=orchestrator
      - WORKER_CONCURRENCY=1
    depends_on: [redis, fiskai-db]
    deploy:
      replicas: 1

  bull-board:
    image: deadly0/bull-board
    container_name: fiskai-bull-board
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    ports:
      - "3001:3000"
    depends_on: [redis]

volumes:
  fiskai_redis_data:
```

### Dockerfile.worker

Slim worker image sharing the same codebase:

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ ./dist/
CMD ["node", "dist/workers/index.js"]
```

### Coolify Integration

Deploy as a single "Docker Compose" resource in Coolify. Workers auto-restart on failure, and replicas can be scaled from the Coolify dashboard.

---

## 4. Observability & Monitoring

### Metrics Collection

Each worker exposes Prometheus-compatible metrics:

```typescript
// Metrics per worker
const metrics = {
  jobs_processed_total: Counter,      // by status: success, failed, retry
  job_duration_seconds: Histogram,    // processing time distribution
  queue_depth: Gauge,                 // jobs waiting
  worker_busy: Gauge,                 // currently processing
  llm_tokens_used: Counter,           // token consumption tracking
  rate_limit_hits: Counter,           // 429s received
}

// Exposed at GET /metrics on each worker
worker_extractor_jobs_processed_total{status="success"} 1523
worker_extractor_job_duration_seconds_bucket{le="10"} 892
worker_extractor_queue_depth 7
```

### Structured Logging

JSON logs for aggregation (works with Loki, CloudWatch, etc.):

```typescript
logger.info({
  event: "job_completed",
  worker: "extractor",
  jobId: "abc123",
  entityId: "evidence-xyz",
  duration: 4523,
  pointersCreated: 3,
  runId: "run-2025-12-22",
})
```

### Health Endpoints

Each worker exposes health status:

```
GET /health
{
  "status": "healthy",
  "worker": "extractor",
  "redis": "connected",
  "db": "connected",
  "activeJobs": 2,
  "uptime": 3600
}
```

### Bull Board Dashboard

Visual job inspection at `http://localhost:3001`:

- Queue depths and throughput graphs
- Failed job inspection with stack traces
- Manual retry/remove controls
- Job search by ID or data

### Integration with Existing Watchdog

Watchdog health monitors query worker endpoints:

```typescript
// watchdog/health-monitors.ts
async function checkWorkerHealth(worker: string): Promise<HealthResult> {
  const res = await fetch(`http://worker-${worker}:3000/health`)
  // ... existing alert logic
}
```

---

## 5. Scheduler & Job Triggering

### Replacing overnight-run.ts

Instead of a monolithic script, the scheduler just enqueues trigger jobs:

```typescript
// src/workers/scheduler.ts
import { Queue } from "bullmq"
import cron from "node-cron"

const scheduledQueue = new Queue("scheduled", { connection: redis })

// Daily pipeline at 06:00
cron.schedule(
  "0 6 * * *",
  async () => {
    await scheduledQueue.add("pipeline-run", {
      runId: `run-${Date.now()}`,
      triggeredBy: "scheduler",
      phases: ["sentinel", "extract", "compose", "review", "release"],
    })
  },
  { timezone: "Europe/Zagreb" }
)

// Random audits (10:00-14:00)
cron.schedule("0 10 * * *", async () => {
  const delayMs = Math.random() * 4 * 60 * 60 * 1000 // 0-4 hours
  await scheduledQueue.add("audit", { type: "random" }, { delay: delayMs })
})

// Digest at 08:00
cron.schedule("0 8 * * *", async () => {
  await scheduledQueue.add("digest", {})
})
```

### Pipeline Orchestrator Worker

A dedicated worker handles `scheduled` queue and kicks off cascading jobs:

```typescript
// workers/orchestrator.ts
worker.on("completed", async (job) => {
  if (job.name === "pipeline-run") {
    // Phase 1: Add sentinel jobs for all active sources
    const sources = await db.regulatorySource.findMany({ where: { isActive: true } })
    await sentinelQueue.addBulk(
      sources.map((s) => ({
        name: "scout",
        data: { sourceId: s.id, runId: job.data.runId },
      }))
    )
  }
})
```

### Manual Triggers

API endpoint for on-demand runs:

```typescript
// POST /api/regulatory/trigger
await scheduledQueue.add("pipeline-run", {
  runId: `manual-${Date.now()}`,
  triggeredBy: userId,
  phases: req.body.phases || ["sentinel", "extract", "compose"],
})
```

### Job Cascade Flow

```
scheduler (cron)
    │
    ▼
orchestrator (pipeline-run)
    │
    ├──▶ sentinel jobs (per source)
    │         │
    │         ▼ on complete
    │    extract jobs (per evidence)
    │         │
    │         ▼ on complete
    │    compose jobs (per domain)
    │         │
    │         ▼ on complete
    │    review jobs (per rule)
    │         │
    │         ▼ on complete
    │    release job (batch)
    │
    └──▶ health check job
```

---

## 6. Rate Limiting & Domain Throttling

### Per-Domain Rate Limiting

Government sites have different tolerances. BullMQ rate limiter + custom grouping:

```typescript
// Queue-level rate limit (global)
const extractQueue = new Queue("extract", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 10000 },
  },
  limiter: {
    max: 10, // max 10 jobs
    duration: 60000, // per minute globally
  },
})

// Per-domain throttling via delay
await extractQueue.add(
  "extract",
  { evidenceId, domain: "porezna-uprava.gov.hr" },
  { delay: getDomainDelay("porezna-uprava.gov.hr") }
)
```

### Domain Delay Configuration

Reuse existing watchdog config:

```typescript
const DOMAIN_DELAYS: Record<string, { min: number; max: number }> = {
  "narodne-novine.nn.hr": { min: 3000, max: 5000 },
  "porezna-uprava.gov.hr": { min: 4000, max: 6000 },
  "hzzo.hr": { min: 5000, max: 8000 },
  "mirovinsko.hr": { min: 5000, max: 8000 },
  "fina.hr": { min: 3000, max: 5000 },
  "mfin.gov.hr": { min: 4000, max: 6000 },
  "eur-lex.europa.eu": { min: 2000, max: 4000 },
}

function getDomainDelay(domain: string): number {
  const config = DOMAIN_DELAYS[domain] || { min: 3000, max: 5000 }
  return config.min + Math.random() * (config.max - config.min)
}
```

### Backpressure Handling

When a domain hits rate limits, jobs auto-delay:

```typescript
processor.on("failed", async (job, err) => {
  if (err.message.includes("429")) {
    const domain = job.data.domain
    await extractQueue.add("extract", job.data, {
      delay: getDomainDelay(domain) * 3, // triple delay
    })
    return
  }
})
```

### LLM Rate Limiting

Separate concern - limit concurrent LLM calls across all workers:

```typescript
import Bottleneck from "bottleneck"

const llmLimiter = new Bottleneck({
  reservoir: 5, // 5 concurrent LLM calls
  reservoirRefreshAmount: 5,
  reservoirRefreshInterval: 60000, // refill every minute
  Redis: redis,
})

await llmLimiter.schedule(() => callOllama(prompt))
```

---

## 7. Reliability & Self-Healing

### Graceful Shutdown

Workers finish current jobs before exiting:

```typescript
// workers/base.ts
const worker = new Worker("extract", processor, { connection: redis })

process.on("SIGTERM", async () => {
  console.log("[worker] Received SIGTERM, finishing current jobs...")
  await worker.close() // waits for active jobs
  await redis.quit()
  process.exit(0)
})

process.on("SIGINT", async () => {
  await worker.close()
  process.exit(0)
})
```

### Stalled Job Recovery

BullMQ detects workers that died mid-job:

```typescript
const worker = new Worker("extract", processor, {
  connection: redis,
  lockDuration: 60000, // job lock: 60s
  stalledInterval: 30000, // check every 30s
  maxStalledCount: 2, // retry twice, then fail
})
```

### Dead Letter Queue Processing

Watchdog checks dead-letter queue:

```typescript
async function checkDeadLetterQueue(): Promise<HealthResult> {
  const deadLetter = new Queue("deadletter", { connection: redis })
  const failed = await deadLetter.getJobCounts("failed")

  if (failed.failed > 10) {
    await raiseAlert({
      severity: "WARNING",
      type: "HIGH_REJECTION_RATE",
      message: `${failed.failed} jobs in dead-letter queue`,
    })
  }

  return { status: failed.failed > 50 ? "CRITICAL" : "HEALTHY" }
}
```

### Auto-Recovery States

```
HEALTHY → job succeeds
    │
    ▼ (failure)
RETRY_1 → exponential backoff, retry
    │
    ▼ (failure)
RETRY_2 → longer backoff, retry
    │
    ▼ (failure)
RETRY_3 → final attempt
    │
    ▼ (failure)
DEAD_LETTER → alert raised, human review
    │
    ▼ (manual fix)
RE-QUEUE → back to normal queue
```

### Circuit Breaker for External Services

Prevent cascade failures when Ollama or sources are down:

```typescript
import CircuitBreaker from "opossum"

const ollamaBreaker = new CircuitBreaker(callOllama, {
  timeout: 60000,
  errorThresholdPercentage: 50,
  resetTimeout: 300000, // 5min
})

ollamaBreaker.on("open", () => {
  raiseAlert({
    severity: "CRITICAL",
    type: "PIPELINE_FAILURE",
    message: "Ollama circuit breaker OPEN",
  })
})
```

---

## 8. Integration & Migration Strategy

### Code Reuse

Workers wrap existing agent functions - minimal rewrite:

```typescript
// workers/extractor.ts
import { Worker } from "bullmq"
import { runExtractor } from "@/lib/regulatory-truth/agents/extractor"
import { composeQueue } from "./queues"

const worker = new Worker(
  "extract",
  async (job) => {
    const { evidenceId, runId } = job.data

    // Reuse existing agent - no changes needed
    const result = await runExtractor(evidenceId)

    if (result.success && result.sourcePointerIds.length > 0) {
      // Cascade to compose queue
      await composeQueue.add("compose", {
        pointerIds: result.sourcePointerIds,
        runId,
        parentJobId: job.id,
      })
    }

    return result
  },
  { connection: redis }
)
```

### File Structure

New `workers/` directory alongside existing code:

```
src/
├── lib/regulatory-truth/
│   ├── agents/           # unchanged - reused by workers
│   ├── watchdog/         # unchanged - monitors workers
│   └── workers/          # NEW
│       ├── index.ts      # worker bootstrap
│       ├── queues.ts     # queue definitions
│       ├── base.ts       # shared worker utilities
│       ├── metrics.ts    # Prometheus metrics
│       ├── sentinel.ts
│       ├── extractor.ts
│       ├── composer.ts
│       ├── reviewer.ts
│       ├── arbiter.ts
│       ├── releaser.ts
│       ├── orchestrator.ts
│       └── scheduler.ts
```

### Migration Plan

Phase rollout to minimize risk:

| Phase | Change                                    | Rollback                    |
| ----- | ----------------------------------------- | --------------------------- |
| 1     | Add Redis to docker-compose               | Remove container            |
| 2     | Deploy workers alongside overnight-run.ts | Disable workers, use script |
| 3     | Run both in parallel, compare results     | N/A                         |
| 4     | Disable overnight-run.ts, workers only    | Re-enable script            |
| 5     | Remove overnight-run.ts                   | Git revert                  |

### Environment Variables

New vars for workers:

```bash
# Redis
REDIS_URL=redis://fiskai-redis:6379

# Worker config
WORKER_CONCURRENCY=2
WORKER_TYPE=extractor

# BullMQ
BULLMQ_PREFIX=fiskai
JOB_RETENTION_HOURS=24
```

### Backwards Compatibility

Keep existing API routes working - they just enqueue jobs now:

```typescript
// POST /api/regulatory/trigger (existing route)
export async function POST(req: Request) {
  // OLD: await runOvernightPipeline()
  // NEW:
  const job = await scheduledQueue.add("pipeline-run", {
    runId: `api-${Date.now()}`,
    triggeredBy: "api",
  })

  return NextResponse.json({ jobId: job.id, status: "queued" })
}
```

---

## Summary

This architecture transforms the monolithic overnight-run.ts into:

- **8 independent worker services** (sentinel, extractor, composer, reviewer, arbiter, releaser, orchestrator, scheduler)
- **Redis-backed job queues** with BullMQ for reliability
- **Horizontal scaling** for CPU-intensive workers (extractor, composer)
- **Full observability** via Prometheus metrics, structured logs, Bull Board dashboard
- **Self-healing** with exponential backoff, circuit breakers, dead-letter handling
- **Graceful integration** with existing codebase and Watchdog monitoring

Estimated implementation: 12-15 discrete tasks across infrastructure, worker code, and migration phases.
