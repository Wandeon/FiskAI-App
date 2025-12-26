# Visible Reasoning UX - Track 4: Frontend State

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create React hooks and selectors for consuming the SSE reasoning stream and managing UI state.

**Architecture:** `useReasoningStream` hook manages SSE connection and accumulates events. `useReasoningSelectors` provides derived state (byStage, latestByStage, terminal). State machine: IDLE → STREAMING → AWAITING_INPUT → STREAMING → ENDED.

**Tech Stack:** React 18, TypeScript, EventSource

**Depends on:** Track 1 (Foundation), Track 3 (API)

---

## Task 1: Create Frontend Types

**Files:**

- Create: `src/lib/assistant/reasoning/client/types.ts`

**Step 1: Create the types file**

```typescript
// src/lib/assistant/reasoning/client/types.ts
import type { ReasoningEvent, ReasoningStage, TerminalOutcome, RiskTier } from "../types"

// === STREAM STATE ===
export type StreamState = "idle" | "connecting" | "streaming" | "awaiting_input" | "ended" | "error"

// === SELECTORS ===
export interface ReasoningSelectors {
  byStage: Partial<Record<ReasoningStage, ReasoningEvent[]>>
  latestByStage: Partial<Record<ReasoningStage, ReasoningEvent>>
  terminal?: ReasoningEvent
  terminalOutcome?: TerminalOutcome
}

// === HOOK STATE ===
export interface ReasoningStreamState {
  requestId: string | null
  events: ReasoningEvent[]
  streamState: StreamState
  error: Error | null
  riskTier: RiskTier | null
}

// === HOOK ACTIONS ===
export interface ReasoningStreamActions {
  submit: (query: string) => void
  cancel: () => void
  reset: () => void
  answerClarification: (answer: string) => void
}

// === HOOK RETURN ===
export interface UseReasoningStreamReturn extends ReasoningStreamState {
  actions: ReasoningStreamActions
  selectors: ReasoningSelectors
}

// === SSE EVENT TYPES ===
export const SSE_EVENT_TYPES = {
  REASONING: "reasoning",
  TERMINAL: "terminal",
  HEARTBEAT: "heartbeat",
} as const

export type SSEEventType = (typeof SSE_EVENT_TYPES)[keyof typeof SSE_EVENT_TYPES]
```

**Step 2: Commit**

```bash
git add src/lib/assistant/reasoning/client/types.ts
git commit -m "feat(reasoning-client): add frontend types"
```

---

## Task 2: Create Event Selectors

**Files:**

