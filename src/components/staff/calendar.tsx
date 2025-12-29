import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth-utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, AlertCircle, Clock, CheckCircle2, AlertTriangle } from 'lucide-react'
import { getUpcomingDeadlines } from '@/lib/deadlines/queries'

interface DeadlineWithClient {
  id: string
  title: string
  deadlineDate: Date
  deadlineType: string
  severity: string | null
  description: string | null
  clientId?: string
  clientName?: string
  source: 'compliance' | 'invoice'
}

async function getStaffDeadlines(userId: string): Promise<DeadlineWithClient[]> {
  // Get assigned company IDs
  const assignments = await db.staffAssignment.findMany({
    where: { staffId: userId },
    include: { company: true },
  })
  const companyIds = assignments.map(a => a.companyId)
  const companyMap = new Map(assignments.map(a => [a.companyId, a.company.name]))

  if (companyIds.length === 0) {
    return []
  }

  // Calculate deadline window (next 30 days)
  const now = new Date()
  const nextMonth = new Date()
  nextMonth.setDate(nextMonth.getDate() + 30)

  // Get compliance deadlines (system-wide regulatory deadlines)
  const complianceDeadlines = await getUpcomingDeadlines(30, undefined, 100)

  // Get client-specific invoice deadlines
  const invoiceDeadlines = await db.eInvoice.findMany({
    where: {
      companyId: { in: companyIds },
      dueDate: { gte: now, lte: nextMonth },
      status: { notIn: ['SENT', 'ARCHIVED', 'PAID'] },
    },
    select: {
      id: true,
      companyId: true,
      invoiceNumber: true,
      dueDate: true,
      status: true,
      totalAmount: true,
    },
    orderBy: { dueDate: 'asc' },
  })

  // Combine all deadlines
  const allDeadlines: DeadlineWithClient[] = [
    // Compliance deadlines - apply to all clients based on their business type
    ...complianceDeadlines.map(d => ({
      id: `compliance-${d.id}`,
      title: d.title,
      deadlineDate: new Date(d.deadlineDate),
      deadlineType: d.deadlineType,
      severity: d.severity,
      description: d.description,
      source: 'compliance' as const,
    })),
    // Invoice deadlines - client-specific
    ...invoiceDeadlines.map(inv => ({
      id: `invoice-${inv.id}`,
      title: `Invoice ${inv.invoiceNumber} - ${inv.status}`,
      deadlineDate: inv.dueDate,
      deadlineType: 'invoice',
      severity: getDaysUntil(inv.dueDate) <= 3 ? 'critical' : getDaysUntil(inv.dueDate) <= 7 ? 'high' : 'normal',
      description: `Amount: ${Number(inv.totalAmount).toFixed(2)} EUR`,
      clientId: inv.companyId,
      clientName: companyMap.get(inv.companyId),
      source: 'invoice' as const,
    })),
  ]

  // Sort by date
  allDeadlines.sort((a, b) => a.deadlineDate.getTime() - b.deadlineDate.getTime())

  return allDeadlines
}

function getDaysUntil(date: Date): number {
  const deadline = new Date(date)
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

function getSeverityIcon(daysLeft: number, severity: string | null) {
  if (daysLeft <= 0) return <AlertCircle className="h-5 w-5 text-red-500" />
  if (daysLeft <= 3 || severity === "critical") return <AlertTriangle className="h-5 w-5 text-red-500" />
  if (daysLeft <= 7 || severity === "high") return <AlertTriangle className="h-5 w-5 text-amber-500" />
  return <Clock className="h-5 w-5 text-muted-foreground" />
}

function groupDeadlinesByDate(deadlines: DeadlineWithClient[]) {
  const grouped = new Map<string, DeadlineWithClient[]>()

  for (const deadline of deadlines) {
    const dateKey = deadline.deadlineDate.toISOString().split('T')[0]
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, [])
    }
    grouped.get(dateKey)!.push(deadline)
  }

  return Array.from(grouped.entries()).map(([date, deadlines]) => ({
    date,
    deadlines,
  }))
}

export async function StaffCalendar() {
  const user = await getCurrentUser()
  if (!user) return null

  const deadlines = await getStaffDeadlines(user.id)
  const groupedDeadlines = groupDeadlinesByDate(deadlines)

  // Calculate stats
  const totalDeadlines = deadlines.length
  const criticalCount = deadlines.filter(d => {
    const daysLeft = getDaysUntil(d.deadlineDate)
    return daysLeft <= 3 || d.severity === 'critical'
  }).length
  const thisWeekCount = deadlines.filter(d => getDaysUntil(d.deadlineDate) <= 7).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Calendar</h1>
        <p className="text-muted-foreground">
          Upcoming deadlines across all assigned clients
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Deadlines</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDeadlines}</div>
            <p className="text-xs text-muted-foreground">Next 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{criticalCount}</div>
            <p className="text-xs text-muted-foreground">Urgent attention needed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{thisWeekCount}</div>
            <p className="text-xs text-muted-foreground">Due within 7 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Deadlines Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Deadlines</CardTitle>
        </CardHeader>
        <CardContent>
          {deadlines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
              <p className="text-lg font-medium">No upcoming deadlines</p>
              <p className="text-sm text-muted-foreground">
                All deadlines are clear for the next 30 days
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedDeadlines.map(({ date, deadlines: dayDeadlines }) => {
                const dateObj = new Date(date)
                const daysUntil = getDaysUntil(dateObj)
                const isOverdue = daysUntil < 0
                const isToday = daysUntil === 0
                const isTomorrow = daysUntil === 1

                return (
                  <div key={date} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">
                        {dateObj.toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </h3>
                      {isOverdue && (
                        <Badge variant="destructive">Overdue</Badge>
                      )}
                      {isToday && (
                        <Badge variant="destructive">Today</Badge>
                      )}
                      {isTomorrow && (
                        <Badge variant="warning">Tomorrow</Badge>
                      )}
                      {!isOverdue && !isToday && !isTomorrow && daysUntil <= 7 && (
                        <Badge variant="secondary">{daysUntil} days</Badge>
                      )}
                    </div>
                    <div className="space-y-2 pl-4 border-l-2 border-muted">
                      {dayDeadlines.map((deadline) => {
                        const daysLeft = getDaysUntil(deadline.deadlineDate)
                        const severity = getSeverityColor(daysLeft, deadline.severity)
                        const icon = getSeverityIcon(daysLeft, deadline.severity)

                        return (
                          <div
                            key={deadline.id}
                            className={`flex items-start gap-3 rounded-lg p-3 ${
                              daysLeft <= 3
                                ? 'bg-red-500/10 border border-red-500/20'
                                : daysLeft <= 7
                                  ? 'bg-amber-500/10 border border-amber-500/20'
                                  : 'bg-muted/30'
                            }`}
                          >
                            {icon}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <p className="font-medium">{deadline.title}</p>
                                  {deadline.clientName && (
                                    <p className="text-sm text-muted-foreground">
                                      Client: {deadline.clientName}
                                    </p>
                                  )}
                                  {deadline.description && (
                                    <p className="text-sm text-muted-foreground mt-1">
                                      {deadline.description}
                                    </p>
                                  )}
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  <Badge variant={severity}>
                                    {deadline.deadlineType}
                                  </Badge>
                                  {deadline.source === 'compliance' && (
                                    <Badge variant="outline" className="text-xs">
                                      Regulatory
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filter Options - Future Enhancement */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Filter Options</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Filter by deadline type, client, or urgency (coming soon)
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
