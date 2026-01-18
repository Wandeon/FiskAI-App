"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { OnboardingStep2Situation, type Step2FormData } from "@/components/patterns/onboarding"

/**
 * Pausalni Obrt Onboarding - Step 2: Situation
 *
 * This is the second step of the 3-step pausalni obrt onboarding flow:
 * 1. Identity - Who are you? (OIB, name, address, founding date)
 * 2. Situation - Your obligations (employment, VAT, cash, income)
 * 3. Setup - Configure capabilities (fiscalization cert, IBAN, logo)
 *
 * This step determines the user's legal obligations based on 4 questions:
 * - Employment status (contribution obligations)
 * - Cash/card acceptance (fiscalization obligation)
 * - VAT status (quarterly returns)
 * - Expected income range (limit tracking urgency)
 */
export default function PausalniOnboardingStep2Page() {
  const router = useRouter()
  const [formData, setFormData] = useState<Partial<Step2FormData>>({})

  // Handle step 2 completion
  const handleStep2Next = useCallback(
    (data: Step2FormData) => {
      setFormData(data)
      // TODO: Save to server/store
      console.log("Step 2 completed:", data)

      // Navigate to step 3
      router.push("/pausalni/onboarding/step-3")
    },
    [router]
  )

  // Handle back navigation
  const handleBack = useCallback(() => {
    // Navigate back to step 1
    router.push("/pausalni/onboarding")
  }, [router])

  return (
    <OnboardingStep2Situation initialData={formData} onNext={handleStep2Next} onBack={handleBack} />
  )
}
