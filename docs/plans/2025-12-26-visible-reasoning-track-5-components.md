# Visible Reasoning UX - Track 5: Frontend Components

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build React components for the Visible Reasoning UX: ReasoningStepper (live), ReasoningCard (history), MorphingPill (mobile), and AnswerCard (terminal).

**Architecture:** ReasoningStepper shows all 7 stages during streaming. After completion, stages collapse to ReasoningCards in chat. MorphingPill provides compact mobile UX for T2/T3 queries. AnswerCard handles all terminal outcomes with appropriate styling.

**Tech Stack:** React 18, Tailwind CSS, CVA, Framer Motion

**Depends on:** Track 4 (Frontend State)

---

## Task 1: Create Stage Step Component

**Files:**

- Create: `src/components/assistant-v2/reasoning/StageStep.tsx`

**Step 1: Create the component**

```tsx
// src/components/assistant-v2/reasoning/StageStep.tsx
"use client"

import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"
import { Check, Loader2, Circle, AlertCircle } from "lucide-react"
import type { ReasoningStage } from "@/lib/assistant/reasoning"
import { getStageLabel } from "@/lib/assistant/reasoning/client"

const stepVariants = cva("flex items-start gap-3 p-3 rounded-lg transition-all duration-200", {
  variants: {
    state: {
      pending: "opacity-50",
      active: "bg-blue-50 border border-blue-200",
      complete: "opacity-80",
      error: "bg-red-50 border border-red-200",
    },
    expanded: {
      true: "",
      false: "cursor-pointer hover:bg-gray-50",
    },
  },
  defaultVariants: {
    state: "pending",
    expanded: false,
  },
})

const iconVariants = cva("flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center", {
  variants: {
    state: {
      pending: "bg-gray-200 text-gray-400",
      active: "bg-blue-500 text-white",
      complete: "bg-green-500 text-white",
      error: "bg-red-500 text-white",
    },
  },
  defaultVariants: {
    state: "pending",
  },
})

interface StageStepProps extends VariantProps<typeof stepVariants> {
  stage: ReasoningStage
  message?: string | null
  progress?: { current: number; total?: number } | null
  isExpanded?: boolean
  onToggle?: () => void
  children?: React.ReactNode
}

export function StageStep({
  stage,
  state = "pending",
  message,
  progress,
  expanded = false,
  isExpanded = false,
  onToggle,
  children,
}: StageStepProps) {
  const label = getStageLabel(stage)

  return (
    <div
      className={cn(stepVariants({ state, expanded }))}
      onClick={!expanded ? onToggle : undefined}
      role={!expanded ? "button" : undefined}
      tabIndex={!expanded ? 0 : undefined}
    >
      {/* Icon */}
      <div className={cn(iconVariants({ state }))}>
        {state === "pending" && <Circle className="w-3 h-3" />}
        {state === "active" && <Loader2 className="w-4 h-4 animate-spin" />}
        {state === "complete" && <Check className="w-4 h-4" />}
        {state === "error" && <AlertCircle className="w-4 h-4" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm text-gray-900">{label}</span>
          {progress && (
            <span className="text-xs text-gray-500">
              {progress.current}
              {progress.total ? `/${progress.total}` : ""}
            </span>
          )}
        </div>

        {/* Message */}
        {message && state === "active" && (
          <p className="text-sm text-gray-600 mt-1 truncate">{message}</p>
        )}

        {/* Expanded content */}
        {isExpanded && children && (
          <div className="mt-3 pt-3 border-t border-gray-100">{children}</div>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/assistant-v2/reasoning/StageStep.tsx
git commit -m "feat(ui): add StageStep component for reasoning stages"
```

---

## Task 2: Create ReasoningStepper Component

**Files:**

- Create: `src/components/assistant-v2/reasoning/ReasoningStepper.tsx`

**Step 1: Create the component**

