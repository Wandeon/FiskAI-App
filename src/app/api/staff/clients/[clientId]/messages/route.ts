import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { SupportTicketPriority, SupportTicketStatus, TicketCategory } from "@prisma/client"
import { checkStaffRateLimit } from "@/lib/security/staff-rate-limit"

const createTicketSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  body: z.string().min(1, "Message body is required"),
  priority: z.nativeEnum(SupportTicketPriority).optional(),
  category: z.nativeEnum(TicketCategory).optional(),
})

const addMessageSchema = z.object({
  ticketId: z.string(),
  body: z.string().min(1, "Message body is required"),
})

async function verifyStaffAccess(userId: string, companyId: string, systemRole: string) {
  if (systemRole === "ADMIN") return true

  const assignment = await db.staffAssignment.findUnique({
    where: {
      staffId_companyId: {
        staffId: userId,
        companyId: companyId,
      },
    },
  })

  return !!assignment
}

// GET - List all tickets/messages for a client
export async function GET(request: Request, context: { params: Promise<{ clientId: string }> }) {
  const params = await context.params
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.systemRole !== "STAFF" && session.user.systemRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const hasAccess = await verifyStaffAccess(
    session.user.id,
    params.clientId,
    session.user.systemRole
  )

  if (!hasAccess) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const ticketId = searchParams.get("ticketId")

  if (ticketId) {
    // Get single ticket with all messages
    const ticket = await db.supportTicket.findFirst({
      where: { id: ticketId, companyId: params.clientId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            body: true,
            createdAt: true,
            authorId: true,
          },
        },
      },
    })

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    // Get author names for messages
    const authorIds = [...new Set(ticket.messages.map((m) => m.authorId).filter(Boolean))]
    const authors = await db.user.findMany({
      where: { id: { in: authorIds as string[] } },
      select: { id: true, name: true, email: true, systemRole: true },
    })
    const authorMap = new Map(authors.map((a) => [a.id, a]))

    const messagesWithAuthors = ticket.messages.map((m) => ({
      ...m,
      author: m.authorId ? authorMap.get(m.authorId) : null,
    }))

    return NextResponse.json({ ticket: { ...ticket, messages: messagesWithAuthors } })
  }

  // Get all tickets for client
  const statusParam = searchParams.get("status")
  const allStatuses = Object.values(SupportTicketStatus)
  const statusFilter = statusParam
    ?.split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s): s is SupportTicketStatus => allStatuses.includes(s as SupportTicketStatus))

  const tickets = await db.supportTicket.findMany({
    where: {
      companyId: params.clientId,
      ...(statusFilter && statusFilter.length > 0 ? { status: { in: statusFilter } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, body: true, createdAt: true, authorId: true },
      },
    },
  })

  return NextResponse.json({ tickets })
}

// POST - Create new ticket or add message
export async function POST(request: Request, context: { params: Promise<{ clientId: string }> }) {
  const params = await context.params
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.systemRole !== "STAFF" && session.user.systemRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const hasAccess = await verifyStaffAccess(
    session.user.id,
    params.clientId,
    session.user.systemRole
  )

  if (!hasAccess) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 })
  }

  const body = await request.json()

  // Check if adding message to existing ticket
  if (body.ticketId) {
    const parsed = addMessageSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const ticket = await db.supportTicket.findFirst({
      where: { id: parsed.data.ticketId, companyId: params.clientId },
    })

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    const message = await db.supportTicketMessage.create({
      data: {
        ticketId: ticket.id,
        authorId: session.user.id,
        body: parsed.data.body.trim(),
      },
    })

    // Update ticket timestamp and set to IN_PROGRESS if OPEN
    await db.supportTicket.update({
      where: { id: ticket.id },
      data: {
        updatedAt: new Date(),
        status: ticket.status === "OPEN" ? "IN_PROGRESS" : ticket.status,
      },
    })

    return NextResponse.json({ message })
  }

  // Create new ticket
  const parsed = createTicketSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const ticket = await db.supportTicket.create({
    data: {
      companyId: params.clientId,
      createdById: session.user.id,
      title: parsed.data.title.trim(),
      body: parsed.data.body?.trim() || null,
      priority: parsed.data.priority || SupportTicketPriority.NORMAL,
      category: parsed.data.category || TicketCategory.GENERAL,
      status: SupportTicketStatus.OPEN,
    },
  })

  // Also create the first message from the body
  if (parsed.data.body) {
    await db.supportTicketMessage.create({
      data: {
        ticketId: ticket.id,
        authorId: session.user.id,
        body: parsed.data.body.trim(),
      },
    })
  }

  return NextResponse.json({ ticket })
}

// PATCH - Update ticket status
export async function PATCH(request: Request, context: { params: Promise<{ clientId: string }> }) {
  const params = await context.params
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.systemRole !== "STAFF" && session.user.systemRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const hasAccess = await verifyStaffAccess(
    session.user.id,
    params.clientId,
    session.user.systemRole
  )

  if (!hasAccess) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 })
  }

  const body = await request.json()
  const { ticketId, status } = body

  if (!ticketId || !status) {
    return NextResponse.json({ error: "ticketId and status required" }, { status: 400 })
  }

  if (!Object.values(SupportTicketStatus).includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }

  const ticket = await db.supportTicket.findFirst({
    where: { id: ticketId, companyId: params.clientId },
  })

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
  }

  const updated = await db.supportTicket.update({
    where: { id: ticketId },
    data: { status, updatedAt: new Date() },
  })

  return NextResponse.json({ ticket: updated })
}
