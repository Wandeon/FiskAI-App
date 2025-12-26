# Ops Autonomy Audit: Two-Layer Scheduling + 24/7 Draining + Alerting

**Date:** 2025-12-26
**Scope:** Scheduler service, queue configs, worker startup, retry/backoff, dead-letter handling, health gates, alerting coverage

---

## Executive Summary

The FiskAI Regulatory Truth Layer uses a **two-layer execution model**:
- **Layer A (Scheduler):** Morning discovery at 06:00 + maintenance jobs
- **Layer B (Continuous Drainer):** 24/7 queue draining until backlog saturation

**Key Findings:**
- Architecture is sound with proper separation of discovery vs processing
- Dead-letter queue handles failed jobs after 3 retries with exponential backoff
- 60-minute dedup window prevents alert storms
- **Gap:** Queue health in digest uses placeholder values (not real Redis data)
- **Gap:** No alerting for continuous-drainer stalls or worker crashes
- **Gap:** consolidator queue missing from some monitoring

---

## A. Ops Truth Table

### Layer A: Scheduled Jobs (scheduler.service.ts)

| Job | Cron | Timezone | Dependencies | Purpose |
|-----|------|----------|--------------|---------|
| Health Snapshot | `0 0 * * *` | Europe/Zagreb | DB | Collect TruthHealthSnapshot metrics |
| Confidence Decay | `0 3 * * 0` | Europe/Zagreb | DB | Weekly decay of rule confidence |
| Truth Consolidation Audit | `0 4 * * *` | Europe/Zagreb | DB, Consolidator | Smoke detector for duplicates/leakage |
| E2E Validation | `0 5 * * *` | Europe/Zagreb | Full pipeline | Pre-discovery validation |
| Morning Discovery | `0 6 * * *` | Europe/Zagreb | Sentinel, Redis | Discover new regulatory content |
| Daily Digest (Resend) | `0 7 * * *` | Europe/Zagreb | DB, WatchdogAlert | Comprehensive health digest |
| Legacy Digest (SMTP) | `0 8 * * *` | Europe/Zagreb | DB | Backwards-compatible digest |
| Random Audit 1 | `10:00-14:00` | Europe/Zagreb | DB, Rules | Quality audit |
| Random Audit 2 (50%) | `16:00-20:00` | Europe/Zagreb | DB, Rules | Secondary audit |

### Layer B: Continuous Processing (continuous-drainer.worker.ts)

| Stage | Queue | What it Drains | Rate Limit | Max Batch |
|-------|-------|----------------|------------|-----------|
| 1 | - | PENDING DiscoveredItems | - | 50 |
| 1.5 | `ocr` | PDF_SCANNED Evidence | 2/min | 10 |
| 2 | `extract` | FETCHED Evidence → Pointers | 10/min | 50 |
| 3 | `compose` | Unlinked Pointers → Rules | 5/min | 50 |
| 4 | `review` | DRAFT Rules | 5/min | 20 |
| 5 | `arbiter` | OPEN Conflicts | 3/min | 10 |
| 6 | `release` | APPROVED Rules | 2/min | 20 |

**Backoff:** 1s (work) → 60s max (idle), 2x multiplier

### Worker Services (docker-compose.workers.yml)

| Worker | Container | Concurrency | Lock Duration | Stalled Interval |
|--------|-----------|-------------|---------------|------------------|
| orchestrator | fiskai-worker-orchestrator | 1 | 60s | 30s |
| sentinel | fiskai-worker-sentinel | 1 | 60s | 30s |
| extractor | (2 replicas) | 2 | 6min | 60s |
| ocr | fiskai-worker-ocr | 1 | 60s | 30s |
| composer | fiskai-worker-composer | 1 | 60s | 30s |
| reviewer | fiskai-worker-reviewer | 1 | 60s | 30s |
| arbiter | fiskai-worker-arbiter | 1 | 6min | 60s |
| releaser | fiskai-worker-releaser | 1 | 60s | 30s |
| scheduler | fiskai-worker-scheduler | - | - | - |
| continuous-drainer | fiskai-worker-continuous-drainer | - | - | - |

