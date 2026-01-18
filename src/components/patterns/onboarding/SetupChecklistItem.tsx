"use client"

import { Check, Circle, Loader2, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// =============================================================================
// TYPES
// =============================================================================

/**
 * Checklist item status
 */
export type ChecklistItemStatus = "pending" | "in_progress" | "completed" | "skipped"

/**
 * Action button configuration
 */
export interface ChecklistAction {
  label: string
  variant: "primary" | "secondary" | "outline"
  onClick: () => void
}

/**
 * Input field configuration
 */
export interface ChecklistInputField {
  type: "text" | "file"
  placeholder?: string
  value?: string
  onChange: (value: string) => void
  error?: string
}

/**
 * Props for SetupChecklistItem component
 */
export interface SetupChecklistItemProps {
  id: string
  title: string
  description: string
  required: boolean
  status: ChecklistItemStatus
  requirements?: string[]
  actions?: ChecklistAction[]
  hint?: string
  inputField?: ChecklistInputField
  className?: string
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * SetupChecklistItem - Reusable checklist item for onboarding setup
 *
 * Displays a setup item with:
 * - Status indicator (pending, in_progress, completed, skipped)
 * - Title and description
 * - Optional requirements list
 * - Optional action buttons
 * - Optional input field
 * - Optional hint/warning message
 */
export function SetupChecklistItem({
  id,
  title,
  description,
  required,
  status,
  requirements,
  actions,
  hint,
  inputField,
  className,
}: SetupChecklistItemProps) {
  // Render status icon
  const renderStatusIcon = () => {
    switch (status) {
      case "completed":
        return (
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-success flex items-center justify-center">
            <Check className="h-4 w-4 text-inverse" aria-hidden="true" />
          </div>
        )
      case "in_progress":
        return (
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-interactive flex items-center justify-center">
            <Loader2 className="h-4 w-4 text-inverse animate-spin" aria-hidden="true" />
          </div>
        )
      case "skipped":
        return (
          <div className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-muted flex items-center justify-center">
            <span className="text-muted text-xs">-</span>
          </div>
        )
      case "pending":
      default:
        return (
          <div className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-border flex items-center justify-center">
            <Circle className="h-3 w-3 text-muted" aria-hidden="true" />
          </div>
        )
    }
  }

  return (
    <Card
      padding="sm"
      className={cn(
        "transition-colors",
        status === "completed" && "border-success bg-success-bg/50",
        status === "in_progress" && "border-interactive",
        status === "skipped" && "opacity-60",
        className
      )}
    >
      <div className="p-4">
        {/* Header: Status icon + Title */}
        <div className="flex items-start gap-3">
          {renderStatusIcon()}
          <div className="flex-1 min-w-0">
            <h3 className="text-body-base font-medium text-foreground">
              {title}
              {required && <span className="sr-only"> (obavezno)</span>}
            </h3>
            <hr className="my-2 border-border" />
            <p className="text-body-sm text-secondary">{description}</p>
          </div>
        </div>

        {/* Requirements list */}
        {requirements && requirements.length > 0 && status !== "completed" && (
          <div className="mt-4 ml-9">
            <p className="text-body-sm font-medium text-foreground mb-2">Trebat ćete:</p>
            <ul className="space-y-1">
              {requirements.map((req, index) => (
                <li key={index} className="text-body-sm text-secondary flex items-start gap-2">
                  <span className="text-muted" aria-hidden="true">
                    &bull;
                  </span>
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Input field */}
        {inputField && status !== "completed" && (
          <div className="mt-4 ml-9">
            {inputField.type === "text" && (
              <div>
                <Input
                  id={`${id}-input`}
                  type="text"
                  value={inputField.value || ""}
                  onChange={(e) => inputField.onChange(e.target.value)}
                  placeholder={inputField.placeholder}
                  error={inputField.error}
                  className="max-w-md font-mono"
                  aria-describedby={inputField.error ? `${id}-error` : undefined}
                />
                {inputField.error && (
                  <p id={`${id}-error`} className="mt-1 text-body-xs text-danger">
                    {inputField.error}
                  </p>
                )}
              </div>
            )}
            {inputField.type === "file" && (
              <Button type="button" variant="outline" size="sm">
                {inputField.placeholder || "Odaberi datoteku"}
              </Button>
            )}
          </div>
        )}

        {/* Completed input value display */}
        {inputField && status === "completed" && inputField.value && (
          <div className="mt-3 ml-9">
            <p className="text-body-sm text-success-text font-mono">{inputField.value}</p>
          </div>
        )}

        {/* Action buttons */}
        {actions && actions.length > 0 && status !== "completed" && status !== "skipped" && (
          <div className="mt-4 ml-9 flex flex-wrap gap-2">
            {actions.map((action, index) => (
              <Button
                key={index}
                type="button"
                variant={action.variant}
                size="sm"
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}

        {/* Hint message */}
        {hint && status !== "completed" && (
          <div className="mt-4 ml-9 flex items-start gap-2 text-body-xs text-warning-text">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p>{hint}</p>
          </div>
        )}

        {/* Skipped message */}
        {status === "skipped" && (
          <div className="mt-3 ml-9">
            <p className="text-body-xs text-muted italic">Preskočeno - možete postaviti kasnije</p>
          </div>
        )}
      </div>
    </Card>
  )
}
