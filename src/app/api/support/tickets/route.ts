import { NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser, getCurrentCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { SupportTicketPriority, SupportTicketStatus, TicketCategory } from "@prisma/client"
import { sanitizeUserContent } from "@/lib/security/sanitize"
import { checkRateLimit } from "@/lib/security/rate-limit"
import {
  parseBody,
  parseQuery,
  isValidationError,
  formatValidationError,
} from "@/lib/api/validation"

const createSchema = z.object({
  title: z.string().min(3, "Naslov je prekratak"),
  body: z.string().optional(),
  priority: z.nativeEnum(SupportTicketPriority).optional(),
  category: z.nativeEnum(TicketCategory).optional(),
})

const querySchema = z.object({
  status: z.string().optional(),
})

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const company = await getCurrentCompany(user.id!)
    if (!company) {
      return NextResponse.json({ error: "No company" }, { status: 404 })
    }

    const url = new URL(request.url)
    const { status: statusParam } = parseQuery(url.searchParams, querySchema)

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
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    throw error
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check rate limit for ticket creation
    const rateLimitResult = await checkRateLimit(`support-ticket:${user.id}`, "SUPPORT_TICKET")
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Prekoračen limit tiketa. Pokušajte kasnije." },
        { status: 429 }
      )
    }

    const company = await getCurrentCompany(user.id!)
    if (!company) {
      return NextResponse.json({ error: "No company" }, { status: 404 })
    }

    const data = await parseBody(request, createSchema)

    // Sanitize user-generated content to prevent XSS
    const sanitizedTitle = sanitizeUserContent(data.title.trim())
    const sanitizedBody = data.body ? sanitizeUserContent(data.body.trim()) : null

    // Validate content after sanitization to prevent empty submissions
    if (!sanitizedTitle || sanitizedTitle.length < 3) {
      return NextResponse.json(
        { error: "Naslov je prekratak ili sadrzi nedozvoljeni sadrzaj" },
        { status: 400 }
      )
    }

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
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    throw error
  }
}
