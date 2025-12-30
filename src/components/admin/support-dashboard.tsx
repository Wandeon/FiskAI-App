import { db } from "@/lib/db"
import { SupportDashboardClient } from "./support-dashboard-client"
import type { SupportTicketStatus, SupportTicketPriority, TicketCategory } from "@prisma/client"

interface SupportDashboardProps {
  statusFilter?: string
  categoryFilter?: string
  priorityFilter?: string
  companyFilter?: string
  searchQuery?: string
}

async function getAdminTickets(
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

async function getCompaniesWithTickets() {
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

async function getDashboardStats() {
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

export async function SupportDashboard({
  statusFilter,
  categoryFilter,
  priorityFilter,
  companyFilter,
  searchQuery,
}: SupportDashboardProps) {
  const [tickets, companies, stats] = await Promise.all([
    getAdminTickets(statusFilter, categoryFilter, priorityFilter, companyFilter, searchQuery),
    getCompaniesWithTickets(),
    getDashboardStats(),
  ])

  return (
    <SupportDashboardClient
      tickets={tickets}
      companies={companies}
      stats={stats}
      currentStatus={statusFilter}
      currentCategory={categoryFilter}
      currentPriority={priorityFilter}
      currentCompany={companyFilter}
      currentSearch={searchQuery}
    />
  )
}
