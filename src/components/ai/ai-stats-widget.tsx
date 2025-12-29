"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sparkles, TrendingUp, CheckCircle, XCircle, AlertCircle } from "lucide-react"

interface FeedbackStats {
  total: number
  correct: number
  incorrect: number
  partial: number
  accuracy: number
}

interface AIStatsWidgetProps {
  operation?: string
  className?: string
}

export function AIStatsWidget({ operation, className }: AIStatsWidgetProps) {
  const [stats, setStats] = useState<FeedbackStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStats() {
      try {
        const params = new URLSearchParams({ type: "stats" })
        if (operation) params.set("operation", operation)

        const response = await fetch(`/api/ai/feedback?${params}`)
        if (!response.ok) throw new Error("Failed to fetch stats")

        const data = await response.json()
        setStats(data.stats)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load stats")
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [operation])

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-surface-2 rounded w-1/3"></div>
            <div className="h-8 bg-surface-2 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <p className="text-sm text-danger-text">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!stats || stats.total === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-tertiary">
            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Još nema povratnih informacija</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const accuracyColor =
    stats.accuracy >= 80
      ? "text-success-text"
      : stats.accuracy >= 60
        ? "text-warning-text"
        : "text-danger-text"

  const accuracyBgColor =
    stats.accuracy >= 80 ? "bg-success-bg" : stats.accuracy >= 60 ? "bg-warning-bg" : "bg-danger-bg"

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          AI Pouzdanost
          {operation && (
            <Badge variant="secondary" className="text-xs">
              {operation === "ocr_receipt" && "OCR Računi"}
              {operation === "ocr_invoice" && "OCR Fakture"}
              {operation === "category_suggestion" && "Kategorije"}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Accuracy */}
        <div className={`p-4 rounded-lg ${accuracyBgColor}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Točnost</span>
            <div className="flex items-center gap-1">
              <TrendingUp className={`h-4 w-4 ${accuracyColor}`} />
              <span className={`text-2xl font-bold ${accuracyColor}`}>
                {stats.accuracy.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Breakdown */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success-text" />
              <span className="text-secondary">Točno</span>
            </div>
            <span className="font-medium">{stats.correct}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-warning-text" />
              <span className="text-secondary">Djelomično</span>
            </div>
            <span className="font-medium">{stats.partial}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-danger-text" />
              <span className="text-secondary">Netočno</span>
            </div>
            <span className="font-medium">{stats.incorrect}</span>
          </div>
        </div>

        {/* Total */}
        <div className="pt-3 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-secondary">Ukupno ocjena</span>
            <span className="font-semibold">{stats.total}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export interface CompactAIStatsProps {
  operation?: string
  className?: string
}

/**
 * Compact version showing just accuracy percentage
 */
export function CompactAIStats({ operation, className }: CompactAIStatsProps) {
  const [stats, setStats] = useState<FeedbackStats | null>(null)

  useEffect(() => {
    async function fetchStats() {
      try {
        const params = new URLSearchParams({ type: "stats" })
        if (operation) params.set("operation", operation)

        const response = await fetch(`/api/ai/feedback?${params}`)
        if (response.ok) {
          const data = await response.json()
          setStats(data.stats)
        }
      } catch (err) {
        console.error("Failed to fetch AI stats:", err)
      }
    }

    fetchStats()
  }, [operation])

  if (!stats || stats.total === 0) return null

  const variant =
    stats.accuracy >= 80 ? "default" : stats.accuracy >= 60 ? "secondary" : "destructive"

  return (
    <Badge variant={variant} className={className}>
      <Sparkles className="h-3 w-3 mr-1" />
      AI: {stats.accuracy.toFixed(0)}% ({stats.total})
    </Badge>
  )
}
