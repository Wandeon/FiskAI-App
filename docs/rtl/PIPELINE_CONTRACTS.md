# RTL Pipeline Contracts

> Document version: 2026-01-13
>
> This document defines the contracts between RTL pipeline stages.
> Each stage must satisfy its contract for the pipeline to function correctly.

## Overview

The Regulatory Truth Layer (RTL) pipeline processes regulatory content through these stages:

```
sentinel → scout → router → [ocr | extract | skip] → compose → apply → review → arbiter → release
```

**Cheap-First Strategy** (2026-01-13):

- **Scout**: Deterministic content quality assessment (no LLM)
- **Router**: Budget-aware routing decisions (no LLM)
- **Budget Governor**: Token caps, circuit breaker, cooldowns

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

| Condition               | Queue        | Payload                              |
| ----------------------- | ------------ | ------------------------------------ |
| New evidence discovered | `scoutQueue` | `{ evidenceId, runId, parentJobId }` |

> **Note**: Sentinel no longer routes directly to OCR/Extract. All content is first
> assessed by Scout for quality/budget checks.

### Gating Conditions

- Endpoint must be active (`isActive: true`)
- Endpoint must not exceed error threshold (`consecutiveErrors < 5`)
- Scrape frequency must be due
- Domain must not be blocked (`isBlockedDomain()` check)

### Success Definition

- Evidence record created with valid `contentHash`
- Job queued to next stage (OCR or Extract)

---

## Stage 2: Scout (Cheap-First)

### File Locations

- Worker: `src/lib/regulatory-truth/workers/content-scout.worker.ts`
- Logic: `src/lib/regulatory-truth/workers/content-scout.ts`

### Job Payload (Input)

```typescript
interface ScoutJobData {
  evidenceId: string
  runId: string
  parentJobId?: string
}
```

### DB Reads

| Table      | Purpose                            |
| ---------- | ---------------------------------- |
| `Evidence` | Get content for quality assessment |

### DB Writes

| Table              | Effect                                    |
| ------------------ | ----------------------------------------- |
| `PipelineProgress` | Record scouting outcome for observability |

### Scout Logic (No LLM)

1. **Length checks**: Min 100 chars, max 500KB
2. **Language detection**: Croatian, English, German supported
3. **Duplicate detection**: Content hash comparison
4. **Boilerplate ratio**: Skip if >70% navigation/footer content
5. **Regulatory signal**: Calculate value score (0-1)
6. **OCR detection**: Check if PDF needs OCR processing
7. **Document classification**: LEGISLATION, REGULATION, GUIDELINE, FORM, FAQ, NEWS

### Scout Output

```typescript
interface ScoutResult {
  worthItScore: number // 0-1, probability content has value
  docType: DocumentType // Classification result
  needsOCR: boolean // PDF requires OCR
  duplicateOf?: string // Hash if duplicate detected
  skipReason?: string // Why we're skipping
  contentLength: number
  language: string
  boilerplateRatio: number
  hasStructuredData: boolean
  estimatedTokens: number
  determinismConfidence: number // How confident without LLM (0-1)
}
```

### Downstream Scheduling

| Condition      | Queue         | Payload                                          |
| -------------- | ------------- | ------------------------------------------------ |
| Scout complete | `routerQueue` | `{ evidenceId, scoutResult, sourceSlug, runId }` |

### Gating Conditions

- Evidence must exist
- Content must be extractable

### Success Definition

- ScoutResult generated with worthItScore
- Router job queued with scout results

---

## Stage 3: Router (Budget-Aware)

### File Locations

- Worker: `src/lib/regulatory-truth/workers/router.worker.ts`
- Budget: `src/lib/regulatory-truth/workers/budget-governor.ts`

### Job Payload (Input)

```typescript
interface RouterJobData {
  evidenceId: string
  scoutResult: ScoutResult
  sourceSlug: string
  runId: string
  parentJobId?: string
}
```

### DB Reads

| Table | Purpose                     |
| ----- | --------------------------- |
| None  | Uses in-memory budget state |

### DB Writes

