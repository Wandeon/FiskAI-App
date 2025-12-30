"use client"

import React from "react"
import { LIMITS } from "@/lib/assistant/client"
import { cn } from "@/lib/utils"

interface RelatedQuestionsProps {
  questions: string[]
  onSelect: (question: string) => void
  className?: string
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + "..."
}

export function RelatedQuestions({ questions, onSelect, className }: RelatedQuestionsProps) {
  if (questions.length === 0) return null

  // Limit to max configured count
  const displayQuestions = questions.slice(0, LIMITS.relatedQuestionsMax)

  return (
    <div className={cn("mt-6", className)}>
      <h4 className="text-sm font-medium text-muted-foreground mb-2">Related questions</h4>

      <div className="flex flex-wrap gap-2">
        {displayQuestions.map((question) => (
          <button
            key={question}
            type="button"
            onClick={() => onSelect(question)}
            className={cn(
              "text-sm px-3 py-1.5 rounded-full border",
              "hover:bg-muted transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-primary/50"
            )}
          >
            {truncate(question, LIMITS.relatedQuestionLength)}
          </button>
        ))}
      </div>
    </div>
  )
}
