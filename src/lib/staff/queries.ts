/**
 * Staff Query Functions
 *
 * Database queries for staff components, extracted for Clean Architecture compliance.
 * Components in src/components should not import @prisma/client or @/lib/db directly.
 */

import { db } from "@/lib/db"
import { getUpcomingDeadlines } from "@/lib/deadlines/queries"

// Types for query results
type SupportTicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"
type SupportTicketPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT"
type TicketCategory = "TECHNICAL" | "BILLING" | "ACCOUNTING" | "GENERAL"

interface DeadlineWithClient {
  id: string
  title: string
  deadlineDate: Date
  deadlineType: string
  severity: string | null
  description: string | null
  clientId?: string
  clientName?: string
  source: "compliance" | "invoice"
}

function getDaysUntil(date: Date): number {
  const deadline = new Date(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  deadline.setHours(0, 0, 0, 0)
  return Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Get staff deadlines including compliance and invoice deadlines
 */
export async function getStaffDeadlines(userId: string): Promise<DeadlineWithClient[]> {
  // Get assigned company IDs
  const assignments = await db.staffAssignment.findMany({
    where: { staffId: userId },
    include: { company: true },
  })
  const companyIds = assignments.map((a) => a.companyId)
  const companyMap = new Map(assignments.map((a) => [a.companyId, a.company.name]))

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
      status: { notIn: ["SENT", "ARCHIVED", "ACCEPTED"] },
    },
    select: {
      id: true,
      companyId: true,
      invoiceNumber: true,
      dueDate: true,
      status: true,
      totalAmount: true,
    },
    orderBy: { dueDate: "asc" },
  })

  // Combine all deadlines
  const allDeadlines: DeadlineWithClient[] = [
    // Compliance deadlines - apply to all clients based on their business type
    ...complianceDeadlines.map((d) => ({
      id: `compliance-${d.id}`,
      title: d.title,
      deadlineDate: new Date(d.deadlineDate),
      deadlineType: d.deadlineType,
      severity: d.severity,
      description: d.description,
      source: "compliance" as const,
    })),
    // Invoice deadlines - client-specific (filter out invoices with no due date)
    ...invoiceDeadlines
      .filter((inv) => inv.dueDate !== null)
      .map((inv) => ({
        id: `invoice-${inv.id}`,
        title: `Invoice ${inv.invoiceNumber} - ${inv.status}`,
        deadlineDate: inv.dueDate!,
        deadlineType: "invoice",
        severity:
          getDaysUntil(inv.dueDate!) <= 3
            ? "critical"
            : getDaysUntil(inv.dueDate!) <= 7
              ? "high"
              : "normal",
        description: `Amount: ${Number(inv.totalAmount).toFixed(2)} EUR`,
        clientId: inv.companyId,
        clientName: companyMap.get(inv.companyId),
        source: "invoice" as const,
      })),
  ]

  // Sort by date
  allDeadlines.sort((a, b) => a.deadlineDate.getTime() - b.deadlineDate.getTime())

  return allDeadlines
}

/**
 * Get staff dashboard statistics
 */
