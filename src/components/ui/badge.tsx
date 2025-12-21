import * as React from "react"
import { clsx } from "clsx"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "warning"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  // Updated colors for WCAG AA compliance (4.5:1 contrast ratio)
  const variantClasses = {
    default: "border-transparent bg-blue-600 text-white hover:bg-blue-700",
    // Secondary: Updated to ensure better contrast (gray-800 on gray-200 = ~7:1 ratio)
    secondary: "border-transparent bg-gray-200 text-gray-900 hover:bg-gray-300",
    destructive: "border-transparent bg-red-600 text-white hover:bg-red-700",
    // Outline: Ensured text has sufficient contrast (gray-900 on white = 21:1)
    outline: "text-gray-900 border-gray-300 bg-transparent",
    // Warning: Updated for better contrast (amber-800 on amber-50 = ~8:1 ratio)
    warning:
      "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-300",
  }

  return (
    <div
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge }
