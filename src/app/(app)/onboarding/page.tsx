// src/app/(app)/onboarding/page.tsx
"use client"

import { useEffect, useState } from "react"
import { useOnboardingStore, type OnboardingStep } from "@/lib/stores/onboarding-store"
import { StepIndicator } from "@/components/onboarding/step-indicator"
import { StepBasicInfo } from "@/components/onboarding/step-basic-info"
import { StepCompetence } from "@/components/onboarding/step-competence"
import { StepAddress } from "@/components/onboarding/step-address"
import { StepContactTax } from "@/components/onboarding/step-contact-tax"
import { StepPausalniProfile } from "@/components/onboarding/step-pausalni-profile"
import { Card, CardContent } from "@/components/ui/card"
import { getOnboardingData, type OnboardingData } from "@/app/actions/onboarding"
import { Loader2 } from "lucide-react"

/**
 * Calculate which onboarding step should be shown based on completion
 * Returns 1-5 for first incomplete step, or 6 if all complete (treated as 5 for display)
 */
function calculateOnboardingStep(data: OnboardingData | null): 1 | 2 | 3 | 4 | 5 | 6 {
  if (!data) return 1

  // Step 1: Basic Info (name, oib, legalForm)
  const step1Complete = !!(data.name?.trim() && data.oib?.match(/^\d{11}$/) && data.legalForm)
  if (!step1Complete) return 1

  // Step 2: Competence Level
  const step2Complete = !!data.competence
  if (!step2Complete) return 2

  // Step 3: Address
  const step3Complete = !!(
    data.address?.trim() &&
    data.postalCode?.trim() &&
    data.city?.trim() &&
    data.country?.trim()
  )
  if (!step3Complete) return 3

  // Step 4: Contact & Tax (email and iban required)
  const step4Complete = !!(data.email?.includes("@") && data.iban?.trim())
  if (!step4Complete) return 4

  // Step 5: Paušalni Profile (only for OBRT_PAUSAL)
  // Note: Paušalni fields are stored in the client store, not in server data
  // So for OBRT_PAUSAL, return 5 to let them complete the paušalni profile step
  if (data.legalForm === "OBRT_PAUSAL") {
    return 5
  }

  // All complete
  return 6
}

export default function OnboardingPage() {
  const { currentStep, isStepValid, hydrate, data } = useOnboardingStore()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadExistingData() {
      try {
        const serverData = await getOnboardingData()

        if (serverData) {
          // Calculate which step to start on based on completion
          const calculatedStep = calculateOnboardingStep(serverData)
          // If all steps complete (6), show last step for review
          // For OBRT_PAUSAL, last step is 5; for others, it's 4
          let startStep: OnboardingStep
          if (calculatedStep >= 6) {
            startStep = serverData.legalForm === "OBRT_PAUSAL" ? 5 : 4
          } else {
            startStep = calculatedStep as OnboardingStep
          }

          // Hydrate store with server data and correct starting step
          hydrate(
            {
              name: serverData.name || undefined,
              oib: serverData.oib || undefined,
              legalForm: serverData.legalForm || undefined,
              competence: serverData.competence || undefined,
              address: serverData.address || undefined,
              postalCode: serverData.postalCode || undefined,
              city: serverData.city || undefined,
              country: serverData.country || "HR",
              email: serverData.email || undefined,
              phone: serverData.phone || undefined,
              iban: serverData.iban || undefined,
              isVatPayer: serverData.isVatPayer ?? false,
            },
            startStep
          )
        }
      } catch (error) {
        console.error("Failed to load onboarding data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadExistingData()
  }, [hydrate])

  if (isLoading) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <div className="flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
          <p className="text-sm text-gray-500">Učitavanje podataka...</p>
        </div>
      </div>
    )
  }

  const stepCount = data.legalForm === "OBRT_PAUSAL" ? 5 : 4

  return (
    <div className="mx-auto max-w-xl py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Dobrodošli u FiskAI</h1>
        <p className="mt-2 text-gray-600">
          Postavite svoju tvrtku u {stepCount} jednostavna koraka
        </p>
      </div>

      <StepIndicator currentStep={currentStep} isStepValid={isStepValid} />

      <Card>
        <CardContent className="pt-6">
          {currentStep === 1 && <StepBasicInfo />}
          {currentStep === 2 && <StepCompetence />}
          {currentStep === 3 && <StepAddress />}
          {currentStep === 4 && <StepContactTax />}
          {currentStep === 5 && <StepPausalniProfile />}
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-xs text-gray-500">
        Vaši podaci se automatski spremaju tijekom unosa
      </p>
    </div>
  )
}
