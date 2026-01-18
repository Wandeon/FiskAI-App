import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { CheckCircle, AlertTriangle, AlertCircle } from "lucide-react"
import { ComplianceReasonItem } from "./ComplianceReasonItem"
import type { ComplianceStatus, ComplianceState } from "@/lib/services/compliance.service"

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
 * Format datetime in Croatian format: DD.MM.YYYY HH:mm
 */
function formatDateTimeCroatian(date: Date): string {
  const dateStr = formatDateCroatian(date)
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")
  return `${dateStr} ${hours}:${minutes}`
}

/**
 * State configuration for visual styling and content
 */
const stateConfig: Record<
  ComplianceState,
  {
    icon: typeof CheckCircle
    title: string
    bgClass: string
    borderClass: string
    iconClass: string
    titleClass: string
  }
> = {
  OK: {
    icon: CheckCircle,
    title: "USKLAĐENI STE",
    bgClass: "bg-success-bg",
    borderClass: "border-success-border",
    iconClass: "text-success-icon",
    titleClass: "text-success-text",
  },
  ATTENTION: {
    icon: AlertTriangle,
    title: "POTREBNA PAŽNJA",
    bgClass: "bg-warning-bg",
    borderClass: "border-warning-border",
    iconClass: "text-warning-icon",
    titleClass: "text-warning-text",
  },
  RISK: {
    icon: AlertCircle,
    title: "HITNO - POTREBNA AKCIJA",
    bgClass: "bg-danger-bg",
    borderClass: "border-danger-border",
    iconClass: "text-danger-icon",
    titleClass: "text-danger-text",
  },
}

/**
 * Get the description text based on state and reason count
 */
function getStateDescription(state: ComplianceState, reasonCount: number): string {
  switch (state) {
    case "OK":
      return "Sve obveze su ispunjene. Nema hitnih zadataka."
    case "ATTENTION":
      if (reasonCount === 1) {
        return "1 zadatak treba vašu pažnju u sljedećih 14 dana."
      }
      return `${reasonCount} zadataka treba vašu pažnju u sljedećih 14 dana.`
    case "RISK":
      if (reasonCount === 1) {
        return "Imate 1 propuštenu ili kritičnu obvezu."
      }
      return `Imate ${reasonCount} propuštenih ili kritičnih obveza.`
    default:
      return ""
  }
}

export interface ComplianceStatusCardProps {
  status: ComplianceStatus
  className?: string
}

/**
 * ComplianceStatusCard: Dashboard card showing compliance status with 3 states.
 *
 * States:
 * - OK: All obligations met, shows next deadline info
 * - ATTENTION: Tasks needing attention within 14 days
 * - RISK: Overdue or critical obligations requiring immediate action
 *
 * @example
 * ```tsx
 * <ComplianceStatusCard
 *   status={{
 *     state: 'OK',
 *     evaluatedAt: new Date(),
 *     reasons: [],
 *     nextEvaluation: new Date()
 *   }}
 * />
 * ```
 */
export function ComplianceStatusCard({ status, className }: ComplianceStatusCardProps) {
  const config = stateConfig[status.state]
  const Icon = config.icon

  // Find the next deadline from reasons (for OK state display)
  const nextDeadlineReason = status.reasons.find((r) => r.dueDate && r.dueDate > new Date())

  return (
    <Card
      variant="default"
      padding="none"
      className={cn("overflow-hidden", config.borderClass, className)}
    >
      {/* Header */}
      <div className={cn("px-6 py-4", config.bgClass)}>
        <div className="flex items-center gap-3">
          <Icon className={cn("h-6 w-6 shrink-0", config.iconClass)} aria-hidden="true" />
          <h2 className={cn("text-heading-md font-semibold", config.titleClass)}>{config.title}</h2>
        </div>
        <div className={cn("mt-1 h-px", config.borderClass)} />
        <p className="mt-3 text-body-base text-foreground">
          {getStateDescription(status.state, status.reasons.length)}
        </p>
      </div>

      {/* Content */}
      <div className="px-6 py-4">
        {/* OK State: Show next deadline info */}
        {status.state === "OK" && (
          <div className="space-y-2">
            {nextDeadlineReason ? (
              <>
                <p className="text-body-sm text-secondary">
                  <span className="font-medium">Sljedeća provjera:</span>{" "}
                  {nextDeadlineReason.message.split(" - ")[0]}
                </p>
                {nextDeadlineReason.dueDate && (
                  <p className="text-body-sm text-secondary">
                    <span className="font-medium">Datum:</span>{" "}
                    {formatDateCroatian(nextDeadlineReason.dueDate)}
                  </p>
                )}
              </>
            ) : (
              <p className="text-body-sm text-secondary">Nema nadolazećih rokova.</p>
            )}
          </div>
        )}

        {/* ATTENTION/RISK State: Show reason items */}
        {(status.state === "ATTENTION" || status.state === "RISK") && status.reasons.length > 0 && (
          <div className="space-y-3">
            {status.reasons.map((reason, index) => (
              <ComplianceReasonItem key={`${reason.code}-${index}`} reason={reason} />
            ))}
          </div>
        )}

        {/* Footer: Last evaluation timestamp */}
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-body-sm text-tertiary">
            Zadnja provjera: {formatDateTimeCroatian(status.evaluatedAt)}
          </p>
        </div>
      </div>
    </Card>
  )
}
