"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { OnboardingStep3Setup, type Step3FormData } from "@/components/patterns/onboarding"

/**
 * Pausalni Obrt Onboarding - Step 3: Setup Checklist
 *
 * This is the third and final step of the 3-step pausalni obrt onboarding flow:
 * 1. Identity - Who are you? (OIB, name, address, founding date)
 * 2. Situation - Your obligations (employment, VAT, cash, income)
 * 3. Setup - Configure capabilities (fiscalization cert, IBAN, logo)
 *
 * This step dynamically generates a checklist based on Step 2 answers:
 * - Required items: Fiscalization (if accepts cash), IBAN (always)
 * - Optional items: Logo, Bank connection
 */
export default function PausalniOnboardingStep3Page() {
  const router = useRouter()

  // Get Step 2 data from session storage or default
  // In a real app, this would come from a global store or server state
  const [situation, setSituation] = useState<{ acceptsCash: boolean }>({
    acceptsCash: true, // Default to true for demo purposes
  })

  // Load Step 2 data on mount
  useEffect(() => {
    // Try to load from session storage (set by Step 2 page)
    if (typeof window !== "undefined") {
      const step2Data = sessionStorage.getItem("onboarding-step2")
      if (step2Data) {
        try {
          const parsed = JSON.parse(step2Data)
          setSituation({
            acceptsCash: parsed.acceptsCash ?? true,
          })
        } catch {
          // Use default if parsing fails
        }
      }
    }
  }, [])

  // Handle step 3 completion
  const handleComplete = useCallback(
    (data: Step3FormData) => {
      // TODO: Save to server/store
      console.log("Step 3 completed:", data)

      // Clear session storage
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("onboarding-step2")
      }

      // Navigate to dashboard
      router.push("/pausalni")
    },
    [router]
  )

  // Handle back navigation
  const handleBack = useCallback(() => {
    // Navigate back to step 2
    router.push("/pausalni/onboarding/step-2")
  }, [router])

  return (
    <OnboardingStep3Setup situation={situation} onBack={handleBack} onComplete={handleComplete} />
  )
}
