# Visible Reasoning UX - Track 1: Foundation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish type definitions, database schema, and core infrastructure for the Visible Reasoning pipeline.

**Architecture:** Create the foundational TypeScript types that define ReasoningEvent, payloads, and terminal outcomes. Add Prisma schema for ReasoningTrace audit table. All subsequent tracks depend on this foundation.

**Tech Stack:** TypeScript, Prisma, PostgreSQL, Zod validation

---

## Task 1: Create Reasoning Event Types

**Files:**

- Create: `src/lib/assistant/reasoning/types.ts`
- Test: `src/lib/assistant/reasoning/__tests__/types.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/assistant/reasoning/__tests__/types.test.ts
import { describe, it, expect } from "vitest"
import {
  SCHEMA_VERSION,
  REASONING_STAGES,
  isTerminal,
  getTerminalOutcome,
  type ReasoningEvent,
  type ReasoningStage,
  type TerminalOutcome,
} from "../types"

describe("Reasoning Types", () => {
  describe("SCHEMA_VERSION", () => {
    it("should be 1", () => {
      expect(SCHEMA_VERSION).toBe(1)
    })
  })

  describe("REASONING_STAGES", () => {
    it("should contain all 7 reasoning stages in order", () => {
      expect(REASONING_STAGES).toEqual([
        "CONTEXT_RESOLUTION",
        "SOURCES",
        "RETRIEVAL",
        "APPLICABILITY",
        "CONFLICTS",
        "ANALYSIS",
        "CONFIDENCE",
      ])
    })
  })

  describe("isTerminal", () => {
    it("returns true for ANSWER stage", () => {
      const event = { stage: "ANSWER" } as ReasoningEvent
      expect(isTerminal(event)).toBe(true)
    })

    it("returns true for QUALIFIED_ANSWER stage", () => {
      const event = { stage: "QUALIFIED_ANSWER" } as ReasoningEvent
      expect(isTerminal(event)).toBe(true)
    })

    it("returns true for REFUSAL stage", () => {
      const event = { stage: "REFUSAL" } as ReasoningEvent
      expect(isTerminal(event)).toBe(true)
    })

    it("returns true for ERROR stage", () => {
      const event = { stage: "ERROR" } as ReasoningEvent
      expect(isTerminal(event)).toBe(true)
    })

    it("returns false for non-terminal stages", () => {
      const event = { stage: "SOURCES" } as ReasoningEvent
      expect(isTerminal(event)).toBe(false)
    })
  })

  describe("getTerminalOutcome", () => {
    it("returns ANSWER for ANSWER stage", () => {
      const event = { stage: "ANSWER" } as ReasoningEvent
      expect(getTerminalOutcome(event)).toBe("ANSWER")
    })

    it("returns null for non-terminal stages", () => {
      const event = { stage: "ANALYSIS" } as ReasoningEvent
      expect(getTerminalOutcome(event)).toBeNull()
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/assistant/reasoning/__tests__/types.test.ts`
Expected: FAIL with "Cannot find module '../types'"

**Step 3: Write the implementation**

