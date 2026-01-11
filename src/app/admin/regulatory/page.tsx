import { getCurrentUser } from "@/lib/auth-utils"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertCircle,
  CheckCircle,
  Activity,
  AlertTriangle,
  Database,
  FileText,
  RefreshCw,
  GitBranch,
  Radar,
} from "lucide-react"
import Link from "next/link"
import { adminRegulatoryRoute } from "@/lib/admin/routes"
import {
  getRegulatoryPipelineStatus,
  type RegulatoryPipelineStatus,
} from "@/lib/admin/regulatory-status"

export const revalidate = 60 // 1 minute cache

async function getDashboardData(): Promise<{
  status: RegulatoryPipelineStatus
}> {
  // Call server function directly - no unauthenticated fetch needed
  // Auth is enforced at the page level before this is called
  const status = await getRegulatoryPipelineStatus()

  return { status }
}

export default async function RegulatoryDashboardPage() {
  const user = await getCurrentUser()

  if (!user || user.systemRole !== "ADMIN") {
    redirect("/")
  }

  const { status } = await getDashboardData()

  // Derive counts from status - no need for separate DB queries
  const pendingReviewCount = status.rules.byStatus.PENDING_REVIEW
  const openConflicts = status.conflicts.active

  const healthStatusConfig = {
    healthy: {
      icon: CheckCircle,
      color: "text-success-icon",
      bgColor: "bg-success-bg",
      borderColor: "border-success-border",
    },
    warning: {
      icon: AlertTriangle,
      color: "text-warning-icon",
      bgColor: "bg-warning-bg",
      borderColor: "border-warning-border",
    },
    critical: {
      icon: AlertCircle,
      color: "text-danger-icon",
      bgColor: "bg-danger-bg",
      borderColor: "border-danger-border",
    },
  }

  const healthConfig = healthStatusConfig[status.health.status as keyof typeof healthStatusConfig]
  const HealthIcon = healthConfig.icon

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Regulatory Truth Layer</h1>
          <p className="text-muted-foreground">Croatian compliance automation pipeline</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={adminRegulatoryRoute("/sentinel")}>
              <Radar className="mr-2 h-4 w-4" />
              Sentinel Health
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={adminRegulatoryRoute("/sources")}>
              <Database className="mr-2 h-4 w-4" />
              Sources
            </Link>
          </Button>
          <Button asChild>
            <Link href={adminRegulatoryRoute("/inbox")}>
              <FileText className="mr-2 h-4 w-4" />
              Review Inbox
              {pendingReviewCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {pendingReviewCount}
                </Badge>
              )}
            </Link>
          </Button>
        </div>
      </div>

      {/* Health Score Card */}
      <Card className={`border-2 ${healthConfig.borderColor} ${healthConfig.bgColor}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HealthIcon className={`h-5 w-5 ${healthConfig.color}`} />
            <span className={healthConfig.color}>
              System Health: {status.health.status.toUpperCase()}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold">{status.health.score}/100</div>
              <p className="text-sm text-muted-foreground">Health Score</p>
            </div>
            <div className="text-right space-y-1">
              {status.sources.needingCheck > 0 && (
                <div className="text-sm text-warning-icon">
                  {status.sources.needingCheck} sources need checking
                </div>
              )}
              {pendingReviewCount > 0 && (
                <div className="text-sm text-warning-icon">
                  {pendingReviewCount} rules awaiting review
                </div>
              )}
              {openConflicts > 0 && (
                <div className="text-sm text-danger-icon">{openConflicts} open conflicts</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Source Statistics */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sources</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status.sources.active}</div>
            <p className="text-xs text-muted-foreground">
              {status.sources.total} total ({status.sources.inactive} inactive)
            </p>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-xs">
                <span>T0 (Critical):</span>
                <span className="font-medium">{status.sources.byPriority?.T0 || 0}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>T1 (High):</span>
                <span className="font-medium">{status.sources.byPriority?.T1 || 0}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>T2 (Medium):</span>
                <span className="font-medium">{status.sources.byPriority?.T2 || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rule Statistics */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rules</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status.rules.total}</div>
            <p className="text-xs text-muted-foreground">Total rules</p>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-xs">
                <span>Published:</span>
                <span className="font-medium text-success-icon">
                  {status.rules.byStatus.PUBLISHED}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Pending Review:</span>
                <span className="font-medium text-warning-icon">
                  {status.rules.byStatus.PENDING_REVIEW}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Draft:</span>
                <span className="font-medium">{status.rules.byStatus.DRAFT}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Evidence & Pointers */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Evidence</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status.evidence.total}</div>
            <p className="text-xs text-muted-foreground">Evidence records collected</p>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-xs">
                <span>Source Pointers:</span>
                <span className="font-medium">{status.sourcePointers.total}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Last Collected:</span>
                <span className="font-medium">
                  {status.evidence.lastCollected
                    ? new Date(status.evidence.lastCollected).toLocaleDateString()
                    : "Never"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Conflicts & Agents */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activity</CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status.agents.runs24h}</div>
            <p className="text-xs text-muted-foreground">Agent runs (24h)</p>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-xs">
                <span>Open Conflicts:</span>
                <span className="font-medium text-danger-icon">{status.conflicts.active}</span>
              </div>
              {status.latestRelease && (
                <div className="flex justify-between text-xs">
                  <span>Latest Release:</span>
                  <span className="font-medium">{status.latestRelease.version}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Agent Activity</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href={adminRegulatoryRoute("/sources")}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Trigger Manual Check
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {status.recentActivity.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No recent activity</div>
          ) : (
            <div className="space-y-4">
              {status.recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{activity.type}</Badge>
                    <div>
                      <div className="text-sm font-medium">{activity.summary}</div>
                      <div className="text-xs text-muted-foreground">
                        {activity.completedAt
                          ? new Date(activity.completedAt).toLocaleString()
                          : "Pending"}
                      </div>
                    </div>
                  </div>
                  {activity.confidence && (
                    <Badge variant={activity.confidence >= 0.95 ? "default" : "secondary"}>
                      {Math.round(activity.confidence * 100)}% confidence
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:border-primary transition-colors cursor-pointer">
          <Link href={adminRegulatoryRoute("/inbox")}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Review Inbox
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingReviewCount}</div>
              <p className="text-sm text-muted-foreground">Rules awaiting review</p>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary transition-colors cursor-pointer">
          <Link href={adminRegulatoryRoute("/conflicts")}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Conflicts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{openConflicts}</div>
              <p className="text-sm text-muted-foreground">Open conflicts</p>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary transition-colors cursor-pointer">
          <Link href={adminRegulatoryRoute("/releases")}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                Releases
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{status.latestRelease?.version || "None"}</div>
              <p className="text-sm text-muted-foreground">
                Latest release
                {status.latestRelease?.rulesCount && ` (${status.latestRelease.rulesCount} rules)`}
              </p>
            </CardContent>
          </Link>
        </Card>
      </div>
    </div>
  )
}
