import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { BarChart3 } from "lucide-react"

/**
 * Format money in Croatian format: "45.000 €"
 * Input is in cents, output is formatted euros
 */
function formatMoneyCroatian(cents: number): string {
  const euros = cents / 100
  // Croatian format uses dots as thousand separators
  const formatted = new Intl.NumberFormat("hr-HR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(euros)
  return `${formatted} €`
}

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
 * Get the color status based on percentage threshold
 */
type IncomeStatus = "success" | "warning" | "danger" | "critical"

function getIncomeStatus(percentage: number): IncomeStatus {
  if (percentage > 100) return "critical"
  if (percentage >= 85) return "danger"
  if (percentage >= 60) return "warning"
  return "success"
}

/**
 * Status configuration for visual styling
 */
const statusConfig: Record<
  IncomeStatus,
  {
    barClass: string
    textClass: string
    bgClass: string
    borderClass: string
  }
> = {
  success: {
    barClass: "bg-success-icon",
    textClass: "text-success-text",
    bgClass: "bg-success-bg",
    borderClass: "border-success-border",
  },
  warning: {
    barClass: "bg-warning-icon",
    textClass: "text-warning-text",
    bgClass: "bg-warning-bg",
    borderClass: "border-warning-border",
  },
  danger: {
    barClass: "bg-danger-icon",
    textClass: "text-danger-text",
    bgClass: "bg-danger-bg",
    borderClass: "border-danger-border",
  },
  critical: {
    barClass: "bg-danger-icon animate-pulse",
    textClass: "text-danger-text",
    bgClass: "bg-danger-bg",
    borderClass: "border-danger-border",
  },
}

export interface IncomeTrackingWidgetProps {
  /** Current year income in cents */
  currentIncome: number
  /** Pausal limit in cents (e.g., 5000000 for 50.000€) */
  limit: number
  /** Year being tracked */
  year: number
  /** When the data was last updated */
  lastUpdated: Date
  /** Optional URL for details page */
  detailsUrl?: string
  /** Additional CSS classes */
  className?: string
}

/**
 * IncomeTrackingWidget: Dashboard widget showing income progress towards pausal limit.
 *
 * Displays:
 * - Current year income vs pausal limit
 * - Progress bar with color-coded thresholds:
 *   - 0-60%: Green (success)
 *   - 60-85%: Yellow (warning)
 *   - 85-100%: Red (danger)
 *   - >100%: Red with pulsing animation (critical)
 * - Croatian currency formatting
 * - Last updated timestamp
 * - Optional details link
 *
 * @example
 * ```tsx
 * <IncomeTrackingWidget
 *   currentIncome={4500000}  // 45.000€
 *   limit={5000000}          // 50.000€
 *   year={2025}
 *   lastUpdated={new Date()}
 *   detailsUrl="/reports/pausalni-obrt"
 * />
 * ```
 */
export function IncomeTrackingWidget({
  currentIncome,
  limit,
  year,
  lastUpdated,
  detailsUrl,
  className,
}: IncomeTrackingWidgetProps) {
  // Calculate percentage (cap at 100 for bar display, but show real value in text)
  const percentage = limit > 0 ? (currentIncome / limit) * 100 : 0
  const displayPercentage = Math.round(percentage)
  const barPercentage = Math.min(percentage, 100)

  const status = getIncomeStatus(percentage)
  const config = statusConfig[status]

  return (
    <Card
      variant="default"
      padding="none"
      className={cn("overflow-hidden", config.borderClass, className)}
    >
      {/* Header */}
      <div className={cn("px-6 py-4", config.bgClass)}>
        <div className="flex items-center gap-3">
          <BarChart3 className={cn("h-5 w-5 shrink-0", config.textClass)} aria-hidden="true" />
          <h2
            className={cn(
              "text-heading-sm font-semibold uppercase tracking-wide",
              config.textClass
            )}
          >
            Prihod {year}
          </h2>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-4">
        {/* Income Amount */}
        <p className="text-heading-lg font-bold text-foreground">
          {formatMoneyCroatian(currentIncome)}
        </p>

        {/* Progress Bar */}
        <div className="mt-4 space-y-2">
          <div className="h-3 w-full rounded-full bg-border overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-500", config.barClass)}
              style={{ width: `${barPercentage}%` }}
              role="progressbar"
              aria-valuenow={displayPercentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${displayPercentage}% godišnjeg limita`}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className={cn("text-body-sm font-medium", config.textClass)}>
              {displayPercentage}%
            </span>
            <span className="text-body-sm text-secondary">{formatMoneyCroatian(limit)}</span>
          </div>
        </div>

        {/* Source and timestamp */}
        <div className="mt-4 space-y-1">
          <p className="text-body-sm text-tertiary">Izvor: izdani računi</p>
          <p className="text-body-sm text-tertiary">Ažurirano: {formatDateCroatian(lastUpdated)}</p>
        </div>

        {/* Details link */}
        {detailsUrl && (
          <div className="mt-4 pt-4 border-t border-border flex justify-end">
            <a href={detailsUrl} className="text-body-sm font-medium text-primary hover:underline">
              Detalji →
            </a>
          </div>
        )}
      </div>
    </Card>
  )
}
