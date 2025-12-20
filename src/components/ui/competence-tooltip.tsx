"use client"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { HelpCircle } from "lucide-react"
import { useVisibilityOptional } from "@/lib/visibility/context"
import type { CompetenceLevel } from "@/lib/visibility/rules"

interface CompetenceTooltipProps {
  children: React.ReactNode
  content: string
  showFor?: CompetenceLevel[] // Which competence levels see the tooltip
  className?: string
}

const DEFAULT_SHOW_FOR: CompetenceLevel[] = ["beginner", "average"]

/**
 * CompetenceTooltip - Shows a help icon with tooltip based on user's competence level
 *
 * By default, tooltips are shown for "beginner" and "average" users, but hidden for "pro" users.
 * This reduces UI clutter for experienced users while providing helpful hints for those who need them.
 *
 * @example
 * ```tsx
 * <CompetenceTooltip content="Your OIB is your tax identification number">
 *   <Label>OIB</Label>
 * </CompetenceTooltip>
 * ```
 */
export function CompetenceTooltip({
  children,
  content,
  showFor = DEFAULT_SHOW_FOR,
  className,
}: CompetenceTooltipProps) {
  const visibility = useVisibilityOptional()

  // Default to "beginner" if visibility context is not available
  const competence = visibility?.state.competence || "beginner"

  // Don't show tooltip if user's competence level is not in showFor
  if (!showFor.includes(competence)) {
    return <>{children}</>
  }

  return (
    <div className={`inline-flex items-center gap-1 ${className || ""}`}>
      {children}
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="h-4 w-4 cursor-help text-muted-foreground hover:text-foreground" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p>{content}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

/**
 * FieldHelp - Shows help text below form fields based on competence level
 *
 * Similar to CompetenceTooltip, but renders as small muted text below the field
 * instead of an icon with a tooltip. Useful for longer explanations that should
 * be immediately visible.
 *
 * @example
 * ```tsx
 * <div>
 *   <Label>IBAN</Label>
 *   <Input {...field} />
 *   <FieldHelp>
 *     Your IBAN is the international bank account number used for payments
 *   </FieldHelp>
 * </div>
 * ```
 */
export function FieldHelp({
  children,
  showFor = DEFAULT_SHOW_FOR,
}: {
  children: React.ReactNode
  showFor?: CompetenceLevel[]
}) {
  const visibility = useVisibilityOptional()

  // Default to "beginner" if visibility context is not available
  const competence = visibility?.state.competence || "beginner"

  if (!showFor.includes(competence)) {
    return null
  }

  return <p className="text-xs text-muted-foreground mt-1">{children}</p>
}
