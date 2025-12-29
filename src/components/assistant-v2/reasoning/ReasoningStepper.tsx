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
        "bg-surface rounded-xl border border-default shadow-sm overflow-hidden",
        className
      )}
      role="region"
      aria-label="Reasoning progress"
      aria-live="polite"
    >
      {/* Header */}
      <div className="px-4 py-3 bg-surface-1 border-b border-default flex items-center justify-between">
        <h3 className="text-sm font-medium text-secondary">
          {streamState === "streaming" && "Analiziramo vase pitanje..."}
          {streamState === "awaiting_input" && "Potrebno pojasnjenje"}
          {streamState === "ended" && "Analiza zavrsena"}
          {streamState === "error" && "Doslo je do greske"}
        </h3>

        {streamState === "streaming" && timeSinceLastEvent !== null && (
          <span className="text-xs text-tertiary">Ažurirano: {timeSinceLastEvent}s</span>
        )}
      </div>

      {/* Stages */}
      <div className="divide-y divide-subtle">
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
