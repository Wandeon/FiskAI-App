# Visible Reasoning UX - Track 3: API Layer

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create SSE streaming endpoint that exposes the reasoning pipeline with proper event types and heartbeat.

**Architecture:** New `/api/assistant/chat/reasoning` endpoint streams ReasoningEvents via SSE. Uses standard SSE format with `event: reasoning` and `event: terminal` types. Heartbeat every 10s keeps connection alive. Backward-compatible wrapper maintains existing API.

**Tech Stack:** Next.js App Router, SSE, ReadableStream

**Depends on:** Track 1 (Foundation), Track 2 (Pipeline)

---

## Task 1: Create SSE Sink

**Files:**

- Create: `src/lib/assistant/reasoning/sinks/sse-sink.ts`
- Test: `src/lib/assistant/reasoning/sinks/__tests__/sse-sink.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/assistant/reasoning/sinks/__tests__/sse-sink.test.ts
import { describe, it, expect, vi } from "vitest"
import { createSSESink } from "../sse-sink"
import type { ReasoningEvent } from "../../types"
import { SCHEMA_VERSION } from "../../types"

describe("SSESink", () => {
  it("has nonBlocking mode", () => {
    const mockController = {
      enqueue: vi.fn(),
      close: vi.fn(),
    }
    const sink = createSSESink(mockController as unknown as ReadableStreamDefaultController)

    expect(sink.mode).toBe("nonBlocking")
  })

  it("formats events as SSE with event type", () => {
    const mockController = {
      enqueue: vi.fn(),
      close: vi.fn(),
    }
    const sink = createSSESink(mockController as unknown as ReadableStreamDefaultController)

    const event: ReasoningEvent = {
      v: SCHEMA_VERSION,
      id: "req_test_001",
      requestId: "req_test",
      seq: 1,
      ts: "2025-12-26T10:00:00Z",
      stage: "SOURCES",
      status: "started",
      message: "Searching...",
    }

    sink.write(event)

    expect(mockController.enqueue).toHaveBeenCalled()
    const encoded = mockController.enqueue.mock.calls[0][0]
    const text = new TextDecoder().decode(encoded)

    expect(text).toContain("event: reasoning")
    expect(text).toContain("id: req_test_001")
    expect(text).toContain("data: ")
    expect(text).toContain('"stage":"SOURCES"')
  })

  it("uses terminal event type for terminal stages", () => {
    const mockController = {
      enqueue: vi.fn(),
      close: vi.fn(),
    }
    const sink = createSSESink(mockController as unknown as ReadableStreamDefaultController)

    const event: ReasoningEvent = {
      v: SCHEMA_VERSION,
      id: "req_test_final",
      requestId: "req_test",
      seq: 10,
      ts: "2025-12-26T10:00:00Z",
      stage: "ANSWER",
      status: "complete",
    }

    sink.write(event)

    const encoded = mockController.enqueue.mock.calls[0][0]
    const text = new TextDecoder().decode(encoded)

    expect(text).toContain("event: terminal")
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/assistant/reasoning/sinks/__tests__/sse-sink.test.ts`
Expected: FAIL with "Cannot find module '../sse-sink'"

**Step 3: Write the implementation**

```typescript
// src/lib/assistant/reasoning/sinks/sse-sink.ts
import type { ReasoningSink } from "./types"
import type { ReasoningEvent } from "../types"
import { isTerminal } from "../types"

const encoder = new TextEncoder()

export function createSSESink(
  controller: ReadableStreamDefaultController<Uint8Array>
): ReasoningSink {
  return {
    mode: "nonBlocking",

    write(event: ReasoningEvent): void {
      const eventType = isTerminal(event) ? "terminal" : "reasoning"
      const data = JSON.stringify(event)

      const sseMessage = `event: ${eventType}\nid: ${event.id}\ndata: ${data}\n\n`
      controller.enqueue(encoder.encode(sseMessage))
    },

    async flush(): Promise<void> {
      // SSE sink doesn't buffer, nothing to flush
    },
  }
}

export function sendHeartbeat(controller: ReadableStreamDefaultController<Uint8Array>): void {
  const heartbeat = `event: heartbeat\ndata: {"ts":"${new Date().toISOString()}"}\n\n`
  controller.enqueue(encoder.encode(heartbeat))
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/assistant/reasoning/sinks/__tests__/sse-sink.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/assistant/reasoning/sinks/sse-sink.ts src/lib/assistant/reasoning/sinks/__tests__/sse-sink.test.ts
git commit -m "feat(reasoning): add SSE sink for streaming events"
```

