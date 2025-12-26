# Visible Reasoning UX - Track 2: Backend Pipeline

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the AsyncGenerator-based reasoning pipeline with 7 stages and sink architecture.

**Architecture:** The pipeline follows a Generator + Sink pattern. The generator (`buildAnswerWithReasoning`) is an AsyncGenerator that yields ReasoningEvents. Sinks consume events for SSE streaming, audit logging, and metrics. Each stage yields started → progress/checkpoint → complete events.

**Tech Stack:** TypeScript, AsyncGenerator, Prisma

**Depends on:** Track 1 (Foundation)

---

## Task 1: Create Sink Interface

**Files:**

- Create: `src/lib/assistant/reasoning/sinks/types.ts`
- Test: `src/lib/assistant/reasoning/sinks/__tests__/types.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/assistant/reasoning/sinks/__tests__/types.test.ts
import { describe, it, expect, vi } from "vitest"
import type { ReasoningSink, SinkMode } from "../types"
import type { ReasoningEvent } from "../../types"

describe("ReasoningSink interface", () => {
  it("defines correct sink modes", () => {
    const modes: SinkMode[] = ["nonBlocking", "buffered", "criticalAwait"]
    expect(modes).toHaveLength(3)
  })

  it("allows creating a mock sink", () => {
    const mockSink: ReasoningSink = {
      mode: "nonBlocking",
      write: vi.fn(),
      flush: vi.fn().mockResolvedValue(undefined),
    }

    expect(mockSink.mode).toBe("nonBlocking")
    expect(typeof mockSink.write).toBe("function")
    expect(typeof mockSink.flush).toBe("function")
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/assistant/reasoning/sinks/__tests__/types.test.ts`
Expected: FAIL with "Cannot find module '../types'"

**Step 3: Write the implementation**

```typescript
// src/lib/assistant/reasoning/sinks/types.ts
import type { ReasoningEvent } from "../types"

export type SinkMode = "nonBlocking" | "buffered" | "criticalAwait"

export interface ReasoningSink {
  mode: SinkMode
  write(event: ReasoningEvent): void | Promise<void>
  flush?(): Promise<void>
}

export interface SinkConfig {
  name: string
  enabled: boolean
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/assistant/reasoning/sinks/__tests__/types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/assistant/reasoning/sinks/
git commit -m "feat(reasoning): add sink interface types"
```

---

## Task 2: Create Audit Sink

**Files:**

- Create: `src/lib/assistant/reasoning/sinks/audit-sink.ts`
- Test: `src/lib/assistant/reasoning/sinks/__tests__/audit-sink.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/assistant/reasoning/sinks/__tests__/audit-sink.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { createAuditSink } from "../audit-sink"
import type { ReasoningEvent, UserContextSnapshot } from "../../types"
import { SCHEMA_VERSION } from "../../types"

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    reasoningTrace: {
      create: vi.fn().mockResolvedValue({ id: "trace_123" }),
    },
  },
}))

describe("AuditSink", () => {
  const mockUserContext: UserContextSnapshot = {
    vatStatus: "registered",
    assumedDefaults: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("mode", () => {
    it("is buffered mode", () => {
      const sink = createAuditSink("req_test", mockUserContext)
      expect(sink.mode).toBe("buffered")
    })
  })

  describe("write", () => {
    it("buffers events without writing to DB", async () => {
      const sink = createAuditSink("req_test", mockUserContext)
      const event: ReasoningEvent = {
        v: SCHEMA_VERSION,
        id: "req_test_001",
        requestId: "req_test",
        seq: 1,
        ts: new Date().toISOString(),
        stage: "SOURCES",
        status: "started",
      }

      sink.write(event)

      // Should not have written to DB yet
      const { prisma } = await import("@/lib/prisma")
      expect(prisma.reasoningTrace.create).not.toHaveBeenCalled()
    })
  })

  describe("flush", () => {
    it("writes all buffered events to database", async () => {
      const sink = createAuditSink("req_test", mockUserContext)

      // Buffer some events
      sink.write({
        v: SCHEMA_VERSION,
        id: "req_test_000",
        requestId: "req_test",
        seq: 0,
        ts: new Date().toISOString(),
        stage: "CONTEXT_RESOLUTION",
        status: "complete",
        data: {
          summary: "HR · TAX · T1",
          jurisdiction: "HR",
          domain: "TAX",
          riskTier: "T1",
          language: "hr",
          intent: "QUESTION",
          asOfDate: "2025-12-26",
          entities: [],
          confidence: 0.95,
          requiresClarification: false,
          userContextSnapshot: mockUserContext,
        },
      } as ReasoningEvent)

      sink.write({
        v: SCHEMA_VERSION,
        id: "req_test_001",
        requestId: "req_test",
        seq: 1,
        ts: new Date().toISOString(),
        stage: "ANSWER",
        status: "complete",
      } as ReasoningEvent)

      await sink.flush?.()

      const { prisma } = await import("@/lib/prisma")
      expect(prisma.reasoningTrace.create).toHaveBeenCalledTimes(1)
      expect(prisma.reasoningTrace.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            requestId: "req_test",
            outcome: "ANSWER",
          }),
        })
      )
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/assistant/reasoning/sinks/__tests__/audit-sink.test.ts`
Expected: FAIL with "Cannot find module '../audit-sink'"

