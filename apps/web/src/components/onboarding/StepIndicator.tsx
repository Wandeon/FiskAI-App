"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface StepIndicatorProps {
  currentStep: number
  totalSteps: number
}

const STEP_LABELS = ["Tvrtka", "Porez", "Kontakt", "Pregled"]

export function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  return (
    <div className="mb-8 w-full">
      <div className="flex items-center justify-center">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => {
          const isCompleted = step < currentStep
          const isCurrent = step === currentStep
          const isFuture = step > currentStep

          return (
            <div key={step} className="flex items-center">
              {/* Step circle */}
              <div className="flex flex-col items-center">
                {isCompleted && (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500">
                    <Check className="h-5 w-5 text-white" />
                  </div>
                )}

                {isCurrent && (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500 ring-4 ring-cyan-500/30">
                    <span className="font-bold text-white">{step}</span>
                  </div>
                )}

                {isFuture && (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                    <span className="text-white/40">{step}</span>
                  </div>
                )}

                {/* Step label */}
                <span
                  className={cn(
                    "mt-2 text-xs font-medium sm:text-sm",
                    "hidden sm:block",
                    isCompleted && "text-green-400",
                    isCurrent && "text-cyan-400",
                    isFuture && "text-white/40"
                  )}
                >
                  {STEP_LABELS[step - 1]}
                </span>
              </div>

              {/* Connector line */}
              {step < totalSteps && (
                <div
                  className={cn(
                    "mx-2 h-0.5 w-8 sm:mx-4 sm:w-12",
                    step < currentStep ? "bg-green-500" : "bg-white/20"
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Mobile step label (shown only on small screens) */}
      <div className="mt-4 text-center sm:hidden">
        <span className="text-sm font-medium text-cyan-400">
          {STEP_LABELS[currentStep - 1]}
        </span>
        <span className="ml-2 text-sm text-white/40">
          ({currentStep}/{totalSteps})
        </span>
      </div>
    </div>
  )
}

export default StepIndicator
