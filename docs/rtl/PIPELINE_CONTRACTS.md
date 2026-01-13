# RTL Pipeline Contracts

> Document version: 2026-01-13
>
> This document defines the contracts between RTL pipeline stages.
> Each stage must satisfy its contract for the pipeline to function correctly.

## Overview

The Regulatory Truth Layer (RTL) pipeline processes regulatory content through these stages:

```
sentinel → ocr (optional) → extract → compose → review → arbiter → release
```

---

## Stage 1: Sentinel

### File Locations

- Worker: `src/lib/regulatory-truth/workers/sentinel.worker.ts`
- Agent: `src/lib/regulatory-truth/agents/sentinel.ts`

### Job Payload (Input)

```typescript
interface SentinelJobData {
  runId: string
  sourceId?: string // Optional: specific source to scan
  priority?: string // Optional: priority filter
}
```

### DB Reads

| Table               | Purpose                                   |
| ------------------- | ----------------------------------------- |
| `DiscoveryEndpoint` | Get active endpoints to scan              |
| `DiscoveredItem`    | Check for existing items (deduplication)  |
| `RegulatorySource`  | Find/create source for domain             |
| `Evidence`          | Check for content duplicates (hash match) |

### DB Writes

| Table               | Effect                                                  |
| ------------------- | ------------------------------------------------------- |
| `DiscoveredItem`    | Create/update discovered URLs                           |
| `DiscoveryEndpoint` | Update `lastScrapedAt`, `lastContentHash`, error counts |
| `Evidence`          | Create evidence record with `rawContent`, `contentHash` |
| `EvidenceArtifact`  | Create PDF_TEXT artifact for text-layer PDFs            |
| `RegulatorySource`  | Auto-create if not found                                |

### Downstream Scheduling

| Condition                   | Queue          | Payload                 |
| --------------------------- | -------------- | ----------------------- |
| PDF scanned (no text layer) | `ocrQueue`     | `{ evidenceId, runId }` |
| HTML, PDF with text, other  | `extractQueue` | `{ evidenceId, runId }` |

### Gating Conditions

- Endpoint must be active (`isActive: true`)
- Endpoint must not exceed error threshold (`consecutiveErrors < 5`)
- Scrape frequency must be due
- Domain must not be blocked (`isBlockedDomain()` check)

### Success Definition

- Evidence record created with valid `contentHash`
- Job queued to next stage (OCR or Extract)

---

## Stage 2: OCR Worker

### File Locations

- Worker: `src/lib/regulatory-truth/workers/ocr.worker.ts`

### Job Payload (Input)

```typescript
interface OcrJobData {
  evidenceId: string
  runId: string
  parentJobId?: string
}
```

### DB Reads

| Table      | Purpose                                  |
| ---------- | ---------------------------------------- |
| `Evidence` | Get PDF content (base64 in `rawContent`) |

### DB Writes

| Table              | Effect                         |
| ------------------ | ------------------------------ |
| `EvidenceArtifact` | Create OCR_TEXT artifact       |
| `Evidence`         | Update `primaryTextArtifactId` |

### Downstream Scheduling

| Condition      | Queue          | Payload                              |
| -------------- | -------------- | ------------------------------------ |
| OCR successful | `extractQueue` | `{ evidenceId, runId, parentJobId }` |

### Gating Conditions

- Evidence must exist
- Evidence must have `contentClass: PDF_SCANNED`
- OCR must produce non-empty text

### Success Definition

- OCR_TEXT artifact created
- Job queued to Extract

---

## Stage 3: Extractor

### File Locations

- Worker: `src/lib/regulatory-truth/workers/extractor.worker.ts`
- Agent: `src/lib/regulatory-truth/agents/extractor.ts`

### Job Payload (Input)

```typescript
interface ExtractJobData {
  evidenceId: string
  runId: string
  parentJobId?: string
}
```

### DB Reads

| Table              | Purpose                                        |
| ------------------ | ---------------------------------------------- |
| `Evidence`         | Get evidence record with source                |
| `EvidenceArtifact` | Get text content (via `getExtractableContent`) |

### DB Writes

| Table                | Effect                                  |
| -------------------- | --------------------------------------- |
| `CandidateFact`      | **PHASE-D**: Create candidate facts     |
| `ExtractionRejected` | Store invalid extractions (dead-letter) |
| `AgentRun`           | Log agent execution                     |
| `CoverageReport`     | Store extraction coverage metrics       |

### Agent Output

