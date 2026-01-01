import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth-utils"
import { getIpFromHeaders, getUserAgentFromHeaders, logAudit } from "@/lib/audit"
import { SupportTicketPriority, SupportTicketStatus } from "@prisma/client"
import {
  parseParams,
  parseBody,
  isValidationError,
  formatValidationError,
} from "@/lib/api/validation"

const ticketIdParamsSchema = z.object({
  ticketId: z.string().uuid("Invalid ticket ID format"),
})

const overrideBodySchema = z
  .object({
    status: z.nativeEnum(SupportTicketStatus).optional(),
    priority: z.nativeEnum(SupportTicketPriority).optional(),
    assignedToId: z.string().uuid().nullable().optional(),
    reason: z
      .string()
      .min(1, "Reason is required")
      .transform((s) => s.trim()),
  })
  .refine(
    (data) =>
      data.status !== undefined || data.priority !== undefined || data.assignedToId !== undefined,
    { message: "At least one override field is required" }
  )

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

  try {
    const { ticketId } = parseParams(await params, ticketIdParamsSchema)
    const { status, priority, assignedToId, reason } = await parseBody(request, overrideBodySchema)

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
        assignedToId: assignedToId === undefined ? undefined : assignedToId,
      },
    })

    await logAudit({
      companyId: ticket.companyId,
      userId: user.id,
      action: "UPDATE",
      entity: "SupportTicket",
      entityId: ticket.id,
      reason,
      changes: {
        before: serializeTicket(ticket),
        after: serializeTicket(updatedTicket),
      },
      ipAddress: getIpFromHeaders(request.headers),
      userAgent: getUserAgentFromHeaders(request.headers),
    })

    return NextResponse.json({ ticket: updatedTicket })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Admin support override error:", error)
    return NextResponse.json({ error: "Failed to apply support override" }, { status: 500 })
  }
}
