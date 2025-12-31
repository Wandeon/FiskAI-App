import { cn } from "@/lib/utils"
import { ReactNode } from "react"

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon?: ReactNode
  trend?: {
    value: number
    label: string
  }
  className?: string
}

export function StatCard({ title, value, description, icon, trend, className }: StatCardProps) {
  const isPositiveTrend = trend && trend.value >= 0

  return (
    <div className={cn("card p-6", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--muted)]">{title}</p>
          <p className="mt-2 text-3xl font-bold text-[var(--foreground)]">
            {typeof value === "number" ? value.toLocaleString("hr-HR") : value}
          </p>
          {description && <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>}
          {trend && (
            <div className="mt-2 flex items-center gap-1">
              <span
                className={cn(
                  "text-sm font-medium",
                  isPositiveTrend ? "text-success-600" : "text-danger-600"
                )}
              >
                {isPositiveTrend ? "+" : ""}
                {trend.value}%
              </span>
              <span className="text-sm text-[var(--muted)]">{trend.label}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="rounded-lg bg-brand-50 p-3 text-brand-600" aria-hidden="true">
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