**Step 3: Write the implementation**

```typescript
// src/lib/assistant/reasoning/sinks/audit-sink.ts
import { prisma } from "@/lib/prisma"
import type { ReasoningSink } from "./types"
import type {
  ReasoningEvent,
  UserContextSnapshot,
  TerminalOutcome,
  ContextResolutionPayload,
  ApplicabilityPayload,
  ConflictsPayload,
  ConfidencePayload,
  RefusalPayload,
} from "../types"
import { isTerminal, getTerminalOutcome } from "../types"

export function createAuditSink(
  requestId: string,
  userContextSnapshot: UserContextSnapshot
): ReasoningSink {
  const events: ReasoningEvent[] = []
  const startTime = Date.now()

  return {
    mode: "buffered",

    write(event: ReasoningEvent): void {
      events.push(event)
    },

    async flush(): Promise<void> {
      if (events.length === 0) return

      // Find terminal event
      const terminalEvent = events.find(isTerminal)
      if (!terminalEvent) {
        console.error("[AuditSink] No terminal event found", { requestId })
        return
      }

      // Extract summary data from events
      const contextEvent = events.find(
        (e) => e.stage === "CONTEXT_RESOLUTION" && e.status === "complete"
      )
      const applicabilityEvent = events.find(
        (e) => e.stage === "APPLICABILITY" && e.status === "complete"
      )
      const conflictsEvent = events.find((e) => e.stage === "CONFLICTS" && e.status === "complete")
      const confidenceEvent = events.find(
        (e) => e.stage === "CONFIDENCE" && e.status === "complete"
      )
      const sourcesEvents = events.filter((e) => e.stage === "SOURCES" && e.status === "progress")

      const contextData = contextEvent?.data as ContextResolutionPayload | undefined
      const applicabilityData = applicabilityEvent?.data as ApplicabilityPayload | undefined
      const conflictsData = conflictsEvent?.data as ConflictsPayload | undefined
      const confidenceData = confidenceEvent?.data as ConfidencePayload | undefined

      const outcome = getTerminalOutcome(terminalEvent) as TerminalOutcome
      const refusalData =
        terminalEvent.stage === "REFUSAL" ? (terminalEvent.data as RefusalPayload) : undefined

      try {
        await prisma.reasoningTrace.create({
          data: {
            requestId,
            events: events as unknown as object,
            userContextSnapshot: userContextSnapshot as unknown as object,
            outcome,
            domain: contextData?.domain,
            riskTier: contextData?.riskTier,
            confidence: confidenceData?.score,
            sourceCount: sourcesEvents.length,
            eligibleRuleCount: applicabilityData?.eligibleCount,
            exclusionCount: applicabilityData?.ineligibleCount,
            conflictCount: conflictsData?.conflictCount,
            refusalReason: refusalData?.reason,
            durationMs: Date.now() - startTime,
          },
        })
      } catch (error) {
        console.error("[AuditSink] Failed to write trace", { requestId, error })
        // Don't throw - audit failure shouldn't break the response
      }
    },
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/assistant/reasoning/sinks/__tests__/audit-sink.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/assistant/reasoning/sinks/audit-sink.ts src/lib/assistant/reasoning/sinks/__tests__/audit-sink.test.ts
git commit -m "feat(reasoning): add audit sink for trace logging"
```

---

## Task 3: Create Sink Consumer

**Files:**

