import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth-utils"
import { getIpFromHeaders, getUserAgentFromHeaders, logAudit } from "@/lib/audit"
import type { SupportTicketPriority, SupportTicketStatus } from "@prisma/client"

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const user = await getCurrentUser()
  if (!user || user.systemRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
  }

  const { ticketId } = await params

  try {
    const body = await request.json()
    const { status, priority, assignedToId, reason } = body

    if (!status && !priority && typeof assignedToId === "undefined") {
      return NextResponse.json(
        { error: "At least one override field is required" },
        { status: 400 }
      )
    }

    const ticket = await db.supportTicket.findUnique({
      where: { id: ticketId },
    })

    if (!ticket) {
      return NextResponse.json({ error: "Support ticket not found" }, { status: 404 })
    }

    const updatedTicket = await db.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: status ?? undefined,
        priority: priority ?? undefined,
        assignedToId: typeof assignedToId === "undefined" ? undefined : assignedToId,
      },
    })

    await logAudit({
      companyId: ticket.companyId,
      userId: user.id,
      action: "UPDATE",
      entity: "SupportTicket",
      entityId: ticket.id,
      changes: {
        before: serializeTicket(ticket),
        after: serializeTicket(updatedTicket),
        reason: reason || "Support override",
      },
      ipAddress: getIpFromHeaders(request.headers),
      userAgent: getUserAgentFromHeaders(request.headers),
    })

    return NextResponse.json({ ticket: updatedTicket })
  } catch (error) {
    console.error("Admin support override error:", error)
    return NextResponse.json({ error: "Failed to apply support override" }, { status: 500 })
  }
}
