"use client"
/* eslint-disable fisk-design-system/no-hardcoded-colors, react/no-unescaped-entities, @typescript-eslint/no-unused-vars -- Pre-existing issues, fix separately */

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
  Server,
  Zap,
  Pause,
} from "lucide-react"
import type {
  HeadlineStatus,
  RefreshQuality,
  SystemStatusEventType,
} from "@/lib/system-status/types"

// Worker health types
interface QueueStats {
  name: string
  displayName: string
  description: string
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
  paused: boolean
}

interface WorkerHealthResponse {
  status: "healthy" | "degraded" | "unhealthy"
  redisConnected: boolean
  timestamp: string
  queues: QueueStats[]
  summary: {
    totalWaiting: number
    totalActive: number
    totalFailed: number
    healthyQueues: number
    unhealthyQueues: number
  }
}

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
    color: "text-success-icon",
    bgColor: "bg-success-bg",
    borderColor: "border-success-border",
    label: "All Systems OK",
  },
  ATTENTION: {
    icon: AlertTriangle,
    color: "text-warning-icon",
    bgColor: "bg-warning-bg",
    borderColor: "border-warning-border",
    label: "Attention Required",
  },
  ACTION_REQUIRED: {
    icon: AlertCircle,
    color: "text-danger-icon",
    bgColor: "bg-danger-bg",
    borderColor: "border-danger-border",
    label: "Action Required",
  },
}

const SEVERITY_BADGE: Record<string, "danger" | "warning" | "info" | "secondary"> = {
  critical: "danger",
  high: "warning",
  medium: "info",
  low: "secondary",
}

// LLM Health types
interface LLMProviderHealth {
  provider: string
  status: string
  latencyMs: number
  circuitState: string
  consecutiveFailures: number
  isActive: boolean
  error?: string
}

interface LLMHealthResponse {
  activeProvider: string
  providers: LLMProviderHealth[]
  timestamp: string
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
  CIRCUIT_BREAKER_RESET: "Circuit Breaker Reset",
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
  const [workerHealth, setWorkerHealth] = useState<WorkerHealthResponse | null>(null)
  const [workerHealthLoading, setWorkerHealthLoading] = useState(true)
  const [llmHealth, setLlmHealth] = useState<LLMHealthResponse | null>(null)