```typescript
// src/lib/assistant/reasoning/types.ts

// === SCHEMA VERSION ===
export const SCHEMA_VERSION = 1 as const

// === REASONING STAGES ===
export const REASONING_STAGES = [
  "CONTEXT_RESOLUTION",
  "SOURCES",
  "RETRIEVAL",
  "APPLICABILITY",
  "CONFLICTS",
  "ANALYSIS",
  "CONFIDENCE",
] as const

export type ReasoningStage =
  | "CONTEXT_RESOLUTION"
  | "CLARIFICATION"
  | "SOURCES"
  | "RETRIEVAL"
  | "APPLICABILITY"
  | "CONFLICTS"
  | "ANALYSIS"
  | "CONFIDENCE"
  | "ANSWER"
  | "QUALIFIED_ANSWER"
  | "REFUSAL"
  | "ERROR"

export type ReasoningStatus = "started" | "progress" | "checkpoint" | "complete" | "awaiting_input"

export type Severity = "info" | "warning" | "critical"

export type TerminalOutcome = "ANSWER" | "QUALIFIED_ANSWER" | "REFUSAL" | "ERROR"

export type RiskTier = "T0" | "T1" | "T2" | "T3"

// === BASE EVENT ===
export interface BaseReasoningEvent {
  v: typeof SCHEMA_VERSION
  id: string
  requestId: string
  seq: number
  ts: string
  stage: ReasoningStage
  status: ReasoningStatus
  message?: string
  severity?: Severity
  progress?: { current: number; total?: number }
  trace?: { runId: string; span?: string }
  meta?: Record<string, unknown>
}

// === USER CONTEXT SNAPSHOT ===
export interface UserContextSnapshot {
  vatStatus?: "registered" | "unregistered" | "unknown"
  turnoverBand?: string
  companySize?: "micro" | "small" | "medium" | "large"
  jurisdiction?: string
  assumedDefaults: string[]
}

// === STAGE PAYLOADS ===

export interface ContextResolutionPayload {
  summary: string
  jurisdiction: "HR" | "EU" | "UNKNOWN"
  domain: "TAX" | "LABOR" | "COMPANY" | "FINANCE" | "OTHER"
  riskTier: RiskTier
  language: "hr" | "en"
  intent: "QUESTION" | "HOWTO" | "CHECKLIST" | "UNKNOWN"
  asOfDate: string
  entities: Array<{ type: string; value: string; confidence: number }>
  confidence: number
  requiresClarification: boolean
  userContextSnapshot: UserContextSnapshot
}

export interface ClarificationPayload {
  question: string
  options?: Array<{ label: string; value: string }>
  freeformAllowed: boolean
}

export interface SourceSummary {
  id: string
  name: string
  authority: "LAW" | "REGULATION" | "GUIDANCE" | "PRACTICE"
  url?: string
}

export interface SourcesPayload {
  summary: string
  sources: SourceSummary[]
}

export interface RetrievalPayload {
  summary: string
  concepts: string[]
  candidateCount: number
}

export type ExclusionCode =
  | "THRESHOLD_EXCEEDED"
  | "DATE_MISMATCH"
  | "JURISDICTION_MISMATCH"
  | "MISSING_CONTEXT"
  | "CONDITION_FALSE"

export interface RuleExclusion {
  ruleId: string
  ruleTitle: string
  code: ExclusionCode
  expected: string
  actual: string
  source: "user_profile" | "query" | "assumed_default"
  userCanFix: boolean
}

export interface ApplicabilityPayload {
  summary: string
  eligibleCount: number
  ineligibleCount: number
  exclusions: RuleExclusion[]
}

export interface ConflictsPayload {
  summary: string
  conflictCount: number
  resolved: number
  unresolved: number
  canProceedWithWarning: boolean
}

export interface AnalysisPayload {
  summary: string
  bullets: string[]
  comparedSources?: string[]
}

export interface InteractiveDriver {
  id: string
  label: string
  currentValue: boolean
  canToggle: boolean
  affectedStages: ReasoningStage[]
}

export interface ConfidencePayload {
  summary: string
  score: number
  label: "LOW" | "MEDIUM" | "HIGH"
  drivers: string[]
  evidenceStrength: "SINGLE_SOURCE" | "MULTI_SOURCE"
  wouldBeLowerIf?: string[]
  interactiveDrivers?: InteractiveDriver[]
}

export interface Citation {
  id: string
  title: string
  authority: "LAW" | "REGULATION" | "GUIDANCE" | "PRACTICE"
  quote: string
  url: string
  evidenceId: string
  fetchedAt: string
}

export interface FinalAnswerPayload {
  asOfDate: string
  answerHr: string
  structured?: {
    obligations?: string[]
    deadlines?: string[]
    thresholds?: string[]
    exceptions?: string[]
    actions?: string[]
  }
  citations: Citation[]
  limits?: string[]
}

export interface ConflictWarning {
  description: string
  sourceA: { name: string; says: string }
  sourceB: { name: string; says: string }
  practicalResolution?: string
}

export interface QualifiedAnswerPayload {
  asOfDate: string
  answerHr: string
  structured?: {
    obligations?: string[]
    deadlines?: string[]
    thresholds?: string[]
    exceptions?: string[]
    actions?: string[]
  }
  citations: Citation[]
  conflictWarnings: ConflictWarning[]
  caveats: string[]
  limits?: string[]
}

export interface RefusalPayload {
  reason:
    | "NO_CITABLE_RULES"
    | "OUT_OF_SCOPE"
    | "MISSING_CLIENT_DATA"
    | "UNRESOLVED_CONFLICT"
    | "NEEDS_CLARIFICATION"
    | "UNSUPPORTED_JURISDICTION"
    | "UNSUPPORTED_DOMAIN"
  message: string
  relatedTopics?: string[]
  requiredFields?: string[]
}

export interface ErrorPayload {
  code: "INTERNAL" | "VALIDATION_FAILED" | "CAPACITY" | "TIMEOUT"
  message: string
  correlationId: string
  retriable: boolean
}

// === DISCRIMINATED UNION EVENT ===
export type StagePayload =
  | ContextResolutionPayload
  | ClarificationPayload
  | SourcesPayload
  | RetrievalPayload
  | ApplicabilityPayload
  | ConflictsPayload
  | AnalysisPayload
  | ConfidencePayload
  | FinalAnswerPayload
  | QualifiedAnswerPayload
  | RefusalPayload
  | ErrorPayload

export interface ReasoningEvent extends BaseReasoningEvent {
  data?: StagePayload
}

// === TERMINAL PAYLOAD ===
export type TerminalPayload =
  | ({ outcome: "ANSWER" } & FinalAnswerPayload)
  | ({ outcome: "QUALIFIED_ANSWER" } & QualifiedAnswerPayload)
  | ({ outcome: "REFUSAL" } & RefusalPayload)
  | ({ outcome: "ERROR" } & ErrorPayload)

// === UTILITY FUNCTIONS ===
export function isTerminal(event: ReasoningEvent): boolean {
  return (
    event.stage === "ANSWER" ||
    event.stage === "QUALIFIED_ANSWER" ||
    event.stage === "REFUSAL" ||
    event.stage === "ERROR"
  )
}

export function getTerminalOutcome(event: ReasoningEvent): TerminalOutcome | null {
  if (event.stage === "ANSWER") return "ANSWER"
  if (event.stage === "QUALIFIED_ANSWER") return "QUALIFIED_ANSWER"
  if (event.stage === "REFUSAL") return "REFUSAL"
  if (event.stage === "ERROR") return "ERROR"
  return null
}

export function isNonTerminalStage(stage: ReasoningStage): boolean {
  return REASONING_STAGES.includes(stage as (typeof REASONING_STAGES)[number])
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/assistant/reasoning/__tests__/types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/assistant/reasoning/types.ts src/lib/assistant/reasoning/__tests__/types.test.ts
git commit -m "feat(reasoning): add core type definitions for Visible Reasoning UX"
```

