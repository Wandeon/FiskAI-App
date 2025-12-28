"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import {
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Clock,
  Lock,
  Activity,
  ExternalLink,
} from "lucide-react"
import type { HeadlineStatus, RefreshQuality, SystemStatusEventType } from "@/lib/system-status/types"

// Types for data from server
interface Snapshot {
  id: string
  headlineStatus: HeadlineStatus
  refreshQuality: RefreshQuality
  criticalCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  observedCount: number
  declaredCount: number
  newDriftSinceDays: number
  lastRefreshStartedAt: Date | null
  lastRefreshEndedAt: Date | null
  lastRefreshStatus: "SUCCESS" | "FAILED" | null
  lastRefreshError: string | null
  topItems: unknown
  createdAt: Date
}

interface StatusEvent {
  id: string
  eventType: SystemStatusEventType
  severity: string
  message: string
  nextAction: string
  componentId: string | null
  owner: string | null
  link: string | null
  createdAt: Date
}

interface RefreshLock {
  id: string
  lockKey: string
  lockedUntil: Date
  startedAt: Date
  requestedByUserId: string
  jobId: string
}

interface SystemStatusPageProps {
  initialSnapshot: Snapshot | null
  initialEvents: StatusEvent[]
  initialLock: RefreshLock | null
}

// Status config
const HEADLINE_CONFIG: Record<
  HeadlineStatus,
  { icon: typeof CheckCircle; color: string; bgColor: string; borderColor: string; label: string }
> = {
  OK: {
    icon: CheckCircle,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    label: "All Systems OK",
  },
  ATTENTION: {
    icon: AlertTriangle,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    label: "Attention Required",
  },
  ACTION_REQUIRED: {
    icon: AlertCircle,
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    label: "Action Required",
  },
}

const SEVERITY_BADGE: Record<string, "danger" | "warning" | "info" | "secondary"> = {
  critical: "danger",
  high: "warning",
  medium: "info",
  low: "secondary",
}

const EVENT_TYPE_LABELS: Record<SystemStatusEventType, string> = {
  NEW_CRITICAL: "New Critical Issue",
  CRITICAL_RESOLVED: "Critical Resolved",
  OWNER_CHANGED: "Owner Changed",
  NEW_OBSERVED: "New Component Observed",
  DECLARED_MISSING: "Declared Component Missing",
  UNKNOWN_INTEGRATION: "Unknown Integration Detected",
  REFRESH_FAILED: "Refresh Failed",
  REFRESH_DEGRADED: "Refresh Degraded",
}

