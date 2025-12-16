"use client"

import { cn } from "@/lib/utils"
import { ReactNode } from "react"

interface ComparisonCellProps {
  type?: "pausalni" | "obrt-dohodak" | "jdoo" | "doo" | "freelancer" | "generic"
  isPositive?: boolean
  isNegative?: boolean
  children: ReactNode
}

const typeColors: Record<string, string> = {
  pausalni: "bg-green-50 border-green-200",
  "obrt-dohodak": "bg-blue-50 border-blue-200",
  jdoo: "bg-purple-50 border-purple-200",
  doo: "bg-indigo-50 border-indigo-200",
  freelancer: "bg-orange-50 border-orange-200",
  generic: "bg-gray-50 border-gray-200",
}

export function ComparisonCell({
  type = "generic",
  isPositive,
  isNegative,
  children,
}: ComparisonCellProps) {
  return (
    <span
      className={cn(
        "inline-block px-2 py-1 rounded text-sm",
        typeColors[type] || typeColors.generic,
        isPositive && "text-green-700 font-medium",
        isNegative && "text-red-700 font-medium"
      )}
    >
      {isPositive && "✓ "}
      {isNegative && "✗ "}
      {children}
    </span>
  )
}
