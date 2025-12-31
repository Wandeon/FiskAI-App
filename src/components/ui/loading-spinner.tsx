import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg"
  className?: string
  /**
   * Accessible label describing what is loading.
   * Announced to screen readers.
   */
  label?: string
}

const sizes = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
}

export function LoadingSpinner({
  size = "md",
  className,
  label = "Učitavanje",
}: LoadingSpinnerProps) {
  return (
    <Loader2
      className={cn("animate-spin text-brand-600", sizes[size], className)}
      role="status"
      aria-label={label}
    />
  )
}

interface LoadingOverlayProps {
  message?: string
  className?: string
}

export function LoadingOverlay({ message = "Učitavanje...", className }: LoadingOverlayProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center bg-[var(--surface)]/80 backdrop-blur-sm z-10",
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <LoadingSpinner size="lg" label={message} />
      {message && (
        <p className="mt-3 text-sm font-medium text-[var(--muted)]" aria-hidden="true">
          {message}
        </p>
      )}
    </div>
  )
}

interface LoadingDotsProps {
  className?: string
  label?: string
}

export function LoadingDots({ className, label = "Učitavanje" }: LoadingDotsProps) {
  return (
    <span className={cn("inline-flex gap-1", className)} role="status" aria-label={label}>
      <span
        className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.3s]"
        aria-hidden="true"
      />
      <span
        className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.15s]"
        aria-hidden="true"
      />
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" aria-hidden="true" />
    </span>
  )
}
