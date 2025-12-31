"use client"

import { createContext, useContext, useEffect, useCallback, ReactNode, useState } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

// Dialog context for managing open/close state
interface DialogContextValue {
  open: boolean
  setOpen: (open: boolean) => void
}

const DialogContext = createContext<DialogContextValue | undefined>(undefined)

function useDialogContext() {
  const context = useContext(DialogContext)
  if (!context) {
    throw new Error("Dialog components must be used within a Dialog")
  }
  return context
}

// Main Dialog wrapper
interface DialogProps {
  children: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function Dialog({ children, open: controlledOpen, onOpenChange }: DialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)

  const open = controlledOpen ?? internalOpen
  const setOpen = useCallback(
    (value: boolean) => {
      if (onOpenChange) {
        onOpenChange(value)
      } else {
        setInternalOpen(value)
      }
    },
    [onOpenChange]
  )

  return <DialogContext.Provider value={{ open, setOpen }}>{children}</DialogContext.Provider>
}

// Trigger button that opens the dialog
interface DialogTriggerProps {
  children: ReactNode
  asChild?: boolean
}

export function DialogTrigger({ children, asChild }: DialogTriggerProps) {
  const { setOpen } = useDialogContext()

  if (asChild && children) {
    // Clone the child element and add onClick
    const child = children as React.ReactElement
    return <span onClick={() => setOpen(true)}>{child}</span>
  }

  return <button onClick={() => setOpen(true)}>{children}</button>
}

// Dialog content (the actual modal)
interface DialogContentProps {
  children: ReactNode
  className?: string
}

export function DialogContent({ children, className }: DialogContentProps) {
  const { open, setOpen } = useDialogContext()

  // Close on escape key
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    },
    [setOpen]
  )

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleEscape)
      document.body.style.overflow = "hidden"
    }
    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = ""
    }
  }, [open, handleEscape])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative w-full max-w-lg rounded-card bg-[var(--surface-0)] shadow-elevated animate-scale-in",
          className
        )}
      >
        {/* Close button */}
        <button
          onClick={() => setOpen(false)}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-[var(--text-disabled)] hover:bg-[var(--surface-1)] hover:text-[var(--text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Content */}
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

// Dialog header
interface DialogHeaderProps {
  children: ReactNode
  className?: string
}

export function DialogHeader({ children, className }: DialogHeaderProps) {
  return (
    <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}>
      {children}
    </div>
  )
}

// Dialog title
interface DialogTitleProps {
  children: ReactNode
  className?: string
}

export function DialogTitle({ children, className }: DialogTitleProps) {
  return (
    <h2
      className={cn(
        "text-lg font-semibold leading-none tracking-tight text-[var(--text-primary)]",
        className
      )}
    >
      {children}
    </h2>
  )
}

// Dialog description
interface DialogDescriptionProps {
  children: ReactNode
  className?: string
}

export function DialogDescription({ children, className }: DialogDescriptionProps) {
  return <p className={cn("text-sm text-[var(--text-disabled)]", className)}>{children}</p>
}

// Dialog footer
interface DialogFooterProps {
  children: ReactNode
  className?: string
}

export function DialogFooter({ children, className }: DialogFooterProps) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6",
        className
      )}
    >
      {children}
    </div>
  )
}
