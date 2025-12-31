// src/components/guidance/HelpTooltip.tsx
"use client"

import { useState, type ReactNode } from "react"
import { HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useGuidance } from "@/contexts/GuidanceContext"
import type { CompetenceLevel } from "@/lib/guidance/constants"

interface HelpTooltipProps {
  content: string
  title?: string
  category?: "fakturiranje" | "financije" | "eu"
  position?: "top" | "bottom" | "left" | "right"
  className?: string
  children?: ReactNode
  forceShow?: boolean // Override visibility check
  isKeyField?: boolean // Mark as key field to show when fieldTooltips is "key"
}

export function HelpTooltip({
  content,
  title,
  category = "fakturiranje",
  position = "top",
  className,
  children,
  forceShow = false,
  isKeyField = false,
}: HelpTooltipProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { getHelpDensity } = useGuidance()

  const helpDensity = getHelpDensity(category)
  const { fieldTooltips } = helpDensity

  // Determine if tooltip should be visible based on help density settings
  const shouldShowTooltip =
    forceShow || fieldTooltips === "all" || (fieldTooltips === "key" && isKeyField)

  // If tooltip should not be shown, only render children
  if (!shouldShowTooltip) {
    return children ? <>{children}</> : null
  }

  // Position classes
  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  }

  const arrowClasses = {
    top: "-bottom-1.5 left-1/2 -translate-x-1/2 rotate-45 border-b border-r",
    bottom: "-top-1.5 left-1/2 -translate-x-1/2 rotate-45 border-t border-l",
    left: "-right-1.5 top-1/2 -translate-y-1/2 rotate-45 border-t border-r",
    right: "-left-1.5 top-1/2 -translate-y-1/2 rotate-45 border-b border-l",
  }

  return (
    <span className={cn("relative inline-flex items-center gap-1", className)}>
      {children}
      <button
        type="button"
        className="inline-flex text-white/40 hover:text-white/70 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-1 rounded-full transition-colors"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Pomoć: ${title || content.substring(0, 30)}`}
        aria-expanded={isOpen}
      >
        <HelpCircle className="h-4 w-4" />
      </button>

      {isOpen && (
        <div
          role="tooltip"
          className={cn(
            "absolute z-50 w-64 rounded-lg border border-white/10 bg-surface-elevated p-3 shadow-xl",
            positionClasses[position]
          )}
        >
          {title && <div className="font-semibold text-sm text-white mb-1">{title}</div>}
          <div className="text-xs text-white/70 leading-relaxed">{content}</div>
          <div
            className={cn(
              "absolute h-3 w-3 border-white/10 bg-surface-elevated",
              arrowClasses[position]
            )}
          />
        </div>
      )}
    </span>
  )
}

// Wrapper that respects guidance level (legacy - now handled by HelpTooltip directly via help density)
interface ConditionalHelpTooltipProps extends HelpTooltipProps {
  showForLevels?: CompetenceLevel[]
}

export function ConditionalHelpTooltip({
  showForLevels = ["beginner"],
  category = "fakturiranje",
  ...props
}: ConditionalHelpTooltipProps) {
  const { getLevel } = useGuidance()
  const currentLevel = getLevel(category)

  // Only show tooltip if current level is in the allowed list
  if (!showForLevels.includes(currentLevel)) {
    return props.children ? <>{props.children}</> : null
  }

  return <HelpTooltip category={category} {...props} />
}
