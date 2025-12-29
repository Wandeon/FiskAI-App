"use client"

import { ReactNode } from "react"
import { AlertTriangle, Info, CheckCircle2, Loader2 } from "lucide-react"
import { Modal, ModalFooter } from "./modal"
import { Button } from "./button"
import { cn } from "@/lib/utils"
import { useModalShortcuts } from "@/hooks/use-keyboard-shortcuts"

type Variant = "danger" | "warning" | "info" | "success"

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: Variant
  loading?: boolean
  children?: ReactNode
}

const variantConfig = {
  danger: {
    icon: AlertTriangle,
    iconBg: "bg-danger-100",
    iconColor: "text-danger-600",
    buttonClass: "bg-danger-600 hover:bg-danger-700 text-white",
  },
  warning: {
    icon: AlertTriangle,
    iconBg: "bg-warning-100",
    iconColor: "text-warning-600",
    buttonClass: "bg-warning-600 hover:bg-warning-700 text-white",
  },
  info: {
    icon: Info,
    iconBg: "bg-brand-100",
    iconColor: "text-brand-600",
    buttonClass: "bg-brand-600 hover:bg-brand-700 text-white",
  },
  success: {
    icon: CheckCircle2,
    iconBg: "bg-success-100",
    iconColor: "text-success-600",
    buttonClass: "bg-success-600 hover:bg-success-700 text-white",
  },
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Potvrdi",
  cancelLabel = "Odustani",
  variant = "danger",
  loading = false,
  children,
}: ConfirmDialogProps) {
  const config = variantConfig[variant]
  const Icon = config.icon

  // Keyboard shortcuts: Escape to close, Ctrl+Enter to confirm
  useModalShortcuts({
    isOpen,
    onClose,
    onConfirm: loading ? undefined : onConfirm,
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} showClose={false} size="sm">
      <div className="flex gap-4">
        <div
          className={cn(
            "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full",
            config.iconBg
          )}
          aria-hidden="true"
        >
          <Icon className={cn("h-6 w-6", config.iconColor)} />
        </div>
        <div className="flex-1">
          <h3 id="confirm-dialog-title" className="text-lg font-semibold text-[var(--foreground)]">{title}</h3>
          {description && <p id="confirm-dialog-description" className="mt-2 text-sm text-[var(--muted)]">{description}</p>}
          {children}
        </div>
      </div>

      <ModalFooter>
        <Button variant="outline" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button onClick={onConfirm} disabled={loading} className={config.buttonClass}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Učitavanje...
            </>
          ) : (
            confirmLabel
          )}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
