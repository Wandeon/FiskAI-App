"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertTriangle, AlertCircle, Info, ArrowRight } from "lucide-react"
import Link from "next/link"
import type { Alert, AlertLevel } from "@/lib/admin/alerts"

const LEVEL_STYLES: Record<AlertLevel, { icon: typeof AlertTriangle; color: string }> = {
  critical: { icon: AlertCircle, color: "text-red-600 bg-red-50 border-red-200" },
  warning: { icon: AlertTriangle, color: "text-amber-600 bg-amber-50 border-amber-200" },
  info: { icon: Info, color: "text-blue-600 bg-blue-50 border-blue-200" },
}

export function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No active alerts
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Needs Attention ({alerts.length})</span>
          <Badge variant="destructive">
            {alerts.filter((a) => a.level === "critical").length} Critical
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.slice(0, 10).map((alert) => {
          const { icon: Icon, color } = LEVEL_STYLES[alert.level]
          return (
            <div key={alert.id} className={`flex items-start gap-3 p-3 rounded-lg border ${color}`}>
              <Icon className="h-5 w-5 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{alert.companyName}</span>
                  <Badge variant="outline" className="text-xs">
                    {alert.type}
                  </Badge>
                </div>
                <p className="text-sm">{alert.title}</p>
                <p className="text-xs text-muted-foreground">{alert.description}</p>
                {alert.autoAction && <p className="text-xs mt-1">Auto: {alert.autoAction}</p>}
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/tenants/${alert.companyId}`}>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
