import { cva, type VariantProps } from "class-variance-authority"
import { HTMLAttributes, forwardRef, ReactNode } from "react"
import { cn } from "@/lib/utils"

export const badgeVariants = cva("inline-flex items-center gap-1.5 font-medium transition-colors", {
  variants: {
    variant: {
      tech: "border border-cyan-400/30 bg-cyan-500/10 text-cyan-300",
      category: "bg-blue-500/90 text-white",
      subtle: "bg-white/10 text-white/70",
      success: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
      warning: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
      danger: "bg-red-500/10 text-red-400 border border-red-500/30",
    },
    size: {
      sm: "px-2 py-0.5 text-xs rounded-md",
      default: "px-3 py-1 text-sm rounded-full",
      lg: "px-4 py-1.5 text-sm rounded-full",
    },
  },
  defaultVariants: {
    variant: "subtle",
    size: "default",
  },
})

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  icon?: ReactNode
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, icon, children, ...props }, ref) => {
    return (
      <span ref={ref} className={cn(badgeVariants({ variant, size }), className)} {...props}>
        {icon}
        {children}
      </span>
    )
  }
)

Badge.displayName = "Badge"

export { Badge }
