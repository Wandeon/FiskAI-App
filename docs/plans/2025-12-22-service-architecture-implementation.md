# Service Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform overnight-run.ts monolith into independent BullMQ workers with Redis-backed job queues.

**Architecture:** 8 worker services consuming from Redis queues, cascading jobs through the pipeline (sentinel → extract → compose → review → release), with Bull Board dashboard for observability.

**Tech Stack:** BullMQ, Redis 7, ioredis, node-cron, Bottleneck, opossum (circuit breaker), prom-client (metrics)

---

## Phase 1: Infrastructure

### Task 1.1: Add Dependencies

**Files:**

- Modify: `package.json`

**Step 1: Install BullMQ and related packages**

Run:

```bash
npm install bullmq ioredis bottleneck opossum prom-client
npm install -D @types/opossum
```

**Step 2: Verify installation**

Run: `npm ls bullmq ioredis`
Expected: Shows installed versions

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add BullMQ, ioredis, and worker dependencies"
```

---

### Task 1.2: Create Redis Docker Service

**Files:**

- Create: `docker-compose.workers.yml`

**Step 1: Create workers compose file**

```yaml
# docker-compose.workers.yml
# Extends base docker-compose.yml with worker services

services:
  redis:
    image: redis:7-alpine
    container_name: fiskai-redis
    restart: unless-stopped
    volumes:
      - fiskai_redis_data:/data
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - default
      - coolify
    ports:
      - "6379:6379"

  bull-board:
    image: deadly0/bull-board
    container_name: fiskai-bull-board
    restart: unless-stopped
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - BULL_PREFIX=fiskai
    ports:
      - "3001:3000"
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - default
      - coolify

volumes:
  fiskai_redis_data:

networks:
  coolify:
    external: true
```

**Step 2: Test Redis locally**

Run:

```bash
docker compose -f docker-compose.workers.yml up redis -d
docker exec fiskai-redis redis-cli ping
```

Expected: `PONG`

**Step 3: Commit**

```bash
git add docker-compose.workers.yml
git commit -m "infra: add Redis and Bull Board Docker services"
```

---

### Task 1.3: Add Worker Environment Variables

**Files:**

- Modify: `.env`
- Modify: `.env.example` (if exists)

**Step 1: Add Redis and worker config to .env**

Add to `.env`:

```bash
# Redis
REDIS_URL=redis://localhost:6379

# Worker config
WORKER_CONCURRENCY=2
BULLMQ_PREFIX=fiskai
JOB_RETENTION_HOURS=24
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "config: add Redis and worker environment variables"
```

---

## Phase 2: Core Worker Framework

### Task 2.1: Create Redis Connection Module

**Files:**

- Create: `src/lib/regulatory-truth/workers/redis.ts`

**Step 1: Create Redis connection with health check**

```typescript
// src/lib/regulatory-truth/workers/redis.ts
import Redis from "ioredis"

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379"

// Shared connection for all queues
export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
})

// Separate connection for workers (BullMQ requirement)
export function createWorkerConnection(): Redis {
  return new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })
}

// Health check
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const pong = await redis.ping()
    return pong === "PONG"
  } catch {
    return false
  }
}

// Graceful shutdown
export async function closeRedis(): Promise<void> {
  await redis.quit()
}
```

**Step 2: Test connection**

Run:

```bash
npx tsx -e "import { checkRedisHealth } from './src/lib/regulatory-truth/workers/redis'; checkRedisHealth().then(console.log)"
```

Expected: `true` (if Redis is running)

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/workers/redis.ts
git commit -m "feat(workers): add Redis connection module"
```

---

### Task 2.2: Create Queue Definitions

**Files:**

- Create: `src/lib/regulatory-truth/workers/queues.ts`

**Step 1: Define all queues with proper options**

```typescript
// src/lib/regulatory-truth/workers/queues.ts
import { Queue, QueueEvents } from "bullmq"
import { redis } from "./redis"

const PREFIX = process.env.BULLMQ_PREFIX || "fiskai"
const RETENTION_MS = parseInt(process.env.JOB_RETENTION_HOURS || "24") * 60 * 60 * 1000

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 10000, // 10s, 20s, 40s
  },
  removeOnComplete: { age: RETENTION_MS },
  removeOnFail: false, // Keep for inspection
}

// Queue factory
function createQueue(name: string, limiter?: { max: number; duration: number }) {
  return new Queue(name, {
    connection: redis,
    prefix: PREFIX,
    defaultJobOptions,
    ...(limiter && { limiter }),
  })
}

// Pipeline queues
export const sentinelQueue = createQueue("sentinel", { max: 5, duration: 60000 })
export const extractQueue = createQueue("extract", { max: 10, duration: 60000 })
export const composeQueue = createQueue("compose", { max: 5, duration: 60000 })
export const reviewQueue = createQueue("review", { max: 5, duration: 60000 })
export const arbiterQueue = createQueue("arbiter", { max: 3, duration: 60000 })
export const releaseQueue = createQueue("release", { max: 2, duration: 60000 })

// Control queues
export const scheduledQueue = createQueue("scheduled")
export const deadletterQueue = createQueue("deadletter")

// All queues for health checks
export const allQueues = {
  sentinel: sentinelQueue,
  extract: extractQueue,
  compose: composeQueue,
  review: reviewQueue,
  arbiter: arbiterQueue,
  release: releaseQueue,
  scheduled: scheduledQueue,
  deadletter: deadletterQueue,
}

// Queue events for monitoring
export function createQueueEvents(queueName: string): QueueEvents {
  return new QueueEvents(queueName, { connection: redis, prefix: PREFIX })
}
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/workers/queues.ts
git commit -m "feat(workers): add queue definitions with rate limiting"
```

---

### Task 2.3: Create Base Worker Class

**Files:**

- Create: `src/lib/regulatory-truth/workers/base.ts`

**Step 1: Create reusable worker base with graceful shutdown**

