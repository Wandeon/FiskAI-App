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
    QUESTION_INTAKE: "Prihvat pitanja",
    CONTEXT_RESOLUTION: "Razumijevanje pitanja",
    CLARIFICATION: "Pojasnjenje",
    SOURCES: "Pretrazivanje izvora",
    RETRIEVAL: "Dohvat propisa",
    APPLICABILITY: "Provjera primjenjivosti",
    CONFLICTS: "Provjera sukoba",
    ANALYSIS: "Analiza",
    CONFIDENCE: "Pouzdanost",
    ANSWER: "Odgovor",
    CONDITIONAL_ANSWER: "Uvjetni odgovor",
    REFUSAL: "Odbijanje",
    ERROR: "Greska",
  }

  return labels[stage] || stage
}

/**
 * Get stage icon for UI display.
 */
export function getStageIcon(stage: ReasoningStage): string {
  const icons: Record<ReasoningStage, string> = {
    QUESTION_INTAKE: "[Q]",
    CONTEXT_RESOLUTION: "?",
    CLARIFICATION: "?",
    SOURCES: "[S]",
    RETRIEVAL: "[R]",
    APPLICABILITY: "[A]",
    CONFLICTS: "[C]",
    ANALYSIS: "[An]",
    CONFIDENCE: "[Co]",
    ANSWER: "[!]",
    CONDITIONAL_ANSWER: "[W]",
    REFUSAL: "[X]",
    ERROR: "[E]",
  }

  return icons[stage] || "*"
}
