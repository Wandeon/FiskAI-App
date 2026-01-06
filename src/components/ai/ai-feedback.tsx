"use client"

import { useState } from "react"
import { ThumbsUp, ThumbsDown, AlertCircle, MessageSquare, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { clsx } from "clsx"

export interface AIFeedbackProps {
  entityType: string
  entityId: string
  operation: "ocr_receipt" | "ocr_invoice" | "category_suggestion"
  confidence?: number
  className?: string
  compact?: boolean
  onFeedbackSubmitted?: () => void
}

export function AIFeedback({
  entityType,
  entityId,
  operation,
  confidence,
  className,
  compact = false,
  onFeedbackSubmitted,
}: AIFeedbackProps) {
  const [feedbackGiven, setFeedbackGiven] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [notes, setNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedFeedback, setSelectedFeedback] = useState<
    "correct" | "incorrect" | "partial" | null
  >(null)

  const submitFeedback = async (
    feedback: "correct" | "incorrect" | "partial",
    includeNotes: boolean = false
  ) => {
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/ai/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId,
          operation,
          feedback,
          notes: includeNotes ? notes : undefined,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to submit feedback")
      }

      setFeedbackGiven(true)
      setShowNotes(false)
      setNotes("")
      onFeedbackSubmitted?.()
    } catch (error) {
      console.error("Failed to submit feedback:", error)
    } finally {
      setIsSubmitting(false)
      setSelectedFeedback(null)
    }
  }

  const handleFeedbackClick = (feedback: "correct" | "incorrect" | "partial") => {
    if (feedback === "incorrect" || feedback === "partial") {
      setSelectedFeedback(feedback)
      setShowNotes(true)
    } else {
      void submitFeedback(feedback)
    }
  }

  const handleNotesSubmit = () => {
    if (selectedFeedback) {
      void submitFeedback(selectedFeedback, true)
    }
  }

  const handleNotesCancel = () => {
    setShowNotes(false)
    setNotes("")
    setSelectedFeedback(null)
  }

  if (feedbackGiven) {
    return (
      <div className={clsx("text-sm text-success-text", className)}>
        Hvala na povratnoj informaciji!
      </div>
    )
  }

  if (showNotes) {
    return (
      <div className={clsx("space-y-2 p-3 border rounded-lg bg-surface-1", className)}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Što je bilo pogrešno?</p>
          <Button variant="ghost" size="sm" onClick={handleNotesCancel} disabled={isSubmitting}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <textarea
          className="w-full px-3 py-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-border-focus"
          rows={3}
          placeholder="Opišite što je AI krivo prepoznao..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={isSubmitting}
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={handleNotesSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Šaljem..." : "Pošalji"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (selectedFeedback) {
                void submitFeedback(selectedFeedback, false)
              }
            }}
            disabled={isSubmitting}
          >
            Preskoči
          </Button>
        </div>
      </div>
    )
  }

  if (compact) {
    return (
      <div className={clsx("flex items-center gap-2", className)}>
        {confidence !== undefined && <AIConfidenceBadge confidence={confidence} />}
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleFeedbackClick("correct")}
            disabled={isSubmitting}
            className="p-1 text-muted hover:text-success-text transition-colors disabled:opacity-50"
            title="Točno"
          >
            <ThumbsUp className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleFeedbackClick("incorrect")}
            disabled={isSubmitting}
            className="p-1 text-muted hover:text-danger-text transition-colors disabled:opacity-50"
            title="Netočno"
          >
            <ThumbsDown className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleFeedbackClick("partial")}
            disabled={isSubmitting}
            className="p-1 text-muted hover:text-warning transition-colors disabled:opacity-50"
            title="Prijavi problem"
          >
            <AlertCircle className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={clsx("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted" />
          <span className="text-sm text-secondary">Je li AI dobro prepoznao?</span>
        </div>
        {confidence !== undefined && <AIConfidenceBadge confidence={confidence} />}
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleFeedbackClick("correct")}
          disabled={isSubmitting}
          className="flex-1"
        >
          <ThumbsUp className="h-4 w-4 mr-1" />
          Da
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleFeedbackClick("partial")}
          disabled={isSubmitting}
          className="flex-1"
        >
          <AlertCircle className="h-4 w-4 mr-1" />
          Djelomično
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleFeedbackClick("incorrect")}
          disabled={isSubmitting}
          className="flex-1"
        >
          <ThumbsDown className="h-4 w-4 mr-1" />
          Ne
        </Button>
      </div>
    </div>
  )
}

export interface AIConfidenceBadgeProps {
  confidence: number
  className?: string
}

export function AIConfidenceBadge({ confidence, className }: AIConfidenceBadgeProps) {
  const percentage = Math.round(confidence * 100)
  const variant = percentage >= 80 ? "default" : percentage >= 60 ? "secondary" : "destructive"

  const label =
    percentage >= 80
      ? "Visoka pouzdanost"
      : percentage >= 60
        ? "Srednja pouzdanost"
        : "Niska pouzdanost"

  return (
    <Badge variant={variant} className={className}>
      {label} ({percentage}%)
    </Badge>
  )
}
