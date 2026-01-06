"use client"

import { cn } from "@/lib/utils"
import { ReactNode } from "react"

interface ComparisonCellProps {
  type?: "pausalni" | "obrt-dohodak" | "jdoo" | "doo" | "freelancer" | "generic"
  isPositive?: boolean
  isNegative?: boolean
  as?: "td" | "span"
  className?: string
  children: ReactNode
}

// Colors optimized for dark section backgrounds
const typeColors: Record<string, string> = {
  pausalni: "border-success/30 bg-chart-4/15",
  "obrt-dohodak": "border-focus/30 bg-interactive/15",
  jdoo: "border-chart-2/30 bg-chart-2/15",
  doo: "border-chart-1/30 bg-chart-1/15",
  freelancer: "border-chart-5/30 bg-chart-5/15",
  generic: "border-white/10 bg-surface/5",
}

export function ComparisonCell({
  type = "generic",
  isPositive,
  isNegative,
  as = "td",
  className,
  children,
}: ComparisonCellProps) {
  const pill = (
    <span
      className={cn(
        "inline-flex max-w-full items-start gap-1 rounded border px-2 py-1 text-sm text-white/90",
        typeColors[type] || typeColors.generic,
        isPositive && "font-medium text-success-text",
        isNegative && "font-medium text-danger"
      )}
    >
      {isPositive && <span aria-hidden>✓</span>}
      {isNegative && <span aria-hidden>✗</span>}
      <span className="min-w-0 break-words">{children}</span>
    </span>
  )

  if (as === "span") {
    return <span className={cn(className)}>{pill}</span>
  }

  return (
    <td className={cn("p-3 text-center align-top", className)}>
      <div className="flex justify-center">{pill}</div>
    </td>
  )
}
