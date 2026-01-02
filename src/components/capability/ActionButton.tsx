// src/components/capability/ActionButton.tsx
/**
 * Action Button
 *
 * Renders an action button based on capability resolution.
 * Disabled actions show the reason - never hidden.
 *
 * @module components/capability
 * @since Control Center Shells
 */

"use client"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { ActionButtonProps } from "./types"

export function ActionButton({
  action,
  capabilityId,
  onClick,
  showDiagnostics = false,
}: ActionButtonProps) {
  const handleClick = () => {
    if (action.enabled && onClick) {
      onClick()
    }
  }

  const button = (
    <Button
      variant={action.primary ? "default" : "outline"}
      disabled={!action.enabled}
      onClick={handleClick}
      className="relative"
    >
      {action.label}
      {showDiagnostics && (
        <span className="absolute -top-2 -right-2 text-[10px] font-mono bg-muted px-1 rounded">
          {capabilityId}
        </span>
      )}
    </Button>
  )

  if (!action.enabled && action.disabledReason) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p>{action.disabledReason}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return button
}
