// src/components/onboarding/step-address.tsx
"use client"

import { useOnboardingStore } from "@/lib/stores/onboarding-store"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { trackEvent, AnalyticsEvents } from "@/lib/analytics"

export function StepAddress() {
  const { data, updateData, setStep, isStepValid } = useOnboardingStore()

  const handleNext = () => {
    if (isStepValid(3)) {
      trackEvent(AnalyticsEvents.ONBOARDING_STEP_COMPLETED, { step: 3 })
      setStep(4)
    }
  }

  const handleSkip = () => {
    trackEvent(AnalyticsEvents.ONBOARDING_STEP_COMPLETED, {
      step: 3,
      skipped: true,
    })
    setStep(4)
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Adresa tvrtke</h2>
        <p className="mt-1 text-sm text-gray-600">Unesite poslovnu adresu</p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="address" className="block text-sm font-medium text-gray-700">
            Ulica i kućni broj *
          </label>
          <Input
            id="address"
            value={data.address || ""}
            onChange={(e) => updateData({ address: e.target.value })}
            placeholder="Ilica 1"
            className="mt-1"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="postalCode" className="block text-sm font-medium text-gray-700">
              Poštanski broj *
            </label>
            <Input
              id="postalCode"
              value={data.postalCode || ""}
              onChange={(e) => updateData({ postalCode: e.target.value })}
              placeholder="10000"
              className="mt-1"
            />
          </div>

          <div>
            <label htmlFor="city" className="block text-sm font-medium text-gray-700">
              Grad *
            </label>
            <Input
              id="city"
              value={data.city || ""}
              onChange={(e) => updateData({ city: e.target.value })}
              placeholder="Zagreb"
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <label htmlFor="country" className="block text-sm font-medium text-gray-700">
            Država *
          </label>
          <Input
            id="country"
            value={data.country || "HR"}
            onChange={(e) => updateData({ country: e.target.value })}
            placeholder="HR"
            className="mt-1"
          />
        </div>
      </div>

      <div className="flex justify-between gap-3">
        <Button variant="outline" onClick={() => setStep(2)}>
          Natrag
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={handleSkip}>
            Preskoči za sada
          </Button>
          <Button onClick={handleNext} disabled={!isStepValid(3)}>
            Dalje
          </Button>
        </div>
      </div>
    </div>
  )
}
