# Document I: Infrastructure & Execution

**Phase 0 Exploration Document**
**Date**: 2026-01-07
**Scope**: Workers, queues, schedules, deployment model

---

## Overview

FiskAI uses a **two-layer execution model** for Regulatory Truth Layer processing:

- **Layer A (Discovery)**: Scheduled daily sentinel scans at 06:00 Zagreb time
- **Layer B (Processing)**: 24/7 continuous queue draining with BullMQ + Redis

---

## Infrastructure Components

### Core Services

| Component  | Container    | Image          | Purpose                          |
| ---------- | ------------ | -------------- | -------------------------------- |
| Redis      | fiskai-redis | redis:7-alpine | Job queue backend, state storage |
| PostgreSQL | fiskai-db    | postgres:16    | Primary database                 |

### Redis Configuration

```yaml
redis:
  image: redis:7-alpine
  command: redis-server --maxmemory 2gb --maxmemory-policy allkeys-lru
  volumes:
    - redis_data:/data
```

---

## Worker Definitions

### Location

`docker-compose.workers.yml` (431 lines, 15 worker services)

### Layer A: Discovery Workers

| Worker    | Container               | Concurrency | Schedule             |
| --------- | ----------------------- | ----------- | -------------------- |
| scheduler | fiskai-worker-scheduler | 1           | Cron at 06:00 Zagreb |
| sentinel  | fiskai-worker-sentinel  | 1           | Queued by scheduler  |

### Layer B: Processing Workers

| Worker             | Container                        | Concurrency | Replicas | Purpose                 |
| ------------------ | -------------------------------- | ----------- | -------- | ----------------------- |
| ocr                | fiskai-worker-ocr                | 1           | 1        | Tesseract + Vision OCR  |
| extractor          | fiskai-worker-extractor          | 2           | 2        | LLM fact extraction     |
| composer           | fiskai-worker-composer           | 1           | 1        | Fact → Rule aggregation |
| reviewer           | fiskai-worker-reviewer           | 1           | 1        | Quality gates           |
| arbiter            | fiskai-worker-arbiter            | 1           | 1        | Conflict resolution     |
| releaser           | fiskai-worker-releaser           | 1           | 1        | Rule publication        |
| continuous-drainer | fiskai-worker-continuous-drainer | 1           | 1        | Pipeline orchestration  |

### Orchestration Workers

| Worker       | Container                  | Purpose                  |
| ------------ | -------------------------- | ------------------------ |
| orchestrator | fiskai-worker-orchestrator | Scheduled job processing |
| scheduler    | fiskai-worker-scheduler    | Cron trigger system      |

### Content & Embedding Workers

| Worker             | Container                        | Concurrency | Purpose                  |
| ------------------ | -------------------------------- | ----------- | ------------------------ |
| content-sync       | fiskai-worker-content-sync       | 1           | MDX frontmatter patching |
| article            | fiskai-worker-article            | 1           | Article generation       |
| embedding          | fiskai-worker-embedding          | 2           | Rule vector embeddings   |
| evidence-embedding | fiskai-worker-evidence-embedding | 2           | Evidence embeddings      |

### E-Invoice Workers

| Worker           | Container                      | Purpose             |
| ---------------- | ------------------------------ | ------------------- |
| einvoice-inbound | fiskai-worker-einvoice-inbound | ePoslovanje polling |

---

## Queue System

### BullMQ + Redis Architecture

**Location**: `src/lib/regulatory-truth/workers/queues.ts`

### Default Job Options

```typescript
{
  attempts: 3,                              // 3 retries
  backoff: { type: "exponential", delay: 10000 },  // 10s, 20s, 40s
  removeOnComplete: { count: 1000 },        // Keep last 1000 completed
  removeOnFail: { count: 100 }              // Keep last 100 failed
}
```

### Queue Definitions

| Queue              | Rate Limit | Purpose             |
| ------------------ | ---------- | ------------------- |
| sentinel           | 5/60s      | Endpoint discovery  |
| extract            | 10/60s     | LLM fact extraction |
| ocr                | 2/60s      | PDF OCR processing  |
| compose            | 5/60s      | Fact aggregation    |
| review             | 5/60s      | Quality checks      |
| arbiter            | 3/60s      | Conflict resolution |
| release            | 2/60s      | Rule publication    |
| consolidator       | 1/300s     | Data consolidation  |
| content-sync       | 2/60s      | MDX patching        |
| article            | 2/60s      | Article generation  |
| backup             | 2/60s      | Company backups     |
| embedding          | 10/60s     | Rule embeddings     |
| evidence-embedding | 5/60s      | Evidence embeddings |
| scheduled          | unbounded  | Cron triggers       |
| deadletter         | unbounded  | Failed jobs         |

