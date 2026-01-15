# Worker Audit: Orchestrator

> Generated: 2026-01-14
> Auditor: Claude Opus
> Git SHA: dae7aa4892b3951bee43544374982d60338805b3

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

---

## 1. Overview

### Purpose

The **Orchestrator Worker** is the central coordination hub for the Regulatory Truth Layer (RTL). It acts as a **job dispatcher** that receives high-level scheduled commands and translates them into specific pipeline operations by:

- Triggering discovery runs (sentinel jobs)
- Executing maintenance tasks (confidence decay, health snapshots)
- Coordinating quality assurance (E2E validation, truth consolidation audits)
- Managing rule lifecycle (auto-approve, arbiter sweeps, release batches)

### Role in the Pipeline

The orchestrator sits **outside** the main data processing pipeline. It does not directly process regulatory content but instead:

1. **Initiates Layer A (Discovery)**: Queues sentinel jobs to scan regulatory endpoints
2. **Triggers Layer B (Processing)**: Coordinates arbiter sweeps and release batches
3. **Runs System Maintenance**: Executes health checks, confidence decay, and consolidation audits

### Layer A/B Execution Model

| Layer | Purpose | Orchestrator Role |
|-------|---------|-------------------|
| **Layer A: Daily Discovery** | Scheduled morning scan of regulatory sources | Queues sentinel jobs for CRITICAL, HIGH priority sources |
| **Layer B: 24/7 Processing** | Continuous extraction, composition, review | Triggers arbiter-sweep and release-batch when needed |
| **Maintenance** | System health and data integrity | Executes confidence-decay, health-snapshot, truth-consolidation-audit |

### Key Invariants

- **Single-threaded execution**: Concurrency is strictly 1 to prevent race conditions
- **Fail-safe**: Individual job type failures do not crash the worker
- **Metrics-always**: Duration and success/failure metrics are always recorded, even on error

---

## 2. Technical Implementation

### Entry Point

**File**: `/home/admin/FiskAI/src/lib/regulatory-truth/workers/orchestrator.worker.ts`

```typescript
const worker = createWorker<ScheduledJobData>("scheduled", processScheduledJob, {
  name: "orchestrator",
  concurrency: 1,
})
```

### Main Loop Architecture

The worker uses BullMQ's `createWorker` pattern:

1. Worker listens on the `scheduled` queue
2. Each job contains a `type` field determining the operation
3. A switch statement routes to the appropriate handler
4. Results are returned as `JobResult` objects

### BullMQ Queue Configuration

| Property | Value | Source |
|----------|-------|--------|
| **Queue Name** | `scheduled` | Hardcoded in worker |
| **Prefix** | `fiskai` (configurable) | `BULLMQ_PREFIX` env var |
| **Concurrency** | 1 | Hardcoded in worker |
| **Lock Duration** | 60,000 ms (default) | `base.ts` |
| **Stalled Interval** | 30,000 ms (default) | `base.ts` |
| **Max Stalled Count** | 2 (default) | `base.ts` |

### Queue Default Job Options

From `/home/admin/FiskAI/src/lib/regulatory-truth/workers/queues.ts`:

```typescript
const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 10000, // 10s, 20s, 40s
  },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 100 },
}
```

### Job Processing Logic

The `processScheduledJob` function handles 9 distinct job types:

| Job Type | Handler Description |
|----------|---------------------|
| `pipeline-run` | Fetches active sources, queues sentinel jobs by priority |
| `auto-approve` | Calls `autoApproveEligibleRules()` for T2/T3 rules |
| `arbiter-sweep` | Finds OPEN conflicts, queues arbiter jobs (max 10) |
| `release-batch` | Finds APPROVED rules without releases, queues release job (max 20) |
| `confidence-decay` | Dynamically imports and runs `applyConfidenceDecay()` |
| `e2e-validation` | Dynamically imports and runs `runLiveE2E()` |
| `health-snapshot` | Aggregates database counts and logs snapshot |
| `truth-consolidation-audit` | Runs consolidator health check in dry-run mode |
| (default) | Returns success with no operation |

---

## 3. Inputs

### Job Payload Schema