---

## Task 2: Add Zod Validation Schemas

**Files:**

- Create: `src/lib/assistant/reasoning/validation.ts`
- Test: `src/lib/assistant/reasoning/__tests__/validation.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/assistant/reasoning/__tests__/validation.test.ts
import { describe, it, expect } from "vitest"
import { ReasoningEventSchema, validateReasoningEvent, TerminalPayloadSchema } from "../validation"

describe("Reasoning Validation", () => {
  describe("ReasoningEventSchema", () => {
    it("validates a valid reasoning event", () => {
      const event = {
        v: 1,
        id: "req_abc_001",
        requestId: "req_abc",
        seq: 1,
        ts: "2025-12-26T10:00:00Z",
        stage: "SOURCES",
        status: "started",
        message: "Searching sources...",
      }

      const result = ReasoningEventSchema.safeParse(event)
      expect(result.success).toBe(true)
    })

    it("rejects invalid schema version", () => {
      const event = {
        v: 2, // Invalid
        id: "req_abc_001",
        requestId: "req_abc",
        seq: 1,
        ts: "2025-12-26T10:00:00Z",
        stage: "SOURCES",
        status: "started",
      }

      const result = ReasoningEventSchema.safeParse(event)
      expect(result.success).toBe(false)
    })

    it("rejects invalid stage", () => {
      const event = {
        v: 1,
        id: "req_abc_001",
        requestId: "req_abc",
        seq: 1,
        ts: "2025-12-26T10:00:00Z",
        stage: "INVALID_STAGE",
        status: "started",
      }

      const result = ReasoningEventSchema.safeParse(event)
      expect(result.success).toBe(false)
    })
  })

  describe("validateReasoningEvent", () => {
    it("returns valid result for correct event", () => {
      const event = {
        v: 1,
        id: "req_abc_001",
        requestId: "req_abc",
        seq: 1,
        ts: "2025-12-26T10:00:00Z",
        stage: "CONTEXT_RESOLUTION",
        status: "complete",
      }

      const result = validateReasoningEvent(event)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it("returns errors for invalid event", () => {
      const event = {
        v: 1,
        // missing required fields
      }

      const result = validateReasoningEvent(event as any)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/assistant/reasoning/__tests__/validation.test.ts`