---

## Task 2: Update Sinks Index

**Files:**

- Modify: `src/lib/assistant/reasoning/sinks/index.ts`

**Step 1: Add SSE sink export**

```typescript
// src/lib/assistant/reasoning/sinks/index.ts
export type { ReasoningSink, SinkMode, SinkConfig } from "./types"
export { createAuditSink } from "./audit-sink"
export { createSSESink, sendHeartbeat } from "./sse-sink"
export { consumeReasoning } from "./consumer"
```

**Step 2: Commit**

```bash
git add src/lib/assistant/reasoning/sinks/index.ts
git commit -m "feat(reasoning): export SSE sink from sinks module"
```

---

## Task 3: Create Reasoning SSE Endpoint

**Files:**

- Create: `src/app/api/assistant/chat/reasoning/route.ts`

**Step 1: Create the endpoint**

```typescript
// src/app/api/assistant/chat/reasoning/route.ts
import { NextRequest } from "next/server"
import { nanoid } from "nanoid"
import { buildAnswerWithReasoning } from "@/lib/assistant/reasoning/pipeline"
import {
  createSSESink,
  sendHeartbeat,
  createAuditSink,
  consumeReasoning,
} from "@/lib/assistant/reasoning/sinks"
import { isTerminal, type Surface, type UserContextSnapshot } from "@/lib/assistant/reasoning"

interface ReasoningRequest {
  query: string
  surface: Surface
  companyId?: string
}

const HEARTBEAT_INTERVAL_MS = 10000

/**
 * SSE STREAMING REASONING ENDPOINT
 *
 * Streams ReasoningEvents as the pipeline executes:
 * - event: reasoning — intermediate stage events
 * - event: terminal — final ANSWER/QUALIFIED_ANSWER/REFUSAL/ERROR
 * - event: heartbeat — keepalive every 10s
 *
 * Wire format:
 *   event: reasoning
 *   id: req_abc123_001
 *   data: {"v":1,"stage":"SOURCES","status":"progress",...}
 *
 *   event: terminal
 *   id: req_abc123_final
 *   data: {"v":1,"stage":"ANSWER","status":"complete",...}
 */
export async function POST(request: NextRequest) {
  const requestId = `req_${nanoid()}`

  let body: ReasoningRequest
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Validate request
  if (!body.query || typeof body.query !== "string" || body.query.trim().length === 0) {
    return new Response(JSON.stringify({ error: "Query is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  if (!body.surface || !["MARKETING", "APP"].includes(body.surface)) {
    return new Response(JSON.stringify({ error: "Invalid surface" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Create initial user context snapshot
  const userContextSnapshot: UserContextSnapshot = {
    assumedDefaults: ["vatStatus: unknown", "turnoverBand: unknown"],
  }

  const stream = new ReadableStream({
    async start(controller) {
      // Create sinks
      const sseSink = createSSESink(controller)
      const auditSink = createAuditSink(requestId, userContextSnapshot)

      // Start heartbeat
      const heartbeatInterval = setInterval(() => {
        try {
          sendHeartbeat(controller)
        } catch {
          // Controller may be closed
          clearInterval(heartbeatInterval)
        }
      }, HEARTBEAT_INTERVAL_MS)

      try {
        // Create and consume the reasoning pipeline
        const generator = buildAnswerWithReasoning(
          requestId,
          body.query.trim(),
          body.surface,
          undefined // companyContext - would load from companyId
        )

        // Consume with both sinks
        await consumeReasoning(generator, [sseSink, auditSink])
      } catch (error) {
        console.error("[Reasoning API] Pipeline error", { requestId, error })

        // Emit error event
        const errorEvent = {
          v: 1,
          id: `${requestId}_error`,
          requestId,
          seq: 999,
          ts: new Date().toISOString(),
          stage: "ERROR",
          status: "complete",
          severity: "critical",
          data: {
            code: "INTERNAL",
            message: "An unexpected error occurred",
            correlationId: requestId,
            retriable: true,
          },
        }

        const encoder = new TextEncoder()
        controller.enqueue(
          encoder.encode(
            `event: terminal\nid: ${errorEvent.id}\ndata: ${JSON.stringify(errorEvent)}\n\n`
          )
        )
      } finally {
        clearInterval(heartbeatInterval)
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Request-Id": requestId,
    },
  })
}
```

**Step 2: Verify endpoint compiles**

Run: `npx tsc --noEmit src/app/api/assistant/chat/reasoning/route.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/assistant/chat/reasoning/route.ts
git commit -m "feat(api): add SSE reasoning endpoint"
```

---

## Task 4: Create Backward-Compatible Wrapper

**Files:**

- Create: `src/lib/assistant/reasoning/compat.ts`
- Test: `src/lib/assistant/reasoning/__tests__/compat.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/assistant/reasoning/__tests__/compat.test.ts
import { describe, it, expect, vi } from "vitest"
import { buildAnswerCompat } from "../compat"
import type { AssistantResponse } from "@/lib/assistant/types"

// Mock pipeline
vi.mock("../pipeline", () => ({
  buildAnswerWithReasoning: vi.fn().mockImplementation(async function* () {
    yield {
      v: 1,
      id: "req_test_000",
      requestId: "req_test",
      seq: 0,
      ts: new Date().toISOString(),
      stage: "CONTEXT_RESOLUTION",
      status: "complete",
    }
    yield {
      v: 1,
      id: "req_test_001",
      requestId: "req_test",
      seq: 1,
      ts: new Date().toISOString(),
      stage: "ANSWER",
      status: "complete",
      data: {
        asOfDate: "2025-12-26",
        answerHr: "Test answer",
        citations: [
          {
            id: "c1",
            title: "Test Source",
            authority: "LAW",
            quote: "Test quote",
            url: "https://example.com",
            evidenceId: "e1",
            fetchedAt: "2025-12-26T10:00:00Z",
          },
        ],
      },
    }
    return {
      outcome: "ANSWER",
      asOfDate: "2025-12-26",
      answerHr: "Test answer",
      citations: [],
    }
  }),
}))

describe("buildAnswerCompat", () => {
  it("returns AssistantResponse format", async () => {
    const result = await buildAnswerCompat("test query", "MARKETING")

    expect(result).toHaveProperty("schemaVersion")
    expect(result).toHaveProperty("requestId")
    expect(result).toHaveProperty("kind")
    expect(result).toHaveProperty("headline")
  })

  it("maps ANSWER outcome to ANSWER kind", async () => {
    const result = await buildAnswerCompat("test query", "MARKETING")

    expect(result.kind).toBe("ANSWER")
  })

  it("includes directAnswer from answerHr", async () => {
    const result = await buildAnswerCompat("test query", "MARKETING")

    expect(result.directAnswer).toBe("Test answer")
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/assistant/reasoning/__tests__/compat.test.ts`
Expected: FAIL with "Cannot find module '../compat'"

**Step 3: Write the implementation**