export function SystemStatusPage({
  initialSnapshot,
  initialEvents,
  initialLock,
}: SystemStatusPageProps) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(initialSnapshot)
  const [events] = useState<StatusEvent[]>(initialEvents)
  const [lock, setLock] = useState<RefreshLock | null>(initialLock)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshJobId, setRefreshJobId] = useState<string | null>(null)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  // Track if component is mounted to prevent memory leaks in polling
  const mountedRef = useRef(true)

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const response = await fetch(`/api/admin/system-status/refresh/${jobId}`)
      const data = await response.json()

      if (data.status === "SUCCEEDED") {
        // Refresh the page to get new data
        window.location.reload()
      } else if (data.status === "FAILED") {
        setRefreshError(data.error || "Refresh failed")
        setIsRefreshing(false)
        setRefreshJobId(null)
        setLock(null)
      } else if (data.status === "PENDING" || data.status === "RUNNING") {
        // Continue polling only if component is still mounted
        if (mountedRef.current) {
          setTimeout(() => pollJobStatus(jobId), 2000)
        }
      }
    } catch (error) {
      setRefreshError("Failed to check refresh status")
      setIsRefreshing(false)
      setRefreshJobId(null)
    }
  }, [])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    setRefreshError(null)

    try {
      const response = await fetch("/api/admin/system-status/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      const data = await response.json()

      if (response.status === 200) {
        // Sync refresh succeeded, reload page
        window.location.reload()
      } else if (response.status === 202) {
        // Async job started or already running
        setRefreshJobId(data.jobId)
        // Start polling
        setTimeout(() => pollJobStatus(data.jobId), 2000)
      } else {
        setRefreshError(data.error || "Failed to start refresh")
        setIsRefreshing(false)
      }
    } catch (error) {
      setRefreshError("Failed to start refresh")
      setIsRefreshing(false)
    }
  }

  // Get headline config
  const headlineConfig = snapshot
    ? HEADLINE_CONFIG[snapshot.headlineStatus]
    : HEADLINE_CONFIG.OK
  const HeadlineIcon = headlineConfig.icon

  // Parse topItems if available
  const topItems = snapshot?.topItems as Array<{
    id: string
    name: string
    severity: string
    owner?: string
    link?: string
  }> | undefined

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">System Status</h1>
          <p className="text-muted-foreground">
            Monitor system registry integrations and health
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="gap-2"
        >
          {isRefreshing ? (
            <>
              <LoadingSpinner size="sm" className="text-current" />
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Refresh Now
            </>
          )}
        </Button>
      </div>

      {/* Error Banner */}
      {refreshError && (
        <Card className="border-red-200 bg-red-50" role="alert" aria-live="assertive">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span>{refreshError}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Headline Status Card */}
      <Card className={`border-2 ${headlineConfig.borderColor} ${headlineConfig.bgColor}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HeadlineIcon className={`h-5 w-5 ${headlineConfig.color}`} />
            <span className={headlineConfig.color}>{headlineConfig.label}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              {snapshot ? (
                <>
                  <div className="text-sm text-muted-foreground">
                    Last refreshed:{" "}
                    {snapshot.lastRefreshEndedAt
                      ? new Date(snapshot.lastRefreshEndedAt).toLocaleString("hr-HR")
                      : "Never"}
                  </div>
                  {snapshot.refreshQuality === "DEGRADED" && (
                    <div className="flex items-center gap-1 text-sm text-amber-600">
                      <AlertTriangle className="h-4 w-4" />
                      Degraded refresh quality
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No status data available. Click "Refresh Now" to collect data.
                </div>
              )}
            </div>
            {lock && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="h-4 w-4" />
                <span>
                  Refresh in progress (locked until{" "}
                  {new Date(lock.lockedUntil).toLocaleTimeString("hr-HR")})
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Counters Grid */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {snapshot?.criticalCount ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">High</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {snapshot?.highCount ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Medium</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {snapshot?.mediumCount ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Low</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-600">
              {snapshot?.lowCount ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Observed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{snapshot?.observedCount ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Declared</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{snapshot?.declaredCount ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Top Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Top Priority Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!topItems || topItems.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No priority items to display
            </div>
          ) : (
            <div className="space-y-3">
              {topItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={SEVERITY_BADGE[item.severity] ?? "secondary"}>
                      {item.severity.toUpperCase()}
                    </Badge>
                    <div>
                      <div className="text-sm font-medium">{item.name}</div>
                      {item.owner && (
                        <div className="text-xs text-muted-foreground">
                          Owner: {item.owner}
                        </div>
                      )}
                    </div>
                  </div>
                  {item.link && (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={item.link} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Changes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No recent events
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 border-b pb-3 last:border-0 last:pb-0"
                >
                  <Clock className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={SEVERITY_BADGE[event.severity] ?? "secondary"}>
                        {event.severity.toUpperCase()}
                      </Badge>
                      <Badge variant="outline">
                        {EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}
                      </Badge>
                    </div>
                    <div className="text-sm font-medium mt-1">{event.message}</div>
                    <div className="text-sm text-muted-foreground">{event.nextAction}</div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span>{new Date(event.createdAt).toLocaleString("hr-HR")}</span>
                      {event.owner && <span>Owner: {event.owner}</span>}
                      {event.componentId && <span>Component: {event.componentId}</span>}
                    </div>
                  </div>
                  {event.link && (
                    <Button variant="ghost" size="sm" asChild className="flex-shrink-0">
                      <a href={event.link} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Refresh Quality & Info */}
      {snapshot && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Refresh Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <div className="text-xs text-muted-foreground">Refresh Quality</div>
                <div className="flex items-center gap-2 mt-1">
                  {snapshot.refreshQuality === "FULL" ? (
                    <Badge variant="success">FULL</Badge>
                  ) : (
                    <Badge variant="warning">DEGRADED</Badge>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Last Refresh Status</div>
                <div className="flex items-center gap-2 mt-1">
                  {snapshot.lastRefreshStatus === "SUCCESS" ? (
                    <Badge variant="success">SUCCESS</Badge>
                  ) : snapshot.lastRefreshStatus === "FAILED" ? (
                    <Badge variant="danger">FAILED</Badge>
                  ) : (
                    <Badge variant="secondary">N/A</Badge>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">New Drift (Days)</div>
                <div className="text-sm font-medium mt-1">
                  {snapshot.newDriftSinceDays} days
                </div>
              </div>
            </div>
            {snapshot.lastRefreshError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="text-xs text-red-600 font-medium">Last Error</div>
                <div className="text-sm text-red-700 mt-1">{snapshot.lastRefreshError}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
