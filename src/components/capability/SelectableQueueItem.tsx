"use client"

/**
 * Selectable Queue Item
 *
 * Enhanced QueueItemCard with checkbox for batch selection.
 * Works with SelectionContext for coordinated multi-select.
 *
 * @module components/capability
 * @since PHASE 4 - Capability Batch Actions
 */

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { CapabilityStateIndicator } from "./CapabilityStateIndicator"
import { BlockerDisplay } from "./BlockerDisplay"
import { ActionButton } from "./ActionButton"
import { cn } from "@/lib/utils"
import type { QueueItem } from "./types"

interface Props {
  /** Queue item data */
  item: QueueItem
  /** Whether selection is enabled */
  selectable?: boolean
  /** Controlled selected state */
  isSelected?: boolean
  /** Callback when selection changes */
  onSelectionChange?: (id: string, selected: boolean) => void
  /** Show diagnostics */
  showDiagnostics?: boolean
  /** Callback when any action completes */
  onActionComplete?: () => void
}

export function SelectableQueueItem({
  item,
  selectable = false,
  isSelected = false,
  onSelectionChange,
  showDiagnostics = false,
  onActionComplete,
}: Props) {
  const primaryCapability =
    item.capabilities.find((c) => c.state === "READY") || item.capabilities[0]

  const handleCheckboxChange = (checked: boolean) => {
    onSelectionChange?.(item.id, checked)
  }

  return (
    <Card
      className={cn(
        "relative transition-colors",
        selectable && "cursor-pointer",
        isSelected && "ring-2 ring-primary bg-primary/5"
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          {selectable && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={handleCheckboxChange}
              aria-label={`Select ${item.title}`}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <div className="flex-1 flex items-center justify-between">
            <CardTitle className="text-base">{item.title}</CardTitle>
            {primaryCapability && <CapabilityStateIndicator state={primaryCapability.state} />}
          </div>
        </div>
        <p className="text-sm text-muted-foreground ml-7">
          Status: {item.status} | {new Date(item.timestamp).toLocaleDateString()}
        </p>
      </CardHeader>
      <CardContent className="ml-7">
        {/* Show blockers if any capability is blocked */}
        {item.capabilities.some((c) => c.state === "BLOCKED") && (
          <div className="mb-4">
            <BlockerDisplay
              blockers={item.capabilities.flatMap((c) => c.blockers)}
              showResolution
            />
          </div>
        )}

        {/* Show available actions (only when not in selection mode) */}
        {!selectable && (
          <div className="flex flex-wrap gap-2">
            {item.capabilities.map((cap) =>
              cap.actions
                .filter((a) => cap.state === "READY" || !a.enabled)
                .map((action) => (
                  <ActionButton
                    key={`${cap.capability}-${action.id}`}
                    action={action}
                    capabilityId={cap.capability}
                    entityId={item.id}
                    entityType={item.type}
                    showDiagnostics={showDiagnostics}
                    onSuccess={onActionComplete}
                  />
                ))
            )}
          </div>
        )}

        {/* Diagnostics panel */}
        {showDiagnostics && (
          <details className="mt-4 text-xs">
            <summary className="cursor-pointer font-mono text-muted-foreground">
              Capability Diagnostics
            </summary>
            <pre className="mt-2 p-2 bg-muted rounded overflow-auto max-h-48">
              {JSON.stringify(item.capabilities, null, 2)}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  )
}