```typescript
// src/lib/regulatory-truth/workers/base.ts
import { Worker, Job } from "bullmq"
import { createWorkerConnection, closeRedis } from "./redis"
import { deadletterQueue } from "./queues"

const PREFIX = process.env.BULLMQ_PREFIX || "fiskai"

export interface WorkerOptions {
  name: string
  concurrency?: number
  lockDuration?: number
  stalledInterval?: number
}

export interface JobResult {
  success: boolean
  data?: unknown
  error?: string
  duration: number
}

export type JobProcessor<T> = (job: Job<T>) => Promise<JobResult>

export function createWorker<T>(
  queueName: string,
  processor: JobProcessor<T>,
  options: WorkerOptions
): Worker<T> {
  const connection = createWorkerConnection()
  const concurrency = options.concurrency ?? parseInt(process.env.WORKER_CONCURRENCY || "2")

  const worker = new Worker<T>(
    queueName,
    async (job) => {
      const start = Date.now()
      console.log(`[${options.name}] Processing job ${job.id}: ${job.name}`)

      try {
        const result = await processor(job)
        console.log(`[${options.name}] Job ${job.id} completed in ${result.duration}ms`)
        return result
      } catch (error) {
        console.error(`[${options.name}] Job ${job.id} failed:`, error)
        throw error
      }
    },
    {
      connection,
      prefix: PREFIX,
      concurrency,
      lockDuration: options.lockDuration ?? 60000,
      stalledInterval: options.stalledInterval ?? 30000,
      maxStalledCount: 2,
    }
  )

  // Error handling
  worker.on("failed", async (job, err) => {
    if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
      // Move to dead letter queue
      await deadletterQueue.add("failed", {
        originalQueue: queueName,
        jobId: job.id,
        jobName: job.name,
        jobData: job.data,
        error: err.message,
        failedAt: new Date().toISOString(),
      })
      console.log(`[${options.name}] Job ${job.id} moved to dead-letter queue`)
    }
  })

  worker.on("error", (err) => {
    console.error(`[${options.name}] Worker error:`, err)
  })

  return worker
}

// Graceful shutdown helper
export function setupGracefulShutdown(workers: Worker[]): void {
  const shutdown = async (signal: string) => {
    console.log(`\n[workers] Received ${signal}, shutting down gracefully...`)

    await Promise.all(
      workers.map(async (w) => {
        console.log(`[workers] Closing worker: ${w.name}`)
        await w.close()
      })
    )

    await closeRedis()
    console.log("[workers] Shutdown complete")
    process.exit(0)
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"))
  process.on("SIGINT", () => shutdown("SIGINT"))
}
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/workers/base.ts
git commit -m "feat(workers): add base worker class with graceful shutdown"
```

---

### Task 2.4: Create Metrics Module

**Files:**

- Create: `src/lib/regulatory-truth/workers/metrics.ts`

**Step 1: Create Prometheus metrics**

```typescript
// src/lib/regulatory-truth/workers/metrics.ts
import { Counter, Histogram, Gauge, Registry } from "prom-client"

export const registry = new Registry()

// Job metrics
export const jobsProcessed = new Counter({
  name: "worker_jobs_processed_total",
  help: "Total jobs processed by worker",
  labelNames: ["worker", "status", "queue"],
  registers: [registry],
})

export const jobDuration = new Histogram({
  name: "worker_job_duration_seconds",
  help: "Job processing duration",
  labelNames: ["worker", "queue"],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
  registers: [registry],
})

export const queueDepth = new Gauge({
  name: "worker_queue_depth",
  help: "Number of jobs waiting in queue",
  labelNames: ["queue"],
  registers: [registry],
})

export const activeJobs = new Gauge({
  name: "worker_active_jobs",
  help: "Number of jobs currently being processed",
  labelNames: ["worker"],
  registers: [registry],
})

// LLM metrics
export const llmCalls = new Counter({
  name: "worker_llm_calls_total",
  help: "Total LLM API calls",
  labelNames: ["worker", "status"],
  registers: [registry],
})

export const rateLimitHits = new Counter({
  name: "worker_rate_limit_hits_total",
  help: "Rate limit hits (429 responses)",
  labelNames: ["worker", "domain"],
  registers: [registry],
})

// Get metrics as string for /metrics endpoint
export async function getMetrics(): Promise<string> {
  return registry.metrics()
}
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/workers/metrics.ts
git commit -m "feat(workers): add Prometheus metrics module"
```

---

### Task 2.5: Create Rate Limiter Module

**Files:**

- Create: `src/lib/regulatory-truth/workers/rate-limiter.ts`

**Step 1: Create domain-aware rate limiter**

```typescript
// src/lib/regulatory-truth/workers/rate-limiter.ts
import Bottleneck from "bottleneck"
import { redis } from "./redis"

// Domain-specific delays (ms)
const DOMAIN_DELAYS: Record<string, { min: number; max: number }> = {
  "narodne-novine.nn.hr": { min: 3000, max: 5000 },
  "porezna-uprava.gov.hr": { min: 4000, max: 6000 },
  "hzzo.hr": { min: 5000, max: 8000 },
  "mirovinsko.hr": { min: 5000, max: 8000 },
  "fina.hr": { min: 3000, max: 5000 },
  "mfin.gov.hr": { min: 4000, max: 6000 },
  "eur-lex.europa.eu": { min: 2000, max: 4000 },
}

export function getDomainDelay(domain: string): number {
  const config = DOMAIN_DELAYS[domain] || { min: 3000, max: 5000 }
  return config.min + Math.random() * (config.max - config.min)
}

// Shared LLM rate limiter (across all workers)
export const llmLimiter = new Bottleneck({
  reservoir: 5, // 5 concurrent calls
  reservoirRefreshAmount: 5,
  reservoirRefreshInterval: 60000, // Refill every minute
  maxConcurrent: 5,
  minTime: 1000, // Min 1s between calls
  id: "llm-limiter",
  datastore: "ioredis",
  clientOptions: {
    host: process.env.REDIS_URL?.replace("redis://", "").split(":")[0] || "localhost",
    port: parseInt(process.env.REDIS_URL?.split(":")[2] || "6379"),
  },
})

// Per-domain limiters
const domainLimiters = new Map<string, Bottleneck>()

export function getDomainLimiter(domain: string): Bottleneck {
  if (!domainLimiters.has(domain)) {
    const delay = DOMAIN_DELAYS[domain] || { min: 3000, max: 5000 }
    domainLimiters.set(
      domain,
      new Bottleneck({
        maxConcurrent: 1,
        minTime: delay.min,
      })
    )
  }
  return domainLimiters.get(domain)!
}
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/workers/rate-limiter.ts
git commit -m "feat(workers): add domain-aware rate limiter with Redis"
```

---

### Task 2.6: Create Circuit Breaker Module

**Files:**

- Create: `src/lib/regulatory-truth/workers/circuit-breaker.ts`

**Step 1: Create circuit breaker for external services**

