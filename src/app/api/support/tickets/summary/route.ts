import { NextResponse } from "next/server"
import { getCurrentUser, getCurrentCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { SupportTicketStatus } from "@prisma/client"
import { isValidationError, formatValidationError } from "@/lib/api/validation"

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const company = await getCurrentCompany(user.id!)
    if (!company) {
      // Return empty summary for users without a company (onboarding)
      return NextResponse.json({
        openCount: 0,
        assignedToMe: 0,
        unassigned: 0,
        unread: 0,
        companyId: null,
      })
    }

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
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Support summary error:", error)
    return NextResponse.json({ error: "Failed to load summary" }, { status: 500 })
  }
}