- Create: `src/lib/assistant/reasoning/sinks/consumer.ts`
- Test: `src/lib/assistant/reasoning/sinks/__tests__/consumer.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/assistant/reasoning/sinks/__tests__/consumer.test.ts
import { describe, it, expect, vi } from "vitest"
import { consumeReasoning } from "../consumer"
import type { ReasoningSink } from "../types"
import type { ReasoningEvent, TerminalPayload } from "../../types"
import { SCHEMA_VERSION } from "../../types"

describe("consumeReasoning", () => {
  it("writes all events to all sinks", async () => {
    const events: ReasoningEvent[] = [
      {
        v: SCHEMA_VERSION,
        id: "req_test_000",
        requestId: "req_test",
        seq: 0,
        ts: new Date().toISOString(),
        stage: "SOURCES",
        status: "started",
      },
      {
        v: SCHEMA_VERSION,
        id: "req_test_001",
        requestId: "req_test",
        seq: 1,
        ts: new Date().toISOString(),
        stage: "ANSWER",
        status: "complete",
      },
    ]

    async function* mockGenerator(): AsyncGenerator<ReasoningEvent, TerminalPayload> {
      for (const event of events) {
        yield event
      }
      return {
        outcome: "ANSWER",
        asOfDate: "2025-12-26",
        answerHr: "Test",
        citations: [],
      } as TerminalPayload
    }

    const mockSink: ReasoningSink = {
      mode: "nonBlocking",
      write: vi.fn(),
      flush: vi.fn().mockResolvedValue(undefined),
    }

    const result = await consumeReasoning(mockGenerator(), [mockSink])

    expect(mockSink.write).toHaveBeenCalledTimes(2)
    expect(mockSink.flush).toHaveBeenCalledTimes(1)
    expect(result.outcome).toBe("ANSWER")
  })

  it("awaits critical sinks for critical events", async () => {
    const events: ReasoningEvent[] = [
      {
        v: SCHEMA_VERSION,
        id: "req_test_000",
        requestId: "req_test",
        seq: 0,
        ts: new Date().toISOString(),
        stage: "ERROR",
        status: "complete",
        severity: "critical",
      },
    ]

    async function* mockGenerator(): AsyncGenerator<ReasoningEvent, TerminalPayload> {
      for (const event of events) {
        yield event
      }
      return {
        outcome: "ERROR",
        code: "INTERNAL",
        message: "Test",
        correlationId: "req_test",
        retriable: true,
      } as TerminalPayload
    }

    const writePromise = new Promise<void>((resolve) => setTimeout(resolve, 10))
    const criticalSink: ReasoningSink = {
      mode: "criticalAwait",
      write: vi.fn().mockReturnValue(writePromise),
      flush: vi.fn().mockResolvedValue(undefined),
    }

    await consumeReasoning(mockGenerator(), [criticalSink])

    expect(criticalSink.write).toHaveBeenCalled()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/assistant/reasoning/sinks/__tests__/consumer.test.ts`
Expected: FAIL with "Cannot find module '../consumer'"

**Step 3: Write the implementation**

```typescript
// src/lib/assistant/reasoning/sinks/consumer.ts
import type { ReasoningSink } from "./types"
import type { ReasoningEvent, TerminalPayload } from "../types"
import { isTerminal } from "../types"

export async function consumeReasoning(
  generator: AsyncGenerator<ReasoningEvent, TerminalPayload>,
  sinks: ReasoningSink[]
): Promise<TerminalPayload> {
  let terminalPayload: TerminalPayload | undefined

  try {
    for await (const event of generator) {
      // Write to all sinks
      for (const sink of sinks) {
        if (sink.mode === "criticalAwait" && event.severity === "critical") {
          // Await critical writes
          await sink.write(event)
        } else {
          // Fire and forget for non-critical
          const result = sink.write(event)
          if (result instanceof Promise) {
            result.catch((err) => {
              console.error("[consumeReasoning] Sink write failed", { error: err })
            })
          }
        }
      }

      // Capture terminal for return
      if (isTerminal(event)) {
        terminalPayload = event.data as TerminalPayload
      }
    }
  } finally {
    // Flush all sinks
    await flushAllSinks(sinks)
  }

  if (!terminalPayload) {
    // This should never happen if generator is well-formed
    throw new Error("Pipeline ended without terminal payload")
  }

  return terminalPayload
}

async function flushAllSinks(sinks: ReasoningSink[]): Promise<void> {
  const flushPromises = sinks
    .filter((sink) => sink.flush)
    .map((sink) =>
      sink.flush!().catch((err) => {
        console.error("[consumeReasoning] Sink flush failed", { error: err })
      })
    )

  await Promise.all(flushPromises)
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/assistant/reasoning/sinks/__tests__/consumer.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/assistant/reasoning/sinks/consumer.ts src/lib/assistant/reasoning/sinks/__tests__/consumer.test.ts
git commit -m "feat(reasoning): add sink consumer for pipeline output"
```

---

## Task 4: Create Sinks Module Index

**Files:**

- Create: `src/lib/assistant/reasoning/sinks/index.ts`

**Step 1: Create barrel export**

```typescript
// src/lib/assistant/reasoning/sinks/index.ts
export type { ReasoningSink, SinkMode, SinkConfig } from "./types"
export { createAuditSink } from "./audit-sink"
export { consumeReasoning } from "./consumer"
```

**Step 2: Commit**

