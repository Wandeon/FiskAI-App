"use client"

/**
 * Batch Action Bar
 *
 * Floating action bar that appears when items are selected.
 * Displays selection count and available batch actions.
 *
 * @module components/capability
 * @since PHASE 4 - Capability Batch Actions
 */

import React from "react"
import { Button } from "@/components/ui/button"
import { X, Loader2 } from "lucide-react"
import { useBatchAction } from "@/lib/capabilities/actions/useBatchAction"
import { toast } from "@/lib/toast"
import type { BatchActionResult } from "@/lib/capabilities/actions/batch-types"

/**
 * Action definition for batch operations.
 */
export interface BatchActionDefinition {
  /** Action ID */
  id: string
  /** Display label */
  label: string
  /** Capability ID */
  capabilityId: string
  /** Additional params */
  params?: Record<string, unknown>
}

interface Props {
  /** Entity type for the batch */
  entityType: string
  /** Available batch actions */
  actions: BatchActionDefinition[]
  /** Currently selected entity IDs (controlled) */
  selectedIds?: string[]
  /** Clear selection callback */
  onClear?: () => void
  /** Callback after any action completes */
  onActionComplete?: (result: BatchActionResult) => void
}

export function BatchActionBar({
  entityType,
  actions,
  selectedIds = [],
  onClear,
  onActionComplete,
}: Props) {
  // Don't render if nothing selected
  if (selectedIds.length === 0) {
    return null
  }

  return (
    <div
      data-testid="batch-action-bar"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-background border rounded-lg shadow-lg px-4 py-2"
    >
      <span className="text-sm font-medium">{selectedIds.length} selected</span>

      <div className="h-4 w-px bg-border" />

      <div className="flex gap-2">
        {actions.map((action) => (
          <BatchActionButton
            key={action.id}
            action={action}
            entityType={entityType}
            selectedIds={selectedIds}
            onComplete={(result) => {
              if (result.succeeded > 0) {
                toast.success(
                  "Batch Complete",
                  `${result.succeeded}/${result.total} ${action.label.toLowerCase()}d`
                )
              }
              if (result.failed > 0) {
                toast.error("Some Failed", `${result.failed}/${result.total} failed`)
              }
              onActionComplete?.(result)
            }}
          />
        ))}
      </div>

      <div className="h-4 w-px bg-border" />

      <Button
        variant="ghost"
        size="icon"
        onClick={onClear}
        aria-label="Clear selection"
        className="h-8 w-8"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}

/**
 * Individual batch action button with loading state.
 */
function BatchActionButton({
  action,
  entityType,
  selectedIds,
  onComplete,
}: {
  action: BatchActionDefinition
  entityType: string
  selectedIds: string[]
  onComplete: (result: BatchActionResult) => void
}) {
  const { execute, isLoading, progress } = useBatchAction({
    capabilityId: action.capabilityId,
    actionId: action.id,
    entityType,
    params: action.params,
    onComplete,
  })

  const handleClick = () => {
    void execute(selectedIds)
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={isLoading}>
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
          {progress ? `${progress.percent}%` : "..."}
        </>
      ) : (
        action.label
      )}
    </Button>
  )
}
