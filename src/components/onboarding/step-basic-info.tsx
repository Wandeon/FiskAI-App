// src/components/onboarding/step-basic-info.tsx
"use client"

import { useEffect, useState, useTransition } from "react"
import { useOnboardingStore } from "@/lib/stores/onboarding-store"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { OibInput } from "@/components/ui/oib-input"
import { trackEvent, AnalyticsEvents } from "@/lib/analytics"
import { toast } from "@/lib/toast"
import type { LegalForm } from "@/lib/capabilities"
import { createMinimalCompany } from "@/app/actions/onboarding"

const LEGAL_FORM_OPTIONS: { value: LegalForm; label: string; description: string }[] = [
  { value: "OBRT_PAUSAL", label: "Paušalni obrt", description: "Do 60.000 € godišnje, bez PDV-a" },
  {
    value: "OBRT_REAL",
    label: "Obrt (stvarni dohodak)",
    description: "Stvarni prihodi i troškovi",
  },
  { value: "OBRT_VAT", label: "Obrt u sustavu PDV-a", description: "Obrt s PDV obvezom" },
  {
    value: "JDOO",
    label: "j.d.o.o.",
    description: "Jednostavno društvo s ograničenom odgovornošću",
  },
  { value: "DOO", label: "d.o.o.", description: "Društvo s ograničenom odgovornošću" },
]

export function StepBasicInfo() {
  const { data, updateData, setStep, isStepValid } = useOnboardingStore()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    trackEvent(AnalyticsEvents.ONBOARDING_STARTED)
  }, [])

  const handleNext = () => {
    if (!isStepValid(1)) return

    startTransition(async () => {
      setError(null)

      // Create minimal company record to prevent redirect loops
      const result = await createMinimalCompany({
        name: data.name!,
        oib: data.oib!,
        legalForm: data.legalForm!,
      })

      if ("error" in result && result.error) {
        setError(result.error)
        toast.error("Greška", result.error)
      } else {
        trackEvent(AnalyticsEvents.ONBOARDING_STEP_COMPLETED, { step: 1 })
        setStep(2)
      }
    })
  }

  function handleOibLookupSuccess(lookupData: {
    name?: string
    address?: string
    city?: string
    postalCode?: string
    vatNumber?: string
  }) {
    // Auto-fill form fields with looked up data
    if (lookupData.name) updateData({ name: lookupData.name })
    if (lookupData.address) updateData({ address: lookupData.address })
    if (lookupData.city) updateData({ city: lookupData.city })
    if (lookupData.postalCode) updateData({ postalCode: lookupData.postalCode })

    toast.success("Pronađeno!", "Podaci o tvrtki su automatski popunjeni")
  }

  function handleOibLookupError(errorMsg: string) {
    // Just show info, not error - user can continue manually
    toast.error("Nije pronađeno", errorMsg)
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Osnovni podaci tvrtke</h2>
        <p className="mt-1 text-sm text-secondary">
          Unesite OIB - podaci će biti automatski pronađeni
        </p>
      </div>

      {error && <div className="rounded-md bg-danger-bg p-3 text-sm text-danger-text">{error}</div>}

      <div className="space-y-4">
        <div>
          <label htmlFor="oib" className="block text-sm font-medium text-foreground">
            OIB *
          </label>
          <OibInput
            value={data.oib || ""}
            onChange={(value) => updateData({ oib: value.replace(/\D/g, "").slice(0, 11) })}
            onLookupSuccess={handleOibLookupSuccess}
            onLookupError={handleOibLookupError}
          />
          <p className="mt-1 text-xs text-tertiary">Osobni identifikacijski broj (11 znamenki)</p>
        </div>

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-foreground">
            Naziv tvrtke *
          </label>
          <Input
            id="name"
            value={data.name || ""}
            onChange={(e) => updateData({ name: e.target.value })}
            placeholder="Moja Tvrtka d.o.o."
            className="mt-1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Pravni oblik *</label>
          <div className="space-y-2">
            {LEGAL_FORM_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${
                  data.legalForm === option.value
                    ? "border-focus bg-info-bg"
                    : "border-default hover:border-default"
                }`}
              >
                <input
                  type="radio"
                  name="legalForm"
                  value={option.value}
                  checked={data.legalForm === option.value}
                  onChange={(e) => updateData({ legalForm: e.target.value as LegalForm })}
                  className="mt-0.5 mr-3"
                />
                <div>
                  <span className="font-medium text-foreground">{option.label}</span>
                  <p className="text-xs text-tertiary mt-0.5">{option.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleNext} disabled={!isStepValid(1) || isPending}>
          {isPending ? "Spremanje..." : "Dalje"}
        </Button>
      </div>
    </div>
  )
}
