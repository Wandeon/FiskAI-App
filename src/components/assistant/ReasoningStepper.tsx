// src/components/assistant/ReasoningStepper.tsx
"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import type { ReasoningEvent, ReasoningStage } from "@/lib/assistant/reasoning/types"

/**
 * Stage metadata for display
 */
const STAGE_META: Record<ReasoningStage, { label: string; labelHr: string; icon: string }> = {
  QUESTION_INTAKE: { label: "Analyzing question", labelHr: "Analiziram pitanje", icon: "?" },
  CONTEXT_RESOLUTION: { label: "Resolving context", labelHr: "Razrješavam kontekst", icon: "🔍" },
  CLARIFICATION: { label: "Needs clarification", labelHr: "Potrebno pojašnjenje", icon: "❓" },
  SOURCES: { label: "Finding sources", labelHr: "Pronalazim izvore", icon: "📚" },
  RETRIEVAL: { label: "Retrieving rules", labelHr: "Dohvaćam pravila", icon: "⚖️" },
  APPLICABILITY: {
    label: "Checking applicability",
    labelHr: "Provjeravam primjenjivost",
    icon: "✓",
  },
  CONFLICTS: { label: "Resolving conflicts", labelHr: "Razrješavam konflikte", icon: "⚔️" },
  ANALYSIS: { label: "Analyzing", labelHr: "Analiziram", icon: "🧠" },
  CONFIDENCE: { label: "Computing confidence", labelHr: "Računam pouzdanost", icon: "📊" },
  ANSWER: { label: "Ready", labelHr: "Spremno", icon: "✅" },
  CONDITIONAL_ANSWER: { label: "Conditional answer", labelHr: "Uvjetni odgovor", icon: "🔀" },
  REFUSAL: { label: "Cannot answer", labelHr: "Ne mogu odgovoriti", icon: "⚠️" },
  ERROR: { label: "Error", labelHr: "Greška", icon: "❌" },
}

interface ReasoningStepperProps {
  events: ReasoningEvent[]
  language?: "hr" | "en"
  className?: string
}

export function ReasoningStepper({ events, language = "hr", className }: ReasoningStepperProps) {
  const [currentStage, setCurrentStage] = useState<ReasoningStage | null>(null)
  const [completedStages, setCompletedStages] = useState<Set<ReasoningStage>>(new Set())
  const [progressMessages, setProgressMessages] = useState<string[]>([])

  useEffect(() => {
    if (events.length === 0) return

    const latestEvent = events[events.length - 1]
    setCurrentStage(latestEvent.stage)

    // Track completed stages
    const completed = new Set<ReasoningStage>()
    const messages: string[] = []

    for (const event of events) {
      if (event.status === "complete") {
        completed.add(event.stage)
      }
      if (event.status === "progress" && event.message) {
        messages.push(event.message)
      }
    }

    setCompletedStages(completed)
    setProgressMessages(messages.slice(-3)) // Keep last 3 messages
  }, [events])

  const getStageStatus = (stage: ReasoningStage): "pending" | "active" | "complete" => {
    if (completedStages.has(stage)) return "complete"
    if (stage === currentStage) return "active"
    return "pending"
  }

  const orderedStages: ReasoningStage[] = [
    "QUESTION_INTAKE",
    "CONTEXT_RESOLUTION",
    "SOURCES",
    "RETRIEVAL",
    "APPLICABILITY",
    "ANALYSIS",
    "CONFIDENCE",
  ]

  return (
    <div className={cn("space-y-2", className)}>
      {/* Stage indicators */}
      <div className="flex items-center gap-1">
        {orderedStages.map((stage, index) => {
          const status = getStageStatus(stage)
          const meta = STAGE_META[stage]

          return (
            <div key={stage} className="flex items-center">
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs",
                  status === "complete" && "bg-green-100 text-green-700",
                  status === "active" && "bg-blue-100 text-blue-700 animate-pulse",
                  status === "pending" && "bg-gray-100 text-gray-400"
                )}
                title={language === "hr" ? meta.labelHr : meta.label}
              >
                {status === "complete" ? "✓" : meta.icon}
              </div>
              {index < orderedStages.length - 1 && (
                <div
                  className={cn(
                    "w-4 h-0.5",
                    status === "complete" ? "bg-green-300" : "bg-gray-200"
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Current stage label */}
      {currentStage && (
        <div className="text-sm text-gray-600">
          {language === "hr" ? STAGE_META[currentStage].labelHr : STAGE_META[currentStage].label}
          ...
        </div>
      )}

      {/* Progress messages */}
      {progressMessages.length > 0 && (
        <div className="text-xs text-gray-500 space-y-0.5">
          {progressMessages.map((msg, i) => (
            <div key={i} className="truncate">
              {msg}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
