import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { ReactNode } from "react"

interface MobileCardProps {
  href?: string
  onClick?: () => void
  title: string
  subtitle?: string
  icon?: ReactNode
  badge?: ReactNode
  value?: string | ReactNode
  className?: string
}

export function MobileCard({
  href,
  onClick,
  title,
  subtitle,
  icon,
  badge,
  value,
  className,
}: MobileCardProps) {
  const content = (
    <div className={cn(
      "flex items-center gap-4 p-4 bg-[var(--surface)] border-b border-[var(--border)] touch-target",
      (href || onClick) && "active:bg-[var(--surface-secondary)]",
      className
    )}>
      {icon && (
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600">
          {icon}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-[var(--foreground)] truncate">{title}</p>
          {badge}
        </div>
        {subtitle && (
          <p className="text-sm text-[var(--muted)] truncate">{subtitle}</p>
        )}
      </div>

      {value && (
        <div className="flex-shrink-0 text-right">
          {typeof value === 'string' ? (
            <p className="font-semibold text-[var(--foreground)]">{value}</p>
          ) : (
            value
          )}
        </div>
      )}

      {(href || onClick) && (
        <ChevronRight className="h-5 w-5 flex-shrink-0 text-[var(--muted)]" />
      )}
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  if (onClick) {
    return <button onClick={onClick} className="w-full text-left">{content}</button>
  }

  return content
}
