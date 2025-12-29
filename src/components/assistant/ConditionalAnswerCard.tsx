// src/components/assistant/ConditionalAnswerCard.tsx
"use client"

import { cn } from "@/lib/utils"
import type { ConditionalAnswerPayload } from "@/lib/assistant/reasoning/types"

interface ConditionalAnswerCardProps {
  payload: ConditionalAnswerPayload
  language?: "hr" | "en"
  className?: string
  onBranchSelect?: (branchIndex: number) => void
}

export function ConditionalAnswerCard({
  payload,
  language = "hr",
  className,
  onBranchSelect,
}: ConditionalAnswerCardProps) {
  const { branches, commonParts } = payload

  return (
    <div className={cn("rounded-lg border border-warning-border bg-warning-bg p-4", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🔀</span>
        <h3 className="font-medium text-warning-text">
          {language === "hr" ? "Uvjetni odgovor" : "Conditional Answer"}
        </h3>
      </div>

      {/* Common parts */}
      {commonParts && <p className="text-sm text-warning-text mb-3">{commonParts}</p>}

      {/* Branches */}
      <div className="space-y-2">
        {branches.map((branch, index) => (
          <button
            key={index}
            onClick={() => onBranchSelect?.(index)}
            className={cn(
              "w-full text-left p-3 rounded-md border border-warning-border bg-surface",
              "hover:border-warning-border/80 hover:bg-warning-bg transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-warning-border"
            )}
          >
            {/* Condition */}
            <div className="text-sm font-medium text-warning-text mb-1">
              {language === "hr" ? branch.conditionHr : branch.condition}
            </div>

            {/* Answer preview */}
            <div className="text-sm text-foreground">
              {language === "hr" ? branch.answerHr : branch.answer}
            </div>

            {/* Probability if available */}
            {branch.probability !== undefined && (
              <div className="mt-1 text-xs text-warning-text">
                {Math.round(branch.probability * 100)}%{" "}
                {language === "hr" ? "vjerojatnost" : "probability"}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Help text */}
      <p className="mt-3 text-xs text-warning-text">
        {language === "hr"
          ? "Kliknite na opciju koja odgovara vašoj situaciji"
          : "Click on the option that matches your situation"}
      </p>
    </div>
  )
}