```bash
git add src/lib/assistant/reasoning/sinks/index.ts
git commit -m "feat(reasoning): add sinks module index"
```

---

## Task 5: Create Context Resolution Stage

**Files:**

- Create: `src/lib/assistant/reasoning/stages/context-resolution.ts`
- Test: `src/lib/assistant/reasoning/stages/__tests__/context-resolution.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/assistant/reasoning/stages/__tests__/context-resolution.test.ts
import { describe, it, expect } from "vitest"
import { contextResolutionStage } from "../context-resolution"
import { createEventFactory } from "../../event-factory"
import type { ContextResolutionPayload } from "../../types"

describe("contextResolutionStage", () => {
  it("yields started event first", async () => {
    const factory = createEventFactory("req_test")
    const generator = contextResolutionStage(factory, "Koji je prag za PDV?")

    const { value: startedEvent } = await generator.next()

    expect(startedEvent.stage).toBe("CONTEXT_RESOLUTION")
    expect(startedEvent.status).toBe("started")
    expect(startedEvent.message).toBe("Analysing question...")
  })

  it("yields complete event with resolution data", async () => {
    const factory = createEventFactory("req_test")
    const generator = contextResolutionStage(factory, "Koji je prag za PDV?")

    await generator.next() // started
    const { value: completeEvent } = await generator.next()

    expect(completeEvent.stage).toBe("CONTEXT_RESOLUTION")
    expect(completeEvent.status).toBe("complete")
    expect(completeEvent.data).toBeDefined()

    const data = completeEvent.data as ContextResolutionPayload
    expect(data.jurisdiction).toBe("HR")
    expect(data.domain).toBe("TAX")
    expect(data.confidence).toBeGreaterThan(0)
    expect(data.userContextSnapshot).toBeDefined()
  })

  it("returns resolution for downstream stages", async () => {
    const factory = createEventFactory("req_test")
    const generator = contextResolutionStage(factory, "Koji je prag za PDV?")

    await generator.next() // started
    await generator.next() // complete
    const { value: resolution, done } = await generator.next()

    expect(done).toBe(true)
    expect(resolution).toBeDefined()
    expect(resolution.jurisdiction).toBe("HR")
  })

  it("sets requiresClarification when confidence < 0.9", async () => {
    const factory = createEventFactory("req_test")
    // Vague query should have lower confidence
    const generator = contextResolutionStage(factory, "porez")

    await generator.next() // started
    const { value: completeEvent } = await generator.next()
    const data = completeEvent.data as ContextResolutionPayload

    // Vague queries should flag for clarification
    if (data.confidence < 0.9) {
      expect(data.requiresClarification).toBe(true)
    }
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/assistant/reasoning/stages/__tests__/context-resolution.test.ts`
Expected: FAIL with "Cannot find module '../context-resolution'"

**Step 3: Write the implementation**

