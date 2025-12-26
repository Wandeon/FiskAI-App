# Visible Reasoning UX - Track 6: Integration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire components together, maintain backward compatibility, and implement mandatory shadow mode for safe rollout.

**Architecture:** Feature flag controls which pipeline runs. Shadow mode runs both pipelines concurrently (old serves response, new logs traces). ReasoningAssistantContainer orchestrates the full UX. Existing endpoints use backward-compatible wrapper.

**Tech Stack:** Next.js, Feature flags, Prisma

**Depends on:** Tracks 1-5

---

## Task 1: Create Feature Flag System

**Files:**

- Create: `src/lib/assistant/reasoning/feature-flags.ts`
- Test: `src/lib/assistant/reasoning/__tests__/feature-flags.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/assistant/reasoning/__tests__/feature-flags.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { isReasoningEnabled, getReasoningMode, ReasoningMode } from "../feature-flags"

describe("Feature Flags", () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe("isReasoningEnabled", () => {
    it("returns false when flag is not set", () => {
      delete process.env.REASONING_UX_ENABLED
      expect(isReasoningEnabled()).toBe(false)
    })

    it("returns true when flag is set to true", () => {
      process.env.REASONING_UX_ENABLED = "true"
      expect(isReasoningEnabled()).toBe(true)
    })

    it("returns false when flag is set to false", () => {
      process.env.REASONING_UX_ENABLED = "false"
      expect(isReasoningEnabled()).toBe(false)
    })
  })

  describe("getReasoningMode", () => {
    it("returns shadow when REASONING_MODE is shadow", () => {
      process.env.REASONING_MODE = "shadow"
      expect(getReasoningMode()).toBe("shadow")
    })

    it("returns live when REASONING_MODE is live", () => {
      process.env.REASONING_MODE = "live"
      expect(getReasoningMode()).toBe("live")
    })

    it("returns off when not set", () => {
      delete process.env.REASONING_MODE
      expect(getReasoningMode()).toBe("off")
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/assistant/reasoning/__tests__/feature-flags.test.ts`
Expected: FAIL with "Cannot find module '../feature-flags'"

**Step 3: Write the implementation**

```typescript
// src/lib/assistant/reasoning/feature-flags.ts

export type ReasoningMode = "off" | "shadow" | "live"

/**
 * Check if the Visible Reasoning UX is enabled.
 */
export function isReasoningEnabled(): boolean {
  return process.env.REASONING_UX_ENABLED === "true"
}

/**
 * Get the current reasoning mode.
 * - off: Use legacy pipeline only
 * - shadow: Run both pipelines, legacy serves response, new logs trace
 * - live: Use new reasoning pipeline
 */
export function getReasoningMode(): ReasoningMode {
  const mode = process.env.REASONING_MODE
  if (mode === "shadow" || mode === "live") {
    return mode
  }
  return "off"
}

/**
 * Check if user is in the reasoning beta cohort.
 * Uses percentage-based rollout.
 */
export function isInReasoningBeta(userId: string): boolean {
  const percentage = parseInt(process.env.REASONING_BETA_PERCENTAGE || "0", 10)
  if (percentage <= 0) return false
  if (percentage >= 100) return true

  // Simple hash-based rollout
  const hash = hashString(userId)
  return hash % 100 < percentage
}

/**
 * Get reasoning mode for a specific user.
 * Combines feature flags with per-user beta status.
 */
export function getReasoningModeForUser(userId?: string): ReasoningMode {
  const globalMode = getReasoningMode()

  // Shadow mode always applies globally
  if (globalMode === "shadow") {
    return "shadow"
  }

  // Live mode respects beta cohort
  if (globalMode === "live") {
    if (!userId) return "off"
    return isInReasoningBeta(userId) ? "live" : "off"
  }

  return "off"
}

/**
 * Simple string hash for consistent user bucketing.
 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/assistant/reasoning/__tests__/feature-flags.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/assistant/reasoning/feature-flags.ts src/lib/assistant/reasoning/__tests__/feature-flags.test.ts
git commit -m "feat(reasoning): add feature flag system for rollout control"
```

