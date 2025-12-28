import { cn } from "@/lib/utils"
import { type LucideIcon } from "lucide-react"

interface IconBadgeProps {
  /** Lucide icon component */
  icon: LucideIcon
  /** Size variant */
  size?: "sm" | "default" | "lg"
  /** Visual variant using semantic tokens */
  variant?: "accent" | "success" | "warning" | "danger" | "info"
  /** Additional classes */
  className?: string
}

const sizeClasses = {
  sm: "h-8 w-8 rounded-lg",
  default: "h-12 w-12 rounded-xl",
  lg: "h-16 w-16 rounded-2xl",
}

const iconSizeClasses = {
  sm: "h-4 w-4",
  default: "h-6 w-6",
  lg: "h-8 w-8",
}

// Using semantic token CSS variables for theming
const variantClasses = {
  accent: "bg-accent/10 text-accent",
  success: "bg-success-bg text-success-icon",
  warning: "bg-warning-bg text-warning-icon",
  danger: "bg-danger-bg text-danger-icon",
  info: "bg-info-bg text-info-icon",
}

/**
 * IconBadge: Icon in a colored circle pattern.
 *
 * Uses semantic status tokens for consistent theming.
 */
export function IconBadge({
  icon: Icon,
  size = "default",
  variant = "accent",
  className,
}: IconBadgeProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center",
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
    >
      <Icon className={iconSizeClasses[size]} />
    </div>
  )
}