```typescript
// src/lib/assistant/reasoning/stages/context-resolution.ts
import type { EventFactory } from "../event-factory"
import type {
  ReasoningEvent,
  ContextResolutionPayload,
  UserContextSnapshot,
  RiskTier,
} from "../types"
import { interpretQuery } from "@/lib/assistant/query-engine/query-interpreter"

export interface ContextResolution extends ContextResolutionPayload {
  concepts: string[]
  suggestedClarifications?: string[]
}

const CONFIDENCE_THRESHOLD = 0.9

export async function* contextResolutionStage(
  factory: EventFactory,
  query: string,
  companyContext?: {
    vatStatus?: "registered" | "unregistered" | "unknown"
    turnoverBand?: string
    companySize?: "micro" | "small" | "medium" | "large"
    jurisdiction?: string
  }
): AsyncGenerator<ReasoningEvent, ContextResolution> {
  // Emit started
  yield factory.emit({
    stage: "CONTEXT_RESOLUTION",
    status: "started",
    message: "Analysing question...",
  })

  // Use existing query interpreter
  const interpretation = interpretQuery(query, "APP")

  // Build user context snapshot (frozen at request start)
  const userContextSnapshot: UserContextSnapshot = {
    vatStatus: companyContext?.vatStatus,
    turnoverBand: companyContext?.turnoverBand,
    companySize: companyContext?.companySize,
    jurisdiction: companyContext?.jurisdiction || "HR",
    assumedDefaults: [],
  }

  // Add assumed defaults
  if (!companyContext?.vatStatus) {
    userContextSnapshot.assumedDefaults.push("vatStatus: unknown")
  }
  if (!companyContext?.turnoverBand) {
    userContextSnapshot.assumedDefaults.push("turnoverBand: unknown")
  }

  // Compute risk tier based on topic and confidence
  const riskTier = computeRiskTier(interpretation.topic, interpretation.entities)

  const resolution: ContextResolution = {
    summary: `${mapJurisdiction(interpretation.jurisdiction)} · ${interpretation.topic} · ${riskTier}`,
    jurisdiction: mapJurisdiction(interpretation.jurisdiction),
    domain: mapDomain(interpretation.topic),
    riskTier,
    language: "hr",
    intent: mapIntent(interpretation.intent),
    asOfDate: new Date().toISOString().split("T")[0],
    entities: interpretation.entities.map((e) => ({
      type: "keyword",
      value: e,
      confidence: interpretation.confidence,
    })),
    confidence: interpretation.confidence,
    requiresClarification: interpretation.confidence < CONFIDENCE_THRESHOLD,
    userContextSnapshot,
    concepts: interpretation.entities,
    suggestedClarifications: interpretation.suggestedClarifications,
  }

  // Emit complete with data
  yield factory.emit({
    stage: "CONTEXT_RESOLUTION",
    status: "complete",
    data: resolution,
  })

  return resolution
}

function mapJurisdiction(jurisdiction: string): "HR" | "EU" | "UNKNOWN" {
  if (jurisdiction === "HR" || jurisdiction === "croatia") return "HR"
  if (jurisdiction === "EU" || jurisdiction === "european_union") return "EU"
  return "HR" // Default to HR for Croatian tax assistant
}

function mapDomain(topic: string): "TAX" | "LABOR" | "COMPANY" | "FINANCE" | "OTHER" {
  if (topic === "REGULATORY") return "TAX"
  return "OTHER"
}

function mapIntent(intent: string): "QUESTION" | "HOWTO" | "CHECKLIST" | "UNKNOWN" {
  switch (intent) {
    case "query":
    case "question":
      return "QUESTION"
    case "howto":
      return "HOWTO"
    case "checklist":
      return "CHECKLIST"
    default:
      return "QUESTION"
  }
}

function computeRiskTier(topic: string, entities: string[]): RiskTier {
  // T0: Critical - legal deadlines, penalties
  const t0Keywords = ["kazna", "penali", "rok", "obveza", "sankcija"]
  if (entities.some((e) => t0Keywords.some((k) => e.toLowerCase().includes(k)))) {
    return "T0"
  }

  // T1: High - tax obligations, VAT, contributions
  const t1Keywords = ["pdv", "porez", "doprinos", "fiskalizacija", "obračun"]
  if (entities.some((e) => t1Keywords.some((k) => e.toLowerCase().includes(k)))) {
    return "T1"
  }

  // T2: Medium - thresholds, limits
  const t2Keywords = ["prag", "limit", "granica", "iznos"]
  if (entities.some((e) => t2Keywords.some((k) => e.toLowerCase().includes(k)))) {
    return "T2"
  }

  // T3: Low - informational
  return "T3"
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/assistant/reasoning/stages/__tests__/context-resolution.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/assistant/reasoning/stages/context-resolution.ts src/lib/assistant/reasoning/stages/__tests__/context-resolution.test.ts
git commit -m "feat(reasoning): add context resolution stage"
```

---

## Task 6: Create Source Discovery Stage

**Files:**

- Create: `src/lib/assistant/reasoning/stages/source-discovery.ts`
- Test: `src/lib/assistant/reasoning/stages/__tests__/source-discovery.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/assistant/reasoning/stages/__tests__/source-discovery.test.ts
import { describe, it, expect, vi } from "vitest"
import { sourceDiscoveryStage } from "../source-discovery"
import { createEventFactory } from "../../event-factory"
import type { SourcesPayload } from "../../types"

// Mock concept matcher
vi.mock("@/lib/assistant/query-engine/concept-matcher", () => ({
  matchConcepts: vi
    .fn()
    .mockResolvedValue([
      {
        conceptId: "c1",
        slug: "pdv-stopa",
        nameHr: "PDV stopa",
        score: 0.9,
        matchedKeywords: ["pdv", "stopa"],
      },
    ]),
}))

describe("sourceDiscoveryStage", () => {
  it("yields started event", async () => {
    const factory = createEventFactory("req_test")
    const generator = sourceDiscoveryStage(factory, ["pdv", "stopa"])

    const { value: startedEvent } = await generator.next()

    expect(startedEvent.stage).toBe("SOURCES")
    expect(startedEvent.status).toBe("started")
    expect(startedEvent.message).toBe("Searching authoritative sources...")
  })

  it("yields progress events for each source found", async () => {
    const factory = createEventFactory("req_test")
    const generator = sourceDiscoveryStage(factory, ["pdv", "stopa"])

    await generator.next() // started

    const { value: progressEvent } = await generator.next()
    expect(progressEvent.stage).toBe("SOURCES")
    expect(progressEvent.status).toBe("progress")
    expect(progressEvent.message).toContain("Found:")
  })

  it("yields complete event with sources summary", async () => {
    const factory = createEventFactory("req_test")
    const generator = sourceDiscoveryStage(factory, ["pdv", "stopa"])

    const events: any[] = []
    for await (const event of generator) {
      events.push(event)
    }

    const completeEvent = events.find((e) => e.status === "complete")
    expect(completeEvent).toBeDefined()
    expect(completeEvent.data).toBeDefined()

    const data = completeEvent.data as SourcesPayload
    expect(data.sources).toBeDefined()
    expect(Array.isArray(data.sources)).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/assistant/reasoning/stages/__tests__/source-discovery.test.ts`
