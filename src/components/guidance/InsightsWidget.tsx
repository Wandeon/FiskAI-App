// src/components/guidance/InsightsWidget.tsx
"use client"

import { useState, useEffect } from "react"
import { Lightbulb, TrendingUp, TrendingDown, Receipt, Wallet, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface Insight {
  type: "invoice_reminder" | "expense_pattern" | "revenue_trend" | "compliance_risk"
  title: string
  description: string
  confidence: number
  suggestedAction?: {
    label: string
    href: string
  }
}

interface InsightsWidgetProps {
  className?: string
}

const typeIcons = {
  invoice_reminder: Receipt,
  expense_pattern: Wallet,
  revenue_trend: TrendingUp,
  compliance_risk: TrendingDown,
}

const typeColors = {
  invoice_reminder: "text-blue-400 bg-chart-1/10",
  expense_pattern: "text-amber-400 bg-amber-400/10",
  revenue_trend: "text-emerald-400 bg-chart-4/10",
  compliance_risk: "text-red-400 bg-red-400/10",
}

export function InsightsWidget({ className }: InsightsWidgetProps) {
  const [insights, setInsights] = useState<Insight[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchInsights() {
      try {
        const res = await fetch("/api/guidance/insights")
        if (res.ok) {
          const data = await res.json()
          setInsights(data.insights || [])
        }
      } catch (error) {
        console.error("Failed to fetch insights:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchInsights()
  }, [])

  if (isLoading) {
    return (
      <div className={cn("rounded-2xl surface-glass p-4", className)}>
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="h-5 w-5 text-amber-400" />
          <span className="font-semibold text-white">Uvidi</span>
        </div>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (insights.length === 0) {
    return (
      <div className={cn("rounded-2xl surface-glass p-4", className)}>
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="h-5 w-5 text-amber-400" />
          <span className="font-semibold text-white">Uvidi</span>
        </div>
        <p className="text-sm text-white/60">
          Nema dovoljno podataka za pametne prijedloge. Nastavite koristiti FiskAI!
        </p>
      </div>
    )
  }

  return (
    <div className={cn("rounded-2xl surface-glass p-4", className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-400" />
          <span className="font-semibold text-white">Pametni uvidi</span>
        </div>
        <span className="text-xs text-white/40 bg-white/5 px-2 py-0.5 rounded-full">AI</span>
      </div>

      <div className="space-y-3">
        {insights.slice(0, 3).map((insight, index) => {
          const Icon = typeIcons[insight.type]
          const colorClasses = typeColors[insight.type]

          return (
            <div
              key={index}
              className="rounded-xl bg-white/5 p-3 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className={cn("rounded-lg p-2", colorClasses)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{insight.title}</p>
                  <p className="text-xs text-white/60 mt-0.5 line-clamp-2">{insight.description}</p>
                  {insight.suggestedAction && (
                    <Link
                      href={insight.suggestedAction.href}
                      className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 mt-2"
                    >
                      {insight.suggestedAction.label}
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
