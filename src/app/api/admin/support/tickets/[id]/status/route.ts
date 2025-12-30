import { NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { SupportTicketStatus } from "@prisma/client"

const statusSchema = z.object({ status: z.nativeEnum(SupportTicketStatus) })
const VALID_TRANSITIONS: Record<SupportTicketStatus, SupportTicketStatus[]> = { OPEN: [SupportTicketStatus.IN_PROGRESS, SupportTicketStatus.RESOLVED, SupportTicketStatus.CLOSED], IN_PROGRESS: [SupportTicketStatus.OPEN, SupportTicketStatus.RESOLVED, SupportTicketStatus.CLOSED], RESOLVED: [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS, SupportTicketStatus.CLOSED], CLOSED: [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS] }

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params, user = await getCurrentUser()
  if (!user || user.systemRole !== "ADMIN") return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
  const ticket = await db.supportTicket.findUnique({ where: { id: params.id }, select: { id: true, status: true } })
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
  const parsed = statusSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: "Neispravan status" }, { status: 400 })
  if (ticket.status !== parsed.data.status && !VALID_TRANSITIONS[ticket.status].includes(parsed.data.status)) return NextResponse.json({ error: "Invalid status transition" }, { status: 400 })
  const updated = await db.supportTicket.update({ where: { id: ticket.id }, data: { status: parsed.data.status } })
  return NextResponse.json({ ticket: updated })
}
