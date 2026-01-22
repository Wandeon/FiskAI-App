"use client"

import { useState, useCallback, useTransition } from "react"
import { Building2, Briefcase, ArrowRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/**
 * Registration intent type
 * Matches Prisma RegistrationIntent enum values
 */
export type RegistrationIntentType = "OBRT" | "DRUSTVO"

interface IntentOption {
  value: RegistrationIntentType
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const INTENT_OPTIONS: IntentOption[] = [
  {
    value: "OBRT",
    label: "Obrt",
    description: "Samostalna djelatnost",
    icon: Briefcase,
  },
  {
    value: "DRUSTVO",
    label: "Društvo",
    description: "j.d.o.o. ili d.o.o.",
    icon: Building2,
  },
]

interface IntentSelectorProps {
  /**
   * Server action to save the selected intent
   * Should be passed from the parent page component
   */
  onSaveIntent: (intent: RegistrationIntentType) => Promise<{ success?: boolean; error?: string }>
  /**
   * Callback after intent is successfully saved
   */
  onIntentSaved?: () => void
}

/**
 * Intent Selector Component
 *
 * For users who didn't select intent at registration (backwards compatibility).
 * Shows two options: Obrt or Drustvo.
 * On selection, calls the provided save action and notifies parent.
 */
export function IntentSelector({ onSaveIntent, onIntentSaved }: IntentSelectorProps) {
  const [selectedIntent, setSelectedIntent] = useState<RegistrationIntentType | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(() => {
    if (!selectedIntent) return

    setError(null)
    startTransition(async () => {
      const result = await onSaveIntent(selectedIntent)

      if (result.error) {
        setError(result.error)
        return
      }

      // Callback to refresh/reload the parent component
      if (onIntentSaved) {
        onIntentSaved()
      } else {
        // Fallback: reload the page to trigger re-render with new intent
        window.location.reload()
      }
    })
  }, [selectedIntent, onSaveIntent, onIntentSaved])

  return (
    <div className="max-w-lg mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">Koju vrstu poslovanja imate?</h1>
        <p className="text-secondary">
          Odaberite vrstu vašeg poslovanja kako bismo prilagodili iskustvo
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-danger/10 border border-danger text-danger text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4 mb-8" role="radiogroup" aria-label="Vrsta poslovanja">
        {INTENT_OPTIONS.map((option) => {
          const Icon = option.icon
          const isSelected = selectedIntent === option.value

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
              onClick={() => setSelectedIntent(option.value)}
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  setSelectedIntent(option.value)
                }
              }}
            >
              <div className="flex items-center gap-4 p-5">
                {/* Radio indicator */}
                <div
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    isSelected ? "border-interactive bg-interactive" : "border-border"
                  )}
                >
                  {isSelected && <div className="h-2 w-2 rounded-full bg-inverse" />}
                </div>

                {/* Icon */}
                <div
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-lg transition-colors",
                    isSelected ? "bg-interactive/10" : "bg-surface-1"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-6 w-6 transition-colors",
                      isSelected ? "text-interactive" : "text-muted"
                    )}
                  />
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

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={handleSubmit}
        disabled={!selectedIntent || isPending}
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Spremam...
          </>
        ) : (
          <>
            Nastavi
            <ArrowRight className="h-4 w-4 ml-2" />
          </>
        )}
      </Button>
    </div>
  )
}