---

## Scheduling

### Daily Schedule (Europe/Zagreb)

**Location**: `src/lib/regulatory-truth/workers/scheduler.service.ts`

| Time  | Job                       | Description               |
| ----- | ------------------------- | ------------------------- |
| 03:00 | confidence-decay          | Weekly (Sundays only)     |
| 04:00 | truth-consolidation-audit | Daily integrity check     |
| 05:00 | e2e-validation            | System health validation  |
| 06:00 | sentinel-critical         | High-priority source scan |
| 06:01 | sentinel-high             | (60s delay)               |
| 06:02 | sentinel-normal           | (120s delay)              |
| 06:03 | sentinel-low              | (180s delay)              |
| 06:30 | health-snapshot           | Endpoint health check     |

### Orchestrator Scheduled Jobs

| Job Type                  | Purpose                |
| ------------------------- | ---------------------- |
| pipeline-run              | Sentinel kickoff       |
| auto-approve              | T2/T3 auto-approval    |
| arbiter-sweep             | Process open conflicts |
| release-batch             | Publish approved rules |
| confidence-decay          | Weekly score decay     |
| e2e-validation            | System validation      |
| health-snapshot           | State capture          |
| truth-consolidation-audit | Integrity audit        |

---

## Continuous Drainer

### Purpose

24/7 pipeline orchestration that processes all stages in sequence.

**Location**: `src/lib/regulatory-truth/workers/continuous-drainer.worker.ts`

### Processing Stages

```
Stage 1: pending-items
    Query: Evidence without sourcePointers
    Action: Queue extract jobs (up to 50)

Stage 2: pending-ocr
    Query: Evidence with class=PDF_SCANNED, no OCR artifact
    Action: Queue OCR jobs

Stage 3: fetched-evidence
    Process OCR results, mark ready for extraction

Stage 4: source-pointers
    Query: SourcePointers without Rules
    Action: Queue compose jobs

Stage 5: draft-rules
    Query: Rules with status=DRAFT
    Action: Queue review jobs

Stage 6: conflicts
    Query: RegulatoryConflict with status=OPEN
    Action: Queue arbiter jobs

Stage 7: approved-rules
    Query: Rules with status=APPROVED, no releases
    Action: Queue release jobs
```

### Per-Stage Protections

- Circuit breakers (30% error threshold)
- Per-stage heartbeats (stall detection)
- Bottleneck rate limiters
- Bounded data retention

---

## Error Handling

### Retry Strategy

```typescript
{
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 10000  // 10s → 20s → 40s
  }
}
```

### Dead Letter Queue (DLQ)

**Location**: `src/lib/regulatory-truth/workers/dlq-utils.ts`

```typescript
DLQ_THRESHOLD = 10          // Alert threshold
DLQ_RETENTION_DAYS = 30     // Cleanup after 30 days

// Retention limits
DLQ completed: last 5000 jobs
DLQ failed: last 500 jobs
Main queue failed: last 100 jobs
```

### DLQ Operations

```typescript
getDLQStats() // Queue depth, threshold check
getDLQJobs() // Query DLQ
replayDLQJob(jobId) // Replay single job
replayDLQByQueue(name) // Batch replay
getDLQErrorSummary() // Error clustering
purgeDLQOldJobs() // Cleanup old jobs
```

### Circuit Breaker Pattern

**Location**: `src/lib/regulatory-truth/workers/circuit-breaker.ts`

| Breaker                  | Timeout | Error Threshold | Reset Timeout |
| ------------------------ | ------- | --------------- | ------------- |
| drainer-pending-items    | 300s    | 30%             | 5min          |
| drainer-pending-ocr      | 300s    | 30%             | 5min          |
| drainer-fetched-evidence | 300s    | 30%             | 5min          |
| drainer-source-pointers  | 300s    | 30%             | 5min          |
| drainer-draft-rules      | 300s    | 30%             | 5min          |
| drainer-conflicts        | 300s    | 30%             | 5min          |
| drainer-approved-rules   | 300s    | 30%             | 5min          |

**States**: closed (normal) → open (fail fast) → half-open (testing) → closed

---

## Rate Limiting

### LLM Rate Limiter

**Location**: `src/lib/regulatory-truth/workers/rate-limiter.ts`

```typescript
{
  reservoir: 5,                     // 5 concurrent calls
  reservoirRefreshAmount: 5,        // Refill per interval
  reservoirRefreshInterval: 60000,  // Refill every 60s
  maxConcurrent: 5,
  minTime: 1000                     // Minimum 1s between calls
}
```