```typescript
interface ScheduledJobData {
  type:
    | "pipeline-run"
    | "audit"
    | "digest"
    | "auto-approve"
    | "arbiter-sweep"
    | "release-batch"
    | "confidence-decay"
    | "e2e-validation"
    | "health-snapshot"
    | "truth-consolidation-audit"
  runId: string
  triggeredBy?: string
}
```

**Note**: The `audit` and `digest` types are defined in the interface but have no dedicated handlers - they fall through to the default case.

### Job Sources

Jobs are added to the `scheduled` queue from:

| Source | Location | Job Types |
|--------|----------|-----------|
| **Scheduler Service** | `scheduler.service.ts` | `confidence-decay`, `truth-consolidation-audit`, `e2e-validation`, `health-snapshot` |
| **API Route** | `/api/regulatory/trigger/route.ts` | `pipeline-run` |
| **Manual Scripts** | Various scripts | Any type |

### Input Validation

- **Schema validation**: None at the worker level - relies on TypeScript interface
- **Type checking**: The switch statement provides implicit validation
- **Unknown types**: Fall through to default case returning success

### Example Job Payloads

**Pipeline Run (from API)**:
```json
{
  "type": "pipeline-run",
  "runId": "api-1705276800000",
  "triggeredBy": "api",
  "phases": ["sentinel", "extract", "compose", "review", "release"]
}
```

**Scheduled Confidence Decay**:
```json
{
  "type": "confidence-decay",
  "runId": "decay-1705276800000",
  "triggeredBy": "cron"
}
```

---

## 4. Outputs

### Job Result Structure

All jobs return a `JobResult` object:

```typescript
interface JobResult {
  success: boolean
  data?: unknown
  error?: string
  duration: number
}
```

### Output by Job Type

| Job Type | `data` Content | Side Effects |
|----------|----------------|--------------|
| `pipeline-run` | `{ sources: number }` | Adds jobs to `sentinelQueue` |
| `auto-approve` | `{ approved, skipped, errors }` | Updates `RegulatoryRule` status, creates audit logs |
| `arbiter-sweep` | `{ conflicts: number }` | Adds jobs to `arbiterQueue` |
| `release-batch` | `{ approved: number }` | Adds job to `releaseQueue` |
| `confidence-decay` | `{ checked, decayed }` | Updates `RegulatoryRule.confidence` and `reviewerNotes` |
| `e2e-validation` | `{ verdict, invariantsPass, invariantsFail, artifactsPath }` | Writes artifacts to filesystem, updates DB |
| `health-snapshot` | `{ timestamp, discoveredItems, rules, evidence, pointers }` | Logs to console |
| `truth-consolidation-audit` | `{ healthy, duplicateGroups, testDataLeakage, snapshotId, alerts }` | Creates `TruthHealthSnapshot` record |

### Database Records Created/Updated

| Job Type | Table | Operation |
|----------|-------|-----------|
| `auto-approve` | `RegulatoryRule` | UPDATE status to APPROVED |
| `auto-approve` | `RegulatoryAuditLog` | CREATE approval record |
| `confidence-decay` | `RegulatoryRule` | UPDATE confidence, reviewerNotes |
| `truth-consolidation-audit` | `TruthHealthSnapshot` | CREATE snapshot record |
| `e2e-validation` | Various | Depends on pipeline execution |

### Queue Jobs Produced

| Job Type | Target Queue | Job Data |
|----------|--------------|----------|
| `pipeline-run` | `sentinel` | `{ runId, priority: "CRITICAL" }`, `{ runId, priority: "HIGH" }` |
| `arbiter-sweep` | `arbiter` | `{ conflictId, runId }` for each OPEN conflict |
| `release-batch` | `release` | `{ ruleIds: string[], runId }` |

---

## 5. Dependencies

### Other Workers It Depends On

The orchestrator is a **dispatcher** - it creates work for other workers but does not depend on them for its own execution:

| Worker | Relationship | Notes |
|--------|--------------|-------|
| `sentinel` | Downstream | Receives `pipeline-run` jobs |
| `arbiter` | Downstream | Receives `arbiter-sweep` jobs |
| `releaser` | Downstream | Receives `release-batch` jobs |
| `scheduler` | Upstream | Scheduler creates jobs for orchestrator |

### External Services