```typescript
interface ExtractorResult {
  success: boolean
  output: ExtractorOutput | null
  sourcePointerIds: string[] // DEPRECATED: Always [] in PHASE-D
  candidateFactIds: string[] // PHASE-D: Primary output
  error: string | null
}
```

### Downstream Scheduling

> **CONTRACT MISMATCH IDENTIFIED (PHASE-D)**
>
> Location: `extractor.worker.ts:61-84`
>
> ```typescript
> if (result.success && result.sourcePointerIds.length > 0) {
>   // This condition is NEVER true in PHASE-D
>   // because extractor.ts:360 always returns sourcePointerIds: []
> }
> ```
>
> **Impact**: Compose jobs are never queued after extraction.
> **Root Cause**: PHASE-D migrated to CandidateFact but worker was not updated.

| Condition                         | Queue          | Payload                                      |
| --------------------------------- | -------------- | -------------------------------------------- |
| ~~`sourcePointerIds.length > 0`~~ | `composeQueue` | `{ pointerIds, domain, runId, parentJobId }` |

### Gating Conditions

- Evidence must exist
- Content must pass `isReadyForExtraction()` check
- Domain must be valid per `DomainSchema`
- Extraction must pass `validateExtraction()` checks

### Success Definition

- CandidateFact records created (PHASE-D)
- ~~SourcePointer records created~~ (deprecated)
- AgentRun logged with correct `itemsProduced`

---

## Stage 4: Composer

### File Locations

- Worker: `src/lib/regulatory-truth/workers/composer.worker.ts`
- Agent: `src/lib/regulatory-truth/agents/composer.ts`

### Job Payload (Input)

```typescript
interface ComposeJobData {
  pointerIds: string[]
  domain: string
  runId: string
  parentJobId?: string
}
```

### DB Reads

| Table            | Purpose                                  |
| ---------------- | ---------------------------------------- |
| `SourcePointer`  | Get pointers to compose into rule        |
| `Evidence`       | Get evidence for source attribution      |
| `RegulatoryRule` | Check for existing rules (deduplication) |

### DB Writes

| Table                | Effect                            |
| -------------------- | --------------------------------- |
| `RegulatoryRule`     | Create draft rule                 |
| `Concept`            | Upsert concept record             |
| `RuleEdge`           | Create AMENDS edge if superseding |
| `RegulatoryConflict` | Create conflict if detected       |
| `RegulatoryAuditLog` | Log rule creation                 |

### Agent Output

```typescript
interface ComposerResult {
  success: boolean
  output: ComposerOutput | null
  ruleId: string | null
  error: string | null
}
```

### Downstream Scheduling

| Condition                 | Queue          | Payload                              |
| ------------------------- | -------------- | ------------------------------------ |
| Rule created successfully | `reviewQueue`  | `{ ruleId, runId, parentJobId }`     |
| Conflict detected         | `arbiterQueue` | `{ conflictId, runId, parentJobId }` |

### Gating Conditions

- Must have at least one valid SourcePointer
- Domain must not be blocked
- AppliesWhen DSL must be valid

> **CONTRACT MISMATCH IDENTIFIED (PHASE-D)**
>
> Location: `composer.ts:64-66`
>
> ```typescript
> const sourcePointers = await db.sourcePointer.findMany({
>   where: { id: { in: sourcePointerIds } },
> })
> ```
>
> **Impact**: Returns empty array because PHASE-D stopped creating SourcePointers.
> **Root Cause**: Composer still expects SourcePointers but extractor now creates CandidateFacts.

### Success Definition

- RegulatoryRule created with status `DRAFT`
- Rule linked to source pointers
- Job queued to Review or Arbiter

---

## Stage 5: Reviewer

### File Locations

- Worker: `src/lib/regulatory-truth/workers/reviewer.worker.ts`
- Agent: `src/lib/regulatory-truth/agents/reviewer.ts`

### Job Payload (Input)

```typescript
interface ReviewJobData {
  ruleId: string
  runId: string
  parentJobId?: string
}
```

### DB Reads

| Table                | Purpose                     |
| -------------------- | --------------------------- |
| `RegulatoryRule`     | Get rule to review          |
| `SourcePointer`      | Get pointers for validation |
| `RegulatoryConflict` | Check for open conflicts    |

### DB Writes

| Table                | Effect                                   |
| -------------------- | ---------------------------------------- |
| `RegulatoryRule`     | Update status, reviewerNotes, confidence |
| `RegulatoryConflict` | Create conflict if escalating to Arbiter |
| `HumanReviewRequest` | Create review request if needed          |
| `RegulatoryAuditLog` | Log review decision                      |

