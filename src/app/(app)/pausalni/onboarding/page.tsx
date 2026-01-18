"use client"

import { useState, useCallback, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { OnboardingStep1Identity, type Step1FormData } from "@/components/patterns/onboarding"
import { savePausalniStep1, getPausalniOnboardingData } from "@/app/actions/pausalni-onboarding"

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
  const [isPending, startTransition] = useTransition()
  const [formData, setFormData] = useState<Partial<Step1FormData>>({})
  const [error, setError] = useState<string | null>(null)

  // Load existing data on mount
  useEffect(() => {
    async function loadData() {
      const data = await getPausalniOnboardingData()
      if (data) {
        setFormData({
          oib: data.oib || "",
          companyName: data.name || "",
          address: [data.address, data.city, data.postalCode].filter(Boolean).join(", "),
          foundingDate: data.foundingDate || "",
        })
      }
    }
    void loadData()
  }, [])

  // Handle step 1 completion
  const handleStep1Next = useCallback(
    (data: Step1FormData) => {
      setError(null)
      startTransition(async () => {
        // Parse address into components (simple split by comma)
        const addressParts = data.address.split(",").map((s) => s.trim())
        const streetAddress = addressParts[0] || data.address
        const city = addressParts[1] || ""
        const postalCode = addressParts[2] || ""

        const result = await savePausalniStep1({
          name: data.companyName,
          oib: data.oib,
          address: streetAddress,
          city: city || "Zagreb", // Default to Zagreb if not specified
          postalCode: postalCode || "10000", // Default postal code
          foundingDate: data.foundingDate || undefined,
        })

        if (result.error) {
          setError(result.error)
          return
        }

        // Navigate to step 2
        router.push("/pausalni/onboarding/step-2")
      })
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
    <div>
      {error && (
        <div className="mb-4 p-4 rounded-lg bg-destructive/10 border border-destructive text-destructive">
          {error}
        </div>
      )}
      <OnboardingStep1Identity
        initialData={formData}
        onNext={handleStep1Next}
        onBack={handleBack}
        isFirstStep={true}
      />
      {isPending && (
        <div className="fixed inset-0 bg-background/50 flex items-center justify-center z-50">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      )}
    </div>
  )
}