```typescript
// src/lib/regulatory-truth/workers/circuit-breaker.ts
import CircuitBreaker from "opossum"

interface CircuitBreakerOptions {
  timeout?: number
  errorThresholdPercentage?: number
  resetTimeout?: number
  name: string
}

const breakers = new Map<string, CircuitBreaker>()

export function createCircuitBreaker<T>(
  fn: (...args: unknown[]) => Promise<T>,
  options: CircuitBreakerOptions
): CircuitBreaker {
  if (breakers.has(options.name)) {
    return breakers.get(options.name)!
  }

  const breaker = new CircuitBreaker(fn, {
    timeout: options.timeout ?? 60000,
    errorThresholdPercentage: options.errorThresholdPercentage ?? 50,
    resetTimeout: options.resetTimeout ?? 300000, // 5 min
    name: options.name,
  })

  breaker.on("open", () => {
    console.warn(`[circuit-breaker] ${options.name} OPENED - requests will fail fast`)
  })

  breaker.on("halfOpen", () => {
    console.info(`[circuit-breaker] ${options.name} HALF-OPEN - testing recovery`)
  })

  breaker.on("close", () => {
    console.info(`[circuit-breaker] ${options.name} CLOSED - back to normal`)
  })

  breakers.set(options.name, breaker)
  return breaker
}

export function getCircuitBreakerStatus(): Record<string, { state: string; stats: object }> {
  const status: Record<string, { state: string; stats: object }> = {}
  for (const [name, breaker] of breakers) {
    status[name] = {
      state: breaker.opened ? "open" : breaker.halfOpen ? "halfOpen" : "closed",
      stats: breaker.stats,
    }
  }
  return status
}
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/workers/circuit-breaker.ts
git commit -m "feat(workers): add circuit breaker for external services"
```

---

### Task 2.7: Create Worker Index

**Files:**

- Create: `src/lib/regulatory-truth/workers/index.ts`

**Step 1: Export all worker modules**

```typescript
// src/lib/regulatory-truth/workers/index.ts

// Core
export { redis, createWorkerConnection, checkRedisHealth, closeRedis } from "./redis"
export {
  sentinelQueue,
  extractQueue,
  composeQueue,
  reviewQueue,
  arbiterQueue,
  releaseQueue,
  scheduledQueue,
  deadletterQueue,
  allQueues,
  createQueueEvents,
} from "./queues"
export { createWorker, setupGracefulShutdown, type JobResult, type JobProcessor } from "./base"

// Utilities
export { getDomainDelay, getDomainLimiter, llmLimiter } from "./rate-limiter"
export { createCircuitBreaker, getCircuitBreakerStatus } from "./circuit-breaker"
export { registry, jobsProcessed, jobDuration, queueDepth, activeJobs, getMetrics } from "./metrics"
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/workers/index.ts
git commit -m "feat(workers): add worker module index"
```

---

## Phase 3: Individual Workers

### Task 3.1: Create Sentinel Worker

**Files:**

- Create: `src/lib/regulatory-truth/workers/sentinel.worker.ts`

**Step 1: Implement sentinel worker**

```typescript
// src/lib/regulatory-truth/workers/sentinel.worker.ts
import { Job } from "bullmq"
import { createWorker, setupGracefulShutdown, type JobResult } from "./base"
import { extractQueue } from "./queues"
import { jobsProcessed, jobDuration } from "./metrics"
import { runSentinel, fetchDiscoveredItems } from "../agents/sentinel"
import { db } from "@/lib/db"

interface SentinelJobData {
  runId: string
  sourceId?: string
  priority?: "CRITICAL" | "HIGH" | "NORMAL"
}

async function processSentinelJob(job: Job<SentinelJobData>): Promise<JobResult> {
  const start = Date.now()
  const { runId, priority = "CRITICAL" } = job.data

  try {
    // Run sentinel discovery
    const result = await runSentinel(priority)

    // Fetch discovered items
    const fetchResult = await fetchDiscoveredItems(50)

    // Queue extract jobs for new evidence
    if (fetchResult.fetched > 0) {
      const newEvidence = await db.evidence.findMany({
        where: {
          sourcePointers: { none: {} },
          fetchedAt: { gte: new Date(Date.now() - 3600000) }, // Last hour
        },
        select: { id: true },
        take: 50,
      })

      if (newEvidence.length > 0) {
        await extractQueue.addBulk(
          newEvidence.map((e) => ({
            name: "extract",
            data: { evidenceId: e.id, runId, parentJobId: job.id },
          }))
        )
        console.log(`[sentinel] Queued ${newEvidence.length} extract jobs`)
      }
    }

    const duration = Date.now() - start
    jobsProcessed.inc({ worker: "sentinel", status: "success", queue: "sentinel" })
    jobDuration.observe({ worker: "sentinel", queue: "sentinel" }, duration / 1000)

    return {
      success: true,
      duration,
      data: {
        endpointsChecked: result.endpointsChecked,
        newItemsDiscovered: result.newItemsDiscovered,
        fetched: fetchResult.fetched,
      },
    }
  } catch (error) {
    jobsProcessed.inc({ worker: "sentinel", status: "failed", queue: "sentinel" })
    return {
      success: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// Create and start worker
const worker = createWorker<SentinelJobData>("sentinel", processSentinelJob, {
  name: "sentinel",
  concurrency: 1, // Only one sentinel at a time
})

setupGracefulShutdown([worker])

console.log("[sentinel] Worker started")
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/workers/sentinel.worker.ts
git commit -m "feat(workers): add sentinel worker"
```

---

### Task 3.2: Create Extractor Worker

**Files:**

- Create: `src/lib/regulatory-truth/workers/extractor.worker.ts`

**Step 1: Implement extractor worker**

