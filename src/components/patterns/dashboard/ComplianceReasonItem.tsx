import { cn } from "@/lib/utils"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import type { ComplianceReason } from "@/lib/services/compliance.service"

/**
 * Format a date in Croatian format: DD.MM.YYYY
 */
function formatDateCroatian(date: Date): string {
  const day = date.getDate().toString().padStart(2, "0")
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const year = date.getFullYear()
  return `${day}.${month}.${year}`
}

/**
 * Calculate relative time in Croatian
 * Returns "za X dana" (in X days) or "prije X dana" (X days ago)
 */
function getRelativeTimeCroatian(date: Date): string {
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return "danas"
  } else if (diffDays === 1) {
    return "sutra"
  } else if (diffDays === -1) {
    return "jučer"
  } else if (diffDays > 0) {
    return `za ${diffDays} dana`
  } else {
    return `prije ${Math.abs(diffDays)} dana`
  }
}

/**
 * Severity indicator dot color mapping
 */
const severityDotStyles: Record<ComplianceReason["severity"], string> = {
  info: "bg-info",
  warning: "bg-warning",
  critical: "bg-danger",
}

/**
 * Severity-based border styles
 */
const severityBorderStyles: Record<ComplianceReason["severity"], string> = {
  info: "border-info/30",
  warning: "border-warning/30",
  critical: "border-danger/30",
}

/**
 * Severity-based background styles
 */
const severityBgStyles: Record<ComplianceReason["severity"], string> = {
  info: "bg-info-bg",
  warning: "bg-warning-bg",
  critical: "bg-danger-bg",
}

export interface ComplianceReasonItemProps {
  reason: ComplianceReason
  className?: string
}

/**
 * ComplianceReasonItem: Displays a single compliance reason with severity indicator,
 * deadline info, and action button.
 *
 * Used within ComplianceStatusCard to display individual compliance issues.
 */
export function ComplianceReasonItem({ reason, className }: ComplianceReasonItemProps) {
  const isOverdue = reason.dueDate && reason.dueDate < new Date()

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        severityBorderStyles[reason.severity],
        severityBgStyles[reason.severity],
        className
      )}
    >
      {/* Header with severity dot and message */}
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
            severityDotStyles[reason.severity]
          )}
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <p className="text-body-base font-medium text-foreground">{reason.message}</p>

          {/* Deadline info */}
          {reason.dueDate && (
            <p className="mt-1 text-body-sm text-secondary">
              {isOverdue ? (
                <>Rok je bio: {formatDateCroatian(reason.dueDate)}</>
              ) : (
                <>
                  Rok: {formatDateCroatian(reason.dueDate)} (
                  {getRelativeTimeCroatian(reason.dueDate)})
                </>
              )}
            </p>
          )}

          {/* Action link */}
          <Link
            href={reason.actionUrl}
            className="mt-3 inline-flex items-center gap-1 text-body-sm font-medium text-link hover:underline"
          >
            {reason.action}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  )
}