Expected: FAIL with "Cannot find module '../validation'"

**Step 3: Write the implementation**

```typescript
// src/lib/assistant/reasoning/validation.ts
import { z } from "zod"
import { SCHEMA_VERSION } from "./types"

// === ENUMS AS ZOD ===
const ReasoningStageSchema = z.enum([
  "CONTEXT_RESOLUTION",
  "CLARIFICATION",
  "SOURCES",
  "RETRIEVAL",
  "APPLICABILITY",
  "CONFLICTS",
  "ANALYSIS",
  "CONFIDENCE",
  "ANSWER",
  "QUALIFIED_ANSWER",
  "REFUSAL",
  "ERROR",
])

const ReasoningStatusSchema = z.enum([
  "started",
  "progress",
  "checkpoint",
  "complete",
  "awaiting_input",
])

const SeveritySchema = z.enum(["info", "warning", "critical"])

const RiskTierSchema = z.enum(["T0", "T1", "T2", "T3"])

const AuthoritySchema = z.enum(["LAW", "REGULATION", "GUIDANCE", "PRACTICE"])

// === PAYLOAD SCHEMAS ===
const UserContextSnapshotSchema = z.object({
  vatStatus: z.enum(["registered", "unregistered", "unknown"]).optional(),
  turnoverBand: z.string().optional(),
  companySize: z.enum(["micro", "small", "medium", "large"]).optional(),
  jurisdiction: z.string().optional(),
  assumedDefaults: z.array(z.string()),
})

const ContextResolutionPayloadSchema = z.object({
  summary: z.string(),
  jurisdiction: z.enum(["HR", "EU", "UNKNOWN"]),
  domain: z.enum(["TAX", "LABOR", "COMPANY", "FINANCE", "OTHER"]),
  riskTier: RiskTierSchema,
  language: z.enum(["hr", "en"]),
  intent: z.enum(["QUESTION", "HOWTO", "CHECKLIST", "UNKNOWN"]),
  asOfDate: z.string(),
  entities: z.array(
    z.object({
      type: z.string(),
      value: z.string(),
      confidence: z.number(),
    })
  ),
  confidence: z.number().min(0).max(1),
  requiresClarification: z.boolean(),
  userContextSnapshot: UserContextSnapshotSchema,
})

const CitationSchema = z.object({
  id: z.string(),
  title: z.string(),
  authority: AuthoritySchema,
  quote: z.string(),
  url: z.string().url(),
  evidenceId: z.string(),
  fetchedAt: z.string(),
})

const FinalAnswerPayloadSchema = z.object({
  asOfDate: z.string(),
  answerHr: z.string(),
  structured: z
    .object({
      obligations: z.array(z.string()).optional(),
      deadlines: z.array(z.string()).optional(),
      thresholds: z.array(z.string()).optional(),
      exceptions: z.array(z.string()).optional(),
      actions: z.array(z.string()).optional(),
    })
    .optional(),
  citations: z.array(CitationSchema).min(1),
  limits: z.array(z.string()).optional(),
})

const ConflictWarningSchema = z.object({
  description: z.string(),
  sourceA: z.object({ name: z.string(), says: z.string() }),
  sourceB: z.object({ name: z.string(), says: z.string() }),
  practicalResolution: z.string().optional(),
})

const QualifiedAnswerPayloadSchema = z.object({
  asOfDate: z.string(),
  answerHr: z.string(),
  structured: z
    .object({
      obligations: z.array(z.string()).optional(),
      deadlines: z.array(z.string()).optional(),
      thresholds: z.array(z.string()).optional(),
      exceptions: z.array(z.string()).optional(),
      actions: z.array(z.string()).optional(),
    })
    .optional(),
  citations: z.array(CitationSchema).min(1),
  conflictWarnings: z.array(ConflictWarningSchema),
  caveats: z.array(z.string()),
  limits: z.array(z.string()).optional(),
})

const RefusalPayloadSchema = z.object({
  reason: z.enum([
    "NO_CITABLE_RULES",
    "OUT_OF_SCOPE",
    "MISSING_CLIENT_DATA",
    "UNRESOLVED_CONFLICT",
    "NEEDS_CLARIFICATION",
    "UNSUPPORTED_JURISDICTION",
    "UNSUPPORTED_DOMAIN",
  ]),
  message: z.string(),
  relatedTopics: z.array(z.string()).optional(),
  requiredFields: z.array(z.string()).optional(),
})

const ErrorPayloadSchema = z.object({
  code: z.enum(["INTERNAL", "VALIDATION_FAILED", "CAPACITY", "TIMEOUT"]),
  message: z.string(),
  correlationId: z.string(),
  retriable: z.boolean(),
})

// === MAIN EVENT SCHEMA ===
export const ReasoningEventSchema = z.object({
  v: z.literal(SCHEMA_VERSION),
  id: z.string(),
  requestId: z.string(),
  seq: z.number().int().nonnegative(),
  ts: z.string(),
  stage: ReasoningStageSchema,
  status: ReasoningStatusSchema,
  message: z.string().optional(),
  severity: SeveritySchema.optional(),
  progress: z
    .object({
      current: z.number(),
      total: z.number().optional(),
    })
    .optional(),
  trace: z
    .object({
      runId: z.string(),
      span: z.string().optional(),
    })
    .optional(),
  meta: z.record(z.unknown()).optional(),
  data: z.unknown().optional(),
})

// === TERMINAL PAYLOAD SCHEMA ===
export const TerminalPayloadSchema = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("ANSWER") }).merge(FinalAnswerPayloadSchema),
  z.object({ outcome: z.literal("QUALIFIED_ANSWER") }).merge(QualifiedAnswerPayloadSchema),
  z.object({ outcome: z.literal("REFUSAL") }).merge(RefusalPayloadSchema),
  z.object({ outcome: z.literal("ERROR") }).merge(ErrorPayloadSchema),
])

// === VALIDATION HELPERS ===
export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export function validateReasoningEvent(event: unknown): ValidationResult {
  const result = ReasoningEventSchema.safeParse(event)
  if (result.success) {
    return { valid: true, errors: [] }
  }
  return {
    valid: false,
    errors: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
  }
}

export function validateTerminalPayload(payload: unknown): ValidationResult {
  const result = TerminalPayloadSchema.safeParse(payload)
  if (result.success) {
    return { valid: true, errors: [] }
  }
  return {
    valid: false,
    errors: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
  }
}

// === FAIL-CLOSED INVARIANT CHECKER ===
export interface AnswerInvariants {
  citations: boolean
  asOfDate: boolean
  appliesWhenEvaluated: boolean
  eligibleRulesCount: boolean
  userContextSnapshot: boolean
}

export function checkAnswerInvariants(
  payload: unknown,
  eligibleCount: number,
  hasUserContext: boolean
): { valid: boolean; violations: string[] } {
  const violations: string[] = []
  const p = payload as Record<string, unknown>

  // Citations must be non-empty array
  if (!Array.isArray(p.citations) || p.citations.length === 0) {
    violations.push("citations: must be non-empty array")
  }

  // asOfDate must be present
  if (!p.asOfDate || typeof p.asOfDate !== "string") {
    violations.push("asOfDate: must be present")
  }

  // Must have eligible rules
  if (eligibleCount <= 0) {
    violations.push("eligibleRulesCount: must be > 0")
  }

  // User context snapshot required
  if (!hasUserContext) {
    violations.push("userContextSnapshot: must be frozen at request start")
  }

  return {
    valid: violations.length === 0,
    violations,
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/assistant/reasoning/__tests__/validation.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/assistant/reasoning/validation.ts src/lib/assistant/reasoning/__tests__/validation.test.ts
git commit -m "feat(reasoning): add Zod validation schemas for reasoning events"
```

