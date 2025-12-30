"use client"

import React from "react"
import { Bookmark, Share2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ActionButtonsProps {
  hasWhy?: boolean
  hasHowToApply?: boolean
  whyExpanded?: boolean
  howToApplyExpanded?: boolean
  onWhyClick?: () => void
  onHowToApplyClick?: () => void
  onSave?: () => void
  onShare?: () => void
  headline?: string
  className?: string
}

export function ActionButtons({
  hasWhy,
  hasHowToApply,
  whyExpanded,
  howToApplyExpanded,
  onWhyClick,
  onHowToApplyClick,
  onSave,
  onShare,
  headline,
  className,
}: ActionButtonsProps) {
  const hasAnyButton = hasWhy || hasHowToApply || onSave || onShare

  if (!hasAnyButton) {
    return <div className={className} />
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {hasWhy && (
        <button
          type="button"
          onClick={onWhyClick}
          aria-expanded={whyExpanded}
          aria-label={headline ? `Saznajte zašto: ${headline}` : "Saznajte zašto"}
          className={cn(
            "text-sm px-3 py-1.5 border rounded-md transition-colors",
            "hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50",
            whyExpanded && "bg-muted"
          )}
        >
          Why?
        </button>
      )}

      {hasHowToApply && (
        <button
          type="button"
          onClick={onHowToApplyClick}
          aria-expanded={howToApplyExpanded}
          aria-label="Kako primijeniti ovu preporuku"
          className={cn(
            "text-sm px-3 py-1.5 border rounded-md transition-colors",
            "hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50",
            howToApplyExpanded && "bg-muted"
          )}
        >
          How to apply
        </button>
      )}

      {onSave && (
        <button
          type="button"
          onClick={onSave}
          aria-label="Save"
          className={cn(
            "p-1.5 border rounded-md transition-colors",
            "hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
          )}
        >
          <Bookmark className="w-4 h-4" />
        </button>
      )}

      {onShare && (
        <button
          type="button"
          onClick={onShare}
          aria-label="Share"
          className={cn(
            "p-1.5 border rounded-md transition-colors",
            "hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
          )}
        >
          <Share2 className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
