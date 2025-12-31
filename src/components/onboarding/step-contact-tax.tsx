// src/components/onboarding/step-contact-tax.tsx
"use client"

import { useState, useTransition } from "react"
import { useOnboardingStore } from "@/lib/stores/onboarding-store"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { saveOnboardingData } from "@/lib/actions/onboarding"
import { saveCompetenceLevel } from "@/lib/actions/guidance"
import { toast } from "@/lib/toast"
import { trackEvent, AnalyticsEvents } from "@/lib/analytics"

export function StepContactTax() {
  const { data, updateData, setStep, isStepValid } = useOnboardingStore()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (skipOptional: boolean = false) => {
    // For skip, only email is required. For submit, validate all filled fields
    if (!skipOptional && !isStepValid(4)) return
    if (skipOptional && !data.email?.includes("@")) return

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
        address: data.address || undefined,
        postalCode: data.postalCode || undefined,
        city: data.city || undefined,
        country: data.country || "HR",
        email: data.email!,
        phone: data.phone || undefined,
        iban: data.iban || undefined,
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

        // Track company creation and proceed to billing step
        trackEvent(AnalyticsEvents.ONBOARDING_STEP_COMPLETED, {
          step: 4,
          competence: data.competence,
          skippedOptional: skipOptional,
        })
        toast.success(
          "Podaci spremljeni!",
          skipOptional ? "Možete dovršiti ostale podatke kasnije" : "Još jedan korak do kraja"
        )

        // Navigate to billing step (step 6)
        setStep(6)
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Kontakt i porezni podaci</h2>
        <p className="mt-1 text-sm text-secondary">
          Email je obavezan, ostalo možete dodati kasnije
        </p>
      </div>

      {error && <div className="rounded-md bg-danger-bg p-3 text-sm text-danger-text">{error}</div>}

      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-foreground">
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
          <label htmlFor="phone" className="block text-sm font-medium text-foreground">
            Telefon <span className="text-xs text-tertiary">(opcionalno)</span>
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
          <label htmlFor="iban" className="block text-sm font-medium text-foreground">
            IBAN <span className="text-xs text-tertiary">(opcionalno, potreban za e-račune)</span>
          </label>
          <Input
            id="iban"
            value={data.iban || ""}
            onChange={(e) => updateData({ iban: e.target.value.toUpperCase() })}
            placeholder="HR1234567890123456789"
            className="mt-1"
          />
          <p className="mt-1 text-xs text-tertiary">IBAN je potreban za slanje e-računa</p>
        </div>

        {/* Hide VAT checkbox for paušalni obrt - they cannot be VAT payers */}
        {data.legalForm !== "OBRT_PAUSAL" && (
          <div className="flex items-center gap-3">
            <input
              id="isVatPayer"
              type="checkbox"
              checked={data.isVatPayer || false}
              onChange={(e) => updateData({ isVatPayer: e.target.checked })}
              className="h-4 w-4 rounded border-default text-link focus:ring-border-focus"
            />
            <label htmlFor="isVatPayer" className="text-sm text-foreground">
              Tvrtka je obveznik PDV-a
            </label>
          </div>
        )}

        {data.legalForm === "OBRT_PAUSAL" && (
          <div className="rounded-md bg-info-bg border border-info-border p-3">
            <p className="text-sm text-info-text">
              <strong>Paušalni obrt</strong> nije u sustavu PDV-a i ne obračunava PDV na račune.
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-between gap-3">
        <Button variant="outline" onClick={() => setStep(3)} disabled={isPending}>
          Natrag
        </Button>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => handleSubmit(true)}
            disabled={!data.email?.includes("@") || isPending}
          >
            Dovršit ću kasnije
          </Button>
          <Button onClick={() => handleSubmit(false)} disabled={!isStepValid(4) || isPending}>
            {isPending ? "Spremanje..." : "Nastavi"}
          </Button>
        </div>
      </div>
    </div>
  )
}
