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

const typeColors: Record<string, string> = {
  pausalni: "border-emerald-500/20 bg-emerald-500/10",
  "obrt-dohodak": "border-blue-500/20 bg-blue-500/10",
  jdoo: "border-purple-500/20 bg-purple-500/10",
  doo: "border-indigo-500/20 bg-indigo-500/10",
  freelancer: "border-orange-500/20 bg-orange-500/10",
  generic: "border-[var(--border)] bg-[var(--surface-secondary)]",
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
        "inline-flex max-w-full items-start gap-1 rounded border px-2 py-1 text-sm text-[var(--foreground)]",
        typeColors[type] || typeColors.generic,
        isPositive && "font-medium text-emerald-700 dark:text-emerald-300",
        isNegative && "font-medium text-rose-700 dark:text-rose-300"
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