```tsx
// src/components/assistant-v2/reasoning/ReasoningStepper.tsx
"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { StageStep } from "./StageStep"
import { REASONING_STAGES, type ReasoningStage, type RiskTier } from "@/lib/assistant/reasoning"
import {
  type ReasoningSelectors,
  type StreamState,
  getCurrentStage,
  useReasoningStage,
} from "@/lib/assistant/reasoning/client"

interface ReasoningStepperProps {
  events: import("@/lib/assistant/reasoning").ReasoningEvent[]
  selectors: ReasoningSelectors
  streamState: StreamState
  riskTier: RiskTier | null
  className?: string
}

export function ReasoningStepper({
  events,
  selectors,
  streamState,
  riskTier,
  className,
}: ReasoningStepperProps) {
  const currentStage = useMemo(() => getCurrentStage(events), [events])

  // Determine visibility based on risk tier
  const isCollapsed = riskTier === "T2" || riskTier === "T3"
  const showAllStages = streamState === "streaming" || !isCollapsed

  // Last update time
  const lastEventTime = events.length > 0 ? events[events.length - 1].ts : null
  const timeSinceLastEvent = lastEventTime
    ? Math.round((Date.now() - new Date(lastEventTime).getTime()) / 1000)
    : null

  if (streamState === "idle") {
    return null
  }

  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden",
        className
      )}
      role="region"
      aria-label="Reasoning progress"
      aria-live="polite"
    >
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">
          {streamState === "streaming" && "Analiziramo vaše pitanje..."}
          {streamState === "awaiting_input" && "Potrebno pojašnjenje"}
          {streamState === "ended" && "Analiza završena"}
          {streamState === "error" && "Došlo je do greške"}
        </h3>

        {streamState === "streaming" && timeSinceLastEvent !== null && (
          <span className="text-xs text-gray-500">Ažurirano: {timeSinceLastEvent}s</span>
        )}
      </div>

      {/* Stages */}
      <div className="divide-y divide-gray-100">
        {REASONING_STAGES.map((stage) => (
          <StageStepWrapper
            key={stage}
            stage={stage}
            selectors={selectors}
            currentStage={currentStage}
            showDetails={showAllStages}
          />
        ))}
      </div>
    </div>
  )
}

interface StageStepWrapperProps {
  stage: ReasoningStage
  selectors: ReasoningSelectors
  currentStage: ReasoningStage | null
  showDetails: boolean
}

function StageStepWrapper({ stage, selectors, currentStage, showDetails }: StageStepWrapperProps) {
  const stageState = useReasoningStage(selectors, stage, currentStage)

  // Determine visual state
  let state: "pending" | "active" | "complete" | "error" = "pending"
  if (stageState.isComplete) {
    state = "complete"
  } else if (stageState.isActive) {
    state = "active"
  }

  // Don't render pending stages in collapsed mode
  if (!showDetails && state === "pending") {
    return null
  }

  return (
    <StageStep
      stage={stage}
      state={state}
      message={stageState.message}
      progress={stageState.progress}
      expanded={showDetails}
    />
  )
}
```

**Step 2: Commit**

```bash
git add src/components/assistant-v2/reasoning/ReasoningStepper.tsx
git commit -m "feat(ui): add ReasoningStepper for live reasoning display"
```

---

## Task 3: Create ReasoningCard Component

**Files:**

- Create: `src/components/assistant-v2/reasoning/ReasoningCard.tsx`

**Step 1: Create the component**

