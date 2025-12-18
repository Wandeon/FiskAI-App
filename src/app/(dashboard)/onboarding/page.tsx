// src/app/(dashboard)/onboarding/page.tsx
"use client"

import { useOnboardingStore } from "@/lib/stores/onboarding-store"
import { StepIndicator } from "@/components/onboarding/step-indicator"
import { StepBasicInfo } from "@/components/onboarding/step-basic-info"
import { StepCompetence } from "@/components/onboarding/step-competence"
import { StepAddress } from "@/components/onboarding/step-address"
import { StepContactTax } from "@/components/onboarding/step-contact-tax"
import { Card, CardContent } from "@/components/ui/card"

export default function OnboardingPage() {
  const { currentStep, isStepValid } = useOnboardingStore()

  return (
    <div className="mx-auto max-w-xl py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Dobrodošli u FiskAI</h1>
        <p className="mt-2 text-gray-600">Postavite svoju tvrtku u 4 jednostavna koraka</p>
      </div>

      <StepIndicator currentStep={currentStep} isStepValid={isStepValid} />

      <Card>
        <CardContent className="pt-6">
          {currentStep === 1 && <StepBasicInfo />}
          {currentStep === 2 && <StepCompetence />}
          {currentStep === 3 && <StepAddress />}
          {currentStep === 4 && <StepContactTax />}
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-xs text-gray-500">
        Vaši podaci se automatski spremaju tijekom unosa
      </p>
    </div>
  )
}