---

## Task 3: Add Prisma Schema for ReasoningTrace

**Files:**

- Modify: `prisma/schema.prisma` (add at end)
- Create: `prisma/migrations/YYYYMMDDHHMMSS_add_reasoning_trace/migration.sql`

**Step 1: Add the model to schema.prisma**

Add to end of `prisma/schema.prisma`:

```prisma
// === REASONING TRACE (Visible Reasoning UX Audit Trail) ===
model ReasoningTrace {
  id                  String   @id @default(cuid())
  requestId           String   @unique
  events              Json     // Full typed ReasoningEvent[]
  userContextSnapshot Json     // Frozen at request start

  // Summary columns for fast queries
  outcome             String   // ANSWER | QUALIFIED_ANSWER | REFUSAL | ERROR
  domain              String?
  riskTier            String?
  confidence          Float?
  sourceCount         Int?
  eligibleRuleCount   Int?
  exclusionCount      Int?
  conflictCount       Int?
  refusalReason       String?
  durationMs          Int?

  createdAt           DateTime @default(now())

  @@index([requestId])
  @@index([outcome])
  @@index([riskTier])
  @@index([createdAt])
  @@index([confidence])
}
```

**Step 2: Generate migration**

Run: `npx prisma migrate dev --name add_reasoning_trace`
Expected: Migration created successfully

