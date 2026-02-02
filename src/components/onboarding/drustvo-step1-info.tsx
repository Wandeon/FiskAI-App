"use client"

import { useState, useCallback, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, AlertTriangle, ArrowRight, ArrowLeft, Loader2, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { validateOib } from "@/lib/validations/oib"
import { createMinimalCompany } from "@/lib/actions/onboarding"

/**
 * Legal form types for DRUSTVO businesses
 */
type LegalFormType = "DOO" | "JDOO"

interface LegalFormOption {
  value: LegalFormType
  label: string
  description: string
}

const LEGAL_FORM_OPTIONS: LegalFormOption[] = [
  {
    value: "DOO",
    label: "D.O.O.",
    description: "Drustvo s ogranicenom odgovornoscu",
  },
  {
    value: "JDOO",
    label: "J.D.O.O.",
    description: "Jednostavno drustvo s ogranicenom odgovornoscu",
  },
]

interface DrushtvoStep1InfoProps {
  /**
   * Called when user clicks "Natrag" to go back
   */
  onBack?: () => void
}

/**
 * DRUSTVO Step 1: Company Information Collection
 *
 * Collects basic company information:
 * - OIB (with validation)
 * - Company name
 * - Legal form (DOO vs JDOO)
 * - Address (optional)
 * - Postal code (optional)
 * - City (optional)
 *
 * On success, navigates to /onboarding?step=drustvo-step2
 */
export function DrushtvoStep1Info({ onBack }: DrushtvoStep1InfoProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Form state
  const [oib, setOib] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [legalForm, setLegalForm] = useState<LegalFormType | null>(null)
  const [address, setAddress] = useState("")
  const [postalCode, setPostalCode] = useState("")
  const [city, setCity] = useState("")

  // Validation state
  const [oibValidation, setOibValidation] = useState<{
    isValid: boolean
    message: string
  } | null>(null)

  // Error state
  const [error, setError] = useState<string | null>(null)

  // Validate OIB on change
  const handleOibChange = useCallback((value: string) => {
    const cleanValue = value.replace(/\D/g, "").slice(0, 11)
    setOib(cleanValue)
    setError(null)

    if (cleanValue.length === 0) {
      setOibValidation(null)
    } else if (cleanValue.length < 11) {
      setOibValidation({
        isValid: false,
        message: `OIB mora imati 11 znamenki (${cleanValue.length}/11)`,
      })
    } else if (!validateOib(cleanValue)) {
      setOibValidation({
        isValid: false,
        message: "Neispravan OIB - kontrolna znamenka ne odgovara",
      })
    } else {
      setOibValidation({
        isValid: true,
        message: "Checksum OK",
      })
    }
  }, [])

  // Check if form is valid
  const isFormValid =
    oib.length === 11 && validateOib(oib) && companyName.trim().length > 0 && legalForm !== null

  // Handle form submission
  const handleSubmit = useCallback(() => {
    if (!isFormValid || isPending || !legalForm) return

    setError(null)
    startTransition(async () => {
      const result = await createMinimalCompany({
        name: companyName.trim(),
        oib,
        legalForm,
        // Include address fields if provided
        address: address.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
        city: city.trim() || undefined,
      })

      if ("error" in result && result.error) {
        setError(result.error)
        return
      }

      // Success - navigate to step 2
      router.push("/onboarding?step=drustvo-step2")
    })
  }, [isFormValid, isPending, legalForm, companyName, oib, address, postalCode, city, router])

  // Render OIB validation status
  const renderOibStatus = () => {
    if (!oibValidation) return null

    if (oibValidation.isValid) {
      return (
        <span className="text-body-xs text-success flex items-center gap-1">
          <Check className="h-3 w-3" />
          {oibValidation.message}
        </span>
      )
    }

    return (
      <span className="text-body-xs text-warning flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        {oibValidation.message}
      </span>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Building2 className="h-6 w-6 text-interactive" />
          <h2 className="text-xl font-semibold text-foreground">Korak 1: Podaci o tvrtki</h2>
        </div>
        <p className="text-secondary">Unesite osnovne podatke o vasem drustvu</p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-danger/10 border border-danger">
          <p className="text-body-sm text-danger">{error}</p>
        </div>
      )}

      {/* Form Fields */}
      <div className="space-y-6">
        {/* OIB Field */}
        <div>
          <Label htmlFor="oib" className="text-body-sm font-medium text-foreground mb-1 block">
            OIB *
          </Label>
          <div className="flex items-center gap-3">
            <Input
              id="oib"
              type="text"
              inputMode="numeric"
              value={oib}
              onChange={(e) => handleOibChange(e.target.value)}
              placeholder="12345678901"
              maxLength={11}
              className="w-44"
              error={oibValidation && !oibValidation.isValid ? true : undefined}
              aria-describedby="oib-status"
              disabled={isPending}
            />
            <div id="oib-status">{renderOibStatus()}</div>
          </div>
          <p className="mt-1 text-body-xs text-muted">OIB tvrtke (11 znamenki)</p>
        </div>

        {/* Company Name Field */}
        <div>
          <Label
            htmlFor="companyName"
            className="text-body-sm font-medium text-foreground mb-1 block"
          >
            Naziv tvrtke *
          </Label>
          <Input
            id="companyName"
            type="text"
            value={companyName}
            onChange={(e) => {
              setCompanyName(e.target.value)
              setError(null)
            }}
            placeholder="npr. Moja Tvrtka d.o.o."
            className="max-w-md"
            disabled={isPending}
          />
        </div>

        {/* Legal Form Selection */}
        <div>
          <Label className="text-body-sm font-medium text-foreground mb-3 block">
            Pravni oblik *
          </Label>
          <div className="space-y-3" role="radiogroup" aria-label="Pravni oblik">
            {LEGAL_FORM_OPTIONS.map((option) => {
              const isSelected = legalForm === option.value

              return (
                <Card
                  key={option.value}
                  padding="none"
                  className={cn(
                    "cursor-pointer transition-all",
                    isSelected
                      ? "border-interactive ring-2 ring-interactive/20"
                      : "hover:border-interactive/50"
                  )}
                  onClick={() => {
                    if (!isPending) {
                      setLegalForm(option.value)
                      setError(null)
                    }
                  }}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      if (!isPending) {
                        setLegalForm(option.value)
                        setError(null)
                      }
                    }
                  }}
                >
                  <div className="flex items-center gap-4 p-4">
                    {/* Radio indicator */}
                    <div
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                        isSelected ? "border-interactive bg-interactive" : "border-border"
                      )}
                    >
                      {isSelected && <div className="h-2 w-2 rounded-full bg-inverse" />}
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <p className="text-body-base font-medium text-foreground">{option.label}</p>
                      <p className="text-body-sm text-secondary">{option.description}</p>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Optional Address Fields */}
        <div className="pt-4 border-t border-border">
          <p className="text-body-sm font-medium text-foreground mb-4">
            Adresa sjedista{" "}
            <span className="text-muted font-normal">(opcionalno - mozete kasnije unijeti)</span>
          </p>

          <div className="space-y-4">
            {/* Address Field */}
            <div>
              <Label
                htmlFor="address"
                className="text-body-sm font-medium text-foreground mb-1 block"
              >
                Ulica i kucni broj
              </Label>
              <Input
                id="address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="npr. Ilica 1"
                className="max-w-md"
                disabled={isPending}
              />
            </div>

            {/* Postal Code and City Fields */}
            <div className="flex gap-4">
              <div className="w-32">
                <Label
                  htmlFor="postalCode"
                  className="text-body-sm font-medium text-foreground mb-1 block"
                >
                  Postanski broj
                </Label>
                <Input
                  id="postalCode"
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="10000"
                  maxLength={10}
                  disabled={isPending}
                />
              </div>

              <div className="flex-1 max-w-xs">
                <Label
                  htmlFor="city"
                  className="text-body-sm font-medium text-foreground mb-1 block"
                >
                  Grad
                </Label>
                <Input
                  id="city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Zagreb"
                  disabled={isPending}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-10">
        {onBack ? (
          <Button type="button" variant="outline" onClick={onBack} disabled={isPending}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Natrag
          </Button>
        ) : (
          <div />
        )}
        <Button
          type="button"
          variant="primary"
          onClick={handleSubmit}
          disabled={!isFormValid || isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Spremam...
            </>
          ) : (
            <>
              Dalje
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
