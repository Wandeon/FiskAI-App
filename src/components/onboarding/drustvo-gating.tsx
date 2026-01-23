"use client"

import { useState, useCallback, useTransition } from "react"
import { Clock, ArrowLeft, Loader2, Check, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { signupForWaitlist } from "@/lib/actions/waitlist"
import type { WaitlistType } from "@/lib/actions/waitlist.types"

/**
 * Društvo type options for the waitlist
 */
type DrustvoType = "drustvo-jdoo" | "drustvo-doo"

interface DrustvoOption {
  value: DrustvoType
  label: string
  description: string
}

const DRUSTVO_OPTIONS: DrustvoOption[] = [
  {
    value: "drustvo-jdoo",
    label: "j.d.o.o.",
    description: "Jednostavno društvo s ograničenom odgovornošću",
  },
  {
    value: "drustvo-doo",
    label: "d.o.o.",
    description: "Društvo s ograničenom odgovornošću",
  },
]

interface DrushtvoGatingProps {
  /**
   * Called when user clicks "Promijeni odabir" to go back to intent selector
   */
  onChangeSelection: () => void
  /**
   * Whether the change selection action is pending
   */
  isChangePending?: boolean
}

/**
 * Društvo Gating Component
 *
 * Displays a waitlist signup form for users who selected Društvo (j.d.o.o. or d.o.o.)
 * as their business type. Since Društvo is not yet supported, this captures their
 * interest without creating any Company records.
 */
export function DrushtvoGating({
  onChangeSelection,
  isChangePending = false,
}: DrushtvoGatingProps) {
  const [email, setEmail] = useState("")
  const [selectedType, setSelectedType] = useState<DrustvoType | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Basic email validation
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const isFormValid = email.length > 0 && isEmailValid && selectedType !== null

  const handleSubmit = useCallback(() => {
    if (!isFormValid || !selectedType) return

    setError(null)
    startTransition(async () => {
      const result = await signupForWaitlist({
        email,
        waitlistType: selectedType as WaitlistType,
      })

      if (!result.success) {
        setError(result.error || "Došlo je do greške")
        return
      }

      setSuccess(true)
    })
  }, [email, selectedType, isFormValid])

  // Success state - show confirmation
  if (success) {
    return (
      <Card padding="lg" className="text-center">
        <div className="flex justify-center mb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-bg">
            <Check className="h-8 w-8 text-success" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-3">Hvala na prijavi!</h1>

        <p className="text-secondary mb-6">
          Obavijestit cemo vas cim podrska za{" "}
          {selectedType === "drustvo-jdoo" ? "j.d.o.o." : "d.o.o."} bude dostupna.
        </p>

        <div className="flex items-center justify-center gap-2 text-sm text-muted mb-6">
          <Mail className="h-4 w-4" />
          <span>{email}</span>
        </div>

        <Button
          variant="outline"
          onClick={onChangeSelection}
          disabled={isChangePending}
          className="w-full"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {isChangePending ? "Spremam..." : "Promijeni odabir"}
        </Button>
      </Card>
    )
  }

  return (
    <Card padding="lg">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex justify-center mb-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-info-bg">
            <Clock className="h-7 w-7 text-info" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">
          Podrska za drustva dolazi uskoro
        </h1>

        <p className="text-secondary">
          Trenutno podrzavamo samo pausalne obrte. Rad na podrsci za j.d.o.o. i d.o.o. je u tijeku.
        </p>
      </div>

      {/* Waitlist Form */}
      <div className="p-5 rounded-lg bg-surface-1 border border-border mb-6">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger text-danger text-sm">
            {error}
          </div>
        )}

        {/* Email Field */}
        <div className="mb-4">
          <label
            htmlFor="waitlist-email"
            className="text-body-sm font-medium text-foreground mb-1 block"
          >
            Email
          </label>
          <Input
            id="waitlist-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vas@email.com"
            disabled={isPending}
            error={email.length > 0 && !isEmailValid}
          />
          {email.length > 0 && !isEmailValid && (
            <p className="mt-1 text-body-xs text-danger">Unesite ispravnu email adresu</p>
          )}
        </div>

        {/* Društvo Type Selection */}
        <div className="mb-4">
          <p className="text-body-sm font-medium text-foreground mb-2">Tip drustva</p>
          <div className="space-y-2" role="radiogroup" aria-label="Tip drustva">
            {DRUSTVO_OPTIONS.map((option) => {
              const isSelected = selectedType === option.value

              return (
                <div
                  key={option.value}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    isSelected
                      ? "border-interactive bg-interactive/5"
                      : "border-border hover:border-interactive/50"
                  )}
                  onClick={() => !isPending && setSelectedType(option.value)}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      if (!isPending) setSelectedType(option.value)
                    }
                  }}
                >
                  {/* Radio indicator */}
                  <div
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                      isSelected ? "border-interactive bg-interactive" : "border-border"
                    )}
                  >
                    {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-inverse" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm font-medium text-foreground">{option.label}</p>
                    <p className="text-body-xs text-muted truncate">{option.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Submit Button */}
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!isFormValid || isPending}
          className="w-full"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Prijavljujem...
            </>
          ) : (
            "Obavijesti me kada bude dostupno"
          )}
        </Button>
      </div>

      {/* Back Button */}
      <Button
        variant="outline"
        onClick={onChangeSelection}
        disabled={isChangePending || isPending}
        className="w-full"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        {isChangePending ? "Spremam..." : "Promijeni odabir"}
      </Button>
    </Card>
  )
}
