"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { OnboardingStep1Identity, type Step1FormData } from "@/components/patterns/onboarding"

/**
 * Pausalni Obrt Onboarding - Step 1: Identity
 *
 * This is the first step of the 3-step pausalni obrt onboarding flow:
 * 1. Identity - Who are you? (OIB, name, address, founding date)
 * 2. Situation - Your obligations (employment, VAT, cash, income)
 * 3. Setup - Configure capabilities (fiscalization cert, IBAN, logo)
 */
export default function PausalniOnboardingPage() {
  const router = useRouter()
  const [formData, setFormData] = useState<Partial<Step1FormData>>({})

  // Handle step 1 completion
  const handleStep1Next = useCallback(
    (data: Step1FormData) => {
      setFormData(data)
      // TODO: Save to server/store
      console.log("Step 1 completed:", data)

      // Navigate to step 2
      router.push("/pausalni/onboarding/step-2")
    },
    [router]
  )

  // Handle back navigation
  const handleBack = useCallback(() => {
    // Step 1 has no back - this is the first step
    // This would typically go to a welcome/intro page
    router.push("/pausalni")
  }, [router])

  return (
    <OnboardingStep1Identity
      initialData={formData}
      onNext={handleStep1Next}
      onBack={handleBack}
      isFirstStep={true}
    />
  )
}
