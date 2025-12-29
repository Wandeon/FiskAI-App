import { NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser, getCurrentCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { SupportTicketPriority, SupportTicketStatus, TicketCategory } from "@prisma/client"
import { sanitizeUserContent } from "@/lib/security/sanitize"

const createSchema = z.object({
  title: z.string().min(3, "Naslov je prekratak"),
  body: z.string().optional(),
  priority: z.nativeEnum(SupportTicketPriority).optional(),
  category: z.nativeEnum(TicketCategory).optional(),
})

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const company = await getCurrentCompany(user.id!)
  if (!company) {
    return NextResponse.json({ error: "No company" }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const statusParam = searchParams.get("status")
  const allStatuses = Object.values(SupportTicketStatus)
  const statusFilter = statusParam
    ?.split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s): s is SupportTicketStatus => allStatuses.includes(s as SupportTicketStatus)) || [
    SupportTicketStatus.OPEN,
    SupportTicketStatus.IN_PROGRESS,
  ]

  const tickets = await db.supportTicket.findMany({
    where: {
      companyId: company.id,
      status: { in: statusFilter },
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

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const company = await getCurrentCompany(user.id!)
  if (!company) {
    return NextResponse.json({ error: "No company" }, { status: 404 })
  }

  const parsed = createSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Neispravni podaci" }, { status: 400 })
  }

  const data = parsed.data

  // Sanitize user-generated content to prevent XSS
  const sanitizedTitle = sanitizeUserContent(data.title.trim())
  const sanitizedBody = data.body ? sanitizeUserContent(data.body.trim()) : null

  const ticket = await db.supportTicket.create({
    data: {
      companyId: company.id,
      createdById: user.id!,
      title: sanitizedTitle,
      body: sanitizedBody,
      priority: data.priority || SupportTicketPriority.NORMAL,
      category: data.category || TicketCategory.GENERAL,
    },
  })

  return NextResponse.json({ ticket })
}
