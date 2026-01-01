import { getCurrentUser } from "@/lib/auth-utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Users,
  AlertCircle,
  Calendar,
  MessageSquare,
  FileText,
  Receipt,
  Upload,
  Activity as ActivityIcon,
} from "lucide-react"
import { getStaffStats, getUpcomingDeadlineDetails, getRecentActivity } from "@/lib/staff/queries"

// TODO: Database queries moved to @/lib/staff/queries for Clean Architecture compliance

function getActivityIcon(type: string) {
  switch (type) {
    case "invoice":
      return <FileText className="h-4 w-4 text-primary" />
    case "expense":
      return <Receipt className="h-4 w-4 text-warning-text" />
    case "ticket":
      return <MessageSquare className="h-4 w-4 text-accent" />
    case "document":
      return <Upload className="h-4 w-4 text-info" />
    case "audit":
      return <ActivityIcon className="h-4 w-4 text-muted-foreground" />
    default:
      return <Users className="h-4 w-4 text-success" />
  }
}

export async function StaffDashboard() {
  const user = await getCurrentUser()
  if (!user) return null

  const stats = await getStaffStats(user.id)
  const recentActivity = await getRecentActivity(user.id)
  const upcomingDeadlines = await getUpcomingDeadlineDetails(user.id, 5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your client portfolio</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Assigned Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.assignedClients}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Tickets</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingTickets}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Deadlines</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.upcomingDeadlines}</div>
            {stats.upcomingDeadlines > 0 && (
              <div className="mt-2 text-xs text-muted-foreground space-y-1">
                {(stats.urgentDeadlines ?? 0) > 0 && (
                  <div className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 text-warning-text" />
                    <span>{stats.urgentDeadlines} within 7 days</span>
                  </div>
                )}
                {(stats.criticalDeadlines ?? 0) > 0 && (
                  <div className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 text-danger-text" />
                    <span>{stats.criticalDeadlines} critical</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Items Need Attention</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.itemsNeedAttention}</div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Deadlines Detail */}
      {upcomingDeadlines.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Compliance Deadlines</CardTitle>
            <p className="text-sm text-muted-foreground">
              Next deadlines across all assigned clients
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingDeadlines.map((deadline) => {
                const urgencyColor =
                  deadline.daysUntil <= 3
                    ? "text-danger-text"
                    : deadline.daysUntil <= 7
                      ? "text-warning-text"
                      : "text-info"

                const urgencyBg =
                  deadline.daysUntil <= 3
                    ? "bg-danger-bg"
                    : deadline.daysUntil <= 7
                      ? "bg-warning-bg"
                      : "bg-muted"

                return (
                  <div
                    key={deadline.id}
                    className="flex items-center justify-between gap-4 p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div
                        className={`flex items-center justify-center w-12 h-12 rounded-full ${urgencyBg}`}
                      >
                        <Calendar className={`h-5 w-5 ${urgencyColor}`} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{deadline.title}</p>
                        <p className="text-xs text-muted-foreground">{deadline.deadline_type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${urgencyColor}`}>
                        {deadline.daysUntil === 0
                          ? "Today"
                          : deadline.daysUntil === 1
                            ? "Tomorrow"
                            : `${deadline.daysUntil} days`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(deadline.deadline_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-muted-foreground">No recent activity</p>
          ) : (
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center gap-4">
                  {getActivityIcon(activity.type)}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.companyName}</p>
                    <p className="text-xs text-muted-foreground">{activity.action}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(activity.date).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