- Create: `src/lib/assistant/reasoning/client/selectors.ts`
- Test: `src/lib/assistant/reasoning/client/__tests__/selectors.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/assistant/reasoning/client/__tests__/selectors.test.ts
import { describe, it, expect } from "vitest"
import { createSelectors, getTerminalFromEvents } from "../selectors"
import type { ReasoningEvent } from "../../types"
import { SCHEMA_VERSION } from "../../types"

const createEvent = (stage: string, status: string, seq: number): ReasoningEvent => ({
  v: SCHEMA_VERSION,
  id: `req_test_${String(seq).padStart(3, "0")}`,
  requestId: "req_test",
  seq,
  ts: new Date().toISOString(),
  stage: stage as ReasoningEvent["stage"],
  status: status as ReasoningEvent["status"],
})

describe("createSelectors", () => {
  it("groups events by stage", () => {
    const events: ReasoningEvent[] = [
      createEvent("SOURCES", "started", 0),
      createEvent("SOURCES", "progress", 1),
      createEvent("SOURCES", "complete", 2),
      createEvent("RETRIEVAL", "started", 3),
    ]

    const selectors = createSelectors(events)

    expect(selectors.byStage.SOURCES).toHaveLength(3)
    expect(selectors.byStage.RETRIEVAL).toHaveLength(1)
  })

  it("returns latest event per stage", () => {
    const events: ReasoningEvent[] = [
      createEvent("SOURCES", "started", 0),
      createEvent("SOURCES", "progress", 1),
      createEvent("SOURCES", "complete", 2),
    ]

    const selectors = createSelectors(events)

    expect(selectors.latestByStage.SOURCES?.status).toBe("complete")
    expect(selectors.latestByStage.SOURCES?.seq).toBe(2)
  })

  it("identifies terminal event", () => {
    const events: ReasoningEvent[] = [
      createEvent("SOURCES", "complete", 0),
      createEvent("ANSWER", "complete", 1),
    ]

    const selectors = createSelectors(events)

    expect(selectors.terminal).toBeDefined()
    expect(selectors.terminal?.stage).toBe("ANSWER")
    expect(selectors.terminalOutcome).toBe("ANSWER")
  })

  it("returns undefined terminal when no terminal event", () => {
    const events: ReasoningEvent[] = [
      createEvent("SOURCES", "started", 0),
      createEvent("SOURCES", "progress", 1),
    ]

    const selectors = createSelectors(events)

    expect(selectors.terminal).toBeUndefined()
    expect(selectors.terminalOutcome).toBeUndefined()
  })
})

describe("getTerminalFromEvents", () => {
  it("finds ANSWER terminal", () => {
    const events: ReasoningEvent[] = [
      createEvent("SOURCES", "complete", 0),
      createEvent("ANSWER", "complete", 1),
    ]

    const terminal = getTerminalFromEvents(events)
    expect(terminal?.stage).toBe("ANSWER")
  })

  it("finds REFUSAL terminal", () => {
    const events: ReasoningEvent[] = [
      createEvent("SOURCES", "complete", 0),
      createEvent("REFUSAL", "complete", 1),
    ]

    const terminal = getTerminalFromEvents(events)
    expect(terminal?.stage).toBe("REFUSAL")
  })

  it("returns undefined when no terminal", () => {
    const events: ReasoningEvent[] = [createEvent("SOURCES", "started", 0)]

    const terminal = getTerminalFromEvents(events)
    expect(terminal).toBeUndefined()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/assistant/reasoning/client/__tests__/selectors.test.ts`
Expected: FAIL with "Cannot find module '../selectors'"

**Step 3: Write the implementation**

```typescript
// src/lib/assistant/reasoning/client/selectors.ts
import type { ReasoningEvent, ReasoningStage, TerminalOutcome } from "../types"
import { isTerminal, getTerminalOutcome } from "../types"
import type { ReasoningSelectors } from "./types"

/**
 * Create derived selectors from accumulated events.
 * Memoize this in React with useMemo for performance.
 */
export function createSelectors(events: ReasoningEvent[]): ReasoningSelectors {
  const byStage: Partial<Record<ReasoningStage, ReasoningEvent[]>> = {}
  const latestByStage: Partial<Record<ReasoningStage, ReasoningEvent>> = {}
  let terminal: ReasoningEvent | undefined
  let terminalOutcome: TerminalOutcome | undefined

  for (const event of events) {
    // Group by stage
    if (!byStage[event.stage]) {
      byStage[event.stage] = []
    }
    byStage[event.stage]!.push(event)

    // Track latest per stage
    latestByStage[event.stage] = event

    // Capture terminal
    if (isTerminal(event)) {
      terminal = event
      terminalOutcome = getTerminalOutcome(event) || undefined
    }
  }

  return {
    byStage,
    latestByStage,
    terminal,
    terminalOutcome,
  }
}

/**
 * Find terminal event from events array.
 */
export function getTerminalFromEvents(events: ReasoningEvent[]): ReasoningEvent | undefined {
  return events.find(isTerminal)
}

/**
 * Get current stage from events.
 */
export function getCurrentStage(events: ReasoningEvent[]): ReasoningStage | null {
  if (events.length === 0) return null

  // Find latest non-complete event, or last event
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]
    if (event.status !== "complete" || isTerminal(event)) {
      return event.stage
    }
  }

  return events[events.length - 1].stage
}

/**
 * Check if a stage is complete.
 */
export function isStageComplete(events: ReasoningEvent[], stage: ReasoningStage): boolean {
  return events.some((e) => e.stage === stage && e.status === "complete")
}

/**
 * Get progress for a stage if available.
 */
export function getStageProgress(
  events: ReasoningEvent[],
  stage: ReasoningStage
): { current: number; total?: number } | null {
  const stageEvents = events.filter((e) => e.stage === stage)
  const withProgress = stageEvents.find((e) => e.progress)
  return withProgress?.progress || null
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/assistant/reasoning/client/__tests__/selectors.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/assistant/reasoning/client/selectors.ts src/lib/assistant/reasoning/client/__tests__/selectors.test.ts
git commit -m "feat(reasoning-client): add event selectors"
```

