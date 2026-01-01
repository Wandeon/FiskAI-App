import { NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser, getCurrentCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { SupportTicketStatus } from "@prisma/client"
import { notifyStatusChanged } from "@/lib/support/notifications"
import {
  parseBody,
  parseParams,
  isValidationError,
  formatValidationError,
} from "@/lib/api/validation"

const statusSchema = z.object({
  status: z.nativeEnum(SupportTicketStatus),
})

const paramsSchema = z.object({
  id: z.string().min(1, "Ticket ID is required"),
})

// Valid status transitions for support ticket workflow
// OPEN -> IN_PROGRESS: Start working on ticket
// OPEN -> CLOSED: Close without working (e.g., duplicate, invalid)
// IN_PROGRESS -> RESOLVED: Mark as resolved
// IN_PROGRESS -> OPEN: Revert to open (needs more info)
// RESOLVED -> CLOSED: Confirm resolution and close
// RESOLVED -> IN_PROGRESS: Reopen if resolution didn't work
// CLOSED -> OPEN: Reopen a closed ticket
const VALID_TRANSITIONS: Record<SupportTicketStatus, SupportTicketStatus[]> = {
  OPEN: [SupportTicketStatus.IN_PROGRESS, SupportTicketStatus.CLOSED],
  IN_PROGRESS: [SupportTicketStatus.RESOLVED, SupportTicketStatus.OPEN],
  RESOLVED: [SupportTicketStatus.CLOSED, SupportTicketStatus.IN_PROGRESS],
  CLOSED: [SupportTicketStatus.OPEN],
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await context.params
    const { id: ticketId } = parseParams(resolvedParams, paramsSchema)

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const company = await getCurrentCompany(user.id!)
    if (!company) {
      return NextResponse.json({ error: "No company" }, { status: 404 })
    }

    const ticket = await db.supportTicket.findFirst({
      where: { id: ticketId, companyId: company.id },
      select: { id: true, status: true, title: true },
    })

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    const { status: newStatus } = await parseBody(request, statusSchema)

    const currentStatus = ticket.status

    // Allow no-op transitions (same status)
    if (currentStatus !== newStatus) {
      const allowedTransitions = VALID_TRANSITIONS[currentStatus]
      if (!allowedTransitions.includes(newStatus)) {
        return NextResponse.json(
          { error: `Cannot transition from ${currentStatus} to ${newStatus}` },
          { status: 400 }
        )
      }
    }

    const updated = await db.supportTicket.update({
      where: { id: ticket.id },
      data: { status: newStatus },
    })

    // Send email notification asynchronously (only if status actually changed)
    if (currentStatus !== newStatus) {
      notifyStatusChanged({
        ticketId: ticket.id,
        ticketTitle: ticket.title,
        oldStatus: currentStatus,
        newStatus: newStatus,
        changedByUserId: user.id!,
        changedByName: user.name,
        changedByEmail: user.email ?? "",
        companyId: company.id,
        companyName: company.name,
      }).catch((error) => {
        console.error("Failed to send status change notification:", error)
      })
    }

    return NextResponse.json({ ticket: updated })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    throw error
  }
}
