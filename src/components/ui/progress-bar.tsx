import { cn } from "@/lib/utils"

interface ProgressBarProps {
  value: number // 0-100
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'success' | 'warning' | 'danger'
  showLabel?: boolean
  className?: string
}

const sizeClasses = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
}

const variantClasses = {
  default: 'bg-brand-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
}

export function ProgressBar({
  value,
  size = 'md',
  variant = 'default',
  showLabel = false,
  className,
}: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value))

  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="flex justify-between text-sm mb-1">
          <span className="text-[var(--muted)]">Napredak</span>
          <span className="font-medium text-[var(--foreground)]">{Math.round(clampedValue)}%</span>
        </div>
      )}
      <div className={cn(
        "w-full overflow-hidden rounded-full bg-[var(--surface-secondary)]",
        sizeClasses[size]
      )}>
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
    <div className={cn("flex items-center gap-2", className)}>
      {steps.map((step, index) => (
        <div key={step} className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors",
              index < currentStep && "bg-success-500 text-white",
              index === currentStep && "bg-brand-500 text-white",
              index > currentStep && "bg-[var(--surface-secondary)] text-[var(--muted)]"
            )}
          >
            {index < currentStep ? "✓" : index + 1}
          </div>
          <span
            className={cn(
              "text-sm",
              index <= currentStep ? "text-[var(--foreground)]" : "text-[var(--muted)]"
            )}
          >
            {step}
          </span>
          {index < steps.length - 1 && (
            <div
              className={cn(
                "h-0.5 w-8",
                index < currentStep ? "bg-success-500" : "bg-[var(--surface-secondary)]"
              )}
            />
          )}
        </div>
      ))}
    </div>
  )
}
