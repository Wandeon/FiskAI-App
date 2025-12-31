"use client"

import * as React from "react"
import { AlertTriangle, Clock, ArrowRight, X } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { getDeprecationInfo, getDaysUntilSunset } from "@/lib/deprecation"
import type { DeprecationInfo, DeprecationNoticeOptions } from "@/lib/deprecation"

const deprecationNoticeVariants = cva("relative rounded-lg border p-4", {
  variants: {
    urgency: {
      low: "bg-warning-bg/50 text-warning-text border-warning-border",
      medium: "bg-warning-bg text-warning-text border-warning-border",
      high: "bg-danger-bg text-danger-text border-danger-border",
    },
    prominence: {
      inline: "",
      banner: "w-full",
      modal: "shadow-lg",
    },
  },
  defaultVariants: {
    urgency: "medium",
    prominence: "inline",
  },
})

export interface DeprecationNoticeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    Omit<Partial<DeprecationNoticeOptions>, "prominence">,
    VariantProps<typeof deprecationNoticeVariants> {
  /** Feature ID to look up deprecation info */
  featureId?: string
  /** Or provide deprecation info directly */
  deprecationInfo?: DeprecationInfo
  /** Override the title text */
  title?: string
  /** Override the description text */
  description?: string
  /** Hide the sunset date */
  hideSunsetDate?: boolean
  /** Hide the migration link */
  hideMigration?: boolean
  /** Callback when dismissed */
  onDismiss?: () => void
}

/**
 * Get urgency level based on days until sunset
 */
function getUrgencyLevel(daysRemaining: number | null): "low" | "medium" | "high" {
  if (daysRemaining === null) return "low"
  if (daysRemaining <= 7) return "high"
  if (daysRemaining <= 30) return "medium"
  return "low"
}

/**
 * Format days remaining as human-readable string
 */
function formatDaysRemaining(days: number | null): string {
  if (days === null) return ""
  if (days <= 0) return "Sunset date has passed"
  if (days === 1) return "1 day remaining"
  if (days <= 7) return `${days} days remaining`
  if (days <= 30) return `${Math.ceil(days / 7)} weeks remaining`
  return `${Math.ceil(days / 30)} months remaining`
}

/**
 * DeprecationNotice displays a warning about a deprecated feature
 *
 * @example
 * // Using feature ID (looks up from registry)
 * <DeprecationNotice featureId="F036" />
 *
 * @example
 * // Using custom info
 * <DeprecationNotice
 *   title="Legacy API Deprecated"
 *   description="This API will be removed in v2.0"
 *   deprecationInfo={{
 *     sunsetDate: "2025-06-01",
 *     migrationTarget: "/api/v2/...",
 *     migrationDocsUrl: "/docs/migration"
 *   }}
 * />
 */
export function DeprecationNotice({
  featureId,
  deprecationInfo: providedInfo,
  title,
  description,
  hideSunsetDate = false,
  hideMigration = false,
  dismissible = true,
  prominence = "inline",
  className,
  onDismiss,
  ...props
}: DeprecationNoticeProps) {
  const [isDismissed, setIsDismissed] = React.useState(false)

  // Get deprecation info from registry or use provided
  const info = featureId ? getDeprecationInfo(featureId) : providedInfo

  // Check localStorage for dismissal state
  React.useEffect(() => {
    if (info && dismissible) {
      const dismissKey = `deprecation-dismissed-${info.featureId}`
      const dismissed = localStorage.getItem(dismissKey)
      if (dismissed) {
        setIsDismissed(true)
      }
    }
  }, [info, dismissible])

  // Don't render if no info or feature is not deprecated
  if (!info || info.phase === "active") return null

  // Don't render if dismissed
  if (isDismissed) return null

  // Don't render if showBanner is false (for inline notices)
  if (!info.showBanner && prominence === "banner") return null

  const daysRemaining = getDaysUntilSunset(info.featureId)
  const urgency = getUrgencyLevel(daysRemaining)

  const handleDismiss = () => {
    if (dismissible && info) {
      const dismissKey = `deprecation-dismissed-${info.featureId}`
      localStorage.setItem(dismissKey, "true")
      setIsDismissed(true)
      onDismiss?.()
    }
  }

  const displayTitle =
    title ??
    `${info.featureName} is ${info.phase === "sunset" ? "no longer available" : "deprecated"}`
  const displayDescription = description ?? info.reason

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(deprecationNoticeVariants({ urgency, prominence }), className)}
      {...props}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          {urgency === "high" ? (
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Clock className="h-5 w-5" aria-hidden="true" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm">{displayTitle}</h4>

          <p className="mt-1 text-sm opacity-90">{displayDescription}</p>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            {!hideSunsetDate && daysRemaining !== null && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" aria-hidden="true" />
                <span>Sunset: {info.sunsetDate}</span>
                <span className="font-medium">({formatDaysRemaining(daysRemaining)})</span>
              </span>
            )}

            {!hideMigration && info.migrationTarget && (
              <a
                href={info.migrationDocsUrl ?? "#"}
                className="flex items-center gap-1 underline hover:no-underline"
              >
                <span>Migrate to {info.migrationTarget}</span>
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </a>
            )}

            {info.issueLink && (
              <a
                href={info.issueLink}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:no-underline"
              >
                View issue
              </a>
            )}
          </div>
        </div>

        {dismissible && (
          <button
            type="button"
            onClick={handleDismiss}
            className="flex-shrink-0 rounded-md p-1 hover:bg-black/10 dark:hover:bg-surface/10 transition-colors"
            aria-label="Dismiss deprecation notice"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * DeprecationBanner - Full-width banner variant for page-level notices
 */
export function DeprecationBanner(props: Omit<DeprecationNoticeProps, "prominence">) {
  return <DeprecationNotice prominence="banner" {...props} />
}

/**
 * InlineDeprecationNotice - Compact variant for inline usage
 */
export function InlineDeprecationNotice(props: Omit<DeprecationNoticeProps, "prominence">) {
  return <DeprecationNotice prominence="inline" dismissible={false} {...props} />
}