export async function getStaffStats(userId: string) {
  // Get assigned company IDs
  const assignments = await db.staffAssignment.findMany({
    where: { staffId: userId },
    select: { companyId: true },
  })
  const companyIds = assignments.map((a) => a.companyId)

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

  // Get company details for deadline filtering
  const companies = await db.company.findMany({
    where: { id: { in: companyIds } },
    select: {
      id: true,
      isVatPayer: true,
      entitlements: true,
    },
  })

  const thirtyDaysFromNow = new Date(now)
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

  const [assignedClients, pendingTickets, complianceDeadlines, draftInvoices, pendingExpenses] =
    await Promise.all([
      db.staffAssignment.count({ where: { staffId: userId } }),
      db.supportTicket.count({
        where: {
          companyId: { in: companyIds },
          status: { not: "CLOSED" },
        },
      }),
      // Query compliance deadlines in the next 30 days
      db.compliance_deadlines.findMany({
        where: {
          deadline_date: { gte: now, lte: thirtyDaysFromNow },
        },
        select: {
          id: true,
          deadline_type: true,
          applies_to: true,
          deadline_date: true,
          severity: true,
        },
      }),
      db.eInvoice.count({
        where: { companyId: { in: companyIds }, status: "DRAFT" },
      }),
      db.expense.count({
        where: { companyId: { in: companyIds }, status: "PENDING" },
      }),
    ])

  // Filter deadlines based on company characteristics
  const relevantDeadlines = complianceDeadlines.filter((deadline) => {
    const appliesTo = deadline.applies_to as string[] | Record<string, unknown>

    // If applies_to is ["all"], it applies to all companies
    if (Array.isArray(appliesTo) && appliesTo.includes("all")) {
      return companies.length > 0
    }

    // Check if deadline applies to any assigned company
    return companies.some((company) => {
      // VAT deadlines only apply to VAT-registered companies
      if (
        deadline.deadline_type.toLowerCase().includes("vat") ||
        deadline.deadline_type.toLowerCase().includes("pdv")
      ) {
        return company.isVatPayer === true
      }

      // Check entitlements if applies_to has module requirements
      if (Array.isArray(appliesTo)) {
        const entitlements = (company.entitlements as string[]) || []
        return appliesTo.some((requirement) => {
          if (requirement === "all") return true
          if (requirement === "vat" && company.isVatPayer) return true
          return entitlements.includes(requirement)
        })
      }

      return true
    })
  })

  const upcomingDeadlines = relevantDeadlines.length

  // Count by urgency (days until deadline)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const urgentDeadlines = relevantDeadlines.filter((d) => {
    const deadlineDate = new Date(d.deadline_date)
    deadlineDate.setHours(0, 0, 0, 0)
    const daysUntil = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return daysUntil <= 7
  }).length

  const criticalDeadlines = relevantDeadlines.filter((d) => d.severity === "critical").length

  return {
    assignedClients,
    pendingTickets,
    upcomingDeadlines,
    urgentDeadlines,
    criticalDeadlines,
    itemsNeedAttention: draftInvoices + pendingExpenses + pendingTickets,
  }
}

interface DeadlineDetail {
  id: string
  title: string
  deadline_date: Date
  deadline_type: string
  severity: string | null
  daysUntil: number
}

/**
 * Get upcoming deadline details for staff
 */
export async function getUpcomingDeadlineDetails(
  userId: string,
  limit: number = 5
): Promise<DeadlineDetail[]> {
  // Get assigned company IDs
  const assignments = await db.staffAssignment.findMany({
    where: { staffId: userId },
    select: { companyId: true },
  })
  const companyIds = assignments.map((a) => a.companyId)

  if (companyIds.length === 0) return []

  // Get company details for filtering
  const companies = await db.company.findMany({
    where: { id: { in: companyIds } },
    select: {
      id: true,
      isVatPayer: true,
      entitlements: true,
    },
  })

  // Query deadlines in next 30 days
  const now = new Date()
  const thirtyDaysFromNow = new Date(now)
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

  const complianceDeadlines = await db.compliance_deadlines.findMany({
    where: {
      deadline_date: { gte: now, lte: thirtyDaysFromNow },
    },
    select: {
      id: true,
      title: true,
      deadline_date: true,
      deadline_type: true,
      applies_to: true,
      severity: true,
    },
    orderBy: { deadline_date: "asc" },
  })

  // Filter deadlines based on company characteristics
  const relevantDeadlines = complianceDeadlines.filter((deadline) => {
    const appliesTo = deadline.applies_to as string[] | Record<string, unknown>

    if (Array.isArray(appliesTo) && appliesTo.includes("all")) {
      return companies.length > 0
    }

    return companies.some((company) => {
      if (
        deadline.deadline_type.toLowerCase().includes("vat") ||
        deadline.deadline_type.toLowerCase().includes("pdv")
      ) {
        return company.isVatPayer === true
      }

      if (Array.isArray(appliesTo)) {
        const entitlements = (company.entitlements as string[]) || []
        return appliesTo.some((requirement) => {
          if (requirement === "all") return true
          if (requirement === "vat" && company.isVatPayer) return true
          return entitlements.includes(requirement)
        })
      }

      return true
    })
  })

  // Calculate days until deadline
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return relevantDeadlines.slice(0, limit).map((deadline) => {
    const deadlineDate = new Date(deadline.deadline_date)
    deadlineDate.setHours(0, 0, 0, 0)
    const daysUntil = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    return {
      id: deadline.id,
      title: deadline.title,
      deadline_date: deadline.deadline_date,
      deadline_type: deadline.deadline_type,
      severity: deadline.severity,
      daysUntil,
    }
  })
}

interface Activity {
  id: string
  companyName: string
  companyId: string
  action: string
  type: "assignment" | "invoice" | "expense" | "ticket" | "document" | "audit"
  date: Date
  amount?: number
}

/**
 * Get recent activity for staff
 */