| Table              | Effect                                    |
| ------------------ | ----------------------------------------- |
| `PipelineProgress` | Record routing decision for observability |

### Routing Decision Logic

```typescript
type RoutingDecision =
  | "SKIP" // Skip entirely, no value expected
  | "OCR" // Route to OCR worker first
  | "EXTRACT_LOCAL" // Extract using local Ollama
  | "EXTRACT_CLOUD" // Extract using cloud LLM (last resort)
```

**Decision Rules**:

1. If `scoutResult.skipReason` exists → SKIP
2. If `worthItScore < 0.4` → SKIP
3. If `needsOCR` → OCR
4. If budget denied → SKIP (with reason)
5. If `recommendedProvider === LOCAL_OLLAMA` → EXTRACT_LOCAL
6. If `worthItScore >= 0.7` and cloud allowed → EXTRACT_CLOUD
7. Default → EXTRACT_LOCAL

### Downstream Scheduling

| Decision      | Queue          | Payload                                                           |
| ------------- | -------------- | ----------------------------------------------------------------- |
| SKIP          | None           | Content skipped, no further processing                            |
| OCR           | `ocrQueue`     | `{ evidenceId, runId, parentJobId }`                              |
| EXTRACT_LOCAL | `extractQueue` | `{ evidenceId, runId, parentJobId, llmProvider: "LOCAL_OLLAMA" }` |
| EXTRACT_CLOUD | `extractQueue` | `{ evidenceId, runId, parentJobId, llmProvider: "CLOUD_OLLAMA" }` |

### Gating Conditions

- ScoutResult must be valid
- Budget must be available (not exceeded)
- Circuit must be closed

### Success Definition

- Routing decision made
- Appropriate queue populated (or skip logged)
- Progress event recorded

---

## Stage 4: OCR Worker

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

| Queue      | Rate Limit | Retry Config                    | Purpose                    |
| ---------- | ---------- | ------------------------------- | -------------------------- |
| `sentinel` | 5/60s      | 3 attempts, exponential backoff | Discovery and fetching     |
| `scout`    | 20/60s     | 3 attempts, exponential backoff | Pre-LLM quality assessment |
| `router`   | 20/60s     | 3 attempts, exponential backoff | Budget-aware routing       |
| `ocr`      | 2/60s      | 3 attempts, exponential backoff | PDF OCR processing         |
| `extract`  | 10/60s     | 3 attempts, exponential backoff | LLM fact extraction        |
| `compose`  | 5/60s      | 3 attempts, exponential backoff | Rule composition           |
| `apply`    | 5/60s      | 3 attempts, exponential backoff | Truth persistence          |
| `review`   | 5/60s      | 3 attempts, exponential backoff | Quality review             |
| `arbiter`  | 3/60s      | 3 attempts, exponential backoff | Conflict resolution        |
| `release`  | 2/60s      | 3 attempts, exponential backoff | Publication                |

Default retry: 10s → 20s → 40s (exponential with 2x factor)

---

## Budget Governor Rules

The Budget Governor controls LLM spending with multiple protection layers.

### File Location

- `src/lib/regulatory-truth/workers/budget-governor.ts`

### Configuration

```typescript
interface BudgetConfig {
  globalDailyTokenCap: number // Default: 500,000 tokens/day
  perSourceDailyTokenCap: number // Default: 50,000 tokens/source/day
  perEvidenceMaxTokens: number // Default: 8,000 tokens/evidence
  maxConcurrentCloudCalls: number // Default: 3
  maxConcurrentLocalCalls: number // Default: 5
  cloudCallCooldownMs: number // Default: 2,000ms
  emptyOutputCooldownMs: number // Default: 3,600,000ms (1 hour)
  emptyOutputThreshold: number // Default: 3 empty outputs
}
```

### Denial Reasons

