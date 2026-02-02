"use client"

import { useEffect, useState, useCallback, useTransition, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import {
  IntentSelector,
  type RegistrationIntentType,
} from "@/components/onboarding/intent-selector"
import { ObrtStep1Info, type ObrtStep1FormData } from "@/components/onboarding/obrt-step1-info"
import { ObrtStep2Regime } from "@/components/onboarding/obrt-step2-regime"
import { DrushtvoGating } from "@/components/onboarding/drustvo-gating"
import { DrushtvoStep1Info } from "@/components/onboarding/drustvo-step1-info"
import { DrushtvoStep2Contact } from "@/components/onboarding/drustvo-step2-contact"
import {
  getRegistrationIntent,
  clearRegistrationIntent,
  saveRegistrationIntent,
} from "@/app/actions/registration-intent"
import { savePausalniStep1 } from "@/app/actions/pausalni-onboarding"

/**
 * Onboarding Internal State Machine
 *
 * This implements the internal /onboarding routing per the spec:
 *
 * 1. intent = null? -> Show intent selector
 * 2. intent = DRUSTVO? -> Show DRUSTVO onboarding flow (step1 -> step2)
 * 3. intent = OBRT? -> Check onboarding progress, route to appropriate step
 * 4. CompanyUser exists? (edge case: completed in another tab) -> Redirect to /cc
 *
 * States:
 * - loading: Initial load, fetching user intent
 * - intent-selection: User has no intent, show selector
 * - drustvo-gating: Legacy waitlist (kept for backwards compatibility)
 * - drustvo-step1: DRUSTVO company info (OIB, name, legal form)
 * - drustvo-step2: DRUSTVO contact info (email, phone, IBAN)
 * - obrt-step1: User selected Obrt, show document-first info collection
 * - obrt-step2: User completed Step 1, show tax regime selection
 * - redirect: User has completed onboarding, redirecting to dashboard
 */
type OnboardingState =
  | "loading"
  | "intent-selection"
  | "drustvo-gating"
  | "drustvo-step1"
  | "drustvo-step2"
  | "obrt-step1"
  | "obrt-step2"
  | "redirect"

/**
 * Main Onboarding Page
 *
 * Single entry point that branches based on user's registrationIntent:
 * - intent = null -> Show IntentSelector
 * - intent = DRUSTVO -> Show DRUSTVO onboarding flow (2 steps)
 * - intent = OBRT -> Show Obrt onboarding flow (document-first)
 *
 * Edge case handling:
 * - If CompanyUser exists (e.g., completed in another tab), redirects to /cc
 * - Checks on visibility change to catch multi-tab completion
 */
export default function OnboardingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [state, setState] = useState<OnboardingState>("loading")
  const [_intent, setIntent] = useState<RegistrationIntentType | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // Store Step 1 data temporarily before creating Company in Step 2
  const [step1Data, setStep1Data] = useState<ObrtStep1FormData | null>(null)
  // Track if we've already started redirecting to prevent duplicate calls
  const isRedirecting = useRef(false)

  // Function to check if user has completed onboarding (possibly in another tab)
  const checkCompanyStatus = useCallback(async () => {
    if (isRedirecting.current) return

    try {
      const result = await getRegistrationIntent()
      if (result.isOnboardingComplete) {
        isRedirecting.current = true
        setState("redirect")
        router.replace("/cc")
      }
    } catch {
      // Silently fail - user can continue onboarding
    }
  }, [router])

  // Load user's registration intent on mount
  useEffect(() => {
    async function loadIntent() {
      if (isRedirecting.current) return

      try {
        const result = await getRegistrationIntent()

        // Only redirect to /cc if onboarding is FULLY complete
        // (not just if a company exists - that would cause loops with incomplete companies)
        if (result.isOnboardingComplete) {
          isRedirecting.current = true
          setState("redirect")
          router.replace("/cc")
          return
        }

        // Check URL search params for explicit step navigation
        const step = searchParams.get("step")
        if (step === "drustvo-step1") {
          setIntent("DRUSTVO")
          setState("drustvo-step1")
          return
        }
        if (step === "drustvo-step2") {
          setIntent("DRUSTVO")
          setState("drustvo-step2")
          return
        }

        // Determine state based on intent
        if (!result.intent) {
          setState("intent-selection")
        } else if (result.intent === "DRUSTVO") {
          setIntent("DRUSTVO")
          setState("drustvo-step1")
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
  }, [router, searchParams])

  // Edge case: Check for completion when tab becomes visible
  // This handles the case where user completes onboarding in another tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && state !== "redirect" && state !== "loading") {
        void checkCompanyStatus()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [state, checkCompanyStatus])

  // Handle intent selection completion
  const handleIntentSaved = useCallback(() => {
    // Reload intent to get updated state
    window.location.reload()
  }, [])

  // Handle Obrt Step 1 completion - moves to tax regime selection
  const handleObrtStep1Next = useCallback((data: ObrtStep1FormData) => {
    setError(null)
    // Store Step 1 data and move to Step 2 (tax regime selection)
    setStep1Data(data)
    setState("obrt-step2")
  }, [])

  // Handle Obrt Step 2 completion - saves data and redirects
  const handleObrtStep2Next = useCallback(() => {
    if (!step1Data) {
      setError("Podaci iz koraka 1 nisu pronađeni. Molimo počnite ispočetka.")
      setState("obrt-step1")
      return
    }

    setError(null)
    startTransition(async () => {
      // Parse address into components (simple split by comma)
      const addressParts = step1Data.address.split(",").map((s) => s.trim())
      const streetAddress = addressParts[0] || step1Data.address
      const city = addressParts[1] || "Zagreb"
      const postalCode = addressParts[2] || "10000"

      const result = await savePausalniStep1({
        name: step1Data.companyName,
        oib: step1Data.oib,
        address: streetAddress,
        city,
        postalCode,
        foundingDate: step1Data.foundingDate || undefined,
      })

      if (result.error) {
        setError(result.error)
        return
      }

      // Navigate to legacy Step 2 (Situacija)
      router.push("/pausalni/onboarding/step-2")
    })
  }, [step1Data, router])

  // Handle going back from Step 2 to Step 1
  const handleObrtStep2Back = useCallback(() => {
    setState("obrt-step1")
  }, [])

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

  // Društvo Gating state - legacy redirect (kept for backwards compatibility)
  // The DrushtvoGating component now just redirects to drustvo-step1
  if (state === "drustvo-gating") {
    return (
      <div className="mx-auto max-w-lg py-12">
        {errorBanner}
        <DrushtvoGating />
      </div>
    )
  }

  // Društvo Step 1 state
  if (state === "drustvo-step1") {
    return (
      <div className="mx-auto max-w-xl py-12">
        {errorBanner}
        <DrushtvoStep1Info onBack={handleChangeSelection} />
      </div>
    )
  }

  // Društvo Step 2 state
  if (state === "drustvo-step2") {
    return (
      <div className="mx-auto max-w-xl py-12">
        {errorBanner}
        <DrushtvoStep2Contact onBack={() => setState("drustvo-step1")} />
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
          initialData={step1Data || undefined}
        />
      </div>
    )
  }

  // Obrt Step 2 state - Tax Regime Selection
  if (state === "obrt-step2") {
    return (
      <div className="mx-auto max-w-2xl py-8">
        {errorBanner}
        <ObrtStep2Regime
          onNext={handleObrtStep2Next}
          onBack={handleObrtStep2Back}
          isSubmitting={isPending}
        />
      </div>
    )
  }

  // Fallback (should not reach here)
  return null
}
