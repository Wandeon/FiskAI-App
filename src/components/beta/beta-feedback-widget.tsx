"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { submitBetaFeedback } from "@/lib/beta/actions"
import { MessageSquare, X, Send, Star, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface BetaFeedbackWidgetProps {
  feature: string
  className?: string
}

/**
 * A floating feedback widget for beta features.
 * Shows a collapsible panel where users can quickly submit feedback.
 */
export function BetaFeedbackWidget({ feature, className }: BetaFeedbackWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [feedbackText, setFeedbackText] = useState("")
  const [selectedRating, setSelectedRating] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = () => {
    if (!feedbackText.trim() && !selectedRating) return

    startTransition(async () => {
      await submitBetaFeedback({
        feature,
        rating: selectedRating ?? undefined,
        feedback: feedbackText.trim() || undefined,
        metadata: {
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
          url: typeof window !== "undefined" ? window.location.href : undefined,
        },
      })
      setSubmitted(true)
      setFeedbackText("")
      setSelectedRating(null)
      setTimeout(() => {
        setSubmitted(false)
        setIsOpen(false)
      }, 2000)
    })
  }

  return (
    <div className={cn("fixed bottom-4 right-4 z-50", className)}>
      {/* Collapsed Button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="rounded-full bg-interactive p-3 text-inverse shadow-lg hover:bg-interactive-hover"
          aria-label="Posalji povratnu informaciju o beta funkcionalnosti"
        >
          <MessageSquare className="h-5 w-5" />
        </Button>
      )}

      {/* Expanded Panel */}
      {isOpen && (
        <div className="w-80 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-info-bg p-1.5 text-info-text">
                <MessageSquare className="h-4 w-4" />
              </div>
              <span className="font-semibold text-[var(--foreground)]">
                Beta povratna informacija
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-[var(--muted)] hover:bg-[var(--surface-secondary)]"
              aria-label="Zatvori"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {submitted ? (
            <div className="flex flex-col items-center justify-center py-6 text-success-text">
              <Check className="h-8 w-8 mb-2" />
              <p className="font-medium">Hvala!</p>
              <p className="text-sm text-[var(--muted)]">Vasa povratna informacija je primljena</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Rating */}
              <div>
                <p className="mb-1.5 text-xs font-medium text-[var(--muted)]">Vasa ocjena</p>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      onClick={() => setSelectedRating(rating)}
                      className={cn(
                        "rounded p-1.5 transition-colors",
                        selectedRating && selectedRating >= rating
                          ? "text-warning"
                          : "text-muted hover:text-warning"
                      )}
                      aria-label={`Ocjena ${rating} od 5`}
                    >
                      <Star
                        className="h-5 w-5"
                        fill={selectedRating && selectedRating >= rating ? "currentColor" : "none"}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Feedback Text */}
              <div>
                <p className="mb-1.5 text-xs font-medium text-[var(--muted)]">
                  Vasa poruka (opcionalno)
                </p>
                <Textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Sto mislite o ovoj funkcionalnosti?"
                  className="min-h-[80px] text-sm"
                />
              </div>

              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={isPending || (!feedbackText.trim() && !selectedRating)}
                className="w-full"
                size="sm"
              >
                <Send className="mr-2 h-4 w-4" />
                Posalji
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
