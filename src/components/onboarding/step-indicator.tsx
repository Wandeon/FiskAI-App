// src/components/onboarding/step-indicator.tsx
"use client"

import { cn } from "@/lib/utils"
import { OnboardingStep } from "@/lib/stores/onboarding-store"

const steps = [
  { number: 1, title: "Osnovni podaci" },
  { number: 2, title: "Razina iskustva" },
  { number: 3, title: "Adresa" },
  { number: 4, title: "Kontakt i porez" },
] as const

interface StepIndicatorProps {
  currentStep: OnboardingStep
  isStepValid: (step: OnboardingStep) => boolean
}

export function StepIndicator({ currentStep, isStepValid }: StepIndicatorProps) {
  return (
    <nav aria-label="Napredak" className="mb-8">
      <ol className="flex items-center justify-center gap-2">
        {steps.map((step, index) => {
          const isActive = step.number === currentStep
          const isPast = step.number < currentStep
          const isCompleted = isPast || isStepValid(step.number as OnboardingStep)

          return (
            <li key={step.number} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors",
                    isActive && "border-blue-600 bg-blue-600 text-white",
                    isPast && "border-green-600 bg-green-600 text-white",
                    !isActive && !isPast && "border-gray-300 bg-white text-gray-500"
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
                </div>
                <span
                  className={cn(
                    "mt-2 text-xs font-medium",
                    isActive ? "text-blue-600" : "text-gray-500"
                  )}
                >
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={cn("mx-4 h-0.5 w-12", isPast ? "bg-green-600" : "bg-gray-200")} />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
