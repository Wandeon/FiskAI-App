"use client"

import { useState, useTransition } from "react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toggleBetaOptIn, submitBetaFeedback } from "@/lib/beta/actions"
import { FlaskConical, Send, Star, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface BetaSettingsFormProps {
  initialBetaOptIn: boolean
  initialBetaOptInAt: Date | null
}

export function BetaSettingsForm({ initialBetaOptIn, initialBetaOptInAt }: BetaSettingsFormProps) {
  const [betaOptIn, setBetaOptIn] = useState(initialBetaOptIn)
  const [isPending, startTransition] = useTransition()
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const [feedbackText, setFeedbackText] = useState("")
  const [selectedRating, setSelectedRating] = useState<number | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<"bug" | "suggestion" | "praise" | "other" | null>(null)

  const handleToggle = (checked: boolean) => {
    startTransition(async () => {
      const result = await toggleBetaOptIn(checked)
      if (result.success) {
        setBetaOptIn(result.betaOptIn)
      }
    })
  }

  const handleSubmitFeedback = () => {
    if (!feedbackText.trim() && !selectedRating) return

    startTransition(async () => {
      await submitBetaFeedback({
        feature: "reasoning",
        rating: selectedRating ?? undefined,
        feedback: feedbackText.trim() || undefined,
        category: selectedCategory ?? undefined,
        metadata: {
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
          url: typeof window !== "undefined" ? window.location.href : undefined,
        },
      })
      setFeedbackSubmitted(true)
      setFeedbackText("")
      setSelectedRating(null)
      setSelectedCategory(null)
      setTimeout(() => setFeedbackSubmitted(false), 3000)
    })
  }

  const categories = [
    { value: "bug" as const, label: "Bug" },
    { value: "suggestion" as const, label: "Prijedlog" },
    { value: "praise" as const, label: "Pohvala" },
    { value: "other" as const, label: "Ostalo" },
  ]

  return (
    <div className="space-y-6">
      {/* Beta Opt-In Toggle */}
      <div className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-info-bg p-2 text-info-text">
            <FlaskConical className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-[var(--foreground)]">Beta program</p>
              {betaOptIn && (
                <Badge variant="info" className="text-xs">
                  Aktivno
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Pristupite novim funkcionalnostima prije ostalih korisnika. Beta verzije mogu sadrzavati bugove.
            </p>
            {betaOptIn && initialBetaOptInAt && (
              <p className="mt-2 text-xs text-[var(--muted)]">
                Pridruzili ste se:{" "}
                {new Date(initialBetaOptInAt).toLocaleDateString("hr-HR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            )}
          </div>
        </div>
        <Switch
          checked={betaOptIn}
          onCheckedChange={handleToggle}
          disabled={isPending}
          aria-label="Ukljuci beta program"
        />
      </div>

      {/* Beta Features Info */}
      {betaOptIn && (
        <div className="rounded-xl bg-info-bg p-4">
          <p className="font-semibold text-info-text">Aktivne beta funkcionalnosti</p>
          <ul className="mt-2 space-y-1 text-sm text-info-text">
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              <span>Napredno AI obrazlozenje - vidite kako AI dolazi do odgovora</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              <span>Poboljsani prijedlozi na temelju regulatornih promjena</span>
            </li>
          </ul>
        </div>
      )}

      {/* Feedback Section */}
      {betaOptIn && (
        <div className="rounded-xl border border-[var(--border)] p-4">
          <button
            onClick={() => setShowFeedback(!showFeedback)}
            className="flex w-full items-center justify-between text-left"
          >
            <div>
              <p className="font-semibold text-[var(--foreground)]">Posaljite povratnu informaciju</p>
              <p className="text-sm text-[var(--muted)]">
                Pomozite nam poboljsati beta funkcionalnosti
              </p>
            </div>
            <Send className="h-5 w-5 text-[var(--muted)]" />
          </button>

          {showFeedback && (
            <div className="mt-4 space-y-4 border-t border-[var(--border)] pt-4">
              {/* Rating */}
              <div>
                <p className="mb-2 text-sm font-medium text-[var(--foreground)]">Vasa ocjena</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      onClick={() => setSelectedRating(rating)}
                      className={cn(
                        "rounded-lg p-2 transition-colors",
                        selectedRating && selectedRating >= rating
                          ? "text-warning-icon"
                          : "text-muted hover:text-warning-text"
                      )}
                      aria-label={`Ocjena ${rating} od 5`}
                    >
                      <Star
                        className="h-6 w-6"
                        fill={selectedRating && selectedRating >= rating ? "currentColor" : "none"}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div>
                <p className="mb-2 text-sm font-medium text-[var(--foreground)]">Kategorija</p>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => setSelectedCategory(cat.value)}
                      className={cn(
                        "rounded-full px-3 py-1 text-sm transition-colors",
                        selectedCategory === cat.value
                          ? "bg-brand-600 text-white"
                          : "bg-[var(--surface-secondary)] text-[var(--foreground)] hover:bg-[var(--border)]"
                      )}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Feedback Text */}
              <div>
                <p className="mb-2 text-sm font-medium text-[var(--foreground)]">Vasa poruka</p>
                <Textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Opisite svoje iskustvo, prijedloge ili probleme..."
                  className="min-h-[100px]"
                />
              </div>

              {/* Submit */}
              <div className="flex items-center justify-between">
                {feedbackSubmitted ? (
                  <div className="flex items-center gap-2 text-sm text-success-text">
                    <Check className="h-4 w-4" />
                    <span>Hvala na povratnoj informaciji!</span>
                  </div>
                ) : (
                  <div />
                )}
                <Button
                  onClick={handleSubmitFeedback}
                  disabled={isPending || (!feedbackText.trim() && !selectedRating)}
                >
                  Posalji
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
