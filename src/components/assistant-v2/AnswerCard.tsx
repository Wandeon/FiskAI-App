"use client"

import React, { forwardRef } from "react"
import type { AssistantResponse } from "@/lib/assistant/client"
import { ConfidenceBadge } from "./ConfidenceBadge"
import { cn } from "@/lib/utils"

interface AnswerCardProps {
  answer: AssistantResponse
  onWhyClick?: () => void
  onHowToApplyClick?: () => void
  className?: string
}

export const AnswerCard = forwardRef<HTMLHeadingElement, AnswerCardProps>(function AnswerCard(
  { answer, onWhyClick, onHowToApplyClick, className },
  ref
) {
  const { headline, directAnswer, keyDetails, nextStep, confidence, why, howToApply, asOfDate } =
    answer

  return (
    <article className={cn("p-6 border rounded-lg", className)}>
      {/* Header with headline and confidence */}
      <div className="flex items-start justify-between gap-4">
        <h2 ref={ref} tabIndex={-1} className="text-lg font-semibold flex-1">
          {headline}
        </h2>
        {confidence && <ConfidenceBadge level={confidence.level} score={confidence.score} />}
      </div>

      {/* Direct answer */}
      <p className="mt-3 text-muted-foreground">{directAnswer}</p>

      {/* Key details */}
      {keyDetails && keyDetails.length > 0 && (
        <ul className="mt-4 space-y-1.5" role="list">
          {keyDetails.map((detail) => (
            <li key={detail} className="text-sm flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>{detail}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Next step */}
      {nextStep && (
        <p className="mt-4 text-sm">
          <span className="font-medium text-primary">Next step:</span> {nextStep}
        </p>
      )}

      {/* As-of date */}
      {asOfDate && (
        <p className="mt-3 text-xs text-muted-foreground">
          As of {new Date(asOfDate).toLocaleDateString()}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mt-4">
        {why && (
          <button
            type="button"
            onClick={onWhyClick}
            className="text-sm px-3 py-1.5 border rounded-md hover:bg-muted transition-colors"
          >
            Why?
          </button>
        )}
        {howToApply && (
          <button
            type="button"
            onClick={onHowToApplyClick}
            className="text-sm px-3 py-1.5 border rounded-md hover:bg-muted transition-colors"
          >
            How to apply
          </button>
        )}
      </div>
    </article>
  )
})