---

## Task 2: Create Shadow Mode Runner

**Files:**

- Create: `src/lib/assistant/reasoning/shadow-runner.ts`
- Test: `src/lib/assistant/reasoning/__tests__/shadow-runner.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/assistant/reasoning/__tests__/shadow-runner.test.ts
import { describe, it, expect, vi } from "vitest"
import { runShadowMode } from "../shadow-runner"

// Mock the pipelines
vi.mock("@/lib/assistant/query-engine/answer-builder", () => ({
  buildAnswer: vi.fn().mockResolvedValue({
    schemaVersion: "1.0.0",
    requestId: "req_legacy",
    kind: "ANSWER",
    headline: "Legacy answer",
    directAnswer: "Test",
  }),
}))

vi.mock("../pipeline", () => ({
  buildAnswerWithReasoning: vi.fn().mockImplementation(async function* () {
    yield { stage: "CONTEXT_RESOLUTION", status: "complete" }
    yield { stage: "ANSWER", status: "complete" }
    return { outcome: "ANSWER", answerHr: "New answer", citations: [] }
  }),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    reasoningTrace: {
      create: vi.fn().mockResolvedValue({ id: "trace_123" }),
    },
  },
}))

describe("runShadowMode", () => {
  it("returns legacy response", async () => {
    const result = await runShadowMode("test query", "MARKETING")

    expect(result.requestId).toBe("req_legacy")
    expect(result.kind).toBe("ANSWER")
  })

  it("runs new pipeline in background", async () => {
    await runShadowMode("test query", "MARKETING")

    // Give background task time to complete
    await new Promise((resolve) => setTimeout(resolve, 100))

    const { prisma } = await import("@/lib/prisma")
    expect(prisma.reasoningTrace.create).toHaveBeenCalled()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/assistant/reasoning/__tests__/shadow-runner.test.ts`
Expected: FAIL with "Cannot find module '../shadow-runner'"

**Step 3: Write the implementation**

```typescript
// src/lib/assistant/reasoning/shadow-runner.ts
import { nanoid } from "nanoid"
import { buildAnswer } from "@/lib/assistant/query-engine/answer-builder"
import { buildAnswerWithReasoning } from "./pipeline"
import { createAuditSink, consumeReasoning } from "./sinks"
import type { AssistantResponse, Surface } from "@/lib/assistant/types"
import type { UserContextSnapshot } from "./types"
import { prisma } from "@/lib/prisma"

interface ShadowModeResult {
  legacyResponse: AssistantResponse
  shadowRequestId: string
}

/**
 * Run both legacy and new pipelines.
 * Legacy response is returned immediately.
 * New pipeline runs in background and logs trace.
 */
export async function runShadowMode(
  query: string,
  surface: Surface,
  companyId?: string
): Promise<AssistantResponse> {
  const shadowRequestId = `shadow_${nanoid()}`

  // Run legacy pipeline (this is what we return)
  const legacyResponse = await buildAnswer(query, surface, companyId)

  // Run new pipeline in background (fire and forget)
  runNewPipelineInBackground(shadowRequestId, query, surface, companyId).catch((error) => {
    console.error("[ShadowMode] Background pipeline failed", {
      shadowRequestId,
      error: error instanceof Error ? error.message : "Unknown",
    })
  })

  return legacyResponse
}

async function runNewPipelineInBackground(
  shadowRequestId: string,
  query: string,
  surface: Surface,
  companyId?: string
): Promise<void> {
  const startTime = Date.now()

  // Create user context snapshot
  const userContextSnapshot: UserContextSnapshot = {
    assumedDefaults: ["vatStatus: unknown", "turnoverBand: unknown"],
  }

  // Create audit sink only (no SSE in shadow mode)
  const auditSink = createAuditSink(shadowRequestId, userContextSnapshot)

  try {
    // Run new pipeline
    const generator = buildAnswerWithReasoning(
      shadowRequestId,
      query,
      surface as "APP" | "MARKETING",
      undefined // No company context in shadow mode for now
    )

    // Consume to completion
    const terminal = await consumeReasoning(generator, [auditSink])

    // Log shadow comparison
    console.info("[ShadowMode] Pipeline completed", {
      shadowRequestId,
      outcome: terminal.outcome,
      durationMs: Date.now() - startTime,
    })
  } catch (error) {
    // Log shadow error (don't fail the main request)
    console.error("[ShadowMode] Pipeline error", {
      shadowRequestId,
      error: error instanceof Error ? error.message : "Unknown",
      durationMs: Date.now() - startTime,
    })
  }
}

/**
 * Compare shadow results for metrics.
 * Called after both pipelines complete.
 */
export async function compareShadowResults(
  legacyRequestId: string,
  shadowRequestId: string
): Promise<{
  match: boolean
  differences: string[]
}> {
  try {
    const trace = await prisma.reasoningTrace.findUnique({
      where: { requestId: shadowRequestId },
    })

    if (!trace) {
      return { match: false, differences: ["Shadow trace not found"] }
    }

    // Compare outcomes
    // This would need the legacy response stored somewhere for full comparison
    // For now, just verify trace exists

    return { match: true, differences: [] }
  } catch (error) {
    return { match: false, differences: ["Comparison failed"] }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/assistant/reasoning/__tests__/shadow-runner.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/assistant/reasoning/shadow-runner.ts src/lib/assistant/reasoning/__tests__/shadow-runner.test.ts
git commit -m "feat(reasoning): add shadow mode runner for safe rollout"
```

