// src/components/assistant-v2/reasoning/ReasoningAssistantContainer.tsx
"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
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
  const [isMobile, setIsMobile] = useState(false)

  const { events, streamState, error, riskTier, actions, selectors } = useReasoningStream({
    surface,
  })

  const currentStage = useMemo(() => getCurrentStage(events), [events])

  // Mobile detection with SSR-safe check
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Determine if we should show mobile UX
  const showMobilePill = isMobile && (riskTier === "T2" || riskTier === "T3")

  // Handle submit
  const handleSubmit = useCallback(
    (query: string) => {
      actions.submit(query)
    },
    [actions]
  )

  // Loading state for input
  const isLoading = streamState === "streaming" || streamState === "connecting"

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
      <div className="border-t border-border bg-surface p-4">
        <AssistantInput
          surface={surface}
          onSubmit={handleSubmit}
          disabled={isLoading}
          loading={isLoading}
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
