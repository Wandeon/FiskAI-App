"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ProgressBar } from "@/components/ui/progress-bar"
import {
  Calculator,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  FileText,
} from "lucide-react"
import Link from "next/link"
import { formatCurrency } from "@/lib/posd/posd-calculator"

interface PausalniStatusCardProps {
  ytdRevenue: number
  vatThreshold: number
  nextDeadline: {
    title: string
    date: Date
    daysLeft: number
    type: "doprinosi" | "posd"
  } | null
  quarterlyIncome: {
    q1: number
    q2: number
    q3: number
    q4: number
  }
}

export function PausalniStatusCard({
  ytdRevenue,
  vatThreshold,
  nextDeadline,
  quarterlyIncome,
}: PausalniStatusCardProps) {
  const vatPercentage = Math.min((ytdRevenue / vatThreshold) * 100, 100)
  const isNearThreshold = vatPercentage >= 80
  const isOverThreshold = vatPercentage >= 100

  return (
    <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-blue-500/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Calculator className="h-4 w-4 text-accent" />
            Paušalni obrt status
          </CardTitle>
          <Badge
            variant={isOverThreshold ? "destructive" : isNearThreshold ? "warning" : "secondary"}
          >
            {isOverThreshold ? "Preko praga!" : isNearThreshold ? "Blizu praga" : "U redu"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* VAT Threshold Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">PDV prag (60.000 €)</span>
            <span className="font-medium">{vatPercentage.toFixed(1)}%</span>
          </div>
          <ProgressBar
            value={vatPercentage}
            variant={isOverThreshold ? "danger" : isNearThreshold ? "warning" : "default"}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatCurrency(ytdRevenue)}</span>
            <span>{formatCurrency(vatThreshold)}</span>
          </div>
        </div>

        {/* Next Deadline */}
        {nextDeadline && (
          <div
            className={`rounded-lg p-3 ${
              nextDeadline.daysLeft <= 3
                ? "bg-danger/10 border border-red-500/20"
                : nextDeadline.daysLeft <= 7
                  ? "bg-warning/10 border border-amber-500/20"
                  : "bg-muted/50"
            }`}
          >
            <div className="flex items-start gap-3">
              {nextDeadline.daysLeft <= 3 ? (
                <AlertTriangle className="h-5 w-5 text-danger-icon mt-0.5" />
              ) : (
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium">{nextDeadline.title}</p>
                <p className="text-xs text-muted-foreground">
                  {nextDeadline.date.toLocaleDateString("hr-HR")} •
                  {nextDeadline.daysLeft === 0
                    ? " Danas!"
                    : nextDeadline.daysLeft === 1
                      ? " Sutra!"
                      : ` još ${nextDeadline.daysLeft} dana`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link href="/reports/pausalni-obrt">
              <FileText className="h-4 w-4 mr-1" />
              PO-SD
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link href="/alati/posd-kalkulator">
              <Calculator className="h-4 w-4 mr-1" />
              Kalkulator
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