---

## Task 3: Create SSE Parser

**Files:**

- Create: `src/lib/assistant/reasoning/client/sse-parser.ts`
- Test: `src/lib/assistant/reasoning/client/__tests__/sse-parser.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/assistant/reasoning/client/__tests__/sse-parser.test.ts
import { describe, it, expect } from "vitest"
import { parseSSEMessage, SSEMessage } from "../sse-parser"

describe("parseSSEMessage", () => {
  it("parses reasoning event", () => {
    const raw = `event: reasoning
id: req_test_001
data: {"v":1,"stage":"SOURCES","status":"started"}

`
    const message = parseSSEMessage(raw)

    expect(message).not.toBeNull()
    expect(message?.type).toBe("reasoning")
    expect(message?.id).toBe("req_test_001")
    expect(message?.data.stage).toBe("SOURCES")
  })

  it("parses terminal event", () => {
    const raw = `event: terminal
id: req_test_final
data: {"v":1,"stage":"ANSWER","status":"complete"}

`
    const message = parseSSEMessage(raw)

    expect(message?.type).toBe("terminal")
    expect(message?.data.stage).toBe("ANSWER")
  })

  it("parses heartbeat", () => {
    const raw = `event: heartbeat
data: {"ts":"2025-12-26T10:00:00Z"}

`
    const message = parseSSEMessage(raw)

    expect(message?.type).toBe("heartbeat")
    expect(message?.data.ts).toBeDefined()
  })

  it("returns null for invalid message", () => {
    const raw = "invalid message"
    const message = parseSSEMessage(raw)

    expect(message).toBeNull()
  })

  it("handles multiline data", () => {
    const raw = `event: reasoning
id: req_test_001
data: {"v":1,"stage":"ANALYSIS","status":"checkpoint",
data: "message":"Comparing sources..."}

`
    // Note: SSE spec says data lines are concatenated with newlines
    // Our parser should handle this
    const message = parseSSEMessage(raw)

    expect(message).not.toBeNull()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/assistant/reasoning/client/__tests__/sse-parser.test.ts`
Expected: FAIL with "Cannot find module '../sse-parser'"

**Step 3: Write the implementation**

```typescript
// src/lib/assistant/reasoning/client/sse-parser.ts
import type { ReasoningEvent } from "../types"
import type { SSEEventType } from "./types"
import { SSE_EVENT_TYPES } from "./types"

export interface SSEMessage {
  type: SSEEventType
  id?: string
  data: ReasoningEvent | { ts: string }
}

/**
 * Parse a raw SSE message into structured format.
 *
 * SSE format:
 *   event: <type>
 *   id: <id>
 *   data: <json>
 *
 */
export function parseSSEMessage(raw: string): SSEMessage | null {
  const lines = raw.split("\n")

  let eventType: string | undefined
  let id: string | undefined
  let dataLines: string[] = []

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventType = line.slice(6).trim()
    } else if (line.startsWith("id:")) {
      id = line.slice(3).trim()
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim())
    }
  }

  if (!eventType || dataLines.length === 0) {
    return null
  }

  // Validate event type
  const validTypes = Object.values(SSE_EVENT_TYPES)
  if (!validTypes.includes(eventType as SSEEventType)) {
    return null
  }

  // Parse JSON data
  try {
    const jsonStr = dataLines.join("")
    const data = JSON.parse(jsonStr)

    return {
      type: eventType as SSEEventType,
      id,
      data,
    }
  } catch {
    return null
  }
}

/**
 * Create an SSE event source connection.
 * Returns cleanup function.
 */
export function createSSEConnection(
  url: string,
  body: object,
  handlers: {
    onMessage: (message: SSEMessage) => void
    onError: (error: Error) => void
    onOpen?: () => void
  }
): () => void {
  const controller = new AbortController()

  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      handlers.onOpen?.()

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error("No response body")
      }

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Split on double newline (SSE message delimiter)
        const messages = buffer.split("\n\n")
        buffer = messages.pop() || "" // Keep incomplete message in buffer

        for (const raw of messages) {
          if (raw.trim()) {
            const message = parseSSEMessage(raw + "\n\n")
            if (message) {
              handlers.onMessage(message)
            }
          }
        }
      }
    })
    .catch((error) => {
      if (error.name !== "AbortError") {
        handlers.onError(error)
      }
    })

  return () => controller.abort()
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/assistant/reasoning/client/__tests__/sse-parser.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/assistant/reasoning/client/sse-parser.ts src/lib/assistant/reasoning/client/__tests__/sse-parser.test.ts
git commit -m "feat(reasoning-client): add SSE message parser"
```

