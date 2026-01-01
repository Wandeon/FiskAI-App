/**
 * Admin Query Functions
 *
 * Database queries for admin components, extracted for Clean Architecture compliance.
 * Components in src/components should not import @prisma/client or @/lib/db directly.
 */

import { db } from "@/lib/db"

/**
 * Get all staff members with assignment counts
 */
export async function getStaffMembers() {
  return db.user.findMany({
    where: { systemRole: "STAFF" },
    include: {
      _count: {
        select: {
          staffAssignments: true,
        },
      },
      staffAssignments: {
        include: {
          company: {
            select: { name: true },
          },
        },
        take: 3,
      },
    },
    orderBy: { createdAt: "desc" },
  })
}

/**
 * Get all tenants (companies) with user and invoice counts
 */
export async function getTenants() {
  return db.company.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          users: true,
          eInvoices: true,
        },
      },
    },
  })
}

/**
 * Get admin dashboard statistics
 */
export async function getAdminStats() {
  const [totalTenants, activeSubscriptions, totalStaff, pendingTickets] = await Promise.all([
    db.company.count(),
    db.company.count({ where: { subscriptionStatus: "active" } }),
    db.user.count({ where: { systemRole: "STAFF" } }),
    db.supportTicket.count({ where: { status: { not: "CLOSED" } } }),
  ])

  return {
    totalTenants,
    activeSubscriptions,
    totalStaff,
    pendingTickets,
  }
}

/**
 * Get recent company signups
 */
export async function getRecentSignups() {
  return db.company.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      name: true,
      createdAt: true,
      subscriptionStatus: true,
    },
  })
}

/**
 * Get admin header stats (tenant count)
 */
export async function getAdminHeaderStats() {
  return db.company.count()
}

// Support dashboard query types
type SupportTicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"
type SupportTicketPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT"
type TicketCategory = "TECHNICAL" | "BILLING" | "ACCOUNTING" | "GENERAL"

/**
 * Get support tickets for admin dashboard
 */
export async function getAdminTickets(
  statusFilter?: string,
  categoryFilter?: string,
  priorityFilter?: string,
  companyFilter?: string,
  searchQuery?: string
) {
  const where: Record<string, unknown> = {}

  if (statusFilter && statusFilter !== "ALL") {
    where.status = statusFilter as SupportTicketStatus
  }

  if (categoryFilter && categoryFilter !== "ALL") {
    where.category = categoryFilter as TicketCategory
  }

  if (priorityFilter && priorityFilter !== "ALL") {
    where.priority = priorityFilter as SupportTicketPriority
  }

  if (companyFilter && companyFilter !== "ALL") {
    where.companyId = companyFilter
  }

  if (searchQuery) {
    where.OR = [
      { title: { contains: searchQuery, mode: "insensitive" } },
      { body: { contains: searchQuery, mode: "insensitive" } },
    ]
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
      _count: {
        select: {
          messages: true,
        },
      },
    },
    orderBy: [{ status: "asc" }, { priority: "desc" }, { updatedAt: "desc" }],
    take: 100,
  })

  return tickets
}

/**
 * Get companies that have support tickets
 */
export async function getCompaniesWithTickets() {
  const companies = await db.company.findMany({
    where: {
      supportTickets: {
        some: {},
      },
    },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          supportTickets: true,
        },
      },
    },
    orderBy: { name: "asc" },
  })

  return companies.map((c) => ({
    id: c.id,
    name: c.name,
    ticketCount: c._count.supportTickets,
  }))
}

/**
 * Get support dashboard statistics
 */
export async function getSupportDashboardStats() {
  const [total, open, inProgress, resolved, closed, urgent, high] = await Promise.all([
    db.supportTicket.count(),
    db.supportTicket.count({ where: { status: "OPEN" } }),
    db.supportTicket.count({ where: { status: "IN_PROGRESS" } }),
    db.supportTicket.count({ where: { status: "RESOLVED" } }),
    db.supportTicket.count({ where: { status: "CLOSED" } }),
    db.supportTicket.count({ where: { priority: "URGENT" } }),
    db.supportTicket.count({ where: { priority: "HIGH" } }),
  ])

  const companiesWithOpenTickets = await db.company.count({
    where: {
      supportTickets: {
        some: {
          status: { in: ["OPEN", "IN_PROGRESS"] },
        },
      },
    },
  })

  return {
    total,
    open,
    inProgress,
    resolved,
    closed,
    urgent,
    high,
    companiesWithOpenTickets,
  }
}