  // Track if component is mounted to prevent memory leaks in polling
  const mountedRef = useRef(true)

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Fetch worker health on mount and periodically
  const fetchWorkerHealth = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/workers/status")
      if (response.ok) {
        const data = await response.json()
        if (mountedRef.current) {
          setWorkerHealth(data)
        }
      }
    } catch (error) {
      // Silent fail - will show as disconnected
      if (mountedRef.current) {
        setWorkerHealth(null)
      }
    } finally {
      if (mountedRef.current) {
        setWorkerHealthLoading(false)
      }
    }
  }, [])

  // Fetch LLM health on mount and periodically
  const fetchLlmHealth = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/llm-health")
      if (response.ok) {
        const data = await response.json()
        if (mountedRef.current) {
          setLlmHealth(data)
        }
      }
    } catch (error) {
      console.error("Failed to fetch LLM health:", error)
      if (mountedRef.current) {
        setLlmHealth(null)
      }
    }
  }, [])

  useEffect(() => {
    void fetchWorkerHealth()
    void fetchLlmHealth()
    // Refresh worker health and LLM health every 30 seconds
    const workerInterval = setInterval(() => void fetchWorkerHealth(), 30000)
    const llmInterval = setInterval(() => void fetchLlmHealth(), 30000)
    return () => {
      clearInterval(workerInterval)
      clearInterval(llmInterval)
    }
  }, [fetchWorkerHealth, fetchLlmHealth])

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
          setTimeout(() => void pollJobStatus(jobId), 2000)
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
        setTimeout(() => void pollJobStatus(data.jobId), 2000)
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
  const headlineConfig = snapshot ? HEADLINE_CONFIG[snapshot.headlineStatus] : HEADLINE_CONFIG.OK
  const HeadlineIcon = headlineConfig.icon

  // Parse topItems if available
  const topItems = snapshot?.topItems as
    | Array<{
        id: string
        name: string
        severity: string
        owner?: string
        link?: string
      }>
    | undefined

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">System Status</h1>
          <p className="text-muted-foreground">Monitor system registry integrations and health</p>
        </div>
        <Button onClick={handleRefresh} disabled={isRefreshing} className="gap-2">
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
        <Card className="border-danger-border bg-danger-bg" role="alert" aria-live="assertive">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-danger-icon">
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
                    <div className="flex items-center gap-1 text-sm text-warning-icon">
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
            <div className="text-2xl font-bold text-danger-icon">
              {snapshot?.criticalCount ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">High</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning-icon">{snapshot?.highCount ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Medium</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-info-icon">{snapshot?.mediumCount ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Low</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-secondary">{snapshot?.lowCount ?? 0}</div>
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

      {/* Worker Health Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Worker Health
            </div>
            <div className="flex items-center gap-2">
              {workerHealthLoading ? (
                <LoadingSpinner size="sm" />
              ) : workerHealth ? (
                <>
                  <Badge
                    variant={
                      workerHealth.status === "healthy"
                        ? "success"
                        : workerHealth.status === "degraded"
                          ? "warning"
                          : "danger"
                    }
                  >
                    {workerHealth.status.toUpperCase()}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchWorkerHealth}
                    className="h-6 w-6 p-0"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                <Badge variant="danger">DISCONNECTED</Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {workerHealthLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading worker status...</div>
          ) : !workerHealth ? (
            <div className="py-8 text-center text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-danger-icon" />
              <p>Unable to connect to Redis</p>
              <p className="text-xs mt-1">Worker queues are unavailable</p>
            </div>
          ) : (
            <>
              {/* Summary stats */}
              <div className="grid gap-4 md:grid-cols-4 mb-4">
                <div className="text-center p-3 bg-surface-1 rounded-lg">
                  <div className="text-2xl font-bold">{workerHealth.summary.totalWaiting}</div>
                  <div className="text-xs text-muted-foreground">Waiting</div>
                </div>
                <div className="text-center p-3 bg-surface-1 rounded-lg">
                  <div className="text-2xl font-bold text-info-icon">
                    {workerHealth.summary.totalActive}
                  </div>
                  <div className="text-xs text-muted-foreground">Active</div>
                </div>
                <div className="text-center p-3 bg-surface-1 rounded-lg">
                  <div className="text-2xl font-bold text-danger-icon">
                    {workerHealth.summary.totalFailed}
                  </div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                </div>
                <div className="text-center p-3 bg-surface-1 rounded-lg">
                  <div className="text-2xl font-bold text-success-icon">
                    {workerHealth.summary.healthyQueues}/{workerHealth.queues.length}
                  </div>
                  <div className="text-xs text-muted-foreground">Healthy Queues</div>
                </div>
              </div>

              {/* Queue list */}
              <div className="space-y-2">
                {workerHealth.queues.map((queue) => (
                  <div
                    key={queue.name}
                    className="flex items-center justify-between p-2 border rounded-lg hover:bg-surface-1"
                  >
                    <div className="flex items-center gap-2">
                      {queue.paused ? (
                        <Pause className="h-4 w-4 text-warning-icon" />
                      ) : queue.active > 0 ? (
                        <Zap className="h-4 w-4 text-info-icon" />
                      ) : (
                        <Server className="h-4 w-4 text-secondary" />
                      )}
                      <div>
                        <div className="text-sm font-medium">{queue.displayName}</div>
                        <div className="text-xs text-muted-foreground">{queue.description}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {queue.paused && (
                        <Badge variant="warning" className="text-xs">
                          PAUSED
                        </Badge>
                      )}
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">W:</span>
                        <span className="font-mono">{queue.waiting}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-info-icon">A:</span>
                        <span className="font-mono text-info-icon">{queue.active}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-success-icon">C:</span>
                        <span className="font-mono text-success-icon">{queue.completed}</span>
                      </div>
                      {queue.failed > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-danger-icon">F:</span>
                          <span className="font-mono text-danger-icon">{queue.failed}</span>
                        </div>
                      )}
                      {queue.delayed > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-warning-icon">D:</span>
                          <span className="font-mono text-warning-icon">{queue.delayed}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Last updated */}
              <div className="text-xs text-muted-foreground mt-3 text-right">
                Last updated: {new Date(workerHealth.timestamp).toLocaleString("hr-HR")}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* LLM Provider Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              LLM Providers
            </div>
            <Button variant="ghost" size="sm" onClick={fetchLlmHealth} className="h-6 w-6 p-0">
              <RefreshCw className="h-3 w-3" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {llmHealth ? (
            <div className="space-y-3">
              {llmHealth.providers.map((p) => (
                <div
                  key={p.provider}
                  className="flex items-center justify-between p-2 border rounded-lg hover:bg-surface-1"
                >
                  <div className="flex items-center gap-2">
                    {p.status === "HEALTHY" ? (
                      <CheckCircle className="h-4 w-4 text-success-icon" />
                    ) : p.status === "DEGRADED" ? (
                      <AlertTriangle className="h-4 w-4 text-warning-icon" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-danger-icon" />
                    )}
                    <div>
                      <div
                        className={
                          p.isActive ? "text-sm font-medium" : "text-sm text-muted-foreground"
                        }
                      >
                        {p.provider}
                        {p.isActive && (
                          <Badge variant="secondary" className="ml-2">
                            active
                          </Badge>
                        )}
                      </div>
                      {p.error && <div className="text-xs text-danger-icon">{p.error}</div>}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {p.circuitState === "OPEN" ? (
                      <Badge variant="danger">CIRCUIT OPEN</Badge>
                    ) : p.circuitState === "HALF_OPEN" ? (
                      <Badge variant="warning">HALF OPEN</Badge>
                    ) : (
                      <span>{p.latencyMs}ms</span>
                    )}
                  </div>
                </div>
              ))}
              {/* Last updated */}
              <div className="text-xs text-muted-foreground text-right">
                Last updated: {new Date(llmHealth.timestamp).toLocaleString("hr-HR")}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          )}
        </CardContent>
      </Card>

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
                        <div className="text-xs text-muted-foreground">Owner: {item.owner}</div>
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
            <div className="py-8 text-center text-muted-foreground">No recent events</div>
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
                <div className="text-sm font-medium mt-1">{snapshot.newDriftSinceDays} days</div>
              </div>
            </div>
            {snapshot.lastRefreshError && (
              <div className="mt-4 p-3 bg-danger-bg border border-danger-border rounded-md">
                <div className="text-xs text-danger-icon font-medium">Last Error</div>
                <div className="text-sm text-danger-text mt-1">{snapshot.lastRefreshError}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
