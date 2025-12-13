import { NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser, getCurrentCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { SupportTicketPriority, SupportTicketStatus } from "@prisma/client"

const createSchema = z.object({
  title: z.string().min(3, "Naslov je prekratak"),
  body: z.string().optional(),
  priority: z.nativeEnum(SupportTicketPriority).optional(),
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
  const statusFilter =
    statusParam
      ?.split(",")
      .map((s) => s.trim().toUpperCase())
      .filter((s): s is SupportTicketStatus => allStatuses.includes(s as SupportTicketStatus)) ||
    [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS]

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

  const ticket = await db.supportTicket.create({
    data: {
      companyId: company.id,
      createdById: user.id!,
      title: data.title.trim(),
      body: data.body?.trim() || null,
      priority: data.priority || SupportTicketPriority.NORMAL,
    },
  })

  return NextResponse.json({ ticket })
}
