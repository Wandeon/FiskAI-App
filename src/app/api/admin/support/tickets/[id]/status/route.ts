import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import type { SupportTicketStatus } from "@prisma/client"

const VALID_STATUSES: SupportTicketStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]

const VALID_TRANSITIONS: Record<SupportTicketStatus, SupportTicketStatus[]> = {
  OPEN: ["IN_PROGRESS", "RESOLVED", "CLOSED"],
  IN_PROGRESS: ["OPEN", "RESOLVED", "CLOSED"],
  RESOLVED: ["OPEN", "IN_PROGRESS", "CLOSED"],
  CLOSED: ["OPEN", "IN_PROGRESS"],
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Neautorizirano" }, { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { systemRole: true },
    })

    if (user?.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Zabranjen pristup" }, { status: 403 })
    }

    const { id } = await context.params
    const body = await request.json()
    const { status } = body

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: "Nevažeći status: " + status },
        { status: 400 }
      )
    }

    const ticket = await db.supportTicket.findUnique({
      where: { id },
      select: { id: true, status: true },
    })

    if (!ticket) {
      return NextResponse.json({ error: "Zahtjev nije pronađen" }, { status: 404 })
    }

    const allowedTransitions = VALID_TRANSITIONS[ticket.status]
    if (!allowedTransitions.includes(status)) {
      return NextResponse.json(
        {
          error: "Nevažeći prijelaz statusa iz " + ticket.status + " u " + status,
        },
        { status: 400 }
      )
    }

    const updated = await db.supportTicket.update({
      where: { id },
      data: { status },
    })

    return NextResponse.json({ success: true, ticket: updated })
  } catch (error) {
    console.error("Error updating ticket status:", error)
    return NextResponse.json(
      { error: "Greška pri ažuriranju statusa" },
      { status: 500 }
    )
  }
}
