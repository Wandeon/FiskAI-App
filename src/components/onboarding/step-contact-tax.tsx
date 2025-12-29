// src/components/onboarding/step-contact-tax.tsx
"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useOnboardingStore } from "@/lib/stores/onboarding-store"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { saveOnboardingData } from "@/app/actions/onboarding"
import { saveCompetenceLevel } from "@/app/actions/guidance"
import { toast } from "@/lib/toast"
import { trackEvent, AnalyticsEvents } from "@/lib/analytics"

export function StepContactTax() {
  const router = useRouter()
  const { data, updateData, setStep, reset, isStepValid } = useOnboardingStore()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = () => {
    if (!isStepValid(4)) return

    startTransition(async () => {
      setError(null)

      // Paušalni obrt cannot be VAT payer
      const isVatPayer = data.legalForm === "OBRT_PAUSAL" ? false : data.isVatPayer || false

      // Always update existing company (created in step 1)
      const result = await saveOnboardingData({
        name: data.name!,
        oib: data.oib!,
        legalForm: data.legalForm!,
        competence: data.competence,
        address: data.address!,
        postalCode: data.postalCode!,
        city: data.city!,
        country: data.country!,
        email: data.email!,
        phone: data.phone || undefined,
        iban: data.iban!,
        isVatPayer,
      })

      if ("error" in result && result.error) {
        setError(result.error)
        toast.error("Greška", result.error)
      } else {
        // Save competence level to guidance preferences
        if (data.competence) {
          try {
            await saveCompetenceLevel(data.competence)
          } catch (e) {
            console.error("Failed to save competence level:", e)
          }
        }

        // Finalize analytics and store
        trackEvent(AnalyticsEvents.ONBOARDING_COMPLETED, { competence: data.competence })
        toast.success("Onboarding završen!", "Možete početi s radom")

        // Wait a tiny bit for the toast to be seen
        setTimeout(() => {
          reset() // Clear stored wizard data
          router.push("/dashboard")
          router.refresh()
        }, 500)
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Kontakt i porezni podaci</h2>
        <p className="mt-1 text-sm text-gray-600">Završite postavljanje tvrtke</p>
      </div>

      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email *
          </label>
          <Input
            id="email"
            type="email"
            value={data.email || ""}
            onChange={(e) => updateData({ email: e.target.value })}
            placeholder="info@tvrtka.hr"
            className="mt-1"
          />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
            Telefon
          </label>
          <Input
            id="phone"
            value={data.phone || ""}
            onChange={(e) => updateData({ phone: e.target.value })}
            placeholder="+385 1 234 5678"
            className="mt-1"
          />
        </div>

        <div>
          <label htmlFor="iban" className="block text-sm font-medium text-gray-700">
            IBAN *
          </label>
          <Input
            id="iban"
            value={data.iban || ""}
            onChange={(e) => updateData({ iban: e.target.value.toUpperCase() })}
            placeholder="HR1234567890123456789"
            className="mt-1"
          />
        </div>

        {/* Hide VAT checkbox for paušalni obrt - they cannot be VAT payers */}
        {data.legalForm !== "OBRT_PAUSAL" && (
          <div className="flex items-center gap-3">
            <input
              id="isVatPayer"
              type="checkbox"
              checked={data.isVatPayer || false}
              onChange={(e) => updateData({ isVatPayer: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="isVatPayer" className="text-sm text-gray-700">
              Tvrtka je obveznik PDV-a
            </label>
          </div>
        )}

        {data.legalForm === "OBRT_PAUSAL" && (
          <div className="rounded-md bg-blue-50 border border-blue-100 p-3">
            <p className="text-sm text-blue-800">
              <strong>Paušalni obrt</strong> nije u sustavu PDV-a i ne obračunava PDV na račune.
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(3)} disabled={isPending}>
          Natrag
        </Button>
        <Button onClick={handleSubmit} disabled={!isStepValid(4) || isPending}>
          {isPending ? "Spremanje..." : "Završi postavljanje"}
        </Button>
      </div>
    </div>
  )
}