```tsx
// src/components/assistant-v2/reasoning/ReasoningCard.tsx
"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronUp, Check } from "lucide-react"
import type { ReasoningEvent, ReasoningStage } from "@/lib/assistant/reasoning"
import { getStageLabel, getStageIcon } from "@/lib/assistant/reasoning/client"

interface ReasoningCardProps {
  stage: ReasoningStage
  completeEvent: ReasoningEvent
  allEvents: ReasoningEvent[]
  defaultExpanded?: boolean
  className?: string
}

export function ReasoningCard({
  stage,
  completeEvent,
  allEvents,
  defaultExpanded = false,
  className,
}: ReasoningCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const label = getStageLabel(stage)
  const icon = getStageIcon(stage)

  // Get summary from complete event data
  const data = completeEvent.data as { summary?: string } | undefined
  const summary = data?.summary || completeEvent.message || "Završeno"

  // Filter events for this stage
  const stageEvents = allEvents.filter((e) => e.stage === stage)

  return (
    <div className={cn("bg-white rounded-lg border border-gray-200 overflow-hidden", className)}>
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
        aria-expanded={isExpanded}
      >
        {/* Stage icon */}
        <span className="text-lg">{icon}</span>

        {/* Label and summary */}
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-gray-900">{label}</span>
            <Check className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-sm text-gray-600 truncate">{summary}</p>
        </div>

        {/* Expand/collapse icon */}
        <div className="text-gray-400">
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
          <StageDetails stage={stage} events={stageEvents} data={data} />
        </div>
      )}
    </div>
  )
}

interface StageDetailsProps {
  stage: ReasoningStage
  events: ReasoningEvent[]
  data: unknown
}

function StageDetails({ stage, events, data }: StageDetailsProps) {
  // Render different content based on stage
  switch (stage) {
    case "SOURCES":
      return <SourcesDetails data={data} />
    case "APPLICABILITY":
      return <ApplicabilityDetails data={data} />
    case "CONFIDENCE":
      return <ConfidenceDetails data={data} />
    default:
      return <GenericDetails events={events} />
  }
}

function SourcesDetails({ data }: { data: unknown }) {
  const sourcesData = data as {
    sources?: Array<{ name: string; authority: string }>
  }
  const sources = sourcesData?.sources || []

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-gray-500 uppercase">Pronađeni izvori</h4>
      <ul className="space-y-1">
        {sources.slice(0, 3).map((source, i) => (
          <li key={i} className="text-sm text-gray-700 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            {source.name}
            <span className="text-xs text-gray-400">({source.authority})</span>
          </li>
        ))}
        {sources.length > 3 && (
          <li className="text-sm text-gray-500">+ {sources.length - 3} više</li>
        )}
      </ul>
    </div>
  )
}

function ApplicabilityDetails({ data }: { data: unknown }) {
  const appData = data as {
    eligibleCount?: number
    exclusions?: Array<{
      ruleTitle: string
      code: string
      expected: string
      actual: string
    }>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-sm">
        <span className="text-green-600">✓ {appData?.eligibleCount || 0} primjenjivih pravila</span>
      </div>

      {appData?.exclusions && appData.exclusions.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Isključena pravila</h4>
          <ul className="space-y-2">
            {appData.exclusions.map((exc, i) => (
              <li key={i} className="text-sm bg-yellow-50 p-2 rounded">
                <span className="font-medium">{exc.ruleTitle}</span>
                <p className="text-gray-600 text-xs mt-1">
                  Očekivano: {exc.expected}, Stvarno: {exc.actual}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function ConfidenceDetails({ data }: { data: unknown }) {
  const confData = data as {
    score?: number
    label?: string
    drivers?: string[]
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "px-2 py-1 rounded text-xs font-medium",
            confData?.label === "HIGH" && "bg-green-100 text-green-800",
            confData?.label === "MEDIUM" && "bg-yellow-100 text-yellow-800",
            confData?.label === "LOW" && "bg-red-100 text-red-800"
          )}
        >
          {confData?.label || "N/A"}
        </span>
        <span className="text-sm text-gray-500">
          {confData?.score ? `${Math.round(confData.score * 100)}%` : ""}
        </span>
      </div>

      {confData?.drivers && confData.drivers.length > 0 && (
        <ul className="text-sm text-gray-600 space-y-1">
          {confData.drivers.map((driver, i) => (
            <li key={i}>• {driver}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function GenericDetails({ events }: { events: ReasoningEvent[] }) {
  const progressEvents = events.filter((e) => e.status === "progress" || e.status === "checkpoint")

  if (progressEvents.length === 0) {
    return null
  }

  return (
    <ul className="space-y-1 text-sm text-gray-600">
      {progressEvents.map((event, i) => (
        <li key={i}>• {event.message}</li>
      ))}
    </ul>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/assistant-v2/reasoning/ReasoningCard.tsx
git commit -m "feat(ui): add ReasoningCard for collapsed stage display"
```