---

## Task 4: Create useReasoningStream Hook

**Files:**

- Create: `src/lib/assistant/reasoning/client/useReasoningStream.ts`
- Test: `src/lib/assistant/reasoning/client/__tests__/useReasoningStream.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/lib/assistant/reasoning/client/__tests__/useReasoningStream.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useReasoningStream } from "../useReasoningStream"

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe("useReasoningStream", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("starts in idle state", () => {
    const { result } = renderHook(() => useReasoningStream({ surface: "APP" }))

    expect(result.current.streamState).toBe("idle")
    expect(result.current.events).toHaveLength(0)
    expect(result.current.requestId).toBeNull()
  })

  it("transitions to connecting on submit", async () => {
    mockFetch.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    )

    const { result } = renderHook(() => useReasoningStream({ surface: "APP" }))

    act(() => {
      result.current.actions.submit("test query")
    })

    expect(result.current.streamState).toBe("connecting")
  })

  it("resets state on reset action", async () => {
    const { result } = renderHook(() => useReasoningStream({ surface: "APP" }))

    // Simulate some state
    act(() => {
      result.current.actions.submit("test query")
    })

    act(() => {
      result.current.actions.reset()
    })

    expect(result.current.streamState).toBe("idle")
    expect(result.current.events).toHaveLength(0)
  })

  it("provides selectors", () => {
    const { result } = renderHook(() => useReasoningStream({ surface: "APP" }))

    expect(result.current.selectors).toBeDefined()
    expect(result.current.selectors.byStage).toBeDefined()
    expect(result.current.selectors.latestByStage).toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/assistant/reasoning/client/__tests__/useReasoningStream.test.tsx`
Expected: FAIL with "Cannot find module '../useReasoningStream'"

**Step 3: Write the implementation**

