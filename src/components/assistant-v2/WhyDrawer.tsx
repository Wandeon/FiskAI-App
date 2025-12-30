"use client"

import React, { useEffect, useCallback } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface WhyDrawerProps {
  bullets: string[]
  isExpanded: boolean
  onClose: () => void
  className?: string
}

export function WhyDrawer({ bullets, isExpanded, onClose, className }: WhyDrawerProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && isExpanded) {
        onClose()
      }
    },
    [isExpanded, onClose]
  )

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  if (!isExpanded) return null

  return (
    <div
      role="region"
      aria-label="Why this answer"
      className={cn(
        "mt-4 p-4 bg-muted/30 rounded-lg border",
        "motion-safe:animate-in motion-safe:slide-in-from-top-2",
        className
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">Why this answer</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <ul className="space-y-2">
        {bullets.map((bullet) => (
          <li key={bullet} className="text-sm text-muted-foreground flex items-start gap-2">
            <span className="text-primary mt-0.5 shrink-0">•</span>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
