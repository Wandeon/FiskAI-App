// src/components/capability/ActionButton.tsx
/**
 * Action Button
 *
 * Renders an action button based on capability resolution.
 * Disabled actions show the reason - never hidden.
 * Executes capability actions via the useCapabilityAction hook.
 * Actions with requiresConfirmation show a dialog before executing.
 *
 * @module components/capability
 * @since Control Center Shells
 * @updated PHASE 2 - Capability-Driven Actions
 * @updated PHASE 3 - Confirmation Dialog Support
 */

"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Loader2, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCapabilityAction } from "@/lib/capabilities/actions/useCapabilityAction"
import { toast } from "@/lib/toast"
import { ConfirmationDialog } from "./ConfirmationDialog"
import type { ActionButtonProps } from "./types"

export function ActionButton({
  action,
  capabilityId,
  entityId,
  entityType,
  showDiagnostics = false,
  params,
  onSuccess,
  onError,
  className,
}: ActionButtonProps) {
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const { execute, isLoading } = useCapabilityAction({
    capabilityId,
    actionId: action.id,
    entityId,
    entityType,
    onSuccess: () => {
      setShowConfirmation(false)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 2000)
      toast.success("Uspjeh", `${action.label} zavrseno`)
      onSuccess?.()
    },
    onError: (err) => {
      setShowConfirmation(false)
      toast.error("Greška", err)
      onError?.(err)
    },
  })

  const handleClick = async () => {
    if (!action.enabled || isLoading) return

    if (action.requiresConfirmation) {
      setShowConfirmation(true)
    } else {
      await execute({ id: entityId, ...params })
    }
  }

  const handleConfirm = async () => {
    await execute({ id: entityId, ...params })
  }

  const isDisabled = !action.enabled || isLoading

  const button = (
    <Button
      variant={action.primary ? "default" : "outline"}
      disabled={isDisabled}
      onClick={handleClick}
      className={cn("relative", className)}
    >
      {showSuccess ? (
        <CheckCircle2 className="mr-2 h-4 w-4 text-success animate-in zoom-in-0 duration-200" />
      ) : isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : null}
      {action.label}
      {showDiagnostics && (
        <span className="absolute -top-2 -right-2 text-[10px] font-mono bg-muted px-1 rounded">
          {capabilityId}
        </span>
      )}
    </Button>
  )

  const confirmationDialog = action.requiresConfirmation && (
    <ConfirmationDialog
      open={showConfirmation}
      onOpenChange={setShowConfirmation}
      title={`Potvrdi ${action.label}`}
      description={action.confirmationMessage || "Jeste li sigurni da zelite nastaviti?"}
      confirmLabel={action.label}
      onConfirm={handleConfirm}
      isLoading={isLoading}
    />
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
        {confirmationDialog}
      </TooltipProvider>
    )
  }

  return (
    <>
      {button}
      {confirmationDialog}
    </>
  )
}
