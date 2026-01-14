# APPENDIX: Reviewer Worker Audit

> Stakeholder-Grade Documentation for the Reviewer Worker in the FiskAI Regulatory Truth Layer
>
> Version: 1.0.0 | Date: 2026-01-14 | Classification: Internal Technical

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
9. [Guardrails and Safety](#9-guardrails-and-safety)
10. [Monitoring and Observability](#10-monitoring-and-observability)
11. [Configuration](#11-configuration)
12. [Known Issues and Limitations](#12-known-issues-and-limitations)
13. [Appendix A: Complete File Listing](#appendix-a-complete-file-listing)
14. [Appendix B: Glossary](#appendix-b-glossary)

---

## 1. Overview

### 1.1 Purpose

The **Reviewer Worker** is the quality assurance checkpoint in the Regulatory Truth Layer (RTL). Its primary responsibility is to validate Draft Rules composed from source evidence, ensuring accuracy and regulatory compliance before rules can be approved for production use.

### 1.2 Role in Layer B (Processing)

The Reviewer operates in **Layer B**, the 24/7 continuous processing layer of the RTL architecture:

```
Layer A (Discovery)     Layer B (Processing)

 Sentinel ─────────────► OCR ────► Extractor ────► Composer ────► REVIEWER ────► Releaser
     │                                                                │
     └── Daily Scan                                          Auto-approve (T2/T3)
                                                              or
                                                         Escalate (T0/T1)
```

**Position in Pipeline:**
- **Upstream**: Composer (creates Draft Rules from SourcePointers)
- **Downstream**: Releaser (publishes approved rules) or Human Review Queue (T0/T1 rules)

### 1.3 Automated vs Manual Review

The Reviewer implements a **tiered approval system** based on risk classification:

| Risk Tier | Auto-Approval | Human Review Required | SLA |
|-----------|--------------|----------------------|-----|
| **T0** (Critical) | NEVER | ALWAYS | 4 hours |
| **T1** (High) | NEVER | ALWAYS | 24 hours |
| **T2** (Medium) | Yes, if confidence >= 0.95 | Only if low confidence | 48 hours |
| **T3** (Low) | Yes, if confidence >= 0.95 | Only if low confidence | 72 hours |

**Key Safety Invariant**: T0/T1 rules are NEVER auto-approved, regardless of confidence scores.

---

## 2. Technical Implementation

### 2.1 Entry Point

**File**: `/src/lib/regulatory-truth/workers/reviewer.worker.ts`

```typescript
const worker = createWorker<ReviewJobData>("review", processReviewJob, {
  name: "reviewer",
  concurrency: 5,
  lockDuration: 360000, // 6 minutes
  stalledInterval: 60000, // Check for stalled jobs every 60s
})
```

**Key Configuration:**
- **Queue Name**: `review`
- **Concurrency**: 5 parallel reviews (increased from 1 to drain backlog, Issue #176)
- **Lock Duration**: 6 minutes (exceeds 5-minute agent timeout)
- **Stalled Interval**: 60 seconds

### 2.2 Job Processing Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     processReviewJob()                          │
├─────────────────────────────────────────────────────────────────┤
│ 1. Rate limit LLM call via llmLimiter.schedule()                │
│ 2. Call runReviewer(ruleId, correlationOpts)                    │
│ 3. If APPROVED → Queue for release                              │
│ 4. Record metrics (success/failure, duration)                   │
│ 5. Return JobResult                                             │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 LLM-Based Quality Assessment

**File**: `/src/lib/regulatory-truth/agents/reviewer.ts`

The `runReviewer()` function orchestrates the LLM-based review:

```typescript
export async function runReviewer(
  ruleId: string,
  correlationOpts?: CorrelationOptions
): Promise<ReviewerResult>
```

**Assessment Process:**

1. **Load Rule and Evidence**: Fetches the Draft Rule and its linked SourcePointers from the database
2. **Build Input**: Constructs `ReviewerInput` with rule details and source citations
3. **LLM Validation**: Calls the REVIEWER agent via `runAgent()` with the REVIEWER_PROMPT
4. **Decision Processing**: Interprets the LLM's decision and applies tier-based policies
5. **Status Update**: Updates rule status based on decision and tier constraints
6. **Audit Logging**: Records the review decision for compliance

### 2.4 Review Criteria (REVIEWER_PROMPT)

The LLM performs validation against this checklist:

```
VALIDATION CHECKLIST:
1. Value matches source exactly (character-for-character for numbers)
2. AppliesWhen predicate correctly captures conditions from source
3. Risk tier is appropriately assigned
4. Effective dates are correct
5. All relevant sources are linked
6. No conflicts with existing active rules
7. Translation accuracy (HR ↔ EN)
```

### 2.5 Scoring Mechanism

The LLM returns a `computed_confidence` score (0.0 - 1.0):

| Confidence | Interpretation |
|------------|---------------|
| >= 0.95 | High confidence - T2/T3 can auto-approve |
| 0.90 - 0.95 | Medium confidence - flag for expedited review |
| < 0.90 | Low confidence - escalate with concerns |

**Validation Checks** (boolean flags):
- `value_matches_source`: Value in rule matches source exactly
- `applies_when_correct`: AppliesWhen predicate is accurate
- `risk_tier_appropriate`: Risk tier assignment is correct
- `dates_correct`: Effective dates are accurate
- `sources_complete`: All relevant sources are linked
- `no_conflicts`: No conflicts with existing rules
- `translation_accurate`: HR/EN translations are correct

---

## 3. Inputs

### 3.1 Job Payload Schema

**File**: `/src/lib/regulatory-truth/workers/reviewer.worker.ts`

```typescript
interface ReviewJobData {
  ruleId: string       // UUID of the Draft Rule to review
  runId: string        // Correlation ID for the pipeline run
  parentJobId?: string // Optional parent job for tracing
}
```

### 3.2 ReviewerInput Schema

**File**: `/src/lib/regulatory-truth/schemas/reviewer.ts`

```typescript
export const ReviewerInputSchema = z.object({
  draftRuleId: z.string(),
  draftRule: z.object({
    conceptSlug: z.string(),       // e.g., "pausalni-obrt-prag"
    titleHr: z.string(),            // Croatian title
    riskTier: z.enum(["T0", "T1", "T2", "T3"]),
    appliesWhen: z.string(),        // DSL predicate
    value: z.union([z.string(), z.number()]),
    confidence: z.number(),         // Composer's confidence
  }),
  sourcePointers: z.array(
    z.object({
      id: z.string(),
      exactQuote: z.string(),       // Verbatim quote from source
      extractedValue: z.string(),   // The extracted value
      confidence: z.number(),       // Extractor's confidence
    })
  ),
})
```

### 3.3 Data Sources

| Source | Table | Fields Used |
|--------|-------|-------------|
| Draft Rule | `regulatoryRule` | id, conceptSlug, titleHr, riskTier, appliesWhen, value, confidence, status |
| Source Pointers | `sourcePointer` | id, exactQuote, extractedValue, confidence, evidenceId |

---

## 4. Outputs

### 4.1 Review Decisions

| Decision | Description | Next Status | Next Action |
|----------|-------------|-------------|-------------|
| `APPROVE` | Rule passes validation | `APPROVED` (T2/T3) or `PENDING_REVIEW` (T0/T1) | Queue for release or human review |
| `REJECT` | Rule fails validation | `REJECTED` | No further processing |
| `ESCALATE_HUMAN` | Needs human judgment | `PENDING_REVIEW` | Create HumanReviewQueue entry |
| `ESCALATE_ARBITER` | Conflict detected | `PENDING_REVIEW` | Create RegulatoryConflict entry |

### 4.2 ReviewerOutput Schema

```typescript
export const ReviewerOutputSchema = z.object({
  review_result: z.object({
    draft_rule_id: z.string(),
    decision: z.enum(["APPROVE", "REJECT", "ESCALATE_HUMAN", "ESCALATE_ARBITER"]),
    validation_checks: ValidationChecksSchema,
    computed_confidence: ConfidenceSchema, // 0.0 - 1.0
    issues_found: z.array(IssueFoundSchema),
    human_review_reason: z.string().nullable(),
    reviewer_notes: z.string(),
  }),
})
```

### 4.3 Issue Severity Levels

```typescript
export const IssueFoundSchema = z.object({
  severity: z.enum(["critical", "major", "minor"]),
  description: z.string(),
  recommendation: z.string(),
})
```

| Severity | Impact | Example |
|----------|--------|---------|
| `critical` | Rule cannot be used | Value does not match source |
| `major` | Significant accuracy concern | Risk tier may be incorrect |
| `minor` | Non-blocking issue | Translation could be improved |

### 4.4 Database Updates

On review completion, the following fields are updated:

```sql
UPDATE regulatoryRule SET
  status = <newStatus>,
  reviewerNotes = <JSON>,
  confidence = <computed_confidence>,
  approvedAt = <timestamp if APPROVED>
WHERE id = <ruleId>
```

**ReviewerNotes JSON Structure:**
```json
{
  "decision": "APPROVE",
  "validation_checks": {...},
  "computed_confidence": 0.97,
  "issues_found": [],
  "human_review_reason": null,
  "reviewer_notes": "Rule validated successfully",
  "reviewed_at": "2026-01-14T10:30:00Z",
  "tier": "T2"
}
```

---

## 5. Dependencies

### 5.1 Service Dependencies

| Dependency | Purpose | Critical? |
|------------|---------|-----------|
| PostgreSQL | Rule and SourcePointer storage | Yes |
| Redis | BullMQ job queue | Yes |
| Ollama LLM | Quality assessment | Yes |

### 5.2 Internal Dependencies

| Module | Purpose | File |
|--------|---------|------|
| `runAgent` | LLM execution framework | `/src/lib/regulatory-truth/agents/runner.ts` |
| `llmLimiter` | Rate limiting for LLM calls | `/src/lib/regulatory-truth/workers/rate-limiter.ts` |
| `releaseQueue` | Queue for approved rules | `/src/lib/regulatory-truth/workers/queues.ts` |
| `approveRule` | Rule status transitions | `/src/lib/regulatory-truth/services/rule-status-service.ts` |
| `requestRuleReview` | Human review requests | `/src/lib/regulatory-truth/services/human-review-service.ts` |
| `logAuditEvent` | Audit trail | `/src/lib/regulatory-truth/utils/audit-log.ts` |

### 5.3 Ollama LLM Configuration

The Reviewer uses the main Ollama endpoint (not the extraction endpoint):

```
OLLAMA_ENDPOINT: Main Ollama API URL
OLLAMA_API_KEY: API authentication
OLLAMA_MODEL: Model for review (e.g., gemma-3-27b)
```

**Agent Timeout**: 1 minute (60000ms) for REVIEWER type

---

## 6. Prerequisites

### 6.1 Rule State Requirements

For a rule to be eligible for review:

| Prerequisite | Check | Error if Failed |
|--------------|-------|-----------------|
| Rule exists | `db.regulatoryRule.findUnique()` | "Rule not found: {ruleId}" |
| Status is DRAFT | `rule.status === "DRAFT"` | N/A (drainer only queues DRAFT rules) |
| Has SourcePointers | `sourcePointers.length > 0` | Blocked - cannot approve without evidence |

### 6.2 Source Pointer Requirements

Each SourcePointer must have:
- Valid `exactQuote` (verbatim quote from evidence)
- Valid `extractedValue` (the extracted data point)
- Confidence score (used in aggregate confidence calculation)

### 6.3 Evidence Linkage

SourcePointers are linked to Evidence via `evidenceId`. The reviewer validates that:
- At least one SourcePointer exists for the rule
- SourcePointers contain valid quotes that match evidence content

---

## 7. Triggers

### 7.1 Primary Trigger: Continuous Drainer

**File**: `/src/lib/regulatory-truth/workers/continuous-drainer.worker.ts`

The `drainDraftRules()` function periodically scans for DRAFT rules:

```typescript
async function drainDraftRules(): Promise<number> {
  const drafts = await db.regulatoryRule.findMany({
    where: { status: "DRAFT" },
    select: { id: true },
    take: 100, // Batch size (increased for parallel processing)
  })

  if (drafts.length === 0) return 0

  const runId = `drain-${Date.now()}`
  await reviewQueue.addBulk(
    drafts.map((r) => ({
      name: "review",
      data: { ruleId: r.id, runId },
      opts: { jobId: `review-${r.id}` },
    }))
  )

  return drafts.length
}
```

### 7.2 Trigger Sequence

```
1. Composer creates Draft Rule (status: DRAFT)
2. Continuous Drainer polls every 1-60 seconds (adaptive backoff)
3. Stage 4 (drainDraftRules) finds DRAFT rules
4. Adds jobs to `review` queue with jobId: `review-{ruleId}`
5. Reviewer Worker processes jobs in parallel (concurrency: 5)
```

### 7.3 Deduplication

Jobs are deduplicated by `jobId: review-${ruleId}`, ensuring:
- Same rule is not queued multiple times
- Reprocessing requires removing the existing job first

---

## 8. Error Handling

### 8.1 LLM Failure Handling

| Error Type | Handling | Retry? |
|------------|----------|--------|
| API timeout | AbortController with 60s timeout | Yes (3 attempts) |
| HTTP 429 (rate limit) | Exponential backoff (30s base) | Yes |
| Parse failure | Log rawOutput, mark PARSE_FAILED | No |
| Schema validation failure | Mark VALIDATION_REJECTED | No |
| Network error | Standard retry with exponential backoff | Yes |

**Retry Configuration** (from `runner.ts`):
```typescript
const maxRetries = 3
// Exponential backoff: 1s, 2s, 4s (or 30s, 60s, 120s for rate limits)
```

### 8.2 Review Timeout

The agent runner enforces a 1-minute timeout for REVIEWER:

```typescript
const AGENT_TIMEOUTS: Record<string, number> = {
  REVIEWER: 60000, // 1 minute
}
```

If exceeded, the job fails with `TIMEOUT` outcome.

### 8.3 Dead Letter Queue

Jobs that exhaust all retries are moved to the Dead Letter Queue:

```typescript
// From base.ts
worker.on("failed", (job, err) => {
  if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
    void moveToDeadLetterQueue(job, err, queueName, options.name)
  }
})
```

DLQ threshold alert: 10 jobs triggers a warning log.

### 8.4 Job Result Structure

```typescript
interface JobResult {
  success: boolean
  duration: number // milliseconds
  data?: {
    decision: string // APPROVE, REJECT, etc.
  }
  error?: string
}
```

---

## 9. Guardrails and Safety

### 9.1 Tier-Based Auto-Approval Gate

**The Absolute Gate** (Issue #845 fix):

```typescript
// This check MUST come first, before any other approval logic.
if (rule.riskTier === "T0" || rule.riskTier === "T1") {
  newStatus = "PENDING_REVIEW"
  await requestRuleReview(rule.id, {...})
  console.log(`[reviewer] ${rule.riskTier} rule requires human approval`)
  break
}
```

**Key Invariant**: No T0/T1 rule is ever auto-approved, regardless of:
- Confidence score (even 1.0)
- Grace period elapsed
- Source reliability
- Any other factor

### 9.2 Source Pointer Validation

Rules cannot be approved without evidence:

```typescript
// INVARIANT: NEVER approve rules without source pointers
const pointerCount = await db.sourcePointer.count({
  where: { rules: { some: { id: rule.id } } },
})

if (pointerCount === 0) {
  newStatus = "PENDING_REVIEW"
  console.log(`[reviewer] BLOCKED: Rule has 0 source pointers`)
  break
}
```

### 9.3 Human Review Escalation

Rules are escalated to human review when:

| Condition | HumanReviewReason | Priority |
|-----------|-------------------|----------|
| T0 rule | `T0_RULE_APPROVAL` | CRITICAL (4h SLA) |
| T1 rule | `T1_RULE_APPROVAL` | HIGH (24h SLA) |
| Low confidence (<0.85) | `LOW_RULE_CONFIDENCE` | NORMAL (48h SLA) |
| LLM decision: ESCALATE_HUMAN | Based on context | Varies |

### 9.4 Conflict Detection

When `ESCALATE_ARBITER` is returned, the reviewer:

1. Finds potentially conflicting rules (same conceptSlug, overlapping dates)
2. Creates a `RegulatoryConflict` record
3. Sets rule status to `PENDING_REVIEW`

```typescript
const conflict = await db.regulatoryConflict.create({
  data: {
    conflictType: "SCOPE_CONFLICT",
    status: "OPEN",
    itemAId: rule.id,
    itemBId: conflictingRules[0].id,
    description: reviewOutput.human_review_reason,
    metadata: {
      detectedBy: "REVIEWER",
      allConflictingRuleIds: conflictingRules.map((r) => r.id),
    },
  },
})
```

### 9.5 Audit Trail

Every review decision is logged:

```typescript
await logAuditEvent({
  action: newStatus === "APPROVED" ? "RULE_APPROVED"
        : newStatus === "REJECTED" ? "RULE_REJECTED"
        : "RULE_CREATED",
  entityType: "RULE",
  entityId: rule.id,
  metadata: {
    decision: reviewOutput.decision,
    newStatus,
    confidence: reviewOutput.computed_confidence,
    tier: rule.riskTier,
  },
})
```

---

## 10. Monitoring and Observability

### 10.1 Prometheus Metrics

**File**: `/src/lib/regulatory-truth/workers/metrics.ts`

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `worker_jobs_processed_total` | Counter | worker=reviewer, status, queue | Total jobs processed |
| `worker_job_duration_seconds` | Histogram | worker=reviewer, queue | Processing time |
| `worker_queue_depth` | Gauge | queue=review | Pending jobs |
| `worker_active_jobs` | Gauge | worker=reviewer | Currently processing |

### 10.2 Decision Tracking

The worker logs decisions for monitoring:

```typescript
// On success
jobsProcessed.inc({ worker: "reviewer", status: "success", queue: "review" })
jobDuration.observe({ worker: "reviewer", queue: "review" }, duration / 1000)

// On failure
jobsProcessed.inc({ worker: "reviewer", status: "failed", queue: "review" })
```

### 10.3 Review Pass/Fail Rates

Calculate from Prometheus:

```promql
# Approval rate
sum(rate(worker_jobs_processed_total{worker="reviewer",status="success"}[1h]))
/
sum(rate(worker_jobs_processed_total{worker="reviewer"}[1h]))

# Average review latency
histogram_quantile(0.95,
  rate(worker_job_duration_seconds_bucket{worker="reviewer"}[1h])
)
```

### 10.4 Rejection Reasons

Rejection reasons are stored in `reviewerNotes` JSON:

```sql
SELECT
  (reviewerNotes::json->>'decision') as decision,
  COUNT(*) as count
FROM regulatoryRule
WHERE status = 'REJECTED'
GROUP BY decision
```

### 10.5 Heartbeat Monitoring

The continuous drainer updates heartbeat for stall detection:

```typescript
await updateStageHeartbeat({
  stage: "draft-rules",
  lastActivity: new Date().toISOString(),
  itemsProcessed: stageMetrics["draft-rules"].itemsProcessed,
  avgDurationMs: Math.round(avgDuration),
})
```

---

## 11. Configuration

### 11.1 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_ENDPOINT` | Required | Ollama API endpoint |
| `OLLAMA_API_KEY` | Required | Ollama API key |
| `OLLAMA_MODEL` | Required | Model name for review |
| `WORKER_CONCURRENCY` | 2 | Base concurrency (overridden to 5 for reviewer) |
| `AUTO_APPROVE_GRACE_HOURS` | 24 | Grace period for auto-approval |
| `AUTO_APPROVE_MIN_CONFIDENCE` | 0.90 | Minimum confidence for auto-approval |
| `REVIEWER_TIMEOUT_MS` | 60000 | Agent timeout override |

### 11.2 Auto-Approve Criteria

For grace period auto-approval (`autoApproveEligibleRules`):

| Criterion | Requirement |
|-----------|-------------|
| Status | `PENDING_REVIEW` |
| Tier | T2 or T3 only (T0/T1 NEVER) |
| Age | Older than grace period (24h default) |
| Confidence | >= 0.90 |
| Conflicts | No open conflicts |
| Source Pointers | At least 1 (no evidence = no approval) |

### 11.3 LLM Settings

From `runner.ts`:

```typescript
{
  temperature: 0.1,    // Low temperature for consistent reviews
  num_predict: 16384,  // Max tokens
}
```

### 11.4 Docker Compose Configuration

**File**: `/docker-compose.workers.yml`

```yaml
worker-reviewer:
  <<: *worker-common
  container_name: fiskai-worker-reviewer
  command: ["node", "dist/workers/lib/regulatory-truth/workers/reviewer.worker.js"]
  environment:
    <<: *worker-env
    OLLAMA_ENDPOINT: ${OLLAMA_ENDPOINT}
    OLLAMA_API_KEY: ${OLLAMA_API_KEY}
    OLLAMA_MODEL: ${OLLAMA_MODEL}
    WORKER_TYPE: reviewer
    WORKER_CONCURRENCY: 1
  deploy:
    resources:
      limits:
        memory: 512M
```

Note: Container config shows `WORKER_CONCURRENCY: 1`, but the worker code overrides to 5 for parallel processing.

---

## 12. Known Issues and Limitations

### 12.1 Review Accuracy

| Issue | Impact | Mitigation |
|-------|--------|------------|
| LLM hallucination | May approve incorrect rules | T0/T1 always require human review |
| Translation errors | HR/EN mismatch | Translation check in validation |
| Complex predicates | AppliesWhen may be incorrectly validated | Human escalation for novel patterns |

### 12.2 Edge Case Handling

| Edge Case | Behavior | Notes |
|-----------|----------|-------|
| Circular supersession | Not detected | Future improvement needed |
| Missing evidence | Blocks approval | Logged but not auto-fixed |
| Conflicting sources | Escalates to Arbiter | May delay approval |
| Novel rule patterns | Escalates to human | Conservative approach |

### 12.3 Performance Considerations

| Concern | Current State | Recommendation |
|---------|--------------|----------------|
| Backlog buildup | Concurrency increased to 5 | Monitor queue depth |
| LLM latency | 60s timeout | Consider async review |
| Memory usage | 512MB limit | Adequate for current load |

### 12.4 Known Bugs / Tracked Issues

| Issue | Description | Status |
|-------|-------------|--------|
| #176 | 509 DRAFT rules bottleneck | Fixed - increased concurrency |
| #845 | T0/T1 auto-approval gate | Fixed - absolute tier check |
| #884 | Inconsistent human review triggers | Fixed - centralized service |

---

## Appendix A: Complete File Listing

| File | Purpose |
|------|---------|
| `/src/lib/regulatory-truth/workers/reviewer.worker.ts` | Worker entry point |
| `/src/lib/regulatory-truth/agents/reviewer.ts` | Agent logic and orchestration |
| `/src/lib/regulatory-truth/schemas/reviewer.ts` | Input/Output schemas |
| `/src/lib/regulatory-truth/prompts/index.ts` | REVIEWER_PROMPT definition |
| `/src/lib/regulatory-truth/agents/runner.ts` | LLM execution framework |
| `/src/lib/regulatory-truth/workers/base.ts` | Worker factory and DLQ handling |
| `/src/lib/regulatory-truth/workers/queues.ts` | Queue definitions |
| `/src/lib/regulatory-truth/workers/rate-limiter.ts` | LLM rate limiting |
| `/src/lib/regulatory-truth/workers/metrics.ts` | Prometheus metrics |
| `/src/lib/regulatory-truth/services/rule-status-service.ts` | Status transitions |
| `/src/lib/regulatory-truth/services/human-review-service.ts` | Human review requests |
| `/src/lib/regulatory-truth/workers/continuous-drainer.worker.ts` | Job triggering |
| `/docker-compose.workers.yml` | Container configuration |

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **Draft Rule** | A regulatory rule in DRAFT status awaiting review |
| **T0/T1/T2/T3** | Risk tier classification (T0 = Critical, T3 = Low) |
| **SourcePointer** | Citation linking a rule to source evidence |
| **AppliesWhen** | DSL predicate defining when a rule applies |
| **Arbiter** | Agent that resolves conflicts between rules |
| **Evidence** | Raw regulatory content from official sources |
| **RTL** | Regulatory Truth Layer |
| **Layer B** | 24/7 continuous processing layer |
| **DLQ** | Dead Letter Queue for failed jobs |
| **Grace Period** | Waiting period before T2/T3 auto-approval (24h default) |

---

*Document generated: 2026-01-14*
*Source: Stakeholder-grade audit of FiskAI Regulatory Truth Layer Reviewer Worker*