### Queue Configuration (queues.ts)

| Queue | Rate Limit | Retry Attempts | Backoff |
|-------|------------|----------------|---------|
| sentinel | 5/min | 3 | Exponential 10s |
| extract | 10/min | 3 | Exponential 10s |
| ocr | 2/min | 3 | Exponential 10s |
| compose | 5/min | 3 | Exponential 10s |
| review | 5/min | 3 | Exponential 10s |
| arbiter | 3/min | 3 | Exponential 10s |
| release | 2/min | 3 | Exponential 10s |
| consolidator | 1/5min | 3 | Exponential 10s |
| scheduled | (none) | 3 | Exponential 10s |
| deadletter | (none) | - | - |

---

## B. Top Stall Points & Self-Healing

### 1. Redis Connection Failure
**Symptom:** All workers stop processing, queues inaccessible
**Detection:** `checkRedisHealth()` with 2s timeout
**Self-Heal:** Docker `restart: unless-stopped` + Redis healthcheck
**Gap:** No immediate alert on Redis failure - only appears in daily digest

### 2. Continuous Drainer Crash
**Symptom:** Items pile up in PENDING/FETCHED/DRAFT states indefinitely
**Detection:** None - drainer logs only to stdout
**Self-Heal:** Docker restart policy
**Gap:** **CRITICAL** - No alerting if drainer is stalled. Backlog grows silently.

### 3. LLM Rate Limit / Ollama Timeout
**Symptom:** Extractor/Composer/Arbiter jobs timeout
**Detection:** Job fails after 5min lock duration
**Self-Heal:** Job retries 3x with exponential backoff → dead-letter
**Gap:** No alert threshold for dead-letter accumulation rate

### 4. OCR Worker Overload
**Symptom:** PDF_SCANNED evidence stuck, extractors requeue indefinitely
**Detection:** Jobs requeue with 30s delay (visible in logs)
**Self-Heal:** Requeue with delay until OCR catches up
**Risk:** Silent backlog if OCR is permanently broken

### 5. Extractor "Not Ready" Loop
**Symptom:** Evidence awaiting artifacts requeues forever
**Detection:** Logged as "Evidence not ready, requeueing"
**Self-Heal:** Delays 30s between retries
**Gap:** No counter/limit on requeue attempts - can loop infinitely

### 6. Discovery Failure (Sentinel)
**Symptom:** No new items discovered, pipeline starves
**Detection:** Stale source check (7/14 day thresholds)
**Self-Heal:** Alert raised at WARNING/CRITICAL levels
**Status:** ✓ Working as designed

### 7. Conflicts Accumulating
**Symptom:** Arbiter not resolving conflicts
**Detection:** `checkConflictResolutionRate()` - 50% threshold at 7 days
**Self-Heal:** Alert raised, arbiter sweep via scheduler
**Status:** ✓ Working, but relies on scheduler being healthy

---

## C. Alerting Coverage Analysis

### Immediate Alerts (CRITICAL → Slack + Email + Resend)

| Alert Type | Trigger | Dedup Window | Status |
|------------|---------|--------------|--------|
| PIPELINE_FAILURE | Any phase fails | 60min | ✓ |
| TEST_DATA_LEAKAGE | Test pointers in production | 60min | ✓ |
| AUDIT_FAIL | Score below threshold | 60min | ✓ |
| STALE_SOURCE | No items for 14+ days | 60min | ✓ |
| SCRAPER_FAILURE | >50% failure rate | 60min | ✓ |
| QUALITY_DEGRADATION | Confidence <75% | 60min | ✓ |
| HIGH_REJECTION_RATE | >60% rejection | 60min | ✓ |

### Digest-Only Alerts (WARNING → Email digest)