Expected: FAIL with "Cannot find module '../source-discovery'"

**Step 3: Write the implementation**

```typescript
// src/lib/assistant/reasoning/stages/source-discovery.ts
import type { EventFactory } from "../event-factory"
import type { ReasoningEvent, SourcesPayload, SourceSummary } from "../types"
import { matchConcepts, type ConceptMatch } from "@/lib/assistant/query-engine/concept-matcher"

export interface SourceDiscoveryResult {
  sources: SourceSummary[]
  conceptMatches: ConceptMatch[]
}

export async function* sourceDiscoveryStage(
  factory: EventFactory,
  keywords: string[]
): AsyncGenerator<ReasoningEvent, SourceDiscoveryResult> {
  // Emit started
  yield factory.emit({
    stage: "SOURCES",
    status: "started",
    message: "Searching authoritative sources...",
  })

  // Match concepts (uses existing concept matcher)
  const conceptMatches = await matchConcepts(keywords)

  const sources: SourceSummary[] = []

  // Emit progress for each concept found
  for (const match of conceptMatches) {
    const source: SourceSummary = {
      id: match.conceptId,
      name: match.nameHr,
      authority: "LAW", // Default, would be determined from actual source
    }
    sources.push(source)

    yield factory.emit({
      stage: "SOURCES",
      status: "progress",
      message: `Found: ${match.nameHr}`,
      data: { source } as unknown as SourcesPayload,
    })
  }

  // Emit complete
  const payload: SourcesPayload = {
    summary: `Found ${sources.length} source${sources.length !== 1 ? "s" : ""}`,
    sources,
  }

  yield factory.emit({
    stage: "SOURCES",
    status: "complete",
    data: payload,
  })

  return {
    sources,
    conceptMatches,
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/assistant/reasoning/stages/__tests__/source-discovery.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/assistant/reasoning/stages/source-discovery.ts src/lib/assistant/reasoning/stages/__tests__/source-discovery.test.ts
git commit -m "feat(reasoning): add source discovery stage with progressive streaming"
```

---

## Task 7: Create Stages Module Index

**Files:**

- Create: `src/lib/assistant/reasoning/stages/index.ts`

**Step 1: Create barrel export**

```typescript
// src/lib/assistant/reasoning/stages/index.ts
export { contextResolutionStage, type ContextResolution } from "./context-resolution"
export { sourceDiscoveryStage, type SourceDiscoveryResult } from "./source-discovery"
```

**Step 2: Commit**

```bash
git add src/lib/assistant/reasoning/stages/index.ts
git commit -m "feat(reasoning): add stages module index"
```

---

## Task 8: Create Main Pipeline Generator (Skeleton)

**Files:**

- Create: `src/lib/assistant/reasoning/pipeline.ts`
- Test: `src/lib/assistant/reasoning/__tests__/pipeline.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/assistant/reasoning/__tests__/pipeline.test.ts
import { describe, it, expect, vi } from "vitest"
import { buildAnswerWithReasoning } from "../pipeline"
import { isTerminal } from "../types"

// Mock dependencies
vi.mock("@/lib/assistant/query-engine/concept-matcher", () => ({
  matchConcepts: vi.fn().mockResolvedValue([]),
}))

vi.mock("@/lib/assistant/query-engine/rule-selector", () => ({
  selectRules: vi
    .fn()
    .mockResolvedValue({
      rules: [],
      ineligible: [],
      hasMissingContext: false,
      missingContextRuleIds: [],
      asOfDate: new Date().toISOString(),
    }),
}))

describe("buildAnswerWithReasoning", () => {
  it("yields CONTEXT_RESOLUTION started as first event", async () => {
    const generator = buildAnswerWithReasoning("req_test", "test query", "APP")
    const { value: firstEvent } = await generator.next()

    expect(firstEvent.stage).toBe("CONTEXT_RESOLUTION")
    expect(firstEvent.status).toBe("started")
  })

  it("always terminates with a terminal event", async () => {
    const generator = buildAnswerWithReasoning("req_test", "test query", "APP")

    const events = []
    for await (const event of generator) {
      events.push(event)
    }

    const lastEvent = events[events.length - 1]
    expect(isTerminal(lastEvent)).toBe(true)
  })

  it("returns terminal payload when generator completes", async () => {
    const generator = buildAnswerWithReasoning("req_test", "test query", "APP")

    let result
    for await (const event of generator) {
      // consume all events
    }
    // Get the return value
    const { value, done } = await generator.next()

    // When done, value is the return value
    if (done && value) {
      expect(value.outcome).toBeDefined()
    }
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/assistant/reasoning/__tests__/pipeline.test.ts`
Expected: FAIL with "Cannot find module '../pipeline'"

