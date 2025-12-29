import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth-utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { MessageSquare, AlertCircle, Clock, CheckCircle2 } from 'lucide-react'
import { TicketsFilters } from './tickets-filters'
import type { SupportTicketStatus, SupportTicketPriority, TicketCategory } from '@prisma/client'

interface TicketsListProps {
  statusFilter?: string
  categoryFilter?: string
  priorityFilter?: string
  clientFilter?: string
}

async function getTickets(
  userId: string,
  statusFilter?: string,
  categoryFilter?: string,
  priorityFilter?: string,
  clientFilter?: string
) {
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

  if (statusFilter && statusFilter !== 'ALL') {
    where.status = statusFilter as SupportTicketStatus
  }

  if (categoryFilter && categoryFilter !== 'ALL') {
    where.category = categoryFilter as TicketCategory
  }

  if (priorityFilter && priorityFilter !== 'ALL') {
    where.priority = priorityFilter as SupportTicketPriority
  }

  if (clientFilter) {
    where.companyId = clientFilter
  }

  // Fetch tickets with company info and message count
  const tickets = await db.supportTicket.findMany({
    where,
    include: {
      company: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          messages: true,
        },
      },
    },
    orderBy: [
      { status: 'asc' },
      { priority: 'desc' },
      { createdAt: 'desc' },
    ],
  })

  return tickets
}

async function getAssignedClients(userId: string) {
  const assignments = await db.staffAssignment.findMany({
    where: { staffId: userId },
    include: {
      company: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { company: { name: 'asc' } },
  })

  return assignments.map(a => ({
    id: a.company.id,
    name: a.company.name,
  }))
}

function getStatusIcon(status: SupportTicketStatus) {
  switch (status) {
    case 'OPEN':
      return <AlertCircle className="h-4 w-4" />
    case 'IN_PROGRESS':
      return <Clock className="h-4 w-4" />
    case 'RESOLVED':
      return <CheckCircle2 className="h-4 w-4" />
    case 'CLOSED':
      return <CheckCircle2 className="h-4 w-4" />
    default:
      return <MessageSquare className="h-4 w-4" />
  }
}

function getStatusBadgeVariant(status: SupportTicketStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case 'OPEN':
      return 'destructive'
    case 'IN_PROGRESS':
      return 'default'
    case 'RESOLVED':
      return 'outline'
    case 'CLOSED':
      return 'secondary'
    default:
      return 'default'
  }
}

function getPriorityBadgeVariant(priority: SupportTicketPriority): "default" | "secondary" | "destructive" | "outline" {
  switch (priority) {
    case 'URGENT':
      return 'destructive'
    case 'HIGH':
      return 'destructive'
    case 'NORMAL':
      return 'outline'
    case 'LOW':
      return 'secondary'
    default:
      return 'default'
  }
}

function getCategoryLabel(category: TicketCategory): string {
  switch (category) {
    case 'TECHNICAL':
      return 'Technical'
    case 'BILLING':
      return 'Billing'
    case 'ACCOUNTING':
      return 'Accounting'
    case 'GENERAL':
      return 'General'
    default:
      return category
  }
}

export async function TicketsList({
  statusFilter,
  categoryFilter,
  priorityFilter,
  clientFilter,
}: TicketsListProps) {
  const user = await getCurrentUser()
  if (!user) return null

  const [tickets, clients] = await Promise.all([
    getTickets(user.id, statusFilter, categoryFilter, priorityFilter, clientFilter),
    getAssignedClients(user.id),
  ])

  // Calculate stats
  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'OPEN').length,
    inProgress: tickets.filter(t => t.status === 'IN_PROGRESS').length,
    resolved: tickets.filter(t => t.status === 'RESOLVED').length,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Support Tickets</h1>
        <p className="text-muted-foreground">
          Manage support tickets from your assigned clients
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              Open
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.open}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              In Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgress}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Resolved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.resolved}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <TicketsFilters
        clients={clients}
        currentStatus={statusFilter}
        currentCategory={categoryFilter}
        currentPriority={priorityFilter}
        currentClient={clientFilter}
      />

      {/* Tickets List */}
      {tickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No tickets found</p>
            <p className="text-sm text-muted-foreground">
              {statusFilter || categoryFilter || priorityFilter || clientFilter
                ? 'Try adjusting your filters'
                : 'Your assigned clients have no support tickets yet'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tickets.map((ticket) => (
            <Link key={ticket.id} href={`/clients/${ticket.companyId}?tab=tickets&ticket=${ticket.id}`}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      {getStatusIcon(ticket.status)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex-1">
                          <h3 className="font-semibold mb-1">{ticket.title}</h3>
                          <div className="flex items-center gap-2 mb-2">
                            <Link
                              href={`/clients/${ticket.company.id}`}
                              className="text-sm text-primary hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {ticket.company.name}
                            </Link>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge variant={getStatusBadgeVariant(ticket.status)}>
                            {ticket.status.replace('_', ' ')}
                          </Badge>
                          <Badge variant={getPriorityBadgeVariant(ticket.priority)}>
                            {ticket.priority}
                          </Badge>
                          <Badge variant="outline">
                            {getCategoryLabel(ticket.category)}
                          </Badge>
                        </div>
                      </div>

                      {ticket.body && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {ticket.body}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>
                          Created {new Date(ticket.createdAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                        {ticket._count.messages > 0 && (
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {ticket._count.messages} {ticket._count.messages === 1 ? 'message' : 'messages'}
                          </span>
                        )}
                        {ticket.updatedAt.getTime() !== ticket.createdAt.getTime() && (
                          <span>
                            Updated {new Date(ticket.updatedAt).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
