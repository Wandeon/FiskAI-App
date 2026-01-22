"use client"

import { useState, useCallback, useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { OnboardingStep3Setup, type Step3FormData } from "@/components/patterns/onboarding"
import {
  finalizeOnboarding,
  getPausalniOnboardingData,
  checkOnboardingComplete,
} from "@/app/actions/pausalni-onboarding"

/**
 * Pausalni Obrt Onboarding - Step 3: Setup Checklist (FINAL STEP)
 *
 * This is the third and final step of the 3-step pausalni obrt onboarding flow:
 * 1. Identity - Who are you? (OIB, name, address, founding date)
 * 2. Situation - Your obligations (employment, VAT, cash, income)
 * 3. Setup - Configure capabilities (fiscalization cert, IBAN, logo)
 *
 * IMPORTANT: This is the ONLY step where Company is created.
 * Company creation happens in a single atomic transaction when user confirms.
 *
 * Idempotency: If user refreshes after completion, redirects to /cc
 */
export default function PausalniOnboardingStep3Page() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)

  // Get Step 2 data from session storage or server
  const [situation, setSituation] = useState<{ acceptsCash: boolean }>({
    acceptsCash: true, // Default to true for demo purposes
  })

  // Load data on mount and check idempotency
  useEffect(() => {
    async function loadData() {
      try {
        // IDEMPOTENCY CHECK: If onboarding already complete, redirect to /cc
        const completionStatus = await checkOnboardingComplete()
        if (completionStatus.complete) {
          router.replace(completionStatus.redirectTo || "/cc")
          return
        }

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

        // Load existing data from server (draft or company)
        const data = await getPausalniOnboardingData()
        if (data) {
          if (data.acceptsCash !== undefined) {
            setSituation({ acceptsCash: data.acceptsCash })
          }
          if (data.email) {
            setEmail(data.email)
          }

          // If data source is company, user already completed - redirect
          if (data.source === "company") {
            router.replace("/cc")
            return
          }
        }
      } finally {
        setIsLoading(false)
      }
    }
    void loadData()
  }, [router])

  // Handle step 3 completion - THIS CREATES THE COMPANY
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

        // Call finalizeOnboarding - this creates Company + CompanyUser atomically
        const result = await finalizeOnboarding({
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

        // Navigate to the redirect URL (usually /cc or /dashboard)
        router.push(result.redirectTo || "/cc")
      })
    },
    [router, email]
  )

  // Handle back navigation
  const handleBack = useCallback(() => {
    // Navigate back to step 2
    router.push("/pausalni/onboarding/step-2")
  }, [router])

  // Show loading state while checking idempotency
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Učitavanje...</p>
      </div>
    )
  }

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