---

## Task 3: Update Legacy API to Support Shadow Mode

**Files:**

- Modify: `src/app/api/assistant/chat/route.ts`

**Step 1: Update the endpoint**

```typescript
// src/app/api/assistant/chat/route.ts
import { NextRequest, NextResponse } from "next/server"
import { buildAnswer } from "@/lib/assistant/query-engine/answer-builder"
import { validateResponse } from "@/lib/assistant/validation"
import { SCHEMA_VERSION, type Surface, type AssistantResponse } from "@/lib/assistant/types"
import { nanoid } from "nanoid"
import { getReasoningMode } from "@/lib/assistant/reasoning/feature-flags"
import { runShadowMode } from "@/lib/assistant/reasoning/shadow-runner"
import { buildAnswerCompat } from "@/lib/assistant/reasoning/compat"

interface ChatRequest {
  query: string
  surface: Surface
  companyId?: string
}

/**
 * FAIL-CLOSED API ROUTE
 *
 * Supports three modes based on REASONING_MODE env var:
 * - off: Legacy pipeline only
 * - shadow: Both pipelines, legacy serves
 * - live: New reasoning pipeline
 */
export async function POST(request: NextRequest) {
  const requestId = `req_${nanoid()}`
  const traceId = `trace_${nanoid()}`

  try {
    const body = (await request.json()) as ChatRequest

    // Validate request
    if (!body.query || typeof body.query !== "string" || body.query.trim().length === 0) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 })
    }

    if (!body.surface || !["MARKETING", "APP"].includes(body.surface)) {
      return NextResponse.json({ error: "Invalid surface" }, { status: 400 })
    }

    // Determine which pipeline to use
    const mode = getReasoningMode()
    let response: AssistantResponse

    switch (mode) {
      case "shadow":
        // Run both pipelines, return legacy
        response = await runShadowMode(body.query.trim(), body.surface, body.companyId)
        break

      case "live":
        // Use new reasoning pipeline with compat wrapper
        response = await buildAnswerCompat(body.query.trim(), body.surface, body.companyId)
        break

      case "off":
      default:
        // Use legacy pipeline only
        response = await buildAnswer(body.query.trim(), body.surface, body.companyId)
        break
    }

    // FAIL-CLOSED: Validate response before sending
    const validation = validateResponse(response)
    if (!validation.valid) {
      console.error("[Assistant API] FAIL-CLOSED triggered", {
        requestId: response.requestId,
        traceId: response.traceId,
        errors: validation.errors,
        query: body.query.substring(0, 100),
        surface: body.surface,
        mode,
      })

      // Return a valid REFUSAL response
      const refusalResponse: AssistantResponse = {
        schemaVersion: SCHEMA_VERSION,
        requestId: response.requestId || requestId,
        traceId: response.traceId || traceId,
        kind: "REFUSAL",
        topic: response.topic || "REGULATORY",
        surface: body.surface,
        createdAt: new Date().toISOString(),
        headline: "Nije moguće potvrditi odgovor",
        directAnswer: "",
        refusalReason: "NO_CITABLE_RULES",
        refusal: {
          message: "Nismo pronašli dovoljno pouzdane izvore za ovaj odgovor.",
          relatedTopics: ["porez na dohodak", "PDV", "doprinosi", "fiskalizacija"],
        },
      }

      return NextResponse.json(refusalResponse)
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[Assistant API] Internal error", {
      requestId,
      traceId,
      error: error instanceof Error ? error.message : "Unknown error",
    })

    const errorResponse: AssistantResponse = {
      schemaVersion: SCHEMA_VERSION,
      requestId,
      traceId,
      kind: "REFUSAL",
      topic: "REGULATORY",
      surface: "MARKETING",
      createdAt: new Date().toISOString(),
      headline: "Došlo je do pogreške",
      directAnswer: "",
      refusalReason: "NO_CITABLE_RULES",
      refusal: {
        message: "Privremena pogreška sustava. Molimo pokušajte ponovo.",
      },
    }

    return NextResponse.json(errorResponse)
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/assistant/chat/route.ts
git commit -m "feat(api): add shadow mode support to legacy endpoint"
```

