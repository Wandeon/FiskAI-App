// src/app/api/admin/support/tickets/route.ts
// Admin API for listing all support tickets across companies

import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth-utils"
import { getIpFromHeaders, getUserAgentFromHeaders, logAudit } from "@/lib/audit"
import { SupportTicketStatus, SupportTicketPriority } from "@prisma/client"
import {
  parseQuery,
  parseBody,
  isValidationError,
  formatValidationError,
} from "@/lib/api/validation"

const ticketQuerySchema = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  companyId: z.string().optional(),
  search: z.string().optional(),
})

const bulkActionSchema = z.object({
  ticketIds: z.array(z.string()).min(1, "No ticket IDs provided"),
  action: z.enum(["assign", "updateStatus", "close"], { message: "Unknown action" }),
  assignToId: z.string().optional(),
  status: z.nativeEnum(SupportTicketStatus).optional(),
  reason: z.string().optional(),
})

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
    const url = new URL(request.url)
    const { status, priority, companyId, search } = parseQuery(url.searchParams, ticketQuerySchema)

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
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
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
    const { ticketIds, action, assignToId, status, reason } = await parseBody(
      request,
      bulkActionSchema
    )

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
          } as any,
          ipAddress,
          userAgent,
        })
      })
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Admin bulk action error:", error)
    return NextResponse.json({ error: "Failed to execute bulk action" }, { status: 500 })
  }
}
