import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth-utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import {
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Filter,
  MessageSquare,
} from 'lucide-react'
import type { SupportTicketStatus, SupportTicketPriority, TicketCategory } from '@prisma/client'

interface TasksListProps {
  statusFilter?: string
  priorityFilter?: string
  categoryFilter?: string
}

async function getTasks(userId: string, filters: {
  status?: string
  priority?: string
  category?: string
}) {
  // Get assigned company IDs
  const assignments = await db.staffAssignment.findMany({
    where: { staffId: userId },
    select: { companyId: true },
  })
  const companyIds = assignments.map(a => a.companyId)

  if (companyIds.length === 0) {
    return []
  }

  // Build filter conditions
  const where: any = {
    companyId: { in: companyIds },
  }

  if (filters.status && filters.status !== 'all') {
    where.status = filters.status as SupportTicketStatus
  }

  if (filters.priority && filters.priority !== 'all') {
    where.priority = filters.priority as SupportTicketPriority
  }

  if (filters.category && filters.category !== 'all') {
    where.category = filters.category as TicketCategory
  }

  const tickets = await db.supportTicket.findMany({
    where,
    include: {
      company: {
        select: {
          id: true,
          name: true,
        },
      },
      messages: {
        select: {
          id: true,
        },
      },
    },
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'desc' },
    ],
  })

  return tickets
}

async function getTaskStats(userId: string) {
  const assignments = await db.staffAssignment.findMany({
    where: { staffId: userId },
    select: { companyId: true },
  })
  const companyIds = assignments.map(a => a.companyId)

  if (companyIds.length === 0) {
    return {
      total: 0,
      open: 0,
      inProgress: 0,
      resolved: 0,
    }
  }

  const [total, open, inProgress, resolved] = await Promise.all([
    db.supportTicket.count({
      where: {
        companyId: { in: companyIds },
        status: { not: 'CLOSED' },
      },
    }),
    db.supportTicket.count({
      where: {
        companyId: { in: companyIds },
        status: 'OPEN',
      },
    }),
    db.supportTicket.count({
      where: {
        companyId: { in: companyIds },
        status: 'IN_PROGRESS',
      },
    }),
    db.supportTicket.count({
      where: {
        companyId: { in: companyIds },
        status: 'RESOLVED',
      },
    }),
  ])

  return { total, open, inProgress, resolved }
}

function getStatusIcon(status: SupportTicketStatus) {
  switch (status) {
    case 'OPEN':
      return <Clock className="h-4 w-4" />
    case 'IN_PROGRESS':
      return <AlertCircle className="h-4 w-4" />
    case 'RESOLVED':
      return <CheckCircle2 className="h-4 w-4" />
    case 'CLOSED':
      return <XCircle className="h-4 w-4" />
  }
}

function getStatusColor(status: SupportTicketStatus) {
  switch (status) {
    case 'OPEN':
      return 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
    case 'IN_PROGRESS':
      return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
    case 'RESOLVED':
      return 'bg-green-500/10 text-green-700 dark:text-green-400'
    case 'CLOSED':
      return 'bg-gray-500/10 text-gray-700 dark:text-gray-400'
  }
}

function getPriorityColor(priority: SupportTicketPriority) {
  switch (priority) {
    case 'LOW':
      return 'bg-gray-500/10 text-gray-700 dark:text-gray-400'
    case 'NORMAL':
      return 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
    case 'HIGH':
      return 'bg-orange-500/10 text-orange-700 dark:text-orange-400'
    case 'URGENT':
      return 'bg-red-500/10 text-red-700 dark:text-red-400'
  }
}

function getCategoryLabel(category: TicketCategory) {
  const labels: Record<TicketCategory, string> = {
    TECHNICAL: 'Technical',
    BILLING: 'Billing',
    ACCOUNTING: 'Accounting',
    GENERAL: 'General',
  }
  return labels[category]
}

export async function TasksList({
  statusFilter,
  priorityFilter,
  categoryFilter,
}: TasksListProps) {
  const user = await getCurrentUser()
  if (!user) return null

  const tasks = await getTasks(user.id, {
    status: statusFilter,
    priority: priorityFilter,
    category: categoryFilter,
  })
  const stats = await getTaskStats(user.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tasks</h1>
        <p className="text-muted-foreground">
          Manage support tickets and work items across all assigned clients
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Active</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Open</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.open}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgress}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.resolved}</div>
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
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <div className="flex gap-2">
              <span className="text-sm font-medium text-muted-foreground">Status:</span>
              <div className="flex gap-1">
                <Link
                  href="/tasks?status=all"
                  className={`text-sm px-2 py-1 rounded ${
                    !statusFilter || statusFilter === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  All
                </Link>
                <Link
                  href="/tasks?status=OPEN"
                  className={`text-sm px-2 py-1 rounded ${
                    statusFilter === 'OPEN'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  Open
                </Link>
                <Link
                  href="/tasks?status=IN_PROGRESS"
                  className={`text-sm px-2 py-1 rounded ${
                    statusFilter === 'IN_PROGRESS'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  In Progress
                </Link>
                <Link
                  href="/tasks?status=RESOLVED"
                  className={`text-sm px-2 py-1 rounded ${
                    statusFilter === 'RESOLVED'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  Resolved
                </Link>
              </div>
            </div>

            <div className="flex gap-2">
              <span className="text-sm font-medium text-muted-foreground">Priority:</span>
              <div className="flex gap-1">
                <Link
                  href="/tasks?priority=all"
                  className={`text-sm px-2 py-1 rounded ${
                    !priorityFilter || priorityFilter === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  All
                </Link>
                <Link
                  href="/tasks?priority=URGENT"
                  className={`text-sm px-2 py-1 rounded ${
                    priorityFilter === 'URGENT'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  Urgent
                </Link>
                <Link
                  href="/tasks?priority=HIGH"
                  className={`text-sm px-2 py-1 rounded ${
                    priorityFilter === 'HIGH'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  High
                </Link>
              </div>
            </div>

            <div className="flex gap-2">
              <span className="text-sm font-medium text-muted-foreground">Category:</span>
              <div className="flex gap-1">
                <Link
                  href="/tasks?category=all"
                  className={`text-sm px-2 py-1 rounded ${
                    !categoryFilter || categoryFilter === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  All
                </Link>
                <Link
                  href="/tasks?category=ACCOUNTING"
                  className={`text-sm px-2 py-1 rounded ${
                    categoryFilter === 'ACCOUNTING'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  Accounting
                </Link>
                <Link
                  href="/tasks?category=TECHNICAL"
                  className={`text-sm px-2 py-1 rounded ${
                    categoryFilter === 'TECHNICAL'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  Technical
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tasks List */}
      <Card>
        <CardHeader>
          <CardTitle>Active Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No tasks found matching your filters
            </p>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/clients/${task.companyId}`}
                  className="block p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(task.status)}
                        <h3 className="font-semibold">{task.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {task.company.name}
                      </p>
                      {task.body && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {task.body}
                        </p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={getStatusColor(task.status)}>
                          {task.status.replace('_', ' ')}
                        </Badge>
                        <Badge className={getPriorityColor(task.priority)}>
                          {task.priority}
                        </Badge>
                        <Badge variant="outline">
                          {getCategoryLabel(task.category)}
                        </Badge>
                        {task.messages.length > 0 && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {task.messages.length}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(task.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