### Domain-Specific Delays

| Domain                | Min Delay | Max Delay |
| --------------------- | --------- | --------- |
| narodne-novine.nn.hr  | 3s        | 5s        |
| porezna-uprava.gov.hr | 4s        | 6s        |
| hzzo.hr               | 5s        | 8s        |
| mirovinsko.hr         | 5s        | 8s        |
| fina.hr               | 3s        | 5s        |
| mfin.gov.hr           | 4s        | 6s        |
| eur-lex.europa.eu     | 2s        | 4s        |
| (default)             | 3s        | 5s        |

---

## Docker Configuration

### Dockerfile.worker

```dockerfile
FROM node:22-alpine

# Build stage dependencies
RUN apk add --no-cache python3 make g++

# Runtime dependencies
RUN apk add --no-cache \
    tesseract-ocr \
    tesseract-ocr-data-hrv \
    tesseract-ocr-data-eng \
    poppler-utils \
    ghostscript

# Non-root user
RUN adduser -D -u 1001 worker
USER worker

# Default command
CMD ["npx", "tsx", "src/lib/regulatory-truth/workers/orchestrator.worker.ts"]
```

### Docker Compose Files

| File                       | Purpose              | Database           |
| -------------------------- | -------------------- | ------------------ |
| docker-compose.yml         | Base config          | postgres:16        |
| docker-compose.dev.yml     | Local development    | Local credentials  |
| docker-compose.prod.yml    | Production (Coolify) | Coolify vault      |
| docker-compose.workers.yml | Worker services      | External injection |

### Environment Variables

**Development**:

```bash
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://fiskai:fiskai_dev_password@fiskai-db:5432/fiskai?schema=public
NODE_ENV=production
```

**Production**:

```bash
REDIS_URL=redis://fiskai-redis:6379
DATABASE_URL=${DATABASE_URL}            # Coolify injection
REGULATORY_DATABASE_URL=${REGULATORY_DATABASE_URL}
NODE_ENV=production
```

---

## Monitoring

### Prometheus Metrics

**Location**: `src/lib/regulatory-truth/workers/metrics.ts`

| Metric                       | Type      | Labels                | Purpose         |
| ---------------------------- | --------- | --------------------- | --------------- |
| worker_jobs_processed_total  | Counter   | worker, status, queue | Success/failure |
| worker_job_duration_seconds  | Histogram | worker, queue         | Latency         |
| worker_queue_depth           | Gauge     | queue                 | Pending jobs    |
| worker_active_jobs           | Gauge     | worker                | In-progress     |
| worker_llm_calls_total       | Counter   | worker, status        | API tracking    |
| worker_rate_limit_hits_total | Counter   | worker, domain        | 429 tracking    |

### Queue Status Script

**Location**: `scripts/queue-status.ts`

```bash
# Local
REDIS_URL=redis://localhost:6379 npx tsx scripts/queue-status.ts

# Production (via SSH tunnel)
ssh -L 6379:localhost:6379 admin@server
REDIS_URL=redis://localhost:6379 npx tsx scripts/queue-status.ts
```

### Critical Monitoring Points

| Item            | Alert Threshold         |
| --------------- | ----------------------- |
| DLQ depth       | > 10 jobs               |
| Queue depth     | > 1000 waiting          |
| Drainer idle    | > 10 minutes            |
| Stage stall     | > 5 minutes             |
| Circuit breaker | Open state              |
| OCR artifacts   | Missing for PDF_SCANNED |

---

