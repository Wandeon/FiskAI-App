"use client"

import { useState, useCallback, useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import { OnboardingStep3Setup, type Step3FormData } from "@/components/patterns/onboarding"
import { savePausalniStep3, getPausalniOnboardingData } from "@/app/actions/pausalni-onboarding"

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
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState<string>("")

  // Get Step 2 data from session storage or server
  const [situation, setSituation] = useState<{ acceptsCash: boolean }>({
    acceptsCash: true, // Default to true for demo purposes
  })

  // Load data on mount
  useEffect(() => {
    async function loadData() {
      // First try session storage for acceptsCash
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

      // Load existing data from server
      const data = await getPausalniOnboardingData()
      if (data) {
        if (data.acceptsCash !== undefined) {
          setSituation({ acceptsCash: data.acceptsCash })
        }
        if (data.email) {
          setEmail(data.email)
        }
      }
    }
    void loadData()
  }, [])

  // Handle step 3 completion
  const handleComplete = useCallback(
    (data: Step3FormData) => {
      setError(null)
      startTransition(async () => {
        // Require email for completion
        const emailToSave = email || prompt("Unesite vašu email adresu za završetak registracije:")
        if (!emailToSave || !emailToSave.includes("@")) {
          setError("Email adresa je obavezna za završetak registracije")
          return
        }

        const result = await savePausalniStep3({
          iban: data.iban.value || undefined,
          hasFiscalizationCert: data.fiscalization.hasCertificate,
          email: emailToSave,
        })

        if (result.error) {
          setError(result.error)
          return
        }

        // Clear session storage
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("onboarding-step2")
        }

        // Navigate to dashboard
        router.push("/dashboard")
      })
    },
    [router, email]
  )

  // Handle back navigation
  const handleBack = useCallback(() => {
    // Navigate back to step 2
    router.push("/pausalni/onboarding/step-2")
  }, [router])

  return (
    <div>
      {error && (
        <div className="mb-4 p-4 rounded-lg bg-destructive/10 border border-destructive text-destructive">
          {error}
        </div>
      )}
      <OnboardingStep3Setup situation={situation} onBack={handleBack} onComplete={handleComplete} />
      {isPending && (
        <div className="fixed inset-0 bg-background/50 flex items-center justify-center z-50">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      )}
    </div>
  )
}
