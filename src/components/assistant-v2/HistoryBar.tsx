"use client"

import React, { useState } from "react"
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react"
import type { HistoryItem } from "@/lib/assistant/client"
import { cn } from "@/lib/utils"

interface HistoryBarProps {
  history: HistoryItem[]
  onRestore: (index: number) => void
  onClear: () => void
  className?: string
}

function truncateQuery(query: string, maxLength = 50): string {
  if (query.length <= maxLength) return query
  return query.slice(0, maxLength - 3) + "..."
}

export function HistoryBar({ history, onRestore, onClear, className }: HistoryBarProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (history.length === 0) return null

  return (
    <div className={cn("border rounded-lg", className)}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        className={cn(
          "w-full flex items-center justify-between p-3",
          "text-sm text-muted-foreground hover:bg-muted/50",
          "focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/50"
        )}
      >
        <span>Previous questions ({history.length})</span>
        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {isExpanded && (
        <div className="border-t">
          <ul className="divide-y">
            {history.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onRestore(index)}
                  className={cn(
                    "w-full text-left p-3 text-sm",
                    "hover:bg-muted/50",
                    "focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/50"
                  )}
                >
                  {truncateQuery(item.query)}
                </button>
              </li>
            ))}
          </ul>

          <div className="border-t p-2">
            <button
              type="button"
              onClick={onClear}
              className={cn(
                "flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground",
                "hover:text-destructive",
                "focus:outline-none focus:ring-2 focus:ring-primary/50 rounded"
              )}
            >
              <Trash2 className="w-3 h-3" />
              Clear all
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