---

## Task 4: Create Reasoning Assistant Container

**Files:**

- Create: `src/components/assistant-v2/reasoning/ReasoningAssistantContainer.tsx`

**Step 1: Create the component**

```tsx
// src/components/assistant-v2/reasoning/ReasoningAssistantContainer.tsx
"use client"

import { useState, useCallback, useMemo } from "react"
import { cn } from "@/lib/utils"
import { useReasoningStream, getCurrentStage } from "@/lib/assistant/reasoning/client"
import { ReasoningStepper } from "./ReasoningStepper"
import { ReasoningCard } from "./ReasoningCard"
import { MorphingPill, ReasoningModal } from "./MorphingPill"
import { TerminalAnswerCard } from "./TerminalAnswerCard"
import { AssistantInput } from "../AssistantInput"
import { REASONING_STAGES } from "@/lib/assistant/reasoning"

interface ReasoningAssistantContainerProps {
  surface: "APP" | "MARKETING"
  className?: string
}

export function ReasoningAssistantContainer({
  surface,
  className,
}: ReasoningAssistantContainerProps) {
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false)

  const { events, streamState, error, riskTier, actions, selectors } = useReasoningStream({
    surface,
  })

  const currentStage = useMemo(() => getCurrentStage(events), [events])

  // Determine if we should show mobile UX
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768
  const showMobilePill = isMobile && (riskTier === "T2" || riskTier === "T3")

  // Handle submit
  const handleSubmit = useCallback(
    (query: string) => {
      actions.submit(query)
    },
    [actions]
  )

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Chat history area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Show completed reasoning as cards after stream ends */}
        {streamState === "ended" && <ReasoningHistory events={events} selectors={selectors} />}

        {/* Terminal answer card */}
        {selectors.terminal && selectors.terminalOutcome && (
          <TerminalAnswerCard
            outcome={selectors.terminalOutcome}
            payload={selectors.terminal.data}
          />
        )}
      </div>

      {/* Live reasoning stepper (desktop) */}
      {streamState !== "idle" && streamState !== "ended" && !showMobilePill && (
        <div className="px-4 pb-4">
          <ReasoningStepper
            events={events}
            selectors={selectors}
            streamState={streamState}
            riskTier={riskTier}
          />
        </div>
      )}

      {/* Mobile morphing pill */}
      {showMobilePill && streamState === "streaming" && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40">
          <MorphingPill
            currentStage={currentStage}
            streamState={streamState}
            onExpand={() => setIsMobileModalOpen(true)}
          />
        </div>
      )}

      {/* Mobile reasoning modal */}
      <ReasoningModal isOpen={isMobileModalOpen} onClose={() => setIsMobileModalOpen(false)}>
        <ReasoningStepper
          events={events}
          selectors={selectors}
          streamState={streamState}
          riskTier={riskTier}
        />
      </ReasoningModal>

      {/* Input area */}
      <div className="border-t border-gray-200 bg-white p-4">
        <AssistantInput
          onSubmit={handleSubmit}
          disabled={streamState === "streaming" || streamState === "connecting"}
          placeholder={
            streamState === "streaming"
              ? "Analiziramo..."
              : "Postavite pitanje o hrvatskim propisima..."
          }
        />

        {/* Error message */}
        {error && (
          <div className="mt-2 p-2 bg-red-50 text-red-700 text-sm rounded">{error.message}</div>
        )}
      </div>
    </div>
  )
}

// === REASONING HISTORY ===

interface ReasoningHistoryProps {
  events: import("@/lib/assistant/reasoning").ReasoningEvent[]
  selectors: import("@/lib/assistant/reasoning/client").ReasoningSelectors
}

function ReasoningHistory({ events, selectors }: ReasoningHistoryProps) {
  return (
    <div className="space-y-2">
      {REASONING_STAGES.map((stage) => {
        const latest = selectors.latestByStage[stage]
        if (!latest || latest.status !== "complete") return null

        return (
          <ReasoningCard
            key={stage}
            stage={stage}
            completeEvent={latest}
            allEvents={events}
            defaultExpanded={false}
          />
        )
      })}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/assistant-v2/reasoning/ReasoningAssistantContainer.tsx
git commit -m "feat(ui): add ReasoningAssistantContainer orchestrating full UX"
```

