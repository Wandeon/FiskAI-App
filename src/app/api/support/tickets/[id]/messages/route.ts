import { NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser, getCurrentCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { sanitizeUserContent } from "@/lib/security/sanitize"

const messageSchema = z.object({
  body: z.string().min(1, "Poruka je obavezna"),
})

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
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
    select: { id: true },
  })

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
  }

  const parsed = messageSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Neispravni podaci" }, { status: 400 })
  }

  // Sanitize user-generated content to prevent XSS
  const sanitizedBody = sanitizeUserContent(parsed.data.body.trim())

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
}
