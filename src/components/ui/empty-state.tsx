import { cn } from "@/lib/utils"
import { ReactNode } from "react"

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center py-12 px-4 text-center", className)}
      role="status"
      aria-label={`${title}${description ? ': ' + description : ''}`}
    >
      {icon && (
        <div className="mb-4 rounded-full bg-[var(--surface-secondary)] p-4 text-[var(--muted)]" aria-hidden="true">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-[var(--foreground)]">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-sm text-[var(--muted)]">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
