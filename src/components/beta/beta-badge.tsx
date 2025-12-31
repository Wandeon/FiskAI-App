"use client"

import { Badge } from "@/components/ui/badge"
import { FlaskConical } from "lucide-react"
import { cn } from "@/lib/utils"

interface BetaBadgeProps {
  className?: string
  showIcon?: boolean
  variant?: "default" | "subtle"
}

/**
 * A badge indicating the user is participating in the beta program.
 * Can be displayed in the header, navigation, or near beta features.
 */
export function BetaBadge({ className, showIcon = true, variant = "default" }: BetaBadgeProps) {
  if (variant === "subtle") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium text-info-text",
          className
        )}
      >
        {showIcon && <FlaskConical className="h-3 w-3" />}
        <span>Beta</span>
      </span>
    )
  }

  return (
    <Badge
      variant="info"
      className={cn("bg-info-bg text-info-text border-info-border hover:bg-info-bg", className)}
    >
      {showIcon && <FlaskConical className="mr-1 h-3 w-3" />}
      Beta
    </Badge>
  )
}
