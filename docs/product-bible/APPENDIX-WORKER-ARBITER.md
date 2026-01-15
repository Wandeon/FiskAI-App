# APPENDIX: Arbiter Worker Audit

> **Document Status:** Stakeholder-Grade Audit
> **Last Updated:** 2026-01-14
> **Audit Scope:** Complete technical and operational documentation of the Arbiter Worker
> **Layer:** B (24/7 Processing)

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
13. [Appendix A: Legal Hierarchy Reference](#appendix-a-legal-hierarchy-reference)
14. [Appendix B: Resolution Strategy Decision Tree](#appendix-b-resolution-strategy-decision-tree)

---

## 1. Overview

### 1.1 Purpose

The Arbiter Worker resolves conflicts between regulatory rules in the FiskAI Regulatory Truth Layer. When multiple rules provide contradictory guidance for the same regulatory question, the Arbiter determines which rule should prevail based on:

- Croatian legal hierarchy principles
- Temporal precedence (lex posterior)
- Specificity rules (lex specialis)
- Source authority levels

### 1.2 Role in Layer B (Processing)

```
Layer A: Daily Discovery              Layer B: 24/7 Processing
+-----------------+                   +-------------------+
|    Sentinel     | ----------------> |     Extractor     |
+-----------------+                   +-------------------+
                                              |
                                              v
                                      +-------------------+
                                      |     Composer      |
                                      +-------------------+
                                              |
                                              v
                                      +-------------------+
                                      |     Reviewer      |
                                      +-------------------+
                                              |
                                              v
                                      +-------------------+
                                      |   **ARBITER**     | <-- CONFLICT RESOLUTION
                                      +-------------------+
                                              |
                                              v
                                      +-------------------+
                                      |     Releaser      |
                                      +-------------------+
```

The Arbiter sits between the Reviewer and Releaser stages. It is triggered when:

- The Composer detects conflicting source pointers
- The Reviewer identifies conflicting rules
- The continuous-drainer finds OPEN conflicts in the database

### 1.3 Types of Conflicts Handled

| Conflict Type             | Description                                 | Resolution Approach                     |
| ------------------------- | ------------------------------------------- | --------------------------------------- |
| `SOURCE_CONFLICT`         | Two official sources state different values | Escalate to human review                |
| `TEMPORAL_CONFLICT`       | Unclear which rule applies at what time     | Apply lex posterior (newer wins)        |
| `SCOPE_CONFLICT`          | Overlapping AppliesWhen conditions          | Apply lex specialis (specific wins)     |
| `INTERPRETATION_CONFLICT` | Ambiguous source language                   | Conservative interpretation or escalate |

---

## 2. Technical Implementation

### 2.1 Entry Point

**File:** `/src/lib/regulatory-truth/workers/arbiter.worker.ts`

```typescript
interface ArbiterJobData {
  conflictId: string
  runId: string
  parentJobId?: string
}

async function processArbiterJob(job: Job<ArbiterJobData>): Promise<JobResult> {
  const { conflictId } = job.data
  const result = await llmLimiter.schedule(() => runArbiter(conflictId))
  return {
    success: result.success,
    duration,
    data: { resolution: result.resolution },
  }
}
```

### 2.2 Worker Configuration

| Parameter         | Value             | Purpose                                                       |
| ----------------- | ----------------- | ------------------------------------------------------------- |
| Queue Name        | `arbiter`         | BullMQ queue identifier                                       |
| Concurrency       | 1                 | Single job at a time (conflict resolution is order-sensitive) |
| Lock Duration     | 360,000ms (6 min) | Exceeds 5-minute agent timeout                                |
| Stalled Interval  | 60,000ms (1 min)  | Check for stalled jobs                                        |
| Max Stalled Count | 2                 | Auto-retry limit for stalled jobs                             |

### 2.3 Conflict Detection Flow

```
+------------------------+
|  RegulatoryConflict    |
|  status = "OPEN"       |
+------------------------+
          |
          v
+------------------------+
|  runArbiter(conflictId)|
+------------------------+
          |
          +---> SOURCE_CONFLICT? ---> handleSourceConflict() ---> ESCALATE
          |
          v
+------------------------+
|  Fetch itemA & itemB   |
|  (RegulatoryRule)      |
+------------------------+
          |
          v
+------------------------+
|  Build ConflictingItem |
|  claims with context   |
+------------------------+
          |
          v
+------------------------+
|  Run LLM Arbitration   |
|  (ARBITER agent)       |
+------------------------+
          |
          v
+------------------------+
|  Apply Escalation      |
|  Business Rules        |
+------------------------+
          |
          +---> Escalate? ---> Update to ESCALATED ---> requestConflictReview()
          |
          v
+------------------------+
|  Update Conflict       |
|  status = "RESOLVED"   |
+------------------------+
          |
          v
+------------------------+
|  Deprecate Losing Rule |
+------------------------+
```

### 2.4 Resolution Strategies

The Arbiter uses four primary resolution strategies:

#### 2.4.1 Hierarchy Strategy

Uses the Croatian legal hierarchy to determine precedence:

```typescript
function getAuthorityScore(level: AuthorityLevel): number {
  switch (level) {
    case "LAW":
      return 1 // Highest authority
    case "GUIDANCE":
      return 2
    case "PROCEDURE":
      return 3
    case "PRACTICE":
      return 4 // Lowest authority
    default:
      return 999
  }
}
```

**Rule:** Lower score wins. A LAW (score 1) always prevails over GUIDANCE (score 2).

#### 2.4.2 Temporal Strategy (Lex Posterior)

When authority levels are equal, the newer rule wins:

```typescript
function applyLexPosterior(ruleA, ruleB) {
  if (ruleA.effectiveFrom > ruleB.effectiveFrom) {
    return { winningRuleId: ruleA.id }
  } else if (ruleB.effectiveFrom > ruleA.effectiveFrom) {
    return { winningRuleId: ruleB.id }
  } else {
    // Same effective date - use deterministic ID ordering
    return { winningRuleId: ruleA.id < ruleB.id ? ruleA.id : ruleB.id }
  }
}
```

#### 2.4.3 Specificity Strategy (Lex Specialis)

More specific rules override general rules. This is tracked via `OVERRIDES` graph edges:

```typescript
async function resolveRulePrecedence(ruleIds: string[]) {
  // Step 1: Check OVERRIDES edges
  for (const rule of rules) {
    const overridingRuleIds = await findOverridingRules(rule.id)
    const hasActiveOverride = overridingRuleIds.some((id) => ruleIds.includes(id))

    if (!hasActiveOverride) {
      for (const otherId of ruleIds) {
        if (await doesOverride(rule.id, otherId)) {
          return {
            winningRuleId: rule.id,
            reasoning: `Lex specialis: Rule ${rule.conceptSlug} overrides general rule(s)`,
          }
        }
      }
    }
  }

  // Step 2: Fall back to authority level
  // Step 3: Fall back to recency
}
```

#### 2.4.4 Conservative Strategy

When resolution is uncertain, choose the stricter interpretation to protect the taxpayer from penalties.

### 2.5 Source Hierarchy Comparison

When authority levels are equal, the Arbiter compares source document hierarchy:

| Hierarchy Level | Name                         | Example                  |
| --------------- | ---------------------------- | ------------------------ |
| 1               | Ustav (Constitution)         | Ustav Republike Hrvatske |
| 2               | Zakon (Law)                  | Zakon o PDV-u            |
| 3               | Podzakonski akt (Regulation) | Government regulations   |
| 4               | Pravilnik (Ordinance)        | Ministry rules           |
| 5               | Uputa (Instruction)          | Porezna uprava guidance  |
| 6               | Misljenje (Opinion)          | Official interpretations |
| 7               | Praksa (Practice)            | Established practice     |

```typescript
async function compareSourceHierarchy(ruleA, ruleB, evidenceMap) {
  const sourceA = getHighestAuthoritySource(ruleA, evidenceMap)
  const sourceB = getHighestAuthoritySource(ruleB, evidenceMap)

  if (sourceA.hierarchy < sourceB.hierarchy) {
    return { winningRuleId: ruleA.id }
  } else if (sourceB.hierarchy < sourceA.hierarchy) {
    return { winningRuleId: ruleB.id }
  }

  return { winningRuleId: null, reason: "Equal source hierarchy" }
}
```

### 2.6 LLM-Assisted Arbitration

The Arbiter uses an LLM agent for complex conflict resolution:

**Prompt Template:** `/src/lib/regulatory-truth/prompts/index.ts` (ARBITER_PROMPT)

```
ROLE: You are the Arbiter Agent. You resolve conflicts in the regulatory
knowledge base using the Croatian legal hierarchy.

INPUT: Conflict report with conflicting sources/rules.

LEGAL HIERARCHY (highest to lowest):
1. Ustav RH (Constitution)
2. Zakon (Parliamentary law - Narodne novine)
3. Podzakonski akt (Government regulations)
4. Pravilnik (Ministry rules)
5. Uputa (Tax authority guidance - Porezna uprava)
6. Misljenje (Official interpretations)
7. Praksa (Established practice)

RESOLUTION STRATEGIES:
1. Hierarchy: Higher authority source wins
2. Temporal: Later effective date wins (lex posterior)
3. Specificity: More specific rule wins (lex specialis)
4. Conservative: When uncertain, choose stricter interpretation
```

**Agent Configuration:**

| Parameter   | Value                     |
| ----------- | ------------------------- |
| Temperature | 0.1 (low for determinism) |
| Max Retries | 3                         |
| Timeout     | 120,000ms (2 minutes)     |

---

## 3. Inputs

### 3.1 Job Payload Schema

```typescript
interface ArbiterJobData {
  conflictId: string // Required: UUID of RegulatoryConflict record
  runId: string // Required: Pipeline run identifier for correlation
  parentJobId?: string // Optional: Parent job for hierarchical tracking
}
```

### 3.2 Conflicting Rules Data

For each conflict, the Arbiter fetches:

```typescript
// From RegulatoryConflict table
interface Conflict {
  id: string
  conflictType:
    | "SOURCE_CONFLICT"
    | "TEMPORAL_CONFLICT"
    | "SCOPE_CONFLICT"
    | "INTERPRETATION_CONFLICT"
  itemAId: string | null // Rule A ID
  itemBId: string | null // Rule B ID
  description: string
  metadata: JsonValue // Additional context
}

// From RegulatoryRule table (for each rule)
interface RuleData {
  id: string
  titleHr: string
  titleEn: string | null
  value: string
  valueType: string
  authorityLevel: "LAW" | "GUIDANCE" | "PROCEDURE" | "PRACTICE"
  effectiveFrom: Date
  effectiveUntil: Date | null
  appliesWhen: string // DSL predicate
  explanationHr: string | null
  riskTier: "T0" | "T1" | "T2" | "T3"
  confidence: number
  sourcePointers: SourcePointer[]
}
```

### 3.3 Evidence Context

The Arbiter builds rich context for LLM arbitration:

```typescript
function buildConflictingItemClaim(rule, evidenceMap): string {
  return `
Rule: ${rule.titleHr} (${rule.titleEn || "N/A"})
Value: ${rule.value} (${rule.valueType})
Authority Level: ${rule.authorityLevel}
Effective: ${rule.effectiveFrom} to ${rule.effectiveUntil || "indefinite"}
Applies When: ${rule.appliesWhen}
Explanation: ${rule.explanationHr || "N/A"}
Source Evidence: ${sources}
  `
}
```

### 3.4 Agent Input Schema

```typescript
const ArbiterInputSchema = z.object({
  conflictId: z.string(),
  conflictType: ConflictTypeSchema, // SOURCE_CONFLICT | TEMPORAL_CONFLICT | etc.
  conflictingItems: z
    .array(
      z.object({
        item_id: z.string(),
        item_type: z.enum(["source", "rule"]),
        claim: z.string(), // Rich context built from rule data
      })
    )
    .min(2),
})
```

---

## 4. Outputs

### 4.1 Resolution Decision

The Arbiter produces one of four resolution outcomes:

| Resolution          | Description                  | Action Taken                |
| ------------------- | ---------------------------- | --------------------------- |
| `RULE_A_PREVAILS`   | Rule A wins the conflict     | Rule B marked as DEPRECATED |
| `RULE_B_PREVAILS`   | Rule B wins the conflict     | Rule A marked as DEPRECATED |
| `MERGE_RULES`       | Rules should be combined     | Currently unused            |
| `ESCALATE_TO_HUMAN` | Cannot resolve automatically | Conflict marked ESCALATED   |

### 4.2 Agent Output Schema

```typescript
const ArbiterOutputSchema = z.object({
  arbitration: z.object({
    conflict_id: z.string(),
    conflict_type: ConflictTypeSchema,
    conflicting_items: z.array(ConflictingItemSchema),
    resolution: z.object({
      winning_item_id: z.string(),
      resolution_strategy: z.enum(["hierarchy", "temporal", "specificity", "conservative"]),
      rationale_hr: z.string(), // Croatian explanation
      rationale_en: z.string(), // English explanation
    }),
    confidence: z.number().min(0).max(1),
    requires_human_review: z.boolean(),
    human_review_reason: z.string().nullable(),
  }),
})
```

### 4.3 Database Updates

#### RegulatoryConflict Update

```typescript
// On successful resolution
await db.regulatoryConflict.update({
  where: { id: conflict.id },
  data: {
    status: "RESOLVED", // or "ESCALATED" if escalating
    resolution: {
      winningItemId: arbitration.resolution.winning_item_id,
      strategy: arbitration.resolution.resolution_strategy,
      rationaleHr: arbitration.resolution.rationale_hr,
      rationaleEn: arbitration.resolution.rationale_en,
      resolution,
    },
    confidence: arbitration.confidence,
    requiresHumanReview: arbitration.requires_human_review,
    humanReviewReason: arbitration.human_review_reason,
    resolvedAt: new Date(),
  },
})
```

#### Losing Rule Deprecation

```typescript
// When Rule A prevails, Rule B is deprecated
await db.regulatoryRule.update({
  where: { id: itemB.id },
  data: {
    status: "DEPRECATED",
    reviewerNotes: JSON.stringify({
      deprecated_reason: "Conflict resolution - Rule A prevails",
      conflict_id: conflict.id,
      superseded_by: itemA.id,
      arbiter_rationale: arbitration.resolution.rationale_hr,
    }),
  },
})
```

### 4.4 ConflictResolutionAudit Records

Each resolution creates an audit record:

```sql
CREATE TABLE "ConflictResolutionAudit" (
    "id" TEXT NOT NULL,
    "conflictId" TEXT NOT NULL,
    "ruleAId" TEXT,
    "ruleBId" TEXT,
    "resolution" TEXT NOT NULL,      -- RULE_A_PREVAILS, etc.
    "reason" TEXT NOT NULL,          -- Human-readable explanation
    "resolvedBy" TEXT NOT NULL,      -- "ARBITER_AGENT"
    "resolvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,                -- Additional context

    CONSTRAINT "ConflictResolutionAudit_pkey" PRIMARY KEY ("id")
);
```

**Metadata Structure:**

```typescript
interface AuditMetadata {
  authorityComparison?: {
    scoreA: number
    scoreB: number
  }
  sourceComparison?: {
    sourceAHierarchy: number | null
    sourceBHierarchy: number | null
    sourceAName: string | null
    sourceBName: string | null
  }
  temporalAnalysis?: {
    effectiveFromA: string
    effectiveFromB: string
  }
  aiArbitration?: {
    strategy: string
    confidence: number
    rationaleHr: string
    rationaleEn: string
  }
}
```

### 4.5 Worker Job Result

```typescript
interface JobResult {
  success: boolean
  duration: number // Execution time in ms
  data?: {
    resolution: "RULE_A_PREVAILS" | "RULE_B_PREVAILS" | "MERGE_RULES" | "ESCALATE_TO_HUMAN" | null
  }
  error?: string
}
```

---

## 5. Dependencies

### 5.1 Database Dependencies

| Database           | Tables Used             | Purpose                                  |
| ------------------ | ----------------------- | ---------------------------------------- |
| Main (db)          | RegulatoryConflict      | Read conflicts, update status            |
| Main (db)          | RegulatoryRule          | Read conflicting rules, deprecate losers |
| Main (db)          | SourcePointer           | Get evidence citations                   |
| Main (db)          | GraphEdge               | Check OVERRIDES relationships            |
| Main (db)          | HumanReviewQueue        | Create review requests                   |
| Main (db)          | RegulatorAuditLog       | Write audit trail                        |
| Regulatory (dbReg) | Evidence                | Get source documents                     |
| Regulatory (dbReg) | Source                  | Get source hierarchy                     |
| Regulatory (dbReg) | ConflictResolutionAudit | Write resolution records                 |

### 5.2 Service Dependencies

| Service                 | Purpose                 | Failure Impact           |
| ----------------------- | ----------------------- | ------------------------ |
| Redis                   | BullMQ job queue        | Worker cannot start      |
| PostgreSQL (Main)       | Rule and conflict data  | Job fails                |
| PostgreSQL (Regulatory) | Evidence and audit data | Job fails                |
| Ollama LLM              | AI arbitration          | Falls back to escalation |

### 5.3 Internal Module Dependencies

```
arbiter.worker.ts
    |
    +---> runArbiter() from agents/arbiter.ts
    |         |
    |         +---> runAgent() from agents/runner.ts
    |         +---> logAuditEvent() from utils/audit-log.ts
    |         +---> requestConflictReview() from services/human-review-service.ts
    |         +---> findOverridingRules() from taxonomy/precedence-builder.ts
    |         +---> doesOverride() from taxonomy/precedence-builder.ts
    |
    +---> llmLimiter from workers/rate-limiter.ts
    +---> createWorker() from workers/base.ts
    +---> jobsProcessed, jobDuration from workers/metrics.ts
```

### 5.4 Precedence Rules (Taxonomy)

**File:** `/src/lib/regulatory-truth/taxonomy/precedence-builder.ts`

The precedence system maintains OVERRIDES edges in the GraphEdge table:

```typescript
// OVERRIDES edge: specific rule -> general rule
// When specific rule is present, it takes precedence

interface PrecedenceEdge {
  fromRuleId: string // The specific rule (winner)
  toRuleId: string // The general rule (overridden)
  notes: string // Explanation from ClaimException
}
```

**Functions:**

| Function                         | Purpose                                                 |
| -------------------------------- | ------------------------------------------------------- |
| `buildOverridesEdges()`          | Create OVERRIDES edges from ClaimException records      |
| `findOverridingRules(ruleId)`    | Find all rules that override a given rule               |
| `findOverriddenRules(ruleId)`    | Find all rules that a given rule overrides              |
| `doesOverride(ruleAId, ruleBId)` | Check if rule A overrides rule B (direct or transitive) |

---

## 6. Prerequisites

### 6.1 Conflict Must Exist

A conflict record must exist in the database with status `OPEN`:

```sql
SELECT * FROM "RegulatoryConflict"
WHERE status = 'OPEN'
  AND id = :conflictId;
```

### 6.2 Rules Must Be Reviewed

For rule conflicts (`itemAId` and `itemBId` are set), both rules should have:

- Valid `authorityLevel`
- Valid `effectiveFrom` date
- Linked `sourcePointers` with evidence

### 6.3 Evidence Must Be Available

For SOURCE_CONFLICT types, the `metadata.sourcePointerIds` must reference existing records:

```typescript
// Validate source pointers exist
const sourcePointers = await db.sourcePointer.findMany({
  where: { id: { in: metadata.sourcePointerIds } },
})

if (sourcePointers.length < 2) {
  // Not enough pointers for a conflict - auto-resolve
}
```

### 6.4 LLM Service Available

The Arbiter requires Ollama for AI-assisted arbitration:

```typescript
// Environment variables required
OLLAMA_ENDPOINT=http://...
OLLAMA_API_KEY=...
OLLAMA_MODEL=...
```

---

## 7. Triggers

### 7.1 Continuous-Drainer Queue

**File:** `/src/lib/regulatory-truth/workers/continuous-drainer.worker.ts`

The continuous-drainer periodically scans for OPEN conflicts:

```typescript
async function drainConflicts(): Promise<number> {
  const conflicts = await db.regulatoryConflict.findMany({
    where: { status: "OPEN" },
    select: { id: true },
    take: 10, // Batch size
  })

  if (conflicts.length === 0) return 0

  const runId = `drain-${Date.now()}`
  for (const c of conflicts) {
    await arbiterQueue.add("arbiter", { conflictId: c.id, runId }, { jobId: `arbiter-${c.id}` })
  }

  return conflicts.length
}
```

**Drain Cycle Stage:** Stage 5 (after draft rule review)

### 7.2 Composer Conflict Detection

When the Composer detects conflicting source pointers during rule composition, it creates a RegulatoryConflict record with status `OPEN`, which will be picked up by the drainer.

### 7.3 Reviewer Conflict Detection

When the Reviewer identifies that a new rule conflicts with an existing active rule, it creates a conflict record for arbitration.

### 7.4 Manual Queue Addition

For debugging or manual intervention:

```typescript
// Using BullMQ directly
await arbiterQueue.add("arbiter", {
  conflictId: "conflict-uuid",
  runId: `manual-${Date.now()}`,
})
```

---

## 8. Error Handling

### 8.1 Unresolvable Conflicts

When the Arbiter cannot determine a winner:

1. **Low Confidence:** If LLM confidence < 0.8, escalate
2. **Equal Authority:** If both rules have same authority level and same effective date
3. **Complex Reasoning:** If the conflict requires domain expertise

```typescript
if (arbitration.confidence < 0.8) {
  resolution = "ESCALATE_TO_HUMAN"
}
```

### 8.2 Human Escalation

The Arbiter integrates with the centralized Human Review Service:

```typescript
// Escalation triggers
if (resolution === "ESCALATE_TO_HUMAN") {
  const escalationReason =
    ruleATier === "T0" && ruleBTier === "T0"
      ? "both_t0"
      : arbitration.confidence < 0.8
        ? "low_confidence"
        : "equal_authority"

  await requestConflictReview(conflict.id, {
    conflictType: conflict.conflictType,
    ruleATier: itemA.riskTier,
    ruleBTier: itemB.riskTier,
    confidence: arbitration.confidence,
    escalationReason,
  })
}
```

**Human Review SLA by Reason:**

| Reason                     | Priority | SLA      |
| -------------------------- | -------- | -------- |
| `CONFLICT_BOTH_T0`         | CRITICAL | 4 hours  |
| `CONFLICT_UNRESOLVABLE`    | HIGH     | 24 hours |
| `CONFLICT_EQUAL_AUTHORITY` | HIGH     | 24 hours |
| `ARBITER_LOW_CONFIDENCE`   | HIGH     | 24 hours |
| `SOURCE_CONFLICT`          | HIGH     | 24 hours |

### 8.3 Audit Logging

Every resolution (successful or escalated) is logged:

```typescript
await logAuditEvent({
  action: "CONFLICT_RESOLVED", // or "CONFLICT_ESCALATED"
  entityType: "CONFLICT",
  entityId: conflictId,
  metadata: {
    resolution,
    strategy: arbitration.resolution.resolution_strategy,
    confidence: arbitration.confidence,
  },
})
```

### 8.4 Soft-Fail Wrapper

Batch processing uses soft-fail to prevent single failures from blocking:

```typescript
const softFailResult = await withSoftFail(() => runArbiter(conflict.id), null, {
  operation: "arbiter_batch",
  entityType: "rule",
  metadata: {
    conflictId: conflict.id,
    conflictType: conflict.conflictType,
  },
})

if (!softFailResult.success) {
  results.failed++
  results.errors.push(`${conflict.id}: ${softFailResult.error}`)
}
```

### 8.5 Dead Letter Queue

Jobs that fail after all retries are moved to the DLQ:

```typescript
worker.on("failed", (job, err) => {
  if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
    void moveToDeadLetterQueue(job, err, queueName, options.name)
  }
})
```

---

## 9. Guardrails & Safety

### 9.1 Escalation Criteria (Business Rules)

The Arbiter enforces mandatory escalation for high-risk scenarios:

```typescript
function checkEscalationCriteria(ruleA, ruleB, arbitration): boolean {
  // Escalate if low confidence
  if (arbitration.confidence < 0.8) return true

  // Escalate if both rules are T0 (critical)
  if (ruleA.riskTier === "T0" && ruleB.riskTier === "T0") return true

  // Escalate if authority levels are equal with hierarchy strategy
  const scoreA = getAuthorityScore(ruleA.authorityLevel)
  const scoreB = getAuthorityScore(ruleB.authorityLevel)
  if (scoreA === scoreB && arbitration.resolution.resolution_strategy === "hierarchy") {
    return true
  }

  // Escalate if effective dates are same with temporal strategy
  if (
    ruleA.effectiveFrom.getTime() === ruleB.effectiveFrom.getTime() &&
    arbitration.resolution.resolution_strategy === "temporal"
  ) {
    return true
  }

  // Escalate if either rule has low confidence
  if (ruleA.confidence < 0.85 || ruleB.confidence < 0.85) return true

  return false
}
```

### 9.2 Audit Trail

Every conflict resolution creates immutable audit records:

1. **RegulatoryAuditLog:** Action-level logging
2. **ConflictResolutionAudit:** Detailed resolution record with metadata
3. **Rule.reviewerNotes:** Deprecation reason stored on losing rule

### 9.3 Rollback Capability

Conflict resolutions can be reversed by:

1. Restoring the deprecated rule's status
2. Reopening the conflict record
3. Triggering re-arbitration

```sql
-- Example rollback
UPDATE "RegulatoryRule"
SET status = 'APPROVED', "reviewerNotes" = NULL
WHERE id = :deprecatedRuleId;

UPDATE "RegulatoryConflict"
SET status = 'OPEN', resolution = NULL, "resolvedAt" = NULL
WHERE id = :conflictId;
```

### 9.4 Human Review for Complex Conflicts

The following always require human review:

| Scenario                      | Reason                          |
| ----------------------------- | ------------------------------- |
| Both rules are T0             | Critical financial/legal impact |
| Constitutional questions      | Requires legal expertise        |
| Equal hierarchy sources       | Cannot determine precedence     |
| Novel conflict patterns       | No established resolution path  |
| Financial impact > 10,000 EUR | High-stakes decision            |

### 9.5 Cycle Prevention

The precedence graph (OVERRIDES edges) is protected against cycles:

```typescript
// Before creating OVERRIDES edge
const wouldCycle = await wouldCreateCycle(fromId, toId, "OVERRIDES")
if (wouldCycle) {
  throw new CycleDetectedError(fromId, toId, "OVERRIDES")
}
```

### 9.6 Rate Limiting

LLM calls are rate-limited to prevent API overload:

```typescript
const llmLimiter = new Bottleneck({
  reservoir: 5, // 5 concurrent calls
  reservoirRefreshAmount: 5,
  reservoirRefreshInterval: 60000, // Refill every minute
  maxConcurrent: 5,
  minTime: 1000, // Min 1s between calls
})

// In worker
const result = await llmLimiter.schedule(() => runArbiter(conflictId))
```

---

## 10. Monitoring & Observability

### 10.1 Prometheus Metrics

**File:** `/src/lib/regulatory-truth/workers/metrics.ts`

| Metric                         | Type      | Labels                | Description               |
| ------------------------------ | --------- | --------------------- | ------------------------- |
| `worker_jobs_processed_total`  | Counter   | worker, status, queue | Total jobs processed      |
| `worker_job_duration_seconds`  | Histogram | worker, queue         | Job processing duration   |
| `worker_queue_depth`           | Gauge     | queue                 | Jobs waiting in queue     |
| `worker_active_jobs`           | Gauge     | worker                | Jobs currently processing |
| `worker_llm_calls_total`       | Counter   | worker, status        | Total LLM API calls       |
| `worker_rate_limit_hits_total` | Counter   | worker, domain        | Rate limit hits           |

**Arbiter-Specific Labels:**

```typescript
jobsProcessed.inc({ worker: "arbiter", status: "success", queue: "arbiter" })
jobDuration.observe({ worker: "arbiter", queue: "arbiter" }, duration / 1000)
```

### 10.2 Key Performance Indicators

| KPI                     | Target              | Alert Threshold                |
| ----------------------- | ------------------- | ------------------------------ |
| Resolution rate         | > 80% auto-resolved | < 60% triggers review          |
| Escalation rate         | < 20%               | > 40% triggers investigation   |
| Average resolution time | < 2 minutes         | > 5 minutes triggers alert     |
| DLQ depth               | 0                   | > 10 triggers immediate action |

### 10.3 Resolution Type Distribution

Track via ConflictResolutionAudit:

```sql
SELECT
  resolution,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt"))) as avg_seconds
FROM "ConflictResolutionAudit"
WHERE "resolvedAt" > NOW() - INTERVAL '7 days'
GROUP BY resolution;
```

### 10.4 Human Review Backlog

Monitor via HumanReviewQueue:

```typescript
const stats = await humanReviewService.getBacklogStats()
// Returns:
// {
//   total: number,
//   byPriority: { CRITICAL: 0, HIGH: 0, NORMAL: 0, LOW: 0 },
//   byReason: { CONFLICT_BOTH_T0: 0, ... },
//   slaBreaches: number,
//   avgResolutionHours: number | null
// }
```

### 10.5 Continuous-Drainer Stage Heartbeat

The arbiter stage is tracked by the continuous-drainer:

```typescript
await updateStageHeartbeat({
  stage: "conflicts",
  lastActivity: new Date().toISOString(),
  itemsProcessed: stageMetrics["conflicts"].itemsProcessed,
  avgDurationMs: Math.round(avgDuration),
})
```

---

## 11. Configuration

### 11.1 Docker Compose Configuration

**File:** `/docker-compose.workers.yml`

```yaml
worker-arbiter:
  <<: *worker-common
  container_name: fiskai-worker-arbiter
  command: ["node", "dist/workers/lib/regulatory-truth/workers/arbiter.worker.js"]
  environment:
    <<: *worker-env
    OLLAMA_ENDPOINT: ${OLLAMA_ENDPOINT}
    OLLAMA_API_KEY: ${OLLAMA_API_KEY}
    OLLAMA_MODEL: ${OLLAMA_MODEL}
    WORKER_TYPE: arbiter
    WORKER_CONCURRENCY: 1
  deploy:
    resources:
      limits:
        memory: 512M
```

### 11.2 Environment Variables

| Variable                  | Required | Default | Description                 |
| ------------------------- | -------- | ------- | --------------------------- |
| `REDIS_URL`               | Yes      | -       | Redis connection for BullMQ |
| `DATABASE_URL`            | Yes      | -       | Main PostgreSQL database    |
| `REGULATORY_DATABASE_URL` | Yes      | -       | Regulatory database         |
| `OLLAMA_ENDPOINT`         | Yes      | -       | LLM API endpoint            |
| `OLLAMA_API_KEY`          | Yes      | -       | LLM API key                 |
| `OLLAMA_MODEL`            | Yes      | -       | LLM model name              |
| `WORKER_CONCURRENCY`      | No       | 1       | Jobs processed concurrently |
| `ARBITER_TIMEOUT_MS`      | No       | 120000  | Agent timeout override      |

### 11.3 Precedence Rules Configuration

Precedence rules are built from database records, not configuration files:

1. **ClaimException:** Defines when specific rules override general rules
2. **GraphEdge:** Stores OVERRIDES relationships
3. **Source.hierarchy:** Defines source authority levels (1-7)

### 11.4 Resolution Strategy Weights

Currently hardcoded in the agent logic:

```typescript
// Resolution order (first match wins):
// 1. OVERRIDES edges (lex specialis)
// 2. Authority level comparison
// 3. Effective date comparison (lex posterior)
// 4. Deterministic ID ordering (tie-breaker)
```

### 11.5 LLM Settings

```typescript
// In agents/runner.ts
const AGENT_TIMEOUTS = {
  ARBITER: 120000, // 2 minutes
}

// In agent call
const result = await runAgent({
  agentType: "ARBITER",
  temperature: 0.1, // Low for determinism
  maxRetries: 3,
})
```

---

## 12. Known Issues & Limitations

### 12.1 Complex Conflict Scenarios

**Issue:** Multi-rule conflicts (3+ rules in conflict) are not fully supported.

**Current Behavior:** The system handles pairwise conflicts. Multi-rule scenarios may require multiple arbitration rounds.

**Workaround:** Create separate conflict records for each pair.

### 12.2 Precedence Edge Cases

**Issue:** Equal hierarchy with equal effective dates falls back to deterministic ID ordering, which may not reflect true precedence.

**Current Behavior:** Uses alphabetically first rule ID as winner.

**Impact:** May require human review to confirm correct resolution.

### 12.3 SOURCE_CONFLICT Always Escalates

**Issue:** SOURCE_CONFLICT types (conflicting values in source data) always escalate to human review.

**Rationale:** Source conflicts indicate potential data quality issues that require human judgment.

**Future Enhancement:** Add automated resolution for certain SOURCE_CONFLICT patterns.

### 12.4 No Merge Support

**Issue:** `MERGE_RULES` resolution is defined but not implemented.

**Current Behavior:** Conflicts are resolved by picking a winner, not merging rule content.

**Impact:** Some scenarios might benefit from combining rule attributes rather than deprecating one.

### 12.5 Cross-Database Transaction Limitations

**Issue:** Updates span two databases (main and regulatory), preventing atomic transactions.

**Current Behavior:** Operations are performed sequentially with soft-fail handling.

**Risk:** Partial failures could leave inconsistent state.

**Mitigation:** Audit logging and human review for anomalies.

### 12.6 LLM Hallucination Risk

**Issue:** LLM may suggest resolutions not based on actual rule content.

**Mitigations:**

1. Low temperature (0.1) for deterministic output
2. Structured output validation via Zod schema
3. Mandatory escalation for low confidence
4. Human review for T0/T1 rules

### 12.7 Batch Processing Memory

**Issue:** `runArbiterBatch()` loads all conflicts into memory before processing.

**Current Behavior:** Limited to 10 conflicts per batch.

**Impact:** Large backlogs may take many cycles to clear.

---

## Appendix A: Legal Hierarchy Reference

### Croatian Legal Hierarchy (Normativna hijerarhija)

```
+---------------------------+
|     USTAV RH (1)          |  Constitution of Croatia
+---------------------------+
            |
            v
+---------------------------+
|     ZAKON (2)             |  Parliamentary laws (Narodne novine)
+---------------------------+
            |
            v
+---------------------------+
|  PODZAKONSKI AKT (3)      |  Government regulations, decrees
+---------------------------+
            |
            v
+---------------------------+
|    PRAVILNIK (4)          |  Ministry rules, ordinances
+---------------------------+
            |
            v
+---------------------------+
|      UPUTA (5)            |  Tax authority instructions
+---------------------------+
            |
            v
+---------------------------+
|    MISLJENJE (6)          |  Official interpretations, opinions
+---------------------------+
            |
            v
+---------------------------+
|     PRAKSA (7)            |  Established practice
+---------------------------+
```

### Authority Level Mapping

| AuthorityLevel Enum | Typical Sources        | Hierarchy Range |
| ------------------- | ---------------------- | --------------- |
| LAW                 | Zakon, Podzakonski akt | 2-3             |
| GUIDANCE            | Pravilnik, Uputa       | 4-5             |
| PROCEDURE           | Uputa, Misljenje       | 5-6             |
| PRACTICE            | Misljenje, Praksa      | 6-7             |

---

## Appendix B: Resolution Strategy Decision Tree

```
                    START
                      |
                      v
              +---------------+
              | Load Conflict |
              +---------------+
                      |
                      v
              +---------------+
              | SOURCE_CONFLICT?|
              +---------------+
                   |      |
                  Yes     No
                   |      |
                   v      v
            +---------+  +------------------+
            |ESCALATE |  | Load Rules A & B |
            +---------+  +------------------+
                                  |
                                  v
                      +---------------------+
                      | Check OVERRIDES     |
                      | edges in graph      |
                      +---------------------+
                           |           |
                        Found       Not Found
                           |           |
                           v           v
                    +----------+  +-----------------------+
                    | WINNER:  |  | Compare Authority     |
                    | Override |  | Levels                |
                    +----------+  +-----------------------+
                                       |            |
                                    Different    Same
                                       |            |
                                       v            v
                               +----------+  +-----------------------+
                               | WINNER:  |  | Compare Source        |
                               | Higher   |  | Hierarchy             |
                               | Authority|  +-----------------------+
                               +----------+       |            |
                                              Different      Same
                                                  |            |
                                                  v            v
                                          +----------+  +-----------------------+
                                          | WINNER:  |  | Compare Effective     |
                                          | Higher   |  | Dates (lex posterior) |
                                          | Hierarchy|  +-----------------------+
                                          +----------+       |            |
                                                         Different      Same
                                                             |            |
                                                             v            v
                                                     +----------+  +-----------+
                                                     | WINNER:  |  | ESCALATE  |
                                                     | Newer    |  | (or ID    |
                                                     | Rule     |  | ordering) |
                                                     +----------+  +-----------+
```

---

## Document History

| Version | Date       | Author          | Changes                         |
| ------- | ---------- | --------------- | ------------------------------- |
| 1.0     | 2026-01-14 | Claude Opus 4.5 | Initial stakeholder-grade audit |

---

_This document is part of the FiskAI Product Bible. For related documentation, see:_

- _[08-APPENDIXES.md](./08-APPENDIXES.md) - Worker overview_
- _[01-VISION-ARCHITECTURE.md](./01-VISION-ARCHITECTURE.md) - Regulatory Truth Layer architecture_
- _[03-LEGAL-COMPLIANCE.md](./03-LEGAL-COMPLIANCE.md) - Legal compliance requirements_