```typescript
// src/lib/regulatory-truth/workers/extractor.worker.ts
import { Job } from "bullmq"
import { createWorker, setupGracefulShutdown, type JobResult } from "./base"
import { composeQueue } from "./queues"
import { jobsProcessed, jobDuration } from "./metrics"
import { llmLimiter, getDomainDelay } from "./rate-limiter"
import { runExtractor } from "../agents/extractor"
import { db } from "@/lib/db"

interface ExtractJobData {
  evidenceId: string
  runId: string
  parentJobId?: string
}

async function processExtractJob(job: Job<ExtractJobData>): Promise<JobResult> {
  const start = Date.now()
  const { evidenceId, runId } = job.data

  try {
    // Get evidence with source info for rate limiting
    const evidence = await db.evidence.findUnique({
      where: { id: evidenceId },
      include: { source: true },
    })

    if (!evidence) {
      return { success: false, duration: 0, error: `Evidence not found: ${evidenceId}` }
    }

    // Rate limit LLM calls
    const result = await llmLimiter.schedule(() => runExtractor(evidenceId))

    if (result.success && result.sourcePointerIds.length > 0) {
      // Group pointers by domain and queue compose jobs
      const pointers = await db.sourcePointer.findMany({
        where: { id: { in: result.sourcePointerIds } },
        select: { id: true, domain: true },
      })

      const byDomain = new Map<string, string[]>()
      for (const p of pointers) {
        const ids = byDomain.get(p.domain) || []
        ids.push(p.id)
        byDomain.set(p.domain, ids)
      }

      // Queue compose job for each domain
      for (const [domain, pointerIds] of byDomain) {
        await composeQueue.add(
          "compose",
          { pointerIds, domain, runId, parentJobId: job.id },
          { delay: getDomainDelay(domain) }
        )
      }
    }

    const duration = Date.now() - start
    jobsProcessed.inc({ worker: "extractor", status: "success", queue: "extract" })
    jobDuration.observe({ worker: "extractor", queue: "extract" }, duration / 1000)

    return {
      success: true,
      duration,
      data: { pointersCreated: result.sourcePointerIds.length },
    }
  } catch (error) {
    jobsProcessed.inc({ worker: "extractor", status: "failed", queue: "extract" })
    return {
      success: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// Create and start worker
const worker = createWorker<ExtractJobData>("extract", processExtractJob, {
  name: "extractor",
  concurrency: 2,
})

setupGracefulShutdown([worker])

console.log("[extractor] Worker started")
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/workers/extractor.worker.ts
git commit -m "feat(workers): add extractor worker with LLM rate limiting"
```

---

### Task 3.3: Create Composer Worker

**Files:**

- Create: `src/lib/regulatory-truth/workers/composer.worker.ts`

**Step 1: Implement composer worker**

```typescript
// src/lib/regulatory-truth/workers/composer.worker.ts
import { Job } from "bullmq"
import { createWorker, setupGracefulShutdown, type JobResult } from "./base"
import { reviewQueue, arbiterQueue } from "./queues"
import { jobsProcessed, jobDuration } from "./metrics"
import { llmLimiter } from "./rate-limiter"
import { runComposer } from "../agents/composer"

interface ComposeJobData {
  pointerIds: string[]
  domain: string
  runId: string
  parentJobId?: string
}

async function processComposeJob(job: Job<ComposeJobData>): Promise<JobResult> {
  const start = Date.now()
  const { pointerIds, domain, runId } = job.data

  try {
    // Rate limit LLM calls
    const result = await llmLimiter.schedule(() => runComposer(pointerIds))

    if (result.success && result.ruleId) {
      // Queue review job
      await reviewQueue.add("review", {
        ruleId: result.ruleId,
        runId,
        parentJobId: job.id,
      })
    } else if (result.error?.includes("Conflict detected")) {
      // Conflict was created - arbiter will pick it up
      console.log(`[composer] Conflict detected for domain ${domain}`)
    }

    const duration = Date.now() - start
    jobsProcessed.inc({ worker: "composer", status: "success", queue: "compose" })
    jobDuration.observe({ worker: "composer", queue: "compose" }, duration / 1000)

    return {
      success: result.success,
      duration,
      data: { ruleId: result.ruleId, domain },
    }
  } catch (error) {
    jobsProcessed.inc({ worker: "composer", status: "failed", queue: "compose" })
    return {
      success: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// Create and start worker
const worker = createWorker<ComposeJobData>("compose", processComposeJob, {
  name: "composer",
  concurrency: 1,
})

setupGracefulShutdown([worker])

console.log("[composer] Worker started")
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/workers/composer.worker.ts
git commit -m "feat(workers): add composer worker"
```

---

### Task 3.4: Create Reviewer Worker

**Files:**

- Create: `src/lib/regulatory-truth/workers/reviewer.worker.ts`

**Step 1: Implement reviewer worker**

```typescript
// src/lib/regulatory-truth/workers/reviewer.worker.ts
import { Job } from "bullmq"
import { createWorker, setupGracefulShutdown, type JobResult } from "./base"
import { releaseQueue } from "./queues"
import { jobsProcessed, jobDuration } from "./metrics"
import { llmLimiter } from "./rate-limiter"
import { runReviewer } from "../agents/reviewer"
import { db } from "@/lib/db"

interface ReviewJobData {
  ruleId: string
  runId: string
  parentJobId?: string
}

async function processReviewJob(job: Job<ReviewJobData>): Promise<JobResult> {
  const start = Date.now()
  const { ruleId, runId } = job.data

  try {
    // Rate limit LLM calls
    const result = await llmLimiter.schedule(() => runReviewer(ruleId))

    if (result.success) {
      // Check if rule was auto-approved
      const rule = await db.regulatoryRule.findUnique({
        where: { id: ruleId },
        select: { status: true },
      })

      if (rule?.status === "APPROVED") {
        // Queue for release
        await releaseQueue.add("release-single", {
          ruleIds: [ruleId],
          runId,
          parentJobId: job.id,
        })
      }
    }

    const duration = Date.now() - start
    jobsProcessed.inc({ worker: "reviewer", status: "success", queue: "review" })
    jobDuration.observe({ worker: "reviewer", queue: "review" }, duration / 1000)

    return {
      success: result.success,
      duration,
      data: {
        decision: result.output?.review_result?.decision,
      },
    }
  } catch (error) {
    jobsProcessed.inc({ worker: "reviewer", status: "failed", queue: "review" })
    return {
      success: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// Create and start worker
const worker = createWorker<ReviewJobData>("review", processReviewJob, {
  name: "reviewer",
  concurrency: 1,
})

setupGracefulShutdown([worker])

console.log("[reviewer] Worker started")
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/workers/reviewer.worker.ts
git commit -m "feat(workers): add reviewer worker"
```

---

### Task 3.5: Create Arbiter Worker

**Files:**

- Create: `src/lib/regulatory-truth/workers/arbiter.worker.ts`

**Step 1: Implement arbiter worker**

