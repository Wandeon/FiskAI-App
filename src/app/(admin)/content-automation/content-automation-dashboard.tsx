"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  FileText,
  RefreshCw,
  Clock,
  Zap,
  TrendingUp,
  BarChart3,
  Inbox,
} from "lucide-react"
import type {
  ArticleAgentMetrics,
  ContentSyncMetrics,
  ContentPipelineHealth,
} from "@/lib/regulatory-truth/monitoring/metrics"

interface ContentAutomationDashboardProps {
  articleMetrics: ArticleAgentMetrics
  syncMetrics: ContentSyncMetrics
  recentJobs: Array<{
    id: string
    type: string
    status: string
    topic: string | null
    currentIteration: number
    maxIterations: number
    createdAt: Date
    updatedAt: Date
  }>
  recentEvents: Array<{
    eventId: string
    type: string
    status: string
    ruleId: string
    conceptId: string
    domain: string
    attempts: number
    createdAt: Date
    processedAt: Date | null
    lastError: string | null
    deadLetterReason: string | null
  }>
  health: ContentPipelineHealth
}

const STATUS_CONFIG: Record<
  "healthy" | "degraded" | "unhealthy",
  { icon: typeof CheckCircle; color: string; bgColor: string; borderColor: string; label: string }
> = {
  healthy: {
    icon: CheckCircle,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    label: "Healthy",
  },
  degraded: {
    icon: AlertTriangle,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    label: "Degraded",
  },
  unhealthy: {
    icon: AlertCircle,
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    label: "Unhealthy",
  },
}

const JOB_STATUS_BADGE: Record<string, "success" | "warning" | "danger" | "info" | "secondary"> = {
  SYNTHESIZING: "info",
  PLANNING: "info",
  DRAFTING: "info",
  VERIFYING: "warning",
  NEEDS_REVIEW: "warning",
  APPROVED: "success",
  PUBLISHED: "success",
  REJECTED: "danger",
}

const SYNC_STATUS_BADGE: Record<string, "success" | "warning" | "danger" | "info" | "secondary"> = {
  PENDING: "secondary",
  ENQUEUED: "info",
  PROCESSING: "info",
  DONE: "success",
  FAILED: "danger",
  DEAD_LETTERED: "danger",
  SKIPPED: "secondary",
}

