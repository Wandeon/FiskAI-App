// src/components/onboarding/step-indicator.tsx
"use client"

import { cn } from "@/lib/utils"
import { OnboardingStep, useOnboardingStore } from "@/lib/stores/onboarding-store"

const baseSteps = [
  { number: 1, title: "Osnovni podaci" },
  { number: 2, title: "Razina iskustva" },
  { number: 3, title: "Adresa" },
  { number: 4, title: "Kontakt i porez" },
] as const

const pausalniStep = { number: 5, title: "Paušalni profil" } as const
const billingStep = { number: 6, title: "Plan i naplata" } as const

interface StepIndicatorProps {
  currentStep: OnboardingStep
  isStepValid: (step: OnboardingStep) => boolean
}

export function StepIndicator({ currentStep, isStepValid }: StepIndicatorProps) {
  const { data, setStep } = useOnboardingStore()

  // Show 6 steps for OBRT_PAUSAL (includes Paušalni profile), 5 steps for others
  const isPausalniObrt = data.legalForm === "OBRT_PAUSAL"
  const steps = isPausalniObrt
    ? [...baseSteps, pausalniStep, billingStep]
    : [...baseSteps, billingStep]

  const handleStepClick = (stepNumber: number) => {
    // Allow navigating to any step that:
    // 1. Is before the current step (going back)
    // 2. Is the current step
    // 3. Is a completed step
    // 4. Is the next step if current step is valid
    const canNavigate =
      stepNumber <= currentStep ||
      isStepValid(stepNumber as OnboardingStep) ||
      (stepNumber === currentStep + 1 && isStepValid(currentStep))

    if (canNavigate) {
      setStep(stepNumber as OnboardingStep)
    }
  }

  return (
    <nav aria-label="Napredak" className="mb-8">
      <ol className="flex items-center justify-center gap-2">
        {steps.map((step, index) => {
          const isActive = step.number === currentStep
          const isPast = step.number < currentStep
          const isCompleted = isPast || isStepValid(step.number as OnboardingStep)
          const canClick =
            step.number <= currentStep ||
            isCompleted ||
            (step.number === currentStep + 1 && isStepValid(currentStep))

          return (
            <li key={step.number} className="flex items-center">
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => handleStepClick(step.number)}
                  disabled={!canClick}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors",
                    isActive && "border-focus bg-interactive text-white",
                    isPast && "border-green-600 bg-green-600 text-white",
                    !isActive && !isPast && "border-default bg-white text-tertiary",
                    canClick && !isActive && "cursor-pointer hover:border-blue-400",
                    !canClick && "cursor-not-allowed opacity-50"
                  )}
                  aria-current={isActive ? "step" : undefined}
                >
                  {isCompleted && !isActive ? (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    step.number
                  )}
                </button>
                <span
                  className={cn(
                    "mt-2 text-xs font-medium",
                    isActive ? "text-link" : "text-tertiary"
                  )}
                >
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={cn("mx-4 h-0.5 w-12", isPast ? "bg-green-600" : "bg-surface-2")} />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