| Denial Reason               | Description                                    | Recovery                |
| --------------------------- | ---------------------------------------------- | ----------------------- |
| `GLOBAL_DAILY_CAP_EXCEEDED` | Global token budget exhausted                  | Wait for daily reset    |
| `SOURCE_DAILY_CAP_EXCEEDED` | Source-specific budget exhausted               | Wait for daily reset    |
| `EVIDENCE_TOO_LARGE`        | Content exceeds per-evidence limit             | Manual review required  |
| `CIRCUIT_OPEN`              | Circuit breaker triggered by auth/quota errors | Manual circuit close    |
| `SOURCE_IN_COOLDOWN`        | Source producing empty outputs                 | Clear cooldown manually |
| `CONCURRENT_LIMIT_REACHED`  | All concurrent slots in use                    | Wait and retry          |

### Circuit Breaker

Opens on:

- `AUTH_ERROR`: Authentication failures (API key issues)
- `QUOTA_ERROR`: Provider quota exceeded

When open:

- ALL LLM calls blocked
- Must be manually closed via `closeCircuit()`

### Source Cooldown

Triggered when:

- A source produces `emptyOutputThreshold` consecutive empty extractions

Effect:

- Source blocked from LLM calls for `emptyOutputCooldownMs`
- Other sources unaffected

Recovery:

- Wait for cooldown to expire
- Manual clear via `clearSourceCooldown(sourceSlug)`

### LLM Provider Priority

```
1. LOCAL_OLLAMA   (always preferred)
2. CLOUD_OLLAMA   (only if score >= 0.7 and local unavailable)
3. CLOUD_OPENAI   (last resort, highest quality content only)
```

---

## Source Health Scoring

> Added: 2026-01-13

The Source Health system implements self-correcting feedback loops that automatically
adjust routing and budget decisions based on per-source performance metrics.

### File Locations

- Model: `prisma/schema.prisma` (SourceHealth model)
- Logic: `src/lib/regulatory-truth/workers/source-health.ts`
- Integration: `router.worker.ts`, `budget-governor.ts`, `progress-tracker.ts`

### Health Score Computation

Health scores (0-1) are computed from rolling window metrics:

```typescript
healthScore = successRate × 0.5 + efficiencyScore × 0.3 - penalties

where:
  successRate = successCount / totalAttempts
  efficiencyScore = min(1, 2000 / tokensPerItem)
  penalties = (emptyRate × 0.1 + errorRate × 0.2) × 10
```

### Health Thresholds and Adaptive Behavior

| Health Level | Score Range | Scout Threshold | Cloud Access | Budget Multiplier |
| ------------ | ----------- | --------------- | ------------ | ----------------- |
| EXCELLENT    | ≥ 0.8       | 0.30            | ✓ Allowed    | 1.5× (50% bonus)  |
| GOOD         | 0.6 – 0.8   | 0.35            | ✓ Allowed    | 1.2× (20% bonus)  |
| FAIR         | 0.4 – 0.6   | 0.40 (default)  | ✓ Allowed    | 1.0× (normal)     |
| POOR         | 0.2 – 0.4   | 0.50            | ✗ Restricted | 0.5× (half)       |
| CRITICAL     | < 0.2       | 0.70            | ✗ Restricted | 0.2× (20%)        |

### Auto-Pause and Recovery

Sources with health below CRITICAL (0.1) are automatically paused:

- Paused sources cannot consume any budget
- Auto-unpause after configurable duration (default: 24 hours)
- Manual unpause via `unpauseSource(sourceSlug)`

### Integration Points

**Router** (adaptive thresholds):

```typescript
const healthData = await getSourceHealth(sourceSlug)
// Uses healthData.minScoutScore instead of fixed 0.4
// Uses healthData.allowCloud for cloud routing decisions
```

**Budget Governor** (budget reallocation):

```typescript
const adjustedCap = perSourceDailyTokenCap * healthData.budgetMultiplier
// High-health sources get up to 1.5× budget
// Low-health sources get as little as 0.2× budget
```

**Progress Tracker** (health updates):

```typescript
// On flush, derives outcomes from LLM-using stages
// Calls recordOutcome() to update health metrics
```

### Database Model

