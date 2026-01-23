"use client"

import { useState, useCallback, useTransition } from "react"
import { ArrowLeft, ArrowRight, Clock, Loader2, Check, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { signupForWaitlist } from "@/lib/actions/waitlist"
import type { WaitlistType } from "@/lib/actions/waitlist.types"

/**
 * Tax regime types for Obrt businesses
 */
type TaxRegimeType = "pausalni" | "dohodak" | "pdv"

interface TaxRegimeOption {
  value: TaxRegimeType
  label: string
  description: string
  enabled: boolean
  waitlistType?: WaitlistType
}

const TAX_REGIME_OPTIONS: TaxRegimeOption[] = [
  {
    value: "pausalni",
    label: "Pausalni obrt",
    description: "Pausalno oporezivanje do 60.000 EUR",
    enabled: true,
  },
  {
    value: "dohodak",
    label: "Obrt na dohodak",
    description: "Stvarni prihodi i rashodi",
    enabled: false,
    waitlistType: "obrt-dohodak",
  },
  {
    value: "pdv",
    label: "Obrt u sustavu PDV-a",
    description: "Obveznik PDV-a",
    enabled: false,
    waitlistType: "obrt-pdv",
  },
]

interface ObrtStep2RegimeProps {
  /**
   * Called when user selects pausalni and clicks "Dalje"
   */
  onNext: () => void
  /**
   * Called when user clicks "Natrag" to go back to Step 1
   */
  onBack: () => void
  /**
   * Whether navigation actions are pending
   */
  isSubmitting?: boolean
}

/**
 * Obrt Step 2: Tax Regime Selection
 *
 * Allows users to select their tax regime:
 * - Pausalni obrt (enabled) - continues to onboarding
 * - Obrt na dohodak (disabled) - shows waitlist
 * - Obrt u sustavu PDV-a (disabled) - shows waitlist
 *
 * When a disabled option is clicked, it expands to show a waitlist signup form.
 */
export function ObrtStep2Regime({ onNext, onBack, isSubmitting = false }: ObrtStep2RegimeProps) {
  const [selectedRegime, setSelectedRegime] = useState<TaxRegimeType | null>(null)
  const [showWaitlist, setShowWaitlist] = useState<TaxRegimeType | null>(null)
  const [email, setEmail] = useState("")
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [waitlistSuccess, setWaitlistSuccess] = useState<TaxRegimeType | null>(null)

  // Basic email validation
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  // Handle option click
  const handleOptionClick = useCallback((option: TaxRegimeOption) => {
    if (option.enabled) {
      setSelectedRegime(option.value)
      setShowWaitlist(null)
    } else {
      // Show waitlist form for disabled options
      setShowWaitlist(option.value)
      setSelectedRegime(null)
    }
    setError(null)
  }, [])

  // Handle waitlist signup
  const handleWaitlistSignup = useCallback(() => {
    if (!showWaitlist || !email || !isEmailValid) return

    const option = TAX_REGIME_OPTIONS.find((o) => o.value === showWaitlist)
    if (!option?.waitlistType) return

    setError(null)
    startTransition(async () => {
      const result = await signupForWaitlist({
        email,
        waitlistType: option.waitlistType!,
      })

      if (!result.success) {
        setError(result.error || "Doslo je do greske")
        return
      }

      setWaitlistSuccess(showWaitlist)
    })
  }, [showWaitlist, email, isEmailValid])

  // Handle continue to next step
  const handleNext = useCallback(() => {
    if (selectedRegime === "pausalni" && !isSubmitting) {
      onNext()
    }
  }, [selectedRegime, isSubmitting, onNext])

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-foreground mb-2">Korak 2: Porezni rezim</h2>
        <p className="text-secondary">Kako se oporezuje vas obrt?</p>
      </div>

      {/* Tax Regime Options */}
      <div className="space-y-3 mb-8" role="radiogroup" aria-label="Porezni rezim">
        {TAX_REGIME_OPTIONS.map((option) => {
          const isSelected = selectedRegime === option.value
          const isWaitlistShown = showWaitlist === option.value
          const isWaitlistComplete = waitlistSuccess === option.value

          return (
            <div key={option.value}>
              <Card
                padding="none"
                className={cn(
                  "transition-all",
                  option.enabled
                    ? cn(
                        "cursor-pointer",
                        isSelected
                          ? "border-interactive ring-2 ring-interactive/20"
                          : "hover:border-interactive/50"
                      )
                    : cn(
                        "cursor-pointer",
                        isWaitlistShown || isWaitlistComplete
                          ? "border-info"
                          : "opacity-75 hover:opacity-100"
                      )
                )}
                onClick={() => !isPending && !isSubmitting && handleOptionClick(option)}
                role="radio"
                aria-checked={isSelected}
                aria-disabled={!option.enabled}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    if (!isPending && !isSubmitting) handleOptionClick(option)
                  }
                }}
              >
                <div className="flex items-center gap-4 p-5">
                  {/* Radio indicator */}
                  <div
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                      isSelected
                        ? "border-interactive bg-interactive"
                        : option.enabled
                          ? "border-border"
                          : "border-muted"
                    )}
                  >
                    {isSelected && <div className="h-2 w-2 rounded-full bg-inverse" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p
                        className={cn(
                          "text-body-base font-medium",
                          option.enabled ? "text-foreground" : "text-muted"
                        )}
                      >
                        {option.label}
                      </p>
                      {!option.enabled && (
                        <Badge variant="secondary" size="sm">
                          Uskoro dostupno
                        </Badge>
                      )}
                    </div>
                    <p
                      className={cn(
                        "text-body-sm",
                        option.enabled ? "text-secondary" : "text-muted"
                      )}
                    >
                      {option.description}
                    </p>
                  </div>
                </div>

                {/* Waitlist Form (shown when disabled option is clicked) */}
                {isWaitlistShown && !isWaitlistComplete && (
                  <div
                    className="px-5 pb-5 border-t border-border"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="pt-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="h-4 w-4 text-info" />
                        <p className="text-body-sm text-info-text">Prijavite se na listu cekanja</p>
                      </div>

                      {error && (
                        <div className="mb-3 p-2 rounded bg-danger/10 border border-danger text-danger text-body-xs">
                          {error}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="vas@email.com"
                          disabled={isPending}
                          error={email.length > 0 && !isEmailValid}
                          className="flex-1"
                        />
                        <Button
                          variant="primary"
                          size="default"
                          onClick={handleWaitlistSignup}
                          disabled={!email || !isEmailValid || isPending}
                        >
                          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Prijavi me"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Waitlist Success (shown after successful signup) */}
                {isWaitlistComplete && (
                  <div
                    className="px-5 pb-5 border-t border-border"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="pt-4 flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success-bg">
                        <Check className="h-4 w-4 text-success" />
                      </div>
                      <div>
                        <p className="text-body-sm font-medium text-success">Hvala na prijavi!</p>
                        <div className="flex items-center gap-1 text-body-xs text-muted">
                          <Mail className="h-3 w-3" />
                          <span>{email}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )
        })}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isSubmitting || isPending}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Natrag
        </Button>

        <Button
          type="button"
          variant="primary"
          onClick={handleNext}
          disabled={selectedRegime !== "pausalni" || isSubmitting || isPending}
        >
          {isSubmitting ? (
            "Spremam..."
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
