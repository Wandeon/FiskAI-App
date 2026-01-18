"use client"

import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

export type PausalniOnboardingStep = 1 | 2 | 3

interface StepInfo {
  number: PausalniOnboardingStep
  title: string
  question: string
}

const STEPS: StepInfo[] = [
  { number: 1, title: "Identitet", question: "Tko ste?" },
  { number: 2, title: "Situacija", question: "Vaša situacija" },
  { number: 3, title: "Postavljanje", question: "Postavite svoj obrt" },
]

interface StepIndicatorProps {
  currentStep: PausalniOnboardingStep
  completedSteps?: PausalniOnboardingStep[]
  onStepClick?: (step: PausalniOnboardingStep) => void
}

/**
 * Step indicator for pausalni obrt onboarding flow (3 steps)
 * Displays "Korak X od 3: [Question]" format
 */
export function StepIndicator({
  currentStep,
  completedSteps = [],
  onStepClick,
}: StepIndicatorProps) {
  const currentStepInfo = STEPS.find((s) => s.number === currentStep)

  return (
    <div className="mb-8">
      {/* Title: "Korak X od 3: Question" */}
      <h2 className="text-heading-lg text-foreground mb-4">
        Korak {currentStep} od 3: {currentStepInfo?.question}
      </h2>

      {/* Progress bar */}
      <div className="flex items-center gap-1">
        {STEPS.map((step, index) => {
          const isComplete = completedSteps.includes(step.number)
          const isCurrent = step.number === currentStep
          const isPast = step.number < currentStep
          const canClick = onStepClick && (isPast || isComplete)

          return (
            <div key={step.number} className="flex flex-1 items-center">
              {/* Step segment */}
              <button
                type="button"
                onClick={() => canClick && onStepClick?.(step.number)}
                disabled={!canClick}
                className={cn(
                  "h-2 flex-1 rounded-full transition-colors",
                  isCurrent && "bg-interactive",
                  isPast || isComplete ? "bg-success" : "",
                  !isCurrent && !isPast && !isComplete && "bg-surface-2",
                  canClick && "cursor-pointer hover:opacity-80",
                  !canClick && "cursor-default"
                )}
                aria-label={`Korak ${step.number}: ${step.title}`}
                aria-current={isCurrent ? "step" : undefined}
              />

              {/* Connector */}
              {index < STEPS.length - 1 && <div className="w-1" />}
            </div>
          )
        })}
      </div>

      {/* Step labels */}
      <div className="flex justify-between mt-2">
        {STEPS.map((step) => {
          const isComplete = completedSteps.includes(step.number)
          const isCurrent = step.number === currentStep
          const isPast = step.number < currentStep

          return (
            <div key={step.number} className="flex items-center gap-1 text-xs">
              {(isPast || isComplete) && (
                <Check className="h-3 w-3 text-success" aria-hidden="true" />
              )}
              <span
                className={cn(
                  "font-medium",
                  isCurrent && "text-foreground",
                  (isPast || isComplete) && "text-success-text",
                  !isCurrent && !isPast && !isComplete && "text-muted"
                )}
              >
                {step.title}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
