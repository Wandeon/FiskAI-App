"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertTriangle, AlertCircle, Info, ArrowRight, Filter, X, Check, Clock, CheckCircle } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { Alert, AlertLevel, AlertType } from "@/lib/admin/alerts"

const LEVEL_STYLES: Record<AlertLevel, { icon: typeof AlertTriangle; color: string }> = {
  critical: { icon: AlertCircle, color: "text-red-600 bg-red-50 border-red-200" },
  warning: { icon: AlertTriangle, color: "text-amber-600 bg-amber-50 border-amber-200" },
  info: { icon: Info, color: "text-blue-600 bg-blue-50 border-blue-200" },
}

const ALERT_TYPES: Record<AlertType, string> = {
  "onboarding-stuck": "Stuck in Onboarding",
  "approaching-limit": "Approaching Limit",
  "critical-limit": "Critical Limit",
  "cert-expiring": "Certificate Expiring",
  "cert-expired": "Certificate Expired",
  inactive: "Inactive Account",
  "support-ticket": "Support Ticket",
}

interface AlertsPageProps {
  alerts: Alert[]
}

export function AlertsPage({ alerts }: AlertsPageProps) {
  const [filterLevel, setFilterLevel] = useState<AlertLevel | "all">("all")
  const [filterType, setFilterType] = useState<AlertType | "all">("all")
  const [loadingAlerts, setLoadingAlerts] = useState<Set<string>>(new Set())
  const router = useRouter()

  const filteredAlerts = alerts.filter((alert) => {
    if (filterLevel !== "all" && alert.level !== filterLevel) return false
    if (filterType !== "all" && alert.type !== filterType) return false
    return true
  })

  const criticalCount = alerts.filter((a) => a.level === "critical").length
  const warningCount = alerts.filter((a) => a.level === "warning").length
  const infoCount = alerts.filter((a) => a.level === "info").length

  const handleAlertAction = async (
    alert: Alert,
    action: "dismiss" | "resolve" | "acknowledge"
  ) => {
    const alertKey = `${alert.type}-${alert.companyId}`
    setLoadingAlerts((prev) => new Set(prev).add(alertKey))

    try {
      const response = await fetch("/api/admin/alerts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          companyId: alert.companyId,
          type: alert.type,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to ${action} alert`)
      }

      router.refresh()
    } catch (error) {
      console.error(`Error ${action} alert:`, error)
      alert(`Failed to ${action} alert. Please try again.`)
    } finally {
      setLoadingAlerts((prev) => {
        const newSet = new Set(prev)
        newSet.delete(alertKey)
        return newSet
      })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Platform Alerts</h1>
        <p className="text-muted-foreground">Monitor and respond to critical platform events</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Warning Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{warningCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Info Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{infoCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Alert Level</label>
            <Select
              value={filterLevel}
              onValueChange={(v) => setFilterLevel(v as AlertLevel | "all")}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Alert Type</label>
            <Select value={filterType} onValueChange={(v) => setFilterType(v as AlertType | "all")}>
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(ALERT_TYPES).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(filterLevel !== "all" || filterType !== "all") && (
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setFilterLevel("all")
                  setFilterType("all")
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alerts List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Active Alerts ({filteredAlerts.length})</span>
            {filteredAlerts.length !== alerts.length && (
              <Badge variant="secondary">Filtered from {alerts.length} total</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredAlerts.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              {alerts.length === 0 ? "No active alerts" : "No alerts match the selected filters"}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAlerts.map((alert) => {
                const { icon: Icon, color } = LEVEL_STYLES[alert.level]
                const alertKey = `${alert.type}-${alert.companyId}`
                const isLoading = loadingAlerts.has(alertKey)

                return (
                  <div
                    key={alert.id}
                    className={`flex items-start gap-3 p-4 rounded-lg border ${color}`}
                  >
                    <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{alert.companyName}</span>
                        <Badge variant="outline" className="text-xs">
                          {ALERT_TYPES[alert.type]}
                        </Badge>
                        <Badge
                          variant={
                            alert.level === "critical"
                              ? "destructive"
                              : alert.level === "warning"
                                ? "default"
                                : "secondary"
                          }
                          className="text-xs"
                        >
                          {alert.level.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium mt-1">{alert.title}</p>
                      <p className="text-sm text-muted-foreground">{alert.description}</p>
                      {alert.autoAction && (
                        <p className="text-sm mt-2 font-medium">
                          Suggested Action: {alert.autoAction}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Created: {alert.createdAt.toLocaleString("hr-HR")}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAlertAction(alert, "resolve")}
                        disabled={isLoading}
                        title="Mark as resolved"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Resolve
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAlertAction(alert, "acknowledge")}
                        disabled={isLoading}
                        title="Acknowledge alert"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Acknowledge
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAlertAction(alert, "dismiss")}
                        disabled={isLoading}
                        title="Dismiss alert"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Dismiss
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/tenants/${alert.companyId}`}>
                          <ArrowRight className="h-4 w-4 mr-1" />
                          View
                        </Link>
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