| Service | Usage | Connection |
|---------|-------|------------|
| **Redis** | BullMQ queue backend | `REDIS_URL` env var |
| **PostgreSQL (Main)** | Rule queries, conflict queries | `DATABASE_URL` via Prisma `db` |
| **PostgreSQL (Regulatory)** | Source queries, evidence counts | `REGULATORY_DATABASE_URL` via Prisma `dbReg` |

### Agent Code Dependencies

The orchestrator imports one agent function directly:

```typescript
import { autoApproveEligibleRules } from "../agents/reviewer"
```

It dynamically imports others to reduce startup overhead:

```typescript
const { applyConfidenceDecay } = await import("../utils/confidence-decay")
const { runLiveE2E } = await import("../e2e/live-runner")
const { runConsolidatorHealthCheck, storeTruthHealthSnapshot } =
  await import("../utils/truth-health")
```

### Required Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | Yes | `redis://localhost:6379` | Redis connection string |
| `DATABASE_URL` | Yes | - | Main PostgreSQL connection |
| `REGULATORY_DATABASE_URL` | Yes | - | Regulatory PostgreSQL connection |
| `NODE_ENV` | No | `development` | Environment mode |
| `WORKER_TYPE` | No | - | Set by Docker for version tracking |
| `BULLMQ_PREFIX` | No | `fiskai` | BullMQ queue prefix |
| `WORKER_CONCURRENCY` | No | `2` | Ignored (hardcoded to 1) |
| `AUTO_APPROVE_GRACE_HOURS` | No | `24` | Grace period for auto-approve |
| `AUTO_APPROVE_MIN_CONFIDENCE` | No | `0.90` | Min confidence for auto-approve |

---

## 6. Prerequisites

### Database State Requirements

| Job Type | Required Database State |
|----------|-------------------------|
| `pipeline-run` | Active regulatory sources exist (`regulatorySource.isActive = true`) |
| `auto-approve` | Rules exist with `status = PENDING_REVIEW`, `riskTier in ['T2', 'T3']` |
| `arbiter-sweep` | Conflicts exist with `status = OPEN` |
| `release-batch` | Rules exist with `status = APPROVED` and no associated releases |
| `confidence-decay` | Rules exist with `status in ['PUBLISHED', 'APPROVED']` |
| `health-snapshot` | None (read-only aggregation) |
| `truth-consolidation-audit` | None (dry-run mode) |
| `e2e-validation` | Full RTL infrastructure functional |

### Workers That Must Run First

For the system to function correctly:

1. **scheduler** must be running to create cron-based jobs
2. **Redis** must be healthy for queue operations
3. **Database migrations** must be applied (both main and regulatory)

### Infrastructure Requirements

- Docker container must have network access to Redis and PostgreSQL
- For `e2e-validation`: Full LLM infrastructure must be available
- For `truth-consolidation-audit`: Database must be queryable

---

## 7. Triggers

### Cron Schedules (via Scheduler Service)

The scheduler service (`scheduler.service.ts`) creates orchestrator jobs on schedule:

| Schedule | Timezone | Job Type | Description |
|----------|----------|----------|-------------|
| `0 0 * * *` | Europe/Zagreb | `health-snapshot` | Daily midnight health check |
| `0 3 * * 0` | Europe/Zagreb | `confidence-decay` | Weekly Sunday 03:00 decay |
| `0 4 * * *` | Europe/Zagreb | `truth-consolidation-audit` | Daily 04:00 audit |
| `0 5 * * *` | Europe/Zagreb | `e2e-validation` | Daily 05:00 E2E run |

**Note**: The scheduler service removed several scheduled jobs that are now handled differently:
- `pipeline-run` - Now triggered via API or continuous drainer
- `auto-approve` - Now continuous via drainer
- `release-batch` - Now event-driven
- `arbiter-sweep` - Now continuous via drainer

### API Trigger

**Endpoint**: `POST /api/regulatory/trigger`

**Authorization**: Requires `systemRole = 'ADMIN'`

**Request Body**:
```json
{
  "phases": ["sentinel", "extract", "compose", "review", "release"]
}
```

**Response**:
```json
{
  "success": true,
  "jobId": "123",
  "status": "queued",
  "message": "Pipeline triggered for phases: sentinel, extract, compose, review, release"
}
```

### Manual Trigger Methods

