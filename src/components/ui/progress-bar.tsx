import { cn } from "@/lib/utils"
import { getProgressAriaLabel } from "@/lib/a11y"

interface ProgressBarProps {
  value: number // 0-100
  size?: "sm" | "md" | "lg"
  variant?: "default" | "success" | "warning" | "danger"
  showLabel?: boolean
  className?: string
  /** Current count for aria-label (e.g., completed tasks) */
  current?: number
  /** Total count for aria-label (e.g., total tasks) */
  total?: number
  /** Custom aria-label override */
  "aria-label"?: string
}

const sizeClasses = {
  sm: "h-1",
  md: "h-2",
  lg: "h-3",
}

const variantClasses = {
  default: "bg-brand-500",
  success: "bg-success-500",
  warning: "bg-warning-500",
  danger: "bg-danger-500",
}

export function ProgressBar({
  value,
  size = "md",
  variant = "default",
  showLabel = false,
  className,
  current,
  total,
  "aria-label": ariaLabelProp,
}: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value))

  // Generate aria-label: use prop, or generate from current/total, or use percentage
  const ariaLabel =
    ariaLabelProp ??
    (current !== undefined && total !== undefined
      ? getProgressAriaLabel(current, total, "hr")
      : `Napredak: ${Math.round(clampedValue)} posto`)

  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="flex justify-between text-sm mb-1">
          <span className="text-[var(--muted)]">Napredak</span>
          <span className="font-medium text-[var(--foreground)]">{Math.round(clampedValue)}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clampedValue)}
        aria-label={ariaLabel}
        className={cn(
          "w-full overflow-hidden rounded-full bg-[var(--surface-secondary)]",
          sizeClasses[size]
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            variantClasses[variant]
          )}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  )
}

interface ProgressStepsProps {
  steps: string[]
  currentStep: number
  className?: string
}

export function ProgressSteps({ steps, currentStep, className }: ProgressStepsProps) {
  return (
    <nav
      aria-label={`Korak ${currentStep + 1} od ${steps.length}`}
      className={cn("flex items-center gap-2", className)}
    >
      <ol className="flex items-center gap-2" role="list">
        {steps.map((step, index) => {
          const stepStatus =
            index < currentStep
              ? "završeno"
              : index === currentStep
                ? "trenutni korak"
                : "predstoji"
          return (
            <li key={step} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors",
                  index < currentStep && "bg-success-500 text-white",
                  index === currentStep && "bg-brand-500 text-white",
                  index > currentStep && "bg-[var(--surface-secondary)] text-[var(--muted)]"
                )}
                aria-current={index === currentStep ? "step" : undefined}
                aria-label={`Korak ${index + 1}: ${step}, ${stepStatus}`}
              >
                <span aria-hidden="true">{index < currentStep ? "✓" : index + 1}</span>
              </div>
              <span
                className={cn(
                  "text-sm",
                  index <= currentStep ? "text-[var(--foreground)]" : "text-[var(--muted)]"
                )}
                aria-hidden="true"
              >
                {step}
              </span>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 w-8",
                    index < currentStep ? "bg-success-500" : "bg-[var(--surface-secondary)]"
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