```typescript
// src/lib/assistant/reasoning/client/useReasoningStream.ts
"use client"

import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import type { ReasoningEvent, RiskTier, Surface, ContextResolutionPayload } from "../types"
import { isTerminal } from "../types"
import type { StreamState, UseReasoningStreamReturn, ReasoningStreamActions } from "./types"
import { createSelectors } from "./selectors"
import { createSSEConnection, type SSEMessage } from "./sse-parser"
import { SSE_EVENT_TYPES } from "./types"

interface UseReasoningStreamOptions {
  surface: Surface
  endpoint?: string
  onEvent?: (event: ReasoningEvent) => void
  onTerminal?: (event: ReasoningEvent) => void
  onError?: (error: Error) => void
}

const DEFAULT_ENDPOINT = "/api/assistant/chat/reasoning"

export function useReasoningStream(options: UseReasoningStreamOptions): UseReasoningStreamReturn {
  const { surface, endpoint = DEFAULT_ENDPOINT, onEvent, onTerminal, onError } = options

  // State
  const [requestId, setRequestId] = useState<string | null>(null)
  const [events, setEvents] = useState<ReasoningEvent[]>([])
  const [streamState, setStreamState] = useState<StreamState>("idle")
  const [error, setError] = useState<Error | null>(null)
  const [riskTier, setRiskTier] = useState<RiskTier | null>(null)

  // Cleanup ref
  const cleanupRef = useRef<(() => void) | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRef.current?.()
    }
  }, [])

  // Handle incoming SSE message
  const handleMessage = useCallback(
    (message: SSEMessage) => {
      if (message.type === SSE_EVENT_TYPES.HEARTBEAT) {
        // Ignore heartbeats for now
        return
      }

      const event = message.data as ReasoningEvent

      // Extract request ID from first event
      if (!requestId && event.requestId) {
        setRequestId(event.requestId)
      }

      // Extract risk tier from context resolution
      if (event.stage === "CONTEXT_RESOLUTION" && event.status === "complete") {
        const data = event.data as ContextResolutionPayload
        setRiskTier(data.riskTier)
      }

      // Check for awaiting input
      if (event.status === "awaiting_input") {
        setStreamState("awaiting_input")
      }

      // Accumulate event
      setEvents((prev) => [...prev, event])

      // Callbacks
      onEvent?.(event)

      // Check for terminal
      if (isTerminal(event)) {
        setStreamState("ended")
        onTerminal?.(event)
      }
    },
    [requestId, onEvent, onTerminal]
  )

  // Handle SSE error
  const handleError = useCallback(
    (err: Error) => {
      setError(err)
      setStreamState("error")
      onError?.(err)
    },
    [onError]
  )

  // Submit action
  const submit = useCallback(
    (query: string) => {
      // Cancel any existing connection
      cleanupRef.current?.()

      // Reset state
      setEvents([])
      setError(null)
      setRiskTier(null)
      setStreamState("connecting")

      // Create connection
      const cleanup = createSSEConnection(
        endpoint,
        { query, surface },
        {
          onMessage: handleMessage,
          onError: handleError,
          onOpen: () => setStreamState("streaming"),
        }
      )

      cleanupRef.current = cleanup
    },
    [endpoint, surface, handleMessage, handleError]
  )

  // Cancel action
  const cancel = useCallback(() => {
    cleanupRef.current?.()
    cleanupRef.current = null
    setStreamState("idle")
  }, [])

  // Reset action
  const reset = useCallback(() => {
    cleanupRef.current?.()
    cleanupRef.current = null
    setRequestId(null)
    setEvents([])
    setStreamState("idle")
    setError(null)
    setRiskTier(null)
  }, [])

  // Answer clarification action
  const answerClarification = useCallback((answer: string) => {
    // For now, this would need to be implemented with a callback mechanism
    // The pipeline would need to support receiving clarification answers
    console.log("Clarification answer:", answer)
    setStreamState("streaming")
  }, [])

  // Actions object
  const actions: ReasoningStreamActions = useMemo(
    () => ({
      submit,
      cancel,
      reset,
      answerClarification,
    }),
    [submit, cancel, reset, answerClarification]
  )

  // Selectors (memoized)
  const selectors = useMemo(() => createSelectors(events), [events])

  return {
    requestId,
    events,
    streamState,
    error,
    riskTier,
    actions,
    selectors,
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/assistant/reasoning/client/__tests__/useReasoningStream.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/assistant/reasoning/client/useReasoningStream.ts src/lib/assistant/reasoning/client/__tests__/useReasoningStream.test.tsx
git commit -m "feat(reasoning-client): add useReasoningStream hook"
```

---

## Task 5: Create Client Module Index

**Files:**

- Create: `src/lib/assistant/reasoning/client/index.ts`

**Step 1: Create barrel export**

```typescript
// src/lib/assistant/reasoning/client/index.ts

// Types
export type {
  StreamState,
  ReasoningSelectors,
  ReasoningStreamState,
  ReasoningStreamActions,
  UseReasoningStreamReturn,
  SSEEventType,
} from "./types"
export { SSE_EVENT_TYPES } from "./types"

// Selectors
export {
  createSelectors,
  getTerminalFromEvents,
  getCurrentStage,
  isStageComplete,
  getStageProgress,
} from "./selectors"

// SSE Parser
export { parseSSEMessage, createSSEConnection, type SSEMessage } from "./sse-parser"

// Hook
export { useReasoningStream } from "./useReasoningStream"
```

