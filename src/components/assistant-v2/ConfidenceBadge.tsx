import React from "react"
import type { ConfidenceLevel } from "@/lib/assistant/client"
import { cn } from "@/lib/utils"

interface ConfidenceBadgeProps {
  level: ConfidenceLevel
  score?: number
  className?: string
}

const STYLES: Record<ConfidenceLevel, string> = {
  HIGH: "bg-success-bg text-success-text",
  MEDIUM: "bg-warning-bg text-warning-text",
  LOW: "bg-danger-bg text-danger-text",
}

const LABELS: Record<ConfidenceLevel, string> = {
  HIGH: "High confidence",
  MEDIUM: "Medium confidence",
  LOW: "Low confidence",
}

export function ConfidenceBadge({ level, score, className }: ConfidenceBadgeProps) {
  const percentage = score !== undefined ? Math.round(score * 100) : null

  const ariaLabel = percentage !== null ? `${LABELS[level]}: ${percentage}%` : LABELS[level]

  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full",
        STYLES[level],
        className
      )}
    >
      {LABELS[level]}
      {percentage !== null && <span className="opacity-75">({percentage}%)</span>}
    </span>
  )
}
