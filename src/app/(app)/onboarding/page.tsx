// src/app/(app)/onboarding/page.tsx
"use client"

import { useEffect, useState } from "react"
import { useOnboardingStore, type OnboardingStep } from "@/lib/stores/onboarding-store"
import { useVisitorStore } from "@/stores/visitor-store"
import { mapWizardToOnboarding, hasValidWizardData } from "@/lib/knowledge-hub/wizard-to-onboarding"
import { StepIndicator } from "@/components/onboarding/step-indicator"
import { StepBasicInfo } from "@/components/onboarding/step-basic-info"
import { StepCompetence } from "@/components/onboarding/step-competence"
import { StepAddress } from "@/components/onboarding/step-address"
import { StepContactTax } from "@/components/onboarding/step-contact-tax"
import { StepPausalniProfile } from "@/components/onboarding/step-pausalni-profile"
import { StepBilling } from "@/components/onboarding/step-billing"
import { Card, CardContent } from "@/components/ui/card"
import { getOnboardingData, type OnboardingData } from "@/app/actions/onboarding"
import { Loader2 } from "lucide-react"

/**
 * Calculate which onboarding step should be shown based on completion
 * Returns 1-6 for first incomplete step, or 7 if all complete (treated as 6 for display)
 *
 * REQUIRED steps:
 * - Step 1: Basic Info (name, OIB, legal form)
 *
 * OPTIONAL steps (can be skipped):
 * - Step 2: Competence Level
 * - Step 3: Address
 * - Step 4: Contact & Tax (only email is required, IBAN and phone are optional)
 * - Step 5: Paušalni Profile (only for OBRT_PAUSAL)
 * - Step 6: Billing (informational only)
 */
function calculateOnboardingStep(data: OnboardingData | null): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  if (!data) return 1

  // Step 1: Basic Info (name, oib, legalForm) - REQUIRED
  const step1Complete = !!(data.name?.trim() && data.oib?.match(/^\d{11}$/) && data.legalForm)
  if (!step1Complete) return 1

  // After step 1, check if user has completed minimum required data for dashboard access
  // Minimum: Step 1 (basic info) - that's it! Everything else is optional

  // If user has email, they've likely completed the flow - go to billing
  if (data.email?.includes("@") && data.legalForm !== "OBRT_PAUSAL") {
    return 6 // Go to billing step
  }

  // Otherwise, continue with normal flow

  // Step 2: Competence Level - OPTIONAL
  const step2Complete = !!data.competence
  if (!step2Complete) return 2

  // Step 3: Address - OPTIONAL
  const step3Complete = !!(
    data.address?.trim() &&
    data.postalCode?.trim() &&
    data.city?.trim() &&
    data.country?.trim()
  )
  if (!step3Complete) return 3

  // Step 4: Contact & Tax (only email required, IBAN optional)
  const step4Complete = !!data.email?.includes("@")
  if (!step4Complete) return 4

  // Step 5: Paušalni Profile (only for OBRT_PAUSAL)
  // Note: Paušalni fields are stored in the client store, not in server data
  // So for OBRT_PAUSAL, return 5 to let them complete the paušalni profile step
  if (data.legalForm === "OBRT_PAUSAL") {
    return 5
  }

  // Step 6: Billing (always show after all core steps complete)
  return 6
}

export default function OnboardingPage() {
  const { currentStep, isStepValid, hydrate, data } = useOnboardingStore()
  const { wizardAnswers, setStage } = useVisitorStore()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadExistingData() {
      try {
        const serverData = await getOnboardingData()

        // Check if we have wizard data to pre-fill
        const wizardData = hasValidWizardData(wizardAnswers)
          ? mapWizardToOnboarding(wizardAnswers)
          : {}

        if (serverData) {
          // Calculate which step to start on based on completion
          const calculatedStep = calculateOnboardingStep(serverData)
          // If all steps complete, show billing step (6)
          // Otherwise show the calculated step
          let startStep: OnboardingStep
          if (calculatedStep >= 7) {
            startStep = 6
          } else {
            startStep = calculatedStep as OnboardingStep
          }

          // Hydrate store with server data and correct starting step
          // Server data takes precedence over wizard data
          hydrate(
            {
              name: serverData.name || undefined,
              oib: serverData.oib || undefined,
              legalForm: serverData.legalForm || wizardData.legalForm || undefined,
              competence: serverData.competence || wizardData.competence || undefined,
              address: serverData.address || undefined,
              postalCode: serverData.postalCode || undefined,
              city: serverData.city || undefined,
              country: serverData.country || "HR",
              email: serverData.email || undefined,
              phone: serverData.phone || undefined,
              iban: serverData.iban || undefined,
              isVatPayer: serverData.isVatPayer ?? false,
              employedElsewhere:
                serverData.employedElsewhere ?? wizardData.employedElsewhere ?? false,
            },
            startStep
          )
        } else {
          // No server data - use wizard data as defaults
          hydrate(
            {
              legalForm: wizardData.legalForm || undefined,
              competence: wizardData.competence || undefined,
              country: "HR",
              isVatPayer: false,
              employedElsewhere: wizardData.employedElsewhere ?? false,
            },
            1
          )
        }

        // Update stage to onboarding
        setStage("onboarding")
      } catch (error) {
        console.error("Failed to load onboarding data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    void loadExistingData()
  }, [hydrate, wizardAnswers, setStage])

  if (isLoading) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <div className="flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
          <p className="text-sm text-tertiary">Učitavanje podataka...</p>
        </div>
      </div>
    )
  }

  const stepCount = data.legalForm === "OBRT_PAUSAL" ? 6 : 5

  return (
    <div className="mx-auto max-w-xl py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-foreground">Dobrodošli u FiskAI</h1>
        <p className="mt-2 text-secondary">
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
          {currentStep === 6 && <StepBilling />}
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-xs text-tertiary">
        Vaši podaci se automatski spremaju tijekom unosa
      </p>
    </div>
  )
}
