import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Clock, AlertCircle } from "lucide-react"

/**
 * Deadline type for categorizing deadlines
 */
export type DeadlineType = "tax" | "contribution" | "vat" | "other"

/**
 * Deadline interface representing a single deadline
 */
export interface Deadline {
  id: string
  name: string
  date: Date
  type: DeadlineType
  isUrgent?: boolean
  actionUrl?: string
  actionLabel?: string
}

export interface DeadlineTimelineWidgetProps {
  deadlines: Deadline[]
  className?: string
}

/**
 * Format a date in Croatian short format: DD.MM
 */
function formatDateShort(date: Date): string {
  const day = date.getDate().toString().padStart(2, "0")
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  return `${day}.${month}`
}

/**
 * Format a date in Croatian full format: DD.MM.YYYY
 */
function formatDateFull(date: Date): string {
  const day = date.getDate().toString().padStart(2, "0")
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const year = date.getFullYear()
  return `${day}.${month}.${year}`
}

/**
 * Check if a deadline is within the urgent window (14 days)
 */
function isDeadlineUrgent(date: Date): boolean {
  const now = new Date()
  const urgentThresholdMs = 14 * 24 * 60 * 60 * 1000 // 14 days in ms
  const diff = date.getTime() - now.getTime()
  return diff >= 0 && diff <= urgentThresholdMs
}

/**
 * Check if a deadline is past
 */
function isDeadlinePast(date: Date): boolean {
  return date.getTime() < Date.now()
}

/**
 * Get color class based on deadline type
 */
function getDeadlineTypeColor(type: DeadlineType): string {
  switch (type) {
    case "tax":
      return "bg-danger"
    case "contribution":
      return "bg-warning-icon"
    case "vat":
      return "bg-interactive"
    case "other":
    default:
      return "bg-tertiary"
  }
}

/**
 * DeadlineTimelineWidget: Horizontal timeline showing upcoming deadlines.
 *
 * Features:
 * - Horizontal timeline with dots for each deadline
 * - Current position indicated by timeline progress
 * - Upcoming deadlines highlighted
 * - Urgent deadline (within 14 days) shown prominently below
 * - Croatian date formatting (DD.MM for timeline, DD.MM.YYYY for urgent)
 *
 * @example
 * ```tsx
 * <DeadlineTimelineWidget
 *   deadlines={[
 *     { id: '1', name: 'Porez na dohodak', date: new Date('2025-01-31'), type: 'tax' },
 *     { id: '2', name: 'MIO doprinosi', date: new Date('2025-02-15'), type: 'contribution' },
 *   ]}
 * />
 * ```
 */
export function DeadlineTimelineWidget({ deadlines, className }: DeadlineTimelineWidgetProps) {
  // Sort deadlines by date
  const sortedDeadlines = [...deadlines].sort((a, b) => a.date.getTime() - b.date.getTime())

  // Get upcoming deadlines (not past)
  const upcomingDeadlines = sortedDeadlines.filter((d) => !isDeadlinePast(d.date))

  // Find the next urgent deadline (within 14 days or explicitly marked urgent)
  const urgentDeadline = upcomingDeadlines.find(
    (d) => d.isUrgent || isDeadlineUrgent(d.date)
  )

  // Take first 3-5 deadlines for the timeline display
  const timelineDeadlines = upcomingDeadlines.slice(0, 5)

  // Calculate timeline progress based on current date position
  const calculateProgress = (): number => {
    if (timelineDeadlines.length === 0) return 0
    if (timelineDeadlines.length === 1) return 0

    const now = Date.now()
    const firstDate = timelineDeadlines[0].date.getTime()
    const lastDate = timelineDeadlines[timelineDeadlines.length - 1].date.getTime()

    if (now <= firstDate) return 0
    if (now >= lastDate) return 100

    return ((now - firstDate) / (lastDate - firstDate)) * 100
  }

  const progress = calculateProgress()

  return (
    <Card variant="default" padding="none" className={cn("overflow-hidden", className)}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-secondary" aria-hidden="true" />
          <h2 className="text-heading-sm font-semibold text-foreground">ROKOVI</h2>
        </div>
      </div>

      {/* Timeline Content */}
      <div className="px-6 py-5">
        {timelineDeadlines.length === 0 ? (
          <p className="text-body-sm text-secondary">Nema nadolazećih rokova.</p>
        ) : (
          <>
            {/* Timeline Visual */}
            <div className="relative mb-6">
              {/* Timeline Line */}
              <div className="relative flex items-center">
                {/* Background line */}
                <div className="absolute inset-x-0 h-0.5 bg-border" />

                {/* Progress line */}
                <div
                  className="absolute h-0.5 bg-interactive transition-all duration-300"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />

                {/* Arrow at end */}
                <div className="absolute right-0 w-0 h-0 border-t-4 border-t-transparent border-b-4 border-b-transparent border-l-8 border-l-border" />

                {/* Timeline Points */}
                <div className="relative flex justify-between w-full">
                  {timelineDeadlines.map((deadline, index) => {
                    const isUrgentPoint = deadline.isUrgent || isDeadlineUrgent(deadline.date)
                    const positionPercent = timelineDeadlines.length === 1
                      ? 50
                      : (index / (timelineDeadlines.length - 1)) * 100

                    return (
                      <div
                        key={deadline.id}
                        className="flex flex-col items-center"
                        style={{
                          position: "absolute",
                          left: `${positionPercent}%`,
                          transform: "translateX(-50%)",
                        }}
                      >
                        {/* Dot */}
                        <div
                          className={cn(
                            "w-3 h-3 rounded-full border-2 border-surface z-10 transition-all",
                            isUrgentPoint
                              ? "bg-danger ring-2 ring-danger/30"
                              : getDeadlineTypeColor(deadline.type)
                          )}
                          aria-label={`${deadline.name}: ${formatDateFull(deadline.date)}`}
                        />

                        {/* Date label (short format) */}
                        <span
                          className={cn(
                            "mt-2 text-body-xs whitespace-nowrap",
                            isUrgentPoint ? "text-danger font-medium" : "text-tertiary"
                          )}
                        >
                          {formatDateShort(deadline.date)}
                        </span>

                        {/* Name label */}
                        <span
                          className={cn(
                            "text-body-xs whitespace-nowrap max-w-[80px] truncate text-center",
                            isUrgentPoint ? "text-foreground font-medium" : "text-secondary"
                          )}
                          title={deadline.name}
                        >
                          {deadline.name}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Spacer for timeline point labels */}
              <div className="h-14" />
            </div>

            {/* Urgent Deadline Alert */}
            {urgentDeadline && (
              <div className="mt-4 p-4 rounded-lg bg-danger-bg border border-danger-border">
                <div className="flex items-start gap-3">
                  <AlertCircle
                    className="h-5 w-5 text-danger-icon shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-body-base font-medium text-danger-text">
                      {urgentDeadline.name}
                    </p>
                    <p className="text-body-sm text-foreground mt-0.5">
                      {formatDateFull(urgentDeadline.date)}
                    </p>
                    {urgentDeadline.actionUrl && urgentDeadline.actionLabel && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        asChild
                      >
                        <a href={urgentDeadline.actionUrl}>{urgentDeadline.actionLabel}</a>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  )
}