### Agent Output

```typescript
interface ReviewerResult {
  success: boolean
  output: ReviewerOutput | null
  updatedRuleId: string | null
  error: string | null
}
```

### Downstream Scheduling

| Condition                  | Queue          | Payload                                     |
| -------------------------- | -------------- | ------------------------------------------- |
| T2/T3 with high confidence | `releaseQueue` | `{ ruleIds: [ruleId], runId, parentJobId }` |
| T0/T1 or low confidence    | None           | Awaits human review                         |
| Escalate to Arbiter        | `arbiterQueue` | `{ conflictId, runId, parentJobId }`        |

### Gating Conditions

- Rule must exist
- Rule must have source pointers (INVARIANT)
- T0/T1 rules require human approval

### Success Definition

- Rule status updated appropriately
- T2/T3 rules with high confidence queued to Release
- T0/T1 rules queued for human review

---

## Stage 6: Arbiter

### File Locations

- Worker: `src/lib/regulatory-truth/workers/arbiter.worker.ts`
- Agent: `src/lib/regulatory-truth/agents/arbiter.ts`

### Job Payload (Input)

```typescript
interface ArbiterJobData {
  conflictId: string
  runId: string
  parentJobId?: string
}
```

### DB Reads

| Table                | Purpose                             |
| -------------------- | ----------------------------------- |
| `RegulatoryConflict` | Get conflict to resolve             |
| `RegulatoryRule`     | Get conflicting rules               |
| `SourcePointer`      | Get evidence for resolution         |
| `Evidence`           | Get source hierarchy for precedence |

### DB Writes

| Table                     | Effect                           |
| ------------------------- | -------------------------------- |
| `RegulatoryConflict`      | Update resolution, status        |
| `RegulatoryRule`          | Update losing rule to DEPRECATED |
| `ConflictResolutionAudit` | Create audit trail               |
| `HumanReviewRequest`      | Create if escalating to human    |
| `RegulatoryAuditLog`      | Log resolution                   |

### Agent Output

```typescript
interface ArbiterResult {
  success: boolean
  output: ArbiterOutput | null
  resolution: "RULE_A_PREVAILS" | "RULE_B_PREVAILS" | "MERGE_RULES" | "ESCALATE_TO_HUMAN" | null
  updatedConflictId: string | null
  error: string | null
}
```

### Downstream Scheduling

- No automatic downstream scheduling
- Resolution may trigger human review

### Gating Conditions

- Conflict must exist
- Conflict must be in OPEN status
- Both conflicting items must exist

### Success Definition

- Conflict resolved or escalated
- Losing rule deprecated (if applicable)
- Audit trail created

---

## Stage 7: Releaser

### File Locations

- Worker: `src/lib/regulatory-truth/workers/releaser.worker.ts`
- Agent: `src/lib/regulatory-truth/agents/releaser.ts`

### Job Payload (Input)

```typescript
interface ReleaseJobData {
  ruleIds: string[]
  runId: string
  parentJobId?: string
}
```

### DB Reads

| Table                | Purpose                       |
| -------------------- | ----------------------------- |
| `RegulatoryRule`     | Get approved rules to release |
| `SourcePointer`      | Verify evidence chain         |
| `RuleRelease`        | Get previous version          |
| `RegulatoryConflict` | Verify no open conflicts      |
| `AgentRun`           | Count reviews for audit       |

### DB Writes

| Table                | Effect                     |
| -------------------- | -------------------------- |
| `RuleRelease`        | Create release record      |
| `RegulatoryRule`     | Update status to PUBLISHED |
| `RegulatoryAuditLog` | Log publication            |

### Gating Conditions (HARD GATES)

- All rules must be in APPROVED status
- T0/T1 rules must have `approvedBy` set
- No unresolved conflicts
- All rules must have source pointers
- Evidence strength policy must pass

### Success Definition

- RuleRelease record created with semver version
- All rules updated to PUBLISHED status
- Content sync events emitted
- Embedding jobs queued

---

## AgentRun Outcome Taxonomy

All agent runs are logged with one of these outcomes:

| Outcome                 | Meaning                              | itemsProduced      |
| ----------------------- | ------------------------------------ | ------------------ |
| `SUCCESS_APPLIED`       | LLM ran, output valid, items created | > 0                |
| `SUCCESS_NO_CHANGE`     | LLM ran, output valid, no new items  | 0                  |
| `DUPLICATE_CACHED`      | Cache hit, output reused             | 0 (caller applies) |
| `VALIDATION_REJECTED`   | Output failed schema validation      | 0                  |
| `LOW_CONFIDENCE`        | Confidence below threshold           | 0                  |
| `EMPTY_OUTPUT`          | LLM returned empty extractions       | 0                  |
| `PARSE_FAILED`          | JSON parse or extraction failed      | 0                  |
| `CONTENT_LOW_QUALITY`   | Input too small/poor quality         | 0                  |
| `SKIPPED_DETERMINISTIC` | Deterministic rules skipped LLM      | 0                  |
| `CIRCUIT_OPEN`          | Rate limiter circuit breaker open    | 0                  |
| `RETRY_EXHAUSTED`       | All retries failed                   | 0                  |
| `TIMEOUT`               | Agent timed out                      | 0                  |

**Critical Invariant**: `SUCCESS_APPLIED` **MUST** have `itemsProduced > 0`.

**Runtime Enforcement**: This invariant is enforced at the single choke point
`updateRunOutcome()` in `runner.ts:961-989`. The outcome is derived deterministically
from `itemsProduced`, not passed in by callers:

- `itemsProduced > 0` → `SUCCESS_APPLIED`
- `itemsProduced = 0` → `SUCCESS_NO_CHANGE`

Workers MUST call `updateRunOutcome(agentRunId, itemsProduced)` after processing
to finalize the outcome. The extractor worker does this at `extractor.worker.ts:67-69`.

---

## Known Issues (PHASE-D Migration)

### Issue 1: Extractor → Composer Pipeline Broken

**Symptom**: Compose jobs never queued after extraction.

**Location**: `extractor.worker.ts:61-84`

**Cause**: PHASE-D changed extractor to create `CandidateFact` instead of `SourcePointer`, but:

1. `extractor.ts:360` returns `sourcePointerIds: []` (always empty)
2. Worker checks `result.sourcePointerIds.length > 0` - never true
3. Even if fixed, `composer.ts` queries `SourcePointer` which is empty

**Impact**:

- Extractions succeed but nothing flows to compose
- Pipeline terminates at extraction stage
- Rules never created from extracted facts

**Resolution**: Requires architectural decision:

- Option A: Update worker to use `candidateFactIds` and create new compose path
- Option B: Restore SourcePointer creation in extractor
- Option C: New pipeline from CandidateFact → RuleFact

### Issue 2: itemsProduced Always 0 for SUCCESS_APPLIED

**Symptom**: AgentRun records show `outcome: SUCCESS_APPLIED` but `itemsProduced: 0`.

**Location**: `runner.ts:837-852` vs `extractor.worker.ts`

**Cause**:

- `runner.ts` sets `SUCCESS_APPLIED` but doesn't know item count
- Worker should call `updateRunOutcome(runId, itemCount)` but doesn't
- `extractor.worker.ts:94` returns `pointersCreated: result.sourcePointerIds.length` (always 0)

**Impact**:

- Monitoring queries fail to identify productive runs
- Cannot distinguish "LLM worked, nothing extracted" from "LLM worked, items created"

**Resolution**: Worker must call `updateRunOutcome()` with actual `candidateFactIds.length`.

---

## Correlation Fields

All stages pass these fields for end-to-end tracing:

| Field         | Purpose                 | Source               |
| ------------- | ----------------------- | -------------------- |
| `runId`       | Pipeline run identifier | Sentinel creates     |
| `jobId`       | BullMQ job ID           | Worker provides      |
| `parentJobId` | Previous stage job ID   | Previous stage       |
| `sourceSlug`  | Source identifier       | Evidence.source.slug |
| `queueName`   | Current queue name      | Worker provides      |

---

## Queue Configuration

| Queue      | Rate Limit | Retry Config                    |
| ---------- | ---------- | ------------------------------- |
| `sentinel` | 5/60s      | 3 attempts, exponential backoff |
| `ocr`      | 5/60s      | 3 attempts, exponential backoff |
| `extract`  | 10/60s     | 3 attempts, exponential backoff |
| `compose`  | 5/60s      | 3 attempts, exponential backoff |
| `review`   | 5/60s      | 3 attempts, exponential backoff |
| `arbiter`  | 5/60s      | 3 attempts, exponential backoff |
| `release`  | 5/60s      | 3 attempts, exponential backoff |

Default retry: 10s → 20s → 40s (exponential with 2x factor)