**Via script** (`scripts/trigger-pipeline.ts`):
```bash
npx tsx scripts/trigger-pipeline.ts
```

**Via BullMQ directly**:
```typescript
import { scheduledQueue } from "./workers/queues"

await scheduledQueue.add("scheduled", {
  type: "pipeline-run",
  runId: `manual-${Date.now()}`,
  triggeredBy: "manual"
})
```

---

## 8. Error Handling

### Retry Logic

From `queues.ts` default job options:

| Property | Value | Effect |
|----------|-------|--------|
| `attempts` | 3 | Job retries up to 3 times |
| `backoff.type` | `exponential` | Delays increase exponentially |
| `backoff.delay` | 10000 | Base delay: 10s, 20s, 40s |

### Dead Letter Queue Behavior

From `base.ts`:

```typescript
worker.on("failed", (job, err) => {
  if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
    void moveToDeadLetterQueue(job, err, queueName, options.name)
  }
})
```

**DLQ Data Structure**:
```typescript
interface DeadLetterJobData {
  originalQueue: string
  originalJobId: string | undefined
  originalJobName: string
  originalJobData: unknown
  error: string
  stackTrace?: string
  attemptsMade: number
  failedAt: string
  firstFailedAt?: string
}
```

**DLQ Threshold Alert**: When DLQ depth exceeds `DLQ_THRESHOLD` (default: 10), an error is logged:
```
[orchestrator] DLQ ALERT: Dead letter queue depth (12) exceeds threshold (10). Investigation required!
```

### Per-Job-Type Error Handling

The orchestrator wraps each job type in a try-catch:

```typescript
try {
  switch (type) {
    // ... handlers
  }
} catch (error) {
  jobsProcessed.inc({ worker: "orchestrator", status: "failed", queue: "scheduled" })
  return {
    success: false,
    duration: Date.now() - start,
    error: error instanceof Error ? error.message : String(error),
  }
}
```

**Key Behavior**: A failure in one job type does NOT crash the worker. The error is captured and returned.

### Graceful Shutdown

```typescript
setupGracefulShutdown([worker])
```

On SIGTERM/SIGINT:
1. Logs shutdown message
2. Closes worker connections
3. Closes Redis connections
4. Exits with code 0

---

## 9. Guardrails & Safety

### Rate Limiting

**Queue-Level Rate Limits** (from `queues.ts`):

| Queue | Max Jobs | Duration |
|-------|----------|----------|
| `sentinel` | 5 | 60 seconds |
| `arbiter` | 3 | 60 seconds |
| `release` | 2 | 60 seconds |
| `scheduled` | None | No rate limit |

**Job-Level Rate Limits**:
- `arbiter-sweep`: Takes only first 10 open conflicts
- `release-batch`: Takes only first 20 approved rules

### Validation Checks

**Auto-Approve Guardrails** (from `reviewer.ts`):

1. **T0/T1 Absolute Gate**: Never auto-approved, regardless of confidence
2. **Confidence Threshold**: Must meet `AUTO_APPROVE_MIN_CONFIDENCE` (0.90)
3. **Grace Period**: Must be pending > `AUTO_APPROVE_GRACE_HOURS` (24h)
4. **Conflict Check**: No open conflicts involving the rule
5. **Source Pointer Invariant**: Rule must have at least 1 source pointer

```typescript
// ABSOLUTE GATE: T0/T1 NEVER auto-approve
if (rule.riskTier === "T0" || rule.riskTier === "T1") {
  return false // No further checks needed
}
```

### Invariants Enforced

| Invariant | Enforcement Location | Description |
|-----------|---------------------|-------------|
| Single-threaded execution | `concurrency: 1` | Prevents race conditions |
| T0/T1 human review | `canAutoApprove()` | Critical rules require human |
| Evidence-backed rules | Source pointer count check | Cannot approve without evidence |
| Stable job IDs | Sorted rule IDs in `release-batch` | Prevents duplicate jobs |

### Fail-Safe Mechanisms

