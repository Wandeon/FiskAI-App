# RTL Pipeline Contracts

> Document version: 2026-01-13
>
> This document defines the contracts between RTL pipeline stages.
> Each stage must satisfy its contract for the pipeline to function correctly.

## Overview

The Regulatory Truth Layer (RTL) pipeline processes regulatory content through these stages:

```
sentinel → ocr (optional) → extract → compose → apply → review → arbiter → release
```

**PHASE-D Architecture** (2026-01-13):

- **Compose**: Generates proposals (LLM only, no DB writes)
- **Apply**: Persists truth (SourcePointer + RegulatoryRule creation)

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

> **PHASE-D (RESOLVED)**: Extractor now queues compose jobs using `candidateFactIds`.
> CandidateFact is the inter-stage carrier between extractor and composer.

| Condition                     | Queue          | Payload                                            |
| ----------------------------- | -------------- | -------------------------------------------------- |
| `candidateFactIds.length > 0` | `composeQueue` | `{ candidateFactIds, domain, runId, parentJobId }` |

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

## Stage 4: Composer (PHASE-D: Proposal Generation Only)

### File Locations

- Worker: `src/lib/regulatory-truth/workers/composer.worker.ts`
- Agent: `src/lib/regulatory-truth/agents/composer.ts`

### Job Payload (Input)

```typescript
interface ComposeJobData {
  candidateFactIds: string[] // PHASE-D: Primary input
  domain: string
  runId: string
  parentJobId?: string
}
```

### DB Reads

| Table            | Purpose                                  |
| ---------------- | ---------------------------------------- |
| `CandidateFact`  | Get candidate facts to compose into rule |
| `Evidence`       | Get evidence for source attribution      |
| `RegulatoryRule` | Check for existing rules (deduplication) |

### DB Writes

**PHASE-D: Composer performs NO DB writes.**

All persistence is delegated to the Apply stage.

| Table      | Effect                           |
| ---------- | -------------------------------- |
| `AgentRun` | Log agent execution (via runner) |

### Agent Output

```typescript
interface ComposerProposal {
  success: boolean
  output: ComposerOutput | null
  agentRunId: string | null
  candidateFactIds: string[]
  error: string | null
}
```

### Downstream Scheduling

| Condition          | Queue        | Payload                                    |
| ------------------ | ------------ | ------------------------------------------ |
| Proposal generated | `applyQueue` | `{ proposal, domain, runId, parentJobId }` |

### Gating Conditions

- Must have at least one valid CandidateFact
- Domain must be valid per `DomainSchema`
- AppliesWhen DSL must be valid

### Success Definition

- ComposerProposal generated with valid output
- Apply job queued with proposal
- No persistence performed (delegated to Apply)

---

## Stage 5: Apply (PHASE-D: Truth Persistence)

### File Locations

- Worker: `src/lib/regulatory-truth/workers/apply.worker.ts`
- Agent: `src/lib/regulatory-truth/agents/composer.ts` (applyComposerProposal function)

### Job Payload (Input)

```typescript
interface ApplyJobData {
  proposal: ComposerProposal
  domain: string
  runId: string
  parentJobId?: string
}
```

### DB Reads

| Table            | Purpose                                  |
| ---------------- | ---------------------------------------- |
| `CandidateFact`  | Get candidate facts from proposal        |
| `Evidence`       | Get evidence for source attribution      |
| `RegulatoryRule` | Check for existing rules (deduplication) |

### DB Writes

| Table                | Effect                            |
| -------------------- | --------------------------------- |
| `SourcePointer`      | Create source pointers from facts |
| `RegulatoryRule`     | Create draft rule                 |
| `Concept`            | Upsert concept record             |
| `RuleEdge`           | Create AMENDS edge if superseding |
| `RegulatoryConflict` | Create conflict if detected       |
| `RegulatoryAuditLog` | Log rule creation                 |

### Agent Output

```typescript
interface ApplyResult {
  success: boolean
  ruleId: string | null
  sourcePointerIds: string[]
  error: string | null
}
```

### Downstream Scheduling

| Condition                 | Queue         | Payload                              |
| ------------------------- | ------------- | ------------------------------------ |
| Rule created successfully | `reviewQueue` | `{ ruleId, runId, parentJobId }`     |
| Conflict detected         | None          | Arbiter picks up from conflict table |

### Gating Conditions

- Proposal must be valid (non-null candidateFactIds)
- Domain must not be blocked
- Must not duplicate existing rule

### Success Definition

- SourcePointer records created from CandidateFacts
- RegulatoryRule created with status `DRAFT`
- Rule linked to source pointers
- AgentRun outcome updated via `updateRunOutcome()`
- Review job queued if rule created

---

## Stage 6: Reviewer

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

## Stage 7: Arbiter

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

## Stage 8: Releaser

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

### ~~Issue 1: Extractor → Composer Pipeline Broken~~ (RESOLVED)

**Status**: ✅ RESOLVED (2026-01-13)

**Resolution**: PHASE-D architecture implemented with clean stage separation:

1. Extractor creates `CandidateFact` records and queues compose jobs with `candidateFactIds`
2. Composer generates proposals (LLM only, no persistence) via `generateComposerProposal()`
3. Apply stage handles all persistence via `applyComposerProposal()`

**Key Changes**:

- `extractor.worker.ts`: Queues compose jobs with `candidateFactIds` grouped by domain
- `composer.worker.ts`: Calls `generateComposerProposal()`, queues apply jobs
- `apply.worker.ts`: NEW - Calls `applyComposerProposal()`, queues review jobs
- Clean separation: Compose = interpret (LLM), Apply = persist (DB writes)

### ~~Issue 2: itemsProduced Always 0 for SUCCESS_APPLIED~~ (RESOLVED)

**Status**: ✅ RESOLVED (2026-01-13)

**Resolution**: Workers now call `updateRunOutcome(agentRunId, itemsProduced)` after processing:

- `extractor.worker.ts:67-69`: Updates with `candidateFactIds.length`
- `apply.worker.ts:53-56`: Updates with `1` if rule created, `0` otherwise

The single choke point `updateRunOutcome()` in `runner.ts` ensures outcome is derived from actual `itemsProduced` count.

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
| `ocr`      | 2/60s      | 3 attempts, exponential backoff |
| `extract`  | 10/60s     | 3 attempts, exponential backoff |
| `compose`  | 5/60s      | 3 attempts, exponential backoff |
| `apply`    | 5/60s      | 3 attempts, exponential backoff |
| `review`   | 5/60s      | 3 attempts, exponential backoff |
| `arbiter`  | 3/60s      | 3 attempts, exponential backoff |
| `release`  | 2/60s      | 3 attempts, exponential backoff |

Default retry: 10s → 20s → 40s (exponential with 2x factor)