export async function getRecentActivity(userId: string): Promise<Activity[]> {
  const assignments = await db.staffAssignment.findMany({
    where: { staffId: userId },
    include: { company: true },
    orderBy: { assignedAt: "desc" },
  })

  const companyIds = assignments.map((a) => a.companyId)
  const companyMap = new Map(assignments.map((a) => [a.companyId, a.company.name]))

  if (companyIds.length === 0) return []

  const [recentInvoices, recentExpenses, recentTickets, recentDocuments, recentAuditLogs] =
    await Promise.all([
      db.eInvoice.findMany({
        where: { companyId: { in: companyIds } },
        select: {
          id: true,
          companyId: true,
          invoiceNumber: true,
          status: true,
          totalAmount: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      db.expense.findMany({
        where: { companyId: { in: companyIds } },
        select: {
          id: true,
          companyId: true,
          description: true,
          status: true,
          totalAmount: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      db.supportTicket.findMany({
        where: { companyId: { in: companyIds } },
        select: { id: true, companyId: true, title: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      db.emailAttachment.findMany({
        where: {
          companyId: { in: companyIds },
          status: { in: ["PENDING", "IMPORTED"] },
        },
        select: {
          id: true,
          companyId: true,
          filename: true,
          status: true,
          receivedAt: true,
          senderEmail: true,
        },
        orderBy: { receivedAt: "desc" },
        take: 10,
      }),
      db.auditLog.findMany({
        where: {
          companyId: { in: companyIds },
          action: { in: ["CREATE", "UPDATE", "DELETE", "EXPORT"] },
          entity: { in: ["Invoice", "Expense", "Contact", "Product", "SupportTicket"] },
        },
        select: {
          id: true,
          companyId: true,
          action: true,
          entity: true,
          entityId: true,
          timestamp: true,
        },
        orderBy: { timestamp: "desc" },
        take: 10,
      }),
    ])

  const activities: Activity[] = [
    ...assignments.slice(0, 2).map((a) => ({
      id: `assign-${a.id}`,
      companyName: a.company.name,
      companyId: a.companyId,
      action: "Assigned to client",
      type: "assignment" as const,
      date: a.assignedAt,
    })),
    ...recentInvoices.map((inv) => ({
      id: `inv-${inv.id}`,
      companyName: companyMap.get(inv.companyId) || "Unknown",
      companyId: inv.companyId,
      action: `Invoice ${inv.invoiceNumber} - ${inv.status}`,
      type: "invoice" as const,
      date: inv.createdAt,
      amount: Number(inv.totalAmount),
    })),
    ...recentExpenses.map((exp) => ({
      id: `exp-${exp.id}`,
      companyName: companyMap.get(exp.companyId) || "Unknown",
      companyId: exp.companyId,
      action: `Expense: ${exp.description.slice(0, 30)} - ${exp.status}`,
      type: "expense" as const,
      date: exp.createdAt,
      amount: Number(exp.totalAmount),
    })),
    ...recentTickets.map((ticket) => ({
      id: `ticket-${ticket.id}`,
      companyName: companyMap.get(ticket.companyId) || "Unknown",
      companyId: ticket.companyId,
      action: `Ticket: ${ticket.title.slice(0, 30)} - ${ticket.status}`,
      type: "ticket" as const,
      date: ticket.createdAt,
    })),
    ...recentDocuments.map((doc) => ({
      id: `doc-${doc.id}`,
      companyName: companyMap.get(doc.companyId) || "Unknown",
      companyId: doc.companyId,
      action: `Document uploaded: ${doc.filename.slice(0, 30)} - ${doc.status}`,
      type: "document" as const,
      date: doc.receivedAt,
    })),
    ...recentAuditLogs.map((log) => ({
      id: `audit-${log.id}`,
      companyName: companyMap.get(log.companyId) || "Unknown",
      companyId: log.companyId,
      action: `${log.action} ${log.entity}`,
      type: "audit" as const,
      date: log.timestamp,
    })),
  ]

  activities.sort((a, b) => b.date.getTime() - a.date.getTime())
  return activities.slice(0, 15)
}

/**
 * Get invitations sent by staff
 */
export async function getInvitations(staffId: string) {
  const invitations = await db.clientInvitation.findMany({
    where: { staffId },
    include: {
      company: {
        select: { id: true, name: true, oib: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return invitations
}

/**
 * Get tasks (support tickets) for staff
 */
export async function getTasks(
  userId: string,
  filters: {
    status?: string
    priority?: string
    category?: string
  }
) {
  // Get assigned company IDs
  const assignments = await db.staffAssignment.findMany({
    where: { staffId: userId },
    select: { companyId: true },
  })
  const companyIds = assignments.map((a) => a.companyId)

  if (companyIds.length === 0) {
    return []
  }

  // Build filter conditions
  const where: Record<string, unknown> = {
    companyId: { in: companyIds },
  }

  if (filters.status && filters.status !== "all") {
    where.status = filters.status as SupportTicketStatus
  }

  if (filters.priority && filters.priority !== "all") {
    where.priority = filters.priority as SupportTicketPriority
  }

  if (filters.category && filters.category !== "all") {
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
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  })

  return tickets
}

/**
 * Get task stats for staff
 */
export async function getTaskStats(userId: string) {
  const assignments = await db.staffAssignment.findMany({
    where: { staffId: userId },
    select: { companyId: true },
  })
  const companyIds = assignments.map((a) => a.companyId)

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
        status: { not: "CLOSED" },
      },
    }),
    db.supportTicket.count({
      where: {
        companyId: { in: companyIds },
        status: "OPEN",
      },
    }),
    db.supportTicket.count({
      where: {
        companyId: { in: companyIds },
        status: "IN_PROGRESS",
      },
    }),
    db.supportTicket.count({
      where: {
        companyId: { in: companyIds },
        status: "RESOLVED",
      },
    }),
  ])

  return { total, open, inProgress, resolved }
}

/**
 * Get assigned clients for staff
 */
export async function getAssignedClients(userId: string, searchQuery?: string) {
  const assignments = await db.staffAssignment.findMany({
    where: {
      staffId: userId,
      ...(searchQuery && {
        OR: [
          { company: { name: { contains: searchQuery, mode: "insensitive" } } },
          { company: { oib: { contains: searchQuery } } },
          { notes: { contains: searchQuery, mode: "insensitive" } },
        ],
      }),
    },
    include: {
      company: {
        include: {
          _count: {
            select: {
              eInvoices: true,
              expenses: true,
              supportTickets: { where: { status: { not: "CLOSED" } } },
              staffReviews: true,
            },
          },
        },
      },
    },
    orderBy: { assignedAt: "desc" },
  })

  // Get pending review counts for each company
  const companyIds = assignments.map((a) => a.company.id)

  // Count total reviewable items (invoices + expenses) minus reviewed ones
  const pendingReviewCounts = await Promise.all(
    companyIds.map(async (companyId) => {
      const [invoiceCount, expenseCount, reviewedCount] = await Promise.all([
        db.eInvoice.count({ where: { companyId } }),
        db.expense.count({ where: { companyId } }),
        db.staffReview.count({ where: { companyId } }),
      ])
      return {
        companyId,
        pendingReview: invoiceCount + expenseCount - reviewedCount,
      }
    })
  )

  const pendingMap = new Map(pendingReviewCounts.map((p) => [p.companyId, p.pendingReview]))

  return assignments.map((a) => ({
    id: a.company.id,
    name: a.company.name,
    oib: a.company.oib,
    entitlements: a.company.entitlements as string[],
    assignedAt: a.assignedAt,
    notes: a.notes,
    stats: {
      invoices: a.company._count.eInvoices,
      expenses: a.company._count.expenses,
      openTickets: a.company._count.supportTickets,
      pendingReview: pendingMap.get(a.company.id) || 0,
    },
  }))
}

/**
 * Get tickets for staff
 */
export async function getTickets(
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
  const companyIds = assignments.map((a) => a.companyId)

  if (companyIds.length === 0) {
    return []
  }

  // Build filter conditions
  const where: Record<string, unknown> = {
    companyId: { in: companyIds },
  }

  if (statusFilter && statusFilter !== "ALL") {
    where.status = statusFilter as SupportTicketStatus
  }

  if (categoryFilter && categoryFilter !== "ALL") {
    where.category = categoryFilter as TicketCategory
  }

  if (priorityFilter && priorityFilter !== "ALL") {
    where.priority = priorityFilter as SupportTicketPriority
  }

  if (clientFilter) {
    // Validate clientFilter is in assigned companies
    if (!companyIds.includes(clientFilter)) {
      return [] // Return empty if trying to filter by non-assigned client
    }
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
    orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
  })

  return tickets
}

/**
 * Get assigned clients simple list (for filters)
 */
export async function getAssignedClientsSimple(userId: string) {
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
    orderBy: { company: { name: "asc" } },
  })

  return assignments.map((a) => ({
    id: a.company.id,
    name: a.company.name,
  }))
}
