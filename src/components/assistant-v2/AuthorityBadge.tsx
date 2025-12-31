import React from "react"
import type { AuthorityLevel } from "@/lib/assistant/client"
import { cn } from "@/lib/utils"
import type { AssistantVariant } from "./AssistantContainer"

interface AuthorityBadgeProps {
  authority: AuthorityLevel
  className?: string
  theme?: AssistantVariant
}

const LIGHT_STYLES: Record<AuthorityLevel, string> = {
  LAW: "bg-surface-1 text-secondary border border-default",
  REGULATION: "bg-info-bg text-info-text border border-info-border",
  GUIDANCE: "bg-success-bg text-success-text border border-success-border",
  PRACTICE: "bg-surface-1 text-secondary border border-default",
}

const DARK_STYLES: Record<AuthorityLevel, string> = {
  LAW: "bg-purple-900/30 text-purple-300 border border-purple-500/30",
  REGULATION: "bg-blue-900/30 text-blue-300 border border-focus/30",
  GUIDANCE: "bg-green-900/30 text-green-300 border border-success-border/30",
  PRACTICE: "bg-surface-elevated/30 text-secondary border border-subtle/30",
}

const LABELS: Record<AuthorityLevel, string> = {
  LAW: "Law",
  REGULATION: "Regulation",
  GUIDANCE: "Guidance",
  PRACTICE: "Practice",
}

export function AuthorityBadge({ authority, className, theme = "light" }: AuthorityBadgeProps) {
  const isDark = theme === "dark"
  const styles = isDark ? DARK_STYLES : LIGHT_STYLES

  return (
    <span
      role="status"
      aria-label={`Authority level: ${LABELS[authority]}`}
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded shrink-0",
        styles[authority],
        className
      )}
    >
      {LABELS[authority]}
    </span>
  )
}
