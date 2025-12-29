// src/components/assistant-v2/reasoning/MorphingPill.tsx
"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Loader2, ChevronUp } from "lucide-react"
import type { ReasoningStage } from "@/lib/assistant/reasoning"
import { getStageLabel } from "@/lib/assistant/reasoning/client"

interface MorphingPillProps {
  currentStage: ReasoningStage | null
  streamState: "streaming" | "ended"
  onExpand: () => void
  className?: string
}

/**
 * Compact mobile component that morphs through stages.
 * Used for T2/T3 queries on mobile devices.
 */
export function MorphingPill({
  currentStage,
  streamState,
  onExpand,
  className,
}: MorphingPillProps) {
  const [isAnimating, setIsAnimating] = useState(false)

  const label = currentStage ? getStageLabel(currentStage) : "Ucitavanje..."

  const handleClick = () => {
    setIsAnimating(true)
    setTimeout(() => {
      setIsAnimating(false)
      onExpand()
    }, 150)
  }

  if (streamState === "ended") {
    return null
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2 rounded-full",
        "bg-interactive text-white text-sm font-medium",
        "shadow-lg hover:shadow-xl transition-all duration-200",
        "hover:scale-105 active:scale-95",
        isAnimating && "scale-95 opacity-90",
        className
      )}
      aria-label={`${label} - Kliknite za prikaz detalja`}
    >
      <Loader2 className="w-4 h-4 animate-spin" />
      <span className="max-w-[150px] truncate">{label}</span>
      <ChevronUp className="w-4 h-4" />
    </button>
  )
}

/**
 * Modal for expanded reasoning view on mobile.
 */
interface ReasoningModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}

export function ReasoningModal({ isOpen, onClose, children }: ReasoningModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal content */}
      <div
        className={cn(
          "relative w-full md:max-w-lg bg-surface",
          "rounded-t-2xl md:rounded-2xl shadow-2xl",
          "max-h-[80vh] overflow-y-auto",
          "animate-in slide-in-from-bottom duration-300"
        )}
      >
        {/* Handle bar (mobile) */}
        <div className="md:hidden flex justify-center py-3">
          <div className="w-12 h-1.5 bg-border rounded-full" />
        </div>

        {/* Content */}
        <div className="px-4 pb-4 pt-0 md:p-6">{children}</div>
      </div>
    </div>
  )
}
