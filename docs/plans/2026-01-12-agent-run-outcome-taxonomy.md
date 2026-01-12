# PR-A: AgentRun Outcome Taxonomy + Correlation Fields

**Date:** 2026-01-12
**Status:** Ready for implementation
**Goal:** Make every RTL AgentRun attributable, classifiable, measurable, and auditable.

## Problem Statement

Current AgentRun table lacks:

- Outcome granularity (only success/failed, no parse_fail/low_confidence/empty)
- State transition recording (can't measure effectiveness)
- Correlation fields (runId/jobId/sourceSlug missing)
- Prompt versioning (no audit trail for prompt changes)
- Input metrics (only output tokens, not input)

This makes waste analysis impossible - we can't answer "how many LLM calls produced no value?"

## Schema Changes

### New Enums

```prisma
enum AgentRunStatus {
  RUNNING
  COMPLETED
  FAILED
}

enum AgentRunOutcome {
  SUCCESS_APPLIED        // Output validated and state advanced
  SUCCESS_NO_CHANGE      // Output valid but no new information
  VALIDATION_REJECTED    // Failed deterministic validation
  LOW_CONFIDENCE         // Below confidence threshold
  EMPTY_OUTPUT           // LLM returned empty/null
  PARSE_FAILED           // LLM output not valid JSON
  CONTENT_LOW_QUALITY    // Pre-filter rejected input
  SKIPPED_DETERMINISTIC  // Pre-LLM rules decided no LLM needed
  CIRCUIT_OPEN           // Circuit breaker prevented call
  DUPLICATE_CACHED       // Cache hit, no LLM call (PR-B)
  RETRY_EXHAUSTED        // All retries failed
  TIMEOUT                // Aborted due to timeout
}

enum NoChangeCode {
  ALREADY_EXTRACTED
  DUPLICATE_POINTERS
  NO_RELEVANT_CHANGES
  BELOW_MIN_CONFIDENCE
  VALIDATION_BLOCKED
}
```

### AgentRun Model Updates

```prisma
model AgentRun {
  id          String           @id @default(cuid())
  agentType   AgentType
  status      AgentRunStatus   @default(RUNNING)  // Was: String

  // Existing
  input       Json
  output      Json?
  rawOutput   Json?
  error       String?
  tokensUsed  Int?
  durationMs  Int?
  confidence  Float?

  // NEW: Input metrics
  inputChars  Int?
  inputBytes  Int?

  // NEW: Prompt provenance
  promptTemplateId      String?
  promptTemplateVersion String?
  promptHash            String?

  // NEW: Outcome taxonomy
  outcome        AgentRunOutcome?
  noChangeCode   NoChangeCode?
  noChangeDetail String?
  itemsProduced  Int              @default(0)

  // NEW: Correlation
  runId         String?
  jobId         String?
  parentJobId   String?
  sourceSlug    String?
  queueName     String?

  // NEW: Retry tracking
  attempt          Int              @default(1)

  // NEW: Cache metadata (for PR-B)
  inputContentHash String?
  cacheHit         Boolean @default(false)

  // Existing linkage
  evidenceId  String?
  ruleId      String?
  rule        RegulatoryRule? @relation(fields: [ruleId], references: [id])

  startedAt   DateTime @default(now())
  completedAt DateTime?

  // Indexes
  @@index([agentType])
  @@index([status])
  @@index([outcome])
  @@index([startedAt])
  @@index([agentType, outcome, startedAt])
  @@index([queueName, outcome, startedAt])
  @@index([inputContentHash])
  @@index([runId])
  @@index([sourceSlug, startedAt])
}
```

## Implementation Steps

### Step 0: Migration

1. Add enums to schema.prisma
2. Change `status String` to `status AgentRunStatus`
3. Add all new fields and indexes
4. Generate migration with status mapping:
   - `running` -> `RUNNING`
   - `completed` -> `COMPLETED`
   - `failed` -> `FAILED`
   - unknown -> `FAILED`

### Step 1: Extend AgentRunOptions

**File:** `src/lib/regulatory-truth/agents/runner.ts`

```typescript
export interface AgentRunOptions<TInput, TOutput> {
  agentType: AgentType
  input: TInput
  inputSchema: z.ZodType<TInput>
  outputSchema: z.ZodType<TOutput>
  temperature?: number
  maxRetries?: number
  evidenceId?: string
  ruleId?: string
  softFail?: boolean

  // NEW: Correlation
  runId?: string
  jobId?: string
  parentJobId?: string
  sourceSlug?: string
  queueName?: string
}
```

Compute `inputChars/inputBytes/inputContentHash` inside runner from `input`.

### Step 2: Prompt Registry Module

**File:** `src/lib/regulatory-truth/agents/prompt-registry.ts`

Create a single canonical source for prompt provenance:

```typescript
export interface PromptRegistryEntry {
  templateId: string // e.g., "rtl.extractor.v1"
  version: string // e.g., "2026-01-12"
  buildPrompt: (input: unknown) => string
}

export const PROMPT_REGISTRY: Record<AgentType, PromptRegistryEntry> = {
  EXTRACTOR: {
    templateId: "rtl.extractor.v1",
    version: "2026-01-12",
    buildPrompt: (input) => {
      /* ... */
    },
  },
  // ... other agents
}
```

In runner, before model call:

1. Look up `PROMPT_REGISTRY[agentType]`
2. Call `buildPrompt(input)` to get final prompt text
3. Compute `promptHash = sha256(promptText)`
4. Store `templateId`, `version`, `promptHash`

This prevents templateId drift across workers.

### Step 3: Pre-LLM Gate (CONTENT_LOW_QUALITY + SKIPPED_DETERMINISTIC)

**Before calling the model**, run cheap gates:

```typescript
// In runner, before model call:

// Gate 1: Content quality check
const inputStr = JSON.stringify(input)
const inputBytes = Buffer.byteLength(inputStr, "utf8")
const inputChars = inputStr.length

const MIN_INPUT_BYTES = 100 // Configurable per agent
if (inputBytes < MIN_INPUT_BYTES) {
  return earlyExit("CONTENT_LOW_QUALITY", "Input below minimum threshold")
}

// Gate 2: Deterministic skip hook (stub for now, always returns false)
if (shouldSkipLLM(agentType, input)) {
  return earlyExit("SKIPPED_DETERMINISTIC", "Deterministic rules decided LLM not needed")
}

// Proceed to LLM call...
```

This ensures both outcomes are reachable from day one.

### Step 4: Outcome Taxonomy Wiring

| Condition                                       | outcome               | status    | noChangeCode           |
| ----------------------------------------------- | --------------------- | --------- | ---------------------- |
| **Pre-LLM gates**                               |                       |           |                        |
| Input below minimum threshold                   | CONTENT_LOW_QUALITY   | COMPLETED | NO_RELEVANT_CHANGES    |
| Deterministic rules say skip                    | SKIPPED_DETERMINISTIC | COMPLETED | -                      |
| **Post-LLM outcomes**                           |                       |           |                        |
| Output parses, passes validation, items created | SUCCESS_APPLIED       | COMPLETED | -                      |
| Output parses, passes validation, no items      | SUCCESS_NO_CHANGE     | COMPLETED | (set appropriate code) |
| Output parses, fails deterministic validation   | VALIDATION_REJECTED   | COMPLETED | VALIDATION_BLOCKED     |
| Output parses, confidence < threshold           | LOW_CONFIDENCE        | COMPLETED | BELOW_MIN_CONFIDENCE   |
| Output empty/null                               | EMPTY_OUTPUT          | COMPLETED | -                      |
| Output not valid JSON                           | PARSE_FAILED          | FAILED    | -                      |
| Circuit breaker open                            | CIRCUIT_OPEN          | FAILED    | -                      |
| All retries failed                              | RETRY_EXHAUSTED       | FAILED    | -                      |
| Timeout                                         | TIMEOUT               | FAILED    | -                      |

### Step 5: Plumb Correlation from Workers

**Files to update:**

- `src/lib/regulatory-truth/workers/extractor.worker.ts`
- `src/lib/regulatory-truth/workers/composer.worker.ts`
- `src/lib/regulatory-truth/workers/reviewer.worker.ts`
- `src/lib/regulatory-truth/workers/ocr.worker.ts`
- `src/lib/regulatory-truth/workers/sentinel.worker.ts`

In each worker, pass to runAgent:

```typescript
{
  runId: job.data.runId,
  jobId: String(job.id),
  parentJobId: job.data.parentJobId,
  sourceSlug: evidence?.source?.slug,
  queueName: 'extract', // or 'compose', 'review', etc.
}
```

### Step 6: Tests

1. Migration test: status string mapping
2. Runner test: correlation fields persisted
3. Runner test: outcomes set correctly for each scenario
4. Runner test: promptHash is stable

### Step 7: Backfill Strategy

- Set `outcome=null` for legacy rows (don't backfill)
- They remain queryable by status/agentType/startedAt

## Key Queries Enabled

```sql
-- Waste KPI: calls with no state change
SELECT outcome, COUNT(*)
FROM "AgentRun"
WHERE outcome IN ('SUCCESS_NO_CHANGE', 'VALIDATION_REJECTED', 'EMPTY_OUTPUT')
GROUP BY outcome;

-- Waste by queue
SELECT queueName, outcome, COUNT(*)
FROM "AgentRun"
WHERE startedAt > now() - interval '24 hours'
GROUP BY queueName, outcome;

-- Calls per evidence (p99 hotspots)
SELECT evidenceId, COUNT(*) as calls
FROM "AgentRun"
WHERE evidenceId IS NOT NULL
GROUP BY evidenceId
ORDER BY calls DESC
LIMIT 100;
```

## Success Criteria

- [ ] Migration applies cleanly
- [ ] All workers pass correlation fields
- [ ] Runner sets outcome for all code paths
- [ ] promptHash is deterministic
- [ ] Tests pass
- [ ] Can run waste query and get meaningful results

## Rollback

If issues arise:

1. Revert migration (drop new columns, restore status as String)
2. Revert runner.ts and worker changes
3. Old AgentRun records remain intact (additive schema change)

## Follow-up: PR-B

Once PR-A is merged, PR-B will add:

- Content-hash cache table
- Pre-LLM cache lookup
- `DUPLICATE_CACHED` outcome path
- Cache hit rate metrics
