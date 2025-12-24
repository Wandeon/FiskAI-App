import React from "react"
import type { AuthorityLevel } from "@/lib/assistant/client"
import { cn } from "@/lib/utils"

interface AuthorityBadgeProps {
  authority: AuthorityLevel
  className?: string
}

const STYLES: Record<AuthorityLevel, string> = {
  LAW: "bg-purple-100 text-purple-800",
  REGULATION: "bg-blue-100 text-blue-800",
  GUIDANCE: "bg-green-100 text-green-800",
  PRACTICE: "bg-gray-100 text-gray-800",
}

const LABELS: Record<AuthorityLevel, string> = {
  LAW: "Law",
  REGULATION: "Regulation",
  GUIDANCE: "Guidance",
  PRACTICE: "Practice",
}

export function AuthorityBadge({ authority, className }: AuthorityBadgeProps) {
  return (
    <span
      role="status"
      aria-label={`Authority level: ${LABELS[authority]}`}
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded shrink-0",
        STYLES[authority],
        className
      )}
    >
      {LABELS[authority]}
    </span>
  )
}