```typescript
// src/lib/assistant/reasoning/compat.ts
import { nanoid } from "nanoid"
import { buildAnswerWithReasoning } from "./pipeline"
import {
  isTerminal,
  type ReasoningEvent,
  type TerminalPayload,
  type FinalAnswerPayload,
  type QualifiedAnswerPayload,
  type RefusalPayload,
  type ErrorPayload,
  type Surface,
} from "./types"
import {
  SCHEMA_VERSION as LEGACY_SCHEMA_VERSION,
  type AssistantResponse,
  type SourceCard,
  type CitationBlock,
} from "@/lib/assistant/types"

/**
 * Backward-compatible wrapper that runs the new reasoning pipeline
 * but returns the legacy AssistantResponse format.
 *
 * This allows gradual migration - existing consumers can continue
 * using the old format while new consumers use SSE streaming.
 */
export async function buildAnswerCompat(
  query: string,
  surface: Surface,
  companyId?: string
): Promise<AssistantResponse> {
  const requestId = `req_${nanoid()}`
  const traceId = `trace_${nanoid()}`

  const generator = buildAnswerWithReasoning(requestId, query, surface)

  let terminalEvent: ReasoningEvent | undefined
  let terminalPayload: TerminalPayload | undefined

  for await (const event of generator) {
    if (isTerminal(event)) {
      terminalEvent = event
      terminalPayload = event.data as TerminalPayload
    }
  }

  // Get return value
  const result = await generator.next()
  if (result.done && result.value) {
    terminalPayload = result.value
  }

  if (!terminalPayload) {
    // Fallback error response
    return {
      schemaVersion: LEGACY_SCHEMA_VERSION,
      requestId,
      traceId,
      kind: "REFUSAL",
      topic: "REGULATORY",
      surface,
      createdAt: new Date().toISOString(),
      headline: "Došlo je do pogreške",
      directAnswer: "",
      refusalReason: "NO_CITABLE_RULES",
      refusal: {
        message: "Privremena pogreška sustava.",
      },
    }
  }

  return mapToLegacyResponse(terminalPayload, requestId, traceId, surface)
}

function mapToLegacyResponse(
  payload: TerminalPayload,
  requestId: string,
  traceId: string,
  surface: Surface
): AssistantResponse {
  const base = {
    schemaVersion: LEGACY_SCHEMA_VERSION,
    requestId,
    traceId,
    topic: "REGULATORY" as const,
    surface,
    createdAt: new Date().toISOString(),
  }

  switch (payload.outcome) {
    case "ANSWER": {
      const answer = payload as FinalAnswerPayload & { outcome: "ANSWER" }
      return {
        ...base,
        kind: "ANSWER",
        headline: answer.answerHr.substring(0, 120),
        directAnswer: answer.answerHr,
        asOfDate: answer.asOfDate,
        citations: mapCitations(answer.citations),
        confidence: { level: "HIGH", score: 0.9 },
      }
    }

    case "QUALIFIED_ANSWER": {
      const qualified = payload as QualifiedAnswerPayload & { outcome: "QUALIFIED_ANSWER" }
      return {
        ...base,
        kind: "ANSWER",
        headline: qualified.answerHr.substring(0, 120),
        directAnswer: qualified.answerHr,
        asOfDate: qualified.asOfDate,
        citations: mapCitations(qualified.citations),
        confidence: { level: "MEDIUM", score: 0.7 },
        conflict:
          qualified.conflictWarnings.length > 0
            ? {
                status: "CONTEXT_DEPENDENT",
                description: qualified.conflictWarnings[0].description,
                sources: [],
              }
            : undefined,
      }
    }

    case "REFUSAL": {
      const refusal = payload as RefusalPayload & { outcome: "REFUSAL" }
      return {
        ...base,
        kind: "REFUSAL",
        headline: refusal.message.substring(0, 120),
        directAnswer: "",
        refusalReason: refusal.reason,
        refusal: {
          message: refusal.message,
          relatedTopics: refusal.relatedTopics,
        },
      }
    }

    case "ERROR": {
      const error = payload as ErrorPayload & { outcome: "ERROR" }
      return {
        ...base,
        kind: "REFUSAL",
        headline: "Došlo je do pogreške",
        directAnswer: "",
        refusalReason: "NO_CITABLE_RULES",
        refusal: {
          message: error.message,
        },
        error: {
          message: error.message,
          retryable: error.retriable,
        },
      }
    }
  }
}

function mapCitations(citations: FinalAnswerPayload["citations"]): CitationBlock | undefined {
  if (!citations || citations.length === 0) return undefined

  const primary = citations[0]
  const primaryCard: SourceCard = {
    id: primary.id,
    title: primary.title,
    authority: primary.authority,
    quote: primary.quote,
    url: primary.url,
    effectiveFrom: primary.fetchedAt.split("T")[0],
    confidence: 0.9,
    evidenceId: primary.evidenceId,
    fetchedAt: primary.fetchedAt,
  }

  const supporting: SourceCard[] = citations.slice(1).map((c) => ({
    id: c.id,
    title: c.title,
    authority: c.authority,
    quote: c.quote,
    url: c.url,
    effectiveFrom: c.fetchedAt.split("T")[0],
    confidence: 0.8,
    evidenceId: c.evidenceId,
    fetchedAt: c.fetchedAt,
  }))

  return { primary: primaryCard, supporting }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/assistant/reasoning/__tests__/compat.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/assistant/reasoning/compat.ts src/lib/assistant/reasoning/__tests__/compat.test.ts
git commit -m "feat(reasoning): add backward-compatible wrapper for legacy API"
```

---

## Task 5: Update Module Index

**Files:**

- Modify: `src/lib/assistant/reasoning/index.ts`

**Step 1: Add new exports**

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
  type Surface,
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

// Pipeline
export {
  buildAnswerWithReasoning,
  type CompanyContext,
  type ClarificationQuestion,
  type ClarificationAnswer,
} from "./pipeline"

