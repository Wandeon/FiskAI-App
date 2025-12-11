import { cn } from "@/lib/utils"
import { ReactNode } from "react"

interface PageCardProps {
  children: ReactNode
  className?: string
}

interface PageCardHeaderProps {
  children: ReactNode
  className?: string
  actions?: ReactNode
}

interface PageCardContentProps {
  children: ReactNode
  className?: string
  noPadding?: boolean
}

interface PageCardFooterProps {
  children: ReactNode
  className?: string
}

export function PageCard({ children, className }: PageCardProps) {
  return (
    <div className={cn("card", className)}>
      {children}
    </div>
  )
}

export function PageCardHeader({ children, className, actions }: PageCardHeaderProps) {
  return (
    <div className={cn(
      "flex items-center justify-between px-6 py-4 border-b border-[var(--border)]",
      className
    )}>
      <div className="flex-1">{children}</div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function PageCardContent({ children, className, noPadding }: PageCardContentProps) {
  return (
    <div className={cn(
      !noPadding && "p-6",
      className
    )}>
      {children}
    </div>
  )
}

export function PageCardFooter({ children, className }: PageCardFooterProps) {
  return (
    <div className={cn(
      "flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border)] bg-[var(--surface-secondary)]",
      className
    )}>
      {children}
    </div>
  )
}

// Title component for card headers
export function PageCardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={cn("text-lg font-semibold text-[var(--foreground)]", className)}>
      {children}
    </h2>
  )
}

export function PageCardDescription({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-sm text-[var(--muted)] mt-1", className)}>
      {children}
    </p>
  )
}