```typescript
// src/lib/regulatory-truth/workers/arbiter.worker.ts
import { Job } from "bullmq"
import { createWorker, setupGracefulShutdown, type JobResult } from "./base"
import { jobsProcessed, jobDuration } from "./metrics"
import { llmLimiter } from "./rate-limiter"
import { runArbiter } from "../agents/arbiter"
import { db } from "@/lib/db"

interface ArbiterJobData {
  conflictId: string
  runId: string
  parentJobId?: string
}

async function processArbiterJob(job: Job<ArbiterJobData>): Promise<JobResult> {
  const start = Date.now()
  const { conflictId } = job.data

  try {
    // Rate limit LLM calls
    const result = await llmLimiter.schedule(() => runArbiter(conflictId))

    const duration = Date.now() - start
    jobsProcessed.inc({ worker: "arbiter", status: "success", queue: "arbiter" })
    jobDuration.observe({ worker: "arbiter", queue: "arbiter" }, duration / 1000)

    return {
      success: result.success,
      duration,
      data: { resolution: result.resolution },
    }
  } catch (error) {
    jobsProcessed.inc({ worker: "arbiter", status: "failed", queue: "arbiter" })
    return {
      success: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// Also process open conflicts periodically
async function processOpenConflicts(): Promise<void> {
  const conflicts = await db.regulatoryConflict.findMany({
    where: { status: "OPEN" },
    select: { id: true },
    take: 5,
  })

  for (const conflict of conflicts) {
    await arbiterQueue.add("arbiter", {
      conflictId: conflict.id,
      runId: `arbiter-sweep-${Date.now()}`,
    })
  }
}

import { arbiterQueue } from "./queues"

// Create and start worker
const worker = createWorker<ArbiterJobData>("arbiter", processArbiterJob, {
  name: "arbiter",
  concurrency: 1,
})

setupGracefulShutdown([worker])

console.log("[arbiter] Worker started")
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/workers/arbiter.worker.ts
git commit -m "feat(workers): add arbiter worker"
```

---

### Task 3.6: Create Releaser Worker

**Files:**

- Create: `src/lib/regulatory-truth/workers/releaser.worker.ts`

**Step 1: Implement releaser worker**

```typescript
// src/lib/regulatory-truth/workers/releaser.worker.ts
import { Job } from "bullmq"
import { createWorker, setupGracefulShutdown, type JobResult } from "./base"
import { jobsProcessed, jobDuration } from "./metrics"
import { runReleaser } from "../agents/releaser"
import { buildKnowledgeGraph } from "../graph/knowledge-graph"

interface ReleaseJobData {
  ruleIds: string[]
  runId: string
  parentJobId?: string
}

async function processReleaseJob(job: Job<ReleaseJobData>): Promise<JobResult> {
  const start = Date.now()
  const { ruleIds } = job.data

  try {
    const result = await runReleaser(ruleIds)

    // Build knowledge graph after release
    if (result.success) {
      await buildKnowledgeGraph()
    }

    const duration = Date.now() - start
    jobsProcessed.inc({ worker: "releaser", status: "success", queue: "release" })
    jobDuration.observe({ worker: "releaser", queue: "release" }, duration / 1000)

    return {
      success: result.success,
      duration,
      data: {
        releaseId: result.releaseId,
        publishedCount: result.publishedRuleIds.length,
      },
    }
  } catch (error) {
    jobsProcessed.inc({ worker: "releaser", status: "failed", queue: "release" })
    return {
      success: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// Create and start worker
const worker = createWorker<ReleaseJobData>("release", processReleaseJob, {
  name: "releaser",
  concurrency: 1,
})

setupGracefulShutdown([worker])

console.log("[releaser] Worker started")
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/workers/releaser.worker.ts
git commit -m "feat(workers): add releaser worker"
```

---

### Task 3.7: Create Orchestrator Worker

**Files:**

- Create: `src/lib/regulatory-truth/workers/orchestrator.worker.ts`

**Step 1: Implement orchestrator worker**

```typescript
// src/lib/regulatory-truth/workers/orchestrator.worker.ts
import { Job } from "bullmq"
import { createWorker, setupGracefulShutdown, type JobResult } from "./base"
import { sentinelQueue, releaseQueue, arbiterQueue } from "./queues"
import { jobsProcessed, jobDuration } from "./metrics"
import { db } from "@/lib/db"
import { autoApproveEligibleRules } from "../agents/reviewer"

interface ScheduledJobData {
  type: "pipeline-run" | "audit" | "digest" | "auto-approve" | "arbiter-sweep" | "release-batch"
  runId: string
  triggeredBy?: string
}

async function processScheduledJob(job: Job<ScheduledJobData>): Promise<JobResult> {
  const start = Date.now()
  const { type, runId } = job.data

  try {
    switch (type) {
      case "pipeline-run": {
        // Kick off sentinel for all active sources
        const sources = await db.regulatorySource.findMany({
          where: { isActive: true },
          select: { id: true, hierarchy: true },
        })

        // Group by hierarchy and queue sentinels
        await sentinelQueue.add("sentinel-critical", {
          runId,
          priority: "CRITICAL",
        })

        await sentinelQueue.add(
          "sentinel-high",
          { runId, priority: "HIGH" },
          { delay: 60000 } // 1 min after critical
        )

        return { success: true, duration: Date.now() - start, data: { sources: sources.length } }
      }

      case "auto-approve": {
        const result = await autoApproveEligibleRules()
        return { success: true, duration: Date.now() - start, data: result }
      }

      case "arbiter-sweep": {
        const conflicts = await db.regulatoryConflict.findMany({
          where: { status: "OPEN" },
          select: { id: true },
          take: 10,
        })

        for (const c of conflicts) {
          await arbiterQueue.add("arbiter", { conflictId: c.id, runId })
        }

        return {
          success: true,
          duration: Date.now() - start,
          data: { conflicts: conflicts.length },
        }
      }

      case "release-batch": {
        const approved = await db.regulatoryRule.findMany({
          where: { status: "APPROVED", releases: { none: {} } },
          select: { id: true },
          take: 20,
        })

        if (approved.length > 0) {
          await releaseQueue.add("release", {
            ruleIds: approved.map((r) => r.id),
            runId,
          })
        }

        return { success: true, duration: Date.now() - start, data: { approved: approved.length } }
      }

      default:
        return { success: true, duration: Date.now() - start }
    }
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// Create and start worker
const worker = createWorker<ScheduledJobData>("scheduled", processScheduledJob, {
  name: "orchestrator",
  concurrency: 1,
})

setupGracefulShutdown([worker])

console.log("[orchestrator] Worker started")
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/workers/orchestrator.worker.ts
git commit -m "feat(workers): add orchestrator worker for scheduled jobs"
```

