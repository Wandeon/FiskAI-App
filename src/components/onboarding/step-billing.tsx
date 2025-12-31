// src/components/onboarding/step-billing.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useOnboardingStore } from "@/lib/stores/onboarding-store"
import { Button } from "@/components/ui/button"
import { Check, Sparkles, ArrowRight } from "lucide-react"
import { trackEvent, AnalyticsEvents } from "@/lib/analytics"
import { toast } from "@/lib/toast"

const PLANS = [
  {
    id: "pausalni",
    name: "Paušalni obrt",
    priceEur: 39,
    invoiceLimit: 50,
    userLimit: 1,
    features: ["50 računa/mjesec", "1 korisnik", "Fiskalizacija", "E-Računi (B2G/B2B)"],
    legalForms: ["OBRT_PAUSAL"],
  },
  {
    id: "standard",
    name: "D.O.O. Standard",
    priceEur: 99,
    invoiceLimit: 200,
    userLimit: 5,
    features: ["200 računa/mjesec", "5 korisnika", "Fiskalizacija", "E-Računi (B2G/B2B)"],
    legalForms: ["DOO", "JDO"],
  },
  {
    id: "pro",
    name: "D.O.O. Pro",
    priceEur: 199,
    invoiceLimit: -1,
    userLimit: -1,
    features: [
      "Neograničeno računa",
      "Neograničeno korisnika",
      "Fiskalizacija",
      "E-Računi (B2G/B2B)",
      "Prioritetna podrška",
    ],
    legalForms: ["DOO", "JDO"],
  },
]

export function StepBilling() {
  const router = useRouter()
  const { data, setStep, reset } = useOnboardingStore()
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)

  // Calculate trial end date (14 days from now)
  const trialEndDate = new Date()
  trialEndDate.setDate(trialEndDate.getDate() + 14)

  // Filter plans based on legal form
  const availablePlans = PLANS.filter((plan) => plan.legalForms.includes(data.legalForm || ""))

  // Auto-select the first plan if only one available
  const defaultPlan = availablePlans.length === 1 ? availablePlans[0].id : null

  const handleContinueWithTrial = () => {
    trackEvent(AnalyticsEvents.ONBOARDING_COMPLETED, {
      competence: data.competence,
      selectedPlan: selectedPlan || defaultPlan,
      startedTrial: true,
    })

    toast.success("Dobrodošli u FiskAI!", "Vaše 14-dnevno probno razdoblje je počelo")

    // Clear onboarding data and redirect
    setTimeout(() => {
      reset()
      router.push("/dashboard")
      router.refresh()
    }, 500)
  }

  const handleSkipForNow = () => {
    trackEvent(AnalyticsEvents.ONBOARDING_COMPLETED, {
      competence: data.competence,
      skippedBilling: true,
    })

    toast.success("Postavljanje završeno!", "Možete odabrati plan kasnije u postavkama")

    // Clear onboarding data and redirect
    setTimeout(() => {
      reset()
      router.push("/dashboard")
      router.refresh()
    }, 500)
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
          <Sparkles className="h-6 w-6 text-brand-600" />
        </div>
        <h2 className="text-2xl font-bold text-[var(--foreground)]">
          Počnite s besplatnim probnim razdobljem
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Isprobajte FiskAI besplatno 14 dana. Bez obveze, kreditna kartica nije potrebna.
        </p>
      </div>

      {/* Trial Banner */}
      <div className="rounded-xl border-2 border-brand-200 bg-brand-50 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white">
            <Check className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-brand-900">14-dnevno probno razdoblje</p>
            <p className="text-sm text-brand-700">
              Istječe{" "}
              {trialEndDate.toLocaleDateString("hr-HR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Plan Preview */}
      {availablePlans.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-[var(--foreground)]">
            Vaš plan nakon probnog razdoblja:
          </h3>
          {availablePlans.map((plan) => (
            <div
              key={plan.id}
              className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${
                selectedPlan === plan.id || (defaultPlan === plan.id && !selectedPlan)
                  ? "border-brand-500 bg-brand-50"
                  : "border-[var(--border)] bg-[var(--surface)] hover:border-brand-300"
              }`}
              onClick={() => setSelectedPlan(plan.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-[var(--foreground)]">{plan.name}</h4>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-[var(--foreground)]">
                      {plan.priceEur}
                    </span>
                    <span className="text-[var(--muted)]">EUR/mjesec</span>
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {plan.features.map((feature, idx) => (
                      <li
                        key={idx}
                        className="flex items-center gap-2 text-sm text-[var(--foreground)]"
                      >
                        <Check className="h-4 w-4 text-brand-600" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                <div
                  className={`h-5 w-5 rounded-full border-2 transition-colors ${
                    selectedPlan === plan.id || (defaultPlan === plan.id && !selectedPlan)
                      ? "border-brand-500 bg-brand-500"
                      : "border-default"
                  }`}
                >
                  {(selectedPlan === plan.id || (defaultPlan === plan.id && !selectedPlan)) && (
                    <Check className="h-4 w-4 text-white" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* What happens after trial */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] p-4">
        <h4 className="mb-2 text-sm font-medium text-[var(--foreground)]">
          Što se događa nakon probnog razdoblja?
        </h4>
        <ul className="space-y-2 text-sm text-[var(--foreground)]">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--surface)] border border-[var(--border)] text-xs font-medium">
              1
            </span>
            <span>7 dana prije isteka dobit ćete podsjetnik na e-mail</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--surface)] border border-[var(--border)] text-xs font-medium">
              2
            </span>
            <span>Možete odabrati plan i unijeti način plaćanja</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--surface)] border border-[var(--border)] text-xs font-medium">
              3
            </span>
            <span>Ako ne odaberete plan, račun prelazi u read-only način rada</span>
          </li>
        </ul>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-3">
        <Button onClick={handleContinueWithTrial} className="w-full" size="lg">
          Započni besplatno probno razdoblje
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => setStep(data.legalForm === "OBRT_PAUSAL" ? 5 : 4)}
            className="flex-1"
          >
            Natrag
          </Button>
          <Button variant="ghost" onClick={handleSkipForNow} className="flex-1">
            Preskoči za sada
          </Button>
        </div>
      </div>

      <p className="text-center text-xs text-[var(--muted)]">
        Bez obveze. Otkažite bilo kada. Kreditna kartica nije potrebna za probno razdoblje.
      </p>
    </div>
  )
}