---

## Task 5: Update Components Index

**Files:**

- Modify: `src/components/assistant-v2/reasoning/index.ts`

**Step 1: Add container export**

```typescript
// src/components/assistant-v2/reasoning/index.ts
export { StageStep } from "./StageStep"
export { ReasoningStepper } from "./ReasoningStepper"
export { ReasoningCard } from "./ReasoningCard"
export { MorphingPill, ReasoningModal } from "./MorphingPill"
export { TerminalAnswerCard } from "./TerminalAnswerCard"
export { ReasoningAssistantContainer } from "./ReasoningAssistantContainer"
```

**Step 2: Commit**

```bash
git add src/components/assistant-v2/reasoning/index.ts
git commit -m "feat(ui): export ReasoningAssistantContainer"
```

---

## Task 6: Add Environment Variables Documentation

**Files:**

- Modify: `.env.example`

**Step 1: Add reasoning config vars**

Add to `.env.example`:

```bash
# === VISIBLE REASONING UX ===
# Enable/disable reasoning UX
REASONING_UX_ENABLED=false

# Reasoning mode: off | shadow | live
# - off: Legacy pipeline only
# - shadow: Both pipelines, legacy serves, new logs traces (mandatory before live)
# - live: New reasoning pipeline serves responses
REASONING_MODE=off

# Beta rollout percentage (0-100)
# Only applies when REASONING_MODE=live
REASONING_BETA_PERCENTAGE=0
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add reasoning UX environment variables"
```

---

## Verification Checklist

After completing all tasks:

- [ ] Feature flags work correctly
- [ ] Shadow mode runs both pipelines
- [ ] Legacy endpoint uses correct mode
- [ ] Container orchestrates full UX
- [ ] Mobile UX works with MorphingPill
- [ ] Environment variables documented

**Manual testing:**

```bash
# Test shadow mode
REASONING_MODE=shadow npm run dev

# In another terminal:
curl -X POST http://localhost:3000/api/assistant/chat \
  -H "Content-Type: application/json" \
  -d '{"query":"Koji je prag za PDV?","surface":"APP"}'

# Check database for trace:
docker exec fiskai-db psql -U fiskai -d fiskai -c \
  "SELECT * FROM \"ReasoningTrace\" ORDER BY \"createdAt\" DESC LIMIT 1;"
```

---

## Next Track

Proceed to **Track 7: Validation** for comprehensive testing and monitoring setup.