---

## Task 4: Create MorphingPill Component

**Files:**

- Create: `src/components/assistant-v2/reasoning/MorphingPill.tsx`

**Step 1: Create the component**

```tsx
// src/components/assistant-v2/reasoning/MorphingPill.tsx
"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Loader2, ChevronUp } from "lucide-react"
import type { ReasoningStage } from "@/lib/assistant/reasoning"
import { getStageLabel } from "@/lib/assistant/reasoning/client"

interface MorphingPillProps {
  currentStage: ReasoningStage | null
  streamState: "streaming" | "ended"
  onExpand: () => void
  className?: string
}

/**
 * Compact mobile component that morphs through stages.
 * Used for T2/T3 queries on mobile devices.
 */
export function MorphingPill({
  currentStage,
  streamState,
  onExpand,
  className,
}: MorphingPillProps) {
  const [isAnimating, setIsAnimating] = useState(false)

  const label = currentStage ? getStageLabel(currentStage) : "Učitavanje..."

  const handleClick = () => {
    setIsAnimating(true)
    setTimeout(() => {
      setIsAnimating(false)
      onExpand()
    }, 150)
  }

  if (streamState === "ended") {
    return null
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2 rounded-full",
        "bg-blue-500 text-white text-sm font-medium",
        "shadow-lg hover:shadow-xl transition-all duration-200",
        "hover:scale-105 active:scale-95",
        isAnimating && "scale-95 opacity-90",
        className
      )}
      aria-label={`${label} - Kliknite za prikaz detalja`}
    >
      <Loader2 className="w-4 h-4 animate-spin" />
      <span className="max-w-[150px] truncate">{label}</span>
      <ChevronUp className="w-4 h-4" />
    </button>
  )
}

/**
 * Modal for expanded reasoning view on mobile.
 */
interface ReasoningModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}

export function ReasoningModal({ isOpen, onClose, children }: ReasoningModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal content */}
      <div
        className={cn(
          "relative w-full md:max-w-lg bg-white",
          "rounded-t-2xl md:rounded-2xl shadow-2xl",
          "max-h-[80vh] overflow-y-auto",
          "animate-in slide-in-from-bottom duration-300"
        )}
      >
        {/* Handle bar (mobile) */}
        <div className="md:hidden flex justify-center py-3">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Content */}
        <div className="px-4 pb-4 pt-0 md:p-6">{children}</div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/assistant-v2/reasoning/MorphingPill.tsx
git commit -m "feat(ui): add MorphingPill for mobile T2/T3 queries"
```

---

## Task 5: Create Terminal Answer Card

**Files:**

- Create: `src/components/assistant-v2/reasoning/TerminalAnswerCard.tsx`

**Step 1: Create the component**

