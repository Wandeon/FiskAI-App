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