**Step 3: Verify migration SQL**

Check the generated migration file contains:

```sql
CREATE TABLE "ReasoningTrace" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "events" JSONB NOT NULL,
    "userContextSnapshot" JSONB NOT NULL,
    "outcome" TEXT NOT NULL,
    "domain" TEXT,
    "riskTier" TEXT,
    "confidence" DOUBLE PRECISION,
    "sourceCount" INTEGER,
    "eligibleRuleCount" INTEGER,
    "exclusionCount" INTEGER,
    "conflictCount" INTEGER,
    "refusalReason" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReasoningTrace_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReasoningTrace_requestId_key" ON "ReasoningTrace"("requestId");
CREATE INDEX "ReasoningTrace_requestId_idx" ON "ReasoningTrace"("requestId");
CREATE INDEX "ReasoningTrace_outcome_idx" ON "ReasoningTrace"("outcome");
CREATE INDEX "ReasoningTrace_riskTier_idx" ON "ReasoningTrace"("riskTier");
CREATE INDEX "ReasoningTrace_createdAt_idx" ON "ReasoningTrace"("createdAt");
CREATE INDEX "ReasoningTrace_confidence_idx" ON "ReasoningTrace"("confidence");
```

**Step 4: Generate Prisma client**

Run: `npx prisma generate`
Expected: Prisma client generated

**Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add ReasoningTrace table for audit trail"
```

---

## Task 4: Create Event Factory & ID Generator

**Files:**

- Create: `src/lib/assistant/reasoning/event-factory.ts`
- Test: `src/lib/assistant/reasoning/__tests__/event-factory.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/assistant/reasoning/__tests__/event-factory.test.ts
import { describe, it, expect, beforeEach } from "vitest"
import { createEventFactory, type EventFactory } from "../event-factory"
import { SCHEMA_VERSION } from "../types"

