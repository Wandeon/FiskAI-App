# APPENDIX: Composer Worker Audit

**Worker:** `composer`
**Container:** `fiskai-worker-composer`
**Source:** `/src/lib/regulatory-truth/workers/composer.worker.ts`
**Agent:** `/src/lib/regulatory-truth/agents/composer.ts`
**Layer:** B (Processing) - 24/7 Continuous Operations
**Last Audit:** 2026-01-14
**Version:** PHASE-D Architecture

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
13. [Data Flow Diagrams](#13-data-flow-diagrams)
14. [Schema Reference](#14-schema-reference)
15. [Taxonomy and Domain Classification](#15-taxonomy-and-domain-classification)

---

## 1. Overview

### 1.1 Purpose

The **Composer Worker** transforms extracted regulatory facts into structured regulatory rules. It is the central intelligence layer that:

1. **Aggregates Facts**: Groups related CandidateFacts by domain and value type
2. **Generates Rules**: Uses LLM to compose human-readable regulatory rules with structured metadata
3. **Validates Applicability**: Generates DSL expressions defining when rules apply
4. **Detects Conflicts**: Identifies contradictory facts requiring Arbiter resolution
5. **Maintains Traceability**: Links every rule back to its source evidence

### 1.2 Role in Layer B (Processing)

```
Layer A (Discovery)           Layer B (Processing - 24/7)
+------------------+     +--------------------------------------------+
|    Sentinel      | --> |  OCR --> Extractor --> COMPOSER --> Apply |
|    (Daily)       |     |                          |                 |
+------------------+     |                          v                 |
                         |              Reviewer --> Arbiter          |
                         |                          |                 |
                         |                          v                 |
                         |                      Releaser              |
                         +--------------------------------------------+
```

The Composer sits at the critical junction between raw extraction and rule creation:

- **Upstream**: Receives CandidateFacts from the Extractor worker
- **Downstream**: Produces proposals for the Apply worker (PHASE-D architecture)

### 1.3 How Facts Become Rules

```
CandidateFact(s)                        ComposerProposal                    RegulatoryRule
+--------------------+                  +------------------+                +----------------+
| extractedValue     |                  | draft_rule:      |                | conceptSlug    |
| suggestedDomain    |  --> Composer -> |   concept_slug   | --> Apply ->   | value          |
| groundingQuotes    |      (LLM)       |   value          |     Worker     | appliesWhen    |
| overallConfidence  |                  |   applies_when   |                | sourcePointers |
+--------------------+                  |   explanation    |                | status: DRAFT  |
                                        +------------------+                +----------------+
```

**PHASE-D Architecture Note**: The Composer now generates proposals only (no database writes). The Apply Worker handles all persistence, ensuring clean separation between "proposal generation" and "truth persistence."

---

## 2. Technical Implementation

### 2.1 Entry Point

**File:** `/src/lib/regulatory-truth/workers/composer.worker.ts`

```typescript
interface ComposeJobData {
  candidateFactIds: string[] // Required: IDs of CandidateFacts to compose
  domain: string // Domain classification (e.g., "pdv-stopa")
  runId: string // Pipeline run correlation ID
  parentJobId?: string // Parent job for tracing
  pointerIds?: string[] // Legacy field (deprecated)
}
```

### 2.2 Job Processing Flow

```typescript
async function processComposeJob(job: Job<ComposeJobData>): Promise<JobResult> {
  // 1. Validate input
  if (!candidateFactIds || candidateFactIds.length === 0) {
    return { success: false, error: "No candidateFactIds provided" }
  }

  // 2. Generate proposal via LLM (rate-limited)
  const proposal = await llmLimiter.schedule(() =>
    generateComposerProposal(candidateFactIds, correlationOpts)
  )

  // 3. Queue apply job for persistence
  await applyQueue.add("apply", {
    proposal,
    domain,
    runId,
    parentJobId: job.id,
  })

  return { success: true, data: { proposalQueued: true } }
}
```

### 2.3 LLM-Based Composition

The `generateComposerProposal()` function in `/src/lib/regulatory-truth/agents/composer.ts`:

1. **Fetches CandidateFacts** from database
2. **Blocks test domains** (prevents synthetic data from creating rules)
3. **Transforms to LLM input** format with grounding quotes
4. **Calls runAgent()** with ComposerInputSchema/ComposerOutputSchema
5. **Returns proposal** without any database writes

```typescript
export async function generateComposerProposal(
  candidateFactIds: string[],
  correlationOpts?: CorrelationOptions
): Promise<ComposerProposal> {
  // Fetch CandidateFacts
  const candidateFacts = await db.candidateFact.findMany({
    where: { id: { in: candidateFactIds } }
  })

  // Build input with grounding quotes
  const input: ComposerInput = {
    sourcePointerIds: pointerLikeInputs.map(p => p.id),
    sourcePointers: pointerLikeInputs
  }

  // Run LLM agent
  const result = await runAgent<ComposerInput, ComposerOutput>({
    agentType: "COMPOSER",
    input,
    inputSchema: ComposerInputSchema,
    outputSchema: ComposerOutputSchema,
    temperature: 0.1  // Low temperature for deterministic output
  })

  return { success: true, output: result.output, ... }
}
```

### 2.4 Domain-Based Grouping

The `groupSourcePointersByDomain()` function creates composite keys for coherent rule creation:

```typescript
export function groupSourcePointersByDomain(
  sourcePointers: Array<{ id: string; domain: string; extractedValue?: string; valueType?: string }>
): Record<string, string[]> {
  const grouped: Record<string, string[]> = {}

  for (const sp of sourcePointers) {
    // Composite key: domain + normalized value + valueType
    // Ensures pointers with same concept/value are grouped together
    const normalizedValue = sp.extractedValue?.trim().toLowerCase() || "unknown"
    const valueType = sp.valueType || "text"
    const groupKey = `${sp.domain}::${valueType}::${normalizedValue}`

    if (!grouped[groupKey]) {
      grouped[groupKey] = []
    }
    grouped[groupKey].push(sp.id)
  }

  return grouped
}
```

**Grouping Strategy:**

- Groups by `domain::valueType::normalizedValue`
- Prevents mixing pointers for different concepts
- Avoids conflict detection failures and LLM composition failures
- Prevents orphaned pointers

### 2.5 Worker Configuration

```typescript
const worker = createWorker<ComposeJobData>("compose", processComposeJob, {
  name: "composer",
  concurrency: 1, // Sequential processing (LLM resource constraint)
  lockDuration: 360000, // 6 minutes (exceeds 5 min agent timeout)
  stalledInterval: 60000, // Check for stalled jobs every 60s
})
```

---

## 3. Inputs

### 3.1 Primary Input: CandidateFact Records

CandidateFacts are produced by the Extractor worker and represent extracted regulatory information:

| Field                | Type          | Description                                         |
| -------------------- | ------------- | --------------------------------------------------- |
| `id`                 | string (CUID) | Unique identifier                                   |
| `extractedValue`     | string        | The extracted regulatory value (e.g., "25%")        |
| `suggestedDomain`    | string        | Domain classification (e.g., "pdv-stopa-25")        |
| `suggestedValueType` | string        | Value type (e.g., "percentage", "currency", "text") |
| `groundingQuotes`    | JSON          | Array of grounding quotes with context              |
| `overallConfidence`  | float         | Confidence score (0-1)                              |
| `status`             | enum          | PENDING, PROMOTED, REJECTED                         |

### 3.2 Grounding Quote Structure

```typescript
interface GroundingQuote {
  text: string // Exact quote from source
  contextBefore?: string // Text before quote
  contextAfter?: string // Text after quote
  evidenceId?: string // Reference to Evidence record
  articleNumber?: string // Article/section reference
  lawReference?: string // Law name (e.g., "Zakon o PDV-u")
}
```

### 3.3 Job Payload Schema

```typescript
interface ComposeJobData {
  candidateFactIds: string[] // REQUIRED: Array of CandidateFact IDs
  domain: string // Domain for this composition batch
  runId: string // Pipeline run ID for correlation
  parentJobId?: string // Parent job ID for tracing
  pointerIds?: string[] // DEPRECATED: Legacy field
}
```

**Validation Rules:**

- `candidateFactIds` must be non-empty array
- All IDs must reference existing CandidateFact records
- Domain must not be a blocked test domain

---

## 4. Outputs

### 4.1 ComposerProposal (Immediate Output)

The Composer produces a proposal that is queued for the Apply worker:

```typescript
export interface ComposerProposal {
  success: boolean
  output: ComposerOutput | null
  agentRunId: string | null // For outcome tracking
  candidateFactIds: string[]
  error: string | null
}
```

### 4.2 ComposerOutput (LLM Response)

```typescript
export const ComposerOutputSchema = z.object({
  draft_rule: DraftRuleSchema,
  conflicts_detected: ConflictDetectedSchema.optional(),
})
```

### 4.3 DraftRule Structure

| Field             | Type          | Description                                               |
| ----------------- | ------------- | --------------------------------------------------------- |
| `concept_slug`    | string        | Kebab-case identifier (e.g., "pdv-stopa-25")              |
| `title_hr`        | string        | Croatian title                                            |
| `title_en`        | string        | English title                                             |
| `risk_tier`       | enum          | LOW, MEDIUM, HIGH, CRITICAL                               |
| `authority_level` | enum          | LAW, GUIDANCE, PROCEDURE, PRACTICE                        |
| `applies_when`    | DSL           | AppliesWhen predicate (JSON or string)                    |
| `value`           | string/number | The regulatory value                                      |
| `value_type`      | enum          | percentage, currency, boolean, text, date, duration, json |
| `explanation_hr`  | string        | Croatian explanation                                      |
| `explanation_en`  | string        | English explanation                                       |
| `effective_from`  | ISO date      | When rule becomes effective                               |
| `effective_until` | ISO date      | When rule expires (optional)                              |
| `supersedes`      | string        | ID of superseded rule (optional)                          |
| `llm_confidence`  | float         | LLM's self-assessed confidence (0-1)                      |
| `composer_notes`  | string        | LLM reasoning notes                                       |

### 4.4 Created by Apply Worker

After the Apply worker processes the proposal, these records are created:

**SourcePointer Table:**

- Created from each CandidateFact's grounding quotes
- Links to Evidence via `evidenceId`
- Contains `exactQuote`, `extractedValue`, `confidence`

**RegulatoryRule Table:**

- Created from DraftRule output
- Status set to `DRAFT`
- Linked to SourcePointers via many-to-many relation
- Linked to Concept via `conceptId`

**Concept Table:**

- Upserted based on `concept_slug`
- Contains `nameHr`, `nameEn`, `tags`

---

## 5. Dependencies

### 5.1 Data Dependencies

| Dependency    | Type              | Required | Description                    |
| ------------- | ----------------- | -------- | ------------------------------ |
| CandidateFact | DB Record         | Yes      | Must exist in database         |
| Evidence      | DB Record (dbReg) | Yes      | Referenced by grounding quotes |
| Source        | DB Record (dbReg) | No       | For authority level derivation |
| ConceptNode   | DB Record         | No       | For taxonomy resolution        |

### 5.2 Service Dependencies

| Service                 | Purpose                     | Failure Impact                    |
| ----------------------- | --------------------------- | --------------------------------- |
| **Ollama LLM**          | Rule composition            | Job fails, retried                |
| **PostgreSQL (app DB)** | CandidateFact, Rule storage | Job fails                         |
| **PostgreSQL (reg DB)** | Evidence, Source lookup     | Authority derivation fails        |
| **Redis**               | BullMQ queue                | Worker cannot start               |
| **Apply Worker**        | Persistence                 | Proposals queue but don't persist |

### 5.3 Code Dependencies

```
composer.worker.ts
  ├── base.ts (createWorker, setupGracefulShutdown)
  ├── queues.ts (applyQueue)
  ├── metrics.ts (jobsProcessed, jobDuration)
  ├── rate-limiter.ts (llmLimiter)
  └── ../agents/composer.ts
        ├── ../schemas/composer.ts (ComposerInputSchema, ComposerOutputSchema)
        ├── ./runner.ts (runAgent)
        ├── ../utils/audit-log.ts (logAuditEvent)
        ├── ../utils/authority.ts (deriveAuthorityLevel)
        ├── ../dsl/applies-when.ts (validateAppliesWhen)
        ├── ../utils/conflict-detector.ts (detectStructuralConflicts)
        ├── ../utils/concept-resolver.ts (resolveCanonicalConcept)
        ├── ../utils/meaning-signature.ts (computeMeaningSignature)
        ├── ../utils/explanation-validator.ts (validateExplanation)
        ├── ../graph/cycle-detection.ts (createEdgeWithCycleCheck)
        ├── ../utils/source-consistency.ts (validateSourceConsistency)
        └── ../utils/derived-confidence.ts (computeDerivedConfidence)
```

### 5.4 Taxonomy Dependencies

The taxonomy defines domain classifications used for grouping:

```typescript
// From seed-taxonomy.ts
const INITIAL_TAXONOMY = [
  { slug: "pdv-domena", nameHr: "PDV", nameEn: "VAT" },
  { slug: "pdv-stopa", nameHr: "PDV stopa", parentSlug: "pdv-domena" },
  { slug: "pdv-stopa-25", nameHr: "Standardna stopa PDV-a 25%", parentSlug: "pdv-stopa" },
  { slug: "pausalni-domena", nameHr: "Paušalno oporezivanje" },
  // ... 100+ taxonomy entries
]
```

---

## 6. Prerequisites

### 6.1 Data Prerequisites

| Prerequisite             | Description                               | Verification                                               |
| ------------------------ | ----------------------------------------- | ---------------------------------------------------------- |
| CandidateFacts extracted | Facts must exist with status PENDING      | `db.candidateFact.count({ where: { status: "PENDING" } })` |
| Grounding quotes present | Each fact must have at least one quote    | Check `groundingQuotes` is non-empty array                 |
| Evidence linked          | `groundingQuotes[].evidenceId` must exist | Query Evidence table                                       |
| Domain classified        | `suggestedDomain` must be set             | Non-null check                                             |

### 6.2 System Prerequisites

| Prerequisite       | Description                     | Verification            |
| ------------------ | ------------------------------- | ----------------------- |
| Ollama running     | LLM endpoint must be accessible | Health check endpoint   |
| Database connected | Both app and reg databases      | Prisma connection check |
| Redis running      | BullMQ queue backend            | Redis PING              |
| Apply worker ready | Must be running to persist      | Queue health check      |

### 6.3 Configuration Prerequisites

```bash
# Required environment variables
OLLAMA_ENDPOINT=http://100.100.47.43:11434
OLLAMA_API_KEY=<api-key>
OLLAMA_MODEL=gemma-3-27b
DATABASE_URL=postgresql://...
REDIS_URL=redis://fiskai-redis:6379
```

---

## 7. Triggers

### 7.1 Primary Trigger: Continuous Drainer

The `continuous-drainer.worker.ts` monitors for unprocessed SourcePointers and queues compose jobs:

```typescript
async function drainSourcePointers(): Promise<number> {
  // Find pointers not yet composed into rules
  const pointers = await db.sourcePointer.findMany({
    where: { rules: { none: {} } },
    select: { id: true, domain: true },
    take: 50,
  })

  // Group by domain
  const byDomain = new Map<string, string[]>()
  for (const p of pointers) {
    const ids = byDomain.get(p.domain) || []
    ids.push(p.id)
    byDomain.set(p.domain, ids)
  }

  // Queue compose jobs
  for (const [domain, pointerIds] of byDomain) {
    await composeQueue.add("compose", { pointerIds, domain, runId })
  }
}
```

### 7.2 PHASE-D Trigger: CandidateFact-Based

In the PHASE-D architecture, CandidateFacts trigger composition:

```typescript
// After extraction creates CandidateFacts
await composeQueue.add("compose", {
  candidateFactIds: [factId1, factId2],
  domain: "pdv-stopa",
  runId: runId,
})
```

### 7.3 Domain-Based Batching

Jobs are batched by domain to ensure coherent rule creation:

```
CandidateFacts:
  fact-1: domain="pdv-stopa-25", value="25%"
  fact-2: domain="pdv-stopa-25", value="25%"
  fact-3: domain="pausalni-limit", value="39816 EUR"

Compose Jobs Created:
  Job 1: candidateFactIds=[fact-1, fact-2], domain="pdv-stopa-25"
  Job 2: candidateFactIds=[fact-3], domain="pausalni-limit"
```

### 7.4 Queue Rate Limiting

The compose queue is rate-limited to prevent LLM overload:

```typescript
export const composeQueue = createQueue("compose", {
  max: 5, // Maximum 5 jobs
  duration: 60000, // Per 60 seconds
})
```

---

## 8. Error Handling

### 8.1 Input Validation Errors

```typescript
// No candidateFactIds provided
if (!candidateFactIds || candidateFactIds.length === 0) {
  console.error(`[composer] No candidateFactIds provided for domain ${domain}`)
  return {
    success: false,
    error: "No candidateFactIds provided - PHASE-D requires CandidateFact input",
  }
}
```

**Resolution:** Check drainer logic and ensure CandidateFacts exist before queueing.

### 8.2 LLM Failure Handling

```typescript
try {
  const proposal = await llmLimiter.schedule(() =>
    generateComposerProposal(candidateFactIds, correlationOpts)
  )

  if (!proposal.success) {
    jobsProcessed.inc({ worker: "composer", status: "failed" })
    return {
      success: false,
      error: proposal.error || "Proposal generation failed",
    }
  }
} catch (error) {
  jobsProcessed.inc({ worker: "composer", status: "failed" })
  return {
    success: false,
    error: error instanceof Error ? error.message : String(error),
  }
}
```

**Retry Behavior:** Jobs retry up to 3 times with exponential backoff (10s, 20s, 40s).

### 8.3 Empty CandidateFacts Handling

```typescript
const candidateFacts = await db.candidateFact.findMany({
  where: { id: { in: candidateFactIds } },
})

if (candidateFacts.length === 0) {
  return {
    success: false,
    error: `No candidate facts found for IDs: ${candidateFactIds.join(", ")}`,
  }
}
```

### 8.4 Invalid DSL Handling (FAIL-CLOSED)

```typescript
const dslValidation = validateAppliesWhen(appliesWhenObj)
if (!dslValidation.valid) {
  console.error(`[composer] REJECTING rule with invalid AppliesWhen DSL: ${draftRule.concept_slug}`)

  // FAIL-CLOSED: Reject the rule instead of silently broadening its applicability
  // Previously this was replaced with { op: "true" } which made the rule apply universally
  return {
    success: false,
    error: `Cannot create rule with invalid AppliesWhen DSL: ${dslValidation.error}`,
  }
}
```

**Critical Safety Note:** Invalid DSL rules are REJECTED, not broadened. This prevents incorrect rule application.

### 8.5 Orphaned Pointer Handling

```typescript
export async function markOrphanedPointersForReview(
  pointerIds: string[],
  reason: string
): Promise<void> {
  const timestamp = new Date().toISOString()
  await db.sourcePointer.updateMany({
    where: { id: { in: pointerIds } },
    data: {
      extractionNotes: `[COMPOSITION_FAILED @ ${timestamp}] ${reason}. Needs manual review.`,
    },
  })
}
```

### 8.6 Error Classification

| Error Type             | Retryable | Action                              |
| ---------------------- | --------- | ----------------------------------- |
| LLM timeout            | Yes       | Exponential backoff retry           |
| LLM parse failure      | Yes       | Retry with different input batching |
| Database connection    | Yes       | Retry after connection recovery     |
| Invalid DSL            | No        | Reject and log for review           |
| Blocked domain         | No        | Fail fast, do not retry             |
| Missing CandidateFacts | No        | Fail, check data pipeline           |
| Conflict detected      | No        | Create conflict record for Arbiter  |

---

## 9. Guardrails and Safety

### 9.1 Fact Verification

**Source Pointer Validation:**

```typescript
// Verify all pointer IDs exist in database
const existingPointers = await db.sourcePointer.findMany({
  where: { id: { in: validSourcePointerIds } },
  select: { id: true },
})

if (existingPointers.length !== validSourcePointerIds.length) {
  const missingIds = validSourcePointerIds.filter(
    (id) => !existingPointers.some((p) => p.id === id)
  )
  return {
    success: false,
    error: `Cannot create rule: ${missingIds.length} source pointer(s) not found`,
  }
}
```

**Minimum Source Requirement:**

```typescript
// CRITICAL VALIDATION: Rules MUST have at least one source pointer
if (validSourcePointerIds.length === 0) {
  return {
    success: false,
    error: `Cannot create rule without source pointers. Rules must be traceable to evidence.`,
  }
}
```

### 9.2 Conflict Detection

**Deterministic Structural Conflicts:**

```typescript
const conflicts = await detectStructuralConflicts({
  id: rule.id,
  conceptSlug: rule.conceptSlug,
  value: rule.value,
  effectiveFrom: rule.effectiveFrom,
  effectiveUntil: rule.effectiveUntil,
  authorityLevel,
  articleNumber: firstArticleNumber,
})
```

**Conflict Types:**
| Type | Description | Resolution |
|------|-------------|------------|
| VALUE_MISMATCH | Same concept, different values, overlapping dates | Arbiter decides |
| DATE_OVERLAP | Temporal conflict between rules | Arbiter decides |
| AUTHORITY_SUPERSEDE | Higher authority may supersede lower | Automatic |
| CROSS_SLUG_DUPLICATE | Same value with different concept slugs | Arbiter merges |

**LLM-Detected Conflicts:**

```typescript
if (result.output.conflicts_detected) {
  const conflict = await db.regulatoryConflict.create({
    data: {
      conflictType: "SOURCE_CONFLICT",
      status: "OPEN",
      description: result.output.conflicts_detected.description,
      metadata: {
        sourcePointerIds,
        detectedBy: "COMPOSER",
      },
    },
  })
  return { success: false, error: `Conflict detected (${conflict.id}) - queued for Arbiter` }
}
```

### 9.3 Confidence Aggregation

**Derived Confidence Calculation:**

```typescript
export function computeDerivedConfidence(
  pointers: Array<{ confidence: number }>,
  llmConfidence: number
): number {
  if (pointers.length === 0) return 0

  // Average pointer confidence
  const avgPointerConfidence = pointers.reduce((sum, p) => sum + p.confidence, 0) / pointers.length

  // Minimum pointer confidence (weakest evidence)
  const minPointerConfidence = Math.min(...pointers.map((p) => p.confidence))

  // Weighted: 90% average + 10% minimum
  const evidenceBasedConfidence = avgPointerConfidence * 0.9 + minPointerConfidence * 0.1

  // Final: minimum of LLM confidence and evidence-based
  return Math.min(evidenceBasedConfidence, llmConfidence)
}
```

**Why This Matters (Issue #770):**

- LLM self-assessment can be overconfident
- Weak evidence should cap rule confidence
- Prevents high-confidence rules backed by low-quality extractions

### 9.4 Source Chain Integrity

**Cross-Source Reference Validation:**

```typescript
const sourceConsistency = await validateSourceConsistency(
  sourcePointers,
  sourceConsistencyEvidenceMap
)

if (sourceConsistency.crossSourceReferences.length > 0) {
  console.warn(
    `[composer] Cross-source references detected: ${sourceConsistency.warnings.join("; ")}`
  )
  await logCrossSourceReferences(sourcePointerIds[0], sourceConsistency)
}
```

**Authority Level Derivation:**

```typescript
const sourceSlugs = sourcePointers
  .map((sp) => evidenceMap.get(sp.evidenceId)?.source?.slug)
  .filter((slug): slug is string => slug !== undefined)

const authorityLevel = deriveAuthorityLevel(sourceSlugs)
// LAW > GUIDANCE > PROCEDURE > PRACTICE
```

### 9.5 Explanation Validation

**Modal Verb Verification:**

```typescript
const explanationValidation = validateExplanation(
  draftRule.explanation_hr,
  draftRule.explanation_en,
  sourceQuotes,
  String(draftRule.value)
)

if (!explanationValidation.valid) {
  // FAIL-CLOSED: Use quote-only explanation when validation fails
  finalExplanationHr = createQuoteOnlyExplanation(sourceQuotes, String(draftRule.value))
  finalExplanationEn = null
}
```

**Checked Modal Verbs (Croatian):**

- mora, moraju, morati, morate
- uvijek, nikad, nikada
- obavezno, obvezan, obvezna, obvezni
- zabranjeno, nužno, neophodno
- isključivo, jedino

### 9.6 Blocked Domain Guard

```typescript
const blockedDomains = domains.filter(isBlockedDomain)
if (blockedDomains.length > 0) {
  return {
    success: false,
    error: `Blocked domain(s): ${blockedDomains.join(", ")}. Test data cannot create rules.`,
  }
}
```

**Blocked Patterns:**

- `test-*`
- `synthetic-*`
- `demo-*`
- `example-*`

### 9.7 Cycle Prevention in Graph Edges

```typescript
if (draftRule.supersedes) {
  try {
    await createEdgeWithCycleCheck({
      fromRuleId: rule.id,
      toRuleId: draftRule.supersedes,
      relation: "AMENDS",
      validFrom: rule.effectiveFrom,
    })
  } catch (error) {
    if (error instanceof CycleDetectedError) {
      console.warn(`[composer] Cycle prevented: AMENDS edge would create a cycle`)
      // Don't fail rule creation, just skip the edge
    } else {
      throw error
    }
  }
}
```

---

## 10. Monitoring and Observability

### 10.1 Prometheus Metrics

```typescript
// Jobs processed counter
jobsProcessed.inc({ worker: "composer", status: "success", queue: "compose" })
jobsProcessed.inc({ worker: "composer", status: "failed", queue: "compose" })

// Job duration histogram
jobDuration.observe({ worker: "composer", queue: "compose" }, duration / 1000)
```

**Available Metrics:**
| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `fiskai_jobs_processed_total` | Counter | worker, status, queue | Total jobs processed |
| `fiskai_job_duration_seconds` | Histogram | worker, queue | Job processing time |

### 10.2 Logging

**Standard Log Format:**

```
[composer] Processing domain pdv-stopa with 3 CandidateFacts
[composer] Queued apply job for domain pdv-stopa with 3 CandidateFacts
[composer] PHASE-D: Generating proposal from 3 CandidateFacts
[composer] Created conflict cuid123 for Arbiter resolution
```

**Error Log Format:**

```
[composer] No candidateFactIds provided for domain pdv-stopa
[composer] REJECTING rule with invalid AppliesWhen DSL: pdv-stopa-25
[composer] Missing source pointers: expected 3, found 2
```

### 10.3 Audit Trail

```typescript
await logAuditEvent({
  action: "RULE_CREATED",
  entityType: "RULE",
  entityId: rule.id,
  metadata: {
    conceptSlug: rule.conceptSlug,
    riskTier: draftRule.risk_tier,
    llmConfidence: draftRule.llm_confidence,
    derivedConfidence,
    sourcePointerCount: sourcePointerIds.length,
    conflictsDetected: conflicts.length,
    primarySourceId: sourceConsistency.primarySourceId,
    crossSourceReferenceCount: sourceConsistency.crossSourceReferences.length,
  },
})
```

### 10.4 Queue Monitoring

**Queue Health Check:**

```bash
npx tsx scripts/queue-status.ts
```

**Expected Output:**

```
Queue: compose
  Waiting: 5
  Active: 1
  Completed: 1234
  Failed: 12
```

### 10.5 Agent Run Tracking

Each composition is tracked via AgentRun:

```typescript
const result = await runAgent<ComposerInput, ComposerOutput>({
  agentType: "COMPOSER",
  input,
  runId: correlationOpts?.runId,
  jobId: correlationOpts?.jobId,
  parentJobId: correlationOpts?.parentJobId,
  queueName: "compose",
})
```

**AgentRun Fields:**

- `agentType`: "COMPOSER"
- `status`: PENDING -> RUNNING -> SUCCESS/FAILED
- `inputTokens`, `outputTokens`: Token usage
- `durationMs`: Processing time
- `itemsProduced`: Rules created (0 or 1)

---

## 11. Configuration

### 11.1 Environment Variables

| Variable                  | Default  | Description                |
| ------------------------- | -------- | -------------------------- |
| `OLLAMA_ENDPOINT`         | Required | Ollama API endpoint        |
| `OLLAMA_API_KEY`          | Required | API authentication         |
| `OLLAMA_MODEL`            | Required | Model for composition      |
| `DATABASE_URL`            | Required | App database connection    |
| `REGULATORY_DATABASE_URL` | Required | Regulatory database        |
| `REDIS_URL`               | Required | BullMQ queue backend       |
| `WORKER_CONCURRENCY`      | 1        | Jobs processed in parallel |

### 11.2 Docker Compose Configuration

```yaml
worker-composer:
  image: ghcr.io/wandeon/fiskai-worker:${IMAGE_TAG:-latest}
  container_name: fiskai-worker-composer
  command: ["node", "dist/workers/lib/regulatory-truth/workers/composer.worker.js"]
  environment:
    OLLAMA_ENDPOINT: ${OLLAMA_ENDPOINT}
    OLLAMA_API_KEY: ${OLLAMA_API_KEY}
    OLLAMA_MODEL: ${OLLAMA_MODEL}
    WORKER_TYPE: composer
    WORKER_CONCURRENCY: 1
  deploy:
    resources:
      limits:
        memory: 512M
```

### 11.3 Queue Configuration

```typescript
// From queues.ts
export const composeQueue = createQueue("compose", {
  max: 5, // Max 5 jobs per window
  duration: 60000, // 60 second window
})
```

### 11.4 Rate Limiter Configuration

```typescript
// From rate-limiter.ts
export const llmLimiter = new Bottleneck({
  maxConcurrent: 1, // One LLM call at a time
  minTime: 1000, // 1 second between calls
})
```

### 11.5 Worker Timing Configuration

| Setting           | Value            | Reason                      |
| ----------------- | ---------------- | --------------------------- |
| `lockDuration`    | 360000ms (6 min) | Exceeds 5 min agent timeout |
| `stalledInterval` | 60000ms (60s)    | Reasonable stall detection  |
| `concurrency`     | 1                | LLM resource constraint     |

---

## 12. Known Issues and Limitations

### 12.1 "No candidateFactIds" Issue

**Symptom:**

```
[composer] No candidateFactIds provided for domain pdv-stopa
```

**Root Cause:**

- Legacy drainer code sends `pointerIds` instead of `candidateFactIds`
- Mismatch between PHASE-D architecture and legacy data flow

**Resolution:**

1. Ensure extractor creates CandidateFacts (not SourcePointers)
2. Update drainer to use `candidateFactIds`
3. Set `pointerIds` field as deprecated

### 12.2 Domain Classification Accuracy

**Issue:** LLM may suggest incorrect domains for extracted facts.

**Mitigation:**

- Taxonomy provides canonical domain mappings
- `resolveCanonicalConcept()` normalizes domain slugs
- Conflict detector catches cross-slug duplicates

**Improvement Path:**

- Pre-classification worker (future Task 11)
- Domain validation against taxonomy hierarchy
- Human review for low-confidence domain assignments

### 12.3 Complex Rule Handling

**Limitation:** Single rules with multiple conditions are hard to compose.

**Examples:**

- Rules with exceptions ("25% PDV osim za...")
- Rules with progressive thresholds
- Rules with temporal conditions

**Current Behavior:**

- LLM attempts to generate complex AppliesWhen DSL
- Invalid DSL is rejected (fail-closed)
- Complex rules may need manual composition

### 12.4 LLM Hallucination Risk

**Issue:** LLM may generate values not present in source quotes.

**Mitigations:**

1. Explanation validator checks modal verbs against sources
2. Numeric values are cross-referenced with source quotes
3. Derived confidence prevents high-confidence rules from weak evidence
4. Quote-only fallback for failed explanation validation

### 12.5 Memory Constraints

**Issue:** Large batches of CandidateFacts may exceed memory limits.

**Current Limit:** 512MB container memory

**Mitigations:**

- Domain-based batching limits batch size
- Queue rate limiting prevents accumulation
- `take: 50` limits in database queries

### 12.6 Concurrency Limitations

**Issue:** Single concurrency (1) limits throughput.

**Reason:** LLM calls are expensive and rate-limited.

**Impact:** Peak throughput ~60 rules/hour

**Future Improvement:** Increase concurrency when LLM capacity allows.

---

## 13. Data Flow Diagrams

### 13.1 PHASE-D Complete Flow

```
+----------------+     +----------------+     +----------------+
|   Extractor    | --> | CandidateFact  | --> |    Composer    |
|   Worker       |     |   (database)   |     |    Worker      |
+----------------+     +----------------+     +----------------+
                                                      |
                                                      v
                                              +----------------+
                                              |  Proposal      |
                                              |  (in memory)   |
                                              +----------------+
                                                      |
                                                      v
+----------------+     +----------------+     +----------------+
| RegulatoryRule | <-- |  SourcePointer | <-- |    Apply       |
|   (database)   |     |   (database)   |     |    Worker      |
+----------------+     +----------------+     +----------------+
                              |
                              v
                       +----------------+
                       |   Reviewer     |
                       |   Worker       |
                       +----------------+
```

### 13.2 Conflict Detection Flow

```
                    +------------------+
                    |   Composer       |
                    |   generates      |
                    |   DraftRule      |
                    +------------------+
                            |
                            v
        +------------------------------------------+
        |        detectStructuralConflicts()       |
        +------------------------------------------+
                |               |
    +-----------+               +-----------+
    v                                       v
+------------------+                +------------------+
| VALUE_MISMATCH   |                | CROSS_SLUG_DUP   |
| Same concept,    |                | Same value,      |
| different value  |                | different slug   |
+------------------+                +------------------+
          |                                  |
          +----------------+-----------------+
                           |
                           v
                   +------------------+
                   | RegulatoryConflict |
                   | status: OPEN       |
                   +------------------+
                           |
                           v
                   +------------------+
                   |    Arbiter       |
                   |    Worker        |
                   +------------------+
```

### 13.3 Confidence Flow

```
+------------------+
| CandidateFact    |
| confidence: 0.8  |
+------------------+
        |
        v
+------------------+
| CandidateFact    |
| confidence: 0.9  |
+------------------+
        |
        +----------+
                   |
                   v
        +---------------------------+
        |  computeDerivedConfidence |
        |  avg: 0.85               |
        |  min: 0.8                |
        |  weighted: 0.845         |
        +---------------------------+
                   |
                   v
        +---------------------------+
        |  LLM confidence: 0.95     |
        |  Final: min(0.845, 0.95)  |
        |  Rule confidence: 0.845   |
        +---------------------------+
```

---

## 14. Schema Reference

### 14.1 ComposerInputSchema

```typescript
export const ComposerInputSchema = z.object({
  sourcePointerIds: z.array(z.string()).min(1),
  sourcePointers: z.array(
    z.object({
      id: z.string(),
      domain: z.string(),
      extractedValue: z.string(),
      exactQuote: z.string(),
      confidence: z.number(),
    })
  ),
})
```

### 14.2 DraftRuleSchema

```typescript
export const DraftRuleSchema = z.object({
  concept_slug: z.string().regex(/^[a-z0-9-]+$/, "Must be kebab-case"),
  title_hr: z.string().min(1),
  title_en: z.string().min(1),
  risk_tier: RiskTierSchema, // LOW, MEDIUM, HIGH, CRITICAL
  authority_level: AuthorityLevelSchema.optional().default("GUIDANCE"),
  automation_policy: AutomationPolicySchema.optional().default("CONFIRM"),
  rule_stability: RuleStabilitySchema.optional().default("STABLE"),
  obligation_type: ObligationTypeSchema.optional().default("OBLIGATION"),
  outcome: z.record(z.string(), z.unknown()).nullable().optional(),
  applies_when: appliesWhenSchema,
  value: z.union([z.string(), z.number()]),
  value_type: ValueTypeSchema,
  explanation_hr: z.string(),
  explanation_en: z.string(),
  source_pointer_ids: z.array(z.string()).min(1),
  effective_from: effectiveFromSchema,
  effective_until: ISODateSchema.nullable(),
  supersedes: z.string().nullable(),
  llm_confidence: ConfidenceSchema,
  composer_notes: z.string(),
})
```

### 14.3 AppliesWhen DSL

```typescript
type AppliesWhenPredicate =
  | { op: "and"; args: AppliesWhenPredicate[] }
  | { op: "or"; args: AppliesWhenPredicate[] }
  | { op: "not"; arg: AppliesWhenPredicate }
  | { op: "cmp"; field: string; cmp: "eq" | "neq" | "gt" | "gte" | "lt" | "lte"; value: unknown }
  | { op: "in"; field: string; values: unknown[] }
  | { op: "exists"; field: string }
  | { op: "between"; field: string; gte?: unknown; lte?: unknown }
  | { op: "matches"; field: string; pattern: string }
  | { op: "date_in_effect"; dateField: string; on?: string }
  | { op: "true" }
  | { op: "false" }
```

**Example AppliesWhen:**

```json
{
  "op": "and",
  "args": [
    { "op": "cmp", "field": "entity.type", "cmp": "eq", "value": "OBRT" },
    { "op": "cmp", "field": "entity.obrtSubtype", "cmp": "eq", "value": "PAUSALNI" },
    { "op": "cmp", "field": "entity.vat.status", "cmp": "eq", "value": "OUTSIDE_VAT" }
  ]
}
```

### 14.4 ConflictDetectedSchema

```typescript
export const ConflictDetectedSchema = z.object({
  description: z.string(),
  conflicting_sources: z.array(z.string()),
  escalate_to_arbiter: z.literal(true),
})
```

---

## 15. Taxonomy and Domain Classification

### 15.1 Domain Hierarchy

The taxonomy defines a hierarchical domain structure:

```
porez (Tax)
├── pdv (VAT)
│   ├── pdv-stopa (VAT Rate)
│   │   ├── pdv-stopa-25 (25% Standard Rate)
│   │   ├── pdv-stopa-13 (13% Reduced Rate)
│   │   ├── pdv-stopa-5 (5% Reduced Rate)
│   │   └── pdv-oslobodeno (VAT Exempt)
│   ├── pdv-registracija (VAT Registration)
│   │   ├── pdv-prag (VAT Threshold)
│   │   └── pdv-dobrovoljni-ulazak (Voluntary Registration)
│   ├── pdv-oslobodjenja (VAT Exemptions)
│   └── pdv-eu-transakcije (EU Transactions)
├── pausalni (Lump-sum Taxation)
│   ├── pausalni-limiti (Income Limits)
│   ├── pausalni-porez (Tax Rates)
│   └── pausalni-doprinosi (Contributions)
├── porez-dobit (Corporate Tax)
└── dohodak (Income Tax)
```

### 15.2 Domain Resolution

```typescript
// From concept-resolver.ts
export async function resolveCanonicalConcept(
  proposedSlug: string,
  value: string,
  valueType: string,
  effectiveFrom: Date
): Promise<{
  canonicalSlug: string
  shouldMerge: boolean
  existingRuleId: string | null
  mergeReason: string | null
}> {
  // Normalize slug
  const normalized = normalizeSlug(proposedSlug)

  // Check for canonical aliases
  const canonical = CANONICAL_ALIASES[normalized] || normalized

  // Check for existing rule with same value
  // ...
}
```

### 15.3 Canonical Aliases

```typescript
export const CANONICAL_ALIASES: Record<string, string[]> = {
  "pdv-stopa-25": ["vat-standard-rate", "pdv-standardna-stopa", "pdv-25-posto"],
  "pausalni-prag": ["pausalni-limit-prihoda", "lump-sum-threshold"],
  // ... more aliases
}
```

### 15.4 Knowledge Graph Integration

Rules are linked to concepts in the knowledge graph:

```typescript
// Create/update Concept
const concept = await db.concept.upsert({
  where: { slug: finalConceptSlug },
  create: {
    slug: finalConceptSlug,
    nameHr: draftRule.title_hr,
    nameEn: draftRule.title_en,
    tags: [draftRule.risk_tier, authorityLevel]
  },
  update: { ... }
})

// Link rule to concept
await db.regulatoryRule.update({
  where: { id: rule.id },
  data: { conceptId: concept.id }
})
```

---

## Appendix A: Quick Reference

### Common Commands

```bash
# View composer logs
docker logs fiskai-worker-composer --tail 100

# Check queue status
npx tsx scripts/queue-status.ts

# Manually trigger composition
npx tsx src/lib/regulatory-truth/scripts/run-composer.ts [candidateFactId]

# Check for orphaned pointers
psql -c "SELECT COUNT(*) FROM \"SourcePointer\" WHERE \"extractionNotes\" LIKE '%COMPOSITION_FAILED%'"
```

### Key Files

| File                                                   | Purpose                |
| ------------------------------------------------------ | ---------------------- |
| `src/lib/regulatory-truth/workers/composer.worker.ts`  | Worker entry point     |
| `src/lib/regulatory-truth/agents/composer.ts`          | Agent implementation   |
| `src/lib/regulatory-truth/schemas/composer.ts`         | Input/output schemas   |
| `src/lib/regulatory-truth/dsl/applies-when.ts`         | AppliesWhen DSL        |
| `src/lib/regulatory-truth/utils/conflict-detector.ts`  | Conflict detection     |
| `src/lib/regulatory-truth/utils/derived-confidence.ts` | Confidence calculation |
| `src/lib/regulatory-truth/taxonomy/seed-taxonomy.ts`   | Domain taxonomy        |

### Metrics to Monitor

| Metric                | Healthy Range | Alert Threshold |
| --------------------- | ------------- | --------------- |
| Jobs completed/hour   | 30-60         | < 10            |
| Failure rate          | < 5%          | > 15%           |
| Avg duration          | 10-60s        | > 120s          |
| Queue depth           | < 100         | > 500           |
| Conflicts created/day | < 10          | > 50            |

---

## Appendix B: Troubleshooting Guide

### B.1 Job Failing Immediately

**Symptoms:** Job fails without LLM call, "No candidateFactIds" error.

**Check:**

1. Verify CandidateFacts exist: `SELECT COUNT(*) FROM "CandidateFact" WHERE status='PENDING'`
2. Check drainer is sending correct payload
3. Verify PHASE-D architecture is fully deployed

### B.2 LLM Timeouts

**Symptoms:** Jobs fail after 5 minutes, timeout errors in logs.

**Check:**

1. Ollama endpoint health: `curl $OLLAMA_ENDPOINT/api/tags`
2. Model availability
3. GPU memory (if local)
4. Network latency to Ollama

### B.3 High Conflict Rate

**Symptoms:** Many conflicts created, Arbiter backlog growing.

**Check:**

1. Taxonomy completeness - missing aliases?
2. Domain classification accuracy from extractor
3. Duplicate sources being processed

### B.4 Memory Issues

**Symptoms:** Container OOM kills, incomplete processing.

**Check:**

1. Batch sizes in queries
2. Queue rate limits
3. Consider increasing container memory

---

_Document generated: 2026-01-14_
_Audit conducted by: Claude Opus 4.5_
_Next review: 2026-02-14_
