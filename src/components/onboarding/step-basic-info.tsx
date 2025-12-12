// src/components/onboarding/step-basic-info.tsx
"use client"

import { useEffect } from "react"
import { useOnboardingStore } from "@/lib/stores/onboarding-store"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { OibInput } from "@/components/ui/oib-input"
import { trackEvent, AnalyticsEvents } from "@/lib/analytics"
import { toast } from "@/lib/toast"

export function StepBasicInfo() {
  const { data, updateData, setStep, isStepValid } = useOnboardingStore()

  useEffect(() => {
    trackEvent(AnalyticsEvents.ONBOARDING_STARTED)
  }, [])

  const handleNext = () => {
    if (isStepValid(1)) {
      trackEvent(AnalyticsEvents.ONBOARDING_STEP_COMPLETED, { step: 1 })
      setStep(2)
    }
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
        <p className="mt-1 text-sm text-gray-600">
          Unesite OIB - podaci će biti automatski pronađeni
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="oib" className="block text-sm font-medium text-gray-700">
            OIB *
          </label>
          <OibInput
            value={data.oib || ""}
            onChange={(value) => updateData({ oib: value.replace(/\D/g, "").slice(0, 11) })}
            onLookupSuccess={handleOibLookupSuccess}
            onLookupError={handleOibLookupError}
          />
          <p className="mt-1 text-xs text-gray-500">
            Osobni identifikacijski broj (11 znamenki)
          </p>
        </div>

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
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
      </div>

      <div className="flex justify-end">
        <Button onClick={handleNext} disabled={!isStepValid(1)}>
          Dalje
        </Button>
      </div>
    </div>
  )
}