describe("EventFactory", () => {
  let factory: EventFactory

  beforeEach(() => {
    factory = createEventFactory("req_test123")
  })

  describe("createEventFactory", () => {
    it("creates factory with correct requestId", () => {
      const event = factory.emit({
        stage: "SOURCES",
        status: "started",
        message: "Searching...",
      })

      expect(event.requestId).toBe("req_test123")
    })
  })

  describe("emit", () => {
    it("generates monotonic sequence numbers", () => {
      const event1 = factory.emit({ stage: "SOURCES", status: "started" })
      const event2 = factory.emit({ stage: "SOURCES", status: "progress" })
      const event3 = factory.emit({ stage: "SOURCES", status: "complete" })

      expect(event1.seq).toBe(0)
      expect(event2.seq).toBe(1)
      expect(event3.seq).toBe(2)
    })

    it("generates unique event IDs with padded sequence", () => {
      const event = factory.emit({ stage: "SOURCES", status: "started" })

      expect(event.id).toBe("req_test123_000")
    })

    it("includes schema version", () => {
      const event = factory.emit({ stage: "SOURCES", status: "started" })

      expect(event.v).toBe(SCHEMA_VERSION)
    })

    it("includes ISO timestamp", () => {
      const event = factory.emit({ stage: "SOURCES", status: "started" })

      expect(event.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    it("includes optional message", () => {
      const event = factory.emit({
        stage: "SOURCES",
        status: "started",
        message: "Searching authoritative sources...",
      })

      expect(event.message).toBe("Searching authoritative sources...")
    })

    it("includes optional data payload", () => {
      const data = { summary: "Found 3 sources", sources: [] }
      const event = factory.emit({
        stage: "SOURCES",
        status: "complete",
        data,
      })

      expect(event.data).toEqual(data)
    })
  })

  describe("getSequence", () => {
    it("returns current sequence number", () => {
      expect(factory.getSequence()).toBe(0)

      factory.emit({ stage: "SOURCES", status: "started" })
      expect(factory.getSequence()).toBe(1)
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/assistant/reasoning/__tests__/event-factory.test.ts`
Expected: FAIL with "Cannot find module '../event-factory'"

**Step 3: Write the implementation**

```typescript
// src/lib/assistant/reasoning/event-factory.ts
import {
  SCHEMA_VERSION,
  type ReasoningEvent,
  type ReasoningStage,
  type ReasoningStatus,
  type Severity,
  type StagePayload,
} from "./types"

export interface EventEmitOptions {
  stage: ReasoningStage
  status: ReasoningStatus
  message?: string
  severity?: Severity
  progress?: { current: number; total?: number }
  data?: StagePayload
  meta?: Record<string, unknown>
}

export interface EventFactory {
  emit(options: EventEmitOptions): ReasoningEvent
  getSequence(): number
  getRequestId(): string
}

export function createEventFactory(requestId: string): EventFactory {
  let seq = 0

  return {
    emit(options: EventEmitOptions): ReasoningEvent {
      const currentSeq = seq++
      const paddedSeq = String(currentSeq).padStart(3, "0")

      return {
        v: SCHEMA_VERSION,
        id: `${requestId}_${paddedSeq}`,
        requestId,
        seq: currentSeq,
        ts: new Date().toISOString(),
        stage: options.stage,
        status: options.status,
        ...(options.message && { message: options.message }),
        ...(options.severity && { severity: options.severity }),
        ...(options.progress && { progress: options.progress }),
        ...(options.data && { data: options.data }),
        ...(options.meta && { meta: options.meta }),
      }
    },

    getSequence(): number {
      return seq
    },

    getRequestId(): string {
      return requestId
    },
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/assistant/reasoning/__tests__/event-factory.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/assistant/reasoning/event-factory.ts src/lib/assistant/reasoning/__tests__/event-factory.test.ts
git commit -m "feat(reasoning): add event factory with monotonic ID generation"
```

---

## Task 5: Create Module Index

**Files:**

- Create: `src/lib/assistant/reasoning/index.ts`

**Step 1: Create the barrel export**

```typescript
// src/lib/assistant/reasoning/index.ts

// Types
export {
  SCHEMA_VERSION,
  REASONING_STAGES,
  isTerminal,
  getTerminalOutcome,
  isNonTerminalStage,
  type ReasoningStage,
  type ReasoningStatus,
  type Severity,
  type TerminalOutcome,
  type RiskTier,
  type ReasoningEvent,
  type BaseReasoningEvent,
  type StagePayload,
  type TerminalPayload,
  type UserContextSnapshot,
  type ContextResolutionPayload,
  type ClarificationPayload,
  type SourcesPayload,
  type SourceSummary,
  type RetrievalPayload,
  type ApplicabilityPayload,
  type RuleExclusion,
  type ExclusionCode,
  type ConflictsPayload,
  type AnalysisPayload,
  type ConfidencePayload,
  type InteractiveDriver,
  type FinalAnswerPayload,
  type QualifiedAnswerPayload,
  type ConflictWarning,
  type RefusalPayload,
  type ErrorPayload,
  type Citation,
} from "./types"

// Validation
export {
  ReasoningEventSchema,
  TerminalPayloadSchema,
  validateReasoningEvent,
  validateTerminalPayload,
  checkAnswerInvariants,
  type ValidationResult,
  type AnswerInvariants,
} from "./validation"

// Event Factory
export { createEventFactory, type EventFactory, type EventEmitOptions } from "./event-factory"
```

**Step 2: Verify imports work**

Run: `npx tsc --noEmit src/lib/assistant/reasoning/index.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/assistant/reasoning/index.ts
git commit -m "feat(reasoning): add module barrel export"
```

---

## Verification Checklist

After completing all tasks:

- [ ] `npx vitest run src/lib/assistant/reasoning/` - All tests pass
- [ ] `npx prisma migrate status` - Migration applied
- [ ] `npx tsc --noEmit` - No type errors
- [ ] ReasoningTrace table exists in database

---

## Next Track

Proceed to **Track 2: Backend Pipeline** which builds on this foundation to create the AsyncGenerator-based reasoning pipeline.