## Execution Model Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│              LAYER A: DISCOVERY (Scheduled)                      │
│                                                                  │
│  06:00 → Cron trigger (scheduler)                               │
│            │                                                     │
│            ▼                                                     │
│      sentinelQueue.add(sentinel-critical)                       │
│      sentinelQueue.add(sentinel-high) [delay: 60s]              │
│      sentinelQueue.add(sentinel-normal) [delay: 120s]           │
│      sentinelQueue.add(sentinel-low) [delay: 180s]              │
│            │                                                     │
│            ▼                                                     │
│      Sentinel worker: scan endpoints → DiscoveredItem rows      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│            LAYER B: PROCESSING (24/7 Continuous)                 │
│                                                                  │
│  continuous-drainer loop (infinite):                            │
│            │                                                     │
│            ▼                                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Stage 1: pending-items                                  │    │
│  │   Query: Evidence without sourcePointers                │    │
│  │   Action: extractQueue.add(extract jobs)                │    │
│  └─────────────────────────────────────────────────────────┘    │
│            │                                                     │
│            ▼                                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Stage 2: pending-ocr                                    │    │
│  │   Query: Evidence with class=PDF_SCANNED                │    │
│  │   Action: ocrQueue.add(ocr jobs)                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│            │                                                     │
│            ▼                                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Stage 3: fetched-evidence                               │    │
│  │   Process OCR results, mark ready                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│            │                                                     │
│            ▼                                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Stage 4: source-pointers                                │    │
│  │   Query: SourcePointers without Rules                   │    │
│  │   Action: composeQueue.add(compose jobs)                │    │
│  └─────────────────────────────────────────────────────────┘    │
│            │                                                     │
│            ▼                                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Stage 5: draft-rules                                    │    │
│  │   Query: Rules with status=DRAFT                        │    │
│  │   Action: reviewQueue.add(review jobs)                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│            │                                                     │
│            ▼                                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Stage 6: conflicts                                      │    │
│  │   Query: RegulatoryConflict with status=OPEN            │    │
│  │   Action: arbiterQueue.add(arbiter jobs)                │    │
│  └─────────────────────────────────────────────────────────┘    │
│            │                                                     │
│            ▼                                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Stage 7: approved-rules                                 │    │
│  │   Query: Rules with status=APPROVED                     │    │
│  │   Action: releaseQueue.add(release jobs)                │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  All stages have:                                               │
│    • Circuit breakers (30% error threshold)                     │
│    • Per-stage heartbeats (stall detection)                     │
│    • Bottleneck rate limiters                                   │
│    • Bounded data retention                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Worker Concurrency Model

### Single-Instance Workers

- orchestrator, sentinel, scheduler
- releaser, arbiter, reviewer, composer, ocr
- continuous-drainer

### Multi-Instance Workers

- extractor: 2 replicas × 2 concurrency = 4 parallel extractions
- embedding: 2 replicas × 2 concurrency = 4 parallel embeddings

---

## Key Invariants

1. **Evidence immutability**: rawContent never modified after discovery
2. **No hallucinations**: Facts verified against sources before release
3. **Soft references**: No hard FK between Evidence and SourcePointer
4. **Fail-closed**: Ambiguous content goes to human review queue
5. **Bounded queues**: DLQ + removeOnFail limit memory pressure
6. **Idempotency**: Workers safe to re-run (check artifacts first)
7. **Deterministic**: Explicit timestamps, no ambient Date usage

---

## UNKNOWN Items

1. **Auto-scaling**: No automatic worker scaling based on queue depth
2. **Multi-region**: Single region deployment only
3. **Backup Strategy**: No documented Redis/Postgres backup schedule
4. **Health Endpoints**: No /health endpoints for workers
5. **Log Aggregation**: No centralized logging (stdout only)
6. **Alerting**: No PagerDuty/Slack integration for DLQ alerts

---

## File Summary

| File                                                          | Lines | Purpose                    |
| ------------------------------------------------------------- | ----- | -------------------------- |
| docker-compose.workers.yml                                    | 431   | Worker service definitions |
| src/lib/regulatory-truth/workers/base.ts                      | 152   | Worker factory             |
| src/lib/regulatory-truth/workers/redis.ts                     | 147   | Redis + heartbeat          |
| src/lib/regulatory-truth/workers/queues.ts                    | 132   | Queue definitions          |
| src/lib/regulatory-truth/workers/circuit-breaker.ts           | 89    | Fault isolation            |
| src/lib/regulatory-truth/workers/dlq-utils.ts                 | 240   | DLQ operations             |
| src/lib/regulatory-truth/workers/metrics.ts                   | 55    | Prometheus metrics         |
| src/lib/regulatory-truth/workers/rate-limiter.ts              | 45    | Domain delays              |
| src/lib/regulatory-truth/workers/scheduler.service.ts         | 150+  | Cron triggers              |
| src/lib/regulatory-truth/workers/continuous-drainer.worker.ts | 300+  | Pipeline orchestration     |
| Dockerfile.worker                                             | 62    | Worker container           |

---

## References

- Docker Compose: `docker-compose.workers.yml`
- Queue Definitions: `src/lib/regulatory-truth/workers/queues.ts`
- Redis Config: `src/lib/regulatory-truth/workers/redis.ts`
- Scheduler: `src/lib/regulatory-truth/workers/scheduler.service.ts`
- Continuous Drainer: `src/lib/regulatory-truth/workers/continuous-drainer.worker.ts`
- Circuit Breaker: `src/lib/regulatory-truth/workers/circuit-breaker.ts`
- DLQ Utils: `src/lib/regulatory-truth/workers/dlq-utils.ts`
- Queue Status Script: `scripts/queue-status.ts`