// Sinks
export {
  type ReasoningSink,
  type SinkMode,
  createAuditSink,
  createSSESink,
  sendHeartbeat,
  consumeReasoning,
} from "./sinks"

// Stages
export {
  contextResolutionStage,
  sourceDiscoveryStage,
  type ContextResolution,
  type SourceDiscoveryResult,
} from "./stages"

// Compatibility
export { buildAnswerCompat } from "./compat"
```

**Step 2: Commit**

```bash
git add src/lib/assistant/reasoning/index.ts
git commit -m "feat(reasoning): update module index with all exports"
```

---

## Task 6: Add API Route Test

**Files:**

- Create: `src/app/api/assistant/chat/reasoning/__tests__/route.test.ts`

**Step 1: Write the test**

```typescript
// src/app/api/assistant/chat/reasoning/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "../route"
import { NextRequest } from "next/server"

// Mock the pipeline
vi.mock("@/lib/assistant/reasoning/pipeline", () => ({
  buildAnswerWithReasoning: vi.fn().mockImplementation(async function* () {
    yield {
      v: 1,
      id: "req_test_000",
      requestId: "req_test",
      seq: 0,
      ts: new Date().toISOString(),
      stage: "CONTEXT_RESOLUTION",
      status: "started",
      message: "Analysing question...",
    }
    yield {
      v: 1,
      id: "req_test_001",
      requestId: "req_test",
      seq: 1,
      ts: new Date().toISOString(),
      stage: "REFUSAL",
      status: "complete",
      data: {
        reason: "NO_CITABLE_RULES",
        message: "No sources found",
      },
    }
    return { outcome: "REFUSAL", reason: "NO_CITABLE_RULES", message: "No sources found" }
  }),
}))

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    reasoningTrace: {
      create: vi.fn().mockResolvedValue({ id: "trace_123" }),
    },
  },
}))

describe("POST /api/assistant/chat/reasoning", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 400 for missing query", async () => {
    const request = new NextRequest("http://localhost/api/assistant/chat/reasoning", {
      method: "POST",
      body: JSON.stringify({ surface: "APP" }),
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe("Query is required")
  })

  it("returns 400 for invalid surface", async () => {
    const request = new NextRequest("http://localhost/api/assistant/chat/reasoning", {
      method: "POST",
      body: JSON.stringify({ query: "test", surface: "INVALID" }),
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it("returns SSE stream for valid request", async () => {
    const request = new NextRequest("http://localhost/api/assistant/chat/reasoning", {
      method: "POST",
      body: JSON.stringify({ query: "test query", surface: "APP" }),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("text/event-stream")
    expect(response.headers.get("Cache-Control")).toContain("no-cache")
  })

  it("includes X-Request-Id header", async () => {
    const request = new NextRequest("http://localhost/api/assistant/chat/reasoning", {
      method: "POST",
      body: JSON.stringify({ query: "test query", surface: "APP" }),
    })

    const response = await POST(request)

    expect(response.headers.get("X-Request-Id")).toMatch(/^req_/)
  })
})
```

**Step 2: Run test**

Run: `npx vitest run src/app/api/assistant/chat/reasoning/__tests__/route.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/api/assistant/chat/reasoning/__tests__/route.test.ts
git commit -m "test(api): add reasoning endpoint tests"
```

---

## Verification Checklist

After completing all tasks:

- [ ] `npx vitest run src/lib/assistant/reasoning/` - All tests pass
- [ ] `npx vitest run src/app/api/assistant/chat/reasoning/` - Endpoint tests pass
- [ ] SSE endpoint streams events correctly
- [ ] Heartbeat works (verify with curl)
- [ ] Backward-compatible wrapper returns correct format

**Manual verification:**

```bash
curl -X POST http://localhost:3000/api/assistant/chat/reasoning \
  -H "Content-Type: application/json" \
  -d '{"query":"Koji je prag za PDV?","surface":"APP"}' \
  --no-buffer
```

Expected output format:

```
event: reasoning
id: req_abc123_000
data: {"v":1,"stage":"CONTEXT_RESOLUTION","status":"started",...}

event: reasoning
id: req_abc123_001
data: {"v":1,"stage":"SOURCES","status":"progress",...}

event: terminal
id: req_abc123_010
data: {"v":1,"stage":"ANSWER","status":"complete",...}
```

---

## Next Track

Proceed to **Track 4: Frontend State** which creates React hooks for consuming the SSE stream.