---

### Task 3.8: Create Scheduler Service

**Files:**

- Create: `src/lib/regulatory-truth/workers/scheduler.service.ts`

**Step 1: Implement cron scheduler**

```typescript
// src/lib/regulatory-truth/workers/scheduler.service.ts
import cron from "node-cron"
import { scheduledQueue } from "./queues"
import { closeRedis } from "./redis"

const TIMEZONE = process.env.WATCHDOG_TIMEZONE || "Europe/Zagreb"

async function startScheduler(): Promise<void> {
  console.log("[scheduler] Starting scheduler service...")
  console.log(`[scheduler] Timezone: ${TIMEZONE}`)

  // Daily pipeline at 06:00
  cron.schedule(
    "0 6 * * *",
    async () => {
      console.log("[scheduler] Triggering daily pipeline run")
      await scheduledQueue.add("scheduled", {
        type: "pipeline-run",
        runId: `scheduled-${Date.now()}`,
        triggeredBy: "cron",
      })
    },
    { timezone: TIMEZONE }
  )
  console.log("[scheduler] Scheduled: Daily pipeline at 06:00")

  // Auto-approve check at 07:00
  cron.schedule(
    "0 7 * * *",
    async () => {
      await scheduledQueue.add("scheduled", {
        type: "auto-approve",
        runId: `auto-approve-${Date.now()}`,
      })
    },
    { timezone: TIMEZONE }
  )
  console.log("[scheduler] Scheduled: Auto-approve at 07:00")

  // Release batch at 07:30
  cron.schedule(
    "30 7 * * *",
    async () => {
      await scheduledQueue.add("scheduled", {
        type: "release-batch",
        runId: `release-${Date.now()}`,
      })
    },
    { timezone: TIMEZONE }
  )
  console.log("[scheduler] Scheduled: Release batch at 07:30")

  // Arbiter sweep at 12:00
  cron.schedule(
    "0 12 * * *",
    async () => {
      await scheduledQueue.add("scheduled", {
        type: "arbiter-sweep",
        runId: `arbiter-sweep-${Date.now()}`,
      })
    },
    { timezone: TIMEZONE }
  )
  console.log("[scheduler] Scheduled: Arbiter sweep at 12:00")

  // Random audit between 10:00-14:00
  const auditHour = 10 + Math.floor(Math.random() * 4)
  const auditMinute = Math.floor(Math.random() * 60)
  cron.schedule(
    `${auditMinute} ${auditHour} * * *`,
    async () => {
      await scheduledQueue.add("scheduled", {
        type: "audit",
        runId: `audit-${Date.now()}`,
      })
    },
    { timezone: TIMEZONE }
  )
  console.log(
    `[scheduler] Scheduled: Random audit at ${auditHour}:${auditMinute.toString().padStart(2, "0")}`
  )

  console.log("[scheduler] Scheduler service started")
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[scheduler] Shutting down...")
  await closeRedis()
  process.exit(0)
})

process.on("SIGINT", async () => {
  console.log("[scheduler] Shutting down...")
  await closeRedis()
  process.exit(0)
})

// Start
startScheduler().catch((error) => {
  console.error("[scheduler] Failed to start:", error)
  process.exit(1)
})
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/workers/scheduler.service.ts
git commit -m "feat(workers): add scheduler service with cron jobs"
```

---

## Phase 4: Integration

### Task 4.1: Update API Trigger Route

**Files:**

- Modify: `src/app/api/regulatory/trigger/route.ts`

**Step 1: Update to use queue instead of direct execution**

```typescript
// src/app/api/regulatory/trigger/route.ts
import { NextRequest, NextResponse } from "next/server"
import { scheduledQueue } from "@/lib/regulatory-truth/workers/queues"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const phases = body.phases || ["sentinel", "extract", "compose", "review", "release"]

    const job = await scheduledQueue.add("scheduled", {
      type: "pipeline-run",
      runId: `api-${Date.now()}`,
      triggeredBy: "api",
      phases,
    })

    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: "queued",
      message: "Pipeline run queued successfully",
    })
  } catch (error) {
    console.error("[trigger] Error:", error)
    return NextResponse.json({ error: "Failed to queue pipeline run" }, { status: 500 })
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/regulatory/trigger/route.ts
git commit -m "feat(api): update trigger route to use job queue"
```

---

### Task 4.2: Update API Status Route

**Files:**

- Modify: `src/app/api/regulatory/status/route.ts`

**Step 1: Update to show queue status**

```typescript
// src/app/api/regulatory/status/route.ts
import { NextResponse } from "next/server"
import { allQueues, checkRedisHealth } from "@/lib/regulatory-truth/workers"
import { getCircuitBreakerStatus } from "@/lib/regulatory-truth/workers/circuit-breaker"

export async function GET() {
  try {
    const redisHealthy = await checkRedisHealth()

    // Get queue depths
    const queueStatus: Record<string, { waiting: number; active: number; failed: number }> = {}
    for (const [name, queue] of Object.entries(allQueues)) {
      const counts = await queue.getJobCounts("waiting", "active", "failed")
      queueStatus[name] = {
        waiting: counts.waiting,
        active: counts.active,
        failed: counts.failed,
      }
    }

    return NextResponse.json({
      status: redisHealthy ? "healthy" : "degraded",
      redis: redisHealthy ? "connected" : "disconnected",
      queues: queueStatus,
      circuitBreakers: getCircuitBreakerStatus(),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({ status: "error", error: String(error) }, { status: 500 })
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/regulatory/status/route.ts
git commit -m "feat(api): update status route to show queue status"
```

---

### Task 4.3: Add Metrics Endpoint

**Files:**

- Create: `src/app/api/regulatory/metrics/route.ts`

**Step 1: Create Prometheus metrics endpoint**

```typescript
// src/app/api/regulatory/metrics/route.ts
import { NextResponse } from "next/server"
import { getMetrics, queueDepth, allQueues } from "@/lib/regulatory-truth/workers"

export async function GET() {
  try {
    // Update queue depths before returning metrics
    for (const [name, queue] of Object.entries(allQueues)) {
      const counts = await queue.getJobCounts("waiting")
      queueDepth.set({ queue: name }, counts.waiting)
    }

    const metrics = await getMetrics()

    return new NextResponse(metrics, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/regulatory/metrics/route.ts
git commit -m "feat(api): add Prometheus metrics endpoint"
```

---

### Task 4.4: Update Watchdog Health Monitors

**Files:**

