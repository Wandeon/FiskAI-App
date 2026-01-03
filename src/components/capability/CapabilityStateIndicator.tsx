// src/components/capability/CapabilityStateIndicator.tsx
/**
 * Capability State Indicator
 *
 * Renders the state of a resolved capability.
 * No business logic - just visualization.
 *
 * @module components/capability
 * @since Control Center Shells
 */

import React from "react"
import { Badge } from "@/components/ui/badge"
import type { CapabilityState } from "./types"

interface Props {
  state: CapabilityState
  className?: string
}

const STATE_CONFIG: Record<
  CapabilityState,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  READY: { label: "Ready", variant: "default" },
  BLOCKED: { label: "Blocked", variant: "destructive" },
  MISSING_INPUTS: { label: "Missing Inputs", variant: "secondary" },
  UNAUTHORIZED: { label: "Unauthorized", variant: "outline" },
}

export function CapabilityStateIndicator({ state, className }: Props) {
  const config = STATE_CONFIG[state]

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  )
}
