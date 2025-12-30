// src/app/api/cron/support-escalation/route.ts
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { SupportTicketPriority, SupportTicketStatus } from "@prisma/client"
import { Resend } from "resend"
import { logger } from "@/lib/logger"

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!process.env.RESEND_API_KEY) {
    logger.error("RESEND_API_KEY not configured for support escalation")
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 })
  }
  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    const now = new Date()
    const SLA_THRESHOLDS = { URGENT: 1, HIGH: 4, NORMAL: 24, LOW: 48 }

    const openTickets = await db.supportTicket.findMany({
      where: {
        status: { in: [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS] },
        escalatedAt: null,
      },
      include: {
        company: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      },
    })

    const admins = await db.user.findMany({
      where: { systemRole: "ADMIN" },
      select: { id: true, email: true, name: true },
    })

    const results = []
    for (const ticket of openTickets) {
      const slaThreshold = SLA_THRESHOLDS[ticket.priority] || SLA_THRESHOLDS.NORMAL
      const thresholdMs = slaThreshold * 60 * 60 * 1000
      const ticketAge = now.getTime() - ticket.createdAt.getTime()

      let shouldEscalate = false
      let escalationType = ""

      if (ticketAge > thresholdMs) {
        shouldEscalate = true
        escalationType = "SLA_BREACH"
      }

      if (!ticket.assignedToId && ticketAge > 24 * 60 * 60 * 1000) {
        shouldEscalate = true
        escalationType = "UNASSIGNED_STALE"
      }

      if (shouldEscalate && admins.length > 0) {
        const slaDeadline = new Date(ticket.createdAt.getTime() + thresholdMs)

        await db.supportTicket.update({
          where: { id: ticket.id },
          data: { escalatedAt: now, escalatedTo: admins[0].id, slaDeadline },
        })

        let emailsSent = 0
        for (const admin of admins) {
          if (!admin.email) continue
          try {
            await resend.emails.send({
              from: "FiskAI Support <noreply@fiskai.hr>",
              to: admin.email,
              subject: `[ESKALACIJA] ${ticket.priority} prioritet: ${ticket.title}`,
              html: `<p>Support ticket ${ticket.id} needs escalation</p>`,
            })
            emailsSent++
          } catch (emailError) {
            logger.error({ error: emailError }, "Failed to send escalation email")
          }
        }

        results.push({ ticketId: ticket.id, priority: ticket.priority, escalationType, emailsSent })
      }
    }

    return NextResponse.json({ success: true, ticketsProcessed: openTickets.length, ticketsEscalated: results.length, results })
  } catch (error) {
    logger.error({ error }, "Support escalation cron error")
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