- Modify: `src/lib/regulatory-truth/watchdog/health-monitors.ts`

**Step 1: Add queue health checks**

Add to existing health monitors:

```typescript
// Add to health-monitors.ts

import { allQueues, checkRedisHealth, deadletterQueue } from "../workers"

/**
 * Check Redis connection health
 */
export async function checkRedisConnectionHealth(): Promise<HealthCheckResult> {
  const healthy = await checkRedisHealth()

  return {
    checkType: "PIPELINE_HEALTH" as const,
    status: healthy ? "HEALTHY" : "CRITICAL",
    message: healthy ? "Redis connected" : "Redis connection failed",
    metadata: {},
  }
}

/**
 * Check dead letter queue for accumulated failures
 */
export async function checkDeadLetterQueueHealth(): Promise<HealthCheckResult> {
  const counts = await deadletterQueue.getJobCounts("waiting", "failed")
  const total = counts.waiting + counts.failed

  let status: "HEALTHY" | "WARNING" | "CRITICAL" = "HEALTHY"
  if (total > 50) status = "CRITICAL"
  else if (total > 10) status = "WARNING"

  return {
    checkType: "REJECTION_RATE" as const,
    status,
    message: `${total} jobs in dead-letter queue`,
    metadata: { waiting: counts.waiting, failed: counts.failed },
  }
}

/**
 * Check queue backlogs
 */
export async function checkQueueBacklogHealth(): Promise<HealthCheckResult> {
  const backlogs: Record<string, number> = {}
  let maxBacklog = 0

  for (const [name, queue] of Object.entries(allQueues)) {
    const counts = await queue.getJobCounts("waiting")
    backlogs[name] = counts.waiting
    maxBacklog = Math.max(maxBacklog, counts.waiting)
  }

  let status: "HEALTHY" | "WARNING" | "CRITICAL" = "HEALTHY"
  if (maxBacklog > 100) status = "CRITICAL"
  else if (maxBacklog > 50) status = "WARNING"

  return {
    checkType: "PIPELINE_HEALTH" as const,
    status,
    message: `Max queue backlog: ${maxBacklog}`,
    metadata: backlogs,
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/regulatory-truth/watchdog/health-monitors.ts
git commit -m "feat(watchdog): add queue health monitoring"
```

---

## Phase 5: Docker & Deployment

### Task 5.1: Create Worker Dockerfile

**Files:**

- Create: `Dockerfile.worker`

**Step 1: Create optimized worker Dockerfile**

```dockerfile
# Dockerfile.worker
# Lightweight worker image

FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Build the application
FROM base AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 worker

# Copy built files
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

USER worker

# Default command (override in docker-compose)
CMD ["node", "dist/lib/regulatory-truth/workers/orchestrator.worker.js"]
```

**Step 2: Commit**

```bash
git add Dockerfile.worker
git commit -m "infra: add worker Dockerfile"
```

---

### Task 5.2: Add Worker Services to Docker Compose

**Files:**

- Modify: `docker-compose.workers.yml`

**Step 1: Add all worker services**

Add to existing docker-compose.workers.yml:

```yaml
# Worker services
worker-orchestrator:
  build:
    context: .
    dockerfile: Dockerfile.worker
  container_name: fiskai-worker-orchestrator
  restart: unless-stopped
  command: node dist/lib/regulatory-truth/workers/orchestrator.worker.js
  environment:
    - NODE_ENV=production
    - REDIS_URL=redis://redis:6379
    - DATABASE_URL=${DATABASE_URL}
    - WORKER_TYPE=orchestrator
    - WORKER_CONCURRENCY=1
  depends_on:
    redis:
      condition: service_healthy
    fiskai-db:
      condition: service_healthy
  networks:
    - default
    - coolify

worker-sentinel:
  build:
    context: .
    dockerfile: Dockerfile.worker
  container_name: fiskai-worker-sentinel
  restart: unless-stopped
  command: node dist/lib/regulatory-truth/workers/sentinel.worker.js
  environment:
    - NODE_ENV=production
    - REDIS_URL=redis://redis:6379
    - DATABASE_URL=${DATABASE_URL}
    - WORKER_TYPE=sentinel
    - WORKER_CONCURRENCY=1
  depends_on:
    redis:
      condition: service_healthy
  networks:
    - default
    - coolify

worker-extractor:
  build:
    context: .
    dockerfile: Dockerfile.worker
  container_name: fiskai-worker-extractor
  restart: unless-stopped
  command: node dist/lib/regulatory-truth/workers/extractor.worker.js
  environment:
    - NODE_ENV=production
    - REDIS_URL=redis://redis:6379
    - DATABASE_URL=${DATABASE_URL}
    - OLLAMA_ENDPOINT=${OLLAMA_ENDPOINT}
    - OLLAMA_API_KEY=${OLLAMA_API_KEY}
    - OLLAMA_MODEL=${OLLAMA_MODEL}
    - WORKER_TYPE=extractor
    - WORKER_CONCURRENCY=2
  depends_on:
    redis:
      condition: service_healthy
  deploy:
    replicas: 2
  networks:
    - default
    - coolify

worker-composer:
  build:
    context: .
    dockerfile: Dockerfile.worker
  container_name: fiskai-worker-composer
  restart: unless-stopped
  command: node dist/lib/regulatory-truth/workers/composer.worker.js
  environment:
    - NODE_ENV=production
    - REDIS_URL=redis://redis:6379
    - DATABASE_URL=${DATABASE_URL}
    - OLLAMA_ENDPOINT=${OLLAMA_ENDPOINT}
    - OLLAMA_API_KEY=${OLLAMA_API_KEY}
    - OLLAMA_MODEL=${OLLAMA_MODEL}
    - WORKER_TYPE=composer
    - WORKER_CONCURRENCY=1
  depends_on:
    redis:
      condition: service_healthy
  networks:
    - default
    - coolify

worker-reviewer:
  build:
    context: .
    dockerfile: Dockerfile.worker
  container_name: fiskai-worker-reviewer
  restart: unless-stopped
  command: node dist/lib/regulatory-truth/workers/reviewer.worker.js
  environment:
    - NODE_ENV=production
    - REDIS_URL=redis://redis:6379
    - DATABASE_URL=${DATABASE_URL}
    - OLLAMA_ENDPOINT=${OLLAMA_ENDPOINT}
    - OLLAMA_API_KEY=${OLLAMA_API_KEY}
    - OLLAMA_MODEL=${OLLAMA_MODEL}
    - WORKER_TYPE=reviewer
    - WORKER_CONCURRENCY=1
  depends_on:
    redis:
      condition: service_healthy
  networks:
    - default
    - coolify

worker-scheduler:
  build:
    context: .
    dockerfile: Dockerfile.worker
  container_name: fiskai-worker-scheduler
  restart: unless-stopped
  command: node dist/lib/regulatory-truth/workers/scheduler.service.js
  environment:
    - NODE_ENV=production
    - REDIS_URL=redis://redis:6379
    - WATCHDOG_TIMEZONE=Europe/Zagreb
    - WORKER_TYPE=scheduler
  depends_on:
    redis:
      condition: service_healthy
  networks:
    - default
    - coolify
```