1. **Default case handler**: Unknown job types return success (don't crash)
2. **Try-catch wrapper**: All job processing is error-protected
3. **Metrics recording**: Always happens in `finally` block
4. **Version guard**: Production workers verify GIT_SHA before starting

---

## 10. Monitoring & Observability

### Logging Patterns

**Startup Logging** (from `startup-log.ts`):
```
+------------------------------------------------------------------+
| WORKER STARTUP: orchestrator                                      |
+------------------------------------------------------------------+
| Commit SHA:      dae7aa4892b3951bee43544374982d60338805b3         |
| Container:       fiskai-worker-orchestrator                       |
| Agent Code:      EXISTS                                           |
| Node Env:        production                                       |
| Started At:      2026-01-14T10:00:00.000Z                        |
+------------------------------------------------------------------+
```

**Job Processing Logs**:
```
[orchestrator] Processing job 123: scheduled
[orchestrator] Health snapshot: {"timestamp":"...", ...}
[orchestrator] Job 123 completed in 150ms
```

**Error Logs**:
```
[orchestrator] Job 456 failed: Database connection error
[orchestrator] DLQ ALERT: Dead letter queue depth (12) exceeds threshold (10)
```

### Metrics Emitted

From `metrics.ts`:

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `worker_jobs_processed_total` | Counter | `worker`, `status`, `queue` | Total jobs processed |
| `worker_job_duration_seconds` | Histogram | `worker`, `queue` | Job processing duration |
| `worker_queue_depth` | Gauge | `queue` | Jobs waiting in queue |
| `worker_active_jobs` | Gauge | `worker` | Jobs currently processing |

**Metric Recording** (always in `finally`):
```typescript
finally {
  const duration = Date.now() - start
  if (duration > 0) {
    jobsProcessed.inc({ worker: "orchestrator", status: "success", queue: "scheduled" })
    jobDuration.observe({ worker: "orchestrator", queue: "scheduled" }, duration / 1000)
  }
}
```

### Health Check Integration

**Queue Health** (via `allQueues` export):
```typescript
export const allQueues = {
  // ... includes 'scheduled' queue
}
```

**Redis Health** (from `redis.ts`):
```typescript
export async function checkRedisHealth(timeoutMs: number = 2000): Promise<boolean>
```

### Alerting Triggers

| Condition | Alert Location | Severity |
|-----------|----------------|----------|
| DLQ depth > 10 | `base.ts` | ERROR |
| Agent code missing | `startup-log.ts` | CRITICAL |
| Version mismatch | `version-guard.ts` | FATAL (exits) |
| TSX in production | `version-guard.ts` | FATAL (exits) |

---

## 11. Configuration

### All Environment Variables

| Variable | Default | Type | Description |
|----------|---------|------|-------------|
| `REDIS_URL` | `redis://localhost:6379` | String | Redis connection URL |
| `DATABASE_URL` | - | String | Main PostgreSQL connection |
| `REGULATORY_DATABASE_URL` | - | String | Regulatory PostgreSQL connection |
| `NODE_ENV` | `development` | String | Environment mode |
| `WORKER_TYPE` | - | String | Set to `orchestrator` in Docker |
| `WORKER_CONCURRENCY` | `2` | Number | **Ignored** - hardcoded to 1 |
| `BULLMQ_PREFIX` | `fiskai` | String | Queue key prefix |
| `DLQ_ALERT_THRESHOLD` | `10` | Number | DLQ depth alert threshold |
| `DLQ_RETENTION_DAYS` | `30` | Number | DLQ job retention |
| `AUTO_APPROVE_GRACE_HOURS` | `24` | Number | Hours before auto-approve eligible |
| `AUTO_APPROVE_MIN_CONFIDENCE` | `0.90` | Number | Min confidence for auto-approve |
| `GIT_SHA` | - | String | Build-time git commit |
| `BUILD_DATE` | - | String | Build timestamp |
| `EXPECTED_GIT_SHA` | - | String | Expected SHA for version guard |
| `COMMIT_SHA` | - | String | Alternative SHA variable |
| `CONTAINER_IMAGE` | - | String | Docker image name |
| `COOLIFY_CONTAINER_NAME` | - | String | Coolify container name |

### Docker Compose Configuration

From `docker-compose.workers.yml`:

```yaml
worker-orchestrator:
  <<: *worker-common
  container_name: fiskai-worker-orchestrator
  command: ["node", "dist/workers/lib/regulatory-truth/workers/orchestrator.worker.js"]
  environment:
    <<: *worker-env
    WORKER_TYPE: orchestrator
    WORKER_CONCURRENCY: 1
  deploy:
    resources:
      limits:
        memory: 512M
```

### Tunables

| Tunable | Location | Default | Effect |
|---------|----------|---------|--------|
| Grace period | `AUTO_APPROVE_GRACE_HOURS` | 24 | Hours before T2/T3 auto-approval |
| Confidence threshold | `AUTO_APPROVE_MIN_CONFIDENCE` | 0.90 | Min confidence for auto-approval |
| DLQ threshold | `DLQ_ALERT_THRESHOLD` | 10 | When to alert on DLQ depth |
| Memory limit | Docker config | 512M | Container memory ceiling |
| Job retention | `removeOnComplete.count` | 1000 | Completed jobs to keep |

---

## 12. Known Issues & Limitations

### TODOs in Code

**No explicit TODOs found in orchestrator.worker.ts**

**Related TODOs in dependencies**:
- `base.ts` line 96: "Future: Integrate with alerting system (Slack, PagerDuty, etc.)"

### Edge Cases

| Edge Case | Current Behavior | Risk |
|-----------|------------------|------|
| Unknown job type | Returns success silently | Low - no data corruption |
| Empty source list | Queues sentinel jobs anyway | Low - sentinels handle gracefully |
| No open conflicts | `arbiter-sweep` returns `{ conflicts: 0 }` | None |
| No approved rules | `release-batch` skips queue | None |
| Database unavailable | Job fails, retries 3x, goes to DLQ | Medium - pipeline stalls |

### Performance Considerations

| Concern | Mitigation |
|---------|------------|
| Single-threaded | By design - prevents race conditions |
| Memory pressure | 512M limit, bounded job retention |
| Long-running jobs | `e2e-validation` can take minutes | Lock duration 60s may be insufficient |
| Database queries | Uses indexed columns (`status`, `riskTier`) |

### Architectural Limitations

1. **No job deduplication**: Same job can be queued multiple times
2. **No job prioritization**: All scheduled jobs have equal priority
3. **No circuit breaker**: Failed jobs retry blindly without backpressure
4. **No distributed locking**: Relies on BullMQ's single-consumer model

### Deprecated Job Types

These job types are defined but have minimal/no handlers:

| Type | Status | Notes |
|------|--------|-------|
| `audit` | Unused | Falls through to default case |
| `digest` | Unused | Falls through to default case |

### Recommended Improvements

1. **Add job deduplication**: Use consistent job IDs to prevent duplicates
2. **Extend lock duration**: For `e2e-validation`, consider 300s+ lock
3. **Add circuit breaker**: Pause processing when downstream queues are full
4. **Remove unused types**: Clean up `audit` and `digest` from interface

---

## Appendix A: Job Type Reference

### pipeline-run

**Purpose**: Kick off discovery phase by queuing sentinel jobs

**Flow**:
```
orchestrator (pipeline-run)
    |
    +-> sentinelQueue.add("sentinel-critical", {runId, priority: "CRITICAL"})
    +-> sentinelQueue.add("sentinel-high", {runId, priority: "HIGH"}, {delay: 60000})
```

**Output**: `{ sources: <number of active sources> }`

---

### auto-approve

**Purpose**: Approve eligible T2/T3 rules after grace period

**Flow**:
```
orchestrator (auto-approve)
    |
    +-> Find PENDING_REVIEW rules (T2/T3, age > 24h, conf >= 0.90)
    +-> For each: canAutoApprove() -> approveRule() -> Update reviewerNotes
```

**Output**: `{ approved: N, skipped: N, errors: [...] }`

---

### arbiter-sweep

**Purpose**: Process open conflicts through arbiter

**Flow**:
```
orchestrator (arbiter-sweep)
    |
    +-> Find up to 10 OPEN conflicts
    +-> For each: arbiterQueue.add("arbiter", {conflictId, runId})
```

**Output**: `{ conflicts: <number queued> }`

---

### release-batch

**Purpose**: Publish approved rules that haven't been released

**Flow**:
```
orchestrator (release-batch)
    |
    +-> Find up to 20 APPROVED rules without releases
    +-> releaseQueue.add("release", {ruleIds, runId})
```

**Output**: `{ approved: <number of rules> }`

---

### confidence-decay

**Purpose**: Apply temporal decay to stale rules

**Flow**:
```
orchestrator (confidence-decay)
    |
    +-> Dynamic import confidence-decay.ts
    +-> applyConfidenceDecay()
        +-> For each PUBLISHED/APPROVED rule:
            +-> Calculate age-based decay (0-30%)
            +-> Update confidence (floor 0.5)
```

**Decay Schedule**:
- 0-3 months: 0%
- 3-6 months: 5%
- 6-12 months: 10%
- 12-24 months: 20%
- 24+ months: 30% (cap)

**Output**: `{ checked: N, decayed: N }`

---

### e2e-validation

**Purpose**: Run full pipeline validation with invariant checks

**Flow**:
```
orchestrator (e2e-validation)
    |
    +-> Dynamic import live-runner.ts
    +-> runLiveE2E({lightRun: false, skipAssistant: false})
        +-> Environment fingerprint
        +-> Synthetic conflict heartbeat
        +-> Run pipeline phases (sentinel, extractor, composer, etc.)
        +-> Validate invariants
        +-> Run assistant test suite
        +-> Generate report
```

**Output**: `{ verdict: "GO"|"NO-GO"|..., invariantsPass, invariantsFail, artifactsPath }`

---

### health-snapshot

**Purpose**: Collect and log system health metrics

**Flow**:
```
orchestrator (health-snapshot)
    |
    +-> Promise.all([
        db.discoveredItem.groupBy(),
        db.regulatoryRule.groupBy(),
        dbReg.evidence.count(),
        db.sourcePointer.count()
    ])
    +-> console.log(snapshot)
```

**Output**: `{ timestamp, discoveredItems, rules, evidence, pointers }`

---

### truth-consolidation-audit

**Purpose**: Daily smoke detector for truth layer integrity

**Flow**:
```
orchestrator (truth-consolidation-audit)
    |
    +-> Dynamic import truth-health.ts
    +-> runConsolidatorHealthCheck() (dry-run)
        +-> Find duplicate rule groups
        +-> Detect test data leakage
    +-> storeTruthHealthSnapshot()
        +-> Create TruthHealthSnapshot record
```

**Alerts Raised**:
- `DUPLICATES_DETECTED`: Duplicate rules with same value
- `TEST_DATA_LEAKAGE`: Test domain pointers in production rules

**Output**: `{ healthy: boolean, duplicateGroups, testDataLeakage, snapshotId, alerts }`

---

## Appendix B: File References

| File | Purpose |
|------|---------|
| `/home/admin/FiskAI/src/lib/regulatory-truth/workers/orchestrator.worker.ts` | Main worker implementation |
| `/home/admin/FiskAI/src/lib/regulatory-truth/workers/base.ts` | Worker creation utilities |
| `/home/admin/FiskAI/src/lib/regulatory-truth/workers/queues.ts` | Queue definitions |
| `/home/admin/FiskAI/src/lib/regulatory-truth/workers/redis.ts` | Redis connection handling |
| `/home/admin/FiskAI/src/lib/regulatory-truth/workers/metrics.ts` | Prometheus metrics |
| `/home/admin/FiskAI/src/lib/regulatory-truth/workers/startup-log.ts` | Startup logging |
| `/home/admin/FiskAI/src/lib/regulatory-truth/workers/scheduler.service.ts` | Cron scheduler |
| `/home/admin/FiskAI/src/lib/regulatory-truth/workers/utils/version-guard.ts` | Version verification |
| `/home/admin/FiskAI/src/lib/regulatory-truth/agents/reviewer.ts` | Auto-approve logic |
| `/home/admin/FiskAI/src/lib/regulatory-truth/utils/confidence-decay.ts` | Decay calculation |
| `/home/admin/FiskAI/src/lib/regulatory-truth/utils/truth-health.ts` | Health check utilities |
| `/home/admin/FiskAI/src/lib/regulatory-truth/e2e/live-runner.ts` | E2E validation runner |
| `/home/admin/FiskAI/src/app/api/regulatory/trigger/route.ts` | API trigger endpoint |
| `/home/admin/FiskAI/docker-compose.workers.yml` | Docker deployment config |

---

*End of Audit Document*
