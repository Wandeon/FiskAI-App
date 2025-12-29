// src/app/api/admin/support/dashboard/route.ts
// Admin support dashboard API for operations

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth-utils"
import { SupportTicketStatus, SupportTicketPriority } from "@prisma/client"

interface SupportDashboardData {
  totalTickets: number
  openTickets: number
  inProgressTickets: number
  resolvedTickets: number
  closedTickets: number
  byPriority: Record<SupportTicketPriority, number>
  byStatus: Record<SupportTicketStatus, number>
  averageResolutionTime: number | null
  oldestOpenTicket: string | null
  companiesWithOpenTickets: number
  recentActivity: Array<{
    ticketId: string
    title: string
    status: SupportTicketStatus
    priority: SupportTicketPriority
    company: string
    createdAt: Date
    updatedAt: Date
  }>
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.systemRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
  }

  try {
    const allTickets = await db.supportTicket.findMany({
      include: {
        company: {
          select: { name: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    })

    const totalTickets = allTickets.length
    const openTickets = allTickets.filter((t) => t.status === SupportTicketStatus.OPEN).length
    const inProgressTickets = allTickets.filter(
      (t) => t.status === SupportTicketStatus.IN_PROGRESS
    ).length
    const resolvedTickets = allTickets.filter(
      (t) => t.status === SupportTicketStatus.RESOLVED
    ).length
    const closedTickets = allTickets.filter((t) => t.status === SupportTicketStatus.CLOSED).length

    const byPriority: Record<SupportTicketPriority, number> = {
      LOW: 0,
      NORMAL: 0,
      HIGH: 0,
      URGENT: 0,
    }

    allTickets.forEach((ticket) => {
      byPriority[ticket.priority]++
    })

    const byStatus: Record<SupportTicketStatus, number> = {
      OPEN: openTickets,
      IN_PROGRESS: inProgressTickets,
      RESOLVED: resolvedTickets,
      CLOSED: closedTickets,
    }

    const averageResolutionTime: number | null = null

    const openTicketsSorted = allTickets
      .filter((t) => t.status === SupportTicketStatus.OPEN)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

    const oldestOpenTicket = openTicketsSorted.length > 0 ? openTicketsSorted[0].id : null

    const companiesWithOpenTickets = new Set(
      allTickets.filter((t) => t.status === SupportTicketStatus.OPEN).map((t) => t.companyId)
    ).size

    const recentActivity = allTickets.slice(0, 10).map((ticket) => ({
      ticketId: ticket.id,
      title: ticket.title,
      status: ticket.status,
      priority: ticket.priority,
      company: ticket.company.name,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    }))

    const dashboardData: SupportDashboardData = {
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
      byPriority,
      byStatus,
      averageResolutionTime: averageResolutionTime
        ? Math.round(averageResolutionTime * 100) / 100
        : null,
      oldestOpenTicket,
      companiesWithOpenTickets,
      recentActivity,
    }

    return NextResponse.json(dashboardData)
  } catch (error) {
    console.error("Admin support dashboard error:", error)
    return NextResponse.json({ error: "Failed to fetch support dashboard data" }, { status: 500 })
  }
}
