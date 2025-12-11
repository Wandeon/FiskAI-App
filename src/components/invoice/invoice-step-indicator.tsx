import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface Step {
  id: string
  name: string
}

interface StepIndicatorProps {
  steps: Step[]
  currentStep: number
  onStepClick?: (index: number) => void
}

export function StepIndicator({ steps, currentStep, onStepClick }: StepIndicatorProps) {
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex items-center">
        {steps.map((step, index) => {
          const isComplete = index < currentStep
          const isCurrent = index === currentStep
          const isClickable = onStepClick && index <= currentStep

          return (
            <li key={step.id} className={cn("relative", index !== steps.length - 1 && "flex-1")}>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => isClickable && onStepClick?.(index)}
                  disabled={!isClickable}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-colors",
                    isComplete && "bg-brand-600 text-white",
                    isCurrent && "border-2 border-brand-600 bg-brand-50 text-brand-700",
                    !isComplete && !isCurrent && "border-2 border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]",
                    isClickable && "cursor-pointer hover:bg-brand-100"
                  )}
                >
                  {isComplete ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </button>

                {/* Connector line */}
                {index !== steps.length - 1 && (
                  <div className={cn(
                    "mx-2 h-0.5 flex-1",
                    isComplete ? "bg-brand-600" : "bg-[var(--border)]"
                  )} />
                )}
              </div>

              {/* Step label */}
              <p className={cn(
                "absolute -bottom-6 left-0 w-full text-center text-xs font-medium",
                isCurrent ? "text-brand-700" : isComplete ? "text-brand-600" : "text-[var(--muted)]"
              )}>
                {step.name}
              </p>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