```tsx
// src/components/assistant-v2/reasoning/TerminalAnswerCard.tsx
"use client"

import { cn } from "@/lib/utils"
import { AlertTriangle, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import type {
  TerminalOutcome,
  FinalAnswerPayload,
  QualifiedAnswerPayload,
  RefusalPayload,
  ErrorPayload,
} from "@/lib/assistant/reasoning"

interface TerminalAnswerCardProps {
  outcome: TerminalOutcome
  payload: unknown
  className?: string
}

export function TerminalAnswerCard({ outcome, payload, className }: TerminalAnswerCardProps) {
  switch (outcome) {
    case "ANSWER":
      return <AnswerCard payload={payload as FinalAnswerPayload} className={className} />
    case "QUALIFIED_ANSWER":
      return (
        <QualifiedAnswerCard payload={payload as QualifiedAnswerPayload} className={className} />
      )
    case "REFUSAL":
      return <RefusalCard payload={payload as RefusalPayload} className={className} />
    case "ERROR":
      return <ErrorCard payload={payload as ErrorPayload} className={className} />
  }
}

// === ANSWER ===
function AnswerCard({ payload, className }: { payload: FinalAnswerPayload; className?: string }) {
  return (
    <div className={cn("bg-white rounded-xl border border-green-200 overflow-hidden", className)}>
      {/* Header */}
      <div className="px-4 py-3 bg-green-50 border-b border-green-200 flex items-center gap-2">
        <CheckCircle className="w-5 h-5 text-green-600" />
        <span className="font-medium text-green-800">Odgovor</span>
        <span className="ml-auto text-xs text-gray-500">Na dan: {payload.asOfDate}</span>
      </div>

      {/* Answer content */}
      <div className="p-4">
        <p className="text-gray-900 leading-relaxed">{payload.answerHr}</p>

        {/* Structured data */}
        {payload.structured && <StructuredData structured={payload.structured} />}

        {/* Citations */}
        {payload.citations && payload.citations.length > 0 && (
          <Citations citations={payload.citations} />
        )}
      </div>
    </div>
  )
}

// === QUALIFIED ANSWER ===
function QualifiedAnswerCard({
  payload,
  className,
}: {
  payload: QualifiedAnswerPayload
  className?: string
}) {
  return (
    <div className={cn("bg-white rounded-xl border border-yellow-200 overflow-hidden", className)}>
      {/* Header */}
      <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-200 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-yellow-600" />
        <span className="font-medium text-yellow-800">Odgovor s upozorenjem</span>
      </div>

      {/* Conflict warnings */}
      {payload.conflictWarnings.map((warning, i) => (
        <div key={i} className="mx-4 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm font-medium text-yellow-800">{warning.description}</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-white rounded">
              <span className="font-medium">{warning.sourceA.name}:</span>
              <p className="text-gray-600">{warning.sourceA.says}</p>
            </div>
            <div className="p-2 bg-white rounded">
              <span className="font-medium">{warning.sourceB.name}:</span>
              <p className="text-gray-600">{warning.sourceB.says}</p>
            </div>
          </div>
          {warning.practicalResolution && (
            <p className="mt-2 text-sm text-gray-700">
              <strong>U praksi:</strong> {warning.practicalResolution}
            </p>
          )}
        </div>
      ))}

      {/* Answer content */}
      <div className="p-4">
        <p className="text-gray-900 leading-relaxed">{payload.answerHr}</p>

        {/* Caveats */}
        {payload.caveats.length > 0 && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Napomene</h4>
            <ul className="space-y-1 text-sm text-gray-600">
              {payload.caveats.map((caveat, i) => (
                <li key={i}>• {caveat}</li>
              ))}
            </ul>
          </div>
        )}

        <Citations citations={payload.citations} />
      </div>
    </div>
  )
}

// === REFUSAL ===
function RefusalCard({ payload, className }: { payload: RefusalPayload; className?: string }) {
  return (
    <div className={cn("bg-white rounded-xl border border-gray-200 overflow-hidden", className)}>
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
        <XCircle className="w-5 h-5 text-gray-500" />
        <span className="font-medium text-gray-700">Nije moguće odgovoriti</span>
      </div>

      {/* Content */}
      <div className="p-4">
        <p className="text-gray-700">{payload.message}</p>

        {/* Related topics */}
        {payload.relatedTopics && payload.relatedTopics.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
              Možda ste mislili na
            </h4>
            <div className="flex flex-wrap gap-2">
              {payload.relatedTopics.map((topic, i) => (
                <button
                  key={i}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 text-sm rounded-full hover:bg-blue-100 transition-colors"
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// === ERROR ===
function ErrorCard({ payload, className }: { payload: ErrorPayload; className?: string }) {
  return (
    <div className={cn("bg-white rounded-xl border border-red-200 overflow-hidden", className)}>
      {/* Header */}
      <div className="px-4 py-3 bg-red-50 border-b border-red-200 flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-red-600" />
        <span className="font-medium text-red-800">Greška</span>
        <span className="ml-auto text-xs text-gray-500 font-mono">{payload.correlationId}</span>
      </div>

      {/* Content */}
      <div className="p-4">
        <p className="text-gray-700">{payload.message}</p>

        {payload.retriable && (
          <button className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
            Pokušaj ponovo
          </button>
        )}
      </div>
    </div>
  )
}

// === SHARED COMPONENTS ===

function StructuredData({ structured }: { structured: FinalAnswerPayload["structured"] }) {
  if (!structured) return null

  return (
    <div className="mt-4 grid gap-3">
      {structured.obligations && structured.obligations.length > 0 && (
        <div className="p-3 bg-blue-50 rounded-lg">
          <h4 className="text-xs font-medium text-blue-700 uppercase mb-1">Obveze</h4>
          <ul className="space-y-1 text-sm text-gray-700">
            {structured.obligations.map((o, i) => (
              <li key={i}>• {o}</li>
            ))}
          </ul>
        </div>
      )}

      {structured.deadlines && structured.deadlines.length > 0 && (
        <div className="p-3 bg-orange-50 rounded-lg">
          <h4 className="text-xs font-medium text-orange-700 uppercase mb-1">Rokovi</h4>
          <ul className="space-y-1 text-sm text-gray-700">
            {structured.deadlines.map((d, i) => (
              <li key={i}>• {d}</li>
            ))}
          </ul>
        </div>
      )}

      {structured.thresholds && structured.thresholds.length > 0 && (
        <div className="p-3 bg-purple-50 rounded-lg">
          <h4 className="text-xs font-medium text-purple-700 uppercase mb-1">Pragovi</h4>
          <ul className="space-y-1 text-sm text-gray-700">
            {structured.thresholds.map((t, i) => (
              <li key={i}>• {t}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Citations({
  citations,
}: {
  citations: Array<{ title: string; quote: string; url: string }>
}) {
  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Izvori</h4>
      <div className="space-y-2">
        {citations.map((citation, i) => (
          <div key={i} className="p-3 bg-gray-50 rounded-lg">
            <a
              href={citation.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              {citation.title}
            </a>
            <p className="text-sm text-gray-600 mt-1 italic">"{citation.quote}"</p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/assistant-v2/reasoning/TerminalAnswerCard.tsx
git commit -m "feat(ui): add TerminalAnswerCard for all terminal outcomes"
```

