"use client"

import { useState, useCallback, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { OnboardingStep2Situation, type Step2FormData } from "@/components/patterns/onboarding"
import {
  savePausalniStep2,
  getPausalniOnboardingData,
  type Step2Data,
} from "@/app/actions/pausalni-onboarding"

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
  const [isPending, startTransition] = useTransition()
  const [formData, setFormData] = useState<Partial<Step2FormData>>({})
  const [error, setError] = useState<string | null>(null)

  // Load existing data on mount
  useEffect(() => {
    async function loadData() {
      const data = await getPausalniOnboardingData()
      if (data) {
        setFormData({
          employedElsewhere: data.employedElsewhere ?? null,
          acceptsCash: data.acceptsCash ?? null,
          isVatPayer: data.isVatPayer ?? null,
          expectedIncomeRange:
            (data.expectedIncomeRange as Step2FormData["expectedIncomeRange"]) ?? null,
        })
      }
    }
    void loadData()
  }, [])

  // Handle step 2 completion
  const handleStep2Next = useCallback(
    (data: Step2FormData) => {
      setError(null)
      startTransition(async () => {
        // Store in session for Step 3 to read (for acceptsCash determination)
        if (typeof window !== "undefined") {
          sessionStorage.setItem("onboarding-step2", JSON.stringify(data))
        }

        const result = await savePausalniStep2({
          employedElsewhere: data.employedElsewhere!,
          acceptsCash: data.acceptsCash!,
          isVatPayer: data.isVatPayer!,
          expectedIncomeRange: data.expectedIncomeRange!,
        } as Step2Data)

        if (result.error) {
          setError(result.error)
          return
        }

        // Navigate to step 3
        router.push("/pausalni/onboarding/step-3")
      })
    },
    [router]
  )

  // Handle back navigation
  const handleBack = useCallback(() => {
    // Navigate back to step 1
    router.push("/pausalni/onboarding")
  }, [router])

  return (
    <div>
      {error && (
        <div className="mb-4 p-4 rounded-lg bg-destructive/10 border border-destructive text-destructive">
          {error}
        </div>
      )}
      <OnboardingStep2Situation
        initialData={formData}
        onNext={handleStep2Next}
        onBack={handleBack}
      />
      {isPending && (
        <div className="fixed inset-0 bg-background/50 flex items-center justify-center z-50">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      )}
    </div>
  )
}
