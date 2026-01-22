"use client"

import { useEffect, useState, useCallback, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Clock, ArrowLeft } from "lucide-react"
import {
  IntentSelector,
  type RegistrationIntentType,
} from "@/components/onboarding/intent-selector"
import { ObrtStep1Info, type ObrtStep1FormData } from "@/components/onboarding/obrt-step1-info"
import {
  getRegistrationIntent,
  clearRegistrationIntent,
  saveRegistrationIntent,
} from "@/app/actions/registration-intent"
import { savePausalniStep1 } from "@/app/actions/pausalni-onboarding"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

/**
 * Onboarding state machine
 *
 * This tracks the internal state of the onboarding flow:
 * - loading: Initial load, fetching user intent
 * - intent-selection: User has no intent, show selector
 * - drustvo-gating: User selected Drustvo, show waitlist/coming soon
 * - obrt-step1: User selected Obrt, show document-first info collection
 * - redirect: User has completed onboarding, redirecting to dashboard
 */
type OnboardingState = "loading" | "intent-selection" | "drustvo-gating" | "obrt-step1" | "redirect"

/**
 * Main Onboarding Page
 *
 * Single entry point that branches based on user's registrationIntent:
 * - intent = null -> Show IntentSelector
 * - intent = DRUSTVO -> Show gating/waitlist screen (placeholder for Task 4)
 * - intent = OBRT -> Show Obrt onboarding flow (document-first)
 *
 * If CompanyUser exists, redirects to /cc
 */
export default function OnboardingPage() {
  const router = useRouter()
  const [state, setState] = useState<OnboardingState>("loading")
  const [_intent, setIntent] = useState<RegistrationIntentType | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Load user's registration intent on mount
  useEffect(() => {
    async function loadIntent() {
      try {
        const result = await getRegistrationIntent()

        // If user already has a company, redirect to dashboard
        if (result.hasCompany) {
          setState("redirect")
          router.replace("/cc")
          return
        }

        // Determine state based on intent
        if (!result.intent) {
          setState("intent-selection")
        } else if (result.intent === "DRUSTVO") {
          setIntent("DRUSTVO")
          setState("drustvo-gating")
        } else if (result.intent === "OBRT") {
          setIntent("OBRT")
          setState("obrt-step1")
        }
      } catch (err) {
        console.error("[Onboarding] Failed to load intent:", err)
        setError("Došlo je do greške. Molimo osvježite stranicu.")
        setState("intent-selection")
      }
    }

    void loadIntent()
  }, [router])

  // Handle intent selection completion
  const handleIntentSaved = useCallback(() => {
    // Reload intent to get updated state
    window.location.reload()
  }, [])

  // Handle Obrt Step 1 completion
  const handleObrtStep1Next = useCallback(
    (data: ObrtStep1FormData) => {
      setError(null)
      startTransition(async () => {
        // Parse address into components (simple split by comma)
        const addressParts = data.address.split(",").map((s) => s.trim())
        const streetAddress = addressParts[0] || data.address
        const city = addressParts[1] || "Zagreb"
        const postalCode = addressParts[2] || "10000"

        const result = await savePausalniStep1({
          name: data.companyName,
          oib: data.oib,
          address: streetAddress,
          city,
          postalCode,
          foundingDate: data.foundingDate || undefined,
        })

        if (result.error) {
          setError(result.error)
          return
        }

        // Navigate to Step 2 (Situacija - tax regime selection)
        router.push("/pausalni/onboarding/step-2")
      })
    },
    [router]
  )

  // Handle "change selection" from gating screens
  const handleChangeSelection = useCallback(() => {
    setError(null)
    startTransition(async () => {
      const result = await clearRegistrationIntent()

      if (result.error) {
        setError(result.error)
        return
      }

      setIntent(null)
      setState("intent-selection")
    })
  }, [])

  // Loading state
  if (state === "loading" || state === "redirect") {
    return (
      <div className="mx-auto max-w-xl py-12">
        <div className="flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-interactive" />
          <p className="text-sm text-secondary">
            {state === "redirect" ? "Preusmjeravam..." : "Učitavanje..."}
          </p>
        </div>
      </div>
    )
  }

  // Error display
  const errorBanner = error && (
    <div className="mb-6 p-4 rounded-lg bg-danger/10 border border-danger text-danger text-sm max-w-xl mx-auto">
      {error}
    </div>
  )

  // Intent Selection state
  if (state === "intent-selection") {
    return (
      <div className="mx-auto max-w-xl py-12">
        {errorBanner}
        <IntentSelector onSaveIntent={saveRegistrationIntent} onIntentSaved={handleIntentSaved} />
      </div>
    )
  }

  // Društvo Gating state (placeholder for Task 4)
  if (state === "drustvo-gating") {
    return (
      <div className="mx-auto max-w-lg py-12">
        {errorBanner}
        <Card padding="lg" className="text-center">
          <div className="flex justify-center mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-info-bg">
              <Clock className="h-8 w-8 text-info" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-3">
            Podrška za društva dolazi uskoro
          </h1>

          <p className="text-secondary mb-6">
            Trenutno podržavamo samo obrte. Podrška za j.d.o.o. i d.o.o. stiže uskoro. Ostavite nam
            svoje podatke i javit ćemo vam kada bude dostupno.
          </p>

          {/* Placeholder for waitlist form - Task 4 */}
          <div className="p-4 rounded-lg bg-surface-1 border border-border mb-6">
            <p className="text-body-sm text-muted">
              Obrazac za prijavu na listu čekanja bit će dodan u sljedećoj fazi.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={handleChangeSelection}
            disabled={isPending}
            className="w-full"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {isPending ? "Spremam..." : "Promijeni odabir"}
          </Button>
        </Card>
      </div>
    )
  }

  // Obrt Step 1 state
  if (state === "obrt-step1") {
    return (
      <div className="mx-auto max-w-2xl py-8">
        {errorBanner}
        <ObrtStep1Info
          onNext={handleObrtStep1Next}
          onBack={handleChangeSelection}
          isSubmitting={isPending}
        />
      </div>
    )
  }

  // Fallback (should not reach here)
  return null
}