---

## Task 6: Create Module Index

**Files:**

- Create: `src/components/assistant-v2/reasoning/index.ts`

**Step 1: Create barrel export**

```typescript
// src/components/assistant-v2/reasoning/index.ts
export { StageStep } from "./StageStep"
export { ReasoningStepper } from "./ReasoningStepper"
export { ReasoningCard } from "./ReasoningCard"
export { MorphingPill, ReasoningModal } from "./MorphingPill"
export { TerminalAnswerCard } from "./TerminalAnswerCard"
```

**Step 2: Commit**

```bash
git add src/components/assistant-v2/reasoning/index.ts
git commit -m "feat(ui): add reasoning components module index"
```

---

## Verification Checklist

After completing all tasks:

- [ ] All components render without errors
- [ ] StageStep shows correct states (pending/active/complete/error)
- [ ] ReasoningStepper displays live reasoning flow
- [ ] ReasoningCard collapses/expands correctly
- [ ] MorphingPill animates and opens modal
- [ ] TerminalAnswerCard handles all 4 outcomes
- [ ] ARIA attributes present for accessibility

**Visual testing:**

```tsx
// Quick visual test in Storybook or dev page
import { ReasoningStepper, TerminalAnswerCard } from "@/components/assistant-v2/reasoning"

// Mock events for testing
const mockEvents = [
  { stage: "CONTEXT_RESOLUTION", status: "complete", data: { summary: "HR · TAX · T1" } },
  { stage: "SOURCES", status: "progress", message: "Found: PDV Zakon" },
  { stage: "SOURCES", status: "complete", data: { summary: "Found 3 sources" } },
]
```

---

## Next Track

Proceed to **Track 6: Integration** which wires everything together and adds shadow mode.
