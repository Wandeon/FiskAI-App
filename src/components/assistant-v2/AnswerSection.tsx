"use client"

import React from "react"
import {
  AlertCircle,
  HelpCircle,
  Database,
  AlertTriangle,
  MessageCircle,
  Globe,
} from "lucide-react"
import type { AssistantControllerState, Surface, RefusalReason } from "@/lib/assistant/client"
import { cn } from "@/lib/utils"

interface AnswerSectionProps {
  state: AssistantControllerState
  surface: Surface
  onSuggestionClick?: (suggestion: string) => void
  className?: string
}

const REFUSAL_CONFIG: Record<
  RefusalReason,
  { title: string; icon: React.ReactNode; bgClass: string }
> = {
  NO_CITABLE_RULES: {
    title: "No verified rules available",
    icon: <HelpCircle className="w-5 h-5" />,
    bgClass: "bg-muted/30",
  },
  OUT_OF_SCOPE: {
    title: "Outside our coverage",
    icon: <AlertCircle className="w-5 h-5" />,
    bgClass: "bg-muted/30",
  },
  MISSING_CLIENT_DATA: {
    title: "More data needed",
    icon: <Database className="w-5 h-5" />,
    bgClass: "bg-blue-50 dark:bg-blue-950/20",
  },
  UNRESOLVED_CONFLICT: {
    title: "Conflicting information",
    icon: <AlertTriangle className="w-5 h-5" />,
    bgClass: "bg-amber-50 dark:bg-amber-950/20",
  },
  NEEDS_CLARIFICATION: {
    title: "Please clarify your question",
    icon: <MessageCircle className="w-5 h-5" />,
    bgClass: "bg-blue-50 dark:bg-blue-950/20",
  },
  UNSUPPORTED_JURISDICTION: {
    title: "Unsupported jurisdiction",
    icon: <Globe className="w-5 h-5" />,
    bgClass: "bg-muted/30",
  },
}

export function AnswerSection({
  state,
  surface,
  onSuggestionClick,
  className,
}: AnswerSectionProps) {
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
    const reason = activeAnswer.refusalReason || "NO_CITABLE_RULES"
    const config = REFUSAL_CONFIG[reason] || REFUSAL_CONFIG.NO_CITABLE_RULES
    const relatedTopics = activeAnswer.refusal?.relatedTopics || []

    return (
      <article className={cn("p-6 border rounded-lg", config.bgClass, className)}>
        <div className="flex items-start gap-3">
          <span className="text-muted-foreground mt-0.5 flex-shrink-0">{config.icon}</span>
          <div className="flex-1 min-w-0">
            <h2 tabIndex={-1} className="font-semibold text-foreground">
              {activeAnswer.headline || config.title}
            </h2>
            <p className="text-sm text-muted-foreground mt-2">{activeAnswer.refusal?.message}</p>
          </div>
        </div>

        {/* Redirect options (OUT_OF_SCOPE) */}
        {activeAnswer.refusal?.redirectOptions &&
          activeAnswer.refusal.redirectOptions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {activeAnswer.refusal.redirectOptions.map((option, i) => (
                <a
                  key={i}
                  href={option.href}
                  className="text-sm px-3 py-1.5 bg-background border rounded-md hover:bg-muted transition-colors"
                >
                  {option.label}
                </a>
              ))}
            </div>
          )}

        {/* Related topics / clarifications */}
        {relatedTopics.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2">
              {reason === "NEEDS_CLARIFICATION" ? "Try one of these" : "Related topics"}
            </h3>
            <div className="flex flex-wrap gap-2">
              {relatedTopics.map((topic, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onSuggestionClick?.(topic)}
                  className="text-sm px-3 py-1.5 rounded-full bg-background border hover:bg-muted transition-colors"
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>
        )}
      </article>
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