export function ContentAutomationDashboard({
  articleMetrics,
  syncMetrics,
  recentJobs,
  recentEvents,
  health,
}: ContentAutomationDashboardProps) {
  const overallConfig = STATUS_CONFIG[health.overallStatus]
  const OverallIcon = overallConfig.icon

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Content Automation</h1>
          <p className="text-muted-foreground">
            Monitor Article Agent and Content Sync pipelines
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          Last updated: {new Date().toLocaleString("hr-HR")}
        </div>
      </div>

      {/* Overall Health Status */}
      <Card className={`border-2 ${overallConfig.borderColor} ${overallConfig.bgColor}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <OverallIcon className={`h-5 w-5 ${overallConfig.color}`} />
            <span className={overallConfig.color}>
              Content Pipelines: {overallConfig.label}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Article Agent Health */}
            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
              <FileText className="h-8 w-8 text-blue-600" />
              <div>
                <div className="font-medium">Article Agent</div>
                <div className="flex items-center gap-2 text-sm">
                  <Badge
                    variant={
                      health.articleAgent.status === "healthy"
                        ? "success"
                        : health.articleAgent.status === "degraded"
                          ? "warning"
                          : "danger"
                    }
                  >
                    {health.articleAgent.status.toUpperCase()}
                  </Badge>
                  <span className="text-muted-foreground">
                    {health.articleAgent.activeJobs} active, {health.articleAgent.pendingReview}{" "}
                    review
                  </span>
                </div>
              </div>
            </div>

            {/* Content Sync Health */}
            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
              <RefreshCw className="h-8 w-8 text-purple-600" />
              <div>
                <div className="font-medium">Content Sync</div>
                <div className="flex items-center gap-2 text-sm">
                  <Badge
                    variant={
                      health.contentSync.status === "healthy"
                        ? "success"
                        : health.contentSync.status === "degraded"
                          ? "warning"
                          : "danger"
                    }
                  >
                    {health.contentSync.status.toUpperCase()}
                  </Badge>
                  <span className="text-muted-foreground">
                    {health.contentSync.pendingEvents} pending,{" "}
                    {health.contentSync.deadLettered} dead-lettered
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Article Agent Metrics */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Article Agent
        </h2>

        {/* Job Count Cards */}
        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                <BarChart3 className="h-4 w-4" />
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{articleMetrics.totalJobs}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{articleMetrics.jobsToday}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Synthesizing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {articleMetrics.synthesizing}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Verifying</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {articleMetrics.verifying}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Needs Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {articleMetrics.needsReview}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{articleMetrics.approved}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Published</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">{articleMetrics.published}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{articleMetrics.rejected}</div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Metrics */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                Success Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{articleMetrics.successRate}%</div>
              <p className="text-xs text-muted-foreground">
                Approved + Published / Completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Review Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{articleMetrics.needsReviewRate}%</div>
              <p className="text-xs text-muted-foreground">Jobs requiring human review</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg Iterations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {articleMetrics.avgIterationsToApproval.toFixed(1)}
              </div>
              <p className="text-xs text-muted-foreground">To approval</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                <Zap className="h-4 w-4" />
                Avg Confidence
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {articleMetrics.avgVerificationConfidence}%
              </div>
              <p className="text-xs text-muted-foreground">Paragraph verification</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Jobs Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            {recentJobs.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">No jobs found</div>
            ) : (
              <div className="space-y-2">
                {recentJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant={JOB_STATUS_BADGE[job.status] ?? "secondary"}>
                        {job.status}
                      </Badge>
                      <div>
                        <div className="text-sm font-medium">
                          {job.topic ?? `Job ${job.id.slice(0, 8)}`}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Type: {job.type} | Iteration: {job.currentIteration}/{job.maxIterations}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(job.updatedAt).toLocaleString("hr-HR")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Content Sync Metrics */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Content Sync (RTL)
        </h2>

        {/* Event Count Cards */}
        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-7">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                <Inbox className="h-4 w-4" />
                Total Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{syncMetrics.totalEvents}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-600">
                {syncMetrics.pending + syncMetrics.enqueued}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Processing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{syncMetrics.processing}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Done</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{syncMetrics.done}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{syncMetrics.failed}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Dead Lettered</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-700">{syncMetrics.deadLettered}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Skipped</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-500">{syncMetrics.skipped}</div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Metrics */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                Success Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{syncMetrics.successRate}%</div>
              <p className="text-xs text-muted-foreground">Done + Skipped / Processed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Failure Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{syncMetrics.failureRate}%</div>
              <p className="text-xs text-muted-foreground">Temporary failures</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Dead Letter Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-700">
                {syncMetrics.deadLetterRate}%
              </div>
              <p className="text-xs text-muted-foreground">Permanent failures</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg Attempts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {syncMetrics.avgAttemptsToSuccess.toFixed(1)}
              </div>
              <p className="text-xs text-muted-foreground">To success</p>
            </CardContent>
          </Card>
        </div>

        {/* Dead Letter Reasons */}
        {syncMetrics.deadLetterReasons.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                Dead Letter Reasons
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-3">
                {syncMetrics.deadLetterReasons.map((r) => (
                  <div
                    key={r.reason}
                    className="flex items-center justify-between p-2 bg-red-50 rounded border border-red-200"
                  >
                    <span className="text-sm font-medium text-red-700">{r.reason}</span>
                    <Badge variant="danger">{r.count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Events Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent Events</CardTitle>
          </CardHeader>
          <CardContent>
            {recentEvents.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">No events found</div>
            ) : (
              <div className="space-y-2">
                {recentEvents.map((event) => (
                  <div
                    key={event.eventId}
                    className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant={SYNC_STATUS_BADGE[event.status] ?? "secondary"}>
                        {event.status}
                      </Badge>
                      <div>
                        <div className="text-sm font-medium">
                          {event.conceptId}{" "}
                          <span className="text-muted-foreground font-normal">
                            ({event.type})
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Domain: {event.domain} | Attempts: {event.attempts}
                          {event.lastError && (
                            <span className="text-red-600"> | Error: {event.lastError}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(event.createdAt).toLocaleString("hr-HR")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