| Alert Type | Trigger | Dedup Window |
|------------|---------|--------------|
| DUPLICATES_DETECTED | Duplicate rule groups | 60min |
| HIGH_UNLINKED_POINTERS | >10% unlinked | 60min |
| LOW_PUBLISHED_COVERAGE | <50% have 2+ pointers | 60min |
| SINGLE_SOURCE_BLOCKED | Rules need corroboration | 60min |
| HIGH_ORPHANED_CONCEPTS | >30% concepts no rules | 60min |
| AUDIT_PARTIAL | Score between thresholds | 60min |
| STALE_SOURCE (7 days) | Warning level | 60min |

### Missing Alerts (GAPS)

| Missing Alert | Impact | Recommendation |
|---------------|--------|----------------|
| DRAINER_STALLED | Backlog grows silently | Add heartbeat check every 5min |
| WORKER_CRASHED | Processing stops | Alert if no job processed in 15min |
| DEAD_LETTER_SPIKE | Failed jobs accumulating | Alert if >10 DLQ jobs in 1hr |
| QUEUE_BACKLOG_HIGH | Latency increases | Alert if any queue >100 waiting |
| REDIS_UNHEALTHY | All processing stops | Immediate alert on ping failure |
| REQUEUE_LOOP | Job stuck forever | Alert if same job requeued >10x |
| SCHEDULER_MISSED | Scheduled jobs don't run | Alert if cron job >2hr late |
| OLLAMA_UNREACHABLE | LLM extraction fails | Alert on 5+ consecutive timeouts |

### Health Gate Coverage

| Gate | Threshold | Alert on Breach? |
|------|-----------|------------------|
| extractor_parse_failure_rate | >10% CRIT, >5% DEGRADED | ✗ No (logged only) |
| validator_rejection_rate | >35% CRIT, >20% DEGRADED | ✗ No (logged only) |
| quote_validation_rate | >5% CRIT, >2% DEGRADED | ✗ No (logged only) |
| t0_t1_approval_compliance | Any unapproved | ✗ No (logged only) |
| source_pointer_coverage_published | Any without pointers | ✗ No (logged only) |
| source_pointer_coverage_draft | >5% missing | ✗ No (logged only) |
| conflict_resolution_rate | >50% unresolved 7d | ✗ No (logged only) |
| release_blocked_attempts | >50% blocked | ✗ No (logged only) |

**Gap:** Health gates check metrics but don't raise WatchdogAlerts!

---

## D. Runbook-Lite: 5 Commands to Diagnose & Recover

### 1. Check Queue & Pipeline Status
```bash
# View all queue stats and pipeline health
npx tsx scripts/queue-status.ts
```
**Shows:** Queue waiting/active/failed counts, DB status, saturation state
**Use when:** Suspecting backlog or stalled processing

### 2. Check Worker Health
```bash
# View all worker container status
docker ps --filter "name=fiskai-worker" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Check specific worker logs (last 50 lines)
docker logs fiskai-worker-continuous-drainer --tail 50
docker logs fiskai-worker-extractor --tail 50
```
**Shows:** Container uptime, restart counts, recent processing
**Use when:** Workers seem unresponsive

### 3. Inspect Dead-Letter Queue
```bash
# Count and inspect failed jobs
docker exec fiskai-redis redis-cli ZCARD fiskai:deadletter:failed
docker exec fiskai-redis redis-cli ZRANGE fiskai:deadletter:failed 0 5

# Clear dead-letter queue (use with caution)
# docker exec fiskai-redis redis-cli DEL fiskai:deadletter:failed
```
**Shows:** Failed job count and recent failures
**Use when:** Jobs failing repeatedly

### 4. Force Health Snapshot + Digest
```bash
# Trigger manual health snapshot
npx tsx -e "
import { storeTruthHealthSnapshot } from './src/lib/regulatory-truth/utils/truth-health'
storeTruthHealthSnapshot().then(r => console.log('Snapshot:', r.id))
"

# Trigger manual digest email
npx tsx -e "
import { sendRegulatoryTruthDigest } from './src/lib/regulatory-truth/watchdog/resend-email'
sendRegulatoryTruthDigest().then(console.log)
"
```
**Shows:** Current health metrics, sends digest to configured email
**Use when:** Need immediate visibility or testing alerting

