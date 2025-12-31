// src/app/api/admin/support/tickets/route.ts
// Admin API for listing all support tickets across companies

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth-utils"
import { getIpFromHeaders, getUserAgentFromHeaders, logAudit } from "@/lib/audit"
import { SupportTicketStatus, SupportTicketPriority } from "@prisma/client"

const serializeTicket = (ticket: {
  id: string
  companyId: string
  assignedToId: string | null
  status: SupportTicketStatus
  priority: SupportTicketPriority
  category: string
  title: string
  createdAt: Date
  updatedAt: Date
}) => ({
  id: ticket.id,
  companyId: ticket.companyId,
  assignedToId: ticket.assignedToId,
  status: ticket.status,
  priority: ticket.priority,
  category: ticket.category,
  title: ticket.title,
  createdAt: ticket.createdAt.toISOString(),
  updatedAt: ticket.updatedAt.toISOString(),
})

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user || user.systemRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const priority = searchParams.get("priority")
    const companyId = searchParams.get("companyId")
    const search = searchParams.get("search")

    // Build where clause
    const where: any = {}

    if (status && status !== "ALL") {
      where.status = status as SupportTicketStatus
    }

    if (priority && priority !== "ALL") {
      where.priority = priority as SupportTicketPriority
    }

    if (companyId && companyId !== "ALL") {
      where.companyId = companyId
    }

    if (search && search.trim()) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { body: { contains: search, mode: "insensitive" } },
      ]
    }

    const tickets = await db.supportTicket.findMany({
      where,
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      take: 100,
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            body: true,
            createdAt: true,
            authorId: true,
          },
        },
      },
    })

    return NextResponse.json({ tickets })
  } catch (error) {
    console.error("Admin support tickets error:", error)
    return NextResponse.json({ error: "Failed to fetch support tickets" }, { status: 500 })
  }
}

// PATCH endpoint for bulk actions
export async function PATCH(request: Request) {
  const user = await getCurrentUser()
  if (!user || user.systemRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { ticketIds, action, assignToId, status, reason } = body

    if (!ticketIds || !Array.isArray(ticketIds) || ticketIds.length === 0) {
      return NextResponse.json({ error: "No ticket IDs provided" }, { status: 400 })
    }

    const ipAddress = getIpFromHeaders(request.headers)
    const userAgent = getUserAgentFromHeaders(request.headers)
    const beforeTickets = await db.supportTicket.findMany({
      where: { id: { in: ticketIds } },
    })

    switch (action) {
      case "assign":
        if (!assignToId) {
          return NextResponse.json({ error: "Assign target required" }, { status: 400 })
        }
        await db.supportTicket.updateMany({
          where: { id: { in: ticketIds } },
          data: { assignedToId: assignToId },
        })
        break

      case "updateStatus":
        if (!status) {
          return NextResponse.json({ error: "Status required" }, { status: 400 })
        }
        await db.supportTicket.updateMany({
          where: { id: { in: ticketIds } },
          data: { status },
        })
        break

      case "close":
        await db.supportTicket.updateMany({
          where: { id: { in: ticketIds } },
          data: { status: SupportTicketStatus.CLOSED },
        })
        break

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    }

    const afterTickets = await db.supportTicket.findMany({
      where: { id: { in: ticketIds } },
    })
    const afterMap = new Map(afterTickets.map((ticket) => [ticket.id, ticket]))

    await Promise.all(
      beforeTickets.map((ticket) => {
        const updatedTicket = afterMap.get(ticket.id)
        if (!updatedTicket) return Promise.resolve()

        return logAudit({
          companyId: ticket.companyId,
          userId: user.id,
          action: "UPDATE",
          entity: "SupportTicket",
          entityId: ticket.id,
          changes: {
            before: serializeTicket(ticket),
            after: serializeTicket(updatedTicket),
            action,
            reason: reason || "Admin bulk action",
          },
          ipAddress,
          userAgent,
        })
      })
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Admin bulk action error:", error)
    return NextResponse.json({ error: "Failed to execute bulk action" }, { status: 500 })
  }
}
