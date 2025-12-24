"use client"

import React from "react"
import type { AssistantControllerState, Surface } from "@/lib/assistant/client"
import { cn } from "@/lib/utils"

interface AnswerSectionProps {
  state: AssistantControllerState
  surface: Surface
  className?: string
}

export function AnswerSection({ state, surface, className }: AnswerSectionProps) {
  const { status, activeAnswer, error } = state

  // Empty state
  if (status === "IDLE" && !activeAnswer) {
    return (
      <div className={cn("p-6 border rounded-lg", className)}>
        <p className="text-muted-foreground">Verified answer will appear here</p>
        <p className="text-sm text-muted-foreground mt-2">
          Every response includes verified citations from official sources
        </p>
      </div>
    )
  }

  // Loading skeleton
  if (status === "LOADING") {
    return (
      <div
        data-testid="answer-skeleton"
        className={cn("p-6 border rounded-lg space-y-4", className)}
      >
        <div className="h-6 bg-muted rounded animate-pulse w-3/4" />
        <div className="space-y-2">
          <div className="h-4 bg-muted rounded animate-pulse" />
          <div className="h-4 bg-muted rounded animate-pulse w-5/6" />
        </div>
        <div className="flex gap-2 pt-2">
          <div className="h-8 w-20 bg-muted rounded animate-pulse" />
          <div className="h-8 w-24 bg-muted rounded animate-pulse" />
        </div>
      </div>
    )
  }

  // Error state
  if (status === "ERROR" && error) {
    return (
      <div
        className={cn("p-6 border border-destructive/50 rounded-lg bg-destructive/5", className)}
      >
        <h2 className="font-medium text-destructive">Something went wrong</h2>
        <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
        {error.type !== "CLIENT_ERROR" && (
          <button className="mt-3 text-sm text-primary hover:underline">Try again</button>
        )}
      </div>
    )
  }

  // No answer yet (streaming started but no content)
  if (!activeAnswer) {
    return (
      <div data-testid="answer-skeleton" className={cn("p-6 border rounded-lg", className)}>
        <div className="h-6 bg-muted rounded animate-pulse w-3/4" />
      </div>
    )
  }

  // Refusal card
  if (activeAnswer.kind === "REFUSAL") {
    return (
      <div className={cn("p-6 border rounded-lg bg-muted/30", className)}>
        <h2 tabIndex={-1} className="font-medium">
          {activeAnswer.refusalReason === "OUT_OF_SCOPE"
            ? "Outside our coverage"
            : activeAnswer.refusalReason === "NO_CITABLE_RULES"
              ? "No verified rules available"
              : activeAnswer.refusalReason === "MISSING_CLIENT_DATA"
                ? "More data needed"
                : "Unable to answer"}
        </h2>
        <p className="text-sm text-muted-foreground mt-2">{activeAnswer.refusal?.message}</p>
      </div>
    )
  }

  // Answer card
  return (
    <div className={cn("p-6 border rounded-lg", className)}>
      <h2 tabIndex={-1} className="text-lg font-semibold">
        {activeAnswer.headline}
      </h2>
      <p className="mt-2 text-muted-foreground">{activeAnswer.directAnswer}</p>

      {activeAnswer.keyDetails && activeAnswer.keyDetails.length > 0 && (
        <ul className="mt-4 space-y-1">
          {activeAnswer.keyDetails.map((detail, i) => (
            <li key={i} className="text-sm flex items-start gap-2">
              <span className="text-primary">•</span>
              {detail}
            </li>
          ))}
        </ul>
      )}

      {activeAnswer.nextStep && (
        <p className="mt-4 text-sm font-medium text-primary">Next step: {activeAnswer.nextStep}</p>
      )}

      <div className="flex gap-2 mt-4">
        {activeAnswer.why && (
          <button className="text-sm px-3 py-1.5 border rounded hover:bg-muted">Why?</button>
        )}
        {activeAnswer.howToApply && (
          <button className="text-sm px-3 py-1.5 border rounded hover:bg-muted">
            How to apply
          </button>
        )}
      </div>
    </div>
  )
}