### 5. Restart Pipeline Processing
```bash
# Restart continuous drainer (will resume from current state)
docker restart fiskai-worker-continuous-drainer

# Restart all workers (nuclear option)
docker-compose -f docker-compose.workers.yml restart

# Force rebuild and restart specific worker
docker-compose -f docker-compose.workers.yml build worker-extractor
docker-compose -f docker-compose.workers.yml up -d worker-extractor
```
**Use when:** Workers stuck or need code update deployed

---

## E. Recommendations

### High Priority

1. **Add drainer heartbeat alerting**
   - Drainer should write timestamp to Redis every cycle
   - Alert if timestamp > 5 minutes old
   - Location: `continuous-drainer.worker.ts`

2. **Connect health gates to alerting**
   - `checkHealthGates()` should call `raiseAlert()` on breach
   - Currently only logs - no notification
   - Location: `utils/health-gates.ts`

3. **Fix queue health in digest**
   - `getQueueHealth()` returns placeholder zeros
   - Should query Redis for actual queue stats
   - Location: `watchdog/resend-email.tsx:83-116`

### Medium Priority

4. **Add dead-letter queue threshold alert**
   - `checkDeadLetterQueueHealth()` exists but isn't in scheduled runs
   - Add to daily health snapshot

5. **Add requeue loop breaker**
   - Track requeue count per job in Redis
   - Move to dead-letter after 10 requeues
   - Location: `extractor.worker.ts:26-30`

6. **Add worker crash detection**
   - Track last job processed timestamp per worker
   - Alert if no activity in 15 minutes during business hours

### Low Priority

7. **Add consolidator queue to monitoring**
   - Missing from `QUEUES` array in queue-status.ts
   - Add "consolidator" to monitored queues

8. **Parameterize critical thresholds**
   - Move hardcoded values to env vars
   - Dead-letter threshold, backlog limits, etc.

---

## F. Verification Matrix

| Component | Discovery Tested | Processing Tested | Alert Tested |
|-----------|------------------|-------------------|--------------|
| Scheduler | ✓ 06:00 cron | - | - |
| Sentinel | ✓ Queue jobs | ✓ Extract chain | ✓ Stale source |
| Drainer | - | ✓ Stages 1-6 | ✗ No alert |
| Extractor | - | ✓ Via queue | ✓ Parse failure |
| OCR | - | ✓ Via queue | ✗ No alert |
| Composer | - | ✓ Via queue | ✗ No alert |
| Reviewer | - | ✓ Via queue | ✗ No alert |
| Arbiter | - | ✓ Via queue | ✓ Conflict rate |
| Releaser | - | ✓ Via queue | ✓ Blocked count |
| Dead-letter | - | ✓ On failure | ✗ No threshold |
| Redis | ✓ Healthcheck | ✓ All queues | ✗ No immediate |
| Digest | - | - | ✓ 07:00 email |

---

## Appendix: Key File Locations

| Purpose | File |
|---------|------|
| Scheduler (Layer A) | `src/lib/regulatory-truth/workers/scheduler.service.ts` |
| Drainer (Layer B) | `src/lib/regulatory-truth/workers/continuous-drainer.worker.ts` |
| Queue config | `src/lib/regulatory-truth/workers/queues.ts` |
| Worker base | `src/lib/regulatory-truth/workers/base.ts` |
| Alerting | `src/lib/regulatory-truth/watchdog/alerting.ts` |
| Health gates | `src/lib/regulatory-truth/utils/health-gates.ts` |
| Health monitors | `src/lib/regulatory-truth/watchdog/health-monitors.ts` |
| Digest email | `src/lib/regulatory-truth/watchdog/resend-email.tsx` |
| Queue status CLI | `scripts/queue-status.ts` |
| Docker workers | `docker-compose.workers.yml` |
