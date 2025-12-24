"use client"

import React from "react"
import { ChevronDown } from "lucide-react"
import type { SourceCard as SourceCardType } from "@/lib/assistant"
import { SourceCard } from "./SourceCard"
import { cn } from "@/lib/utils"

interface SupportingSourcesProps {
  sources: SourceCardType[]
  isExpanded: boolean
  onToggle: () => void
  className?: string
}

export function SupportingSources({
  sources,
  isExpanded,
  onToggle,
  className,
}: SupportingSourcesProps) {
  if (sources.length === 0) return null

  return (
    <div className={cn("border-t pt-4", className)}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className={cn(
          "w-full flex items-center justify-between",
          "text-sm text-muted-foreground hover:text-foreground",
          "focus:outline-none focus:ring-2 focus:ring-primary/50 rounded"
        )}
      >
        <span>Supporting sources ({sources.length})</span>
        <ChevronDown
          data-testid="chevron-icon"
          className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-180")}
        />
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-3">
          {sources.map((source) => (
            <SourceCard key={source.id} source={source} variant="compact" />
          ))}
        </div>
      )}
    </div>
  )
}
