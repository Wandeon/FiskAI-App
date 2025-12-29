import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth-utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Users,
  AlertCircle,
  Calendar,
  MessageSquare,
  FileText,
  Receipt,
  Upload,
  Activity as ActivityIcon,
} from 'lucide-react'

async function getStaffStats(userId: string) {
  // Get assigned company IDs
  const assignments = await db.staffAssignment.findMany({
    where: { staffId: userId },
    select: { companyId: true },
  })
  const companyIds = assignments.map(a => a.companyId)

  if (companyIds.length === 0) {
    return {
      assignedClients: 0,
      pendingTickets: 0,
      upcomingDeadlines: 0,
      itemsNeedAttention: 0,
    }
  }

  // Calculate deadline window (next 7 days)
  const now = new Date()
  const nextWeek = new Date()
  nextWeek.setDate(nextWeek.getDate() + 7)

  const [assignedClients, pendingTickets, upcomingDeadlines, draftInvoices, pendingExpenses] = await Promise.all([
    db.staffAssignment.count({ where: { staffId: userId } }),
    db.supportTicket.count({
      where: {
        companyId: { in: companyIds },
        status: { not: 'CLOSED' }
      }
    }),
    db.eInvoice.count({
      where: {
        companyId: { in: companyIds },
        dueDate: { gte: now, lte: nextWeek },
        status: { notIn: ['SENT', 'ARCHIVED'] },
      },
    }),
    db.eInvoice.count({
      where: { companyId: { in: companyIds }, status: 'DRAFT' },
    }),
    db.expense.count({
      where: { companyId: { in: companyIds }, status: 'PENDING' },
    }),
  ])

  return {
    assignedClients,
    pendingTickets,
    upcomingDeadlines,
    itemsNeedAttention: draftInvoices + pendingExpenses + pendingTickets,
  }
}

interface Activity {
  id: string
  companyName: string
  companyId: string
  action: string
  type: 'assignment' | 'invoice' | 'expense' | 'ticket' | 'document' | 'audit'
  date: Date
  amount?: number
}

async function getRecentActivity(userId: string): Promise<Activity[]> {
  const assignments = await db.staffAssignment.findMany({
    where: { staffId: userId },
    include: { company: true },
    orderBy: { assignedAt: 'desc' },
  })

  const companyIds = assignments.map(a => a.companyId)
  const companyMap = new Map(assignments.map(a => [a.companyId, a.company.name]))

  if (companyIds.length === 0) return []

  const [recentInvoices, recentExpenses, recentTickets, recentDocuments, recentAuditLogs] = await Promise.all([
    db.eInvoice.findMany({
      where: { companyId: { in: companyIds } },
      select: { id: true, companyId: true, invoiceNumber: true, status: true, totalAmount: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    db.expense.findMany({
      where: { companyId: { in: companyIds } },
      select: { id: true, companyId: true, description: true, status: true, totalAmount: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    db.supportTicket.findMany({
      where: { companyId: { in: companyIds } },
      select: { id: true, companyId: true, title: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    db.emailAttachment.findMany({
      where: {
        companyId: { in: companyIds },
        status: { in: ['PENDING', 'IMPORTED'] }
      },
      select: { id: true, companyId: true, filename: true, status: true, receivedAt: true, senderEmail: true },
      orderBy: { receivedAt: 'desc' },
      take: 10,
    }),
    db.auditLog.findMany({
      where: {
        companyId: { in: companyIds },
        action: { in: ['CREATE', 'UPDATE', 'DELETE', 'EXPORT'] },
        entity: { in: ['Invoice', 'Expense', 'Contact', 'Product', 'SupportTicket'] }
      },
      select: { id: true, companyId: true, action: true, entity: true, entityId: true, timestamp: true },
      orderBy: { timestamp: 'desc' },
      take: 10,
    }),
  ])

  const activities: Activity[] = [
    ...assignments.slice(0, 2).map(a => ({
      id: `assign-${a.id}`, companyName: a.company.name, companyId: a.companyId,
      action: 'Assigned to client', type: 'assignment' as const, date: a.assignedAt,
    })),
    ...recentInvoices.map(inv => ({
      id: `inv-${inv.id}`, companyName: companyMap.get(inv.companyId) || 'Unknown', companyId: inv.companyId,
      action: `Invoice ${inv.invoiceNumber} - ${inv.status}`, type: 'invoice' as const,
      date: inv.createdAt, amount: Number(inv.totalAmount),
    })),
    ...recentExpenses.map(exp => ({
      id: `exp-${exp.id}`, companyName: companyMap.get(exp.companyId) || 'Unknown', companyId: exp.companyId,
      action: `Expense: ${exp.description.slice(0, 30)} - ${exp.status}`, type: 'expense' as const,
      date: exp.createdAt, amount: Number(exp.totalAmount),
    })),
    ...recentTickets.map(ticket => ({
      id: `ticket-${ticket.id}`, companyName: companyMap.get(ticket.companyId) || 'Unknown', companyId: ticket.companyId,
      action: `Ticket: ${ticket.title.slice(0, 30)} - ${ticket.status}`, type: 'ticket' as const, date: ticket.createdAt,
    })),
    ...recentDocuments.map(doc => ({
      id: `doc-${doc.id}`, companyName: companyMap.get(doc.companyId) || 'Unknown', companyId: doc.companyId,
      action: `Document uploaded: ${doc.filename.slice(0, 30)} - ${doc.status}`, type: 'document' as const, date: doc.receivedAt,
    })),
    ...recentAuditLogs.map(log => ({
      id: `audit-${log.id}`, companyName: companyMap.get(log.companyId) || 'Unknown', companyId: log.companyId,
      action: `${log.action} ${log.entity}`, type: 'audit' as const, date: log.timestamp,
    })),
  ]

  activities.sort((a, b) => b.date.getTime() - a.date.getTime())
  return activities.slice(0, 15)
}

function getActivityIcon(type: string) {
  switch (type) {
    case 'invoice': return <FileText className="h-4 w-4 text-primary" />
    case 'expense': return <Receipt className="h-4 w-4 text-warning" />
    case 'ticket': return <MessageSquare className="h-4 w-4 text-accent" />
    case 'document': return <Upload className="h-4 w-4 text-blue-500" />
    case 'audit': return <ActivityIcon className="h-4 w-4 text-purple-500" />
    default: return <Users className="h-4 w-4 text-success" />
  }
}

export async function StaffDashboard() {
  const user = await getCurrentUser()
  if (!user) return null

  const stats = await getStaffStats(user.id)
  const recentActivity = await getRecentActivity(user.id)

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