**Step 2: Commit**

```bash
git add src/lib/assistant/reasoning/client/index.ts
git commit -m "feat(reasoning-client): add client module index"
```

---

## Task 6: Create useReasoningStage Hook (UI Helper)

**Files:**

- Create: `src/lib/assistant/reasoning/client/useReasoningStage.ts`

**Step 1: Create the helper hook**

```typescript
// src/lib/assistant/reasoning/client/useReasoningStage.ts
"use client"

import { useMemo } from "react"
import type { ReasoningEvent, ReasoningStage } from "../types"
import type { ReasoningSelectors } from "./types"

export interface StageState {
  isActive: boolean
  isComplete: boolean
  isPending: boolean
  events: ReasoningEvent[]
  latest: ReasoningEvent | null
  message: string | null
  progress: { current: number; total?: number } | null
}

/**
 * Hook to get the state of a specific reasoning stage.
 * Useful for rendering individual stage UI components.
 */
export function useReasoningStage(
  selectors: ReasoningSelectors,
  stage: ReasoningStage,
  currentStage: ReasoningStage | null
): StageState {
  return useMemo(() => {
    const events = selectors.byStage[stage] || []
    const latest = selectors.latestByStage[stage] || null

    const isComplete = latest?.status === "complete"
    const isActive = currentStage === stage && !isComplete
    const isPending = !events.length && !isComplete

    // Get latest message
    const message = latest?.message || null

    // Get progress if available
    const progressEvent = events.find((e) => e.progress)
    const progress = progressEvent?.progress || null

    return {
      isActive,
      isComplete,
      isPending,
      events,
      latest,
      message,
      progress,
    }
  }, [selectors, stage, currentStage])
}

/**
 * Get stage label for UI display.
 */
export function getStageLabel(stage: ReasoningStage): string {
  const labels: Record<ReasoningStage, string> = {
    CONTEXT_RESOLUTION: "Razumijevanje pitanja",
    CLARIFICATION: "Pojašnjenje",
    SOURCES: "Pretraživanje izvora",
    RETRIEVAL: "Dohvat propisa",
    APPLICABILITY: "Provjera primjenjivosti",
    CONFLICTS: "Provjera sukoba",
    ANALYSIS: "Analiza",
    CONFIDENCE: "Pouzdanost",
    ANSWER: "Odgovor",
    QUALIFIED_ANSWER: "Kvalificirani odgovor",
    REFUSAL: "Odbijanje",
    ERROR: "Greška",
  }

  return labels[stage] || stage
}

/**
 * Get stage icon for UI display.
 */
export function getStageIcon(stage: ReasoningStage): string {
  const icons: Record<ReasoningStage, string> = {
    CONTEXT_RESOLUTION: "🔍",
    CLARIFICATION: "❓",
    SOURCES: "📚",
    RETRIEVAL: "📋",
    APPLICABILITY: "✅",
    CONFLICTS: "⚖️",
    ANALYSIS: "🔬",
    CONFIDENCE: "📊",
    ANSWER: "💡",
    QUALIFIED_ANSWER: "⚠️",
    REFUSAL: "🚫",
    ERROR: "❌",
  }

  return icons[stage] || "•"
}
```

**Step 2: Add to index**

Update `src/lib/assistant/reasoning/client/index.ts`:

```typescript
// Add to exports
export {
  useReasoningStage,
  getStageLabel,
  getStageIcon,
  type StageState,
} from "./useReasoningStage"
```

**Step 3: Commit**

```bash
git add src/lib/assistant/reasoning/client/useReasoningStage.ts src/lib/assistant/reasoning/client/index.ts
git commit -m "feat(reasoning-client): add useReasoningStage helper hook"
```

---

## Verification Checklist

After completing all tasks:

- [ ] `npx vitest run src/lib/assistant/reasoning/client/` - All tests pass
- [ ] Hook manages state correctly through stream lifecycle
- [ ] Selectors derive correct data from events
- [ ] SSE parser handles all message types

---

## Next Track

Proceed to **Track 5: Frontend Components** which builds the UI components using these hooks.