```prisma
model SourceHealth {
  id                  String    @id @default(cuid())
  sourceSlug          String    @unique
  windowStartAt       DateTime  @default(now())
  windowSizeHours     Int       @default(168)   // 7 days
  totalAttempts       Int       @default(0)
  successCount        Int       @default(0)
  emptyCount          Int       @default(0)
  errorCount          Int       @default(0)
  totalTokensUsed     Int       @default(0)
  totalItemsProduced  Int       @default(0)
  avgTokensPerItem    Float     @default(0)
  healthScore         Float     @default(0.5)
  isPaused            Boolean   @default(false)
  pausedAt            DateTime?
  pauseReason         String?
  pauseExpiresAt      DateTime?
  minScoutScore       Float     @default(0.4)
  allowCloud          Boolean   @default(true)
  budgetMultiplier    Float     @default(1.0)
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  lastBatchAt         DateTime?
}
```

### Safety Invariants

1. **Paused sources cannot consume cloud LLM budget**: Enforced at `checkBudgetWithHealth()`
2. **Health changes are monotonic per update**: Single incremental updates prevent wild swings
3. **Router decisions change at threshold boundaries**: Tests verify boundary behavior

### Key Functions

| Function                      | Purpose                                     |
| ----------------------------- | ------------------------------------------- |
| `computeHealthScore()`        | Pure function: compute score from counts    |
| `computeAdaptiveThresholds()` | Pure function: derive thresholds from score |
| `getSourceHealth()`           | Get health data with caching (30s TTL)      |
| `recordOutcome()`             | Record single outcome and update health     |
| `syncHealthFromProgress()`    | Batch sync from PipelineProgress data       |
| `pauseSource()`               | Manual pause with reason and duration       |
| `unpauseSource()`             | Manual unpause                              |

---

## Error → Retry Matrix

How different error types are handled across stages:

### Error Classifications

| Error Class  | Description                            | Example                                       |
| ------------ | -------------------------------------- | --------------------------------------------- |
| `TRANSIENT`  | Temporary failures, safe to retry      | Network timeout, temporary server error       |
| `VALIDATION` | Data validation failed, may be fixable | Schema validation error, constraint violation |
| `AUTH`       | Authentication/authorization failure   | Invalid API key, expired token                |
| `QUOTA`      | Rate limit or quota exceeded           | OpenAI rate limit, budget exceeded            |
| `CONTENT`    | Content-related issue                  | Empty content, unsupported format             |
| `INTERNAL`   | System error                           | Bug, unexpected state                         |

### Retry Behavior by Error Class

| Error Class  | Retry? | Max Attempts | Circuit Impact       | Notes                           |
| ------------ | ------ | ------------ | -------------------- | ------------------------------- |
| `TRANSIENT`  | Yes    | 3            | None                 | Exponential backoff             |
| `VALIDATION` | No     | 1            | None                 | Move to DLQ for inspection      |
| `AUTH`       | No     | 1            | **Opens circuit**    | Blocks ALL LLM calls            |
| `QUOTA`      | No     | 1            | **Opens circuit**    | Blocks ALL LLM calls            |
| `CONTENT`    | No     | 1            | Cooldown if repeated | Source cooldown after threshold |
| `INTERNAL`   | Yes    | 2            | None                 | Alert on second failure         |

### Stage-Specific Handling

| Stage   | TRANSIENT | VALIDATION    | AUTH/QUOTA   | CONTENT             |
| ------- | --------- | ------------- | ------------ | ------------------- |
| Scout   | Retry     | Skip evidence | N/A (no LLM) | Skip with reason    |
| Router  | Retry     | Skip evidence | Open circuit | Skip with reason    |
| OCR     | Retry     | DLQ           | Open circuit | Mark needs-manual   |
| Extract | Retry     | DLQ           | Open circuit | Record empty + cool |
| Compose | Retry     | DLQ           | Open circuit | Pass empty to apply |
| Apply   | Retry     | DLQ           | N/A (no LLM) | DLQ                 |
| Review  | Retry     | DLQ           | Open circuit | Escalate to human   |

### Progress Tracking

All errors are recorded in `PipelineProgress` with:

- `errorClass`: Classification
- `errorMessage`: Full error message
- `stageName`: Where error occurred
- `sourceSlug`: Which source affected
