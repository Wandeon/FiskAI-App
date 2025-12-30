"use client"

import { useState, type ReactNode } from "react"
import { useGuidance } from "@/contexts/GuidanceContext"
import type { GuidanceCategory } from "@/lib/guidance/constants"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface ConfirmationDialogProps {
  trigger: ReactNode
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void | Promise<void>
  onCancel?: () => void
  destructive?: boolean
  category?: GuidanceCategory
  forceShow?: boolean
}

export function ConfirmationDialog({
  trigger,
  title,
  description,
  confirmLabel = "Potvrdi",
  cancelLabel = "Odustani",
  onConfirm,
  onCancel,
  destructive = false,
  category = "fakturiranje",
  forceShow = false,
}: ConfirmationDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { getHelpDensity } = useGuidance()

  const helpDensity = getHelpDensity(category)
  const { actionConfirmations } = helpDensity

  const shouldShowConfirmation =
    forceShow ||
    actionConfirmations === "always" ||
    (actionConfirmations === "destructive" && destructive)

  const handleTriggerClick = () => {
    if (shouldShowConfirmation) {
      setOpen(true)
    } else {
      handleConfirm()
    }
  }

  const handleConfirm = async () => {
    setIsLoading(true)
    try {
      await onConfirm()
      setOpen(false)
    } catch (error) {
      console.error("Confirmation action failed:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setOpen(false)
    onCancel?.()
  }

  return (
    <>
      <div onClick={handleTriggerClick} className="inline-block">
        {trigger}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
            >
              {cancelLabel}
            </Button>
            <Button
              variant={destructive ? "destructive" : "default"}
              onClick={handleConfirm}
              disabled={isLoading}
            >
              {isLoading ? "Molimo pričekajte..." : confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
