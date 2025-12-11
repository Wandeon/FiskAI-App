import Link from "next/link"
import { AlertTriangle, AlertCircle, Info } from "lucide-react"
import { cn } from "@/lib/utils"

interface AlertBannerProps {
  type: 'error' | 'warning' | 'info'
  title: string
  description?: string
  action?: {
    label: string
    href: string
  }
  className?: string
}

export function AlertBanner({ type, title, description, action, className }: AlertBannerProps) {
  const styles = {
    error: {
      bg: "bg-danger-50 border-danger-200",
      icon: AlertTriangle,
      iconColor: "text-danger-500",
      title: "text-danger-800",
      desc: "text-danger-600",
      button: "bg-danger-600 hover:bg-danger-700",
    },
    warning: {
      bg: "bg-warning-50 border-warning-200",
      icon: AlertCircle,
      iconColor: "text-warning-500",
      title: "text-warning-800",
      desc: "text-warning-600",
      button: "bg-warning-600 hover:bg-warning-700",
    },
    info: {
      bg: "bg-brand-50 border-brand-200",
      icon: Info,
      iconColor: "text-brand-500",
      title: "text-brand-800",
      desc: "text-brand-600",
      button: "bg-brand-600 hover:bg-brand-700",
    },
  }

  const s = styles[type]
  const Icon = s.icon

  return (
    <div className={cn("flex items-center gap-4 rounded-card border p-4", s.bg, className)}>
      <Icon className={cn("h-5 w-5 flex-shrink-0", s.iconColor)} />
      <div className="flex-1 min-w-0">
        <p className={cn("font-medium", s.title)}>{title}</p>
        {description && <p className={cn("text-sm mt-0.5", s.desc)}>{description}</p>}
      </div>
      {action && (
        <Link
          href={action.href}
          className={cn("rounded-button px-4 py-2 text-sm font-medium text-white transition-colors flex-shrink-0", s.button)}
        >
          {action.label}
        </Link>
      )}
    </div>
  )
}
