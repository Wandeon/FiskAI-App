// src/components/onboarding/step-competence.tsx
"use client"

import { useOnboardingStore } from "@/lib/stores/onboarding-store"
import { Button } from "@/components/ui/button"
import { trackEvent, AnalyticsEvents } from "@/lib/analytics"
import type { CompetenceLevel } from "@/lib/visibility/rules"
import { COMPETENCE_DESCRIPTIONS } from "@/lib/guidance/help-density"
import { Sparkles, TrendingUp, Zap } from "lucide-react"

const COMPETENCE_OPTIONS: {
  value: CompetenceLevel
  label: string
  description: string
  icon: typeof Sparkles
  benefits: string[]
  uiChanges: string
}[] = [
  {
    value: "beginner",
    label: "Početnik",
    description: "Tek započinjem s fakturiranjem. Trebam vodstvo korak po korak.",
    icon: Sparkles,
    benefits: [
      "Vodstvo kroz svaki korak",
      "Detaljne upute i objašnjenja",
      "Postupno otključavanje značajki",
    ],
    uiChanges:
      "Vidjeti ćete detaljne tooltipove na svakom polju, potvrde prije važnih radnji, i objašnjenja nakon svake operacije.",
  },
  {
    value: "average",
    label: "Iskusan",
    description: "Imam iskustva s fakturiranjem. Razumijem osnove.",
    icon: TrendingUp,
    benefits: [
      "Preskočite osnovne korake",
      "Direktan pristup fakturama",
      "Umjerene upute kad je potrebno",
    ],
    uiChanges:
      "Vidjeti ćete tooltipove na ključnim poljima, potvrde samo za kritične radnje, i kratke obavijesti o uspjehu.",
  },
  {
    value: "pro",
    label: "Stručnjak",
    description: "Profesionalac sam. Želim sve značajke odmah.",
    icon: Zap,
    benefits: ["Sve otključano odmah", "Bez ograničenja i čekanja", "Napredne postavke vidljive"],
    uiChanges:
      "Vidjeti ćete čisto sučelje bez tooltipova, bez potvrdi, i vidljive tipkovničke prečace za brži rad.",
  },
]

export function StepCompetence() {
  const { data, updateData, setStep, isStepValid } = useOnboardingStore()

  const handleNext = () => {
    if (isStepValid(2)) {
      trackEvent(AnalyticsEvents.ONBOARDING_STEP_COMPLETED, {
        step: 2,
        competence: data.competence,
      })
      setStep(3)
    }
  }

  const handleSkip = () => {
    trackEvent(AnalyticsEvents.ONBOARDING_STEP_COMPLETED, {
      step: 2,
      skipped: true,
    })
    setStep(3)
  }

  const handleBack = () => {
    setStep(1)
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Koliko ste iskusni?</h2>
        <p className="mt-1 text-sm text-gray-600">Prilagodit ćemo iskustvo vašoj razini znanja</p>
      </div>

      <div className="space-y-3">
        {COMPETENCE_OPTIONS.map((option) => {
          const Icon = option.icon
          const isSelected = data.competence === option.value

          return (
            <label
              key={option.value}
              className={`flex items-start gap-4 p-4 border rounded-xl cursor-pointer transition-all ${
                isSelected
                  ? "border-cyan-500 bg-cyan-50 ring-2 ring-cyan-500/20"
                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <input
                type="radio"
                name="competence"
                value={option.value}
                checked={isSelected}
                onChange={(e) => updateData({ competence: e.target.value as CompetenceLevel })}
                className="sr-only"
              />

              <div
                className={`p-2 rounded-lg ${
                  isSelected ? "bg-cyan-500 text-white" : "bg-gray-100 text-gray-500"
                }`}
              >
                <Icon className="h-6 w-6" />
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{option.label}</span>
                  {option.value === "average" && (
                    <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full">
                      Preporučeno
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-0.5">{option.description}</p>

                <ul className="mt-2 space-y-1">
                  {option.benefits.map((benefit) => (
                    <li key={benefit} className="flex items-center gap-2 text-xs text-gray-500">
                      <span className={isSelected ? "text-cyan-500" : "text-gray-400"}>✓</span>
                      {benefit}
                    </li>
                  ))}
                </ul>

                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs font-medium text-gray-700 mb-1">Kako će to utjecati na sučelje:</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{option.uiChanges}</p>
                </div>
              </div>

              {isSelected && (
                <div className="text-cyan-500">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </label>
          )
        })}
      </div>

      <p className="text-xs text-gray-500 text-center">
        Možete promijeniti ovu postavku bilo kada u postavkama.
      </p>

      <div className="flex justify-between gap-3">
        <Button variant="outline" onClick={handleBack}>
          Natrag
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={handleSkip}>
            Preskoči za sada
          </Button>
          <Button onClick={handleNext} disabled={!isStepValid(2)}>
            Dalje
          </Button>
        </div>
      </div>
    </div>
  )
}
