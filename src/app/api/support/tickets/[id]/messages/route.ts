import { NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser, getCurrentCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { sanitizeUserContent } from "@/lib/security/sanitize"
import {
  parseBody,
  parseParams,
  isValidationError,
  formatValidationError,
} from "@/lib/api/validation"

const messageSchema = z.object({
  body: z.string().min(1, "Poruka je obavezna"),
})

const paramsSchema = z.object({
  id: z.string().min(1, "Ticket ID is required"),
})

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
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
      select: { id: true },
    })

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    const data = await parseBody(request, messageSchema)

    // Sanitize user-generated content to prevent XSS
    const sanitizedBody = sanitizeUserContent(data.body.trim())

    // Validate content after sanitization to prevent empty submissions
    if (!sanitizedBody || sanitizedBody.length < 1) {
      return NextResponse.json(
        { error: "Poruka je prazna ili sadrzi nedozvoljeni sadrzaj" },
        { status: 400 }
      )
    }

    const message = await db.supportTicketMessage.create({
      data: {
        ticketId: ticket.id,
        authorId: user.id!,
        body: sanitizedBody,
      },
    })

    await db.supportTicket.update({
      where: { id: ticket.id },
      data: { updatedAt: new Date() },
    })

    return NextResponse.json({ message })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    throw error
  }
}
