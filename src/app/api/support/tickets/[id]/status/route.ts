import { NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser, getCurrentCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { SupportTicketStatus } from "@prisma/client"
import { notifyStatusChanged } from "@/lib/support/notifications"

const statusSchema = z.object({
  status: z.nativeEnum(SupportTicketStatus),
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
  const params = await context.params
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const company = await getCurrentCompany(user.id!)
  if (!company) {
    return NextResponse.json({ error: "No company" }, { status: 404 })
  }

  const ticket = await db.supportTicket.findFirst({
    where: { id: params.id, companyId: company.id },
    select: { id: true, status: true, title: true },
  })

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
  }

  const parsed = statusSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Neispravan status" }, { status: 400 })
  }

  const currentStatus = ticket.status
  const newStatus = parsed.data.status

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
}
