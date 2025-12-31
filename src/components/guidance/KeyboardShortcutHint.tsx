"use client"

import { useState } from "react"
import { useGuidance } from "@/contexts/GuidanceContext"
import type { GuidanceCategory } from "@/lib/guidance/constants"
import { cn } from "@/lib/utils"

interface KeyboardShortcutHintProps {
  shortcut: string
  description?: string
  category?: GuidanceCategory
  forceShow?: boolean
  className?: string
}

export function KeyboardShortcutHint({
  shortcut,
  description,
  category = "fakturiranje",
  forceShow = false,
  className,
}: KeyboardShortcutHintProps) {
  const [isHovered, setIsHovered] = useState(false)
  const { getHelpDensity } = useGuidance()

  const helpDensity = getHelpDensity(category)
  const { keyboardShortcuts } = helpDensity

  const visibility = forceShow ? "visible" : keyboardShortcuts

  if (visibility === "hidden") {
    return null
  }

  if (visibility === "hover" && !isHovered) {
    return (
      <span
        className="inline-block"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <span className="opacity-0 w-0 h-0" />
      </span>
    )
  }

  const keys = shortcut.split("+").map((key) => key.trim())

  return (
    <span
      className={cn("inline-flex items-center gap-1", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {keys.map((key, index) => (
        <span key={index} className="inline-flex items-center gap-0.5">
          <kbd
            className={cn(
              "inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded",
              "text-xs font-mono font-medium",
              "bg-surface/5 border border-white/10",
              "text-white/60",
              "shadow-sm"
            )}
          >
            {key}
          </kbd>
          {index < keys.length - 1 && <span className="text-white/40 text-xs mx-0.5">+</span>}
        </span>
      ))}
      {description && <span className="text-xs text-white/50 ml-1">{description}</span>}
    </span>
  )
}

interface WithKeyboardShortcutProps {
  children: React.ReactNode
  shortcut: string
  category?: GuidanceCategory
  position?: "top" | "bottom" | "left" | "right"
  className?: string
}

export function WithKeyboardShortcut({
  children,
  shortcut,
  category = "fakturiranje",
  position = "right",
  className,
}: WithKeyboardShortcutProps) {
  const positionClasses = {
    top: "flex-col-reverse",
    bottom: "flex-col",
    left: "flex-row-reverse",
    right: "flex-row",
  }

  return (
    <div className={cn("inline-flex items-center gap-2", positionClasses[position], className)}>
      {children}
      <KeyboardShortcutHint shortcut={shortcut} category={category} />
    </div>
  )
}