**Step 2: Commit**

```bash
git add docker-compose.workers.yml
git commit -m "infra: add all worker services to Docker Compose"
```

---

### Task 5.3: Create Worker Build Script

**Files:**

- Modify: `package.json`

**Step 1: Add worker build scripts**

Add to package.json scripts:

```json
{
  "scripts": {
    "build:workers": "tsc -p tsconfig.workers.json",
    "workers:start": "docker compose -f docker-compose.workers.yml up -d",
    "workers:stop": "docker compose -f docker-compose.workers.yml down",
    "workers:logs": "docker compose -f docker-compose.workers.yml logs -f",
    "workers:status": "docker compose -f docker-compose.workers.yml ps"
  }
}
```

**Step 2: Create worker tsconfig**

Create `tsconfig.workers.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "commonjs",
    "moduleResolution": "node",
    "esModuleInterop": true
  },
  "include": ["src/lib/regulatory-truth/workers/**/*"],
  "exclude": ["node_modules", "**/*.test.ts"]
}
```

**Step 3: Commit**

```bash
git add package.json tsconfig.workers.json
git commit -m "build: add worker build scripts and tsconfig"
```

---

## Phase 6: Testing & Migration

### Task 6.1: Create Worker Integration Test

**Files:**

- Create: `src/lib/regulatory-truth/workers/__tests__/integration.test.ts`

**Step 1: Create integration test**

```typescript
// src/lib/regulatory-truth/workers/__tests__/integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { redis, checkRedisHealth, closeRedis } from "../redis"
import { sentinelQueue, extractQueue } from "../queues"

describe("Worker Integration", () => {
  beforeAll(async () => {
    // Ensure Redis is available
    const healthy = await checkRedisHealth()
    if (!healthy) {
      throw new Error("Redis not available for tests")
    }
  })

  afterAll(async () => {
    await closeRedis()
  })

  it("should connect to Redis", async () => {
    const healthy = await checkRedisHealth()
    expect(healthy).toBe(true)
  })

  it("should add job to sentinel queue", async () => {
    const job = await sentinelQueue.add("test-sentinel", {
      runId: "test-run",
      priority: "CRITICAL",
    })

    expect(job.id).toBeDefined()
    expect(job.name).toBe("test-sentinel")

    // Clean up
    await job.remove()
  })

  it("should add job to extract queue with delay", async () => {
    const job = await extractQueue.add(
      "test-extract",
      { evidenceId: "test-evidence", runId: "test-run" },
      { delay: 1000 }
    )

    expect(job.id).toBeDefined()
    const state = await job.getState()
    expect(state).toBe("delayed")

    // Clean up
    await job.remove()
  })
})
```

**Step 2: Run tests**

Run: `npm test -- src/lib/regulatory-truth/workers/__tests__/integration.test.ts`

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/workers/__tests__/integration.test.ts
git commit -m "test(workers): add integration tests"
```

---

### Task 6.2: Create Migration Script

**Files:**

- Create: `scripts/migrate-to-workers.sh`

**Step 1: Create migration helper script**

```bash
#!/bin/bash
# scripts/migrate-to-workers.sh
# Migration script for transitioning from overnight-run.ts to workers

set -e

echo "=== FiskAI Worker Migration ==="
echo ""

# Phase 1: Start Redis
echo "Phase 1: Starting Redis..."
docker compose -f docker-compose.workers.yml up redis -d
sleep 5

# Check Redis health
docker exec fiskai-redis redis-cli ping || {
  echo "ERROR: Redis not healthy"
  exit 1
}
echo "✓ Redis healthy"

# Phase 2: Build workers
echo ""
echo "Phase 2: Building workers..."
npm run build:workers || {
  echo "ERROR: Worker build failed"
  exit 1
}
echo "✓ Workers built"

# Phase 3: Start Bull Board
echo ""
echo "Phase 3: Starting Bull Board..."
docker compose -f docker-compose.workers.yml up bull-board -d
echo "✓ Bull Board available at http://localhost:3001"

# Phase 4: Start workers
echo ""
echo "Phase 4: Starting workers..."
docker compose -f docker-compose.workers.yml up -d
echo "✓ Workers started"

# Phase 5: Verify
echo ""
echo "Phase 5: Verifying deployment..."
sleep 10
docker compose -f docker-compose.workers.yml ps

echo ""
echo "=== Migration Complete ==="
echo ""
echo "Next steps:"
echo "1. Monitor Bull Board at http://localhost:3001"
echo "2. Check worker logs: npm run workers:logs"
echo "3. Trigger a test run: curl -X POST http://localhost:3000/api/regulatory/trigger"
echo "4. Once verified, disable overnight-run.ts cron"
```

**Step 2: Make executable**

Run: `chmod +x scripts/migrate-to-workers.sh`

**Step 3: Commit**

```bash
git add scripts/migrate-to-workers.sh
git commit -m "scripts: add worker migration script"
```

---

## Summary

**Total Tasks:** 22 tasks across 6 phases

**Phase 1: Infrastructure (3 tasks)**

- Dependencies, Redis Docker, Environment variables

**Phase 2: Core Framework (7 tasks)**

- Redis connection, Queues, Base worker, Metrics, Rate limiter, Circuit breaker, Index

**Phase 3: Workers (8 tasks)**

- Sentinel, Extractor, Composer, Reviewer, Arbiter, Releaser, Orchestrator, Scheduler

**Phase 4: Integration (4 tasks)**

- API trigger route, Status route, Metrics endpoint, Watchdog health

**Phase 5: Docker (3 tasks)**

- Worker Dockerfile, Docker Compose services, Build scripts

**Phase 6: Testing (2 tasks)**

- Integration tests, Migration script

**Estimated time:** 3-4 hours for full implementation
