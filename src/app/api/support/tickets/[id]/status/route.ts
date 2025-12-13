import { NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser, getCurrentCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { SupportTicketStatus } from "@prisma/client"

const statusSchema = z.object({
  status: z.nativeEnum(SupportTicketStatus),
})

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
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

  const parsed = statusSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Neispravan status" }, { status: 400 })
  }

  const updated = await db.supportTicket.update({
    where: { id: ticket.id },
    data: { status: parsed.data.status },
  })

  return NextResponse.json({ ticket: updated })
}
