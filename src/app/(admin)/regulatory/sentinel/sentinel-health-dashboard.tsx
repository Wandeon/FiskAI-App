"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Activity,
  Server,
  RefreshCw,
  Clock,
  TrendingUp,
  XCircle,
  Eye,
} from "lucide-react"
import Link from "next/link"

interface SentinelHealthData {
  timestamp: string
  status: "healthy" | "warning" | "critical"
  domains: Record<
    string,
    {
      isHealthy: boolean
      successRate: number
      consecutiveErrors: number
      isCircuitBroken: boolean
      lastSuccessAt?: string
      lastError?: string
    }
  >
  runs: {
    total24h: number
    completed: number
    failed: number
    running: number
    successRate: number
    lastSuccessful: {
      id: string
      startedAt: string
      completedAt: string
      duration: number | null
      output: any
    } | null
    recent: Array<{
      id: string
      status: string
      startedAt: string
      completedAt: string | null
      duration: number | null
      error: string | null
    }>
  }
  sources: {
    total: number
    needingCheck: number
    percentageOverdue: number
  }
  discovery: {
    last7days: number
    evidenceFetched24h: number
  }
  endpoints: Array<{
    domain: string
    count: number
    lastChecked: string | null
  }>
}

export function SentinelHealthDashboard({ initialData }: { initialData: SentinelHealthData }) {
  const [data, setData] = useState<SentinelHealthData>(initialData)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(new Date())

  const refresh = async () => {
    setIsRefreshing(true)
    try {
      const res = await fetch("/api/admin/sentinel/health")
      if (res.ok) {
        const newData = await res.json()
        setData(newData)
        setLastUpdated(new Date())
      }
    } catch (error) {
      console.error("Failed to refresh:", error)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(refresh, 30000)
    return () => clearInterval(interval)
  }, [])

  const statusConfig = {
    healthy: {
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      label: "HEALTHY",
    },
    warning: {
      icon: AlertTriangle,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-200",
      label: "WARNING",
    },
    critical: {
      icon: AlertCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      label: "CRITICAL",
    },
  }

  const config = statusConfig[data.status]
  const StatusIcon = config.icon

  const formatDuration = (ms: number | null) => {
    if (!ms) return "N/A"
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  const formatRelativeTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return "Never"
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffDays > 0) return `${diffDays}d ago`
    if (diffHours > 0) return `${diffHours}h ago`
    if (diffMins > 0) return `${diffMins}m ago`
    return "Just now"
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sentinel Health Monitor</h1>
          <p className="text-muted-foreground">Real-time discovery and domain health status</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refresh} disabled={isRefreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" asChild>
            <Link href="/regulatory/sources">
              <Server className="mr-2 h-4 w-4" />
              Manage Sources
            </Link>
          </Button>
        </div>
      </div>

      {/* Last Updated */}
      <div className="text-sm text-muted-foreground">
        Last updated: {lastUpdated.toLocaleTimeString()}
      </div>

      {/* Overall Status Card */}
      <Card className={`border-2 ${config.borderColor} ${config.bgColor}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StatusIcon className={`h-6 w-6 ${config.color}`} />
            <span className={config.color}>Sentinel Status: {config.label}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="text-2xl font-bold">
                {data.runs.successRate > 0 ? Math.round(data.runs.successRate * 100) : 0}%
              </div>
              <p className="text-sm text-muted-foreground">Success Rate (24h)</p>
            </div>
            <div>
              <div className="text-2xl font-bold">{data.sources.needingCheck}</div>
              <p className="text-sm text-muted-foreground">
                Sources Needing Check ({data.sources.percentageOverdue}% overdue)
              </p>
            </div>
            <div>
              <div className="text-2xl font-bold">{data.discovery.evidenceFetched24h}</div>
              <p className="text-sm text-muted-foreground">Evidence Fetched (24h)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Runs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Runs (24h)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.runs.total24h}</div>
            <div className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-green-600">Completed:</span>
                <span className="font-medium">{data.runs.completed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-600">Failed:</span>
                <span className="font-medium">{data.runs.failed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-600">Running:</span>
                <span className="font-medium">{data.runs.running}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sources */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sources</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.sources.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.sources.needingCheck} need checking
            </p>
          </CardContent>
        </Card>

        {/* Discoveries */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Discoveries (7d)</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.discovery.last7days}</div>
            <p className="text-xs text-muted-foreground mt-1">New items discovered</p>
          </CardContent>
        </Card>

        {/* Last Run */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Successful Run</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.runs.lastSuccessful
                ? formatRelativeTime(data.runs.lastSuccessful.completedAt)
                : "Never"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.runs.lastSuccessful
                ? `Duration: ${formatDuration(data.runs.lastSuccessful.duration)}`
                : "No successful runs"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Domain Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Domain Health (Circuit Breaker Status)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(data.domains).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No domains tracked yet. Sentinel will track domains after first discovery run.
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(data.domains).map(([domain, stats]) => (
                <div
                  key={domain}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    stats.isCircuitBroken
                      ? "bg-red-50 border-red-200"
                      : stats.isHealthy
                        ? "bg-green-50 border-green-200"
                        : "bg-yellow-50 border-yellow-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {stats.isCircuitBroken ? (
                      <XCircle className="h-5 w-5 text-red-600" />
                    ) : stats.isHealthy ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    )}
                    <div>
                      <div className="font-medium">{domain}</div>
                      <div className="text-sm text-muted-foreground">
                        Success Rate: {Math.round(stats.successRate * 100)}%
                        {stats.consecutiveErrors > 0 &&
                          ` • ${stats.consecutiveErrors} consecutive errors`}
                      </div>
                      {stats.lastError && (
                        <div className="text-xs text-red-600 mt-1">Last error: {stats.lastError}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {stats.isCircuitBroken ? (
                      <Badge variant="destructive">Circuit Open</Badge>
                    ) : stats.isHealthy ? (
                      <Badge variant="default" className="bg-green-600">
                        Healthy
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Degraded</Badge>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      Last success: {formatRelativeTime(stats.lastSuccessAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Endpoints by Domain */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Sources by Domain
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.endpoints.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No endpoints configured</div>
          ) : (
            <div className="space-y-2">
              {data.endpoints.map((endpoint) => (
                <div
                  key={endpoint.domain}
                  className="flex items-center justify-between p-2 rounded border"
                >
                  <div>
                    <div className="font-medium">{endpoint.domain}</div>
                    <div className="text-sm text-muted-foreground">{endpoint.count} sources</div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Last checked: {formatRelativeTime(endpoint.lastChecked)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Runs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Discovery Runs (24h)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.runs.recent.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No recent runs</div>
          ) : (
            <div className="space-y-3">
              {data.runs.recent.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    {run.status === "completed" ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : run.status === "failed" ? (
                      <XCircle className="h-5 w-5 text-red-600" />
                    ) : (
                      <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Run {run.id.slice(0, 8)}</span>
                        <Badge
                          variant={
                            run.status === "completed"
                              ? "default"
                              : run.status === "failed"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {run.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Started: {new Date(run.startedAt).toLocaleString()}
                        {run.duration && ` • Duration: ${formatDuration(run.duration)}`}
                      </div>
                      {run.error && (
                        <div className="text-xs text-red-600 mt-1">Error: {run.error}</div>
                      )}
                    </div>
                  </div>
                  {run.completedAt && (
                    <div className="text-sm text-muted-foreground">
                      {formatRelativeTime(run.completedAt)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