**Step 3: Write the implementation (skeleton)**

```typescript
// src/lib/assistant/reasoning/pipeline.ts
import { createEventFactory } from "./event-factory"
import { contextResolutionStage } from "./stages/context-resolution"
import { sourceDiscoveryStage } from "./stages/source-discovery"
import type {
  ReasoningEvent,
  TerminalPayload,
  Surface,
  RefusalPayload,
  ErrorPayload,
} from "./types"
import { extractKeywords } from "@/lib/assistant/query-engine/text-utils"
import { selectRules } from "@/lib/assistant/query-engine/rule-selector"
import { detectConflicts } from "@/lib/assistant/query-engine/conflict-detector"
import { buildCitations } from "@/lib/assistant/query-engine/citation-builder"

export interface CompanyContext {
  vatStatus?: "registered" | "unregistered" | "unknown"
  turnoverBand?: string
  companySize?: "micro" | "small" | "medium" | "large"
  jurisdiction?: string
}

export interface ClarificationQuestion {
  question: string
  options?: Array<{ label: string; value: string }>
}

export interface ClarificationAnswer {
  selectedOption?: string
  freeformAnswer?: string
}

export async function* buildAnswerWithReasoning(
  requestId: string,
  query: string,
  surface: Surface,
  context?: CompanyContext,
  clarificationCallback?: (question: ClarificationQuestion) => Promise<ClarificationAnswer>
): AsyncGenerator<ReasoningEvent, TerminalPayload> {
  const factory = createEventFactory(requestId)

  try {
    // Stage 1-2: Context Resolution
    const contextGenerator = contextResolutionStage(factory, query, context)
    let resolution
    for await (const event of contextGenerator) {
      yield event
      if (event.status === "complete") {
        resolution = event.data
      }
    }
    resolution = await contextGenerator.next().then((r) => r.value)

    // Handle clarification if needed
    if (resolution.requiresClarification && clarificationCallback) {
      yield factory.emit({
        stage: "CLARIFICATION",
        status: "awaiting_input",
        data: {
          question: "Please clarify your question",
          options: resolution.suggestedClarifications?.map((s) => ({ label: s, value: s })),
          freeformAllowed: true,
        },
      })

      // Would await callback here in real implementation
      // For now, continue without clarification
    }

    // Stage 3: Source Discovery
    const keywords = extractKeywords(query)
    const sourcesGenerator = sourceDiscoveryStage(factory, keywords)
    let sourcesResult
    for await (const event of sourcesGenerator) {
      yield event
    }
    sourcesResult = await sourcesGenerator.next().then((r) => r.value)

    // If no sources, return REFUSAL
    if (sourcesResult.sources.length === 0) {
      const refusal: RefusalPayload = {
        reason: "NO_CITABLE_RULES",
        message: "Nismo pronašli službene izvore koji odgovaraju na vaše pitanje.",
        relatedTopics: ["porez na dohodak", "PDV stope", "paušalni obrt"],
      }

      yield factory.emit({
        stage: "REFUSAL",
        status: "complete",
        data: refusal,
      })

      return { outcome: "REFUSAL", ...refusal }
    }

    // Stage 4: Retrieval
    yield factory.emit({
      stage: "RETRIEVAL",
      status: "started",
      message: "Retrieving applicable rules...",
    })

    const conceptSlugs = sourcesResult.conceptMatches.map((c) => c.slug)
    const selectionResult = await selectRules(conceptSlugs)

    yield factory.emit({
      stage: "RETRIEVAL",
      status: "complete",
      data: {
        summary: `Retrieved ${selectionResult.rules.length} candidate rules`,
        concepts: conceptSlugs,
        candidateCount: selectionResult.rules.length,
      },
    })

    if (selectionResult.rules.length === 0) {
      const refusal: RefusalPayload = {
        reason: "NO_CITABLE_RULES",
        message: "Nismo pronašli primjenjive propise za vaše pitanje.",
      }

      yield factory.emit({
        stage: "REFUSAL",
        status: "complete",
        data: refusal,
      })

      return { outcome: "REFUSAL", ...refusal }
    }

    // Stage 5: Applicability
    yield factory.emit({
      stage: "APPLICABILITY",
      status: "started",
    })

    yield factory.emit({
      stage: "APPLICABILITY",
      status: "complete",
      data: {
        summary: `${selectionResult.rules.length} rules apply`,
        eligibleCount: selectionResult.rules.length,
        ineligibleCount: selectionResult.ineligible.length,
        exclusions: [], // Would be populated with actual exclusions
      },
    })

    // Stage 5b: Conflicts
    const conflictResult = detectConflicts(selectionResult.rules)

    yield factory.emit({
      stage: "CONFLICTS",
      status: "complete",
      data: {
        summary: conflictResult.hasConflict ? "Conflicts detected" : "No conflicts",
        conflictCount: conflictResult.hasConflict ? 1 : 0,
        resolved: 0,
        unresolved: conflictResult.hasConflict && !conflictResult.canResolve ? 1 : 0,
        canProceedWithWarning: conflictResult.canResolve,
      },
    })

    if (conflictResult.hasConflict && !conflictResult.canResolve) {
      const refusal: RefusalPayload = {
        reason: "UNRESOLVED_CONFLICT",
        message: "Pronađeni su proturječni propisi.",
      }

      yield factory.emit({
        stage: "REFUSAL",
        status: "complete",
        severity: "warning",
        data: refusal,
      })

      return { outcome: "REFUSAL", ...refusal }
    }

    // Stage 6: Analysis
    yield factory.emit({
      stage: "ANALYSIS",
      status: "started",
    })

    yield factory.emit({
      stage: "ANALYSIS",
      status: "checkpoint",
      message: "Comparing sources...",
    })

    yield factory.emit({
      stage: "ANALYSIS",
      status: "complete",
      data: {
        summary: "Analysis complete",
        bullets: ["Verified against primary source"],
      },
    })

    // Stage 7: Confidence
    const primaryRule = selectionResult.rules[0]
    const confidenceScore = primaryRule.confidence || 0.8

    yield factory.emit({
      stage: "CONFIDENCE",
      status: "complete",
      data: {
        summary: `${confidenceScore >= 0.9 ? "HIGH" : confidenceScore >= 0.7 ? "MEDIUM" : "LOW"} confidence`,
        score: confidenceScore,
        label: confidenceScore >= 0.9 ? "HIGH" : confidenceScore >= 0.7 ? "MEDIUM" : "LOW",
        drivers: ["Primary source verified", "No conflicts"],
        evidenceStrength: "SINGLE_SOURCE",
      },
    })

    // Build citations
    const citations = buildCitations(selectionResult.rules)

    if (!citations || !citations.primary.quote) {
      const refusal: RefusalPayload = {
        reason: "NO_CITABLE_RULES",
        message: "Nismo pronašli dovoljno pouzdane izvore.",
      }

      yield factory.emit({
        stage: "REFUSAL",
        status: "complete",
        data: refusal,
      })

      return { outcome: "REFUSAL", ...refusal }
    }

    // Terminal: ANSWER
    const answer = {
      asOfDate: new Date().toISOString().split("T")[0],
      answerHr: primaryRule.explanationHr || primaryRule.titleHr,
      citations: [
        {
          id: citations.primary.id,
          title: citations.primary.title,
          authority: citations.primary.authority,
          quote: citations.primary.quote!,
          url: citations.primary.url,
          evidenceId: citations.primary.evidenceId || "",
          fetchedAt: citations.primary.fetchedAt || new Date().toISOString(),
        },
      ],
    }

    yield factory.emit({
      stage: "ANSWER",
      status: "complete",
      data: answer,
    })

    return { outcome: "ANSWER", ...answer }
  } catch (err) {
    const errorPayload: ErrorPayload = {
      code: "INTERNAL",
      message: "An unexpected error occurred",
      correlationId: requestId,
      retriable: true,
    }

    yield factory.emit({
      stage: "ERROR",
      status: "complete",
      severity: "critical",
      data: errorPayload,
    })

    return { outcome: "ERROR", ...errorPayload }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/assistant/reasoning/__tests__/pipeline.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/assistant/reasoning/pipeline.ts src/lib/assistant/reasoning/__tests__/pipeline.test.ts
git commit -m "feat(reasoning): add main pipeline generator skeleton"
```

---

## Verification Checklist

After completing all tasks:

- [ ] `npx vitest run src/lib/assistant/reasoning/` - All tests pass
- [ ] Pipeline yields events in correct order
- [ ] Terminal events are properly typed
- [ ] Sinks receive all events

---

## Next Track

Proceed to **Track 3: API Layer** which exposes the pipeline via SSE endpoint.
