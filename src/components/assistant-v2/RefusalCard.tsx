"use client"

import React from "react"
import { AlertCircle, HelpCircle, Database, AlertTriangle } from "lucide-react"
import type { RefusalReason, RefusalBlock } from "@/lib/assistant/client"
import { cn } from "@/lib/utils"

interface RefusalCardProps {
  reason: RefusalReason
  refusal: RefusalBlock
  onConnectData?: () => void
  onTopicClick?: (topic: string) => void
  className?: string
}

const TITLES: Record<RefusalReason, string> = {
  NO_CITABLE_RULES: "No verified rules available",
  OUT_OF_SCOPE: "Outside our coverage",
  MISSING_CLIENT_DATA: "More data needed",
  UNRESOLVED_CONFLICT: "Conflicting information",
  NEEDS_CLARIFICATION: "Please clarify your question",
  UNSUPPORTED_JURISDICTION: "Unsupported jurisdiction",
}

const ICONS: Record<RefusalReason, React.ReactNode> = {
  NO_CITABLE_RULES: <HelpCircle className="w-5 h-5" />,
  OUT_OF_SCOPE: <AlertCircle className="w-5 h-5" />,
  MISSING_CLIENT_DATA: <Database className="w-5 h-5" />,
  UNRESOLVED_CONFLICT: <AlertTriangle className="w-5 h-5" />,
  NEEDS_CLARIFICATION: <HelpCircle className="w-5 h-5" />,
  UNSUPPORTED_JURISDICTION: <AlertCircle className="w-5 h-5" />,
}

export function RefusalCard({
  reason,
  refusal,
  onConnectData,
  onTopicClick,
  className,
}: RefusalCardProps) {
  return (
    <article className={cn("p-6 border rounded-lg bg-muted/20", className)}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <span data-testid="refusal-icon" className="text-muted-foreground mt-0.5">
          {ICONS[reason]}
        </span>
        <div className="flex-1">
          <h2 className="font-medium">{TITLES[reason]}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{refusal.message}</p>
        </div>
      </div>

      {/* Missing data list (MISSING_CLIENT_DATA) */}
      {refusal.missingData && refusal.missingData.length > 0 && (
        <div className="mt-4 space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase">Missing data</h3>
          <ul className="space-y-1">
            {refusal.missingData.map((item, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>
                  <strong>{item.label}</strong>
                  {item.impact && <span className="text-muted-foreground"> — {item.impact}</span>}
                </span>
              </li>
            ))}
          </ul>
          {onConnectData && (
            <button
              type="button"
              onClick={onConnectData}
              className="mt-2 text-sm px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Connect your data
            </button>
          )}
        </div>
      )}

      {/* Redirect options (OUT_OF_SCOPE) */}
      {refusal.redirectOptions && refusal.redirectOptions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {refusal.redirectOptions.map((option, i) => (
            <a
              key={i}
              href={option.href}
              className="text-sm px-3 py-1.5 border rounded-md hover:bg-muted transition-colors"
            >
              {option.label}
            </a>
          ))}
        </div>
      )}

      {/* Related topics */}
      {refusal.relatedTopics && refusal.relatedTopics.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2">
            Try these instead
          </h3>
          <div className="flex flex-wrap gap-2">
            {refusal.relatedTopics.map((topic, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onTopicClick?.(topic)}
                className="text-sm px-3 py-1.5 rounded-full border hover:bg-muted transition-colors"
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
