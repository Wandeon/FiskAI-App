// src/components/dashboard/deadline-countdown-card.tsx
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock, AlertTriangle, CheckCircle2 } from "lucide-react"
import Link from "next/link"

interface Deadline {
  id: string
  title: string
  deadlineDate: string
  deadlineType: string
  severity: string | null
  description?: string | null
}

interface DeadlineCountdownCardProps {
  deadlines: Deadline[]
  businessType: string
}

function getDaysUntil(dateStr: string): number {
  const deadline = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  deadline.setHours(0, 0, 0, 0)
  return Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function getSeverityColor(daysLeft: number, severity: string | null) {
  if (daysLeft <= 0) return "destructive"
  if (daysLeft <= 3 || severity === "critical") return "destructive"
  if (daysLeft <= 7 || severity === "high") return "warning"
  return "secondary"
}

export function DeadlineCountdownCard({ deadlines, businessType }: DeadlineCountdownCardProps) {
  if (deadlines.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Calendar className="h-4 w-4" />
            Nadolazeći rokovi
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-success-icon" />
            Nema rokova u sljedećih 30 dana
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Calendar className="h-4 w-4" />
            Nadolazeći rokovi
          </CardTitle>
          <Link
            href="/alati/kalendar"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Svi rokovi →
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {deadlines.slice(0, 4).map((deadline) => {
          const daysLeft = getDaysUntil(deadline.deadlineDate)
          const severity = getSeverityColor(daysLeft, deadline.severity)

          return (
            <div
              key={deadline.id}
              className={`flex items-start gap-3 rounded-lg p-2 ${
                daysLeft <= 3 ? "bg-danger/10" : daysLeft <= 7 ? "bg-warning/10" : "bg-muted/30"
              }`}
            >
              {daysLeft <= 3 ? (
                <AlertTriangle className="h-4 w-4 text-danger-icon mt-0.5 shrink-0" />
              ) : (
                <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{deadline.title}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(deadline.deadlineDate).toLocaleDateString("hr-HR", {
                    day: "numeric",
                    month: "short",
                  })}
                </p>
              </div>
              <Badge variant={severity} className="shrink-0">
                {daysLeft <= 0 ? "Prošao!" : daysLeft === 1 ? "Sutra" : `${daysLeft}d`}
              </Badge>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
