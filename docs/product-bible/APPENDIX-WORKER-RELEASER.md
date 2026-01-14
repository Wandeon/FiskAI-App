# Appendix: Releaser Worker Audit

> **Document Version:** 1.0.0
> **Last Updated:** 2026-01-14
> **Audit Status:** Complete
> **Auditor:** Claude Opus 4.5

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Overview](#2-overview)
3. [Technical Implementation](#3-technical-implementation)
4. [Inputs](#4-inputs)
5. [Outputs](#5-outputs)
6. [Dependencies](#6-dependencies)
7. [Prerequisites](#7-prerequisites)
8. [Triggers](#8-triggers)
9. [Error Handling](#9-error-handling)
10. [Guardrails & Safety](#10-guardrails--safety)
11. [Monitoring & Observability](#11-monitoring--observability)
12. [Configuration](#12-configuration)
13. [Known Issues & Limitations](#13-known-issues--limitations)
14. [Appendix A: Data Models](#appendix-a-data-models)
15. [Appendix B: Code References](#appendix-b-code-references)

---

## 1. Executive Summary

The **Releaser Worker** is the final stage of the FiskAI Regulatory Truth Layer (RTL) pipeline. It transforms approved regulatory rules into production-ready releases with:

- **Semantic Versioning**: Automatic version calculation based on rule risk tiers
- **Content Integrity**: SHA-256 content hashes for tamper detection
- **Atomic Publication**: All-or-nothing transaction semantics
- **Full Audit Trail**: Complete provenance from source evidence to published rule
- **Rollback Capability**: First-class support for reverting releases

**Key Metrics:**

- Concurrency: 1 (serialized releases)
- Memory Limit: 512MB
- Queue Rate Limit: 2 jobs per 60 seconds
- Transaction Timeout: 30 seconds

---

## 2. Overview

### 2.1 Purpose

The Releaser Worker publishes approved regulatory rules to production. "Release" in this context means:

1. Creating an immutable `RuleRelease` record with version and content hash
2. Transitioning rules from `APPROVED` to `PUBLISHED` status
3. Building/updating the knowledge graph relationships
4. Triggering downstream systems (embeddings, content sync)

### 2.2 Role in Layer B

The Releaser is the **terminal stage** of Layer B (24/7 Processing):

```
Layer A: Daily Discovery
  Sentinel -> Evidence

Layer B: 24/7 Processing
  OCR -> Extractor -> Composer -> Reviewer -> Arbiter -> [RELEASER]
                                                              |
                                                              v
                                                        PRODUCTION
```

After the Arbiter resolves any conflicts, rules in `APPROVED` status are candidates for release. The Releaser:

1. Validates all pre-publication requirements
2. Creates a versioned release bundle
3. Publishes rules atomically
4. Triggers post-publication workflows

### 2.3 What "Release" Means

A release is a **point-in-time snapshot** of regulatory rules that:

- Has a semantic version (e.g., `2.1.0`)
- Contains a content hash for integrity verification
- Includes bilingual changelogs (HR/EN)
- Records the complete audit trail
- Links to all source evidence and pointers

Once released, rules become the authoritative source for:

- Client-facing regulatory calculations
- AI assistant responses
- MDX guide content
- Tax compliance decisions

---

## 3. Technical Implementation

### 3.1 Entry Point

**File:** `/home/admin/FiskAI/src/lib/regulatory-truth/workers/releaser.worker.ts`

```typescript
interface ReleaseJobData {
  ruleIds: string[] // IDs of approved rules to release
  runId: string // Correlation ID for tracing
  parentJobId?: string // Optional parent job reference
}
```

The worker processes jobs from the `release` queue with concurrency 1 to ensure serialized releases.

### 3.2 Job Processing Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        processReleaseJob()                          │
├─────────────────────────────────────────────────────────────────────┤
│  1. Extract ruleIds from job data                                   │
│  2. Call runReleaser(ruleIds)                                       │
│  3. If successful, rebuild knowledge graph                          │
│  4. Record metrics (success/failure, duration)                      │
│  5. Return JobResult with releaseId and publishedCount              │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.3 Core Agent Logic

**File:** `/home/admin/FiskAI/src/lib/regulatory-truth/agents/releaser.ts`

The `runReleaser()` function implements the publication logic:

```typescript
export async function runReleaser(approvedRuleIds: string[]): Promise<ReleaserResult> {
  // 1. HARD GATES (fail-fast validation)
  //    - T0/T1 rules must have approvedBy set
  //    - No unresolved conflicts
  //    - All rules must have source pointers
  //    - Evidence strength policy check
  // 2. VERSION CALCULATION
  //    - Get latest release version
  //    - Calculate next version based on risk tiers
  // 3. LLM AGENT CALL
  //    - Generate changelog and metadata
  //    - Validate output schema
  // 4. CONTENT HASH
  //    - Compute deterministic SHA-256 hash
  //    - Normalize dates for consistency
  // 5. CREATE RELEASE RECORD
  //    - Persist RuleRelease with audit trail
  // 6. PUBLISH RULES
  //    - Atomic status transition via publishRules()
  //    - Provenance validation included
  // 7. POST-PUBLICATION
  //    - Queue embedding generation (non-blocking)
  //    - Emit content sync events (non-blocking)
}
```

### 3.4 Publication Mechanism

Publication uses the domain service in `/home/admin/FiskAI/src/lib/regulatory-truth/services/rule-status-service.ts`:

```typescript
export async function publishRules(
  ruleIds: string[],
  source: string,
  actorUserId?: string
): Promise<PublishRulesResult>
```

Key characteristics:

- **Atomic Transaction**: Uses `Prisma.$transaction` with `Serializable` isolation
- **Per-Rule Validation**: Each rule validated individually within transaction
- **Provenance Verification**: Every source pointer quote verified in evidence
- **Audit Logging**: Status change logged after successful commit

### 3.5 Version Increment Logic

**Semantic Versioning based on Risk Tier:**

| Highest Risk Tier in Batch | Version Bump | Example        |
| -------------------------- | ------------ | -------------- |
| T0 (Critical)              | Major        | 1.0.0 -> 2.0.0 |
| T1 (High)                  | Minor        | 1.0.0 -> 1.1.0 |
| T2/T3 (Medium/Low)         | Patch        | 1.0.0 -> 1.0.1 |

```typescript
function calculateNextVersion(
  previousVersion: string | null,
  riskTiers: string[]
): { version: string; releaseType: "major" | "minor" | "patch" }
```

### 3.6 Content Hash Computation

**File:** `/home/admin/FiskAI/src/lib/regulatory-truth/utils/release-hash.ts`

The content hash ensures release integrity:

```typescript
export function computeReleaseHash(rules: RuleSnapshot[]): string {
  // 1. Sort by conceptSlug for determinism
  // 2. Normalize dates to YYYY-MM-DD
  // 3. Recursively sort all object keys
  // 4. Stringify with no whitespace
  // 5. Return SHA-256 hex digest
}
```

**RuleSnapshot fields included in hash:**

- `conceptSlug`
- `appliesWhen`
- `value`
- `valueType`
- `effectiveFrom`
- `effectiveUntil`

---

## 4. Inputs

### 4.1 Job Payload Schema

```typescript
interface ReleaseJobData {
  ruleIds: string[] // Required: Array of RegulatoryRule IDs
  runId: string // Required: Correlation ID (e.g., "drain-1705276800000")
  parentJobId?: string // Optional: Parent job for nested workflows
}
```

### 4.2 Input Validation

The `ReleaserInputSchema` (Zod) validates agent inputs:

```typescript
export const ReleaserInputSchema = z.object({
  approvedRuleIds: z.array(z.string()).min(1),
  previousVersion: z.string().nullable(),
})
```

### 4.3 Source Data Requirements

For each rule ID, the following data is loaded:

| Data           | Source                  | Required            |
| -------------- | ----------------------- | ------------------- |
| RegulatoryRule | `db.regulatoryRule`     | Yes                 |
| SourcePointers | `db.sourcePointer`      | Yes (>=1)           |
| Evidence       | `dbReg.evidence`        | Yes                 |
| Conflicts      | `db.regulatoryConflict` | No (must be 0 open) |

---

## 5. Outputs

### 5.1 Primary Output: RuleRelease Record

```prisma
model RuleRelease {
  id            String   @id @default(cuid())
  version       String   // semver: "1.0.0"
  releaseType   String   // "major" | "minor" | "patch"
  releasedAt    DateTime @default(now())
  effectiveFrom DateTime
  contentHash   String   // SHA-256 hex (64 chars)
  changelogHr   String?  @db.Text
  changelogEn   String?  @db.Text
  approvedBy    String[] // User IDs who approved rules
  auditTrail    Json?    // Metrics about the release
  rules         RegulatoryRule[] @relation("ReleaseRules")
}
```

### 5.2 Audit Trail Structure

```typescript
{
  sourceEvidenceCount: number,   // Distinct Evidence records
  sourcePointerCount: number,    // Total SourcePointer records
  reviewCount: number,           // Reviewer agent runs
  humanApprovals: number         // Rules with approvedBy set
}
```

### 5.3 Rule Status Transition

```
APPROVED -> PUBLISHED
```

Each rule's status is updated atomically with provenance validation.

### 5.4 Secondary Outputs

| Output              | Trigger                  | Blocking |
| ------------------- | ------------------------ | -------- |
| Knowledge Graph     | `buildKnowledgeGraph()`  | No       |
| Embedding Jobs      | `embeddingQueue.add()`   | No       |
| Content Sync Events | `emitContentSyncEvent()` | No       |

### 5.5 Return Value

```typescript
interface ReleaserResult {
  success: boolean
  output: ReleaserOutput | null
  releaseId: string | null
  publishedRuleIds: string[]
  error: string | null
}
```

---

## 6. Dependencies

### 6.1 Internal Dependencies

| Dependency                   | Purpose                  | File                              |
| ---------------------------- | ------------------------ | --------------------------------- |
| `runAgent`                   | LLM agent execution      | `agents/runner.ts`                |
| `publishRules`               | Atomic status transition | `services/rule-status-service.ts` |
| `computeReleaseHash`         | Content integrity        | `utils/release-hash.ts`           |
| `checkBatchEvidenceStrength` | Evidence policy          | `utils/evidence-strength.ts`      |
| `verifyEvidenceChain`        | Provenance validation    | `agents/releaser.ts`              |
| `logAuditEvent`              | Audit trail              | `utils/audit-log.ts`              |
| `buildKnowledgeGraph`        | Graph updates            | `graph/knowledge-graph.ts`        |
| `emitContentSyncEvent`       | MDX sync                 | `content-sync/emit-event.ts`      |

### 6.2 External Dependencies

| Dependency | Purpose                 |
| ---------- | ----------------------- |
| BullMQ     | Job queue               |
| Prisma     | Database ORM            |
| Redis      | Queue backend           |
| Ollama     | LLM provider (optional) |

### 6.3 Database Access

| Database                | Models Used                                                                       |
| ----------------------- | --------------------------------------------------------------------------------- |
| Main DB (`db`)          | RegulatoryRule, SourcePointer, RuleRelease, Concept, AgentRun, RegulatoryConflict |
| Regulatory DB (`dbReg`) | Evidence                                                                          |

---

## 7. Prerequisites

### 7.1 Rule Status Requirements

All rules must be in `APPROVED` status. Rules in other statuses are rejected:

```typescript
if (rules.length !== approvedRuleIds.length) {
  return {
    success: false,
    error: `Some rules not found or not approved: ${missingIds.join(", ")}`,
  }
}
```

### 7.2 T0/T1 Approval Requirement

Critical rules require human approval:

```typescript
const unapprovedCritical = rules.filter(
  (r) => (r.riskTier === "T0" || r.riskTier === "T1") && !r.approvedBy
)

if (unapprovedCritical.length > 0) {
  // BLOCKED: Cannot release T0/T1 rules without approvedBy
}
```

### 7.3 No Unresolved Conflicts

Rules with open conflicts cannot be released:

```typescript
const rulesWithConflicts = await db.regulatoryRule.findMany({
  where: {
    id: { in: approvedRuleIds },
    OR: [
      { conflictsA: { some: { status: "OPEN" } } },
      { conflictsB: { some: { status: "OPEN" } } },
    ],
  },
})
```

### 7.4 Source Pointer Requirement

Every rule must have at least one source pointer:

```typescript
const rulesWithoutPointers = rulesWithPointers.filter((r) => r.sourcePointers.length === 0)

if (rulesWithoutPointers.length > 0) {
  // BLOCKED: Cannot release rules without source pointers
}
```

### 7.5 Evidence Strength Policy

Single-source rules require LAW authority to publish:

```typescript
const evidenceCheck = await checkBatchEvidenceStrength(approvedRuleIds)

if (!evidenceCheck.canPublishAll) {
  // BLOCKED: Evidence strength policy violation
}
```

| Evidence Strength | Authority Required          | Publishable |
| ----------------- | --------------------------- | ----------- |
| MULTI_SOURCE (2+) | Any                         | Yes         |
| SINGLE_SOURCE     | LAW                         | Yes         |
| SINGLE_SOURCE     | GUIDANCE/PROCEDURE/PRACTICE | No          |

---

## 8. Triggers

### 8.1 Primary Trigger: Continuous Drainer

**File:** `/home/admin/FiskAI/src/lib/regulatory-truth/workers/continuous-drainer.worker.ts`

The continuous drainer polls for approved rules and queues release jobs:

```typescript
async function drainApprovedRules(): Promise<number> {
  const approved = await db.regulatoryRule.findMany({
    where: {
      status: "APPROVED",
      releases: { none: {} }, // Not yet in any release
    },
    select: { id: true },
    take: 20,
  })

  if (approved.length === 0) return 0

  await releaseQueue.add(
    "release",
    {
      ruleIds: approved.map((r) => r.id),
      runId,
    },
    { jobId: `release-${sortedRuleIds}` }
  )

  return approved.length
}
```

### 8.2 Trigger Timing

The drainer runs in a continuous loop with adaptive backoff:

| Condition  | Delay                                              |
| ---------- | -------------------------------------------------- |
| Work found | 1 second                                           |
| No work    | 1s -> 2s -> 4s -> ... -> 60s (exponential backoff) |

### 8.3 Batch Logic

- **Batch Size**: Up to 20 approved rules per release job
- **Deduplication**: Job ID includes sorted rule IDs to prevent duplicates
- **Idempotency**: Same rule set produces same job ID

### 8.4 Pipeline Position

```
Arbiter Worker
    |
    v
Rules set to APPROVED
    |
    v
Continuous Drainer (Stage 6)
    |
    v
Release Queue
    |
    v
Releaser Worker
```

---

## 9. Error Handling

### 9.1 Hard Gate Failures

These errors immediately reject the release:

| Error Type        | Message Pattern                                  | Resolution          |
| ----------------- | ------------------------------------------------ | ------------------- |
| No rules          | "No approved rules provided"                     | Ensure rules exist  |
| Missing rules     | "Some rules not found or not approved"           | Check rule statuses |
| Unapproved T0/T1  | "Cannot release T0/T1 rules without approvedBy"  | Get human approval  |
| Open conflicts    | "Cannot release rules with unresolved conflicts" | Run arbiter         |
| No pointers       | "Cannot release rules without source pointers"   | Re-extract          |
| Evidence strength | "Evidence strength policy violation"             | Add second source   |

### 9.2 Publication Failures

If `publishRules()` fails after creating the release record:

```typescript
const publishResult = await publishRules(approvedRuleIds, "releaser")
if (!publishResult.success) {
  return {
    success: false,
    releaseId: release.id, // Release record exists but rules not published
    publishedRuleIds: [],
    error: `Failed to publish rules: ${publishResult.errors.join("; ")}`,
  }
}
```

### 9.3 Transaction Semantics

The `publishRules()` function uses `Serializable` isolation:

```typescript
await db.$transaction(
  async (tx) => {
    // All rules must succeed or none are published
    for (const ruleId of ruleIds) {
      // Validate provenance
      // Update status
      // If any fails, entire transaction rolls back
    }
  },
  {
    timeout: 30000,
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  }
)
```

### 9.4 Retry Logic

Default job options from queue configuration:

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

### 9.5 Dead Letter Queue

Jobs that fail all retries are moved to the DLQ:

```typescript
worker.on("failed", (job, err) => {
  if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
    void moveToDeadLetterQueue(job, err, queueName, options.name)
  }
})
```

### 9.6 Non-Blocking Downstream Failures

These operations are non-blocking and logged but don't fail the release:

| Operation           | On Failure                      |
| ------------------- | ------------------------------- |
| Embedding queue     | Log error, continue             |
| Content sync events | Log error, continue             |
| Knowledge graph     | Logged in buildKnowledgeGraph() |

---

## 10. Guardrails & Safety

### 10.1 Pre-Release Validation Gates

The releaser implements 6 hard gates before publication:

| Gate | Check             | Blocks If                                |
| ---- | ----------------- | ---------------------------------------- |
| 1    | Rule count        | `approvedRuleIds.length === 0`           |
| 2    | Status check      | Any rule not APPROVED                    |
| 3    | T0/T1 approval    | T0/T1 rule without `approvedBy`          |
| 4    | Conflict check    | Any rule has OPEN conflict               |
| 5    | Pointer check     | Any rule has 0 source pointers           |
| 6    | Evidence strength | Single-source rule without LAW authority |

### 10.2 Evidence Chain Verification

**File:** `/home/admin/FiskAI/src/lib/regulatory-truth/agents/releaser.ts`

The `verifyEvidenceChain()` function performs deep provenance validation:

```typescript
export function verifyEvidenceChain(
  rules: Array<{
    id: string
    conceptSlug: string
    riskTier: string
    sourcePointers: Array<{
      id: string
      evidenceId: string
      exactQuote: string
      evidence: { rawContent: string; contentHash: string } | null
    }>
  }>
): EvidenceChainVerificationResult
```

Checks performed:

1. **Orphaned Pointers**: SourcePointer references existing Evidence
2. **Hash Mismatch**: Evidence.rawContent hash matches contentHash
3. **Quote Not Found**: SourcePointer.exactQuote exists in rawContent
4. **Quote Match Unacceptable**: Match type acceptable for risk tier

### 10.3 Risk Tier Quote Requirements

| Risk Tier     | Required Match Type |
| ------------- | ------------------- |
| T0 (Critical) | EXACT only          |
| T1 (High)     | EXACT only          |
| T2 (Medium)   | EXACT or NORMALIZED |
| T3 (Low)      | EXACT or NORMALIZED |

### 10.4 Atomic Transactions

Publication uses database transactions with strict isolation:

```typescript
isolationLevel: Prisma.TransactionIsolationLevel.Serializable
```

This prevents:

- Dirty reads
- Non-repeatable reads
- Phantom reads
- Lost updates

### 10.5 Audit Logging

Every significant action is logged to `RegulatoryAuditLog`:

| Action                | Entity Type | When                         |
| --------------------- | ----------- | ---------------------------- |
| `RELEASE_PUBLISHED`   | RELEASE     | After release record created |
| `RULE_PUBLISHED`      | RULE        | For each rule in release     |
| `RULE_STATUS_CHANGED` | RULE        | After status transition      |

### 10.6 Content Hash Integrity

The release content hash provides tamper detection:

```typescript
const contentHash = computeReleaseHash(ruleSnapshots)

// Can be verified later:
const { valid, stored, computed } = await verifyReleaseHash(releaseId, db)
```

### 10.7 Rollback Points

The releaser creates rollback points via:

1. **RuleRelease record**: Immutable snapshot of what was released
2. **Audit logs**: Full history of status transitions
3. **Version chain**: Previous version linkage

---

## 11. Monitoring & Observability

### 11.1 Prometheus Metrics

**File:** `/home/admin/FiskAI/src/lib/regulatory-truth/workers/metrics.ts`

| Metric                        | Type      | Labels                | Description               |
| ----------------------------- | --------- | --------------------- | ------------------------- |
| `worker_jobs_processed_total` | Counter   | worker, status, queue | Total jobs processed      |
| `worker_job_duration_seconds` | Histogram | worker, queue         | Job processing duration   |
| `worker_queue_depth`          | Gauge     | queue                 | Jobs waiting in queue     |
| `worker_active_jobs`          | Gauge     | worker                | Jobs currently processing |

### 11.2 Worker Logging

Standard log format:

```
[releaser] Processing job {jobId}: release
[releaser] Job {jobId} completed in {duration}ms
[releaser] BLOCKED: {reason}
```

### 11.3 Release Metrics in Audit Trail

Each release records metrics in `auditTrail`:

```json
{
  "sourceEvidenceCount": 15,
  "sourcePointerCount": 23,
  "reviewCount": 8,
  "humanApprovals": 3
}
```

### 11.4 Health Dashboard Queries

```sql
-- Rules released today
SELECT COUNT(*) FROM "RuleRelease"
WHERE DATE("releasedAt") = CURRENT_DATE;

-- Version history
SELECT version, "releaseType", "releasedAt",
       jsonb_array_length(rules) as rule_count
FROM "RuleRelease"
ORDER BY "releasedAt" DESC
LIMIT 10;

-- Release timing distribution
SELECT
  EXTRACT(hour FROM "releasedAt") as hour,
  COUNT(*) as releases
FROM "RuleRelease"
GROUP BY hour
ORDER BY hour;
```

### 11.5 Queue Monitoring

```bash
# Check release queue depth
npx tsx scripts/queue-status.ts

# View worker logs
docker logs fiskai-worker-releaser --tail 100
```

### 11.6 Drainer Heartbeat

The continuous drainer updates Redis with stage-specific heartbeats:

```typescript
await updateStageHeartbeat({
  stage: "approved-rules",
  lastActivity: new Date().toISOString(),
  itemsProcessed: count,
  avgDurationMs: duration,
})
```

---

## 12. Configuration

### 12.1 Docker Compose Configuration

**File:** `/home/admin/FiskAI/docker-compose.workers.yml`

```yaml
worker-releaser:
  <<: *worker-common
  container_name: fiskai-worker-releaser
  command: ["node", "dist/workers/lib/regulatory-truth/workers/releaser.worker.js"]
  environment:
    <<: *worker-env
    WORKER_TYPE: releaser
    WORKER_CONCURRENCY: 1
  deploy:
    resources:
      limits:
        memory: 512M
```

### 12.2 Queue Configuration

```typescript
// Rate limit: 2 releases per 60 seconds
export const releaseQueue = createQueue("release", { max: 2, duration: 60000 })
```

### 12.3 Environment Variables

| Variable                  | Default  | Description                               |
| ------------------------- | -------- | ----------------------------------------- |
| `WORKER_CONCURRENCY`      | 1        | Concurrent jobs (fixed at 1 for releaser) |
| `REDIS_URL`               | Required | Redis connection string                   |
| `DATABASE_URL`            | Required | Main PostgreSQL connection                |
| `REGULATORY_DATABASE_URL` | Required | Regulatory DB connection                  |

### 12.4 Job Options

```typescript
const defaultJobOptions: JobsOptions = {
  attempts: 3, // Retry up to 3 times
  backoff: {
    type: "exponential",
    delay: 10000, // 10s initial delay
  },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 100 },
}
```

### 12.5 Transaction Timeout

```typescript
{
  timeout: 30000,  // 30 seconds for publication transaction
}
```

---

## 13. Known Issues & Limitations

### 13.1 Large Batch Handling

**Issue:** Large batches (>20 rules) may cause transaction timeouts.

**Current Mitigation:** Drainer limits batch size to 20 rules.

**Recommendation:** For large backfills, use multiple smaller batches.

### 13.2 Concurrent Release Safety

**Issue:** Multiple concurrent release workers could cause race conditions.

**Current Mitigation:** Worker concurrency is fixed at 1 (serialized releases).

**Impact:** Lower throughput but guaranteed consistency.

### 13.3 LLM Dependency for Changelog

**Issue:** The releaser calls an LLM agent to generate changelogs.

**Risk:** LLM failures could block releases.

**Mitigation:** The worker validates LLM output and uses calculated version if invalid.

### 13.4 Evidence Chain Verification Performance

**Issue:** Deep provenance verification reads all evidence content.

**Impact:** Large evidence records may slow releases.

**Mitigation:** Evidence content is loaded lazily and in batches.

### 13.5 Rollback Limitations

**Current Limitations:**

1. Can only rollback the most recent release
2. Rollback disconnects rules from release but doesn't delete release record
3. Rules in previous releases remain PUBLISHED

### 13.6 Content Sync Event Ordering

**Issue:** Content sync events are emitted per-rule, not per-release.

**Impact:** Partial MDX updates possible if some events fail.

**Mitigation:** Events are idempotent via deterministic event IDs.

### 13.7 Single Tenant Design

**Current State:** The releaser operates across all tenants (no tenant isolation).

**Consideration:** Multi-tenant releases may be needed for enterprise features.

### 13.8 Embedding Queue Backpressure

**Issue:** Releasing many rules queues many embedding jobs.

**Current State:** Non-blocking, failures logged but don't fail release.

**Monitor:** Watch embedding queue depth after large releases.

---

## Appendix A: Data Models

### A.1 RegulatoryRule (Relevant Fields)

```prisma
model RegulatoryRule {
  id                String           @id
  conceptSlug       String
  riskTier          RiskTier         // T0, T1, T2, T3
  authorityLevel    AuthorityLevel   // LAW, GUIDANCE, PROCEDURE, PRACTICE
  status            RuleStatus       // DRAFT, PENDING_REVIEW, APPROVED, PUBLISHED, REJECTED
  value             String
  valueType         String
  effectiveFrom     DateTime
  effectiveUntil    DateTime?
  approvedBy        String?
  releases          RuleRelease[]
  sourcePointers    SourcePointer[]
  conflictsA        RegulatoryConflict[]
  conflictsB        RegulatoryConflict[]
}
```

### A.2 RuleRelease

```prisma
model RuleRelease {
  id            String   @id
  version       String   @unique  // "1.0.0"
  releaseType   String   // "major" | "minor" | "patch"
  releasedAt    DateTime
  effectiveFrom DateTime
  contentHash   String   // SHA-256 hex
  changelogHr   String?
  changelogEn   String?
  approvedBy    String[] // User IDs
  auditTrail    Json?
  rules         RegulatoryRule[]
}
```

### A.3 SourcePointer (Relevant Fields)

```prisma
model SourcePointer {
  id             String  @id
  evidenceId     String
  exactQuote     String  @db.Text
  confidence     Float
  startOffset    Int?
  endOffset      Int?
  matchType      SourcePointerMatchType?
  rules          RegulatoryRule[]
}
```

### A.4 RegulatoryAuditLog

```prisma
model RegulatoryAuditLog {
  id          String   @id
  action      AuditAction
  entityType  String
  entityId    String
  performedBy String
  performedAt DateTime
  metadata    Json?
}
```

---

## Appendix B: Code References

### B.1 Primary Files

| File                                                                          | Purpose             |
| ----------------------------------------------------------------------------- | ------------------- |
| `/home/admin/FiskAI/src/lib/regulatory-truth/workers/releaser.worker.ts`      | Worker entry point  |
| `/home/admin/FiskAI/src/lib/regulatory-truth/agents/releaser.ts`              | Core release logic  |
| `/home/admin/FiskAI/src/lib/regulatory-truth/services/rule-status-service.ts` | Publication service |
| `/home/admin/FiskAI/src/lib/regulatory-truth/utils/release-hash.ts`           | Content hashing     |
| `/home/admin/FiskAI/src/lib/regulatory-truth/utils/evidence-strength.ts`      | Evidence policy     |

### B.2 Supporting Files

| File                                                                               | Purpose             |
| ---------------------------------------------------------------------------------- | ------------------- |
| `/home/admin/FiskAI/src/lib/regulatory-truth/workers/base.ts`                      | Worker base class   |
| `/home/admin/FiskAI/src/lib/regulatory-truth/workers/queues.ts`                    | Queue definitions   |
| `/home/admin/FiskAI/src/lib/regulatory-truth/workers/metrics.ts`                   | Prometheus metrics  |
| `/home/admin/FiskAI/src/lib/regulatory-truth/workers/continuous-drainer.worker.ts` | Job scheduling      |
| `/home/admin/FiskAI/src/lib/regulatory-truth/schemas/releaser.ts`                  | Zod schemas         |
| `/home/admin/FiskAI/src/lib/regulatory-truth/utils/audit-log.ts`                   | Audit logging       |
| `/home/admin/FiskAI/src/lib/regulatory-truth/graph/knowledge-graph.ts`             | Graph building      |
| `/home/admin/FiskAI/src/lib/regulatory-truth/content-sync/emit-event.ts`           | Content sync events |

### B.3 Configuration Files

| File                                            | Purpose           |
| ----------------------------------------------- | ----------------- |
| `/home/admin/FiskAI/docker-compose.workers.yml` | Docker deployment |
| `/home/admin/FiskAI/prisma/schema.prisma`       | Database schema   |

---

## Document History

| Version | Date       | Author          | Changes                         |
| ------- | ---------- | --------------- | ------------------------------- |
| 1.0.0   | 2026-01-14 | Claude Opus 4.5 | Initial stakeholder-grade audit |

---

_This document was generated as part of a comprehensive audit of the FiskAI Regulatory Truth Layer worker system._
