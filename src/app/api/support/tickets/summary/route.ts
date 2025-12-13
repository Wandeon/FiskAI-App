import { NextResponse } from "next/server"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { SupportTicketStatus } from "@prisma/client"

export async function GET() {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    const tickets = await db.supportTicket.findMany({
      where: {
        companyId: company.id,
        status: { in: [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS] },
      },
      select: {
        id: true,
        assignedToId: true,
        updatedAt: true,
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { authorId: true, createdAt: true },
        },
      },
    })

    let assignedToMe = 0
    let unassigned = 0
    let unread = 0

    tickets.forEach((ticket) => {
      if (!ticket.assignedToId) {
        unassigned += 1
      }
      if (ticket.assignedToId === user.id) {
        assignedToMe += 1
        const lastMessage = ticket.messages[0]
        if (lastMessage && lastMessage.authorId !== user.id) {
          unread += 1
        }
      }
    })

    return NextResponse.json({
      openCount: tickets.length,
      assignedToMe,
      unassigned,
      unread,
      companyId: company.id,
    })
  } catch (error) {
    console.error("Support summary error:", error)
    return NextResponse.json({ error: "Failed to load summary" }, { status: 500 })
  }
}
